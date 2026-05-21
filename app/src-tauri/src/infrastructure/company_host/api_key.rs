//! Practice API key hashing (Argon2id) for the company server.

use crate::infrastructure::crypto;

pub fn hash_api_key(raw: &str) -> Result<String, String> {
    crypto::hash_password(raw)
}

pub fn verify_api_key(raw: &str, stored_hash: &str) -> bool {
    crypto::verify_password(raw, stored_hash).unwrap_or(false)
}
