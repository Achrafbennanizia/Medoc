//! CORS allowlist + explicit 403 on disallowed `Origin`.

use std::sync::Arc;

use axum::http::{header, StatusCode};
use medoc_lib::infrastructure::company_host::db::init_company_db;
use medoc_lib::infrastructure::company_host::http::build_company_router;
use medoc_lib::infrastructure::cors_policy;
use medoc_lib::infrastructure::database::connection;
use medoc_lib::infrastructure::lan_server::discovery::LanBeaconPayload;
use medoc_lib::infrastructure::lan_server::http::{self, LanHttpState};
use medoc_lib::infrastructure::logging::brute_force::BruteForceTracker;
use tower::ServiceExt;

#[tokio::test]
async fn lan_rejects_unknown_origin_with_403() {
    let dir = std::env::temp_dir().join(format!("medoc-cors-lan-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let pool = connection::init_db_headless(&dir).await.unwrap();
    let jwt =
        medoc_lib::infrastructure::lan_server::secrets::ensure_jwt_secret_bytes(&dir).unwrap();

    let state = LanHttpState {
        pool,
        jwt_secret: Arc::new(jwt),
        brute: Arc::new(BruteForceTracker::new()),
        http_port: 9443,
        extra_cors_origins: Arc::new(vec![]),
        discovery_peers: Arc::new(vec![]),
    };
    let app = http::build_router(state);

    let res = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/health")
                .header(header::ORIGIN, "https://evil.example")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    let _ = std::fs::remove_dir_all(dir);
}

#[tokio::test]
async fn lan_allows_loopback_origin() {
    let allowed = cors_policy::lan_allowed_origin_strings(9443, &[], &[]);
    assert!(allowed.iter().any(|o| o.contains("127.0.0.1")));
    assert!(allowed.contains(&"https://127.0.0.1:9443".to_string()));
}

#[tokio::test]
async fn company_rejects_any_origin() {
    let dir = std::env::temp_dir().join(format!("medoc-cors-co-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let db_path = dir.join("company.db");
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    medoc_lib::infrastructure::database::audit_repo::init_audit_hmac_key(&dir).unwrap();
    let pool = init_company_db(&db_path).await.unwrap();
    let app = build_company_router(pool).await;

    let res = app
        .oneshot(
            axum::http::Request::builder()
                .uri("/health")
                .header(header::ORIGIN, "https://praxis.example")
                .body(axum::body::Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
fn discovery_peer_adds_lan_https_origin() {
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    let peer = SocketAddr::new(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 50)), 5353);
    let beacon = LanBeaconPayload {
        schema: "medoc-lan-v1".into(),
        version: "0.0.0".into(),
        http_port: 9443,
        instance_id: "x".into(),
        label: "lab".into(),
        tls: true,
        cert_sha256: String::new(),
        advertised_host: String::new(),
    };
    let origins = cors_policy::lan_allowed_origin_strings(9443, &[], &[(peer, beacon)]);
    assert!(origins.contains(&"https://192.168.1.50:9443".to_string()));
}
