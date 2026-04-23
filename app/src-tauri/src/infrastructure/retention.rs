// Log retention enforcement (NFA-LOG-05).
//
// Deletes log files that have exceeded the retention window. Runs at app
// start and can be triggered manually by ops.

use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use serde::Serialize;

use crate::error::AppError;
use crate::log_system;

/// Retention window per log channel (filename prefix).
fn retention_for(filename: &str) -> Option<Duration> {
    if filename.starts_with("audit") {
        // 10 years for audit, never auto-delete from here
        None
    } else if filename.starts_with("security") {
        Some(Duration::from_secs(90 * 24 * 3600))
    } else if filename.starts_with("device")
        || filename.starts_with("migration")
        || filename.starts_with("perf")
        || filename.starts_with("system")
    {
        Some(Duration::from_secs(180 * 24 * 3600))
    } else {
        // app.log + everything else
        Some(Duration::from_secs(30 * 24 * 3600))
    }
}

#[derive(Debug, Serialize)]
pub struct RetentionReport {
    pub scanned: usize,
    pub deleted: Vec<String>,
    pub kept: usize,
    pub errors: Vec<String>,
}

pub fn enforce(log_dir: &PathBuf) -> Result<RetentionReport, AppError> {
    let mut report = RetentionReport {
        scanned: 0,
        deleted: Vec::new(),
        kept: 0,
        errors: Vec::new(),
    };
    let entries = match std::fs::read_dir(log_dir) {
        Ok(e) => e,
        Err(e) => {
            // Missing log dir is not fatal — just nothing to enforce.
            log_system!(warn, event = "RETENTION_NO_DIR", err = %e);
            return Ok(report);
        }
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        report.scanned += 1;
        let path = entry.path();
        let name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let Some(window) = retention_for(&name) else {
            report.kept += 1;
            continue;
        };
        let Ok(meta) = entry.metadata() else { continue };
        let Ok(modified) = meta.modified() else {
            continue;
        };
        let age = now.duration_since(modified).unwrap_or(Duration::ZERO);
        if age > window {
            match std::fs::remove_file(&path) {
                Ok(()) => {
                    report.deleted.push(name);
                }
                Err(e) => report.errors.push(format!("{}: {}", path.display(), e)),
            }
        } else {
            report.kept += 1;
        }
    }
    log_system!(
        info,
        event = "RETENTION_ENFORCED",
        scanned = report.scanned,
        deleted = report.deleted.len(),
        kept = report.kept,
    );
    Ok(report)
}
