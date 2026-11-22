//! Cross-cutting HTTP concerns for the LAN API, applied once to the whole router:
//! request ids, structured request logging, and response headers.
//!
//! - **Request id**: accepts a well-formed `x-request-id` from the client or creates one, stores it as a
//!   request extension (handlers and `ApiError` can read it) and echoes it on the response. The same id is
//!   in the `network.log` line, so a failing client call and the server line are joined by one value.
//! - **Logging** (`target: medoc::http` → network.log): one line per failed (4xx/5xx), slow or mutating
//!   request. Successful polling (`GET /sync/status`, `/ping`) stays at debug so it never floods the file.
//!   The route is the *template* (`/api/v1/pairing/status/{id}`), never the raw path with ids.
//! - **Headers**: `x-medoc-api-version` (clients can detect the contract they talk to),
//!   `cache-control: no-store` (responses carry patient data), `x-content-type-options: nosniff`.

use std::time::Instant;

use axum::extract::{MatchedPath, Request};
use axum::http::{HeaderName, HeaderValue, Method};
use axum::middleware::Next;
use axum::response::Response;

/// Bumped only for breaking changes; additive changes keep the number (see docs/architecture/lan-api.md).
pub const API_VERSION: &str = "1";
pub const REQUEST_ID_HEADER: &str = "x-request-id";
const SLOW_REQUEST_MS: u128 = 1_500;

/// Request id of the current request (request extension).
#[derive(Clone, Debug)]
pub struct RequestId(pub String);

fn valid_client_id(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= 64
        && v.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

pub async fn request_context(mut req: Request, next: Next) -> Response {
    let started = Instant::now();
    let id = req
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .filter(|v| valid_client_id(v))
        .map(str::to_owned)
        .unwrap_or_else(medoc_core::error::correlation_ref);
    let method = req.method().clone();
    let route = req
        .extensions()
        .get::<MatchedPath>()
        .map(|m| m.as_str().to_owned())
        .unwrap_or_else(|| "<unmatched>".into());
    req.extensions_mut().insert(RequestId(id.clone()));

    let mut res = next.run(req).await;

    let status = res.status().as_u16();
    let elapsed_ms = started.elapsed().as_millis();
    let mutating = !matches!(method, Method::GET | Method::HEAD | Method::OPTIONS);
    if status >= 500 {
        tracing::error!(target: "medoc::http", event = "HTTP_REQUEST_FAILED", request_id = %id, method = %method, route = %route, status, elapsed_ms);
    } else if status >= 400 {
        tracing::warn!(target: "medoc::http", event = "HTTP_REQUEST_REJECTED", request_id = %id, method = %method, route = %route, status, elapsed_ms);
    } else if elapsed_ms >= SLOW_REQUEST_MS {
        tracing::warn!(target: "medoc::perf", event = "HTTP_REQUEST_SLOW", request_id = %id, method = %method, route = %route, status, elapsed_ms);
    } else if mutating {
        tracing::info!(target: "medoc::http", event = "HTTP_REQUEST", request_id = %id, method = %method, route = %route, status, elapsed_ms);
    } else {
        tracing::debug!(target: "medoc::http", event = "HTTP_REQUEST", request_id = %id, method = %method, route = %route, status, elapsed_ms);
    }

    let headers = res.headers_mut();
    if let Ok(v) = HeaderValue::from_str(&id) {
        headers.insert(HeaderName::from_static(REQUEST_ID_HEADER), v);
    }
    headers.insert(
        HeaderName::from_static("x-medoc-api-version"),
        HeaderValue::from_static(API_VERSION),
    );
    headers
        .entry(axum::http::header::CACHE_CONTROL)
        .or_insert(HeaderValue::from_static("no-store"));
    headers.insert(
        axum::http::header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    res
}

#[cfg(test)]
mod tests {
    use super::valid_client_id;

    #[test]
    fn only_short_token_ids_are_accepted_from_clients() {
        assert!(valid_client_id("AB12CD34"));
        assert!(valid_client_id("req_2026-11-21"));
        assert!(!valid_client_id(""));
        assert!(!valid_client_id("has space"));
        assert!(!valid_client_id("line\nbreak"));
        assert!(!valid_client_id(&"x".repeat(65)));
    }
}
