use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::AuditLog;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_audit_logs(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    limit: Option<i64>,
) -> Result<Vec<AuditLog>, AppError> {
    rbac::require(&session_state, "audit.read")?;
    audit_repo::find_all(&pool, limit.unwrap_or(100)).await
}

/// Export all audit log entries as a CSV byte stream. CSV fields are RFC-4180
/// quoted so that arbitrary user/entity strings round-trip safely.
#[tauri::command]
pub async fn export_audit_csv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "audit.read")?;
    let rows = audit_repo::find_all(&pool, i64::MAX).await?;
    let mut out = String::new();
    out.push_str("id,created_at,user_id,action,entity,entity_id,details,hmac\n");
    let esc = |s: &str| -> String {
        if s.contains(',') || s.contains('"') || s.contains('\n') {
            format!("\"{}\"", s.replace('"', "\"\""))
        } else {
            s.to_string()
        }
    };
    for r in rows {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            esc(&r.id),
            r.created_at,
            esc(&r.user_id),
            esc(&r.action),
            esc(&r.entity),
            esc(r.entity_id.as_deref().unwrap_or("")),
            esc(r.details.as_deref().unwrap_or("")),
            esc(&r.hmac),
        ));
    }
    Ok(out.into_bytes())
}
