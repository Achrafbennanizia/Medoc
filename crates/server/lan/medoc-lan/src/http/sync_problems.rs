//! Conflict inbox over the LAN API (T3.3): list, retry and dismiss sync problems (split from `mod.rs`).

use super::*;

#[derive(Deserialize)]
pub struct SyncProblemsQuery {
    #[serde(default)]
    pub all: bool,
}

/// Changes that could not be applied or sent, for the admin to resolve.
pub(super) async fn sync_problems_list(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Query(q): Query<SyncProblemsQuery>,
) -> Result<Json<Vec<medoc_sync::problems::SyncProblem>>, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    Ok(Json(medoc_sync::problems::list(&state.pool, q.all).await?))
}

pub(super) async fn sync_problem_retry(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    medoc_sync::problems::retry(&state.pool, &id, &claims.sub).await?;
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn sync_problem_dismiss(
    State(state): State<LanHttpState>,
    Extension(claims): Extension<jwt::LanClaims>,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    require_claims(&state.pool, &claims, "ops.system").await?;
    medoc_sync::problems::dismiss(&state.pool, &id, &claims.sub).await?;
    Ok(StatusCode::NO_CONTENT)
}
