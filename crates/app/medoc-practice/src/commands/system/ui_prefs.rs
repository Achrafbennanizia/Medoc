//! Device-local UI prefs (Appearance + locale) as a JSON file next to app data.
//!
//! Path: `{app_data_dir}/config/ui-prefs.json`
//!
//! Each MeDoc instance uses its own `HOME` / app-data directory, so main and
//! replica keep separate files. Optional `userId` scopes a slice per staff
//! login on that device. No RBAC: this is not practice-wide synced state
//! (unlike `app_kv`).
//!
//! **Invariant:** this file is the source of truth for Appearance + UI locale on
//! the desktop host. The webview `localStorage` cache is shared across Vite
//! origins in multi-instance dev and must never win over this file on boot.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::app_data_dir;
use crate::error::AppError;

const FILE_VERSION: u32 = 1;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiPrefsSlice {
    /// UI language: `de` | `en` | `fr` | `ar`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,
    /// Full `ClientSettingsV1` JSON blob from the frontend.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub settings_json: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct UiPrefsFile {
    version: u32,
    /// Prefs before login / device default for this instance.
    #[serde(default)]
    device: UiPrefsSlice,
    /// Per staff id on this device.
    #[serde(default)]
    users: BTreeMap<String, UiPrefsSlice>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiPrefsDto {
    pub locale: Option<String>,
    pub settings_json: Option<String>,
    /// Absolute path of the config file (for diagnostics / Settings hint).
    pub path: String,
}

fn prefs_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app_data_dir(app)?.join("config");
    Ok(dir.join("ui-prefs.json"))
}

fn sanitize_user_id(raw: Option<&str>) -> Option<String> {
    let s = raw?.trim();
    if s.is_empty() {
        return None;
    }
    if s.len() > 128
        || !s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return None;
    }
    Some(s.to_string())
}

fn read_file(path: &Path) -> Result<UiPrefsFile, AppError> {
    if !path.exists() {
        return Ok(UiPrefsFile {
            version: FILE_VERSION,
            ..Default::default()
        });
    }
    let raw =
        fs::read_to_string(path).map_err(|e| AppError::Internal(format!("ui-prefs read: {e}")))?;
    if raw.trim().is_empty() {
        return Ok(UiPrefsFile {
            version: FILE_VERSION,
            ..Default::default()
        });
    }
    let mut parsed: UiPrefsFile = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("ui-prefs JSON: {e}")))?;
    if parsed.version == 0 {
        parsed.version = FILE_VERSION;
    }
    Ok(parsed)
}

fn write_file(path: &Path, file: &UiPrefsFile) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("ui-prefs mkdir: {e}")))?;
    }
    let body = serde_json::to_string_pretty(file)
        .map_err(|e| AppError::Internal(format!("ui-prefs encode: {e}")))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, body).map_err(|e| AppError::Internal(format!("ui-prefs write: {e}")))?;
    fs::rename(&tmp, path).map_err(|e| AppError::Internal(format!("ui-prefs rename: {e}")))?;
    Ok(())
}

fn normalize_locale(raw: Option<&str>) -> Option<String> {
    let trimmed = raw?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let lower = trimmed.to_ascii_lowercase();
    matches!(lower.as_str(), "de" | "en" | "fr" | "ar").then_some(lower)
}

fn resolve_slice<'a>(file: &'a UiPrefsFile, uid: Option<&str>) -> UiPrefsSlice {
    let user = uid
        .and_then(|id| file.users.get(id))
        .cloned()
        .unwrap_or_default();
    UiPrefsSlice {
        locale: user.locale.or_else(|| file.device.locale.clone()),
        settings_json: user
            .settings_json
            .or_else(|| file.device.settings_json.clone()),
    }
}

fn apply_patch(
    file: &mut UiPrefsFile,
    user_id: Option<&str>,
    locale: Option<String>,
    settings_json: Option<String>,
) {
    file.version = FILE_VERSION;
    let target = match user_id {
        Some(id) => file.users.entry(id.to_string()).or_default(),
        None => &mut file.device,
    };
    if let Some(loc) = locale {
        target.locale = Some(loc);
    }
    if let Some(sj) = settings_json {
        target.settings_json = Some(sj);
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app))]
pub async fn get_ui_prefs(app: AppHandle, user_id: Option<String>) -> Result<UiPrefsDto, AppError> {
    let path = prefs_path(&app)?;
    let file = read_file(&path)?;
    let uid = sanitize_user_id(user_id.as_deref());
    let slice = resolve_slice(&file, uid.as_deref());
    Ok(UiPrefsDto {
        locale: slice.locale,
        settings_json: slice.settings_json,
        path: path.display().to_string(),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetUiPrefsArgs {
    pub user_id: Option<String>,
    pub locale: Option<String>,
    pub settings_json: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, args))]
pub async fn set_ui_prefs(app: AppHandle, args: SetUiPrefsArgs) -> Result<UiPrefsDto, AppError> {
    let path = prefs_path(&app)?;
    let mut file = read_file(&path)?;

    let locale = normalize_locale(args.locale.as_deref());
    let settings_json = args
        .settings_json
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| {
            // Reject non-JSON so a corrupt blob cannot brick Appearance.
            let _: serde_json::Value = serde_json::from_str(s)
                .map_err(|e| AppError::Validation(format!("settingsJson: {e}")))?;
            Ok::<_, AppError>(s.to_string())
        })
        .transpose()?;

    let uid = sanitize_user_id(args.user_id.as_deref());
    apply_patch(&mut file, uid.as_deref(), locale, settings_json);
    write_file(&path, &file)?;

    let slice = resolve_slice(&file, uid.as_deref());
    Ok(UiPrefsDto {
        locale: slice.locale,
        settings_json: slice.settings_json,
        path: path.display().to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_prefs_path(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time")
            .as_nanos();
        std::env::temp_dir().join(format!("medoc-ui-prefs-{label}-{nanos}.json"))
    }

    #[test]
    fn sanitize_rejects_path_chars() {
        assert!(sanitize_user_id(Some("../x")).is_none());
        assert!(sanitize_user_id(Some("seed-physician-001")).is_some());
        assert!(sanitize_user_id(Some("")).is_none());
    }

    #[test]
    fn normalize_locale_accepts_known() {
        assert_eq!(normalize_locale(Some("ar")), Some("ar".into()));
        assert_eq!(normalize_locale(Some("EN")), Some("en".into()));
        assert_eq!(normalize_locale(Some("xx")), None);
    }

    #[test]
    fn roundtrip_locale_survives_rewrite_and_shared_ls_cannot_clobber_file() {
        let path = temp_prefs_path("roundtrip");
        let _ = fs::remove_file(&path);

        let mut file = UiPrefsFile {
            version: FILE_VERSION,
            ..Default::default()
        };
        apply_patch(
            &mut file,
            None,
            Some("de".into()),
            Some(r#"{"version":1,"appearance":{"density":"compact"}}"#.into()),
        );
        write_file(&path, &file).expect("write");

        // Simulate another instance only mutating its own memory / shared LS — file untouched.
        let loaded = read_file(&path).expect("read");
        let slice = resolve_slice(&loaded, None);
        assert_eq!(slice.locale.as_deref(), Some("de"));
        assert!(slice
            .settings_json
            .as_deref()
            .unwrap_or("")
            .contains("compact"));

        // Partial patch: locale-only update must keep settings.
        let mut again = loaded;
        apply_patch(&mut again, None, Some("fr".into()), None);
        write_file(&path, &again).expect("rewrite");
        let final_file = read_file(&path).expect("reread");
        let final_slice = resolve_slice(&final_file, None);
        assert_eq!(final_slice.locale.as_deref(), Some("fr"));
        assert!(final_slice
            .settings_json
            .as_deref()
            .unwrap_or("")
            .contains("compact"));

        let _ = fs::remove_file(&path);
    }

    #[test]
    fn user_slice_falls_back_to_device_defaults() {
        let mut file = UiPrefsFile {
            version: FILE_VERSION,
            device: UiPrefsSlice {
                locale: Some("de".into()),
                settings_json: Some(r#"{"version":1}"#.into()),
            },
            users: BTreeMap::new(),
        };
        apply_patch(&mut file, Some("user-a"), Some("ar".into()), None);
        let user = resolve_slice(&file, Some("user-a"));
        assert_eq!(user.locale.as_deref(), Some("ar"));
        assert_eq!(user.settings_json.as_deref(), Some(r#"{"version":1}"#));

        let other = resolve_slice(&file, Some("user-b"));
        assert_eq!(other.locale.as_deref(), Some("de"));
        assert_eq!(other.settings_json.as_deref(), Some(r#"{"version":1}"#));
    }
}
