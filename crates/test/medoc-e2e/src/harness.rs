//! In-process Axum test clients for LAN + company servers.

use std::net::SocketAddr;
use std::sync::{Arc, OnceLock};

use axum::body::{Body, Bytes};
use axum::extract::ConnectInfo;
use axum::http::{Request, Response, StatusCode};
use axum::Router;
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{NaiveDate, TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use http_body_util::BodyExt;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Geschlecht;
use medoc_core::infrastructure::database::connection;
use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
use medoc_core::infrastructure::license_repo;
use medoc_core::infrastructure::logging::brute_force::BruteForceTracker;
use medoc_lan::LanSystemFactory;
use medoc_sync::deployment::{
    DeploymentMode, DeviceRole, SyncDeploymentConfig, APP_KV_DEVICE_ID_KEY,
};
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use sqlx::SqlitePool;
use tower::ServiceExt;

/// Fixed master Ed25519 secret for deterministic activation-token signatures.
pub const TEST_MASTER_SECRET: &str =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

static E2E_ENV: OnceLock<()> = OnceLock::new();

pub fn ensure_e2e_env() {
    E2E_ENV.get_or_init(|| {
        std::env::set_var("MEDOC_DEV_SEED", "1");
        std::env::set_var("MEDOC_PAIRING_MASTER_SECRET", TEST_MASTER_SECRET);
        std::env::set_var(
            "MEDOC_DB_KEY",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
        std::env::set_var(
            "MEDOC_VENDOR_PUBKEY",
            "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
        );
        let audit_dir = std::env::temp_dir().join("medoc-e2e-audit-init");
        let _ = std::fs::create_dir_all(&audit_dir);
        let _ = medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key(&audit_dir);
    });
}

fn test_connect_addr() -> SocketAddr {
    "127.0.0.1:54321".parse().expect("connect addr")
}

const TEST_VENDOR_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

/// Seed a valid v2 license on the master pool (required for LAN pairing/sync gates).
pub async fn seed_test_master_license(pool: &SqlitePool) {
    let device_id = medoc_sync::repo::ensure_local_device(pool, "E2E Master")
        .await
        .expect("device id");
    let mut bytes = [0u8; 32];
    for (i, chunk) in TEST_VENDOR_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    let lic = LicenseV2 {
        version: 2,
        customer_id: "e2e-master".into(),
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
}

/// Seed demo Arzt TOTP so LAN login accepts code `123456` (enrollment uses fixed test path).
pub async fn enroll_seed_arzt_totp(pool: &SqlitePool) {
    use medoc_core::infrastructure::database::personal_repo;
    use medoc_core::infrastructure::totp;
    let (secret, _) = totp::generate_enrollment("ahmed@praxis.de").expect("totp enroll");
    personal_repo::set_totp_pending_secret(pool, "seed-arzt-001", &secret)
        .await
        .expect("pending totp");
    personal_repo::confirm_totp_enrollment(pool, "seed-arzt-001")
        .await
        .expect("confirm totp");
}

/// Patient row seeded on the master for `pull_from_master` port tests.
pub const PORT_MASTER_SEED_PATIENT_NAME: &str = "Master Seed Pull Patient";

/// Initialize a headless master data directory (migrations, demo seed, license, TOTP).
pub async fn prepare_master_data_dir(data_dir: &std::path::Path) {
    ensure_e2e_env();
    std::fs::create_dir_all(data_dir).expect("mkdir master data dir");
    let _ = medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key(data_dir);
    let pool = medoc_core::infrastructure::database::connection::init_db_headless(data_dir)
        .await
        .expect("init_db_headless");
    seed_test_master_license(&pool).await;
    enroll_seed_arzt_totp(&pool).await;
    let portal_cfg = serde_json::json!({
        "base_url": "",
        "practice_slug": "demo-praxis",
        "api_key": ""
    });
    medoc_core::infrastructure::database::app_kv_repo::set(
        &pool,
        medoc_core::infrastructure::company_portal::config::COMPANY_PORTAL_KV_KEY,
        &portal_cfg.to_string(),
    )
    .await
    .expect("company portal kv");

    let deploy = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Master,
        device_label: "E2E Master".into(),
        ..Default::default()
    };
    SyncEngine::set_deployment(&pool, deploy)
        .await
        .expect("serverless master deployment");

    medoc_core::infrastructure::database::patient_repo::create(
        &pool,
        &CreatePatient {
            name: PORT_MASTER_SEED_PATIENT_NAME.into(),
            geburtsdatum: NaiveDate::from_ymd_opt(1985, 4, 21).unwrap(),
            geschlecht: Geschlecht::Weiblich,
            versicherungsnummer: "V-PORT-PULL-1".into(),
            telefon: None,
            email: None,
            adresse: None,
        },
    )
    .await
    .expect("seed master patient for pull sync");
}

/// Open an on-disk headless SQLite pool (same file the LAN server uses).
pub async fn open_headless_pool(data_dir: &std::path::Path) -> SqlitePool {
    ensure_e2e_env();
    medoc_core::infrastructure::database::connection::init_db_headless(data_dir)
        .await
        .expect("open headless pool")
}

/// Configure a replica data directory for `SyncEngine` push/pull/mesh over real HTTPS.
pub async fn prepare_replica_data_dir(
    data_dir: &std::path::Path,
    device_id: &str,
    label: &str,
    master_base_url: &str,
    master_pubkey: &str,
    master_device_id: &str,
    activation_token: &str,
    unstable_mesh: bool,
) {
    ensure_e2e_env();
    std::fs::create_dir_all(data_dir).expect("mkdir replica data dir");
    let _ = medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key(data_dir);
    let pool = open_headless_pool(data_dir).await;
    medoc_sync::schema::ensure_sync_tables(&pool)
        .await
        .expect("sync schema");
    medoc_core::infrastructure::database::app_kv_repo::set(&pool, APP_KV_DEVICE_ID_KEY, device_id)
        .await
        .expect("replica device id");
    let cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Replica,
        master_base_url: master_base_url.to_string(),
        master_cert_sha256: String::new(),
        device_label: label.to_string(),
        activation_token: activation_token.to_string(),
        master_pubkey: master_pubkey.to_string(),
        master_device_id: master_device_id.to_string(),
        unstable_mesh,
        ..Default::default()
    };
    SyncEngine::set_deployment(&pool, cfg)
        .await
        .expect("replica deployment");
    medoc_sync::repo::ensure_local_device(&pool, label)
        .await
        .expect("replica local device");
}

/// Patch mesh peer URL on the master DB (same-host multi-port replicas).
pub async fn patch_replica_peer_url(
    master_data_dir: &std::path::Path,
    device_id: &str,
    peer_base_url: &str,
) {
    let pool = open_headless_pool(master_data_dir).await;
    sqlx::query("UPDATE sync_device SET peer_base_url = ?1 WHERE device_id = ?2")
        .bind(peer_base_url)
        .bind(device_id)
        .execute(&pool)
        .await
        .expect("patch replica peer_base_url");
}

pub async fn fresh_practice_pool() -> SqlitePool {
    ensure_e2e_env();
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    seed_test_master_license(&pool).await;
    pool
}

/// Replica SQLite pool with a fixed device id (no master license).
pub async fn fresh_replica_pool(device_id: &str) -> SqlitePool {
    ensure_e2e_env();
    use medoc_sync::deployment::APP_KV_DEVICE_ID_KEY;
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    medoc_sync::schema::ensure_sync_tables(&pool)
        .await
        .expect("sync schema");
    medoc_core::infrastructure::database::app_kv_repo::set(&pool, APP_KV_DEVICE_ID_KEY, device_id)
        .await
        .expect("device id");
    pool
}

/// Bound TCP server for real HTTP mesh/sync calls (`reqwest` → `axum::serve`).
pub struct LanTcpHandle {
    pub base_url: String,
    join: tokio::task::JoinHandle<()>,
}

impl LanTcpHandle {
    pub fn abort(self) {
        self.join.abort();
    }
}

pub struct LanHarness {
    router: Router,
    connect: SocketAddr,
    pub pool: SqlitePool,
    pub jwt_secret: Arc<[u8; 32]>,
}

impl LanHarness {
    pub async fn new() -> Self {
        Self::from_pool(fresh_practice_pool().await).await
    }

    pub async fn from_pool(pool: SqlitePool) -> Self {
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
        let router = LanSystemFactory::build_router(state);
        Self {
            router,
            connect: test_connect_addr(),
            pool,
            jwt_secret,
        }
    }

    pub async fn new_unlicensed() -> Self {
        ensure_e2e_env();
        let pool = connection::test_memory_pool().await.expect("pool");
        connection::run_migrations(&pool).await.expect("migrate");
        medoc_sync::repo::ensure_local_device(&pool, "Unlicensed")
            .await
            .expect("device");
        Self::from_pool(pool).await
    }

    pub async fn call(&mut self, mut req: Request<Body>) -> Response<Body> {
        req.extensions_mut().insert(ConnectInfo(self.connect));
        self.router
            .clone()
            .oneshot(req)
            .await
            .expect("router oneshot")
    }

    pub async fn call_with_connect(
        &mut self,
        connect: SocketAddr,
        mut req: Request<Body>,
    ) -> Response<Body> {
        req.extensions_mut().insert(ConnectInfo(connect));
        self.router
            .clone()
            .oneshot(req)
            .await
            .expect("router oneshot")
    }

    pub async fn json_with_connect(
        &mut self,
        connect: SocketAddr,
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
        } else {
            builder.body(Body::empty()).expect("empty body")
        };
        let resp = self.call_with_connect(connect, req).await;
        let status = resp.status();
        let bytes = resp
            .into_body()
            .collect()
            .await
            .expect("body collect")
            .to_bytes();
        let value = if bytes.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|_| serde_json::json!({ "raw": String::from_utf8_lossy(&bytes) }))
        };
        (status, value)
    }

    pub async fn json(
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
        } else {
            builder.body(Body::empty()).expect("empty body")
        };
        let resp = self.call(req).await;
        let status = resp.status();
        let bytes = resp
            .into_body()
            .collect()
            .await
            .expect("body collect")
            .to_bytes();
        let value = if bytes.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|_| serde_json::json!({ "raw": String::from_utf8_lossy(&bytes) }))
        };
        (status, value)
    }

    pub fn ops_jwt(&self) -> String {
        medoc_lan::jwt::issue_token(
            self.jwt_secret.as_ref(),
            "seed-arzt-001",
            "ahmed@praxis.de",
            "ARZT",
        )
        .expect("issue jwt")
    }

    pub async fn login_ops_jwt(&mut self) -> String {
        self.ops_jwt()
    }

    pub async fn spawn_tcp(&self) -> LanTcpHandle {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind lan tcp");
        let addr = listener.local_addr().expect("local addr");
        let base_url = format!("http://{addr}");
        let router = self.router.clone();
        let join = tokio::spawn(async move {
            if let Err(e) = axum::serve(
                listener,
                router.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await
            {
                eprintln!("medoc-e2e lan tcp serve error: {e}");
            }
        });
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        LanTcpHandle { base_url, join }
    }

    pub async fn login_via_http_with_totp(&mut self, totp_code: &str) -> String {
        let (status, body) = self
            .json(
                "POST",
                "/api/v1/auth/login",
                Some(&serde_json::json!({
                    "email": "ahmed@praxis.de",
                    "passwort": "passwort123",
                    "totp_code": totp_code
                })),
                None,
            )
            .await;
        assert_eq!(status, StatusCode::OK, "login failed: {body:?}");
        body["access_token"]
            .as_str()
            .expect("access token")
            .to_string()
    }
}

pub fn slave_signing_key(seed_byte: u8) -> SigningKey {
    SigningKey::from_bytes(&[seed_byte; 32])
}

pub fn slave_pubkey_b64(sk: &SigningKey) -> String {
    master_keys::pubkey_b64(sk)
}

pub async fn body_bytes(resp: Response<Body>) -> Bytes {
    resp.into_body()
        .collect()
        .await
        .expect("collect body")
        .to_bytes()
}

pub async fn company_pool() -> SqlitePool {
    ensure_e2e_env();
    let dir = std::env::temp_dir().join(format!("medoc-e2e-company-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("company temp dir");
    let db_path = dir.join("company.db");
    medoc_company::db::init_company_db(&db_path)
        .await
        .expect("company db")
}

pub struct CompanyHarness {
    router: Router,
    connect: SocketAddr,
}

impl CompanyHarness {
    pub async fn new() -> Self {
        let pool = company_pool().await;
        let router = medoc_company::http::build_company_router(pool).await;
        Self {
            router,
            connect: test_connect_addr(),
        }
    }

    pub async fn call(&mut self, mut req: Request<Body>) -> Response<Body> {
        req.extensions_mut().insert(ConnectInfo(self.connect));
        self.router
            .clone()
            .oneshot(req)
            .await
            .expect("router oneshot")
    }

    pub async fn json(
        &mut self,
        method: &str,
        path: &str,
        body: Option<&serde_json::Value>,
        slug: Option<&str>,
        bearer: Option<&str>,
    ) -> (StatusCode, serde_json::Value) {
        let mut builder = Request::builder().method(method).uri(path);
        if let Some(s) = slug {
            builder = builder.header("X-Practice-Slug", s);
        }
        if let Some(token) = bearer {
            builder = builder.header("Authorization", format!("Bearer {token}"));
        }
        let req = if let Some(json) = body {
            builder
                .header("content-type", "application/json")
                .body(Body::from(json.to_string()))
                .expect("request body")
        } else {
            builder.body(Body::empty()).expect("empty body")
        };
        let resp = self.call(req).await;
        let status = resp.status();
        let bytes = body_bytes(resp).await;
        let value = if bytes.is_empty() {
            serde_json::Value::Null
        } else {
            serde_json::from_slice(&bytes)
                .unwrap_or_else(|_| serde_json::json!({ "raw": String::from_utf8_lossy(&bytes) }))
        };
        (status, value)
    }
}
