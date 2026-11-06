//! Replicate owner staff credentials to member devices for local login.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::cluster::crypto::DeviceIdentity;
use crate::net::fetch_staff_directory;

const DIRECTORY_VERSION: u32 = 1;
pub const CLUSTER_ADMIN_ENDPOINT_KV: &str = "cluster.join.admin_endpoint.v1";
const CLUSTER_JOIN_LAN_AUTH_KV: &str = "cluster.join.lan_auth.v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminEndpointKv {
    host: String,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct JoinLanAuthKv {
    pub(crate) activation_token: String,
    pub(crate) master_pubkey: String,
    pub(crate) master_device_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StaffDirectoryEntry {
    id: String,
    name: String,
    email: String,
    password_hash: String,
    role: String,
    #[serde(default)]
    specialty: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StaffDirectory {
    version: u32,
    staff: Vec<StaffDirectoryEntry>,
}

/// Export login-capable staff rows for cluster member provisioning.
pub async fn export_staff_directory_json(pool: &SqlitePool) -> Result<String, AppError> {
    let rows: Vec<(String, String, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, name, email, password_hash, role, specialty FROM staff ORDER BY email COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    let staff = rows
        .into_iter()
        .map(
            |(id, name, email, password_hash, role, specialty)| StaffDirectoryEntry {
                id,
                name,
                email,
                password_hash,
                role,
                specialty,
            },
        )
        .collect();

    let directory = StaffDirectory {
        version: DIRECTORY_VERSION,
        staff,
    };
    serde_json::to_string(&directory)
        .map_err(|e| AppError::Internal(format!("staff directory json: {e}")))
}

/// Import staff rows from owner snapshot (update-first to respect quota triggers).
pub async fn import_staff_directory_json(pool: &SqlitePool, raw: &str) -> Result<u32, AppError> {
    let directory: StaffDirectory = serde_json::from_str(raw.trim())
        .map_err(|e| AppError::Validation(format!("Staff directory invalid: {e}")))?;
    if directory.version != DIRECTORY_VERSION {
        return Err(AppError::Validation(
            "Staff directory version not supported.".into(),
        ));
    }

    let mut imported = 0u32;
    for entry in directory.staff {
        if upsert_staff_entry(pool, &entry).await? {
            imported += 1;
        }
    }
    Ok(imported)
}

async fn upsert_staff_entry(
    pool: &SqlitePool,
    entry: &StaffDirectoryEntry,
) -> Result<bool, AppError> {
    let email = entry.email.trim();
    if email.is_empty() || entry.password_hash.trim().is_empty() {
        return Ok(false);
    }
    let role = entry.role.trim().to_uppercase();
    if role != "PHYSICIAN" && role != "RECEPTION" {
        return Ok(false);
    }
    let specialty = entry
        .specialty
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim());

    if apply_staff_entry_update(
        pool,
        &entry.id,
        entry.name.trim(),
        email,
        &entry.password_hash,
        &role,
        specialty,
    )
    .await?
    {
        return Ok(true);
    }

    if let Some(existing_id) = sqlx::query_scalar::<_, String>(
        "SELECT id FROM staff WHERE LOWER(email) = LOWER(?1) LIMIT 1",
    )
    .bind(email)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    {
        if apply_staff_entry_update(
            pool,
            &existing_id,
            entry.name.trim(),
            email,
            &entry.password_hash,
            &role,
            specialty,
        )
        .await?
        {
            return Ok(true);
        }
    }

    if role == "PHYSICIAN" {
        if let Some(local_physician_id) = sqlx::query_scalar::<_, String>(
            "SELECT id FROM staff WHERE UPPER(role) = 'PHYSICIAN' LIMIT 1",
        )
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        {
            if apply_staff_entry_update(
                pool,
                &local_physician_id,
                entry.name.trim(),
                email,
                &entry.password_hash,
                &role,
                specialty,
            )
            .await?
            {
                return Ok(true);
            }
        }
    }

    if role == "RECEPTION" {
        if let Some(local_rez_id) = sqlx::query_scalar::<_, String>(
            "SELECT id FROM staff WHERE UPPER(role) = 'RECEPTION' LIMIT 1",
        )
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        {
            if apply_staff_entry_update(
                pool,
                &local_rez_id,
                entry.name.trim(),
                email,
                &entry.password_hash,
                &role,
                specialty,
            )
            .await?
            {
                return Ok(true);
            }
        }
    }

    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, specialty, available)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
    )
    .bind(&entry.id)
    .bind(entry.name.trim())
    .bind(email)
    .bind(&entry.password_hash)
    .bind(&role)
    .bind(specialty)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(true)
}

async fn apply_staff_entry_update(
    pool: &SqlitePool,
    id: &str,
    name: &str,
    email: &str,
    password_hash: &str,
    role: &str,
    specialty: Option<&str>,
) -> Result<bool, AppError> {
    let result = sqlx::query(
        "UPDATE staff SET
           name = ?2,
           email = ?3,
           password_hash = ?4,
           role = ?5,
           specialty = ?6,
           available = 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1",
    )
    .bind(id)
    .bind(name)
    .bind(email)
    .bind(password_hash)
    .bind(role)
    .bind(specialty)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(result.rows_affected() > 0)
}

pub async fn load_join_admin_endpoint(
    pool: &SqlitePool,
) -> Result<Option<(String, u16)>, AppError> {
    let Some(raw) = app_kv_repo::get(pool, CLUSTER_ADMIN_ENDPOINT_KV).await? else {
        return Ok(None);
    };
    let endpoint: AdminEndpointKv = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("admin endpoint kv: {e}")))?;
    if endpoint.host.trim().is_empty() || endpoint.port == 0 {
        return Ok(None);
    }
    Ok(Some((endpoint.host.trim().to_string(), endpoint.port)))
}

pub async fn store_join_admin_endpoint(
    pool: &SqlitePool,
    host: &str,
    port: u16,
) -> Result<(), AppError> {
    let payload = AdminEndpointKv {
        host: host.trim().to_string(),
        port,
    };
    let raw = serde_json::to_string(&payload)
        .map_err(|e| AppError::Internal(format!("admin endpoint json: {e}")))?;
    app_kv_repo::set(pool, CLUSTER_ADMIN_ENDPOINT_KV, &raw).await
}

pub async fn store_join_lan_auth(
    pool: &SqlitePool,
    activation_token: Option<&str>,
    master_pubkey: Option<&str>,
    master_device_id: Option<&str>,
) -> Result<(), AppError> {
    let token = activation_token.unwrap_or("").trim();
    if token.is_empty() {
        return Ok(());
    }
    let payload = JoinLanAuthKv {
        activation_token: token.to_string(),
        master_pubkey: master_pubkey.unwrap_or("").trim().to_string(),
        master_device_id: master_device_id.unwrap_or("").trim().to_string(),
    };
    let raw = serde_json::to_string(&payload)
        .map_err(|e| AppError::Internal(format!("join lan auth json: {e}")))?;
    app_kv_repo::set(pool, CLUSTER_JOIN_LAN_AUTH_KV, &raw).await
}

pub(crate) async fn load_join_lan_auth(
    pool: &SqlitePool,
) -> Result<Option<JoinLanAuthKv>, AppError> {
    let Some(raw) = app_kv_repo::get(pool, CLUSTER_JOIN_LAN_AUTH_KV).await? else {
        return Ok(None);
    };
    let payload: JoinLanAuthKv = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("join lan auth kv: {e}")))?;
    if payload.activation_token.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(payload))
}

pub(crate) async fn load_join_session_id(pool: &SqlitePool) -> Result<String, AppError> {
    let id: Option<String> = sqlx::query_scalar(
        "SELECT id FROM pairing_request
         WHERE TRIM(COALESCE(fingerprint, '')) != '' OR TRIM(device_id) != ''
         ORDER BY requested_at DESC LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(id.unwrap_or_default())
}

/// Pull staff directory from the owner device saved during join.
pub async fn sync_staff_from_stored_admin_endpoint(pool: &SqlitePool) -> Result<u32, AppError> {
    sync_staff_from_stored_admin_endpoint_inner(pool, false).await
}

/// Same as [`sync_staff_from_stored_admin_endpoint`] but fails when nothing was imported.
pub async fn sync_staff_from_stored_admin_endpoint_required(
    pool: &SqlitePool,
) -> Result<u32, AppError> {
    sync_staff_from_stored_admin_endpoint_inner(pool, true).await
}

async fn sync_staff_from_stored_admin_endpoint_inner(
    pool: &SqlitePool,
    require_import: bool,
) -> Result<u32, AppError> {
    let Some(raw) = app_kv_repo::get(pool, CLUSTER_ADMIN_ENDPOINT_KV).await? else {
        if require_import {
            return Err(AppError::Validation(
                "No main device stored — please join the network again.".into(),
            ));
        }
        return Ok(0);
    };
    let endpoint: AdminEndpointKv = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("admin endpoint kv: {e}")))?;
    if endpoint.host.is_empty() || endpoint.port == 0 {
        if require_import {
            return Err(AppError::Validation(
                "Main device address invalid — please join the network again.".into(),
            ));
        }
        return Ok(0);
    }
    let identity = DeviceIdentity::load_or_create()?;
    let session_id = load_join_session_id(pool).await?;
    let directory_json =
        fetch_staff_directory(&endpoint.host, endpoint.port, &identity, &session_id).await?;
    let imported = import_staff_directory_json(pool, &directory_json).await?;
    if require_import && imported == 0 {
        return Err(AppError::Validation(
            "No user accounts received from the main device — main device must be signed in."
                .into(),
        ));
    }
    Ok(imported)
}

/// Build provisioning settings JSON with owner staff directory (member join).
pub async fn fetch_provisioning_settings_json(pool: &SqlitePool) -> Result<String, AppError> {
    let Some(raw) = app_kv_repo::get(pool, CLUSTER_ADMIN_ENDPOINT_KV).await? else {
        return Ok("{}".to_string());
    };
    let endpoint: AdminEndpointKv = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("admin endpoint kv: {e}")))?;
    if endpoint.host.is_empty() || endpoint.port == 0 {
        return Ok("{}".to_string());
    }
    let identity = DeviceIdentity::load_or_create()?;
    let session_id = load_join_session_id(pool).await?;
    let staff_json =
        fetch_staff_directory(&endpoint.host, endpoint.port, &identity, &session_id).await?;
    if staff_json.trim().is_empty() {
        return Ok("{}".to_string());
    }
    Ok(serde_json::json!({ "staffDirectoryJson": staff_json }).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::crypto::hash_password;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn staff_directory_roundtrip() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
            .await
            .expect("drop quota");
        let hash = hash_password("password123").expect("hash");
        sqlx::query(
            "INSERT INTO staff (id, name, email, password_hash, role) VALUES ('u-rez', 'Front', 'a@practice.de', ?1, 'RECEPTION')",
        )
        .bind(&hash)
        .execute(&pool)
        .await
        .unwrap();

        let json = export_staff_directory_json(&pool).await.unwrap();
        sqlx::query("UPDATE staff SET email = 'changed@practice.de' WHERE id = 'u-rez'")
            .execute(&pool)
            .await
            .unwrap();
        let n = import_staff_directory_json(&pool, &json).await.unwrap();
        assert!(n >= 1);
        let (email,): (String,) = sqlx::query_as("SELECT email FROM staff WHERE id = 'u-rez'")
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(email, "a@practice.de");
    }
}
