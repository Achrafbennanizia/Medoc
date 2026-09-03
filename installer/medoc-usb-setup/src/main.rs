//! USB multi-installer CLI / wizard for MeDoc field deployment.

mod install;
mod ui;

use std::path::PathBuf;

use chrono::Utc;
use clap::{Parser, Subcommand};
use dialoguer::{Confirm, Input, Password, Select};
use medoc_core::infrastructure::install_plan::{
    DiscoverConfig, DiscoverMode, InstallComponent, InstallPlan, InstallRole, InstallTopology,
    PlanActivationMode, SlotStatus, UsbInstallMode, FLAG_AUTO_ACTIVATE, FLAG_CHAIN_MEMBER,
    FLAG_INSTALL_SERVER, FLAG_LAN_CLIENT_ONLY, FLAG_OPEN_PORTS_WINDOW, FLAG_SCAN_LAN,
};
use medoc_core::infrastructure::install_plan::UsbInstallAuditEntry;
use medoc_core::infrastructure::usb_vault::{
    self, append_audit_entry, init_campaign_vault, kit_root_from_exe, mark_slot_done,
    next_pending_slot, read_audit_entries, unlock_campaign,
};
use uuid::Uuid;

#[derive(Parser, Clone)]
#[command(
    name = "medoc-usb-setup",
    about = "MeDoc USB multi-installer",
    after_help = "With no subcommand, opens a small install window. Scripted use: init-campaign, install, wizard, status, audit, wipe-pc."
)]
pub(crate) struct Cli {
    #[arg(long, global = true, help = "USB kit root (default: directory of this exe)")]
    pub(crate) root: Option<PathBuf>,

    #[command(subcommand)]
    pub(crate) command: Option<Commands>,
}

#[derive(Subcommand, Clone)]
pub(crate) enum Commands {
    /// Create encrypted campaign vault on the USB stick.
    InitCampaign {
        #[arg(long)]
        password: Option<String>,
        #[arg(long, default_value = "default")]
        mode: String,
        #[arg(long, default_value_t = 1)]
        devices: u32,
        #[arg(long, default_value = "en")]
        locale: String,
        #[arg(long, default_value_t = 30)]
        window_minutes: u32,
        #[arg(long, default_value = "")]
        pairing_code: String,
        #[arg(long, default_value = "")]
        master_address: String,
        #[arg(long, help = "Skip interactive prompts")]
        non_interactive: bool,
    },
    /// Show campaign progress and audit summary.
    Status {
        #[arg(long)]
        password: Option<String>,
    },
    /// Install next device (chain) or single default slot.
    Install {
        #[arg(long)]
        password: Option<String>,
        #[arg(long, default_value_t = true)]
        silent: bool,
        #[arg(long, help = "Do not launch MeDoc after install (CI / scripting)")]
        no_launch: bool,
    },
    /// List all audit entries.
    Audit {
        #[arg(long)]
        password: Option<String>,
    },
    /// Interactive wizard (unlock → options → install).
    Wizard {
        #[arg(long)]
        password: Option<String>,
    },
    /// Remove MeDoc from this computer (app, database, caches, keychain). Does not touch the USB kit.
    WipePc {
        #[arg(long, help = "Skip the confirmation prompt")]
        yes: bool,
    },
    /// Same as running with no subcommand (native install window).
    Gui,
}

pub(crate) fn kit_root(cli: &Cli) -> PathBuf {
    cli.root.clone().unwrap_or_else(kit_root_from_exe)
}

fn read_password(opt: Option<String>, prompt: &str) -> Result<String, medoc_core::error::AppError> {
    if let Some(p) = opt.filter(|s| !s.is_empty()) {
        return Ok(p);
    }
    Password::new()
        .with_prompt(prompt)
        .interact()
        .map_err(|e| medoc_core::error::AppError::Internal(format!("password prompt: {e}")))
}

fn parse_mode(s: &str) -> UsbInstallMode {
    match s.to_lowercase().as_str() {
        "chain" => UsbInstallMode::Chain,
        _ => UsbInstallMode::Default,
    }
}

fn build_slot_plan(
    role: InstallRole,
    label: &str,
    locale: &str,
    chain_index: u32,
    chain_total: u32,
    discover: DiscoverConfig,
    pairing_code: Option<String>,
    activation_mode: PlanActivationMode,
) -> InstallPlan {
    let mut flags = 0u32;
    if activation_mode == PlanActivationMode::Auto {
        flags |= FLAG_AUTO_ACTIVATE;
    }
    if chain_total > 1 {
        flags |= FLAG_CHAIN_MEMBER;
    }
    let mut components = vec![InstallComponent::PracticeApp];
    let topology = InstallTopology::ServerlessPeer;
    match role {
        InstallRole::Master => {
            flags |= FLAG_OPEN_PORTS_WINDOW;
        }
        InstallRole::Replica => {
            flags |= FLAG_SCAN_LAN;
            if discover.mode == DiscoverMode::Fixed {
                flags &= !FLAG_SCAN_LAN;
            }
        }
        InstallRole::ServerHost => {
            flags |= FLAG_INSTALL_SERVER;
            components.push(InstallComponent::LanServer);
        }
        InstallRole::LanClient => {
            flags |= FLAG_LAN_CLIENT_ONLY;
        }
    }
    InstallPlan {
        schema_version: 1,
        role,
        components,
        topology,
        locale: locale.into(),
        flags,
        discover,
        pairing_code,
        master_activation_ref: None,
        activation_mode,
        device_label: label.into(),
        preset_features: vec![],
        license_envelope: None,
        chain_slot_index: Some(chain_index),
        chain_total: Some(chain_total),
    }
}

pub(crate) fn cmd_init_campaign(
    cli: &Cli,
    password: Option<String>,
    mode: String,
    devices: u32,
    locale: String,
    window_minutes: u32,
    pairing_code: String,
    master_address: String,
    non_interactive: bool,
) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    if !non_interactive {
        let pw_confirm = read_password(None, "Confirm password")?;
        if pw != pw_confirm {
            return Err(medoc_core::error::AppError::Validation(
                "passwords do not match".into(),
            ));
        }
    }
    let install_mode = parse_mode(&mode);
    let locale = if non_interactive {
        locale
    } else {
        Input::new()
            .with_prompt("Locale (en/de/fr)")
            .default("en".into())
            .interact_text()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?
    };
    let window: u32 = if non_interactive {
        window_minutes
    } else {
        Input::new()
            .with_prompt("Pairing/discover window (minutes)")
            .default(30)
            .interact_text()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?
    };
    let pairing = if non_interactive {
        if pairing_code.trim().is_empty() {
            None
        } else {
            Some(pairing_code.trim().to_string())
        }
    } else {
        let pairing_code: String = Input::new()
            .with_prompt("Pairing code (optional)")
            .allow_empty(true)
            .interact_text()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
        if pairing_code.trim().is_empty() {
            None
        } else {
            Some(pairing_code.trim().to_string())
        }
    };
    let master_addr = if non_interactive {
        master_address
    } else {
        Input::new()
            .with_prompt("Master address (optional, for fixed discover)")
            .allow_empty(true)
            .interact_text()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?
    };
    let discover = if master_addr.trim().is_empty() {
        DiscoverConfig {
            mode: DiscoverMode::Scan,
            port: 8787,
            window_minutes: window,
            ..Default::default()
        }
    } else {
        DiscoverConfig {
            mode: DiscoverMode::Fixed,
            address: master_addr.trim().into(),
            port: 8787,
            window_minutes: window,
        }
    };

    let mut slots = Vec::new();
    for i in 0..devices.max(1) {
        let role = if i == 0 {
            InstallRole::Master
        } else {
            InstallRole::Replica
        };
        let label = format!("Device {}", i + 1);
        slots.push(build_slot_plan(
            role,
            &label,
            &locale,
            i,
            devices.max(1),
            discover.clone(),
            pairing.clone(),
            PlanActivationMode::Auto,
        ));
    }
    let campaign = init_campaign_vault(&root, &pw, install_mode, slots)?;
    println!(
        "Campaign {} created — {} slot(s), mode {:?}",
        campaign.campaign_id, campaign.chain_total, campaign.install_mode
    );
    println!("Unlock with the same password you just set (there is no default like demo123).");
    Ok(())
}

fn cmd_status(cli: &Cli, password: Option<String>) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    let campaign = unlock_campaign(&root, &pw)?;
    println!("Campaign: {}", campaign.campaign_id);
    println!("Mode: {:?}", campaign.install_mode);
    println!(
        "Progress: {}/{} (next index {})",
        campaign
            .slots
            .iter()
            .filter(|s| matches!(s.status, medoc_core::infrastructure::install_plan::SlotStatus::Done))
            .count(),
        campaign.chain_total,
        campaign.chain_next_index
    );
    for slot in &campaign.slots {
        println!(
            "  slot {} {:?} {:?} label={}",
            slot.slot_index, slot.status, slot.plan.role, slot.plan.device_label
        );
    }
    let audit = read_audit_entries(&root, &pw)?;
    println!("Audit entries: {}", audit.len());
    Ok(())
}

fn wizard_role_override(role_idx: usize) -> Option<InstallRole> {
    match role_idx {
        1 => Some(InstallRole::Master),
        2 => Some(InstallRole::Replica),
        3 => Some(InstallRole::ServerHost),
        4 => Some(InstallRole::LanClient),
        _ => None,
    }
}

pub(crate) fn cmd_install(
    cli: &Cli,
    password: Option<String>,
    silent: bool,
    role_override: Option<InstallRole>,
    no_launch: bool,
    activation_mode: Option<PlanActivationMode>,
) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    let campaign = unlock_campaign(&root, &pw)?;
    let slot = next_pending_slot(&campaign).ok_or_else(|| {
        let done = campaign
            .slots
            .iter()
            .filter(|s| matches!(s.status, SlotStatus::Done))
            .count();
        medoc_core::error::AppError::Validation(format!(
            "no pending install slot (campaign {}/{} complete). Run init-campaign to start a new campaign, or ./MedocUsbSetup status to inspect progress.",
            done,
            campaign.chain_total
        ))
    })?;
    let chain_total = campaign.chain_total;
    let mut plan = slot.plan.clone();
    if let Some(role) = role_override {
        plan = build_slot_plan(
            role,
            &plan.device_label,
            &plan.locale,
            slot.slot_index,
            chain_total,
            plan.discover.clone(),
            plan.pairing_code.clone(),
            activation_mode.unwrap_or(plan.activation_mode),
        );
    }
    if let Some(mode) = activation_mode {
        plan.activation_mode = mode;
        if mode == PlanActivationMode::Manual {
            plan.flags &= !FLAG_AUTO_ACTIVATE;
        }
    }
    let slot_index = slot.slot_index;
    let install_mode = campaign.install_mode;
    let auto_launch = plan.activation_mode == PlanActivationMode::Auto && !no_launch;

    let _temp = install::TempGuard::new();
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".into());
    let fp = usb_vault::host_fingerprint();
    let plan_hash = plan.plan_hash();
    let mut practice_target = None;

    let result = (|| {
        practice_target = install::install_components(&root, &plan.components, silent)?;
        install::write_plan_sidecar(&plan)?;
        medoc_core::infrastructure::database::connection::prepare_practice_db_before_launch(
            &usb_vault::practice_app_data_dir(),
        )?;
        Ok::<(), medoc_core::error::AppError>(())
    })();

    let (success, error) = match &result {
        Ok(()) => (true, None),
        Err(e) => (false, Some(e.to_string())),
    };

    append_audit_entry(
        &root,
        &pw,
        UsbInstallAuditEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            install_mode,
            slot_index: Some(slot_index),
            host_fingerprint: fp,
            hostname,
            role: plan.role,
            components: plan.components.clone(),
            plan_hash,
            success,
            error: error.clone(),
        },
    )?;

    if success {
        mark_slot_done(&root, &pw, slot_index)?;
        println!(
            "Install complete for slot {} ({:?}).\nApp location: {}\nSidecar: {}",
            slot_index,
            plan.role,
            practice_target
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "(none)".into()),
            medoc_core::infrastructure::usb_vault::default_sidecar_path().display()
        );
        if auto_launch {
            if let Some(target) = practice_target.as_ref() {
                match install::launch_practice_app(target) {
                    Ok(()) => println!(
                        "MeDoc is installed at {} and is running.",
                        target.display()
                    ),
                    Err(e) => println!(
                        "Install OK at {}. Auto-launch: {e}. Double-click MeDoc in that folder.",
                        target.display()
                    ),
                }
            } else {
                println!("Launch MeDoc manually to apply the install plan.");
            }
        } else if plan.activation_mode == PlanActivationMode::Manual {
            println!("Manual activation mode — complete license setup in MeDoc when ready.");
        } else {
            println!("Open MeDoc once to apply the install plan (role, locale, pairing window).");
        }
        Ok(())
    } else {
        Err(result.unwrap_err())
    }
}

fn cmd_audit(cli: &Cli, password: Option<String>) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    for entry in read_audit_entries(&root, &pw)? {
        println!(
            "{} slot={:?} success={} role={:?} host={} err={:?}",
            entry.timestamp,
            entry.slot_index,
            entry.success,
            entry.role,
            entry.hostname,
            entry.error
        );
    }
    Ok(())
}

fn cmd_wizard(cli: &Cli, password: Option<String>) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let has_vault = root.join("medoc-usb/vault.sealed").exists();
    if !has_vault {
        let create = Confirm::new()
            .with_prompt("No campaign on this USB. Create one now?")
            .default(true)
            .interact()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
        if create {
            let devices: u32 = Input::new()
                .with_prompt("Number of devices")
                .default(1)
                .interact_text()
                .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
            let mode_idx = Select::new()
                .with_prompt("Install mode")
                .items(&["Default (single)", "Chain (multi-PC)"])
                .default(0)
                .interact()
                .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
            let mode = if mode_idx == 1 { "chain" } else { "default" };
            cmd_init_campaign(
                cli,
                None,
                mode.into(),
                devices,
                "en".into(),
                30,
                String::new(),
                String::new(),
                false,
            )?;
        } else {
            return Err(medoc_core::error::AppError::Validation(
                "campaign required".into(),
            ));
        }
    }

    let pw = read_password(password, "USB kit password")?;
    let campaign = unlock_campaign(&root, &pw)?;
    if next_pending_slot(&campaign).is_none() {
        let done = campaign
            .slots
            .iter()
            .filter(|s| matches!(s.status, SlotStatus::Done))
            .count();
        println!(
            "Campaign {} is complete ({}/{} slots used).",
            campaign.campaign_id, done, campaign.chain_total
        );
        let reset = Confirm::new()
            .with_prompt("Create a new campaign (replaces vault and audit on this kit)?")
            .default(false)
            .interact()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
        if reset {
            let devices: u32 = Input::new()
                .with_prompt("Number of devices")
                .default(1)
                .interact_text()
                .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
            let mode_idx = Select::new()
                .with_prompt("Install mode")
                .items(&["Default (single)", "Chain (multi-PC)"])
                .default(0)
                .interact()
                .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
            let mode = if mode_idx == 1 { "chain" } else { "default" };
            cmd_init_campaign(
                cli,
                Some(pw.clone()),
                mode.into(),
                devices,
                "en".into(),
                30,
                String::new(),
                String::new(),
                false,
            )?;
        } else {
            return Err(medoc_core::error::AppError::Validation(
                "no pending install slot — create a new campaign or copy a fresh USB kit".into(),
            ));
        }
    }

    let role_idx = Select::new()
        .with_prompt("Role for this PC")
        .items(&[
            "Use next chain slot",
            "Master",
            "Replica / user",
            "Server host",
            "LAN client",
        ])
        .default(0)
        .interact()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;

    let silent = Confirm::new()
        .with_prompt("Silent installer (/S)?")
        .default(true)
        .interact()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;

    cmd_install(cli, Some(pw), silent, wizard_role_override(role_idx), false, None)
}

fn cmd_wipe_pc(yes: bool) -> Result<(), medoc_core::error::AppError> {
    if !yes {
        let ok = Confirm::new()
            .with_prompt("Delete MeDoc app, database, caches, and keychain items on this computer? (USB kit is kept)")
            .default(false)
            .interact()
            .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
        if !ok {
            println!("Cancelled.");
            return Ok(());
        }
    }
    let removed = install::wipe_this_computer()?;
    if removed.is_empty() {
        println!("Nothing left to delete on this computer.");
    } else {
        for line in &removed {
            println!("removed {line}");
        }
        println!("Deleted {} item(s).", removed.len());
    }
    Ok(())
}

fn main() {
    let cli = Cli::parse();
    let result = match &cli.command {
        None | Some(Commands::Gui) => ui::run(cli.root.clone()),
        Some(Commands::InitCampaign {
            password,
            mode,
            devices,
            locale,
            window_minutes,
            pairing_code,
            master_address,
            non_interactive,
        }) => cmd_init_campaign(
            &cli,
            password.clone(),
            mode.clone(),
            *devices,
            locale.clone(),
            *window_minutes,
            pairing_code.clone(),
            master_address.clone(),
            *non_interactive,
        ),
        Some(Commands::Status { password }) => cmd_status(&cli, password.clone()),
        Some(Commands::Install {
            password,
            silent,
            no_launch,
        }) => cmd_install(&cli, password.clone(), *silent, None, *no_launch, None),
        Some(Commands::Audit { password }) => cmd_audit(&cli, password.clone()),
        Some(Commands::Wizard { password }) => cmd_wizard(&cli, password.clone()),
        Some(Commands::WipePc { yes }) => cmd_wipe_pc(*yes),
    };
    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}
