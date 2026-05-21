//! LAN HTTPS bind + health endpoint (self-signed).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use medoc_lib::infrastructure::database::connection;
use medoc_lib::infrastructure::lan_server::http::{self, LanHttpState};
use medoc_lib::infrastructure::lan_server::tls;
use medoc_lib::infrastructure::logging::brute_force::BruteForceTracker;

#[tokio::test]
async fn https_health_returns_ok() {
    let dir = std::env::temp_dir().join(format!("medoc-lan-tls-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let pool = connection::init_db_headless(&dir).await.unwrap();
    let jwt =
        medoc_lib::infrastructure::lan_server::secrets::ensure_jwt_secret_bytes(&dir).unwrap();
    let identity = tls::ensure_lan_tls_identity(&dir).unwrap();
    assert!(!identity.sha256_fingerprint.is_empty());

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    let state = LanHttpState {
        pool,
        jwt_secret: Arc::new(jwt),
        brute: Arc::new(BruteForceTracker::new()),
        http_port: addr.port(),
        extra_cors_origins: Arc::new(vec![]),
        discovery_peers: Arc::new(vec![]),
    };
    let router = http::build_router(state);

    let shutdown = Arc::new(AtomicBool::new(false));
    let sd = shutdown.clone();
    let id = identity.clone();
    let serve = tokio::spawn(async move { tls::serve_tls_router(addr, &id, router, sd).await });

    tokio::time::sleep(Duration::from_millis(400)).await;

    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .ok();

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .unwrap();
    let url = format!("https://{addr}/health");
    let res = client.get(&url).send().await.expect("https get");
    assert!(res.status().is_success());
    let body: serde_json::Value = res.json().await.unwrap();
    assert_eq!(body.get("status").and_then(|v| v.as_str()), Some("ok"));

    shutdown.store(true, Ordering::SeqCst);
    let _ = tokio::time::timeout(Duration::from_secs(5), serve).await;
    let _ = std::fs::remove_dir_all(&dir);
}
