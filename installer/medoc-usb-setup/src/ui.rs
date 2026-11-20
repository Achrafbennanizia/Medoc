//! Small native window for field install (double-click MedocUsbSetup with no args).

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText, Vec2};

use crate::ui_i18n::{self, Locale, Msg};
use crate::{cmd_init_campaign, cmd_install, kit_root, Cli};
use medoc_core::infrastructure::database::repos::admin::license as license_repo;
use medoc_core::infrastructure::install_plan::{InstallRole, PlanActivationMode, SlotStatus};
use medoc_core::infrastructure::usb_vault::{
    next_pending_slot, practice_app_data_dir, unlock_campaign,
};
use medoc_sync::cluster::services::mint_and_activate_usb_owner_license;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

pub fn run(root: Option<PathBuf>) -> Result<(), medoc_core::error::AppError> {
    let instance = single_instance::SingleInstance::new("de.medoc.usb-setup")
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
    if !instance.is_single() {
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("osascript")
                .args([
                    "-e",
                    r#"tell application "System Events" to set frontmost of (first process whose name contains "MedocUsbSetup") to true"#,
                ])
                .status();
        }
        eprintln!("MeDoc USB Setup is already open — brought that window forward.");
        return Ok(());
    }
    std::mem::forget(instance);

    let native = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size(Vec2::new(520.0, 700.0))
            .with_min_inner_size(Vec2::new(420.0, 360.0))
            .with_title("MeDoc USB Setup"),
        ..Default::default()
    };
    let locale = Locale::En;
    let app = InstallerApp {
        cli: Cli {
            root,
            command: None,
        },
        locale,
        password: String::new(),
        unlocked: false,
        status_text: ui_i18n::t(locale, Msg::Subtitle).into(),
        log: String::new(),
        role_idx: 1,
        busy: false,
        devices: 1,
        create_mode: false,
        installed: false,
        license_key: String::new(),
        copy_flash: String::new(),
        confirm_wipe: false,
    };
    eframe::run_native("MeDoc USB Setup", native, Box::new(|_cc| Ok(Box::new(app))))
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))
}

struct InstallerApp {
    cli: Cli,
    locale: Locale,
    password: String,
    unlocked: bool,
    status_text: String,
    log: String,
    role_idx: usize,
    busy: bool,
    devices: u32,
    create_mode: bool,
    installed: bool,
    license_key: String,
    copy_flash: String,
    confirm_wipe: bool,
}

impl InstallerApp {
    fn root_cli(&self) -> Cli {
        Cli {
            root: self.cli.root.clone(),
            command: None,
        }
    }

    fn try_unlock(&mut self) {
        if self.password.is_empty() {
            self.status_text = "Password is required.".into();
            return;
        }
        let cli = self.root_cli();
        let root = kit_root(&cli);
        let vault = root.join("medoc-usb/vault.sealed");
        if !vault.exists() {
            self.create_mode = true;
            self.status_text = "No campaign on this kit. Set a password and create one.".into();
            return;
        }
        match unlock_campaign(&root, &self.password) {
            Ok(c) => {
                self.unlocked = true;
                self.create_mode = false;
                let pending = next_pending_slot(&c)
                    .map(|s| format!("next: slot {} {:?}", s.slot_index, s.plan.role))
                    .unwrap_or_else(|| "all slots done — create a new campaign".into());
                self.status_text = format!(
                    "Unlocked. Campaign {} — {}/{} done. {pending}",
                    &c.campaign_id[..8.min(c.campaign_id.len())],
                    c.slots
                        .iter()
                        .filter(|s| matches!(s.status, SlotStatus::Done))
                        .count(),
                    c.chain_total
                );
                self.push_log(&self.status_text.clone());
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
            }
        }
    }

    fn create_campaign(&mut self) {
        if self.password.len() < 4 {
            self.status_text = ui_i18n::t(self.locale, Msg::ShortPassword).into();
            return;
        }
        let cli = self.root_cli();
        match cmd_init_campaign(
            &cli,
            Some(self.password.clone()),
            "default".into(),
            self.devices.max(1),
            self.locale.code().into(),
            30,
            String::new(),
            String::new(),
            true,
        ) {
            Ok(()) => {
                self.create_mode = false;
                self.try_unlock();
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
            }
        }
    }

    fn install(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        let role = match self.role_idx {
            1 => Some(InstallRole::Master),
            2 => Some(InstallRole::Replica),
            3 => Some(InstallRole::ServerHost),
            4 => Some(InstallRole::LanClient),
            _ => None,
        };
        let cli = self.root_cli();
        let pw = self.password.clone();
        self.push_log("Installing…");
        let result = cmd_install(
            &cli,
            Some(pw),
            true,
            role,
            true,
            Some(PlanActivationMode::Manual),
        );
        match result {
            Ok(()) => {
                self.installed = true;
                self.status_text =
                    "Installed. Click Open MeDoc (do not double-click the app in Finder).".into();
                self.push_log(&self.status_text.clone());
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
            }
        }
        self.busy = false;
    }

    fn create_license_key(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        self.copy_flash.clear();
        crate::install::stop_running_medoc_apps();
        let customer = hostname_slug();
        match mint_and_activate_usb_owner_license(&practice_app_data_dir(), &customer, "PRO") {
            Ok(key) => {
                self.license_key = key;
                self.status_text =
                    "License is active on this PC. Open MeDoc — onboarding should skip the license step. The key is here if you need to copy it.".into();
                self.push_log("License minted and activated on this PC.");
            }
            Err(e) => {
                // Fallback: mint without cluster activate (e.g. DB busy) so the operator still has a key.
                match license_repo::mint_copyable_v2_license_for_app_dir(
                    &practice_app_data_dir(),
                    &customer,
                    "PRO",
                ) {
                    Ok(key) => {
                        self.license_key = key;
                        self.status_text = format!(
                            "Could not auto-activate ({e}). Copy the key into MeDoc onboarding."
                        );
                        self.push_log(&self.status_text.clone());
                    }
                    Err(e2) => {
                        self.status_text = format!("{e}; {e2}");
                        self.push_log(&self.status_text.clone());
                    }
                }
            }
        }
        self.busy = false;
    }

    fn update_from_latest_build(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        self.push_log("Updating MeDoc from the latest compilation…");
        let root = kit_root(&self.root_cli());
        match crate::install::update_from_latest_build(&root) {
            Ok(msg) => {
                self.installed = true;
                self.status_text = msg.clone();
                self.push_log(&msg);
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
            }
        }
        self.busy = false;
    }

    fn open_medoc(&mut self) {
        if self.busy {
            return;
        }
        self.busy = true;
        let target = crate::install::installed_medoc_app_path();
        match crate::install::launch_practice_app(&target) {
            Ok(()) => {
                self.status_text = "MeDoc is running.".into();
                self.push_log("Started MeDoc.");
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
            }
        }
        self.busy = false;
    }

    fn wipe_this_mac(&mut self) {
        if self.busy {
            return;
        }
        if !self.confirm_wipe {
            self.confirm_wipe = true;
            self.status_text =
                "This removes MeDoc.app, the database, caches, and keychain items on this computer. The USB kit is kept. Click Confirm delete to proceed.".into();
            return;
        }
        self.busy = true;
        self.push_log("Deleting MeDoc from this computer…");
        match crate::install::wipe_this_computer() {
            Ok(removed) => {
                self.installed = false;
                self.license_key.clear();
                self.copy_flash.clear();
                self.confirm_wipe = false;
                if removed.is_empty() {
                    self.status_text = "Nothing left to delete on this computer.".into();
                } else {
                    self.status_text = format!(
                        "Deleted {} item(s) on this computer. You can Install again.",
                        removed.len()
                    );
                }
                for line in &removed {
                    self.push_log(line);
                }
                self.push_log(&self.status_text.clone());
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
                self.confirm_wipe = false;
            }
        }
        self.busy = false;
    }

    fn push_log(&mut self, line: &str) {
        if !self.log.is_empty() {
            self.log.push('\n');
        }
        self.log.push_str(line);
    }
}

impl eframe::App for InstallerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical()
                .id_salt("installer_main_scroll")
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
                    ui.add_space(12.0);

                    ui.label(ui_i18n::t(loc, Msg::Password));
                    ui.add(
                        egui::TextEdit::singleline(&mut self.password)
                            .password(true)
                            .hint_text(ui_i18n::t(loc, Msg::PasswordHint)),
                    );
                    ui.horizontal(|ui| {
                        if ui.button(ui_i18n::t(loc, Msg::Unlock)).clicked() {
                            self.try_unlock();
                        }
                        if ui.button(ui_i18n::t(loc, Msg::NewCampaign)).clicked() {
                            self.create_mode = true;
                            self.unlocked = false;
                            self.status_text =
                                ui_i18n::t(self.locale, Msg::CreateCampaignHint).into();
                        }
                    });

                    ui.add_space(10.0);
                    if self.create_mode {
                        ui.label(ui_i18n::t(loc, Msg::Devices));
                        ui.add(egui::Slider::new(&mut self.devices, 1..=16));
                        if ui.button(ui_i18n::t(loc, Msg::CreateCampaign)).clicked() {
                            self.create_campaign();
                        }
                    }

                    ui.add_space(8.0);
                    ui.separator();
                    ui.add_space(8.0);

                    ui.label(ui_i18n::t(loc, Msg::Role));
                    egui::ComboBox::from_id_salt("role")
                        .selected_text(ui_i18n::role_label(loc, self.role_idx))
                        .show_ui(ui, |ui| {
                            ui.selectable_value(
                                &mut self.role_idx,
                                0,
                                ui_i18n::t(loc, Msg::RoleNext),
                            );
                            ui.selectable_value(
                                &mut self.role_idx,
                                1,
                                ui_i18n::t(loc, Msg::RoleMaster),
                            );
                            ui.selectable_value(
                                &mut self.role_idx,
                                2,
                                ui_i18n::t(loc, Msg::RoleReplica),
                            );
                            ui.selectable_value(
                                &mut self.role_idx,
                                3,
                                ui_i18n::t(loc, Msg::RoleServer),
                            );
                            ui.selectable_value(
                                &mut self.role_idx,
                                4,
                                ui_i18n::t(loc, Msg::RoleLan),
                            );
                        });

                    ui.add_space(10.0);
                    let install_enabled = self.unlocked && !self.busy && !self.password.is_empty();
                    ui.add_enabled_ui(install_enabled, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 36.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::Install)),
                            )
                            .clicked()
                        {
                            if !self.unlocked {
                                self.try_unlock();
                            }
                            if self.unlocked {
                                self.install();
                            }
                        }
                    });

                    ui.add_space(8.0);
                    ui.add_enabled_ui(!self.busy, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 36.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::UpdateFromBuild)),
                            )
                            .clicked()
                        {
                            self.update_from_latest_build();
                        }
                    });
                    ui.label(
                        RichText::new(ui_i18n::t(loc, Msg::UpdateHint))
                            .size(12.0)
                            .color(Color32::GRAY),
                    );

                    ui.add_space(8.0);
                    ui.add_enabled_ui(!self.busy, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 36.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::OpenMedoc)),
                            )
                            .clicked()
                        {
                            self.open_medoc();
                        }
                    });
                    ui.label(
                        RichText::new(ui_i18n::t(loc, Msg::OpenHint))
                            .size(12.0)
                            .color(Color32::GRAY),
                    );

                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        let wipe_label = if self.confirm_wipe {
                            ui_i18n::t(loc, Msg::WipeConfirm)
                        } else {
                            ui_i18n::t(loc, Msg::Wipe)
                        };
                        ui.add_enabled_ui(!self.busy, |ui| {
                            if ui
                                .add(egui::Button::new(
                                    RichText::new(wipe_label).color(Color32::from_rgb(160, 40, 40)),
                                ))
                                .clicked()
                            {
                                self.wipe_this_mac();
                            }
                        });
                        if self.confirm_wipe && ui.button(ui_i18n::t(loc, Msg::Cancel)).clicked() {
                            self.confirm_wipe = false;
                            self.status_text = ui_i18n::t(self.locale, Msg::DeleteCancelled).into();
                        }
                    });

                    ui.add_space(12.0);
                    ui.separator();
                    ui.add_space(8.0);
                    ui.label(RichText::new(ui_i18n::t(loc, Msg::LicenseHeading)).strong());
                    ui.label(
                        RichText::new(ui_i18n::t(loc, Msg::LicenseHint))
                            .size(12.0)
                            .color(Color32::GRAY),
                    );
                    ui.add_space(6.0);
                    let license_ok = !self.busy && (!self.password.is_empty() || self.installed);
                    ui.add_enabled_ui(license_ok, |ui| {
                        if ui
                            .add_sized(
                                Vec2::new(ui.available_width(), 32.0),
                                egui::Button::new(ui_i18n::t(loc, Msg::ActivateLicense)),
                            )
                            .clicked()
                        {
                            self.create_license_key();
                        }
                    });
                    ui.add_space(6.0);
                    ui.add(
                        egui::TextEdit::multiline(&mut self.license_key)
                            .desired_width(f32::INFINITY)
                            .desired_rows(5)
                            .hint_text(ui_i18n::t(loc, Msg::LicenseKeyHint)),
                    );
                    ui.horizontal(|ui| {
                        let can_copy = !self.license_key.is_empty();
                        ui.add_enabled_ui(can_copy, |ui| {
                            if ui.button(ui_i18n::t(loc, Msg::CopyLicense)).clicked() {
                                ui.ctx().copy_text(
                                    self.license_key
                                        .chars()
                                        .filter(|c| !c.is_whitespace())
                                        .collect::<String>(),
                                );
                                self.copy_flash = ui_i18n::t(self.locale, Msg::Copied).into();
                            }
                        });
                        if !self.copy_flash.is_empty() {
                            ui.label(
                                RichText::new(&self.copy_flash)
                                    .color(Color32::from_rgb(30, 90, 70)),
                            );
                        }
                    });

                    ui.add_space(12.0);
                    ui.label(RichText::new(&self.status_text).color(Color32::from_rgb(30, 90, 70)));
                    ui.add_space(6.0);
                    egui::ScrollArea::vertical()
                        .id_salt("installer_log_scroll")
                        .max_height(140.0)
                        .show(ui, |ui| {
                            ui.label(RichText::new(&self.log).small().color(Color32::DARK_GRAY));
                        });
                });
        });
    }
}

fn hostname_slug() -> String {
    let raw = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "medoc-usb".into());
    let slug: String = raw
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    let slug = slug.trim_matches('-');
    if slug.is_empty() {
        "medoc-usb".into()
    } else {
        slug.to_string()
    }
}
