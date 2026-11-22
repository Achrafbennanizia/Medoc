//! Finder double-click target. Not an `.app` bundle — Launch Services refuses
//! unsigned USB app bundles. `open` of this Mach-O starts MeDoc the same way
//! the installer button does (no Terminal).
//!
//! macOS-only; other targets compile a stub so `cargo check --all-targets` works on CI.

#[cfg(target_os = "macos")]
use std::os::unix::process::CommandExt;
#[cfg(target_os = "macos")]
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};

#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("medoc-finder-open is only supported on macOS");
    std::process::exit(1);
}

#[cfg(target_os = "macos")]
fn main() {
    let medoc = resolve_medoc();
    if !medoc.is_file() {
        eprintln!("MeDoc is not installed at {}", medoc.display());
        std::process::exit(1);
    }
    if medoc_running() {
        let _ = Command::new("osascript")
            .args([
                "-e",
                r#"tell application "System Events" to set frontmost of (first process whose name is "medoc") to true"#,
            ])
            .status();
        return;
    }
    let log_path = home().join("Library/Application Support/de.medoc.app/last-launch.log");
    if let Some(parent) = log_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let log = std::fs::File::create(&log_path).ok();
    let err = log.as_ref().and_then(|f| f.try_clone().ok());
    let mut cmd = Command::new("/usr/bin/nohup");
    cmd.arg(&medoc);
    cmd.stdin(Stdio::null());
    if let (Some(out), Some(e)) = (log, err) {
        cmd.stdout(Stdio::from(out)).stderr(Stdio::from(e));
    } else {
        cmd.stdout(Stdio::null()).stderr(Stdio::null());
    }
    cmd.process_group(0);
    match cmd.spawn() {
        Ok(_) => {}
        Err(e) => {
            eprintln!("start MeDoc: {e}");
            std::process::exit(1);
        }
    }
}

#[cfg(target_os = "macos")]
fn medoc_running() -> bool {
    for pat in [
        "MeDoc.app/Contents/MacOS/medoc",
        "Medoc_replica.app/Contents/MacOS/medoc",
    ] {
        let running = Command::new("pgrep")
            .args(["-f", pat])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        if running {
            return true;
        }
    }
    false
}

#[cfg(target_os = "macos")]
fn resolve_medoc() -> PathBuf {
    let bundles = ["Medoc_replica.app", "MeDoc.app"];
    if let Ok(me) = std::env::current_exe() {
        if let Some(dir) = me.parent() {
            for name in bundles {
                let next_to_me = dir.join(name).join("Contents/MacOS/medoc");
                if next_to_me.is_file() {
                    return next_to_me;
                }
            }
            if let Some(apps) = dir
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
            {
                for name in bundles {
                    let bundled = apps.join(name).join("Contents/MacOS/medoc");
                    if bundled.is_file() {
                        return bundled;
                    }
                }
            }
        }
    }
    let user_apps: Vec<PathBuf> = bundles
        .iter()
        .map(|name| {
            home()
                .join("Applications")
                .join(name)
                .join("Contents/MacOS/medoc")
        })
        .collect();
    if let Some(user) = newest_bundle(&user_apps) {
        return user;
    }
    let system_apps: Vec<PathBuf> = bundles
        .iter()
        .map(|name| {
            PathBuf::from("/Applications")
                .join(name)
                .join("Contents/MacOS/medoc")
        })
        .collect();
    if let Some(system) = newest_bundle(&system_apps) {
        return system;
    }
    PathBuf::from("/Applications/MeDoc.app/Contents/MacOS/medoc")
}

#[cfg(target_os = "macos")]
fn newest_bundle(candidates: &[PathBuf]) -> Option<PathBuf> {
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for exe in candidates {
        if !exe.is_file() {
            continue;
        }
        let mt = std::fs::metadata(exe)
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        if best.as_ref().map(|(t, _)| mt > *t).unwrap_or(true) {
            best = Some((mt, exe.clone()));
        }
    }
    best.map(|(_, p)| p)
}

#[cfg(target_os = "macos")]
fn home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
}
