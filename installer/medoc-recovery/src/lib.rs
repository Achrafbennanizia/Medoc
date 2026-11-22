//! Safe Bridge recovery library (v2). Shared by CLI and UI.
//! Never writes the OS keychain — emits `db-key.wrap` for the main app.

use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use medoc_core::infrastructure::database::{db_key, sqlcipher};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroizing;

pub mod export;
pub mod store;
pub mod ui;
pub mod ui_i18n;

/// Launch the native recovery window (used by `medoc-recovery-ui`).
pub fn ui_entry() -> Result<(), String> {
    ui::run()
}

const VENDOR_HKDF_INFO: &[u8] = b"medoc-vendor-share-v2";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Bridge {
    A,
    B,
    C,
}

impl Bridge {
    pub fn as_str(self) -> &'static str {
        match self {
            Bridge::A => "a",
            Bridge::B => "b",
            Bridge::C => "c",
        }
    }

    pub fn parse(s: &str) -> Result<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "a" => Ok(Bridge::A),
            "b" => Ok(Bridge::B),
            "c" => Ok(Bridge::C),
            _ => bail!("bridge must be a, b, or c"),
        }
    }
}

/// Inputs for a recovery attempt (paths / secrets filled per bridge).
#[derive(Debug, Clone, Default)]
pub struct RecoverRequest {
    pub bridge: Option<Bridge>,
    pub manifest: Option<PathBuf>,
    pub app_dir: Option<PathBuf>,
    pub practice_share: Option<PathBuf>,
    pub vendor_share: Option<PathBuf>,
    pub vendor_sk: Option<PathBuf>,
    pub passphrase: Option<String>,
    pub write_wrap_dir: Option<PathBuf>,
    pub wrap_passphrase: Option<String>,
    pub verify_db: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryResult {
    pub kind: String,
    pub bridge: String,
    pub recovered_at: String,
    pub kcv_b64: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wrap_written: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub verify_db: Option<String>,
    /// Only present when explicitly requested (dangerous).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_hex: Option<String>,
}

pub fn recover(req: &RecoverRequest) -> Result<(Zeroizing<Vec<u8>>, RecoveryResult)> {
    let bridge = req.bridge.context("bridge required")?;
    let key = match bridge {
        Bridge::A => {
            let m = req
                .manifest
                .as_deref()
                .context("manifest required for bridge A")?;
            let pw = req
                .passphrase
                .as_deref()
                .context("passphrase required for bridge A")?;
            recover_a(m, pw)?
        }
        Bridge::B => {
            let dir = req
                .app_dir
                .as_deref()
                .context("app_dir required for bridge B")?;
            let pw = req
                .passphrase
                .as_deref()
                .context("passphrase required for bridge B")?;
            let k = db_key::read_wrap_key(dir, pw).map_err(|e| anyhow::anyhow!("{e}"))?;
            Zeroizing::new(k.to_vec())
        }
        Bridge::C => {
            let ps = req
                .practice_share
                .as_deref()
                .context("practice_share required")?;
            let vs = req
                .vendor_share
                .as_deref()
                .context("vendor_share required")?;
            let sk = req.vendor_sk.as_deref().context("vendor_sk required")?;
            recover_c(ps, vs, sk)?
        }
    };

    let kcv = db_key::compute_kcv(&key);
    let mut wrap_written = None;
    if let Some(dir) = req.write_wrap_dir.as_ref() {
        let wrap_pw = req
            .wrap_passphrase
            .as_deref()
            .or(req.passphrase.as_deref())
            .context("wrap passphrase required when writing wrap")?;
        db_key::write_wrap_for_recovery(dir, &key, wrap_pw).map_err(|e| anyhow::anyhow!("{e}"))?;
        wrap_written = Some(dir.display().to_string());
    }

    let mut verify_status = None;
    if let Some(db) = req.verify_db.as_ref() {
        let rt = tokio::runtime::Runtime::new()?;
        match rt.block_on(verify_db_copy(db, &key)) {
            Ok(()) => verify_status = Some("ok".into()),
            Err(e) => verify_status = Some(format!("fail: {e:#}")),
        }
    }

    let result = RecoveryResult {
        kind: "medoc-recovery-result.v1".into(),
        bridge: bridge.as_str().into(),
        recovered_at: chrono_now(),
        kcv_b64: STANDARD.encode(&kcv),
        wrap_written,
        verify_db: verify_status,
        key_hex: None,
    };
    Ok((key, result))
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}

pub fn write_wrap(app_dir: &Path, key: &[u8], passphrase: &str) -> Result<()> {
    db_key::write_wrap_for_recovery(app_dir, key, passphrase).map_err(|e| anyhow::anyhow!("{e}"))
}

pub fn export_key_file(out: &Path, key: &[u8]) -> Result<()> {
    std::fs::write(out, format!("{}\n", STANDARD.encode(key)))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(out, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

#[derive(Deserialize)]
struct Manifest {
    kcv: Option<String>,
    kdf: Kdf,
    sealed: Sealed,
}

#[derive(Deserialize)]
struct Kdf {
    salt: String,
    ops: u32,
    mem: u64,
}

#[derive(Deserialize)]
struct Sealed {
    nonce: String,
    ciphertext: String,
}

pub fn recover_a(manifest: &Path, passphrase: &str) -> Result<Zeroizing<Vec<u8>>> {
    let raw = std::fs::read_to_string(manifest)?;
    let m: Manifest = serde_json::from_str(&raw)?;
    let salt = STANDARD.decode(&m.kdf.salt)?;
    let nonce = STANDARD.decode(&m.sealed.nonce)?;
    let ct = STANDARD.decode(&m.sealed.ciphertext)?;
    let m_kib: u32 = (m.kdf.mem / 1024).try_into().context("kdf.mem")?;
    let params =
        argon2::Params::new(m_kib, m.kdf.ops, 1, Some(32)).map_err(|e| anyhow::anyhow!("{e}"))?;
    let argon = argon2::Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    let mut wrap = [0u8; 32];
    argon
        .hash_password_into(passphrase.as_bytes(), &salt, &mut wrap)
        .map_err(|e| anyhow::anyhow!("argon2: {e}"))?;
    let cipher = XChaCha20Poly1305::new_from_slice(&wrap)?;
    let plain = cipher
        .decrypt(XNonce::from_slice(&nonce), ct.as_ref())
        .map_err(|_| anyhow::anyhow!("Bridge A decrypt failed"))?;
    if plain.len() != 160 {
        bail!("unexpected activation plaintext length {}", plain.len());
    }
    let key = plain[128..160].to_vec();
    if let Some(kcv_b64) = m.kcv {
        let expected = STANDARD.decode(kcv_b64.trim())?;
        if !db_key::verify_kcv(&key, &expected) {
            bail!("KCV mismatch after Bridge A (before SQLCipher)");
        }
    }
    Ok(Zeroizing::new(key))
}

#[derive(Deserialize)]
struct PracticeShare {
    kind: String,
    kcv: String,
    share: String,
    #[allow(dead_code)]
    device_fingerprint: String,
}

#[derive(Deserialize)]
struct VendorShare {
    kind: String,
    kcv: String,
    device_fingerprint: String,
    ephemeral_pubkey: String,
    nonce: String,
    ciphertext: String,
    aad: String,
}

pub fn recover_c(
    practice_path: &Path,
    vendor_path: &Path,
    vendor_sk_path: &Path,
) -> Result<Zeroizing<Vec<u8>>> {
    let pj: PracticeShare = serde_json::from_str(&std::fs::read_to_string(practice_path)?)?;
    let vj: VendorShare = serde_json::from_str(&std::fs::read_to_string(vendor_path)?)?;
    if pj.kind != "practice-recovery.share.v2" {
        bail!("practice share must be practice-recovery.share.v2 (cleartext sheet)");
    }
    if vj.kind != "vendor-recovery.share.v2" {
        bail!("vendor share must be vendor-recovery.share.v2");
    }

    let practice = STANDARD.decode(pj.share.trim())?;
    if practice.len() != 32 {
        bail!("practice share length");
    }
    let eph_pk_bytes = STANDARD.decode(vj.ephemeral_pubkey.trim())?;
    let mut eph_arr = [0u8; 32];
    eph_arr.copy_from_slice(&eph_pk_bytes);
    let eph_pk = PublicKey::from(eph_arr);

    let sk_raw = std::fs::read(vendor_sk_path)?;
    if sk_raw.len() != 32 {
        bail!("vendor-recovery.sk must be 32-byte X25519 scalar");
    }
    let mut sk_arr = [0u8; 32];
    sk_arr.copy_from_slice(&sk_raw);
    let sk = StaticSecret::from(sk_arr);
    let shared = sk.diffie_hellman(&eph_pk);

    let hk = Hkdf::<Sha256>::new(None, shared.as_bytes());
    let mut kek = [0u8; 32];
    hk.expand(VENDOR_HKDF_INFO, &mut kek)
        .map_err(|_| anyhow::anyhow!("HKDF expand"))?;

    let nonce = STANDARD.decode(vj.nonce.trim())?;
    let ct = STANDARD.decode(vj.ciphertext.trim())?;
    let aad = STANDARD.decode(vj.aad.trim())?;
    let cipher = XChaCha20Poly1305::new_from_slice(&kek)?;
    let vendor = cipher
        .decrypt(
            XNonce::from_slice(&nonce),
            chacha20poly1305::aead::Payload {
                msg: &ct,
                aad: &aad,
            },
        )
        .map_err(|_| anyhow::anyhow!("vendor share AEAD decrypt failed"))?;
    if vendor.len() != 32 {
        bail!("vendor share length");
    }

    let mut key = vec![0u8; 32];
    for i in 0..32 {
        key[i] = practice[i] ^ vendor[i];
    }

    let expected = STANDARD.decode(pj.kcv.trim())?;
    let expected_v = STANDARD.decode(vj.kcv.trim())?;
    if expected != expected_v {
        bail!("practice and vendor KCV headers disagree");
    }
    if !db_key::verify_kcv(&key, &expected) {
        bail!("KCV mismatch after Bridge C XOR (wrong share) — SQLCipher not tried");
    }
    let _ = vj.device_fingerprint;
    Ok(Zeroizing::new(key))
}

pub async fn verify_db_copy(db: &Path, key: &[u8]) -> Result<()> {
    let dir = tempfile::tempdir()?;
    let dest = dir.path().join("medoc-verify.db");
    tokio::fs::copy(db, &dest).await?;
    for ext in ["-wal", "-shm"] {
        let side = PathBuf::from(format!("{}{ext}", db.display()));
        if side.exists() {
            let d = PathBuf::from(format!("{}{ext}", dest.display()));
            let _ = tokio::fs::copy(&side, &d).await;
        }
    }
    let ok = sqlcipher::opens_with_sqlcipher_key(&dest, key).await;
    if !ok {
        bail!("verify-db: copy did not open with provided key");
    }
    Ok(())
}

pub fn auth_check(ticket: &Path, vendor_pubkey_hex: &str, expect_fp: Option<&str>) -> Result<()> {
    #[derive(Deserialize)]
    struct Ticket {
        kind: String,
        cluster_id: String,
        device_fingerprint: String,
        customer_ref: String,
        issued_at: String,
        nonce: String,
        signature: String,
    }
    let t: Ticket = serde_json::from_str(&std::fs::read_to_string(ticket)?)?;
    if t.kind != "medoc-recovery-auth.v1" {
        bail!("ticket kind mismatch");
    }
    if let Some(fp) = expect_fp {
        if t.device_fingerprint != fp {
            bail!("fingerprint mismatch");
        }
    }
    let msg = format!(
        "medoc-recovery-auth.v1\ncluster_id={}\ndevice_fingerprint={}\ncustomer_ref={}\nissued_at={}\nnonce={}\n",
        t.cluster_id, t.device_fingerprint, t.customer_ref, t.issued_at, t.nonce
    );
    let pk_bytes = hex::decode(vendor_pubkey_hex.trim())?;
    let mut pk_arr = [0u8; 32];
    pk_arr.copy_from_slice(&pk_bytes);
    let vk = ed25519_dalek::VerifyingKey::from_bytes(&pk_arr)?;
    let sig_bytes = STANDARD.decode(t.signature.trim())?;
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let sig = ed25519_dalek::Signature::from_bytes(&sig_arr);
    use ed25519_dalek::Verifier;
    vk.verify(msg.as_bytes(), &sig)
        .map_err(|_| anyhow::anyhow!("AUTH TICKET SIGNATURE INVALID"))?;
    Ok(())
}
