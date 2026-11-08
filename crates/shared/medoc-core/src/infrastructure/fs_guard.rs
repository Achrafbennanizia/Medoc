//! Canonical path checks for exports, scans, and attachments.

use std::path::{Component, Path, PathBuf};

use crate::error::AppError;

/// Canonicalize root and the candidate (candidate's parent if the file does not exist yet).
/// Err if the candidate is not inside root, or if any path component is "..".
pub fn ensure_inside(root: &Path, candidate: &Path) -> Result<PathBuf, AppError> {
    if has_parent(root) || has_parent(candidate) {
        return Err(AppError::Validation("Path must not contain ..".into()));
    }
    let root_real = root
        .canonicalize()
        .map_err(|e| AppError::Validation(format!("Root path: {e}")))?;
    let candidate_real = if candidate.exists() {
        candidate
            .canonicalize()
            .map_err(|e| AppError::Validation(format!("Path: {e}")))?
    } else {
        let parent = candidate.parent().unwrap_or(candidate);
        let parent_real = parent
            .canonicalize()
            .map_err(|e| AppError::Validation(format!("Path: {e}")))?;
        let name = candidate.file_name().ok_or_else(|| {
            AppError::Validation("Path has no file name".into())
        })?;
        parent_real.join(name)
    };
    if candidate_real == root_real || candidate_real.starts_with(&root_real) {
        Ok(candidate_real)
    } else {
        Err(AppError::Validation("Path is outside the allowed folder".into()))
    }
}

/// Rejects empty ids and ids containing '/', '\\', "..", ':' or NUL.
pub fn safe_id(id: &str) -> Result<&str, AppError> {
    if id.is_empty()
        || id.contains('/')
        || id.contains('\\')
        || id.contains("..")
        || id.contains(':')
        || id.contains('\0')
    {
        return Err(AppError::Validation("Invalid id".into()));
    }
    Ok(id)
}

fn has_parent(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}

#[cfg(test)]
mod tests {
    use super::{ensure_inside, safe_id};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn tmp(name: &str) -> std::path::PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("medoc-fs-{name}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn rejects_parent_traversal() {
        let root = tmp("root");
        assert!(ensure_inside(&root, &root.join("../outside.txt")).is_err());
        assert!(safe_id("../x").is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn accepts_nested_file() {
        let root = tmp("nest");
        let nested = root.join("a");
        fs::create_dir_all(&nested).unwrap();
        let file = nested.join("chart.csv");
        fs::write(&file, b"x").unwrap();
        let got = ensure_inside(&root, &file).unwrap();
        assert!(got.ends_with("chart.csv"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    #[cfg(unix)]
    fn rejects_symlink_escape() {
        let root = tmp("sym-root");
        let outside = tmp("sym-out");
        fs::write(outside.join("secret"), b"no").unwrap();
        let link = root.join("escape");
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        assert!(ensure_inside(&root, &link.join("secret")).is_err());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }
}
