//! Number allocation endpoints: single numbers and offline blocks for the second admin hub (split from `sync.rs`).

use super::*;

/// Maps a request path to its activation-token action name. Returning
/// `""` means: activation tokens are **not accepted** on this route.
#[derive(Debug, Deserialize)]
pub struct NumberAllocBody {
    prefix: String,
    #[serde(alias = "ymd")]
    date: String,
    #[serde(default)]
    style: Option<String>,
}

pub async fn sync_number(
    State(state): State<LanHttpState>,
    Json(body): Json<NumberAllocBody>,
) -> Result<Json<serde_json::Value>, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let style = medoc_core::infrastructure::database::number_sequence::NumberStyle::parse(
        body.style.as_deref(),
    )
    .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    let number = medoc_core::infrastructure::database::number_sequence::allocate_styled(
        &state.pool,
        &body.prefix,
        &body.date,
        style,
    )
    .await
    .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    Ok(Json(json!({ "number": number })))
}

#[derive(Deserialize)]
pub struct NumberBlockBody {
    prefix: String,
    #[serde(alias = "ymd")]
    date: String,
    #[serde(default)]
    style: Option<String>,
    #[serde(default)]
    size: Option<i64>,
}

/// Group (T4.3): reserve a number block for the second admin hub that calls. Only a device
/// whose pairing grant lists `sync.number_block` gets one (the middleware checks the grant).
pub async fn sync_number_block(
    State(state): State<LanHttpState>,
    Extension(token): Extension<ActivationTokenPayload>,
    Json(body): Json<NumberBlockBody>,
) -> Result<
    Json<medoc_core::infrastructure::database::number_sequence::blocks::NumberBlock>,
    Response,
> {
    use medoc_core::infrastructure::database::number_sequence::{blocks, NumberStyle};
    if !medoc_core::edition::CORE_CAPS.multi_admin {
        return Err(forbidden("number_block_not_in_edition"));
    }
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    let style = NumberStyle::parse(body.style.as_deref())
        .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    let block = blocks::reserve(
        &state.pool,
        &body.prefix,
        &body.date,
        style,
        body.size.unwrap_or(blocks::DEFAULT_BLOCK_SIZE),
        &token.device_id,
    )
    .await
    .map_err(|e| sync_error(StatusCode::BAD_REQUEST, e.to_string(), ""))?;
    Ok(Json(block))
}
