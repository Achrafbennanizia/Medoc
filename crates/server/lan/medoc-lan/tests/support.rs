//! Shared in-process LAN router harness for medoc-lan integration tests.

#![allow(dead_code)]

use std::net::SocketAddr;
use std::sync::{Arc, OnceLock};

use axum::body::{Body, Bytes};
use axum::extract::ConnectInfo;
use axum::http::{Request, StatusCode};
use axum::Router;
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use http_body_util::BodyExt;
use medoc_core::infrastructure::database::connection;
use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
use medoc_core::infrastructure::license_repo;
use medoc_core::infrastructure::logging::brute_force::BruteForceTracker;
use medoc_lan::LanSystemFactory;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use sqlx::SqlitePool;
use tower::ServiceExt;

static TEST_ENV: OnceLock<()> = OnceLock::new();

const VENDOR_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

pub fn ensure_test_env() {
    TEST_ENV.get_or_init(|| {
        std::env::set_var("MEDOC_DEV_SEED", "1");
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        std::env::set_var(
            "MEDOC_PAIRING_MASTER_SECRET",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        std::env::set_var(
            "MEDOC_DB_KEY",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        std::env::set_var(
            "MEDOC_VENDOR_PUBKEY",
            "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
        );
        let audit_dir = std::env::temp_dir().join("medoc-lan-test-audit");
        let _ = std::fs::create_dir_all(&audit_dir);
        medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key(&audit_dir)
            .expect("init audit hmac key for LAN tests");
    });
}

fn connect_addr() -> SocketAddr {
    "127.0.0.1:54321".parse().expect("connect addr")
}

pub async fn seed_master_license(pool: &SqlitePool) {
    let device_id = medoc_sync::repo::ensure_local_device(pool, "LAN Test Master")
        .await
        .expect("device id");
    let mut bytes = [0u8; 32];
    for (i, chunk) in VENDOR_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    let lic = LicenseV2 {
        version: 2,
        customer_id: "lan-test".into(),
        edition: "PRO".into(),
        device_id: device_id.clone(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 26, 12, 0, 0).unwrap(),
        max_users: 5,
        modules: vec![],
        edition_features: vec![],
    };
    let body = serde_json::to_string(&lic).unwrap();
    let sig = sk.sign(body.as_bytes());
    let signed = format!("{body}.{}", STANDARD_NO_PAD.encode(sig.to_bytes()));
    let envelope = encrypt_v2_for_device(&signed, &device_id).expect("encrypt");
    license_repo::store_v2(pool, &envelope)
        .await
        .expect("store license");
    let deploy = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Master,
        device_label: "LAN Test Master".into(),
        ..Default::default()
    };
    SyncEngine::set_deployment(pool, deploy)
        .await
        .expect("master deployment");
}

pub async fn licensed_master_pool() -> SqlitePool {
    ensure_test_env();
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    medoc_sync::schema::ensure_sync_tables(&pool)
        .await
        .expect("sync schema");
    seed_master_license(&pool).await;
    pool
}

pub struct LanTestHarness {
    router: Router,
    connect: SocketAddr,
    pub pool: SqlitePool,
    jwt_secret: Arc<[u8; 32]>,
}

impl LanTestHarness {
    pub async fn licensed_master() -> Self {
        Self::from_pool(licensed_master_pool().await).await
    }

    pub async fn unlicensed_master() -> Self {
        ensure_test_env();
        let pool = connection::test_memory_pool().await.expect("pool");
        connection::run_migrations(&pool).await.expect("migrate");
        medoc_sync::repo::ensure_local_device(&pool, "Unlicensed")
            .await
            .expect("device");
        Self::from_pool(pool).await
    }

    async fn from_pool(pool: SqlitePool) -> Self {
        let jwt_secret = Arc::new([42u8; 32]);
        let brute = Arc::new(BruteForceTracker::new());
        let state = LanSystemFactory::build_state(
            pool.clone(),
            jwt_secret.clone(),
            brute,
            8787,
            vec![],
            vec![],
        );
        Self {
            router: LanSystemFactory::build_router(state),
            connect: connect_addr(),
            pool,
            jwt_secret,
        }
    }

    pub fn ops_jwt(&self) -> String {
        medoc_lan::jwt::issue_token(
            self.jwt_secret.as_ref(),
            "seed-physician-001",
            "ops@test",
            "PHYSICIAN",
        )
        .expect("jwt")
    }

    pub fn slave_pubkey(seed: u8) -> String {
        let sk = ed25519_dalek::SigningKey::from_bytes(&[seed; 32]);
        medoc_sync::master_keys::pubkey_b64(&sk)
    }

    pub async fn json(
        &mut self,
        method: &str,
        path: &str,
        body: Option<&serde_json::Value>,
        bearer: Option<&str>,
    ) -> (StatusCode, serde_json::Value) {
        self.request(method, path, body, bearer).await
    }

    pub async fn request(
        &mut self,
        method: &str,
        path: &str,
        body: Option<&serde_json::Value>,
        bearer: Option<&str>,
    ) -> (StatusCode, serde_json::Value) {
        let mut builder = Request::builder().method(method).uri(path);
        if let Some(token) = bearer {
            builder = builder.header("Authorization", format!("Bearer {token}"));
        }
        let req = if let Some(json) = body {
            builder
                .header("content-type", "application/json")
                .body(Body::from(json.to_string()))
                .expect("request body")
        } else if method == "POST" {
            builder
                .header("content-type", "application/json")
                .body(Body::from("{}"))
                .expect("empty json post")
        } else {
            builder.body(Body::empty()).expect("empty body")
        };
        let mut req = req;
        req.extensions_mut().insert(ConnectInfo(self.connect));
        let resp = self.router.clone().oneshot(req).await.expect("oneshot");
        let status = resp.status();
        let bytes: Bytes = resp
            .into_body()
            .collect()
            .await
            .expect("collect")
            .to_bytes();
        let value = if bytes.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|_| serde_json::json!({ "raw": String::from_utf8_lossy(&bytes) }))
        };
        (status, value)
    }

    pub async fn post_raw(&mut self, path: &str, raw_body: &str) -> StatusCode {
        let mut req = Request::builder()
            .method("POST")
            .uri(path)
            .header("content-type", "application/json")
            .header("Authorization", format!("Bearer {}", self.ops_jwt()))
            .body(Body::from(raw_body.to_string()))
            .expect("body");
        req.extensions_mut().insert(ConnectInfo(self.connect));
        self.router
            .clone()
            .oneshot(req)
            .await
            .expect("oneshot")
            .status()
    }
}
