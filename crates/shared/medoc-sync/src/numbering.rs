//! F76/F85: cluster-wide document numbers.
//!
//! On the master (or a standalone install) numbers come from the local
//! `number_sequence` table. A replica asks the master over the pinned LAN
//! channel, so two devices never hand out the same invoice or order number.
//! There is no offline fallback on purpose: a replica-local counter is what
//! produced duplicate numbers before.

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::number_sequence::{self, NumberStyle};
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
    let client = crate::engine::master_http_client_for_reconcile(pool, &deployment).await?;
    let url = format!(
        "{}/api/v1/sync/number",
        deployment.master_base_url.trim_end_matches('/')
    );
    let resp = client
        .post(&url)
        .bearer_auth(bearer(&deployment)?)
        .json(&serde_json::json!({ "prefix": prefix, "date": ymd, "style": style.as_str() }))
        .send()
        .await
        .map_err(|e| {
            AppError::Validation(format!(
                "Main device not reachable — document numbers are issued by the main device ({e})"
            ))
        })?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Validation(format!(
            "Main device refused number allocation ({status}): {body}"
        )));
    }
    let reply: NumberReply = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("number reply: {e}")))?;
    if reply.number.trim().is_empty() {
        return Err(AppError::Internal("empty number from main device".into()));
    }
    Ok(reply.number)
}
