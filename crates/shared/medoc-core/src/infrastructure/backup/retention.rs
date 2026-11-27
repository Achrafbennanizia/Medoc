//! Retention tiers and deleting backups (split from `backup.rs`).

use super::*;

/// Tiered retention (see the module comment); deletes every backup no tier keeps.
pub fn enforce_retention(dir: &Path) -> Result<BackupRetentionReport, AppError> {
    enforce_retention_at(dir, chrono::Local::now())
}

pub fn enforce_retention_at(
    dir: &Path,
    now: DateTime<chrono::Local>,
) -> Result<BackupRetentionReport, AppError> {
    let mut report = BackupRetentionReport {
        scanned: 0,
        kept: 0,
        deleted: Vec::new(),
        errors: Vec::new(),
    };
    let mut files: Vec<(PathBuf, DateTime<Utc>)> = Vec::new();
    if dir.exists() {
        let rd = std::fs::read_dir(dir).map_err(|e| {
            io_fail(
                "error.backup.folder_unavailable",
                "BACKUP_RETENTION_FAILED",
                e,
            )
        })?;
        for entry in rd.flatten() {
            let path = entry.path();
            if !is_backup_file(&path) {
                continue;
            }
            report.scanned += 1;
            match parse_backup_timestamp(&path) {
                Some(ts) => files.push((path, ts)),
                // Never delete a file whose age is unknown.
                None => report
                    .errors
                    .push(format!("Timestamp not readable: {}", path.display())),
            }
        }
    }
    let keep = classify(&files, now);
    report.kept = keep.len();
    for (path, _) in files {
        if keep.contains_key(&path) {
            continue;
        }
        for p in backup_and_sidecars(&path) {
            match std::fs::remove_file(&p) {
                Ok(()) => report.deleted.push(
                    p.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                ),
                Err(e) => report.errors.push(format!("{}: {e}", p.display())),
            }
        }
    }
    for name in &report.deleted {
        log_system!(info, event = "BACKUP_ROTATED_OUT", file = %name);
    }
    for err in &report.errors {
        log_system!(warn, event = "BACKUP_RETENTION_ERROR", detail = %err);
    }
    log_system!(
        info,
        event = "BACKUP_RETENTION",
        scanned = report.scanned,
        kept = report.kept,
        deleted = report.deleted.len(),
        errors = report.errors.len(),
    );
    Ok(report)
}

/// Which backups each tier keeps, judged in the practice's local time.
pub fn classify(
    files: &[(PathBuf, DateTime<Utc>)],
    now: DateTime<chrono::Local>,
) -> HashMap<PathBuf, Vec<BackupTier>> {
    use chrono::{Local, NaiveDate};
    let mut sorted: Vec<(PathBuf, chrono::DateTime<Local>)> = files
        .iter()
        .map(|(p, t)| (p.clone(), t.with_timezone(&Local)))
        .collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));
    let mut out: HashMap<PathBuf, Vec<BackupTier>> = HashMap::new();
    let mut add = |p: &PathBuf, t: BackupTier| {
        let v = out.entry(p.clone()).or_default();
        if !v.contains(&t) {
            v.push(t);
        }
    };

    // Daily: the newest backup of each of the last DAILY_KEEP days that have one.
    let mut days: Vec<NaiveDate> = Vec::new();
    for (p, t) in &sorted {
        let d = t.date_naive();
        if days.contains(&d) {
            continue;
        }
        if days.len() == DAILY_KEEP {
            break;
        }
        days.push(d);
        add(p, BackupTier::Daily);
    }

    let today = now.date_naive();
    let oldest = sorted.last().map(|(p, _)| p.clone());
    let newest_in = |from: NaiveDate, to: NaiveDate| {
        sorted
            .iter()
            .find(|(_, t)| t.date_naive() >= from && t.date_naive() < to)
            .map(|(p, _)| p.clone())
    };

    // Weekly: the last backup of the previous ISO week.
    let monday = today - Duration::days(i64::from(today.weekday().num_days_from_monday()));
    let weekly = newest_in(monday - Duration::days(7), monday).or_else(|| oldest.clone());
    if let Some(p) = weekly {
        add(&p, BackupTier::Weekly);
    }

    // Half-year: the last backup of the previous half (Jan–Jun or Jul–Dec).
    let half_start =
        NaiveDate::from_ymd_opt(today.year(), if today.month() <= 6 { 1 } else { 7 }, 1)
            .unwrap_or(today);
    let prev_start = if half_start.month() == 1 {
        NaiveDate::from_ymd_opt(half_start.year() - 1, 7, 1)
    } else {
        NaiveDate::from_ymd_opt(half_start.year(), 1, 1)
    }
    .unwrap_or(half_start);
    let half = newest_in(prev_start, half_start).or(oldest);
    if let Some(p) = half {
        add(&p, BackupTier::HalfYear);
    }
    out
}

pub(super) fn is_backup_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|s| s.to_str()),
        Some("db") | Some(COMPRESSED_EXT)
    )
}

pub(super) fn is_compressed(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some(COMPRESSED_EXT)
}

/// The backup file plus every sidecar named after it (`.sig`, recovery key files).
pub(super) fn backup_and_sidecars(path: &Path) -> Vec<PathBuf> {
    let mut out = vec![path.to_path_buf()];
    let (Some(dir), Some(name)) = (path.parent(), path.file_name()) else {
        return out;
    };
    let prefix = format!("{}.", name.to_string_lossy());
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with(&prefix) {
                out.push(e.path());
            }
        }
    }
    out
}

/// Deletes every backup and its sidecars (Settings → Backups → reset). Returns how many.
pub fn delete_all() -> Result<usize, AppError> {
    let mut n = 0;
    let mut failed = Vec::new();
    for e in list_metadata()? {
        match remove_with_sidecars(&e.path) {
            Ok(()) => n += 1,
            Err(err) => failed.push(format!("{}: {err}", e.path.display())),
        }
    }
    for dir in backup_dirs() {
        super::super::backup_files::collect_garbage(&dir);
    }
    log_system!(
        warn,
        event = "BACKUP_RESET",
        deleted = n,
        failed = failed.len()
    );
    if !failed.is_empty() {
        return Err(fail(
            "error.backup.delete_failed",
            "BACKUP_RESET_INCOMPLETE",
            failed.join("; "),
        ));
    }
    Ok(n)
}

/// Removes the backup first (so a half-deleted backup is never listed), then its sidecars.
pub(super) fn remove_with_sidecars(path: &Path) -> std::io::Result<()> {
    let files = backup_and_sidecars(path);
    std::fs::remove_file(path)?;
    for p in files.iter().skip(1) {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}

/// A backup listed in the backup folder; any other path is refused (`outside_folder`).
pub(super) fn resolve_in_backup_dir(path: &Path) -> Result<PathBuf, AppError> {
    let Ok(file) = path.canonicalize() else {
        return Err(AppError::validation_code("error.backup.file_not_found"));
    };
    let inside = backup_dirs()
        .into_iter()
        .map(|d| d.canonicalize().unwrap_or(d))
        .any(|d| file.parent() == Some(d.as_path()));
    if !inside || !is_backup_file(&file) {
        log_system!(warn, event = "BACKUP_PATH_REFUSED", path = %path.display());
        return Err(AppError::validation_code("error.backup.outside_folder"));
    }
    Ok(file)
}

/// Deletes one backup and its sidecars (Settings → Backups). The last remaining backup is kept:
/// "delete all and start again" is the way to replace it. Returns the file name.
pub fn delete_one(path: &Path) -> Result<String, AppError> {
    let file = resolve_in_backup_dir(path)?;
    if list_metadata()?.len() <= 1 {
        return Err(AppError::validation_code("error.backup.keep_last"));
    }
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    remove_with_sidecars(&file)
        .map_err(|e| io_fail("error.backup.delete_failed", "BACKUP_DELETE_FAILED", e))?;
    if let Some(dir) = file.parent() {
        super::super::backup_files::collect_garbage(dir);
    }
    log_system!(warn, event = "BACKUP_DELETED", file = %name);
    Ok(name)
}

// ---------------------------------------------------------------------------
// Compressed format (.mdbk)
// ---------------------------------------------------------------------------
