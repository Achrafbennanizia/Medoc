// Offline license validation (NFA-LIC-01, NFA-LIC-02).
//
// # Format v1 (legacy, signed-only, expires_at-bound)
//
// One ASCII line: `<json_body>.<base64-sig>` where the body is:
//
// {
//   "customer_id": "...",
//   "edition": "BASIC|PRO|ENTERPRISE",
//   "issued_at": "2026-01-01T00:00:00Z",
//   "expires_at": "2027-01-01T00:00:00Z",
//   "max_users": 5,
//   "modules": ["dicom", "vdds"]
// }
//
// Signature is Ed25519 over the canonical JSON body, vendor pubkey embedded at
// build time (`OUT_DIR/pubkey.rs`).
//
// # Format v2 (perpetual, device-bound, encrypted envelope)
//
// Same `<json>.<sig>` body, additionally wrapped with AES-256-GCM. The
// public envelope on disk is:
//
//     v2.<nonce_b64>.<ciphertext_b64>
//
// where ciphertext = AES_GCM_Encrypt(key, nonce, "<json>.<sig>").
//
// The symmetric key is derived per-device:
//
//     key = HKDF-SHA256(salt = VENDOR_LICENSE_SEED, ikm = device_id, info = "medoc/license/v2")
//
// so the vendor can mint a license that only decrypts on one device. The
// inner Ed25519 signature still proves vendor authenticity even if the
// AES-GCM seed leaks. The body schema is:
//
// {
//   "v": 2,
//   "customer_id": "...",
//   "edition": "BASIC|PRO|ENTERPRISE",
//   "device_id": "<uuid bound at activation>",
//   "activated_at": "2026-05-26T10:00:00Z",
//   "modules": ["dicom", "vdds"],
//   "max_users": 5,
//   "edition_features": ["statistik.advanced"]
// }
//
// Perpetual: no `expires_at` — `activated_at` is informational only.

use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{DateTime, Utc};
use hkdf::Hkdf;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;

use crate::error::AppError;

include!(concat!(env!("OUT_DIR"), "/pubkey.rs"));
include!(concat!(env!("OUT_DIR"), "/license_seed.rs"));

/// v1 license payload (legacy, signed-only, expiry-bound).
/// Token bodies use snake_case; IPC uses camelCase (`LicenseStatus` envelope).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct License {
    #[serde(alias = "customer_id")]
    pub customer_id: String,
    pub edition: String,
    #[serde(alias = "issued_at")]
    pub issued_at: DateTime<Utc>,
    #[serde(alias = "expires_at")]
    pub expires_at: DateTime<Utc>,
    #[serde(alias = "max_users")]
    pub max_users: u32,
    #[serde(default)]
    pub modules: Vec<String>,
}

/// v2 license payload (perpetual, device-bound).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseV2 {
    #[serde(rename = "v")]
    pub version: u32,
    #[serde(alias = "customer_id")]
    pub customer_id: String,
    pub edition: String,
    #[serde(alias = "device_id")]
    pub device_id: String,
    #[serde(alias = "activated_at")]
    pub activated_at: DateTime<Utc>,
    #[serde(default, alias = "max_users")]
    pub max_users: u32,
    #[serde(default)]
    pub modules: Vec<String>,
    #[serde(default, alias = "edition_features")]
    pub edition_features: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub valid: bool,
    pub reason: Option<String>,
    pub license: Option<License>,
    pub license_v2: Option<LicenseV2>,
    pub days_until_expiry: Option<i64>,
    /// Format used for the verified token: "v1" or "v2".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<String>,
}

impl LicenseStatus {
    pub fn is_v2(&self) -> bool {
        self.license_v2.is_some()
    }
}

/// Verify any license format. v2 requires the local device id; v1 ignores it.
///
/// Recognises:
/// - `v2.<nonce>.<ct>` → AES-GCM envelope → `<json>.<sig>` v2 body
/// - `<json>.<sig>` → v1 legacy
pub fn verify(token: &str, local_device_id: &str) -> LicenseStatus {
    let token = token.trim();
    if let Some(stripped) = token.strip_prefix("v2.") {
        verify_v2_envelope(stripped, local_device_id)
    } else {
        verify_v1(token)
    }
}

/// Verify a legacy v1 signed-only license string `<json>.<sig>`.
pub fn verify_v1(token: &str) -> LicenseStatus {
    let (body, sig_b64) = match token.rsplit_once('.') {
        Some(s) => s,
        None => return invalid("Format ungültig — Trennzeichen fehlt"),
    };

    if let Err(e) =
        crate::infrastructure::crypto::sig::verify_ed25519(&VENDOR_PUBKEY, body.as_bytes(), sig_b64)
    {
        return invalid(&e.to_string());
    }

    let license: License = match serde_json::from_str(body) {
        Ok(l) => l,
        Err(e) => return invalid(&format!("Lizenzinhalt ungültig: {e}")),
    };

    let now = Utc::now();
    if now > license.expires_at {
        return LicenseStatus {
            valid: false,
            reason: Some("Lizenz abgelaufen".into()),
            days_until_expiry: Some((license.expires_at - now).num_days()),
            license: Some(license),
            license_v2: None,
            format: Some("v1".into()),
        };
    }

    let days = (license.expires_at - now).num_days();
    LicenseStatus {
        valid: true,
        reason: None,
        days_until_expiry: Some(days),
        license: Some(license),
        license_v2: None,
        format: Some("v1".into()),
    }
}

/// Verify an encrypted v2 envelope. Format: `<nonce_b64>.<ciphertext_b64>`.
pub fn verify_v2_envelope(envelope: &str, local_device_id: &str) -> LicenseStatus {
    if local_device_id.trim().is_empty() {
        return invalid("device_id fehlt — Gerät nicht initialisiert");
    }
    let (nonce_b64, ct_b64) = match envelope.split_once('.') {
        Some(s) => s,
        None => return invalid("v2 Envelope ungültig — Trennzeichen fehlt"),
    };
    let nonce_bytes = match STANDARD_NO_PAD.decode(nonce_b64) {
        Ok(v) => v,
        Err(e) => return invalid(&format!("Nonce nicht decodierbar: {e}")),
    };
    if nonce_bytes.len() != 12 {
        return invalid("Nonce Länge ungültig");
    }
    let ciphertext = match STANDARD_NO_PAD.decode(ct_b64) {
        Ok(v) => v,
        Err(e) => return invalid(&format!("Ciphertext nicht decodierbar: {e}")),
    };

    let key_bytes = derive_device_key(local_device_id);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let plain = match cipher.decrypt(nonce, ciphertext.as_ref()) {
        Ok(p) => p,
        Err(_) => return invalid("Lizenz konnte nicht entschlüsselt werden (falsches Gerät?)"),
    };
    let plaintext = match std::str::from_utf8(&plain) {
        Ok(s) => s,
        Err(e) => return invalid(&format!("Lizenz-Klartext ungültig: {e}")),
    };

    let (body, sig_b64) = match plaintext.rsplit_once('.') {
        Some(s) => s,
        None => return invalid("v2 Innen-Format ungültig"),
    };
    if let Err(e) =
        crate::infrastructure::crypto::sig::verify_ed25519(&VENDOR_PUBKEY, body.as_bytes(), sig_b64)
    {
        return invalid(&e.to_string());
    }
    let license: LicenseV2 = match serde_json::from_str(body) {
        Ok(l) => l,
        Err(e) => return invalid(&format!("v2 Lizenzinhalt ungültig: {e}")),
    };
    if license.version != 2 {
        return invalid("Version Mismatch — erwartet v=2");
    }
    if license.device_id.trim() != local_device_id.trim() {
        return invalid(&format!(
            "Lizenz ist an anderes Gerät gebunden (license={}, lokal={})",
            license.device_id, local_device_id
        ));
    }

    LicenseStatus {
        valid: true,
        reason: None,
        days_until_expiry: None,
        license: None,
        license_v2: Some(license),
        format: Some("v2".into()),
    }
}

/// Vendor-side helper (also used by tests): wrap an already-signed v2 body
/// `<json>.<sig>` into the device-bound AES-GCM envelope.
pub fn encrypt_v2_for_device(signed_inner: &str, device_id: &str) -> Result<String, AppError> {
    if device_id.trim().is_empty() {
        return Err(AppError::Validation("device_id leer".into()));
    }
    let key_bytes = derive_device_key(device_id);
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, signed_inner.as_bytes())
        .map_err(|e| AppError::Internal(format!("Lizenz verschlüsseln: {e}")))?;
    Ok(format!(
        "v2.{}.{}",
        STANDARD_NO_PAD.encode(nonce_bytes),
        STANDARD_NO_PAD.encode(ct)
    ))
}

/// HKDF-SHA256(salt = VENDOR_LICENSE_SEED, ikm = device_id, info = "medoc/license/v2") → 32 bytes
pub(crate) fn derive_device_key(device_id: &str) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(&VENDOR_LICENSE_SEED), device_id.as_bytes());
    let mut out = [0u8; 32];
    hk.expand(b"medoc/license/v2", &mut out)
        .expect("HKDF expand 32 bytes");
    out
}

fn invalid(reason: &str) -> LicenseStatus {
    LicenseStatus {
        valid: false,
        reason: Some(reason.to_string()),
        license: None,
        license_v2: None,
        days_until_expiry: None,
        format: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derive_device_key_deterministic_per_device() {
        let a = derive_device_key("device-a");
        let b = derive_device_key("device-b");
        let a2 = derive_device_key("device-a");
        assert_eq!(a, a2);
        assert_ne!(a, b);
    }

    #[test]
    fn encrypt_v2_decrypts_only_with_same_device_id() {
        let inner = r#"{"v":2,"customer_id":"c1","edition":"PRO","device_id":"dev-1","activated_at":"2026-01-01T00:00:00Z","max_users":3,"modules":[],"edition_features":[]}.dummy-sig"#;
        let env = encrypt_v2_for_device(inner, "dev-1").expect("encrypt ok");
        assert!(env.starts_with("v2."));

        let (_, body) = env.split_once("v2.").unwrap();
        // Decrypt by hand with the same key to confirm round trip even though
        // the inner signature is fake (so verify_v2_envelope would fail).
        let (nonce_b64, ct_b64) = body.split_once('.').unwrap();
        let nonce = STANDARD_NO_PAD.decode(nonce_b64).unwrap();
        let ct = STANDARD_NO_PAD.decode(ct_b64).unwrap();
        let dev_a_key = derive_device_key("dev-1");
        let key = Key::<Aes256Gcm>::from_slice(&dev_a_key);
        let pt = Aes256Gcm::new(key)
            .decrypt(Nonce::from_slice(&nonce), ct.as_ref())
            .expect("decrypt with same device key");
        assert_eq!(String::from_utf8(pt).unwrap(), inner);

        // Wrong device → decrypt fails.
        let dev_b_key = derive_device_key("dev-2");
        let wrong_key = Key::<Aes256Gcm>::from_slice(&dev_b_key);
        assert!(Aes256Gcm::new(wrong_key)
            .decrypt(Nonce::from_slice(&nonce), ct.as_ref())
            .is_err());
    }

    #[test]
    fn verify_v2_rejects_when_device_id_does_not_match() {
        // We can't generate a real vendor-signed token in this unit test
        // because VENDOR_PUBKEY is build-time-baked from another keypair.
        // The wrong-device test runs in the integration suite where we
        // override the pubkey path. Here we at least confirm the early
        // device-id check fires before signature verification.
        let status = super::verify_v2_envelope("AAA.BBB", "");
        assert!(!status.valid);
        assert!(status.reason.unwrap().contains("device_id"));
    }
}
