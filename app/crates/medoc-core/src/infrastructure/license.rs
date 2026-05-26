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

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

include!(concat!(env!("OUT_DIR"), "/pubkey.rs"));

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
