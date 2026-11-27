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
}

mod actions;
mod recover;

fn fill_if_found(field: &mut String, value: Option<&str>) {
    if let Some(v) = value {
        if !v.is_empty() {
            *field = v.to_string();
        }
    }
}

impl eframe::App for RecoveryApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical()
                .id_salt("recovery_main_scroll")
                .auto_shrink([false, false])
                .show(ui, |ui| {
                    let loc = self.locale;
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.label(
                            RichText::new(ui_i18n::t(loc, Msg::Title))
                                .size(22.0)
                                .strong(),
                        );
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            for option in Locale::ALL {
                                let selected = self.locale == option;
                                if ui
                                    .selectable_label(selected, option.label())
                                    .on_hover_text(option.code())
                                    .clicked()
                                {
                                    self.locale = option;
                                }
                            }
                        });
                    });
                    ui.label(
                        RichText::new(ui_i18n::t(loc, Msg::Subtitle))
                            .size(13.0)
                            .color(Color32::GRAY),
                    );
                    ui.label(
                        RichText::new(format!("{} {APP_VERSION}", ui_i18n::t(loc, Msg::Build)))
                            .size(12.0)
                            .color(Color32::from_rgb(90, 90, 110)),
                    );
                    ui.add_space(8.0);

                    ui.label(RichText::new(ui_i18n::t(loc, Msg::LocalStore)).strong());
                    ui.label(
                        RichText::new(&self.store_root)
                            .size(12.0)
                            .color(Color32::from_rgb(60, 60, 90)),
                    );
                    ui.horizontal(|ui| {
                        if ui.button(ui_i18n::t(loc, Msg::Rescan)).clicked() {
                            self.apply_scan(store::rescan());
                        }
                        if ui.button(ui_i18n::t(loc, Msg::OpenStore)).clicked() {
                            self.open_store_folder();
                        }
                    });

                    ui.add_space(12.0);
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::Bridge)).strong());
                    egui::ComboBox::from_id_salt("bridge")
                        .selected_text(ui_i18n::bridge_label(loc, self.bridge_idx))
                        .show_ui(ui, |ui| {
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                0,
                                ui_i18n::t(loc, Msg::BridgeA),
                            );
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                1,
                                ui_i18n::t(loc, Msg::BridgeB),
                            );
                            ui.selectable_value(
                                &mut self.bridge_idx,
                                2,
                                ui_i18n::t(loc, Msg::BridgeC),
                            );
                        });

                    ui.add_space(10.0);
                    match self.bridge() {
                        Bridge::A => {
                            path_field(ui, ui_i18n::t(loc, Msg::Manifest), &mut self.manifest);
                            ui.label(ui_i18n::t(loc, Msg::Passphrase));
                            ui.add(
                                egui::TextEdit::singleline(&mut self.passphrase)
                                    .password(true)
                                    .desired_width(f32::INFINITY),
                            );
                        }
                        Bridge::B => {
                            path_field(ui, ui_i18n::t(loc, Msg::AppDir), &mut self.app_dir);
                            ui.label(ui_i18n::t(loc, Msg::Passphrase));
                            ui.add(
                                egui::TextEdit::singleline(&mut self.passphrase)
                                    .password(true)
                                    .desired_width(f32::INFINITY),
                            );
                        }
                        Bridge::C => {
                            path_field(
                                ui,
                                ui_i18n::t(loc, Msg::PracticeShare),
                                &mut self.practice_share,
                            );
                            path_field(
                                ui,
                                ui_i18n::t(loc, Msg::VendorShare),
                                &mut self.vendor_share,
                            );
                            path_field(ui, ui_i18n::t(loc, Msg::VendorSk), &mut self.vendor_sk);
                        }
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    ui.checkbox(&mut self.do_write_wrap, ui_i18n::t(loc, Msg::WriteWrap));
                    if self.do_write_wrap {
                        path_field(
                            ui,
                            ui_i18n::t(loc, Msg::WriteWrapDir),
                            &mut self.write_wrap_dir,
                        );
                        ui.label(ui_i18n::t(loc, Msg::WrapPassphrase));
                        ui.add(
                            egui::TextEdit::singleline(&mut self.wrap_passphrase)
                                .password(true)
                                .desired_width(f32::INFINITY),
                        );
                    }

                    ui.add_space(8.0);
                    ui.checkbox(&mut self.do_verify, ui_i18n::t(loc, Msg::DoVerify));
                    if self.do_verify {
                        path_field(ui, ui_i18n::t(loc, Msg::VerifyDb), &mut self.verify_db);
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::DoExport)).strong());
                    ui.checkbox(&mut self.do_export, ui_i18n::t(loc, Msg::DoExport));
                    if self.do_export {
                        ui.horizontal(|ui| {
                            ui.label(ui_i18n::t(loc, Msg::ExportFormat));
                            let prev = self.export_format_idx;
                            egui::ComboBox::from_id_salt("export_fmt")
                                .selected_text(self.export_format().as_str().to_uppercase())
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(&mut self.export_format_idx, 0, "JSON");
                                    ui.selectable_value(&mut self.export_format_idx, 1, "XML");
                                    ui.selectable_value(&mut self.export_format_idx, 2, "YAML");
                                });
                            if prev != self.export_format_idx {
                                self.sync_export_extension();
                            }
                        });
                        path_field(ui, ui_i18n::t(loc, Msg::ExportPath), &mut self.export_path);
                        ui.checkbox(
                            &mut self.export_include_key,
                            ui_i18n::t(loc, Msg::IncludeKey),
                        );
                    }

                    ui.add_space(14.0);
                    ui.add_enabled_ui(!self.busy, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 40.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::Recover)),
                            )
                            .clicked()
                        {
                            self.run_recover();
                        }
                    });

                    if self.recovered.is_some() {
                        ui.add_space(12.0);
                        ui.separator();
                        ui.add_space(8.0);
                        self.reset_section(ui, loc);
                    }

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    if !self.last_kcv.is_empty() {
                        ui.label(RichText::new(format!("Last KCV: {}", self.last_kcv)).strong());
                    }
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::Status)).strong());
                    ui.label(
                        RichText::new(&self.status_text)
                            .size(13.0)
                            .color(Color32::from_rgb(40, 90, 50)),
                    );
                    ui.add_space(8.0);
                    ui.label(RichText::new("Log").strong());
                    ui.add(
                        egui::TextEdit::multiline(&mut self.log)
                            .desired_width(f32::INFINITY)
                            .desired_rows(8)
                            .interactive(false),
                    );
                });
        });
    }
}

fn path_field(ui: &mut egui::Ui, label: &str, value: &mut String) {
    ui.label(label);
    ui.add(
        egui::TextEdit::singleline(value)
            .hint_text("/path/…")
            .desired_width(f32::INFINITY),
    );
}
