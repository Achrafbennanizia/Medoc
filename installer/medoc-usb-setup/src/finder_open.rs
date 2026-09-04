//! Finder double-click target. Not an `.app` bundle — Launch Services refuses
//! unsigned USB app bundles. `open` of this Mach-O starts MeDoc the same way
//! the installer button does (no Terminal).

use std::os::unix::process::CommandExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};

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
    let log_path = home()
        .join("Library/Application Support/de.medoc.app/last-launch.log");
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

fn medoc_running() -> bool {
    Command::new("pgrep")
        .args(["-f", "MeDoc.app/Contents/MacOS/medoc"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn resolve_medoc() -> PathBuf {
    if let Ok(me) = std::env::current_exe() {
        if let Some(dir) = me.parent() {
            let next_to_me = dir.join("MeDoc.app/Contents/MacOS/medoc");
            if next_to_me.is_file() {
                return next_to_me;
            }
            // Open MeDoc.app/Contents/MacOS/<this> → Applications/MeDoc.app/...
            if let Some(apps) = dir
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
            {
                let bundled = apps.join("MeDoc.app/Contents/MacOS/medoc");
                if bundled.is_file() {
                    return bundled;
                }
            }
        }
    }
    let user = home().join("Applications/MeDoc.app/Contents/MacOS/medoc");
    if user.is_file() {
        return user;
    }
    PathBuf::from("/Applications/MeDoc.app/Contents/MacOS/medoc")
}

fn home() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
}
