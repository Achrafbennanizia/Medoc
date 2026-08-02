//! Owner-device activation manifest import (offline medoc-keygen output).

use std::path::Path;

use medoc_core::argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::Utc;
use ed25519_dalek::SigningKey;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection;
use medoc_core::infrastructure::database::db_key;
use medoc_core::infrastructure::license_repo;
use sqlx::SqlitePool;
use uuid::Uuid;
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use zeroize::Zeroizing;

use crate::master_keys;
use crate::verbund::crypto::device_identity::DeviceIdentity;
use crate::verbund::entities::{Geraet, Lizenz};
use crate::verbund::enums::{GeraetStatus, SeatRolle};
use crate::verbund::ports::{GeraetRepo, LizenzRepo, SqliteVerbundRepos};
use crate::verbund::seat_budget::seat_budget_from_edition;
use crate::verbund::services::audit;
use crate::verbund::services::lizenz_service::{require_owner_activation_device, verbund_status};

#[derive(serde::Deserialize)]
struct Kdf {
    alg: String,
    salt: String,
    ops: u32,
    mem: u64,
}

#[derive(serde::Deserialize)]
struct Sealed {
    nonce: String,
    ciphertext: String,
}

#[derive(serde::Deserialize)]
struct Manifest {
    version: u32,
    cluster_id: String,
    device_pubkey: String,
    device_fingerprint: String,
    #[serde(rename = "cluster_ca_pubkey")]
    cluster_ca_pubkey: String,
    #[serde(rename = "created_at")]
    _created_at: String,
    kdf: Kdf,
    sealed: Sealed,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationSummary {
    pub cluster_id: String,
    pub device_fingerprint: String,
    /// True when the manifest file was removed from disk after import.
    pub manifest_removed: bool,
    /// True when SQLCipher rekey closed the live pool — desktop app should reload.
    pub requires_app_reload: bool,
}

fn cluster_id_from_bytes(bytes: &[u8]) -> Result<String, AppError> {
    if bytes.len() != 16 {
        return Err(AppError::Validation(format!(
            "cluster_id length {} (expected 16)",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 16];
    arr.copy_from_slice(bytes);
    Ok(Uuid::from_bytes(arr).to_string())
}

async fn activation_already_done(pool: &SqlitePool) -> Result<bool, AppError> {
    let repos = SqliteVerbundRepos { pool };
    Ok(repos.load().await?.is_some())
}

fn unwrap_manifest(m: &Manifest, passphrase: &str) -> Result<Zeroizing<Vec<u8>>, AppError> {
    if m.version != 1 {
        return Err(AppError::Validation(format!(
            "Activation manifest version {} not supported",
            m.version
        )));
    }
    if m.kdf.alg != "argon2id13" {
        return Err(AppError::Validation("Unexpected KDF algorithm".into()));
    }

    let salt = STANDARD
        .decode(&m.kdf.salt)
        .map_err(|e| AppError::Validation(format!("KDF salt: {e}")))?;
    let nonce = STANDARD
        .decode(&m.sealed.nonce)
        .map_err(|e| AppError::Validation(format!("Nonce: {e}")))?;
    let ct = STANDARD
        .decode(&m.sealed.ciphertext)
        .map_err(|e| AppError::Validation(format!("Ciphertext: {e}")))?;

    let m_cost_kib: u32 = (m.kdf.mem / 1024)
        .try_into()
        .map_err(|_| AppError::Internal("KDF mem too large".into()))?;
    let params = Params::new(m_cost_kib, m.kdf.ops, 1, Some(32))
        .map_err(|e| AppError::Internal(format!("Argon2 params: {e}")))?;
    let kdf = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut wrap = Zeroizing::new([0u8; 32]);
    kdf.hash_password_into(passphrase.as_bytes(), &salt, wrap.as_mut())
        .map_err(|e| AppError::Internal(format!("Argon2: {e}")))?;

    let cipher = XChaCha20Poly1305::new_from_slice(wrap.as_ref())
        .map_err(|e| AppError::Internal(format!("AEAD key: {e}")))?;
    let plain = cipher
        .decrypt(XNonce::from_slice(&nonce), ct.as_ref())
        .map_err(|_| {
            AppError::Validation(
                "Decryption failed (wrong passphrase or tampered manifest)"
                    .into(),
            )
        })?;

    if plain.len() != 160 {
        return Err(AppError::Validation(format!(
            "Unexpected plaintext length {} (expected 160)",
            plain.len()
        )));
    }

    Ok(Zeroizing::new(plain))
}

fn verify_device_pubkey(device_pk: &[u8], plain: &[u8]) -> Result<(), AppError> {
    use ed25519_dalek::{Signer, Verifier, VerifyingKey};

    if device_pk.len() != 32 {
        return Err(AppError::Validation("device_pubkey length invalid".into()));
    }
    let mut pk_arr = [0u8; 32];
    pk_arr.copy_from_slice(device_pk);

    let device_seed: [u8; 32] = plain[0..32]
        .try_into()
        .map_err(|_| AppError::Internal("device seed slice".into()))?;
    let sk = SigningKey::from_bytes(&device_seed);
    if sk.verifying_key().to_bytes() != pk_arr {
        return Err(AppError::Validation(
            "Device key does not match the published public key".into(),
        ));
    }

    const MSG: &[u8] = b"medoc-activation-check";
    let sig = sk.sign(MSG);
    VerifyingKey::from_bytes(&pk_arr)
        .map_err(|e| AppError::Validation(format!("device_pubkey invalid: {e}")))?
        .verify(MSG, &sig)
        .map_err(|_| {
            AppError::Validation("Device key signature verification failed".into())
        })?;
    Ok(())
}

fn verify_ca_pubkey(ca_pk: &[u8], plain: &[u8]) -> Result<(), AppError> {
    if ca_pk.len() != 32 {
        return Err(AppError::Validation("cluster_ca_pubkey length invalid".into()));
    }
    let ca_seed: [u8; 32] = plain[64..96]
        .try_into()
        .map_err(|_| AppError::Internal("ca seed slice".into()))?;
    let sk = SigningKey::from_bytes(&ca_seed);
    let mut expected = [0u8; 32];
    expected.copy_from_slice(ca_pk);
    if sk.verifying_key().to_bytes() != expected {
        return Err(AppError::Validation(
            "Cluster CA key does not match the published public key".into(),
        ));
    }
    Ok(())
}

/// Owner-device only, one-time. Imports sealed keys from `activation.json`.
pub async fn import_owner_activation(
    pool: &SqlitePool,
    app_data_dir: &Path,
    user_id: &str,
    manifest_path: &Path,
    passphrase: &str,
) -> Result<ActivationSummary, AppError> {
    require_owner_activation_device(pool).await?;
    if passphrase.is_empty() {
        return Err(AppError::validation_code("error.verbund.passphrase_required"));
    }
    if activation_already_done(pool).await? {
        let status = verbund_status(pool).await?;
        let fp = DeviceIdentity::try_load()
            .ok()
            .flatten()
            .map(|i| i.fingerprint)
            .filter(|s| !s.is_empty())
            .or(status.local_fingerprint)
            .unwrap_or_default();
        return Ok(ActivationSummary {
            cluster_id: status.cluster_id.unwrap_or_default(),
            device_fingerprint: fp,
            manifest_removed: false,
            requires_app_reload: false,
        });
    }

    let raw = std::fs::read_to_string(manifest_path).map_err(|e| {
        AppError::Validation(format!(
            "Manifest {} not readable: {e}",
            manifest_path.display()
        ))
    })?;
    let m: Manifest = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("Manifest JSON invalid: {e}")))?;

    let device_pk = STANDARD
        .decode(&m.device_pubkey)
        .map_err(|e| AppError::Validation(format!("device_pubkey: {e}")))?;
    let ca_pk = STANDARD
        .decode(&m.cluster_ca_pubkey)
        .map_err(|e| AppError::Validation(format!("cluster_ca_pubkey: {e}")))?;
    let cluster_raw = STANDARD
        .decode(&m.cluster_id)
        .map_err(|e| AppError::Validation(format!("cluster_id: {e}")))?;

    let plain = unwrap_manifest(&m, passphrase)?;
    verify_device_pubkey(&device_pk, &plain)?;
    verify_ca_pubkey(&ca_pk, &plain)?;

    let device_seed: [u8; 32] = plain[0..32]
        .try_into()
        .map_err(|_| AppError::Internal("device seed".into()))?;
    let ca_seed: [u8; 32] = plain[64..96]
        .try_into()
        .map_err(|_| AppError::Internal("ca seed".into()))?;
    let sqlcipher_key: [u8; 32] = plain[128..160]
        .try_into()
        .map_err(|_| AppError::Internal("db key".into()))?;

    let db_path = app_data_dir.join("medoc.db");
    let rekeyed = db_key::apply_activation_sqlcipher_key(
        pool,
        app_data_dir,
        &db_path,
        &sqlcipher_key,
    )
    .await?;

    let work_pool = if rekeyed {
        connection::reopen_app_pool(app_data_dir).await?
    } else {
        pool.clone()
    };

    master_keys::import_seed(ca_seed)?;
    let identity = DeviceIdentity::import_seed(device_seed)?;

    let cluster_id = cluster_id_from_bytes(&cluster_raw)?;
    let budget = seat_budget_from_edition("BASIC");
    let signing_key = master_keys::load_or_create()?;

    let lizenz = Lizenz {
        cluster_id: cluster_id.clone(),
        license_ref: String::new(),
        signing_key_enc: signing_key.to_bytes().to_vec(),
        max_total: budget.max_total,
        max_admin: budget.max_admin,
        max_member: budget.max_member,
        activated_at: Utc::now(),
    };

    let device_id = license_repo::ensure_device_id(&work_pool).await?;
    let repos = SqliteVerbundRepos {
        pool: &work_pool,
    };
    repos.save(&lizenz).await?;

    let geraet = Geraet {
        fingerprint: identity.fingerprint.clone(),
        cluster_id: cluster_id.clone(),
        device_id,
        pubkey: identity.pubkey_bytes.to_vec(),
        hostname: hostname::get()
            .ok()
            .and_then(|h| h.into_string().ok()),
        os: Some(std::env::consts::OS.into()),
        last_ip: None,
        seat_role: SeatRolle::Admin,
        status: GeraetStatus::Active,
        seat_cert: None,
        last_seen: Some(Utc::now()),
        created_at: Utc::now(),
    };
    repos.upsert(&geraet).await?;

    audit::log_verbund(
        &work_pool,
        user_id,
        "ACTIVATION_IMPORT",
        Some(&cluster_id),
        Some(&identity.fingerprint),
    )
    .await?;

    let manifest_removed = std::fs::remove_file(manifest_path).is_ok();

    let _ = m.device_fingerprint;

    Ok(ActivationSummary {
        cluster_id,
        device_fingerprint: identity.fingerprint,
        manifest_removed,
        requires_app_reload: rekeyed,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::verbund::crypto::device_identity::fingerprint_from_pubkey;
    use std::process::Command;

    fn keygen_bin() -> Option<std::path::PathBuf> {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let candidates = [
            manifest_dir.join("../../../installer/medoc-keygen/build/medoc-keygen"),
            manifest_dir.join("../../../installer/dist/medoc-keygen-darwin-arm64"),
            manifest_dir.join("../../../installer/dist/medoc-keygen-darwin-aarch64"),
            manifest_dir.join("../../../installer/dist/medoc-keygen-linux-x86_64"),
        ];
        candidates.into_iter().find(|p| p.exists())
    }

    #[test]
    fn unwrap_matches_cpp_keygen_when_available() {
        let Some(bin) = keygen_bin() else {
            eprintln!("skip: medoc-keygen not built");
            return;
        };
        let dir = std::env::temp_dir().join(format!("medoc-act-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("tmpdir");
        let manifest = dir.join("activation.json");
        let pw_file = dir.join("pw.txt");
        std::fs::write(&pw_file, "correct horse battery staple\n").expect("pw");

        let status = Command::new(&bin)
            .args([
                "--out",
                manifest.to_str().expect("path"),
                "--passphrase-file",
                pw_file.to_str().expect("pw path"),
            ])
            .status()
            .expect("keygen");
        assert!(status.success(), "medoc-keygen failed");

        let raw = std::fs::read_to_string(&manifest).expect("manifest");
        let m: Manifest = serde_json::from_str(&raw).expect("json");
        let plain = unwrap_manifest(&m, "correct horse battery staple").expect("unwrap");
        assert_eq!(plain.len(), 160);

        let device_pk = STANDARD.decode(&m.device_pubkey).expect("pk");
        verify_device_pubkey(&device_pk, &plain).expect("device key");
        let ca_pk = STANDARD.decode(&m.cluster_ca_pubkey).expect("ca");
        verify_ca_pubkey(&ca_pk, &plain).expect("ca");
        let mut pk_arr = [0u8; 32];
        pk_arr.copy_from_slice(&device_pk);
        assert_eq!(fingerprint_from_pubkey(&pk_arr), m.device_fingerprint);
    }

    /// Dev helper: `MEDOC_HEADLESS_ACTIVATION=1 cargo test -p medoc-sync headless_dev_activation -- --ignored --nocapture`
    #[tokio::test]
    #[ignore = "dev helper: imports .dev-activation/activation.json into local app data"]
    async fn headless_dev_activation() {
        if std::env::var("MEDOC_HEADLESS_ACTIVATION").ok().as_deref() != Some("1") {
            return;
        }
        let root = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..");
        let manifest = root.join(".dev-activation/activation.json");
        assert!(
            manifest.exists(),
            "missing {} — run scripts/dev-onboarding-reset.sh",
            manifest.display()
        );
        let app_dir = std::path::PathBuf::from(
            std::env::var("HOME").expect("HOME"),
        )
        .join("Library/Application Support/de.medoc.app");
        let pool = connection::init_db_headless(&app_dir)
            .await
            .expect("open medoc.db (set MEDOC_DB_KEY like tools/dev-tauri.sh)");
        let summary = import_owner_activation(
            &pool,
            &app_dir,
            "onboarding",
            &manifest,
            "correct horse battery staple",
        )
        .await
        .expect("import_owner_activation");
        let status = verbund_status(&pool).await.expect("verbund_status");
        println!(
            "cluster_id={} fingerprint={} is_owner={} licensed={} manifest_removed={}",
            summary.cluster_id,
            summary.device_fingerprint,
            status.is_owner,
            status.licensed,
            summary.manifest_removed
        );
        assert!(status.is_owner, "expected owner after activation import");
        assert!(!status.licensed, "vendor license is step 2");
    }
}
