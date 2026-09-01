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

pub fn run_practice_installer(root: &Path, silent: bool) -> Result<(), AppError> {
    let payload = find_payload(
        root,
        &[
            "medoc-practice.exe",
            "medoc-practice.nsis",
            "MeDoc_0.1.0_x64-setup.exe",
            "medoc-practice-setup.exe",
        ],
    )
    .ok_or_else(|| {
        AppError::Validation(
            "practice installer payload missing in medoc-usb/payloads/".into(),
        )
    })?;
    run_installer(&payload, silent)
}

pub fn run_lan_server_install(root: &Path) -> Result<(), AppError> {
    let payload = find_payload(root, &["medoc-server.exe", "medoc-server"])
        .ok_or_else(|| AppError::Validation("medoc-server payload missing".into()))?;
    let dest = PathBuf::from(r"C:\Program Files\MeDoc\medoc-server.exe");
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Internal(format!("mkdir server: {e}")))?;
    }
    fs::copy(&payload, &dest)
        .map_err(|e| AppError::Internal(format!("copy server: {e}")))?;
    Ok(())
}

fn run_installer(path: &Path, silent: bool) -> Result<(), AppError> {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
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
) -> Result<(), AppError> {
    for c in components {
        match c {
            InstallComponent::PracticeApp | InstallComponent::WebClient => {
                run_practice_installer(root, silent)?;
            }
            InstallComponent::LanServer => run_lan_server_install(root)?,
        }
    }
    Ok(())
}

pub fn write_plan_sidecar(plan: &medoc_core::infrastructure::install_plan::InstallPlan) -> Result<(), AppError> {
    usb_vault::write_sidecar_plan(plan, &usb_vault::default_sidecar_path())
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
