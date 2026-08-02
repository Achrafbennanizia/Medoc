//! Launch locally installed OS tools for scanning and (via Tauri Webview) printing.
//! Scanning still uses a watch folder (`scanner::list_recent`) — this module opens
//! the vendor/system UI so the operator can acquire an image into that folder.

use crate::error::AppError;
use crate::log_device;

/// Opens the default system scan capture UI for the current platform.
pub fn open_system_scan_utility() -> Result<(), AppError> {
    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("open")
            .args(["-a", "Image Capture"])
            .status()
            .map_err(|e| AppError::Internal(format!("Start scanner program: {e}")))?;
        if !status.success() {
            return Err(AppError::Internal(
                "Could not start Image Capture.".into(),
            ));
        }
        log_device!(
            info,
            event = "HOST_SCAN_UI_OPENED",
            platform = "macos",
            app = "Image Capture"
        );
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        // Windows Fax and Scan / modern scan UI (URI handler).
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "ms-scan:"])
            .spawn()
            .map_err(|e| AppError::Internal(format!("Start scanner program: {e}")))?;
        log_device!(
            info,
            event = "HOST_SCAN_UI_OPENED",
            platform = "windows",
            app = "ms-scan"
        );
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        for app in ["simple-scan", "skanlite", "xsane", "gscan2pdf"] {
            match std::process::Command::new(app).spawn() {
                Ok(_) => {
                    log_device!(
                        info,
                        event = "HOST_SCAN_UI_OPENED",
                        platform = "linux",
                        app = app
                    );
                    return Ok(());
                }
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
                Err(e) => return Err(AppError::Internal(format!("{app}: {e}"))),
            }
        }
        Err(AppError::Validation(
            "No compatible scan program found (e.g. simple-scan). Please install one or place files manually in the watch folder.".into(),
        ))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        Err(AppError::Validation(
            "System scanner is not supported on this platform.".into(),
        ))
    }
}
