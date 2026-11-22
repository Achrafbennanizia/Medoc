//! Request bodies of `/api/v1/sync/*` and the signature check every received change passes.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use medoc_sync::entry_signature::{verify_batch, SignedBatch};
use medoc_sync::repo::OutboxEntry;
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushBody {
    pub from_device_id: String,
    pub entries: Vec<OutboxEntry>,
    /// Ed25519 signatures of the sending device (absent from older versions).
    #[serde(flatten)]
    pub batch: SignedBatch,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullBody {
    pub device_id: String,
    pub since_seq: i64,
    pub requester_id: Option<String>,
    #[serde(default)]
    pub live_since_seq: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncExchangeBody {
    pub from_device_id: String,
    #[serde(default)]
    pub packets: Vec<OutboxEntry>,
    #[serde(default)]
    pub ack_through_seq: i64,
    #[serde(default)]
    pub queues: Vec<String>,
    #[serde(flatten)]
    pub batch: SignedBatch,
}

/// 403 with the error code when a signature is missing (and required), forged or by another key.
pub async fn verify_signed(
    pool: &SqlitePool,
    from_device_id: &str,
    entries: &[OutboxEntry],
    batch: &SignedBatch,
) -> Result<(), Response> {
    verify_batch(pool, from_device_id, entries, batch)
        .await
        .map(|_| ())
        .map_err(|e| {
            tracing::warn!(target: "medoc::lan", event = "LAN_SYNC_SIGNATURE_REJECTED", device_id = from_device_id, error = %e);
            (
                StatusCode::FORBIDDEN,
                Json(json!({"error": "forbidden", "reason": e.to_string()})),
            )
                .into_response()
        })
}
