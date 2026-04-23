// Cryptographic primitives (NFA-SEC-01, NFA-SEC-04++, NFA-SEC-13)
//
// - Password hashing: Argon2id (preferred) with bcrypt fallback for legacy
//   hashes seeded by previous versions.
// - HMAC-SHA256 for tamper-proof audit log entries.
// - Sensitive secrets implement `Zeroize` so they are scrubbed from memory.

use argon2::password_hash::{
    rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString,
};
use argon2::Argon2;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use zeroize::Zeroize;

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

/// Compute a hex-encoded HMAC-SHA256 of `data` using the configured audit key.
pub fn audit_hmac(key: &[u8], data: &str) -> String {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(data.as_bytes());
    let bytes = mac.finalize().into_bytes();
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
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
