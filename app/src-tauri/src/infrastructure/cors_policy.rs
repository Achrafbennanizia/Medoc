//! Explicit CORS allowlists for HTTP servers (audit TASK 1.4).

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;

use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use if_addrs::IfAddr;
use serde_json::json;
use tower_http::cors::{AllowOrigin, CorsLayer};

use crate::infrastructure::lan_server::discovery::LanBeaconPayload;

/// Origins allowed for the LAN API: loopback, local Vite/Tauri dev, LAN interface HTTPS, optional extras.
pub fn lan_allowed_origin_strings(
    http_port: u16,
    extra: &[String],
    discovery_peers: &[(SocketAddr, LanBeaconPayload)],
) -> Vec<String> {
    let mut out = vec![
        format!("https://127.0.0.1:{http_port}"),
        format!("http://127.0.0.1:{http_port}"),
        format!("https://localhost:{http_port}"),
        format!("http://localhost:{http_port}"),
        "tauri://localhost".into(),
        "http://127.0.0.1:1420".into(),
        "https://127.0.0.1:1420".into(),
        "http://localhost:1420".into(),
        "https://localhost:1420".into(),
        "http://127.0.0.1:5173".into(),
        "http://localhost:5173".into(),
    ];
    for iface in if_addrs::get_if_addrs().unwrap_or_default() {
        if let IfAddr::V4(v4) = iface.addr {
            if v4.ip.is_loopback() {
                continue;
            }
            out.push(format!("https://{}:{http_port}", v4.ip));
            out.push(format!("http://{}:1420", v4.ip));
        }
    }
    for (addr, beacon) in discovery_peers {
        let ip = addr.ip();
        out.push(format!("https://{ip}:{}", beacon.http_port));
        out.push(format!("http://{ip}:1420"));
    }
    out.extend(extra.iter().cloned());
    out.sort();
    out.dedup();
    out
}

pub fn lan_cors_layer(allowed: &[String]) -> CorsLayer {
    let headers: Vec<HeaderValue> = allowed.iter().filter_map(|s| s.parse().ok()).collect();
    CorsLayer::new()
        .allow_origin(AllowOrigin::list(headers))
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            axum::http::HeaderName::from_static("x-practice-slug"),
        ])
}

/// Company portal: no browser CORS surface (deny all `Origin` headers).
pub fn company_cors_layer() -> CorsLayer {
    CorsLayer::new().allow_origin(AllowOrigin::predicate(|_origin, _| false))
}

#[derive(Clone)]
pub struct CorsGate {
    allowed: Arc<HashSet<String>>,
}

impl CorsGate {
    pub fn lan(
        http_port: u16,
        extra: &[String],
        discovery_peers: &[(SocketAddr, LanBeaconPayload)],
    ) -> Self {
        let set = lan_allowed_origin_strings(http_port, extra, discovery_peers)
            .into_iter()
            .collect();
        Self {
            allowed: Arc::new(set),
        }
    }

    pub fn company() -> Self {
        Self {
            allowed: Arc::new(HashSet::new()),
        }
    }
}

pub async fn cors_origin_gate_middleware(
    gate: axum::extract::State<CorsGate>,
    req: axum::extract::Request,
    next: Next,
) -> Result<Response, Response> {
    if let Some(origin) = req
        .headers()
        .get(header::ORIGIN)
        .and_then(|v| v.to_str().ok())
    {
        if !gate.allowed.contains(origin) {
            return Err((
                StatusCode::FORBIDDEN,
                Json(json!({ "error": "CORS origin not allowed" })),
            )
                .into_response());
        }
    }
    Ok(next.run(req).await)
}
