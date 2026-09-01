//! USB multi-installer CLI / wizard for MeDoc field deployment.

mod install;

use std::path::PathBuf;

use chrono::Utc;
use clap::{Parser, Subcommand};
use dialoguer::{Confirm, Input, Password, Select};
use medoc_core::infrastructure::install_plan::{
    DiscoverConfig, DiscoverMode, InstallComponent, InstallPlan, InstallRole, InstallTopology,
    PlanActivationMode, UsbInstallMode, FLAG_AUTO_ACTIVATE, FLAG_CHAIN_MEMBER,
    FLAG_INSTALL_SERVER, FLAG_LAN_CLIENT_ONLY, FLAG_OPEN_PORTS_WINDOW, FLAG_SCAN_LAN,
};
use medoc_core::infrastructure::usb_vault::{
    self, append_audit_entry, init_campaign_vault, kit_root_from_exe, mark_slot_done,
    next_pending_slot, read_audit_entries, unlock_campaign, UsbInstallAuditEntry,
};
use uuid::Uuid;

#[derive(Parser)]
#[command(name = "medoc-usb-setup", about = "MeDoc USB multi-installer")]
struct Cli {
    #[arg(long, global = true, help = "USB kit root (default: directory of this exe)")]
    root: Option<PathBuf>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create encrypted campaign vault on the USB stick.
    InitCampaign {
        #[arg(long)]
        password: Option<String>,
        #[arg(long, default_value = "default")]
        mode: String,
        #[arg(long, default_value_t = 1)]
        devices: u32,
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
    },
    /// List all audit entries.
    Audit {
        #[arg(long)]
        password: Option<String>,
    },
    /// Interactive wizard (unlock → options → install).
    Wizard,
}

fn kit_root(cli: &Cli) -> PathBuf {
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
) -> InstallPlan {
    let mut flags = FLAG_AUTO_ACTIVATE;
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
        activation_mode: PlanActivationMode::Auto,
        device_label: label.into(),
        preset_features: vec![],
        license_envelope: None,
        chain_slot_index: Some(chain_index),
        chain_total: Some(chain_total),
    }
}

fn cmd_init_campaign(cli: &Cli, password: Option<String>, mode: String, devices: u32) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    let pw_confirm = read_password(None, "Confirm password")?;
    if pw != pw_confirm {
        return Err(medoc_core::error::AppError::Validation(
            "passwords do not match".into(),
        ));
    }
    let install_mode = parse_mode(&mode);
    let locale: String = Input::new()
        .with_prompt("Locale (en/de/fr)")
        .default("en".into())
        .interact_text()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
    let window: u32 = Input::new()
        .with_prompt("Pairing/discover window (minutes)")
        .default(30)
        .interact_text()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
    let pairing_code: String = Input::new()
        .with_prompt("Pairing code (optional)")
        .allow_empty(true)
        .interact_text()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
    let pairing = if pairing_code.trim().is_empty() {
        None
    } else {
        Some(pairing_code.trim().to_string())
    };
    let master_addr: String = Input::new()
        .with_prompt("Master address (optional, for fixed discover)")
        .allow_empty(true)
        .interact_text()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;
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
        ));
    }
    let campaign = init_campaign_vault(&root, &pw, install_mode, slots)?;
    println!(
        "Campaign {} created — {} slot(s), mode {:?}",
        campaign.campaign_id, campaign.chain_total, campaign.install_mode
    );
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

fn cmd_install(cli: &Cli, password: Option<String>, silent: bool) -> Result<(), medoc_core::error::AppError> {
    let root = kit_root(cli);
    let pw = read_password(password, "USB kit password")?;
    let campaign = unlock_campaign(&root, &pw)?;
    let slot = next_pending_slot(&campaign).ok_or_else(|| {
        medoc_core::error::AppError::Validation("no pending install slot".into())
    })?;
    let plan = slot.plan.clone();
    let slot_index = slot.slot_index;
    let install_mode = campaign.install_mode;

    let _temp = install::TempGuard::new();
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".into());
    let fp = usb_vault::host_fingerprint();
    let plan_hash = plan.plan_hash();

    let result = (|| {
        install::install_components(&root, &plan.components, silent)?;
        install::write_plan_sidecar(&plan)?;
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
            "Install complete for slot {} ({:?}). Sidecar written; launch MeDoc to apply plan.",
            slot_index, plan.role
        );
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

fn cmd_wizard(cli: &Cli) -> Result<(), medoc_core::error::AppError> {
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
            cmd_init_campaign(cli, None, mode.into(), devices)?;
        } else {
            return Err(medoc_core::error::AppError::Validation(
                "campaign required".into(),
            ));
        }
    }

    let pw = read_password(None, "USB kit password")?;
    let _ = unlock_campaign(&root, &pw)?;

    let role_idx = Select::new()
        .with_prompt("Role for this PC (overrides next chain slot if confirmed)")
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

    if role_idx > 0 {
        println!("Note: chain slot plan is used; customize campaign via init-campaign for full control.");
    }

    let silent = Confirm::new()
        .with_prompt("Silent installer (/S)?")
        .default(true)
        .interact()
        .map_err(|e| medoc_core::error::AppError::Internal(e.to_string()))?;

    cmd_install(cli, Some(pw), silent)
}

fn main() {
    let cli = Cli::parse();
    let result = match cli.command {
        Commands::InitCampaign {
            password,
            mode,
            devices,
        } => cmd_init_campaign(&cli, password, mode, devices),
        Commands::Status { password } => cmd_status(&cli, password),
        Commands::Install { password, silent } => cmd_install(&cli, password, silent),
        Commands::Audit { password } => cmd_audit(&cli, password),
        Commands::Wizard => cmd_wizard(&cli),
    };
    if let Err(e) = result {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}
