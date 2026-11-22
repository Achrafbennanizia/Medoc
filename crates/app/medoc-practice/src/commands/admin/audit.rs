use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::commands::list_params::{ListParams, ListResponse, SortDir};
use crate::domain::entities::AuditLog;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
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

/// Paginated audit-log query (NFA-PERF-04). Audit tables grow indefinitely
/// so a paginated entry-point keeps the UI usable without `LIMIT 100` magic.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, params))]
pub async fn list_audit_logs_paged(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    params: Option<ListParams>,
) -> Result<ListResponse<AuditLog>, AppError> {
    rbac::require(&session_state, "audit.read")?;
    let p = params.unwrap_or_default();
    let limit = p.limit();
    let offset = p.offset();
    let sort_dir = p.sort_dir_or(SortDir::Desc).sql();
    let break_glass_only = p.filter_bool("breakGlassOnly").unwrap_or(false);
    let (items, total) =
        audit_repo::find_paginated(&pool, limit, offset, sort_dir, break_glass_only).await?;
    Ok(ListResponse {
        items,
        total,
        page: p.page_one_based(),
        page_size: limit,
    })
}

/// F107: one CSV cell. Text that a spreadsheet would run as a formula
/// (`=`, `+`, `-`, `@`, tab, CR at the start) gets a leading `'`; then the
/// usual quoting for separators, quotes and line breaks.
pub fn csv_cell(s: &str) -> String {
    let neutral = if s.starts_with(['=', '+', '-', '@', '\t', '\r']) {
        format!("'{s}")
    } else {
        s.to_string()
    };
    if neutral.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", neutral.replace('"', "\"\""))
    } else {
        neutral
    }
}

/// Export all audit log entries as CSV. Cells go through [`csv_cell`].
#[tauri::command]
pub async fn export_audit_csv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<u8>, AppError> {
    let session = rbac::require(&session_state, "audit.read")?;
    let rows = audit_repo::find_all(&pool, i64::MAX).await?;
    let mut out = String::from("\u{FEFF}");
    out.push_str("id,created_at,user_id,action,entity,entity_id,details,under_break_glass,break_glass_reason,hmac\n");
    let esc = csv_cell;
    for r in rows {
        out.push_str(&format!(
            "{},{},{},{},{},{},{},{},{},{}\n",
            esc(&r.id),
            r.created_at,
            esc(&r.user_id),
            esc(&r.action),
            esc(&r.entity),
            esc(r.entity_id.as_deref().unwrap_or("")),
            esc(r.details.as_deref().unwrap_or("")),
            if r.under_break_glass { "1" } else { "0" },
            esc(r.break_glass_reason.as_deref().unwrap_or("")),
            esc(&r.hmac),
        ));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "EXPORT_CSV",
        "AuditLog",
        None,
        Some("scope=all"),
    )
    .await?;
    Ok(out.into_bytes())
}

#[cfg(test)]
mod csv_cell_tests {
    #[test]
    fn audit_export_neutralizes_formulas() {
        assert_eq!(
            super::csv_cell("=HYPERLINK(\"x\")"),
            "\"'=HYPERLINK(\"\"x\"\")\""
        );
        assert_eq!(super::csv_cell("+1"), "'+1");
        assert_eq!(super::csv_cell("@SUM(A1)"), "'@SUM(A1)");
        assert_eq!(super::csv_cell("plain"), "plain");
        assert_eq!(super::csv_cell("a,b"), "\"a,b\"");
    }
}
