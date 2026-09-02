//! Run bundled installers and wipe PC temp residue.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use medoc_core::error::AppError;
use medoc_core::infrastructure::install_plan::InstallComponent;
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
    run_installer(&payload, silent)?;
    Ok(installed_practice_target(&payload))
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

fn run_installer(path: &Path, silent: bool) -> Result<(), AppError> {
    if path.extension().and_then(|e| e.to_str()) == Some("app") {
        let name = path.file_name().unwrap_or_default();
        let dest = macos_app_install_dest(name);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| AppError::Internal(format!("mkdir Applications: {e}")))?;
        }
        // Overlay copy — do not delete a running MeDoc.app (second install / open).
        if let Err(e) = copy_dir_all(path, &dest) {
            if dest.starts_with("/Applications") {
                let fallback = dirs::home_dir()
                    .unwrap_or_else(|| PathBuf::from("."))
                    .join("Applications")
                    .join(name);
                if let Some(parent) = fallback.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|err| AppError::Internal(format!("mkdir user Applications: {err}")))?;
                }
                copy_dir_all(path, &fallback)?;
                return Ok(());
            }
            return Err(e);
        }
        return Ok(());
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
        return Ok(());
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
    Ok(())
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

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), AppError> {
    fs::create_dir_all(dst).map_err(|e| AppError::Internal(format!("mkdir: {e}")))?;
    for entry in fs::read_dir(src).map_err(|e| AppError::Internal(format!("read_dir: {e}")))? {
        let entry = entry.map_err(|e| AppError::Internal(format!("dir entry: {e}")))?;
        let ty = entry
            .file_type()
            .map_err(|e| AppError::Internal(format!("file_type: {e}")))?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| AppError::Internal(format!("copy: {e}")))?;
        }
    }
    Ok(())
}

pub fn write_plan_sidecar(plan: &medoc_core::infrastructure::install_plan::InstallPlan) -> Result<(), AppError> {
    let dest = usb_vault::default_sidecar_path();
    usb_vault::write_sidecar_plan(plan, &dest)
}

fn macos_app_install_dest(name: &std::ffi::OsStr) -> PathBuf {
    let system = PathBuf::from("/Applications").join(name);
    if system_applications_writable() {
        return system;
    }
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Applications")
        .join(name)
}

fn system_applications_writable() -> bool {
    PathBuf::from("/Applications").is_dir()
        && std::fs::metadata("/Applications")
            .map(|m| !m.permissions().readonly())
            .unwrap_or(false)
}

fn installed_practice_target(payload: &Path) -> PathBuf {
    if payload.extension().and_then(|e| e.to_str()) == Some("app") {
        return macos_app_install_dest(payload.file_name().unwrap_or_default());
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
        let status = Command::new("open")
            .arg(installed)
            .status()
            .map_err(|e| AppError::Internal(format!("launch MeDoc: {e}")))?;
        if !status.success() {
            return Err(AppError::Internal(format!(
                "open exited with {:?}",
                status.code()
            )));
        }
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
