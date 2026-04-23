// Offline license validation (NFA-LIC-01).
//
// A license is a JSON document signed with the vendor's Ed25519 private key:
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
// The signature is appended as `.<base64-sig>` after the canonical JSON body
// so the entire payload is one ASCII line: `<json>.<sig>`.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{DateTime, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};

/// Public key embedded at compile time. Replace with the production vendor key
/// before shipping. Must be 32 raw bytes (Ed25519 verifying key).
const VENDOR_PUBKEY: &[u8; 32] = &[
    // Development key — placeholder; never ships in production builds.
    0x3d, 0x40, 0x17, 0xc3, 0xe8, 0x43, 0x89, 0x5a, 0x92, 0xb7, 0x0a, 0xa7, 0x4d, 0x1b, 0x7e, 0xbc,
    0x96, 0x8e, 0x17, 0xfd, 0xe2, 0x65, 0xc4, 0xe6, 0x42, 0x9d, 0x6f, 0x88, 0x33, 0xb1, 0x91, 0x6f,
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct License {
    pub customer_id: String,
    pub edition: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub max_users: u32,
    #[serde(default)]
    pub modules: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct LicenseStatus {
    pub valid: bool,
    pub reason: Option<String>,
    pub license: Option<License>,
    pub days_until_expiry: Option<i64>,
}

/// Verify a license string of the form `<json>.<base64-sig>`.
pub fn verify(token: &str) -> LicenseStatus {
    let (body, sig_b64) = match token.rsplit_once('.') {
        Some(s) => s,
        None => return invalid("Format ungültig — Trennzeichen fehlt"),
    };

    let sig_bytes = match STANDARD_NO_PAD.decode(sig_b64.trim()) {
        Ok(b) => b,
        Err(e) => return invalid(&format!("Signatur nicht decodierbar: {e}")),
    };
    if sig_bytes.len() != 64 {
        return invalid("Signaturlänge ungültig");
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);

    let key = match VerifyingKey::from_bytes(VENDOR_PUBKEY) {
        Ok(k) => k,
        Err(e) => return invalid(&format!("Vendor-Key Fehler: {e}")),
    };

    if key.verify(body.as_bytes(), &signature).is_err() {
        return invalid("Signatur ungültig");
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
        };
    }

    let days = (license.expires_at - now).num_days();
    LicenseStatus {
        valid: true,
        reason: None,
        days_until_expiry: Some(days),
        license: Some(license),
    }
}

fn invalid(reason: &str) -> LicenseStatus {
    LicenseStatus {
        valid: false,
        reason: Some(reason.to_string()),
        license: None,
        days_until_expiry: None,
    }
}
