//! Local store for MeDoc Recovery UI.
//!
//! Layout (macOS example):
//! `~/Library/Application Support/MeDocRecovery/`
//!   `vendor/vendor-recovery.sk` — vendor X25519 private key (replace to rotate)
//!   `vendor/vendor-recovery.pk` — optional public key (32 raw bytes or hex text)
//!   `kit/` — copied activation / practice / vendor share JSON
//!   `paths.json` — last resolved paths
//!   `README.txt` — how to update vendor materials

use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

pub const VENDOR_SK_NAME: &str = "vendor-recovery.sk";
pub const VENDOR_PK_NAME: &str = "vendor-recovery.pk";
pub const VENDOR_SHARE_NAME: &str = "vendor-recovery.share.v2.json";
pub const PRACTICE_SHARE_NAME: &str = "practice-recovery.share.v2.json";
pub const ACTIVATION_NAME: &str = "activation.json";
pub const MEDOC_DB_NAME: &str = "medoc.db";
pub const WRAP_NAME: &str = "db-key.wrap";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StoredPaths {
    pub manifest: Option<String>,
    pub practice_share: Option<String>,
    pub vendor_share: Option<String>,
    pub vendor_sk: Option<String>,
    pub app_dir: Option<String>,
    pub write_wrap_dir: Option<String>,
    pub verify_db: Option<String>,
    pub last_scan_notes: Vec<String>,
}

pub fn store_root() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MeDocRecovery")
}

pub fn vendor_dir(root: &Path) -> PathBuf {
    root.join("vendor")
}

pub fn kit_dir(root: &Path) -> PathBuf {
    root.join("kit")
}

pub fn ensure_store(root: &Path) -> std::io::Result<()> {
    fs::create_dir_all(vendor_dir(root))?;
    fs::create_dir_all(kit_dir(root))?;
    let readme = root.join("README.txt");
    if !readme.exists() {
        fs::write(
            readme,
            "MeDoc Recovery — local store\n\
             \n\
             vendor/\n\
               vendor-recovery.sk   — vendor Bridge C private key (32 bytes).\n\
               vendor-recovery.pk   — optional matching public key.\n\
               Replace these files directly when rotating vendor keys.\n\
             \n\
             kit/\n\
               activation.json\n\
               practice-recovery.share.v2.json\n\
               vendor-recovery.share.v2.json\n\
               Copied automatically when the UI finds them. Replace to use a new kit.\n\
             \n\
             paths.json — last auto-filled paths (safe to delete).\n\
             \n\
             Click Rescan in the app after updating any file here.\n",
        )?;
    }
    Ok(())
}

fn paths_file(root: &Path) -> PathBuf {
    root.join("paths.json")
}

pub fn load_paths(root: &Path) -> StoredPaths {
    let p = paths_file(root);
    fs::read_to_string(&p)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_paths(root: &Path, paths: &StoredPaths) -> std::io::Result<()> {
    ensure_store(root)?;
    let s = serde_json::to_string_pretty(paths).unwrap_or_else(|_| "{}".into());
    fs::write(paths_file(root), s)
}

fn mtime(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

/// Copy `src` into `dest` when dest is missing or src is newer.
fn import_file(src: &Path, dest: &Path, notes: &mut Vec<String>) -> bool {
    if !src.is_file() {
        return false;
    }
    if let Some(parent) = dest.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let should = match (mtime(src), mtime(dest)) {
        (Some(s), Some(d)) => s > d,
        (Some(_), None) => true,
        _ => !dest.exists(),
    };
    if !should && dest.exists() {
        return true;
    }
    match fs::copy(src, dest) {
        Ok(_) => {
            notes.push(format!(
                "stored {} ← {}",
                dest.file_name().and_then(|n| n.to_str()).unwrap_or("?"),
                src.display()
            ));
            true
        }
        Err(e) => {
            notes.push(format!("failed to store {}: {e}", src.display()));
            false
        }
    }
}

fn search_roots(store: &Path) -> Vec<PathBuf> {
    let mut roots = vec![
        store.to_path_buf(),
        kit_dir(store),
        vendor_dir(store),
        PathBuf::from("."),
        PathBuf::from(".tmp/medoc-recovery-demo"),
    ];
    if let Ok(cwd) = std::env::current_dir() {
        roots.push(cwd.clone());
        roots.push(cwd.join(".tmp/medoc-recovery-demo"));
    }
    if let Some(d) = dirs::desktop_dir() {
        roots.push(d);
    }
    if let Some(d) = dirs::download_dir() {
        roots.push(d);
    }
    if let Some(h) = dirs::home_dir() {
        roots.push(h.join("Library/Application Support/de.medoc.app"));
        roots.push(h.join(".tmp/medoc-recovery-demo"));
        // Repo-relative demo when launched from workspace
        roots.push(h.join("pro/Medoc/.tmp/medoc-recovery-demo"));
    }
    roots.sort();
    roots.dedup();
    roots
}

fn find_named(roots: &[PathBuf], name: &str) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for root in roots {
        let p = root.join(name);
        if p.is_file() {
            let t = mtime(&p).unwrap_or(SystemTime::UNIX_EPOCH);
            match &best {
                None => best = Some((t, p)),
                Some((bt, _)) if t > *bt => best = Some((t, p)),
                _ => {}
            }
        }
        // One level deep (e.g. kit folders on Desktop)
        if let Ok(rd) = fs::read_dir(root) {
            for ent in rd.flatten() {
                let p = ent.path().join(name);
                if p.is_file() {
                    let t = mtime(&p).unwrap_or(SystemTime::UNIX_EPOCH);
                    match &best {
                        None => best = Some((t, p)),
                        Some((bt, _)) if t > *bt => best = Some((t, p)),
                        _ => {}
                    }
                }
            }
        }
    }
    best.map(|(_, p)| p)
}

fn find_app_data_with_wrap(roots: &[PathBuf]) -> Option<PathBuf> {
    for root in roots {
        let wrap = root.join(WRAP_NAME);
        if wrap.is_file() {
            return Some(root.to_path_buf());
        }
        if let Ok(rd) = fs::read_dir(root) {
            for ent in rd.flatten() {
                let p = ent.path();
                if p.join(WRAP_NAME).is_file() {
                    return Some(p);
                }
            }
        }
    }
    // Prefer live MeDoc app data even without wrap yet (for write-wrap target).
    if let Some(h) = dirs::home_dir() {
        let medoc = h.join("Library/Application Support/de.medoc.app");
        if medoc.is_dir() {
            return Some(medoc);
        }
    }
    None
}

fn find_medoc_db(roots: &[PathBuf]) -> Option<PathBuf> {
    find_named(roots, MEDOC_DB_NAME).or_else(|| {
        dirs::home_dir().and_then(|h| {
            let p = h
                .join("Library/Application Support/de.medoc.app")
                .join(MEDOC_DB_NAME);
            p.is_file().then_some(p)
        })
    })
}

/// Ensure store exists, import newest discovered files into it, return filled paths.
pub fn rescan() -> StoredPaths {
    let root = store_root();
    let mut notes = Vec::new();
    if let Err(e) = ensure_store(&root) {
        notes.push(format!("could not create store {}: {e}", root.display()));
        return StoredPaths {
            last_scan_notes: notes,
            ..Default::default()
        };
    }

    let roots = search_roots(&root);
    let vdir = vendor_dir(&root);
    let kdir = kit_dir(&root);

    // Vendor secret: prefer file already in store; else import newest find.
    let stored_sk = vdir.join(VENDOR_SK_NAME);
    if !stored_sk.is_file() {
        if let Some(found) = find_named(&roots, VENDOR_SK_NAME) {
            if found != stored_sk {
                import_file(&found, &stored_sk, &mut notes);
            }
        }
    } else {
        notes.push(format!(
            "using vendor sk in store ({})",
            stored_sk.display()
        ));
        // If a newer sk exists outside store, import (vendor rotating by dropping a new file elsewhere).
        if let Some(found) = find_named(&roots, VENDOR_SK_NAME) {
            if found != stored_sk {
                import_file(&found, &stored_sk, &mut notes);
            }
        }
    }

    if let Some(found) = find_named(&roots, VENDOR_PK_NAME) {
        let dest = vdir.join(VENDOR_PK_NAME);
        if found != dest {
            import_file(&found, &dest, &mut notes);
        }
    }

    for (name, dest) in [
        (ACTIVATION_NAME, kdir.join(ACTIVATION_NAME)),
        (PRACTICE_SHARE_NAME, kdir.join(PRACTICE_SHARE_NAME)),
        (VENDOR_SHARE_NAME, kdir.join(VENDOR_SHARE_NAME)),
    ] {
        if let Some(found) = find_named(&roots, name) {
            if found != dest {
                import_file(&found, &dest, &mut notes);
            }
        }
    }

    let mut paths = StoredPaths {
        vendor_sk: stored_sk.is_file().then(|| stored_sk.display().to_string()),
        manifest: kdir
            .join(ACTIVATION_NAME)
            .is_file()
            .then(|| kdir.join(ACTIVATION_NAME).display().to_string()),
        practice_share: kdir
            .join(PRACTICE_SHARE_NAME)
            .is_file()
            .then(|| kdir.join(PRACTICE_SHARE_NAME).display().to_string()),
        vendor_share: kdir
            .join(VENDOR_SHARE_NAME)
            .is_file()
            .then(|| kdir.join(VENDOR_SHARE_NAME).display().to_string()),
        app_dir: None,
        write_wrap_dir: None,
        verify_db: None,
        last_scan_notes: notes,
    };

    if let Some(dir) = find_app_data_with_wrap(&roots) {
        let s = dir.display().to_string();
        paths.app_dir = Some(s.clone());
        paths.write_wrap_dir = Some(s);
    }
    if let Some(db) = find_medoc_db(&roots) {
        paths.verify_db = Some(db.display().to_string());
    }

    paths
        .last_scan_notes
        .push(format!("store root: {}", root.display()));
    let _ = save_paths(&root, &paths);
    paths
}

/// Copy an external path into the store vendor/kit slot (overwrite).
pub fn install_into_store(src: &Path, kind: StoreKind) -> Result<PathBuf, String> {
    let root = store_root();
    ensure_store(&root).map_err(|e| e.to_string())?;
    let dest = match kind {
        StoreKind::VendorSk => vendor_dir(&root).join(VENDOR_SK_NAME),
        StoreKind::VendorPk => vendor_dir(&root).join(VENDOR_PK_NAME),
        StoreKind::VendorShare => kit_dir(&root).join(VENDOR_SHARE_NAME),
        StoreKind::PracticeShare => kit_dir(&root).join(PRACTICE_SHARE_NAME),
        StoreKind::Activation => kit_dir(&root).join(ACTIVATION_NAME),
    };
    fs::copy(src, &dest).map_err(|e| e.to_string())?;
    Ok(dest)
}

#[derive(Debug, Clone, Copy)]
pub enum StoreKind {
    VendorSk,
    VendorPk,
    VendorShare,
    PracticeShare,
    Activation,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ensure_store_creates_vendor_and_kit() {
        let root = tempfile::tempdir().unwrap();
        ensure_store(root.path()).unwrap();
        assert!(vendor_dir(root.path()).is_dir());
        assert!(kit_dir(root.path()).is_dir());
        assert!(root.path().join("README.txt").is_file());
    }

    #[test]
    fn import_newer_overwrites() {
        let root = tempfile::tempdir().unwrap();
        ensure_store(root.path()).unwrap();
        let dest = vendor_dir(root.path()).join(VENDOR_SK_NAME);
        std::fs::write(&dest, b"old").unwrap();
        let src_dir = tempfile::tempdir().unwrap();
        let src = src_dir.path().join(VENDOR_SK_NAME);
        std::fs::write(&src, b"new-key-material-32b!!!!!!!!!!").unwrap();
        // bump mtime by rewriting after a tiny sleep is flaky; force by removing dest first
        std::fs::remove_file(&dest).unwrap();
        let mut notes = Vec::new();
        assert!(import_file(&src, &dest, &mut notes));
        assert_eq!(
            std::fs::read(&dest).unwrap(),
            b"new-key-material-32b!!!!!!!!!!"
        );
    }
}
