//! Signed change envelopes: every change a device sends is signed with its Ed25519 device key.
//!
//! Changes are captured offline in `sync_outbox` (transactional outbox) and signed when they are
//! sent, so a device signs once it is online again. The receiver checks every signature before it
//! applies anything (LWW merge, `merge.rs`) and pins each device's key:
//!
//! 1. the key from the accepted pairing request of that device, else
//! 2. the first key seen from that device (trust on first use), stored in `sync_device_key`.
//!
//! A later batch signed by another key, or a change whose content was altered on the way
//! (payload hash in the signed bytes), is refused as a whole. Unsigned batches from older
//! versions are accepted and counted until the main device sets [`REQUIRE_SIGNED_KV`] to `1`.

use base64::engine::general_purpose::STANDARD_NO_PAD as B64;
use base64::Engine;
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::repo::OutboxEntry;

/// `1` on the receiving device: refuse unsigned batches (all devices run a signing version).
pub const REQUIRE_SIGNED_KV: &str = "sync.require_signed_entries.v1";
const DOMAIN: &str = "medoc-sync-entry-v1";

/// Signature of one entry, sent next to the entries (`signatures` in the push / exchange body).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntrySignature {
    pub id: String,
    pub sig: String,
}

/// Signer key and per-entry signatures for one batch.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignedBatch {
    #[serde(default)]
    pub signer: Option<String>,
    #[serde(default)]
    pub signatures: Vec<EntrySignature>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BatchTrust {
    /// Every entry carries a valid signature by the device's pinned key.
    Signed,
    /// Older sender without signatures; accepted because signing is not required yet.
    UnsignedAccepted,
    Empty,
}

/// The exact bytes signed for one entry. The payload is covered by its SHA-256.
pub fn canonical_bytes(entry: &OutboxEntry) -> Vec<u8> {
    let payload_hash = hex(&Sha256::digest(entry.payload_json.as_bytes()));
    format!(
        "{DOMAIN}\n{}\n{}\n{}\n{}\n{}\n{}\n{}",
        entry.device_id,
        entry.seq,
        entry.entity_table,
        entry.entity_id,
        entry.op,
        entry.created_at,
        payload_hash
    )
    .into_bytes()
}

pub fn sign_batch(key: &SigningKey, entries: &[OutboxEntry]) -> SignedBatch {
    SignedBatch {
        signer: Some(B64.encode(key.verifying_key().to_bytes())),
        signatures: entries
            .iter()
            .map(|e| EntrySignature {
                id: e.id.clone(),
                sig: B64.encode(key.sign(&canonical_bytes(e)).to_bytes()),
            })
            .collect(),
    }
}

/// This device's batch signature, or an unsigned batch when no device key is provisioned yet.
pub fn sign_outgoing(entries: &[OutboxEntry]) -> SignedBatch {
    match crate::cluster::crypto::device_identity::DeviceIdentity::try_load() {
        Ok(Some(identity)) => sign_batch(identity.signing_key(), entries),
        Ok(None) | Err(_) => {
            tracing::warn!(target: "medoc::sync", event = "SYNC_SEND_UNSIGNED", entries = entries.len());
            SignedBatch::default()
        }
    }
}

/// Push / exchange request body: the entries plus their signatures.
pub fn signed_body(
    from_device_id: &str,
    field: &str,
    entries: &[OutboxEntry],
) -> serde_json::Value {
    let batch = sign_outgoing(entries);
    serde_json::json!({
        "fromDeviceId": from_device_id,
        field: entries,
        "signer": batch.signer,
        "signatures": batch.signatures,
    })
}

/// Check a received batch before any entry is applied.
pub async fn verify_batch(
    pool: &SqlitePool,
    from_device_id: &str,
    entries: &[OutboxEntry],
    batch: &SignedBatch,
) -> Result<BatchTrust, AppError> {
    if entries.is_empty() {
        return Ok(BatchTrust::Empty);
    }
    let Some(signer) = batch
        .signer
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    else {
        if require_signed(pool).await {
            return Err(AppError::validation_code("error.sync.unsigned_changes"));
        }
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_UNSIGNED_BATCH_ACCEPTED",
            device_id = from_device_id,
            entries = entries.len()
        );
        return Ok(BatchTrust::UnsignedAccepted);
    };
    let key = decode_key(signer)?;
    pin_device_key(pool, from_device_id, signer).await?;
    for entry in entries {
        let sig = batch
            .signatures
            .iter()
            .find(|s| s.id == entry.id)
            .ok_or_else(|| AppError::validation_code("error.sync.change_signature_invalid"))?;
        let sig = decode_sig(&sig.sig)?;
        key.verify(&canonical_bytes(entry), &sig)
            .map_err(|_| AppError::validation_code("error.sync.change_signature_invalid"))?;
    }
    Ok(BatchTrust::Signed)
}

async fn require_signed(pool: &SqlitePool) -> bool {
    matches!(app_kv_repo::get(pool, REQUIRE_SIGNED_KV).await, Ok(Some(v)) if v.trim() == "1")
}

/// The key this device is known by: pairing key, else the first key it signed with.
async fn pin_device_key(pool: &SqlitePool, device_id: &str, signer: &str) -> Result<(), AppError> {
    ensure_table(pool).await?;
    let paired: Option<String> = sqlx::query_scalar(
        "SELECT slave_pubkey FROM pairing_request WHERE device_id = ?1 AND status = 'ACCEPTED'
         ORDER BY decided_at DESC LIMIT 1",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let pinned: Option<String> =
        sqlx::query_scalar("SELECT pubkey FROM sync_device_key WHERE device_id = ?1")
            .bind(device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    let expected = pinned.or_else(|| paired.filter(|k| same_key(k, signer)));
    match expected {
        Some(k) if !same_key(&k, signer) => {
            tracing::error!(target: "medoc::sync", event = "SYNC_SIGNER_MISMATCH", device_id);
            Err(AppError::validation_code(
                "error.sync.change_signer_unknown",
            ))
        }
        Some(_) => Ok(()),
        None => {
            sqlx::query(
                "INSERT OR IGNORE INTO sync_device_key (device_id, pubkey, first_seen_at)
                 VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
            )
            .bind(device_id)
            .bind(signer)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
            Ok(())
        }
    }
}

async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_device_key (
            device_id TEXT PRIMARY KEY,
            pubkey TEXT NOT NULL,
            first_seen_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Pairing stores keys base64 with or without padding; compare the raw bytes.
fn same_key(a: &str, b: &str) -> bool {
    match (decode_raw(a), decode_raw(b)) {
        (Some(x), Some(y)) => x == y,
        _ => a.trim() == b.trim(),
    }
}

fn decode_raw(s: &str) -> Option<Vec<u8>> {
    B64.decode(s.trim().trim_end_matches('=')).ok()
}

fn decode_key(s: &str) -> Result<VerifyingKey, AppError> {
    let raw = decode_raw(s)
        .ok_or_else(|| AppError::validation_code("error.sync.change_signer_unknown"))?;
    let arr: [u8; 32] = raw
        .try_into()
        .map_err(|_| AppError::validation_code("error.sync.change_signer_unknown"))?;
    VerifyingKey::from_bytes(&arr)
        .map_err(|_| AppError::validation_code("error.sync.change_signer_unknown"))
}

fn decode_sig(s: &str) -> Result<Signature, AppError> {
    let raw = decode_raw(s)
        .ok_or_else(|| AppError::validation_code("error.sync.change_signature_invalid"))?;
    let arr: [u8; 64] = raw
        .try_into()
        .map_err(|_| AppError::validation_code("error.sync.change_signature_invalid"))?;
    Ok(Signature::from_bytes(&arr))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
