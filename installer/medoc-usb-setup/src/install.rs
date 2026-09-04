//! Run bundled installers and wipe PC temp residue.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::SystemTime;

use medoc_core::error::AppError;
use medoc_core::infrastructure::install_plan::InstallComponent;
use medoc_core::infrastructure::secret_store;
use medoc_core::infrastructure::usb_vault::{self, PAYLOADS_DIR, USB_KIT_DIR};

pub fn payloads_dir(root: &Path) -> PathBuf {
    root.join(USB_KIT_DIR).join(PAYLOADS_DIR)
}

pub fn find_payload(root: &Path, names: &[&str]) -> Option<PathBuf> {
    let dir = payloads_dir(root);
    for name in names {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

pub fn run_practice_installer(root: &Path, silent: bool) -> Result<PathBuf, AppError> {
    let payload = find_payload(
        root,
        &[
            "MeDoc.app",
            "medoc-practice.app",
            "medoc-practice.exe",
            "medoc-practice.nsis",
            "MeDoc_0.1.0_x64-setup.exe",
            "medoc-practice-setup.exe",
            "medoc",
        ],
    )
    .ok_or_else(|| {
        AppError::Validation(
            "practice installer payload missing in medoc-usb/payloads/ (build MeDoc.app first)".into(),
        )
    })?;
    let installed = run_installer(&payload, silent)?;
    Ok(installed.unwrap_or_else(|| installed_practice_target(&payload)))
}

pub fn run_lan_server_install(root: &Path) -> Result<(), AppError> {
    let payload = find_payload(root, &["medoc-server.exe", "medoc-server"])
        .ok_or_else(|| AppError::Validation("medoc-server payload missing".into()))?;
    let dest = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Applications/MeDoc/medoc-server");
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Internal(format!("mkdir server: {e}")))?;
    }
    fs::copy(&payload, &dest)
        .map_err(|e| AppError::Internal(format!("copy server: {e}")))?;
    Ok(())
}

fn run_installer(path: &Path, silent: bool) -> Result<Option<PathBuf>, AppError> {
    if path.extension().and_then(|e| e.to_str()) == Some("app") {
        let dest = install_macos_app_bundle(path)?;
        return Ok(Some(dest));
    }

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    if ext.is_empty() || ext == "medoc" || path.file_name().and_then(|n| n.to_str()) == Some("medoc") {
        let dest = dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Applications/MeDoc/medoc");
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::Internal(format!("mkdir MeDoc: {e}")))?;
        }
        fs::copy(path, &dest).map_err(|e| AppError::Internal(format!("copy medoc: {e}")))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mut perms = fs::metadata(&dest)
                .map_err(|e| AppError::Internal(format!("metadata: {e}")))?
                .permissions();
            perms.set_mode(0o755);
            fs::set_permissions(&dest, perms)
                .map_err(|e| AppError::Internal(format!("chmod: {e}")))?;
        }
        return Ok(Some(dest));
    }
    let status = if ext == "exe" {
        let mut cmd = Command::new(path);
        if silent {
            cmd.arg("/S");
        }
        cmd.status()
    } else if ext == "msi" {
        let mut cmd = Command::new("msiexec");
        cmd.arg("/i").arg(path);
        if silent {
            cmd.arg("/quiet").arg("/norestart");
        }
        cmd.status()
    } else {
        Command::new(path).status()
    }
    .map_err(|e| AppError::Internal(format!("spawn installer: {e}")))?;
    if !status.success() {
        return Err(AppError::Internal(format!(
            "installer exited with {:?}",
            status.code()
        )));
    }
    Ok(None)
}

pub fn install_components(
    root: &Path,
    components: &[InstallComponent],
    silent: bool,
) -> Result<Option<PathBuf>, AppError> {
    let mut practice_target = None;
    for c in components {
        match c {
            InstallComponent::PracticeApp | InstallComponent::WebClient => {
                practice_target = Some(run_practice_installer(root, silent)?);
            }
            InstallComponent::LanServer => run_lan_server_install(root)?,
        }
    }
    Ok(practice_target)
}

pub fn write_plan_sidecar(plan: &medoc_core::infrastructure::install_plan::InstallPlan) -> Result<(), AppError> {
    let dest = usb_vault::default_sidecar_path();
    usb_vault::write_sidecar_plan(plan, &dest)
}

fn macos_user_app_dest(name: &std::ffi::OsStr) -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Applications")
        .join(name)
}

fn ditto_copy(src: &Path, dst: &Path) -> Result<(), AppError> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("mkdir Applications: {e}")))?;
    }
    let status = Command::new("ditto")
        .arg(src)
        .arg(dst)
        .status()
        .map_err(|e| AppError::Internal(format!("ditto: {e}")))?;
    if !status.success() {
        return Err(AppError::Internal(format!(
            "ditto exited with {:?}",
            status.code()
        )));
    }
    #[cfg(target_os = "macos")]
    {
        sanitize_macos_app_bundle(dst);
        let _ = fs::remove_dir_all(dst.join("Contents/_CodeSignature"));
        prepare_macos_app_signature(dst)?;
    }
    Ok(())
}

/// Adhoc-sign the copied bundle. Do not attach `com.apple.quarantine`:
/// Launch Services still refuses `open` on unsigned USB apps, and quarantine
/// only adds the malware sheet that looks like MeDoc “opened then closed”.
#[cfg(target_os = "macos")]
fn prepare_macos_app_signature(app: &Path) -> Result<(), AppError> {
    let sign = Command::new("codesign")
        .args(["--force", "--deep", "--sign", "-"])
        .arg(app)
        .status()
        .map_err(|e| AppError::Internal(format!("codesign: {e}")))?;
    if !sign.success() {
        return Err(AppError::Internal(format!(
            "codesign failed for {}",
            app.display()
        )));
    }
    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(app)
        .status();
    Ok(())
}

#[cfg(target_os = "macos")]
fn sanitize_macos_app_bundle(app: &Path) {
    let plist = app.join("Contents/Info.plist");
    if !plist.exists() {
        return;
    }
    let _ = Command::new("/usr/libexec/PlistBuddy")
        .args(["-c", "Delete :LSRequiresCarbon", &plist.to_string_lossy()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
    // Do not prohibit multiple instances: Finder `open` then kills a spawned
    // medoc process and starts nothing (Gatekeeper), which looks like auto-close.
    let _ = Command::new("/usr/libexec/PlistBuddy")
        .args([
            "-c",
            "Delete :LSMultipleInstancesProhibited",
            &plist.to_string_lossy(),
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Copy the .app into the user Applications folder (always visible in Finder).
/// Also try /Applications when writable so Spotlight/Launchpad pick it up.
fn install_macos_app_bundle(src: &Path) -> Result<PathBuf, AppError> {
    let name = src.file_name().ok_or_else(|| {
        AppError::Validation("practice .app payload has no name".into())
    })?;
    let user_dest = macos_user_app_dest(name);
    ditto_copy(src, &user_dest)?;
    #[cfg(target_os = "macos")]
    write_finder_open_command(user_dest.parent().unwrap_or(user_dest.as_path()), &user_dest);

    let system = PathBuf::from("/Applications").join(name);
    if system_applications_writable() {
        let _ = ditto_copy(src, &system);
        #[cfg(target_os = "macos")]
        write_finder_open_command(Path::new("/Applications"), &system);
    }
    Ok(user_dest)
}

pub fn installed_medoc_app_path() -> PathBuf {
    let user = dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Applications/MeDoc.app");
    if user.join("Contents/MacOS/medoc").is_file() {
        return user;
    }
    PathBuf::from("/Applications/MeDoc.app")
}

fn file_mtime(path: &Path) -> Option<SystemTime> {
    fs::metadata(path).ok()?.modified().ok()
}

fn find_repo_root(start: &Path) -> Option<PathBuf> {
    let mut p = start.to_path_buf();
    if p.is_file() {
        p.pop();
    }
    for _ in 0..10 {
        if p.join("Cargo.toml").is_file() && p.join("apps/practice-host/Cargo.toml").is_file() {
            return Some(p);
        }
        if !p.pop() {
            break;
        }
    }
    None
}

fn cargo_target_dirs(repo: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(d) = std::env::var("CARGO_TARGET_DIR") {
        let p = PathBuf::from(d);
        if p.is_dir() {
            dirs.push(p);
        }
    }
    for rel in ["target", "apps/practice-host/target", "apps/practice-host-ui/src-tauri/target"] {
        let p = repo.join(rel);
        if p.is_dir() {
            dirs.push(p);
        }
    }
    if let Ok(entries) = fs::read_dir(std::env::temp_dir().join("cursor-sandbox-cache")) {
        for e in entries.flatten() {
            let td = e.path().join("cargo-target");
            if td.is_dir() {
                dirs.push(td);
            }
        }
    }
    dirs
}

fn newest_file(candidates: &[PathBuf]) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for p in candidates {
        if !p.is_file() {
            continue;
        }
        let Some(mt) = file_mtime(p) else {
            continue;
        };
        if best.as_ref().map(|(t, _)| mt > *t).unwrap_or(true) {
            best = Some((mt, p.clone()));
        }
    }
    best.map(|(_, p)| p)
}

fn collect_medoc_binaries(repo: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for td in cargo_target_dirs(repo) {
        out.push(td.join("release/medoc"));
        out.push(td.join("debug/medoc"));
        out.push(td.join("release/medoc.exe"));
        out.push(td.join("debug/medoc.exe"));
        out.push(td.join("release/bundle/macos/MeDoc.app/Contents/MacOS/medoc"));
        out.push(td.join("debug/bundle/macos/MeDoc.app/Contents/MacOS/medoc"));
    }
    out
}

fn collect_medoc_apps(repo: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    for td in cargo_target_dirs(repo) {
        out.push(td.join("release/bundle/macos/MeDoc.app"));
        out.push(td.join("debug/bundle/macos/MeDoc.app"));
    }
    out
}

fn newest_medoc_app(repo: &Path) -> Option<PathBuf> {
    let mut best: Option<(SystemTime, PathBuf)> = None;
    for app in collect_medoc_apps(repo) {
        let exe = app.join("Contents/MacOS/medoc");
        let Some(mt) = file_mtime(&exe) else {
            continue;
        };
        if best.as_ref().map(|(t, _)| mt > *t).unwrap_or(true) {
            best = Some((mt, app));
        }
    }
    best.map(|(_, p)| p)
}

fn copy_unix_executable(src: &Path, dst: &Path) -> Result<(), AppError> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("mkdir {}: {e}", parent.display())))?;
    }
    fs::copy(src, dst).map_err(|e| {
        AppError::Internal(format!("copy {} → {}: {e}", src.display(), dst.display()))
    })?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = fs::metadata(dst)
            .map_err(|e| AppError::Internal(format!("metadata {}: {e}", dst.display())))?
            .permissions();
        p.set_mode(0o755);
        fs::set_permissions(dst, p)
            .map_err(|e| AppError::Internal(format!("chmod {}: {e}", dst.display())))?;
    }
    Ok(())
}

/// Replace kit + installed MeDoc with the newest local cargo/tauri compilation.
/// Does not rebuild — uses whatever `medoc` binary was compiled last on this machine.
pub fn update_from_latest_build(kit_root: &Path) -> Result<String, AppError> {
    let repo = find_repo_root(kit_root)
        .or_else(|| find_repo_root(&std::env::current_dir().unwrap_or_else(|_| kit_root.to_path_buf())))
        .ok_or_else(|| {
            AppError::Validation(
                "Could not find the MeDoc repo (Cargo.toml + apps/practice-host). Run USB Setup from the kit next to the source tree, or set --root."
                    .into(),
            )
        })?;

    let bin = newest_file(&collect_medoc_binaries(&repo)).ok_or_else(|| {
        AppError::Validation(format!(
            "No compiled medoc binary under {}. Build first: npm run build -w medoc && cargo build -p medoc --release --features custom-protocol",
            repo.display()
        ))
    })?;
    let bundle = newest_medoc_app(&repo);
    let kit_app = payloads_dir(kit_root).join("MeDoc.app");

    stop_running_medoc_apps();

    let mut updated = Vec::new();

    if let Some(src_app) = bundle.as_ref() {
        if src_app != &kit_app {
            ditto_copy(src_app, &kit_app)?;
            updated.push(format!("kit bundle {}", kit_app.display()));
        }
    }

    let user_app = macos_user_app_dest(std::ffi::OsStr::new("MeDoc.app"));
    let system_app = PathBuf::from("/Applications/MeDoc.app");
    let mut dest_apps: Vec<PathBuf> = Vec::new();
    if kit_app.join("Contents/MacOS").is_dir() || kit_app.join("Contents/MacOS/medoc").is_file() {
        dest_apps.push(kit_app.clone());
    }
    dest_apps.push(user_app);
    if system_app.exists() || system_applications_writable() {
        dest_apps.push(system_app);
    }

    let seed_app = if kit_app.join("Contents/MacOS/medoc").is_file() {
        Some(kit_app.clone())
    } else {
        bundle.clone()
    };

    for dest in dest_apps {
        if dest.join("Contents/MacOS/medoc").is_file() {
            copy_unix_executable(&bin, &dest.join("Contents/MacOS/medoc"))?;
            #[cfg(target_os = "macos")]
            prepare_macos_app_signature(&dest)?;
            updated.push(format!("{}", dest.display()));
            continue;
        }
        if let Some(src) = seed_app.as_ref() {
            if src.exists() && src != &dest {
                ditto_copy(src, &dest)?;
                copy_unix_executable(&bin, &dest.join("Contents/MacOS/medoc"))?;
                #[cfg(target_os = "macos")]
                prepare_macos_app_signature(&dest)?;
                updated.push(format!("{}", dest.display()));
            }
        }
    }

    if updated.is_empty() {
        return Err(AppError::Validation(
            "No MeDoc.app to update. Install MeDoc first, or run: npm run tauri build -w medoc -- --bundles app"
                .into(),
        ));
    }

    let raw_payload = payloads_dir(kit_root).join("medoc");
    let _ = copy_unix_executable(&bin, &raw_payload);

    let mut server_candidates = Vec::new();
    for td in cargo_target_dirs(&repo) {
        server_candidates.push(td.join("release/medoc-server"));
        server_candidates.push(td.join("debug/medoc-server"));
    }
    if let Some(server) = newest_file(&server_candidates) {
        let dest = payloads_dir(kit_root).join("medoc-server");
        copy_unix_executable(&server, &dest)?;
        updated.push(format!("server {}", dest.display()));
    }

    let kind = if bin.components().any(|c| c.as_os_str() == "debug") {
        "debug"
    } else {
        "release"
    };
    Ok(format!(
        "Updated from {kind} binary {} → {}",
        bin.display(),
        updated.join("; ")
    ))
}

/// Copy the nohup helper next to MeDoc.app. Finder double-click of a Unix file
/// still uses Terminal on macOS; the installer Open MeDoc button does not.
#[cfg(target_os = "macos")]
fn write_finder_open_command(dir: &Path, app: &Path) {
    let _ = fs::remove_file(dir.join("Open MeDoc.command"));
    let _ = fs::remove_dir_all(dir.join("Open MeDoc.app"));
    let dest = dir.join("Open MeDoc");
    let Some(src) = finder_open_helper_src() else {
        return;
    };
    let _ = fs::copy(&src, &dest);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = fs::metadata(&dest) {
            let mut p = meta.permissions();
            p.set_mode(0o755);
            let _ = fs::set_permissions(&dest, p);
        }
    }
    let _ = Command::new("xattr")
        .args(["-dr", "com.apple.quarantine"])
        .arg(&dest)
        .status();
    let _ = Command::new("chflags").args(["hidden"]).arg(app).status();
}

#[cfg(target_os = "macos")]
fn finder_open_helper_src() -> Option<PathBuf> {
    let here = std::env::current_exe().ok()?.parent()?.to_path_buf();
    for name in ["OpenMeDoc", "medoc-finder-open"] {
        let p = here.join(name);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn system_applications_writable() -> bool {
    PathBuf::from("/Applications").is_dir()
        && std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open("/Applications/.medoc-write-probe")
            .map(|f| {
                drop(f);
                let _ = fs::remove_file("/Applications/.medoc-write-probe");
                true
            })
            .unwrap_or(false)
}

/// Remove MeDoc from this computer (apps, data, caches, keychain). Does not touch the USB kit.
pub fn wipe_this_computer() -> Result<Vec<String>, AppError> {
    stop_running_medoc();
    let mut removed = Vec::new();
    removed.push("stopped MeDoc, medoc-server, and LAN/cluster ports 8787/47830/49300".into());
    for path in wipe_target_paths() {
        if !path.exists() {
            continue;
        }
        let label = path.display().to_string();
        let result = if path.is_dir() {
            fs::remove_dir_all(&path)
        } else {
            fs::remove_file(&path)
        };
        match result {
            Ok(()) => removed.push(label),
            Err(e) => removed.push(format!("FAILED {label}: {e}")),
        }
    }
    for account in [
        "sqlcipher-key",
        "audit-hmac-key",
        "lan-jwt-secret",
        "cluster-device-signing-key",
        "pairing-master-signing-key",
    ] {
        secret_store::delete_account(account)?;
        removed.push(format!("keychain:{account}"));
    }
    Ok(removed)
}

fn wipe_target_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join("Applications/MeDoc.app"));
        paths.push(home.join("Applications/Open MeDoc"));
        paths.push(home.join("Applications/Open MeDoc.command"));
        paths.push(home.join("Applications/Open MeDoc.app"));
        paths.push(home.join("Applications/MeDoc"));
        #[cfg(target_os = "macos")]
        {
            let lib = home.join("Library");
            paths.push(lib.join("Caches/de.medoc.app"));
            paths.push(lib.join("Logs/de.medoc.app"));
            paths.push(lib.join("WebKit/de.medoc.app"));
            paths.push(lib.join("HTTPStorages/de.medoc.app"));
            paths.push(lib.join("Saved Application State/de.medoc.app.savedState"));
            paths.push(lib.join("Preferences/de.medoc.app.plist"));
        }
        #[cfg(target_os = "windows")]
        {
            paths.push(home.join("AppData/Local/de.medoc.app"));
            paths.push(home.join("AppData/Roaming/de.medoc.app"));
        }
    }
    paths.push(PathBuf::from("/Applications/MeDoc.app"));
    paths.push(PathBuf::from("/Applications/Open MeDoc"));
    paths.push(PathBuf::from("/Applications/Open MeDoc.command"));
    paths.push(PathBuf::from("/Applications/Open MeDoc.app"));
    paths.push(usb_vault::practice_app_data_dir());
    paths.push(usb_vault::legacy_sidecar_dir());
    paths
}

pub(crate) fn stop_running_medoc_apps() {
    stop_running_medoc();
}

fn stop_running_medoc() {
    #[cfg(target_os = "macos")]
    {
        for name in ["medoc", "medoc-server", "medoc-lan-server"] {
            let _ = Command::new("killall").args(["-9", name]).status();
        }
        for pat in [
            "MeDoc.app/Contents/MacOS/medoc",
            "Applications/MeDoc/medoc-server",
            "Applications/MeDoc/medoc",
            "payloads/medoc-server",
        ] {
            let _ = Command::new("pkill").args(["-9", "-f", pat]).status();
        }
        for port in [8787_u16, 47_830, 49_300] {
            kill_listeners_on_port(port);
        }
    }
    #[cfg(target_os = "windows")]
    {
        for image in ["medoc.exe", "medoc-server.exe", "medoc-lan-server.exe"] {
            let _ = Command::new("taskkill")
                .args(["/F", "/IM", image])
                .status();
        }
    }
    std::thread::sleep(std::time::Duration::from_millis(500));
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("killall").args(["-9", "medoc"]).status();
        let _ = Command::new("killall").args(["-9", "medoc-server"]).status();
        for port in [8787_u16, 47_830, 49_300] {
            kill_listeners_on_port(port);
        }
    }
}

#[cfg(target_os = "macos")]
fn kill_listeners_on_port(port: u16) {
    let Ok(out) = Command::new("lsof")
        .args(["-ti", &format!("tcp:{port}")])
        .output()
    else {
        return;
    };
    for pid in String::from_utf8_lossy(&out.stdout).split_whitespace() {
        let _ = Command::new("kill").args(["-9", pid]).status();
    }
}

fn installed_practice_target(payload: &Path) -> PathBuf {
    if payload.extension().and_then(|e| e.to_str()) == Some("app") {
        return macos_user_app_dest(payload.file_name().unwrap_or_default());
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Applications/MeDoc/medoc")
}

pub fn launch_practice_app(installed: &Path) -> Result<(), AppError> {
    if !installed.exists() {
        return Err(AppError::Validation(format!(
            "installed app not found at {}",
            installed.display()
        )));
    }
    #[cfg(target_os = "macos")]
    {
        let app = if installed.extension().and_then(|e| e.to_str()) == Some("app") {
            installed.to_path_buf()
        } else if installed.join("Contents/MacOS/medoc").is_file() {
            installed.to_path_buf()
        } else {
            installed
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| installed.to_path_buf())
        };
        if macos_medoc_running() {
            macos_activate_medoc();
            return Ok(());
        }
        macos_spawn_medoc(&app)?;
        #[cfg(target_os = "macos")]
        {
            if let Some(parent) = app.parent() {
                write_finder_open_command(parent, &app);
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(800));
        if !macos_medoc_running() {
            return Err(AppError::Internal(
                "MeDoc started then exited. Check last-launch.log in Application Support/de.medoc.app."
                    .into(),
            ));
        }
        macos_activate_medoc();
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new(installed)
            .spawn()
            .map_err(|e| AppError::Internal(format!("launch MeDoc: {e}")))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new(installed)
            .spawn()
            .map_err(|e| AppError::Internal(format!("launch MeDoc: {e}")))?;
        Ok(())
    }
}

/// Launch Services `open MeDoc.app` exits 0 with no process on unsigned USB
/// copies. Start the Mach-O directly so the window can stay open.
#[cfg(target_os = "macos")]
fn macos_spawn_medoc(app: &Path) -> Result<(), AppError> {
    let exe = app.join("Contents/MacOS/medoc");
    if !exe.is_file() {
        return Err(AppError::Validation(format!(
            "MeDoc binary missing at {}",
            exe.display()
        )));
    }
    let log_path = usb_vault::practice_app_data_dir().join("last-launch.log");
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let log = fs::File::create(&log_path)
        .map_err(|e| AppError::Internal(format!("create last-launch.log: {e}")))?;
    let err = log
        .try_clone()
        .map_err(|e| AppError::Internal(format!("clone last-launch.log: {e}")))?;
    let mut cmd = Command::new("/usr/bin/nohup");
    cmd.arg(&exe);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::from(log))
        .stderr(Stdio::from(err));
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    cmd.spawn()
        .map_err(|e| AppError::Internal(format!("start MeDoc: {e}")))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn macos_medoc_running() -> bool {
    Command::new("pgrep")
        .args(["-f", "MeDoc.app/Contents/MacOS/medoc"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn macos_activate_medoc() {
    let _ = Command::new("osascript")
        .args([
            "-e",
            r#"tell application "System Events" to set frontmost of (first process whose name is "medoc") to true"#,
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

pub struct TempGuard {
    pub path: PathBuf,
}

impl TempGuard {
    pub fn new() -> Self {
        Self {
            path: usb_vault::make_temp_extract_dir(),
        }
    }
}

impl Drop for TempGuard {
    fn drop(&mut self) {
        let _ = usb_vault::wipe_temp_dir(&self.path);
    }
}
