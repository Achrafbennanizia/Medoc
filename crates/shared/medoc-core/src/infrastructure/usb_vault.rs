//! Encrypted USB vault + append-only install audit log for the multi-installer.

use std::fs;
use std::path::{Path, PathBuf};

use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::error::AppError;
use crate::infrastructure::install_plan::{
    DeviceSlot, InstallPlan, SlotStatus, UsbCampaignVault, UsbInstallAuditEntry, UsbInstallMode,
};

pub const USB_KIT_DIR: &str = "medoc-usb";
pub const VAULT_FILE: &str = "vault.sealed";
pub const AUDIT_FILE: &str = "audit.sealed";
pub const PAYLOADS_DIR: &str = "payloads";

const VAULT_SCHEMA: u32 = 1;
const AUDIT_SCHEMA: u32 = 1;
const KDF_OPS: u32 = 3;
const KDF_MEM_KIB: u32 = 262_144;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SealedBlob {
    schema_version: u32,
    salt: String,
    nonce: String,
    ciphertext: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct VaultPlain {
    schema_version: u32,
    password_verifier: String,
    campaign: UsbCampaignVault,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AuditPlain {
    schema_version: u32,
    entries: Vec<UsbInstallAuditEntry>,
}

fn derive_key(passphrase: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, AppError> {
    let params = Params::new(KDF_MEM_KIB, KDF_OPS, 1, Some(32))
        .map_err(|e| AppError::Internal(format!("argon2 params: {e}")))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; 32]);
    argon
        .hash_password_into(passphrase.as_bytes(), salt, key.as_mut())
        .map_err(|e| AppError::Internal(format!("argon2 hash: {e}")))?;
    Ok(key)
}

fn password_verifier(passphrase: &str) -> Result<String, AppError> {
    let salt: [u8; 16] = rand::random();
    let key = derive_key(passphrase, &salt)?;
    Ok(format!(
        "argon2id13:{}:{}",
        STANDARD.encode(salt),
        STANDARD.encode(key.as_slice())
    ))
}

fn verify_password(passphrase: &str, verifier: &str) -> Result<(), AppError> {
    let Some((salt_b64, key_b64)) = verifier
        .strip_prefix("argon2id13:")
        .and_then(|rest| rest.split_once(':'))
    else {
        return Err(AppError::Validation("invalid password verifier".into()));
    };
    let salt = STANDARD
        .decode(salt_b64)
        .map_err(|e| AppError::Validation(format!("verifier salt: {e}")))?;
    let expected = STANDARD
        .decode(key_b64)
        .map_err(|e| AppError::Validation(format!("verifier key: {e}")))?;
    let actual = derive_key(passphrase, &salt)?;
    if actual.as_slice() != expected.as_slice() {
        return Err(AppError::Forbidden);
    }
    Ok(())
}

fn seal_json<T: Serialize>(passphrase: &str, value: &T) -> Result<SealedBlob, AppError> {
    let salt: [u8; 16] = rand::random();
    let key = derive_key(passphrase, &salt)?;
    let nonce_bytes: [u8; 24] = rand::random();
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_slice())
        .map_err(|e| AppError::Internal(format!("cipher: {e}")))?;
    let nonce = XNonce::from_slice(&nonce_bytes);
    let plain = serde_json::to_vec(value).map_err(|e| AppError::Internal(e.to_string()))?;
    let ct = cipher
        .encrypt(nonce, plain.as_ref())
        .map_err(|e| AppError::Internal(format!("encrypt: {e}")))?;
    Ok(SealedBlob {
        schema_version: VAULT_SCHEMA,
        salt: STANDARD.encode(salt),
        nonce: STANDARD.encode(nonce_bytes),
        ciphertext: STANDARD.encode(ct),
    })
}

fn open_json<T: for<'de> Deserialize<'de>>(
    passphrase: &str,
    blob: &SealedBlob,
) -> Result<T, AppError> {
    let salt = STANDARD
        .decode(&blob.salt)
        .map_err(|e| AppError::Validation(format!("salt: {e}")))?;
    let nonce_bytes = STANDARD
        .decode(&blob.nonce)
        .map_err(|e| AppError::Validation(format!("nonce: {e}")))?;
    let ct = STANDARD
        .decode(&blob.ciphertext)
        .map_err(|e| AppError::Validation(format!("ciphertext: {e}")))?;
    if nonce_bytes.len() != 24 {
        return Err(AppError::Validation("invalid nonce length".into()));
    }
    let key = derive_key(passphrase, &salt)?;
    let cipher = XChaCha20Poly1305::new_from_slice(key.as_slice())
        .map_err(|e| AppError::Internal(format!("cipher: {e}")))?;
    let plain = cipher
        .decrypt(XNonce::from_slice(&nonce_bytes), ct.as_ref())
        .map_err(|_| AppError::Forbidden)?;
    serde_json::from_slice(&plain).map_err(|e| AppError::Validation(format!("json: {e}")))
}

fn vault_path(root: &Path) -> PathBuf {
    root.join(USB_KIT_DIR).join(VAULT_FILE)
}

fn audit_path(root: &Path) -> PathBuf {
    root.join(USB_KIT_DIR).join(AUDIT_FILE)
}

pub fn kit_root_from_exe() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn init_campaign_vault(
    root: &Path,
    passphrase: &str,
    install_mode: UsbInstallMode,
    slots: Vec<InstallPlan>,
) -> Result<UsbCampaignVault, AppError> {
    fs::create_dir_all(root.join(USB_KIT_DIR))
        .map_err(|e| AppError::Internal(format!("mkdir: {e}")))?;
    fs::create_dir_all(root.join(USB_KIT_DIR).join(PAYLOADS_DIR))
        .map_err(|e| AppError::Internal(format!("mkdir payloads: {e}")))?;
    let campaign_id = Uuid::new_v4().to_string();
    let chain_total = slots.len() as u32;
    let device_slots: Vec<DeviceSlot> = slots
        .into_iter()
        .enumerate()
        .map(|(i, plan)| DeviceSlot {
            slot_index: i as u32,
            plan,
            status: SlotStatus::Pending,
        })
        .collect();
    let campaign = UsbCampaignVault {
        schema_version: 1,
        campaign_id: campaign_id.clone(),
        install_mode,
        chain_total,
        chain_next_index: 0,
        slots: device_slots,
        created_at: Utc::now().to_rfc3339(),
    };
    let plain = VaultPlain {
        schema_version: VAULT_SCHEMA,
        password_verifier: password_verifier(passphrase)?,
        campaign: campaign.clone(),
    };
    let sealed = seal_json(passphrase, &plain)?;
    let json =
        serde_json::to_string_pretty(&sealed).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(vault_path(root), json).map_err(|e| AppError::Internal(format!("write vault: {e}")))?;
    let audit = AuditPlain {
        schema_version: AUDIT_SCHEMA,
        entries: vec![],
    };
    let audit_sealed = seal_json(passphrase, &audit)?;
    let audit_json =
        serde_json::to_string_pretty(&audit_sealed).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(audit_path(root), audit_json)
        .map_err(|e| AppError::Internal(format!("write audit: {e}")))?;
    Ok(campaign)
}

pub fn unlock_campaign(root: &Path, passphrase: &str) -> Result<UsbCampaignVault, AppError> {
    let raw = fs::read_to_string(vault_path(root))
        .map_err(|e| AppError::Validation(format!("vault missing: {e}")))?;
    let blob: SealedBlob =
        serde_json::from_str(&raw).map_err(|e| AppError::Validation(format!("vault json: {e}")))?;
    let plain: VaultPlain = open_json(passphrase, &blob)?;
    verify_password(passphrase, &plain.password_verifier)?;
    Ok(plain.campaign)
}

pub fn save_campaign(
    root: &Path,
    passphrase: &str,
    campaign: &UsbCampaignVault,
) -> Result<(), AppError> {
    let raw = fs::read_to_string(vault_path(root))
        .map_err(|e| AppError::Validation(format!("vault missing: {e}")))?;
    let blob: SealedBlob =
        serde_json::from_str(&raw).map_err(|e| AppError::Validation(format!("vault json: {e}")))?;
    let mut plain: VaultPlain = open_json(passphrase, &blob)?;
    verify_password(passphrase, &plain.password_verifier)?;
    plain.campaign = campaign.clone();
    let sealed = seal_json(passphrase, &plain)?;
    let json =
        serde_json::to_string_pretty(&sealed).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(vault_path(root), json).map_err(|e| AppError::Internal(format!("write vault: {e}")))?;
    Ok(())
}

pub fn append_audit_entry(
    root: &Path,
    passphrase: &str,
    entry: UsbInstallAuditEntry,
) -> Result<(), AppError> {
    let path = audit_path(root);
    let mut audit_plain = if path.exists() {
        let raw = fs::read_to_string(&path)?;
        let blob: SealedBlob = serde_json::from_str(&raw)
            .map_err(|e| AppError::Validation(format!("audit json: {e}")))?;
        open_json::<AuditPlain>(passphrase, &blob)?
    } else {
        AuditPlain {
            schema_version: AUDIT_SCHEMA,
            entries: vec![],
        }
    };
    audit_plain.entries.push(entry);
    let sealed = seal_json(passphrase, &audit_plain)?;
    let json =
        serde_json::to_string_pretty(&sealed).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(path, json).map_err(|e| AppError::Internal(format!("write audit: {e}")))?;
    Ok(())
}

pub fn read_audit_entries(
    root: &Path,
    passphrase: &str,
) -> Result<Vec<UsbInstallAuditEntry>, AppError> {
    let raw = fs::read_to_string(audit_path(root))
        .map_err(|e| AppError::Validation(format!("audit missing: {e}")))?;
    let blob: SealedBlob =
        serde_json::from_str(&raw).map_err(|e| AppError::Validation(format!("audit json: {e}")))?;
    let plain: AuditPlain = open_json(passphrase, &blob)?;
    Ok(plain.entries)
}

pub fn next_pending_slot(campaign: &UsbCampaignVault) -> Option<&DeviceSlot> {
    campaign
        .slots
        .iter()
        .find(|s| s.slot_index == campaign.chain_next_index && s.status == SlotStatus::Pending)
}

pub fn mark_slot_done(
    root: &Path,
    passphrase: &str,
    slot_index: u32,
) -> Result<UsbCampaignVault, AppError> {
    let mut campaign = unlock_campaign(root, passphrase)?;
    if let Some(slot) = campaign.slots.iter_mut().find(|s| s.slot_index == slot_index) {
        slot.status = SlotStatus::Done;
    }
    if campaign.chain_next_index == slot_index {
        campaign.chain_next_index = slot_index.saturating_add(1);
    }
    save_campaign(root, passphrase, &campaign)?;
    Ok(campaign)
}

pub fn host_fingerprint() -> String {
    let hostname = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "unknown".into());
    let digest = Sha256::digest(hostname.as_bytes());
    format!(
        "{}-{}",
        hostname,
        digest
            .iter()
            .take(8)
            .map(|b| format!("{b:02x}"))
            .collect::<String>()
    )
}

pub fn wipe_temp_dir(path: &Path) -> Result<(), AppError> {
    if path.exists() {
        fs::remove_dir_all(path)
            .map_err(|e| AppError::Internal(format!("wipe temp: {e}")))?;
    }
    Ok(())
}

pub fn make_temp_extract_dir() -> PathBuf {
    let id = Uuid::new_v4();
    std::env::temp_dir().join(format!("medoc-usb-{id}"))
}

pub fn write_sidecar_plan(plan: &InstallPlan, dest: &Path) -> Result<(), AppError> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::Internal(format!("mkdir sidecar: {e}")))?;
    }
    let sidecar = crate::infrastructure::install_plan::PendingInstallPlanSidecar {
        plan: plan.clone(),
        written_by_usb_setup: Some("medoc-usb-setup".into()),
        written_at: Utc::now().to_rfc3339(),
    };
    let json =
        serde_json::to_string_pretty(&sidecar).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(dest, json).map_err(|e| AppError::Internal(format!("write sidecar: {e}")))?;
    Ok(())
}

pub fn default_sidecar_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MeDoc")
        .join(crate::infrastructure::install_plan::PENDING_PLAN_SIDEcar_FILE)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::install_plan::InstallPlan;

    #[test]
    fn vault_roundtrip_and_audit_append() {
        let dir = std::env::temp_dir().join(format!("medoc-usb-test-{}", Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let pw = "test-passphrase";
        let plan = InstallPlan::new_master("Test");
        init_campaign_vault(&dir, pw, UsbInstallMode::Default, vec![plan.clone()]).unwrap();
        let campaign = unlock_campaign(&dir, pw).unwrap();
        assert_eq!(campaign.slots.len(), 1);
        append_audit_entry(
            &dir,
            pw,
            UsbInstallAuditEntry {
                id: Uuid::new_v4().to_string(),
                timestamp: Utc::now().to_rfc3339(),
                install_mode: UsbInstallMode::Default,
                slot_index: Some(0),
                host_fingerprint: "test".into(),
                hostname: "test".into(),
                role: plan.role,
                components: plan.components.clone(),
                plan_hash: plan.plan_hash(),
                success: true,
                error: None,
            },
        )
        .unwrap();
        let entries = read_audit_entries(&dir, pw).unwrap();
        assert_eq!(entries.len(), 1);
        let _ = fs::remove_dir_all(dir);
    }
}
