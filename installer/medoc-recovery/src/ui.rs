//! Small native recovery window (same stack as MeDoc USB Setup).
//! Auto-discovers kit/vendor files and stores vendor materials under MeDocRecovery/.

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText, Vec2};

use crate::export::{write_recovery_file, ExportFormat};
use crate::password::{self, Account};
use crate::store::{self, StoredPaths};
use crate::ui_i18n::{self, Locale, Msg};
use crate::{recover, Bridge, RecoverRequest};
use zeroize::Zeroizing;

mod password_reset;
use password_reset::*;

mod window;
use window::*;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn run() -> Result<(), String> {
    let instance =
        single_instance::SingleInstance::new("de.medoc.recovery-ui").map_err(|e| e.to_string())?;
    if !instance.is_single() {
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("osascript")
                .args([
                    "-e",
                    r#"tell application "System Events" to set frontmost of (first process whose name contains "MedocRecovery") to true"#,
                ])
                .status();
        }
        eprintln!("MeDoc Recovery is already open — brought that window forward.");
        return Ok(());
    }
    std::mem::forget(instance);

    let native = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size(Vec2::new(580.0, 820.0))
            .with_min_inner_size(Vec2::new(440.0, 480.0))
            .with_title("MeDoc Recovery"),
        ..Default::default()
    };
    let app = RecoveryApp::new();
    eframe::run_native("MeDoc Recovery", native, Box::new(|_cc| Ok(Box::new(app))))
        .map_err(|e| e.to_string())
}

struct RecoveryApp {
    locale: Locale,
    store_root: String,
    bridge_idx: usize,
    passphrase: String,
    wrap_passphrase: String,
    manifest: String,
    app_dir: String,
    practice_share: String,
    vendor_share: String,
    vendor_sk: String,
    write_wrap_dir: String,
    do_write_wrap: bool,
    verify_db: String,
    do_verify: bool,
    export_path: String,
    export_format_idx: usize,
    do_export: bool,
    export_include_key: bool,
    status_text: String,
    log: String,
    last_kcv: String,
    busy: bool,
    // Login password reset (after a successful recover).
    recovered: Option<(Zeroizing<Vec<u8>>, String)>,
    practice_dir: String,
    accounts: Vec<Account>,
    account_idx: usize,
    new_login_pw: String,
    new_login_pw2: String,
}

impl RecoveryApp {
    fn new() -> Self {
        let desktop = dirs::desktop_dir()
            .or_else(dirs::home_dir)
            .unwrap_or_else(|| PathBuf::from("."));
        let export_default = desktop.join("medoc-recovery-result.json");
        let mut app = Self {
            locale: Locale::En,
            store_root: store::store_root().display().to_string(),
            bridge_idx: 2,
            passphrase: String::new(),
            wrap_passphrase: String::new(),
            manifest: String::new(),
            app_dir: String::new(),
            practice_share: String::new(),
            vendor_share: String::new(),
            vendor_sk: String::new(),
            write_wrap_dir: String::new(),
            do_write_wrap: true,
            verify_db: String::new(),
            do_verify: false,
            export_path: export_default.display().to_string(),
            export_format_idx: 0,
            do_export: true,
            export_include_key: false,
            status_text: String::new(),
            log: String::new(),
            last_kcv: String::new(),
            busy: false,
            recovered: None,
            practice_dir: String::new(),
            accounts: Vec::new(),
            account_idx: 0,
            new_login_pw: String::new(),
            new_login_pw2: String::new(),
        };
        app.apply_scan(store::rescan());
        app
    }

    fn apply_scan(&mut self, paths: StoredPaths) {
        self.store_root = store::store_root().display().to_string();
        fill_if_found(&mut self.manifest, paths.manifest.as_deref());
        fill_if_found(&mut self.practice_share, paths.practice_share.as_deref());
        fill_if_found(&mut self.vendor_share, paths.vendor_share.as_deref());
        fill_if_found(&mut self.vendor_sk, paths.vendor_sk.as_deref());
        fill_if_found(&mut self.app_dir, paths.app_dir.as_deref());
        fill_if_found(&mut self.write_wrap_dir, paths.write_wrap_dir.as_deref());
        fill_if_found(&mut self.verify_db, paths.verify_db.as_deref());

        let mut msg = format!("Store: {}\n", self.store_root);
        if paths.last_scan_notes.is_empty() {
            msg.push_str("Rescan done — no kit/vendor files found yet.");
        } else {
            msg.push_str(&paths.last_scan_notes.join("\n"));
        }
        msg.push_str(
            "\n\nVendor: put vendor-recovery.sk in store/vendor/ (replace file to rotate).",
        );
        self.status_text = msg.clone();
        self.push_log(&msg);
    }

    fn bridge(&self) -> Bridge {
        match self.bridge_idx {
            0 => Bridge::A,
            1 => Bridge::B,
            _ => Bridge::C,
        }
    }

    fn export_format(&self) -> ExportFormat {
        ExportFormat::all()
            .get(self.export_format_idx)
            .copied()
            .unwrap_or(ExportFormat::Json)
    }

    fn push_log(&mut self, line: &str) {
        if !self.log.is_empty() {
            self.log.push('\n');
        }
        self.log.push_str(line);
    }

    fn sync_export_extension(&mut self) {
        let fmt = self.export_format();
        let path = PathBuf::from(&self.export_path);
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("medoc-recovery-result");
        let parent = path
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| PathBuf::from("."));
        self.export_path = parent
            .join(format!("{stem}.{}", fmt.extension()))
            .display()
            .to_string();
    }

    fn open_store_folder(&self) {
        let root = store::store_root();
        let _ = store::ensure_store(&root);
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&root).status();
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(&root).status();
        }
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("explorer").arg(&root).status();
        }
    }

    /// If the user typed an external path, copy it into the store and retarget the field.
    fn persist_vendor_fields_to_store(&mut self) {
        let jobs = [
            (
                self.vendor_sk.clone(),
                store::StoreKind::VendorSk,
                "vendor-recovery.sk",
            ),
            (
                self.vendor_share.clone(),
                store::StoreKind::VendorShare,
                "vendor share",
            ),
            (
                self.practice_share.clone(),
                store::StoreKind::PracticeShare,
                "practice share",
            ),
            (
                self.manifest.clone(),
                store::StoreKind::Activation,
                "activation.json",
            ),
        ];
        let store_root = store::store_root();
        let mut notes = Vec::new();
        for (value, kind, label) in jobs {
            let src = PathBuf::from(value.trim());
            if src.as_os_str().is_empty() || !src.is_file() || src.starts_with(&store_root) {
                continue;
            }
            match store::install_into_store(&src, kind) {
                Ok(dest) => {
                    let dest_s = dest.display().to_string();
                    match kind {
                        store::StoreKind::VendorSk => self.vendor_sk = dest_s,
                        store::StoreKind::VendorPk => {}
                        store::StoreKind::VendorShare => self.vendor_share = dest_s,
                        store::StoreKind::PracticeShare => self.practice_share = dest_s,
                        store::StoreKind::Activation => self.manifest = dest_s,
                    }
                    notes.push(format!("updated store {label} ← {}", src.display()));
                }
                Err(e) => notes.push(format!("could not store {label}: {e}")),
            }
        }
        if !notes.is_empty() {
            let msg = notes.join("\n");
            self.push_log(&msg);
        }
    }

    fn run_recover(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        self.persist_vendor_fields_to_store();

        let bridge = self.bridge();
        let mut req = RecoverRequest {
            bridge: Some(bridge),
            ..Default::default()
        };

        match bridge {
            Bridge::A => {
                if self.manifest.trim().is_empty() || self.passphrase.is_empty() {
                    self.status_text = "Bridge A needs activation.json path and passphrase.".into();
                    self.busy = false;
                    return;
                }
                req.manifest = Some(PathBuf::from(self.manifest.trim()));
                req.passphrase = Some(self.passphrase.clone());
            }
            Bridge::B => {
                if self.app_dir.trim().is_empty() || self.passphrase.is_empty() {
                    self.status_text =
                        "Bridge B needs app-data directory and wrap passphrase.".into();
                    self.busy = false;
                    return;
                }
                req.app_dir = Some(PathBuf::from(self.app_dir.trim()));
                req.passphrase = Some(self.passphrase.clone());
            }
            Bridge::C => {
                if self.practice_share.trim().is_empty()
                    || self.vendor_share.trim().is_empty()
                    || self.vendor_sk.trim().is_empty()
                {
                    self.status_text =
                        "Bridge C needs practice share, vendor share, and vendor-recovery.sk.\nClick Rescan or drop files into the store folder.".into();
                    self.busy = false;
                    return;
                }
                req.practice_share = Some(PathBuf::from(self.practice_share.trim()));
                req.vendor_share = Some(PathBuf::from(self.vendor_share.trim()));
                req.vendor_sk = Some(PathBuf::from(self.vendor_sk.trim()));
            }
        }

        if self.do_write_wrap {
            if self.write_wrap_dir.trim().is_empty() {
                self.status_text = "Write-wrap is on — set an app-data directory.".into();
                self.busy = false;
                return;
            }
            let wrap_pw = if !self.wrap_passphrase.is_empty() {
                self.wrap_passphrase.clone()
            } else if !self.passphrase.is_empty() {
                self.passphrase.clone()
            } else {
                self.status_text =
                    "Set a new wrap passphrase (or Bridge A/B passphrase) before writing wrap."
                        .into();
                self.busy = false;
                return;
            };
            req.write_wrap_dir = Some(PathBuf::from(self.write_wrap_dir.trim()));
            req.wrap_passphrase = Some(wrap_pw);
        }

        if self.do_verify {
            if self.verify_db.trim().is_empty() {
                self.status_text = "Verify DB is on — set medoc.db path.".into();
                self.busy = false;
                return;
            }
            req.verify_db = Some(PathBuf::from(self.verify_db.trim()));
        }

        match recover(&req) {
            Ok((key, mut result)) => {
                self.last_kcv = result.kcv_b64.clone();
                self.recovered = Some((Zeroizing::new(key.to_vec()), result.bridge.clone()));
                if self.practice_dir.trim().is_empty() {
                    let guess = [&self.app_dir, &self.write_wrap_dir]
                        .into_iter()
                        .map(|d| d.trim())
                        .find(|d| !d.is_empty() && password::practice_db(d.as_ref()).is_file());
                    if let Some(d) = guess {
                        self.practice_dir = d.to_string();
                    }
                }
                if !self.practice_dir.trim().is_empty() {
                    self.load_accounts();
                }
                let mut msg = format!(
                    "Recover OK (bridge {}). KCV {}",
                    result.bridge, result.kcv_b64
                );
                if let Some(ref w) = result.wrap_written {
                    msg.push_str(&format!("\nWrote wrap under {w}"));
                }
                if let Some(ref v) = result.verify_db {
                    msg.push_str(&format!("\nverify-db: {v}"));
                }

                if self.do_export {
                    if self.export_path.trim().is_empty() {
                        self.status_text = "Export is on — set an output file path.".into();
                        self.busy = false;
                        return;
                    }
                    if self.export_include_key {
                        result.key_hex = Some(hex::encode(&*key));
                        msg.push_str("\nWARNING: export includes plaintext key_hex");
                    }
                    let fmt = self.export_format();
                    match write_recovery_file(
                        PathBuf::from(self.export_path.trim()).as_path(),
                        &result,
                        fmt,
                    ) {
                        Ok(()) => {
                            msg.push_str(&format!(
                                "\nCreated {} ({})",
                                self.export_path.trim(),
                                fmt.as_str()
                            ));
                        }
                        Err(e) => {
                            msg.push_str(&format!("\nExport failed: {e:#}"));
                        }
                    }
                }

                self.status_text = msg.clone();
                self.push_log(&msg);
            }
            Err(e) => {
                let err = format!("Recover failed: {e:#}");
                self.status_text = err.clone();
                self.push_log(&err);
            }
        }
        self.busy = false;
    }
}
