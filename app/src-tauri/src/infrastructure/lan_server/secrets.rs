//! Persisted LAN JWT signing key and stable instance id under the app data directory.

use std::path::Path;

use rand::RngCore;
use uuid::Uuid;

use crate::error::AppError;

const JWT_SECRET_FILE: &str = "lan-jwt-secret.bin";
const INSTANCE_ID_FILE: &str = "lan-instance-id.txt";

pub fn ensure_jwt_secret_bytes(app_data_dir: &Path) -> Result<[u8; 32], AppError> {
    let path = app_data_dir.join(JWT_SECRET_FILE);
    if path.exists() {
        let raw = std::fs::read(&path).map_err(|e| AppError::Internal(format!("LAN JWT secret: {e}")))?;
        if raw.len() == 32 {
            let mut a = [0u8; 32];
            a.copy_from_slice(&raw);
            return Ok(a);
        }
    }
    std::fs::create_dir_all(app_data_dir).map_err(|e| AppError::Internal(format!("LAN dirs: {e}")))?;
    let mut key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    std::fs::write(&path, key).map_err(|e| AppError::Internal(format!("LAN JWT secret write: {e}")))?;
    Ok(key)
}

pub fn ensure_instance_id(app_data_dir: &Path) -> Result<String, AppError> {
    let path = app_data_dir.join(INSTANCE_ID_FILE);
    if path.exists() {
        let s = std::fs::read_to_string(&path).map_err(|e| AppError::Internal(format!("LAN instance id: {e}")))?;
        let t = s.trim();
        if !t.is_empty() {
            return Ok(t.into());
        }
    }
    std::fs::create_dir_all(app_data_dir).map_err(|e| AppError::Internal(format!("LAN dirs: {e}")))?;
    let id = Uuid::new_v4().to_string();
    std::fs::write(&path, &id).map_err(|e| AppError::Internal(format!("LAN instance id write: {e}")))?;
    Ok(id)
}
