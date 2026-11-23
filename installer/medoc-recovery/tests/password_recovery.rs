//! Login password recovery end to end: a real (encrypted) practice database, the key recovered
//! through Bridge C (vendor key + printed sheet) and through Bridge B (passphrase), then a new
//! login password set and checked by MeDoc's own sign-in.

use std::path::{Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use medoc_core::application::auth_service::{authenticate, LoginRequest};
use medoc_core::infrastructure::database::{connection, db_key, sqlcipher};
use medoc_recovery::{password, recover, Bridge, RecoverRequest};
use sha2::Sha256;
use x25519_dalek::{PublicKey, StaticSecret};
use zeroize::Zeroizing;

const DB_KEY_HEX: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const EMAIL: &str = "ahmed@practice.de";
const NEW_PASSWORD: &str = "Recovered-Login-2026";

static LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn env() {
    std::env::set_var("MEDOC_DB_KEY", DB_KEY_HEX);
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    std::env::set_var(
        "MEDOC_VENDOR_PUBKEY",
        "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
    );
    std::env::set_var("MEDOC_DEV_SEED", "1");
    std::env::set_var("RUST_MIN_STACK", "8388608");
}

/// A practice folder with a seeded, encrypted medoc.db (pool closed: as if MeDoc were quit).
async fn practice() -> (tempfile::TempDir, Zeroizing<Vec<u8>>) {
    env();
    let dir = tempfile::tempdir().unwrap();
    std::env::set_var("MEDOC_BACKUP_DIR", dir.path().join("backups"));
    let pool = connection::init_db_headless(dir.path())
        .await
        .expect("init");
    pool.close().await;
    let key = Zeroizing::new(hex::decode(DB_KEY_HEX).unwrap());
    assert!(sqlcipher::opens_with_sqlcipher_key(&dir.path().join("medoc.db"), &key).await);
    (dir, key)
}

/// Bridge C material for `key`, minted the way the keygen does: the printed practice share,
/// and the vendor half sealed to the vendor's X25519 key.
fn mint_bridge_c(dir: &Path, key: &[u8]) -> (PathBuf, PathBuf, PathBuf) {
    let practice_half = [0x5au8; 32];
    let vendor_half: Vec<u8> = key.iter().zip(practice_half).map(|(k, p)| k ^ p).collect();
    let vendor_sk = StaticSecret::from([0x11u8; 32]);
    let vendor_pk = PublicKey::from(&vendor_sk);
    let eph = StaticSecret::from([0x22u8; 32]);
    let shared = eph.diffie_hellman(&vendor_pk);
    let mut kek = [0u8; 32];
    Hkdf::<Sha256>::new(None, shared.as_bytes())
        .expand(b"medoc-vendor-share-v2", &mut kek)
        .unwrap();
    let nonce = [0x33u8; 24];
    let aad = b"medoc-vendor-share-v2|test-device";
    let ct = XChaCha20Poly1305::new_from_slice(&kek)
        .unwrap()
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: &vendor_half,
                aad,
            },
        )
        .unwrap();
    let kcv = STANDARD.encode(db_key::compute_kcv(key));
    let ps = dir.join("practice-recovery.share.v2.json");
    let vs = dir.join("vendor-recovery.share.v2.json");
    let sk = dir.join("vendor-recovery.sk");
    std::fs::write(
        &ps,
        serde_json::json!({
            "kind": "practice-recovery.share.v2", "kcv": kcv,
            "share": STANDARD.encode(practice_half), "device_fingerprint": "test-device",
        })
        .to_string(),
    )
    .unwrap();
    std::fs::write(
        &vs,
        serde_json::json!({
            "kind": "vendor-recovery.share.v2", "kcv": kcv, "device_fingerprint": "test-device",
            "ephemeral_pubkey": STANDARD.encode(PublicKey::from(&eph).as_bytes()),
            "nonce": STANDARD.encode(nonce), "ciphertext": STANDARD.encode(ct),
            "aad": STANDARD.encode(aad),
        })
        .to_string(),
    )
    .unwrap();
    std::fs::write(&sk, vendor_sk.to_bytes()).unwrap();
    (ps, vs, sk)
}

async fn can_sign_in(dir: &Path, key: &[u8], pw: &str) -> bool {
    let pool =
        sqlcipher::open_encrypted_pool(&dir.join("medoc.db"), Zeroizing::new(key.to_vec()), false)
            .await
            .unwrap();
    let ok = authenticate(
        &pool,
        &LoginRequest {
            email: EMAIL.into(),
            password: pw.into(),
            totp_code: None,
        },
    )
    .await
    .is_ok();
    pool.close().await;
    ok
}

#[tokio::test]
async fn vendor_key_and_sheet_recover_the_key_then_reset_the_login_password() {
    let _g = LOCK.lock().await;
    let (dir, key) = practice().await;
    let (ps, vs, sk) = mint_bridge_c(dir.path(), &key);

    // Bridge C: the key comes back from the vendor key + the printed sheet.
    let (recovered, result) = recover(&RecoverRequest {
        bridge: Some(Bridge::C),
        practice_share: Some(ps),
        vendor_share: Some(vs),
        vendor_sk: Some(sk),
        ..Default::default()
    })
    .expect("bridge C");
    assert_eq!(&*recovered, &*key);

    let db = password::practice_db(dir.path());
    let accounts = password::list_accounts(&db, &recovered)
        .await
        .expect("accounts");
    let ahmed = accounts
        .iter()
        .find(|a| a.email == EMAIL)
        .expect("seed dentist listed");
    assert_eq!(ahmed.role, "PHYSICIAN");
    assert_eq!(
        accounts.first().map(|a| a.role.as_str()),
        Some("PHYSICIAN"),
        "dentists first"
    );
    assert!(!can_sign_in(dir.path(), &key, NEW_PASSWORD).await);

    // Too weak: refused, nothing changed.
    let e = password::reset_password(&db, &recovered, EMAIL, "short", &result.bridge)
        .await
        .unwrap_err();
    assert!(format!("{e:#}").contains("policy"), "{e:#}");
    // Unknown account.
    assert!(
        password::reset_password(&db, &recovered, "nobody@x.de", NEW_PASSWORD, "c")
            .await
            .is_err()
    );

    // Case-insensitive email, as people type it.
    let report = password::reset_password(
        &db,
        &recovered,
        " Ahmed@Practice.DE ",
        NEW_PASSWORD,
        &result.bridge,
    )
    .await
    .expect("reset");
    assert_eq!(report.account.email, EMAIL);
    assert!(report.audit_logged);
    assert!(
        can_sign_in(dir.path(), &key, NEW_PASSWORD).await,
        "new password signs in"
    );

    // Recorded: audit log (actor, action, bridge) and logs/recovery.log, never the password.
    let pool = sqlcipher::open_encrypted_pool(&db, key.clone(), false)
        .await
        .unwrap();
    let (actor, details): (String, Option<String>) = sqlx::query_as(
        "SELECT user_id, details FROM audit_log WHERE action = 'PASSWORD_RECOVERY' ORDER BY created_at DESC LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .expect("audit row");
    assert_eq!(actor, password::RECOVERY_ACTOR);
    assert_eq!(details.as_deref(), Some("bridge=c"));
    pool.close().await;
    let log = std::fs::read_to_string(dir.path().join("logs/recovery.log")).expect("recovery.log");
    assert!(log.contains("\"event\":\"PASSWORD_RECOVERY\"") && log.contains("seed-physician-001"));
    assert!(!log.contains(NEW_PASSWORD), "password never logged");
}

#[tokio::test]
async fn passphrase_bridge_b_also_resets_and_a_wrong_key_is_refused() {
    let _g = LOCK.lock().await;
    let (dir, key) = practice().await;
    let passphrase = "Wrap-Passphrase-2026";
    db_key::write_wrap_for_recovery(dir.path(), &key, passphrase).expect("wrap");

    let (recovered, _) = recover(&RecoverRequest {
        bridge: Some(Bridge::B),
        app_dir: Some(dir.path().to_path_buf()),
        passphrase: Some(passphrase.into()),
        ..Default::default()
    })
    .expect("bridge B");
    // A wrong passphrase does not unlock.
    assert!(recover(&RecoverRequest {
        bridge: Some(Bridge::B),
        app_dir: Some(dir.path().to_path_buf()),
        passphrase: Some("Not-The-Passphrase-1".into()),
        ..Default::default()
    })
    .is_err());

    let db = password::practice_db(dir.path());
    // Another practice's key opens nothing.
    let e = password::list_accounts(&db, &[7u8; 32]).await.unwrap_err();
    assert!(format!("{e:#}").contains("does not open"), "{e:#}");

    password::reset_password(&db, &recovered, EMAIL, NEW_PASSWORD, "b")
        .await
        .expect("reset via passphrase");
    assert!(can_sign_in(dir.path(), &key, NEW_PASSWORD).await);
}
