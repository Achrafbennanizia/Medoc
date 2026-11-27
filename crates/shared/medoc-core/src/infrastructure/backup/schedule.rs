//! Backup history from the audit log and the automatic daily schedule.

use super::*;

/// One backup action from the audit log, for Settings → Backups.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BackupHistoryRow {
    pub at: String,
    pub action: String,
    /// Staff name, or `system` for the automatic run.
    pub by: String,
    pub details: Option<String>,
}

/// Backup actions (automatic runs, manual backups, restores, resets, schedule changes), newest
/// first. They live in the tamper-evident audit log; this is a read view of it.
/// Not shown in Settings for now (kept internal: audit log + app log); kept for support tooling.
pub async fn history(pool: &SqlitePool, limit: i64) -> Result<Vec<BackupHistoryRow>, AppError> {
    Ok(sqlx::query_as::<_, BackupHistoryRow>(
        "SELECT a.created_at AS at, a.action, COALESCE(s.name, a.user_id) AS by,
                COALESCE(a.details, a.entity_id) AS details
           FROM audit_log a LEFT JOIN staff s ON s.id = a.user_id
          WHERE a.entity = 'Backup'
          ORDER BY a.created_at DESC LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ---------------------------------------------------------------------------
// Automatic schedule
// ---------------------------------------------------------------------------

/// Automatic daily backups are on unless an administrator paused them.
pub async fn schedule_enabled(pool: &SqlitePool) -> bool {
    crate::infrastructure::database::repos::admin::app_kv::get(pool, SCHEDULE_KV_KEY)
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_str::<serde_json::Value>(&v).ok())
        .and_then(|v| v.get("enabled").and_then(serde_json::Value::as_bool))
        .unwrap_or(true)
}

/// Records who turned automatic backups on or off, when and why (also in the audit log).
pub async fn set_schedule(
    pool: &SqlitePool,
    enabled: bool,
    user_id: &str,
    reason: &str,
) -> Result<(), AppError> {
    let value = serde_json::json!({
        "enabled": enabled,
        "changedBy": user_id,
        "changedAt": Utc::now().to_rfc3339(),
        "reason": reason.trim(),
    });
    crate::infrastructure::database::repos::admin::app_kv::set(
        pool,
        SCHEDULE_KV_KEY,
        &value.to_string(),
    )
    .await?;
    audit_repo::create(
        pool,
        user_id,
        if enabled {
            "BACKUP_SCHEDULE_ON"
        } else {
            "BACKUP_SCHEDULE_OFF"
        },
        "Backup",
        None,
        Some(reason.trim()).filter(|r| !r.is_empty()),
    )
    .await?;
    log_system!(warn, event = "BACKUP_SCHEDULE_CHANGED", enabled, by = %user_id, reason = %reason.trim());
    Ok(())
}

/// The daily run: makes today's backup if the schedule is on and none exists yet for today.
/// Safe to call often (the app checks every 30 minutes, so a practice that closes the app
/// in the evening still gets its backup the next morning).
pub async fn run_scheduled_if_due(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<Option<PathBuf>, AppError> {
    if !schedule_enabled(pool).await {
        log_system!(debug, event = "BACKUP_AUTO_PAUSED");
        return Ok(None);
    }
    let today = chrono::Local::now().date_naive();
    let has_today = list_metadata()?
        .iter()
        .filter_map(|e| e.created_at)
        .any(|t| t.with_timezone(&chrono::Local).date_naive() == today);
    if has_today {
        return Ok(None);
    }
    // A manual backup or restore in progress: try again at the next check.
    let Ok(_guard) = begin_operation() else {
        return Ok(None);
    };
    let path = match create_compressed(pool, app_data_dir).await {
        Ok(p) => p,
        Err(e) => {
            // In the audit log too, so Settings → Backups shows that the night's backup failed.
            let _ = audit_repo::create(
                pool,
                "system",
                "BACKUP_AUTO_FAILED",
                "Backup",
                None,
                Some(&e.wire_code()),
            )
            .await;
            return Err(e);
        }
    };
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned());
    audit_repo::create(
        pool,
        "system",
        "BACKUP_AUTO",
        "Backup",
        name.as_deref(),
        None,
    )
    .await?;
    Ok(Some(path))
}
