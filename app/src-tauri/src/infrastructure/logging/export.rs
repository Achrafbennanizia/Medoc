// Log export (NFA-LOG-09): bundles the last N days of file logs into a ZIP.

use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::time::SystemTime;

use chrono::{Duration, Utc};
use zip::write::SimpleFileOptions;

use super::sanitizer;
use crate::error::AppError;

const RETENTION_DAYS: i64 = 7;

/// Create a ZIP archive of every `*.log` file under `log_dir` modified
/// within the last `RETENTION_DAYS` days. Each file is sanitised first.
pub fn export(log_dir: &Path, output: &Path) -> Result<u64, AppError> {
    let cutoff = Utc::now() - Duration::days(RETENTION_DAYS);

    let file = File::create(output)
        .map_err(|e| AppError::Internal(format!("Cannot create export file: {e}")))?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut total_bytes: u64 = 0;
    let entries = std::fs::read_dir(log_dir)
        .map_err(|e| AppError::Internal(format!("Cannot read logs dir: {e}")))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = match path.file_name().and_then(|s| s.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if !file_name.contains("log") {
            continue;
        }
        let meta = entry.metadata().ok();
        if let Some(m) = meta {
            let modified = m.modified().unwrap_or(SystemTime::UNIX_EPOCH);
            let modified_chrono: chrono::DateTime<Utc> = modified.into();
            if modified_chrono < cutoff {
                continue;
            }
        }

        let mut buf = String::new();
        File::open(&path)
            .and_then(|mut f| f.read_to_string(&mut buf))
            .map_err(|e| AppError::Internal(format!("Cannot read {file_name}: {e}")))?;

        let sanitised = sanitizer::sanitize(&buf);

        zip.start_file(&file_name, opts)
            .map_err(|e| AppError::Internal(format!("ZIP error: {e}")))?;
        zip.write_all(sanitised.as_bytes())
            .map_err(|e| AppError::Internal(format!("ZIP write: {e}")))?;
        total_bytes += sanitised.len() as u64;
    }

    zip.finish()
        .map_err(|e| AppError::Internal(format!("ZIP finalise: {e}")))?;
    Ok(total_bytes)
}
