//! F76/F85: cluster-wide document numbers.
//!
//! On the master (or a standalone install) numbers come from the local
//! `number_sequence` table. A replica asks the master over the pinned LAN
//! channel, so two devices never hand out the same invoice or order number.
//! A replica-local counter is what produced duplicate numbers before, so there is
//! no local counter. The one offline fallback is Group's second admin hub (T4.3):
//! it holds number blocks reserved by the primary (`number_sequence::blocks`) and
//! issues from them only while the primary is unreachable.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::number_sequence::blocks::{self, NumberBlock};
use medoc_core::infrastructure::database::number_sequence::{self, NumberStyle};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::deployment::{DeviceRole, SyncDeploymentConfig};

#[derive(Deserialize)]
struct NumberReply {
    number: String,
}

fn is_replica(d: &SyncDeploymentConfig) -> bool {
    d.role == DeviceRole::Replica && !d.master_base_url.trim().is_empty()
}

fn bearer(d: &SyncDeploymentConfig) -> Result<String, AppError> {
    if !d.activation_token.trim().is_empty() {
        return Ok(d.activation_token.trim().to_string());
    }
    if !d.master_access_token.trim().is_empty() {
        return Ok(d.master_access_token.trim().to_string());
    }
    Err(AppError::Validation(
        "Replica not paired — complete the pairing flow".into(),
    ))
}

/// `1` once the primary refused this device a number block (not a second admin hub).
const BLOCK_REFUSED_KV: &str = "numbering.block_refused.v1";

/// Group builds: this device may hold number blocks if the primary grants them.
fn may_hold_blocks() -> bool {
    medoc_core::edition::CORE_CAPS.multi_admin
}

pub async fn allocate_document_number(
    pool: &SqlitePool,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
) -> Result<String, AppError> {
    let deployment = crate::repo::load_deployment(pool).await?;
    if !is_replica(&deployment) {
        return number_sequence::allocate_styled(pool, prefix, ymd, style).await;
    }
    let holder = if may_hold_blocks() {
        crate::repo::ensure_local_device(pool, &deployment.device_label).await?
    } else {
        String::new()
    };
    match ask_main(pool, &deployment, prefix, ymd, style).await {
        Ok(number) => {
            if may_hold_blocks() && !holder.is_empty() {
                refill_block(pool, &deployment, prefix, ymd, style, &holder).await;
            }
            Ok(number)
        }
        Err(Ask::Unreachable(err)) if may_hold_blocks() && !holder.is_empty() => {
            match blocks::take(pool, prefix, ymd, style, &holder).await? {
                Some(number) => Ok(number),
                None => Err(err),
            }
        }
        Err(Ask::Unreachable(err) | Ask::Refused(err)) => Err(err),
    }
}

enum Ask {
    /// The primary could not be reached: hub B may use its block.
    Unreachable(AppError),
    /// The primary answered with an error: never fall back.
    Refused(AppError),
}

async fn ask_main(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
) -> Result<String, Ask> {
    let client = crate::engine::master_http_client_for_reconcile(pool, deployment)
        .await
        .map_err(Ask::Refused)?;
    let url = crate::paths::api_url(&deployment.master_base_url, crate::paths::SYNC_NUMBER);
    let resp = client
        .post(&url)
        .bearer_auth(bearer(deployment).map_err(Ask::Refused)?)
        .json(&serde_json::json!({ "prefix": prefix, "date": ymd, "style": style.as_str() }))
        .send()
        .await
        .map_err(|e| {
            Ask::Unreachable(AppError::Validation(format!(
                "Main device not reachable — document numbers are issued by the main device ({e})"
            )))
        })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(Ask::Refused(AppError::Validation(format!(
            "Main device refused number allocation ({status}): {body}"
        ))));
    }
    let reply: NumberReply = resp
        .json()
        .await
        .map_err(|e| Ask::Refused(AppError::Internal(format!("number reply: {e}"))))?;
    if reply.number.trim().is_empty() {
        return Err(Ask::Refused(AppError::Internal(
            "empty number from main device".into(),
        )));
    }
    Ok(reply.number)
}

/// Hub B, online: ask for a new block when less than half of one is left. Best effort: a
/// failure only means the next offline number may be refused.
async fn refill_block(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    prefix: &str,
    ymd: &str,
    style: NumberStyle,
    holder: &str,
) {
    if app_kv_repo::get(pool, BLOCK_REFUSED_KV)
        .await
        .ok()
        .flatten()
        .as_deref()
        == Some("1")
    {
        return;
    }
    let left = blocks::remaining(pool, prefix, ymd, style, holder)
        .await
        .unwrap_or(0);
    if left * 2 >= blocks::DEFAULT_BLOCK_SIZE {
        return;
    }
    let result: Result<(), AppError> = async {
        let client = crate::engine::master_http_client_for_reconcile(pool, deployment).await?;
        let url =
            crate::paths::api_url(&deployment.master_base_url, crate::paths::SYNC_NUMBER_BLOCK);
        let resp = client
            .post(&url)
            .bearer_auth(bearer(deployment)?)
            .json(&serde_json::json!({
                "prefix": prefix,
                "date": ymd,
                "style": style.as_str(),
                "size": blocks::DEFAULT_BLOCK_SIZE,
            }))
            .send()
            .await
            .map_err(|e| AppError::Validation(format!("number block: {e}")))?;
        if resp.status() == reqwest::StatusCode::FORBIDDEN {
            app_kv_repo::set(pool, BLOCK_REFUSED_KV, "1").await?;
            return Ok(());
        }
        if !resp.status().is_success() {
            return Err(AppError::Validation(format!(
                "number block refused ({})",
                resp.status()
            )));
        }
        let block: NumberBlock = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("number block reply: {e}")))?;
        blocks::keep(pool, &block, holder).await
    }
    .await;
    if let Err(e) = result {
        tracing::warn!(target: "medoc::sync", event = "NUMBER_BLOCK_REFILL_FAILED", error = %e);
    }
}
