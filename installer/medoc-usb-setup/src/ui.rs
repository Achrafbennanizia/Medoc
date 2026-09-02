//! Small native window for field install (double-click MedocUsbSetup with no args).

use std::path::PathBuf;

use eframe::egui::{self, Color32, RichText, Vec2};

use crate::{cmd_init_campaign, cmd_install, kit_root, Cli};
use medoc_core::infrastructure::install_plan::{InstallRole, SlotStatus};
use medoc_core::infrastructure::usb_vault::{next_pending_slot, unlock_campaign};

pub fn run(root: Option<PathBuf>) -> Result<(), medoc_core::error::AppError> {
    let instance = single_instance::SingleInstance::new("de.medoc.usb-setup")
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
    if !instance.is_single() {
        eprintln!("MeDoc USB Setup is already open.");
        return Ok(());
    }
    std::mem::forget(instance);

    let native = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size(Vec2::new(460.0, 520.0))
            .with_min_inner_size(Vec2::new(400.0, 420.0))
            .with_title("MeDoc USB Setup"),
        ..Default::default()
    };
    let app = InstallerApp {
        cli: Cli {
            root,
            command: None,
        },
        password: String::new(),
        unlocked: false,
        status_text: "Enter the USB kit password, choose a role, then Install.".into(),
        log: String::new(),
        role_idx: 1,
        busy: false,
        devices: 1,
        create_mode: false,
    };
    eframe::run_native(
        "MeDoc USB Setup",
        native,
        Box::new(|_cc| Ok(Box::new(app))),
    )
    .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))
}

struct InstallerApp {
    cli: Cli,
    password: String,
    unlocked: bool,
    status_text: String,
    log: String,
    role_idx: usize,
    busy: bool,
    devices: u32,
    create_mode: bool,
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
            self.status_text = "Choose a password of at least 4 characters.".into();
            return;
        }
        let cli = self.root_cli();
        match cmd_init_campaign(
            &cli,
            Some(self.password.clone()),
            "default".into(),
            self.devices.max(1),
            "en".into(),
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
        let result = cmd_install(&cli, Some(pw), true, role, false);
        match result {
            Ok(()) => {
                self.status_text =
                    "Install finished. MeDoc should open and apply this PC’s role automatically."
                        .into();
                self.push_log(&self.status_text.clone());
            }
            Err(e) => {
                self.status_text = e.to_string();
                self.push_log(&e.to_string());
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
            ui.add_space(8.0);
            ui.label(RichText::new("MeDoc USB Setup").size(22.0).strong());
            ui.label(RichText::new("Install the practice app and choose this PC’s role.").size(13.0).color(Color32::GRAY));
            ui.add_space(12.0);

            ui.label("USB kit password");
            ui.add(egui::TextEdit::singleline(&mut self.password).password(true).hint_text("same password as init-campaign"));
            ui.horizontal(|ui| {
                if ui.button("Unlock").clicked() {
                    self.try_unlock();
                }
                if ui.button("New campaign").clicked() {
                    self.create_mode = true;
                    self.unlocked = false;
                    self.status_text = "Create a new campaign (replaces the vault on this kit).".into();
                }
            });

            ui.add_space(10.0);
            if self.create_mode {
                ui.label("Number of devices in this campaign");
                ui.add(egui::Slider::new(&mut self.devices, 1..=16));
                if ui.button("Create campaign").clicked() {
                    self.create_campaign();
                }
            }

            ui.add_space(8.0);
            ui.separator();
            ui.add_space(8.0);

            ui.label("Role for this PC");
            egui::ComboBox::from_id_salt("role")
                .selected_text(role_label(self.role_idx))
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut self.role_idx, 0, "Use next chain slot");
                    ui.selectable_value(&mut self.role_idx, 1, "Master");
                    ui.selectable_value(&mut self.role_idx, 2, "Replica / user");
                    ui.selectable_value(&mut self.role_idx, 3, "Server host");
                    ui.selectable_value(&mut self.role_idx, 4, "LAN client");
                });

            ui.add_space(10.0);
            let install_enabled = self.unlocked && !self.busy && !self.password.is_empty();
            ui.add_enabled_ui(install_enabled, |ui| {
                if ui
                    .add_sized(Vec2::new(ui.available_width(), 36.0), egui::Button::new("Install MeDoc"))
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

            ui.add_space(12.0);
            ui.label(RichText::new(&self.status_text).color(Color32::from_rgb(30, 90, 70)));
            ui.add_space(6.0);
            egui::ScrollArea::vertical().max_height(140.0).show(ui, |ui| {
                ui.label(RichText::new(&self.log).small().color(Color32::DARK_GRAY));
            });
        });
    }
}

fn role_label(idx: usize) -> &'static str {
    match idx {
        0 => "Use next chain slot",
        1 => "Master",
        2 => "Replica / user",
        3 => "Server host",
        4 => "LAN client",
        _ => "Master",
    }
}
