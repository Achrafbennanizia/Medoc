//! Attachment blobs: download (with resume, `Range`) and upload (split from `sync.rs`).

use super::*;

pub async fn sync_blob_get(
    State(state): State<LanHttpState>,
    Path(sha256): Path<String>,
    headers: axum::http::HeaderMap,
) -> Result<Response, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    medoc_core::infrastructure::database::sync_blob::get_bytes(&state.pool, &sha256)
        .await
        .map(|bytes| crate::http::blob_range::respond(&headers, bytes))
        .map_err(|e| ApiError(e).into_response())
}

pub async fn sync_blob_put(
    State(state): State<LanHttpState>,
    Path(sha256): Path<String>,
    body: Bytes,
) -> Result<StatusCode, Response> {
    if master_license::require_master_license(&state.pool)
        .await
        .is_err()
    {
        return Err(forbidden("master_license_required"));
    }
    if body.len() > 200 * 1024 * 1024 {
        return Err(StatusCode::PAYLOAD_TOO_LARGE.into_response());
    }
    medoc_core::infrastructure::database::sync_blob::put_verified(&state.pool, &sha256, &body)
        .await
        .map_err(|e| ApiError(e).into_response())?;
    Ok(StatusCode::NO_CONTENT)
}
