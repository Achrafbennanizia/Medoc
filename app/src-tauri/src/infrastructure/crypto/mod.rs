// Cryptographic primitives (NFA-SEC-01, NFA-SEC-04++, NFA-SEC-13)
//
// - Password hashing: Argon2id (preferred) with bcrypt fallback for legacy
//   hashes seeded by previous versions.
// - HMAC-SHA256 for tamper-proof audit log entries.
// - Sensitive secrets implement `Zeroize` so they are scrubbed from memory.

pub mod sig;

use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;
use hmac::{Hmac, Mac};
use serde::Serialize;
use sha2::Sha256;
use zeroize::Zeroize;

use crate::error::AppError;

type HmacSha256 = Hmac<Sha256>;

/// Hash a password with Argon2id using sane defaults (memory-hard).
pub fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon = Argon2::default();
    argon
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| e.to_string())
}

/// Verify a password against either an Argon2 PHC string or a legacy bcrypt hash.
pub fn verify_password(password: &str, stored_hash: &str) -> Result<bool, String> {
    if stored_hash.starts_with("$argon2") {
        let parsed =
            PasswordHash::new(stored_hash).map_err(|e| format!("Invalid Argon2 hash: {e}"))?;
        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok())
    } else {
        // Legacy bcrypt support — used for seed accounts. Allows in-place upgrade.
        bcrypt::verify(password, stored_hash).map_err(|e| e.to_string())
    }
}

/// Returns true when an existing hash should be rehashed (e.g. legacy bcrypt).
pub fn needs_rehash(stored_hash: &str) -> bool {
    !stored_hash.starts_with("$argon2")
}

#[derive(Debug, Clone, Serialize)]
pub struct PasswordPolicyRule {
    pub id: &'static str,
    pub label: &'static str,
    pub met: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct PasswordPolicyStatus {
    pub valid: bool,
    pub rules: Vec<PasswordPolicyRule>,
}

/// NFA-SEC password policy (length + character classes).
pub fn evaluate_password_policy(password: &str) -> PasswordPolicyStatus {
    let rules = vec![
        PasswordPolicyRule {
            id: "min_length",
            label: "Mindestens 12 Zeichen",
            met: password.chars().count() >= 12,
        },
        PasswordPolicyRule {
            id: "uppercase",
            label: "Mindestens ein Großbuchstabe (A–Z)",
            met: password.chars().any(char::is_uppercase),
        },
        PasswordPolicyRule {
            id: "lowercase",
            label: "Mindestens ein Kleinbuchstabe (a–z)",
            met: password.chars().any(char::is_lowercase),
        },
        PasswordPolicyRule {
            id: "digit",
            label: "Mindestens eine Ziffer (0–9)",
            met: password.chars().any(|c| c.is_ascii_digit()),
        },
    ];
    let valid = rules.iter().all(|r| r.met);
    PasswordPolicyStatus { valid, rules }
}

pub fn validate_password_policy(password: &str) -> Result<(), AppError> {
    let status = evaluate_password_policy(password);
    if status.valid {
        return Ok(());
    }
    let msg = status
        .rules
        .iter()
        .filter(|r| !r.met)
        .map(|r| r.label)
        .collect::<Vec<_>>()
        .join("; ");
    Err(AppError::Validation(format!("Passwortrichtlinie: {msg}")))
}

/// Compute a hex-encoded HMAC-SHA256 of `data` using the configured audit key.
///
/// Returns `Err` only if the key is unusable; HMAC-SHA256 itself accepts
/// arbitrary-length keys so this is effectively infallible for the keys
/// produced by `init_audit_hmac_key`, but we expose the error rather than
/// panic to keep the audit pipeline tamper-evident under all conditions.
pub fn audit_hmac(key: &[u8], data: &str) -> Result<String, String> {
    audit_hmac_bytes(key, data.as_bytes())
}

/// Streaming HMAC-SHA256 (hex) over arbitrary bytes — used for backup integrity tags.
pub fn audit_hmac_bytes(key: &[u8], data: &[u8]) -> Result<String, String> {
    let mut mac =
        HmacSha256::new_from_slice(key).map_err(|e| format!("HMAC-Schlüssel ungültig: {e}"))?;
    mac.update(data);
    Ok(hex_hmac(mac.finalize().into_bytes()))
}

/// HMAC-SHA256 (hex) over a file on disk (64 KiB chunks).
pub fn audit_hmac_file(key: &[u8], path: &std::path::Path) -> Result<String, String> {
    use std::io::Read;
    let mut mac =
        HmacSha256::new_from_slice(key).map_err(|e| format!("HMAC-Schlüssel ungültig: {e}"))?;
    let mut file =
        std::fs::File::open(path).map_err(|e| format!("Datei öffnen: {e}"))?;
    let mut buf = [0u8; 64 * 1024];
    loop {
        let n = file
            .read(&mut buf)
            .map_err(|e| format!("Datei lesen: {e}"))?;
        if n == 0 {
            break;
        }
        mac.update(&buf[..n]);
    }
    Ok(hex_hmac(mac.finalize().into_bytes()))
}

fn hex_hmac(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

/// Wrapper for sensitive in-memory strings; zeroes itself on drop.
#[derive(Zeroize)]
#[zeroize(drop)]
pub struct SecretString(pub String);

impl SecretString {
    pub fn new<S: Into<String>>(s: S) -> Self {
        Self(s.into())
    }
    pub fn expose(&self) -> &str {
        &self.0
    }
}
