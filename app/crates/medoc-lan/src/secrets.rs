//! LAN JWT signing key and instance id — OS keychain first (no plaintext in app data dir).

use std::path::Path;

use uuid::Uuid;

use medoc_core::error::AppError;
use medoc_core::infrastructure::secret_store;

const JWT_SECRET_FILE: &str = "lan-jwt-secret.bin";
const INSTANCE_ID_FILE: &str = "lan-instance-id.txt";

pub fn ensure_jwt_secret_bytes(app_data_dir: &Path) -> Result<[u8; 32], AppError> {
    let legacy = app_data_dir.join(JWT_SECRET_FILE);
    let bytes = secret_store::load_or_create_bytes("lan-jwt-secret", Some(&legacy), 32)?;
    if bytes.len() != 32 {
        return Err(AppError::Internal(format!(
            "LAN JWT secret must be 32 bytes (got {})",
            bytes.len()
        )));
    }
    let mut a = [0u8; 32];
    a.copy_from_slice(&bytes);
    Ok(a)
}

pub fn ensure_instance_id(app_data_dir: &Path) -> Result<String, AppError> {
    let path = app_data_dir.join(INSTANCE_ID_FILE);
    if path.exists() {
        let s = std::fs::read_to_string(&path)
            .map_err(|e| AppError::Internal(format!("LAN instance id: {e}")))?;
        let t = s.trim();
        if !t.is_empty() {
            return Ok(t.into());
        }
    }
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| AppError::Internal(format!("LAN dirs: {e}")))?;
    let id = Uuid::new_v4().to_string();
    std::fs::write(&path, &id)
        .map_err(|e| AppError::Internal(format!("LAN instance id write: {e}")))?;
    Ok(id)
}
