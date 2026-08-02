//! Replicate owner staff credentials to member devices for local login.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::net::fetch_staff_directory;
use crate::verbund::crypto::DeviceIdentity;

const DIRECTORY_VERSION: u32 = 1;
pub const VERBUND_ADMIN_ENDPOINT_KV: &str = "verbund.join.admin_endpoint.v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdminEndpointKv {
    host: String,
    port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StaffDirectoryEntry {
    id: String,
    name: String,
    email: String,
    passwort_hash: String,
    rolle: String,
    #[serde(default)]
    fachrichtung: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StaffDirectory {
    version: u32,
    staff: Vec<StaffDirectoryEntry>,
}

/// Export login-capable staff rows for verbund member provisioning.
pub async fn export_staff_directory_json(pool: &SqlitePool) -> Result<String, AppError> {
    let rows: Vec<(String, String, String, String, String, Option<String>)> = sqlx::query_as(
        "SELECT id, name, email, passwort_hash, rolle, fachrichtung FROM personal ORDER BY email COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    let staff = rows
        .into_iter()
        .map(
            |(id, name, email, passwort_hash, rolle, fachrichtung)| StaffDirectoryEntry {
                id,
                name,
                email,
                passwort_hash,
                rolle,
                fachrichtung,
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

async fn upsert_staff_entry(pool: &SqlitePool, entry: &StaffDirectoryEntry) -> Result<bool, AppError> {
    let email = entry.email.trim();
    if email.is_empty() || entry.passwort_hash.trim().is_empty() {
        return Ok(false);
    }
    let rolle = entry.rolle.trim().to_uppercase();
    if rolle != "ARZT" && rolle != "REZEPTION" {
        return Ok(false);
    }
    let fachrichtung = entry
        .fachrichtung
        .as_ref()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim());

    if apply_staff_entry_update(
        pool,
        &entry.id,
        entry.name.trim(),
        email,
        &entry.passwort_hash,
        &rolle,
        fachrichtung,
    )
    .await?
    {
        return Ok(true);
    }

    if let Some(existing_id) = sqlx::query_scalar::<_, String>(
        "SELECT id FROM personal WHERE LOWER(email) = LOWER(?1) LIMIT 1",
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
            &entry.passwort_hash,
            &rolle,
            fachrichtung,
        )
        .await?
        {
            return Ok(true);
        }
    }

    if rolle == "ARZT" {
        if let Some(local_arzt_id) = sqlx::query_scalar::<_, String>(
            "SELECT id FROM personal WHERE UPPER(rolle) = 'ARZT' LIMIT 1",
        )
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        {
            if apply_staff_entry_update(
                pool,
                &local_arzt_id,
                entry.name.trim(),
                email,
                &entry.passwort_hash,
                &rolle,
                fachrichtung,
            )
            .await?
            {
                return Ok(true);
            }
        }
    }

    if rolle == "REZEPTION" {
        if let Some(local_rez_id) = sqlx::query_scalar::<_, String>(
            "SELECT id FROM personal WHERE UPPER(rolle) = 'REZEPTION' LIMIT 1",
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
                &entry.passwort_hash,
                &rolle,
                fachrichtung,
            )
            .await?
            {
                return Ok(true);
            }
        }
    }

    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle, fachrichtung, verfuegbar)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1)",
    )
    .bind(&entry.id)
    .bind(entry.name.trim())
    .bind(email)
    .bind(&entry.passwort_hash)
    .bind(&rolle)
    .bind(fachrichtung)
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
    passwort_hash: &str,
    rolle: &str,
    fachrichtung: Option<&str>,
) -> Result<bool, AppError> {
    let result = sqlx::query(
        "UPDATE personal SET
           name = ?2,
           email = ?3,
           passwort_hash = ?4,
           rolle = ?5,
           fachrichtung = ?6,
           verfuegbar = 1,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1",
    )
    .bind(id)
    .bind(name)
    .bind(email)
    .bind(passwort_hash)
    .bind(rolle)
    .bind(fachrichtung)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(result.rows_affected() > 0)
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
    app_kv_repo::set(pool, VERBUND_ADMIN_ENDPOINT_KV, &raw).await
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
    let Some(raw) = app_kv_repo::get(pool, VERBUND_ADMIN_ENDPOINT_KV).await? else {
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
    let directory_json =
        fetch_staff_directory(&endpoint.host, endpoint.port, &identity).await?;
    let imported = import_staff_directory_json(pool, &directory_json).await?;
    if require_import && imported == 0 {
        return Err(AppError::Validation(
            "No user accounts received from the main device — main device must be signed in.".into(),
        ));
    }
    Ok(imported)
}

/// Build provisioning settings JSON with owner staff directory (member join).
pub async fn fetch_provisioning_settings_json(pool: &SqlitePool) -> Result<String, AppError> {
    let Some(raw) = app_kv_repo::get(pool, VERBUND_ADMIN_ENDPOINT_KV).await? else {
        return Ok("{}".to_string());
    };
    let endpoint: AdminEndpointKv = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("admin endpoint kv: {e}")))?;
    if endpoint.host.is_empty() || endpoint.port == 0 {
        return Ok("{}".to_string());
    }
    let identity = DeviceIdentity::load_or_create()?;
    let staff_json =
        fetch_staff_directory(&endpoint.host, endpoint.port, &identity).await?;
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
        let hash = hash_password("passwort123").expect("hash");
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle) VALUES ('u-rez', 'Front', 'a@praxis.de', ?1, 'REZEPTION')",
        )
        .bind(&hash)
        .execute(&pool)
        .await
        .unwrap();

        let json = export_staff_directory_json(&pool).await.unwrap();
        sqlx::query("UPDATE personal SET email = 'changed@praxis.de' WHERE id = 'u-rez'")
            .execute(&pool)
            .await
            .unwrap();
        let n = import_staff_directory_json(&pool, &json).await.unwrap();
        assert!(n >= 1);
        let (email,): (String,) =
            sqlx::query_as("SELECT email FROM personal WHERE id = 'u-rez'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(email, "a@praxis.de");
    }
}
