//! H1: FeatureDisabled is returned as HTTP 409.

use axum::http::StatusCode;
use axum::response::IntoResponse;
use medoc_core::error::AppError;
use medoc_lan::http::ApiError;

#[test]
fn feature_disabled_maps_to_409() {
    let response = ApiError::from(AppError::FeatureDisabled("scanner".into())).into_response();
    assert_eq!(response.status(), StatusCode::CONFLICT);
}
