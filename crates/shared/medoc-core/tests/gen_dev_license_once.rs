//! One-off helper: prints dev license tokens (CI test signing key).
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};

const TEST_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

fn signing_key() -> SigningKey {
    let mut sk_bytes = [0u8; 32];
    for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        sk_bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&sk_bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    sk
}

fn sign_json(body: &str) -> String {
    let sig = signing_key().sign(body.as_bytes());
    format!("{}.{}", body, STANDARD_NO_PAD.encode(sig.to_bytes()))
}

fn device_id_from_env() -> Option<String> {
    let id = std::env::var("MEDOC_DEVICE_ID").ok()?;
    let t = id.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.to_string())
    }
}

/// License binding is `sync.device_id.v1`. `lan-instance-id.txt` is a different id and
/// produces "Could not decrypt license (wrong device?)".
async fn device_id_from_app_db(app_dir: &std::path::Path) -> Result<Option<String>, String> {
    let db_path = app_dir.join("medoc.db");
    if !db_path.exists() {
        return Ok(None);
    }
    let key = medoc_core::infrastructure::database::db_key::ensure_sqlcipher_key(app_dir, false)
        .map_err(|e| format!("key: {e}"))?;
    let pool =
        medoc_core::infrastructure::database::sqlcipher::open_encrypted_pool(&db_path, key, false)
            .await
            .map_err(|e| format!("open: {e}"))?;
    let id: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'sync.device_id.v1'")
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("read: {e}"))?;
    pool.close().await;
    Ok(id.filter(|s| !s.trim().is_empty()))
}

fn build_tokens(device_id: &str, edition: &str) -> (String, String) {
    let lic = LicenseV2 {
        version: 2,
        customer_id: "dev-local".into(),
        edition: edition.into(),
        device_id: device_id.into(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 28, 12, 0, 0).unwrap(),
        max_users: 99,
        modules: vec!["dicom".into()],
        edition_features: vec!["statistics.advanced".into()],
        install_plan: None,
    };
    let v2_body = serde_json::to_string(&lic).unwrap();
    let v2_signed = sign_json(&v2_body);
    let v2_token = encrypt_v2_for_device(&v2_signed, device_id).expect("encrypt");

    let v1_body = serde_json::json!({
        "customer_id": "dev-local",
        "edition": "PRO",
        "issued_at": "2026-01-01T00:00:00Z",
        "expires_at": "2036-01-01T00:00:00Z",
        "max_users": 99,
        "modules": ["dicom"]
    })
    .to_string();
    let v1_token = sign_json(&v1_body);
    (v2_token, v1_token)
}

/// Manual helper — prints license tokens for the local device. Not part of CI.
#[tokio::test]
#[ignore = "manual dev helper: MEDOC_DEVICE_ID, lan-instance-id.txt, or local medoc.db"]
async fn print_dev_licenses() {
    // MEDOC_APP_DIR: another install (e.g. an edition test instance); default the dev app.
    let app_dir = std::env::var("MEDOC_APP_DIR")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| {
            dirs::home_dir()
                .expect("home")
                .join("Library/Application Support/de.medoc.app")
        });
    // MEDOC_LICENSE_EDITION: BASIC (Solo) | PRO (Duo) | ENTERPRISE (Group); default PRO.
    let edition = std::env::var("MEDOC_LICENSE_EDITION").unwrap_or_else(|_| "PRO".into());
    let device_id = if let Some(id) = device_id_from_env() {
        id
    } else {
        match device_id_from_app_db(&app_dir).await {
            Ok(Some(id)) => id,
            Ok(None) => panic!("medoc.db has no sync.device_id.v1 — not creating one"),
            Err(e) => panic!("could not read license device id: {e}"),
        }
    };

    let (v2_token, v1_token) = build_tokens(&device_id, &edition);

    println!(
        "\n--- DEVICE_ID (v2 binding) ---\n{device_id}\n\n--- V2 LICENSE (preferred) ---\n{v2_token}\n\n--- V1 LICENSE (legacy, any device) ---\n{v1_token}\n"
    );
}
