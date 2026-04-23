// TWAIN scanner stub (FA-DEV-04).
//
// Real TWAIN integration requires the platform-specific TWAIN DSM and a
// safe Rust binding (e.g. `twain-rs`). This stub:
//
// - exposes the contract surface so frontend wiring can proceed,
// - watches a configurable filesystem folder for newly written images and
//   reports them as "scanned" documents,
// - emits structured `device.log` events for every detected file.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::error::AppError;
use crate::log_device;

#[derive(Debug, Serialize)]
pub struct ScannedDocument {
    pub path: String,
    pub bytes: u64,
    pub modified_unix: u64,
}

/// Enumerate image-like files in `folder`, newest first. Acts as a stand-in
/// for "give me the most recently scanned document" until TWAIN is wired in.
pub fn list_recent(folder: &Path, limit: usize) -> Result<Vec<ScannedDocument>, AppError> {
    let mut docs: Vec<ScannedDocument> = Vec::new();
    let entries = std::fs::read_dir(folder)
        .map_err(|e| AppError::Internal(format!("scanner folder: {e}")))?;
    for e in entries.flatten() {
        let p = e.path();
        if !p.is_file() {
            continue;
        }
        let ext = p
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !matches!(
            ext.as_str(),
            "png" | "jpg" | "jpeg" | "tif" | "tiff" | "pdf"
        ) {
            continue;
        }
        let meta = match e.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        docs.push(ScannedDocument {
            path: p.display().to_string(),
            bytes: meta.len(),
            modified_unix: modified,
        });
    }
    docs.sort_by_key(|d| std::cmp::Reverse(d.modified_unix));
    docs.truncate(limit);
    log_device!(info, event = "SCANNER_LIST", folder = %folder.display(), found = docs.len());
    Ok(docs)
}

/// Persist a scanned document into the patient archive (copy + log).
pub fn attach_to_patient(
    src: &Path,
    archive_root: &Path,
    patient_id: &str,
) -> Result<PathBuf, AppError> {
    let target_dir = archive_root.join(patient_id);
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| AppError::Internal(format!("archive mkdir: {e}")))?;
    let filename = src
        .file_name()
        .ok_or_else(|| AppError::Validation("source has no filename".into()))?;
    let target = target_dir.join(filename);
    std::fs::copy(src, &target).map_err(|e| AppError::Internal(format!("archive copy: {e}")))?;
    log_device!(info, event = "SCAN_ATTACHED", patient_id = %patient_id, path = %target.display());
    Ok(target)
}
