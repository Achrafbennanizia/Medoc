//! Tauri controls for the embedded LAN HTTP API + UDP discovery.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use tokio::task::JoinHandle;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use crate::infrastructure::lan_server::{
    discovery, secrets, tls, LanBeaconPayload, LanServerConfigV1, APP_KV_KEY,
};
use crate::infrastructure::logging::brute_force::BruteForceTracker;
use crate::systems::lan::LanSystemFactory;
use sqlx::SqlitePool;

#[derive(Default)]
pub struct LanServerControl(pub std::sync::Mutex<LanControlInner>);

#[derive(Default)]
pub struct LanControlInner {
    pub runtime: Option<LanRuntime>,
}

pub struct LanRuntime {
    pub shutdown: Arc<AtomicBool>,
    pub http_task: JoinHandle<Result<(), std::io::Error>>,
    pub udp_task: JoinHandle<Result<(), std::io::Error>>,
    pub cfg: LanServerConfigV1,
    pub tls_cert_sha256: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanServerStatusPayload {
    pub running: bool,
    pub bind_addr: Option<String>,
    pub http_port: Option<u16>,
    pub discovery_port: Option<u16>,
    pub instance_label: Option<String>,
    /** Example URLs for clients on this subnet (`https://192.168.x.x:port`). */
    pub suggested_base_urls: Vec<String>,
    /// SHA-256 fingerprint of the self-signed LAN certificate (pin on clients).
    pub tls_cert_sha256: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LanDiscoveryHitDto {
    pub from_addr: String,
    pub http_port: u16,
    pub instance_id: String,
    pub label: String,
    pub version: String,
    pub tls: bool,
    pub cert_sha256: String,
}

async fn load_or_default_config(pool: &SqlitePool) -> Result<LanServerConfigV1, AppError> {
    let raw = app_kv_repo::get(pool, APP_KV_KEY).await?;
    match raw {
        Some(s) => {
            serde_json::from_str(&s).map_err(|e| AppError::Validation(format!("LAN-Config: {e}")))
        }
        None => Ok(LanServerConfigV1::default()),
    }
}

async fn save_config(pool: &SqlitePool, cfg: &LanServerConfigV1) -> Result<(), AppError> {
    let s = serde_json::to_string(cfg)
        .map_err(|e| AppError::Internal(format!("LAN config serialise: {e}")))?;
    app_kv_repo::set(pool, APP_KV_KEY, &s).await
}

fn local_ipv4_urls(http_port: u16) -> Vec<String> {
    let mut out = vec![format!("https://127.0.0.1:{http_port}")];
    for iface in if_addrs::get_if_addrs().unwrap_or_default() {
        if let if_addrs::IfAddr::V4(v4) = iface.addr {
            if v4.ip.is_loopback() {
                continue;
            }
            out.push(format!("https://{}:{http_port}", v4.ip));
        }
    }
    out.sort();
    out.dedup();
    out
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn lan_server_get_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<LanServerConfigV1, AppError> {
    rbac::require(&session_state, "ops.system")?;
    load_or_default_config(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn lan_server_set_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    config: LanServerConfigV1,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    if config.http_port == 0 || config.udp_discovery_port == 0 {
        return Err(AppError::Validation("Port muss > 0 sein.".into()));
    }
    save_config(&pool, &config).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(control, session_state))]
pub fn lan_server_status(
    control: State<'_, LanServerControl>,
    session_state: State<'_, SessionState>,
) -> Result<LanServerStatusPayload, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let inner = control.0.lock().unwrap_or_else(|e| e.into_inner());
    let Some(rt) = inner.runtime.as_ref() else {
        return Ok(LanServerStatusPayload {
            running: false,
            bind_addr: None,
            http_port: None,
            discovery_port: None,
            instance_label: None,
            suggested_base_urls: vec![],
            tls_cert_sha256: None,
        });
    };
    let urls = local_ipv4_urls(rt.cfg.http_port);
    Ok(LanServerStatusPayload {
        running: true,
        bind_addr: Some(rt.cfg.bind_addr.clone()),
        http_port: Some(rt.cfg.http_port),
        discovery_port: Some(rt.cfg.udp_discovery_port),
        instance_label: Some(rt.cfg.instance_label.clone()),
        suggested_base_urls: urls,
        tls_cert_sha256: Some(rt.tls_cert_sha256.clone()),
    })
}

/// Starts HTTP + UDP discovery using `app_kv` LAN settings (no RBAC — internal / auto-start).
pub async fn start_lan_embedded(
    app: &AppHandle,
    pool: SqlitePool,
    control: &LanServerControl,
) -> Result<LanServerStatusPayload, AppError> {
    {
        let g = control.0.lock().unwrap_or_else(|e| e.into_inner());
        if g.runtime.is_some() {
            return Err(AppError::Conflict("LAN-Server läuft bereits.".into()));
        }
    }

    let cfg = load_or_default_config(&pool).await?;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;

    let jwt_arr = secrets::ensure_jwt_secret_bytes(&app_dir)?;
    let jwt_secret: Arc<[u8; 32]> = Arc::new(jwt_arr);
    let instance_id = secrets::ensure_instance_id(&app_dir)?;
    let tls_identity = tls::ensure_lan_tls_identity(&app_dir)?;

    let brute = Arc::new(BruteForceTracker::new());
    brute
        .hydrate_from_db(&pool)
        .await
        .map_err(|e| AppError::Internal(format!("Brute-Force-Lockouts: {e}")))?;
    let http_state = LanSystemFactory::build_state(
        pool,
        jwt_secret.clone(),
        brute,
        cfg.http_port,
        cfg.extra_cors_origins.clone(),
        vec![],
    );
    let router = LanSystemFactory::build_router(http_state);

    let addr: SocketAddr = format!("{}:{}", cfg.bind_addr.trim(), cfg.http_port)
        .parse()
        .map_err(|_| AppError::Validation("Ungültige Kombination bind_addr/http_port.".into()))?;

    let beacon = LanBeaconPayload {
        schema: discovery::SCHEMA.into(),
        version: env!("CARGO_PKG_VERSION").into(),
        http_port: cfg.http_port,
        instance_id,
        label: cfg.instance_label.clone(),
        tls: true,
        cert_sha256: tls_identity.sha256_fingerprint.clone(),
    }
    .to_json_line();

    let shutdown = Arc::new(AtomicBool::new(false));
    let sd_http = shutdown.clone();
    let sd_udp = shutdown.clone();
    let tls_id = tls_identity.clone();

    let http_task =
        tokio::spawn(async move { tls::serve_tls_router(addr, &tls_id, router, sd_http).await });

    let udp_task = tokio::spawn(async move {
        discovery::run_discovery_responder(cfg.udp_discovery_port, beacon, sd_udp).await
    });

    {
        let mut g = control.0.lock().unwrap_or_else(|e| e.into_inner());
        g.runtime = Some(LanRuntime {
            shutdown,
            http_task,
            udp_task,
            cfg: cfg.clone(),
            tls_cert_sha256: tls_identity.sha256_fingerprint.clone(),
        });
    }

    tracing::info!(
        target: "medoc::lan",
        event = "LAN_SERVER_STARTED",
        http_port = cfg.http_port,
        discovery = cfg.udp_discovery_port,
        tls_fingerprint = %tls_identity.sha256_fingerprint,
    );

    Ok(LanServerStatusPayload {
        running: true,
        bind_addr: Some(cfg.bind_addr.clone()),
        http_port: Some(cfg.http_port),
        discovery_port: Some(cfg.udp_discovery_port),
        instance_label: Some(cfg.instance_label.clone()),
        suggested_base_urls: local_ipv4_urls(cfg.http_port),
        tls_cert_sha256: Some(tls_identity.sha256_fingerprint),
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state, control))]
pub async fn lan_server_start(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    control: State<'_, LanServerControl>,
) -> Result<LanServerStatusPayload, AppError> {
    rbac::require(&session_state, "ops.system")?;
    start_lan_embedded(&app, (*pool).clone(), &control).await
}

/// Called once after DB init when `auto_start_with_app` is enabled.
pub async fn auto_start_if_enabled(app: AppHandle, pool: SqlitePool) {
    let cfg = match load_or_default_config(&pool).await {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(target: "medoc::lan", event = "LAN_AUTO_START_CFG", error = %e);
            return;
        }
    };
    if !cfg.auto_start_with_app {
        return;
    }
    let ctrl = match app.try_state::<LanServerControl>() {
        Some(s) => s,
        None => {
            tracing::warn!(target: "medoc::lan", event = "LAN_AUTO_START_NO_STATE");
            return;
        }
    };
    match start_lan_embedded(&app, pool, &ctrl).await {
        Ok(_) => tracing::info!(target: "medoc::lan", event = "LAN_AUTO_STARTED"),
        Err(e) => tracing::warn!(target: "medoc::lan", event = "LAN_AUTO_START_FAIL", error = %e),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(control, session_state))]
pub async fn lan_server_stop(
    control: State<'_, LanServerControl>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;

    let rt = {
        let mut g = control.0.lock().unwrap_or_else(|e| e.into_inner());
        g.runtime.take()
    };

    let Some(rt) = rt else {
        return Ok(());
    };

    rt.shutdown.store(true, Ordering::SeqCst);
    let _ = tokio::time::timeout(Duration::from_secs(6), rt.http_task).await;
    let _ = tokio::time::timeout(Duration::from_secs(2), rt.udp_task).await;

    tracing::info!(target: "medoc::lan", event = "LAN_SERVER_STOPPED");
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn lan_server_scan(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    label_contains: Option<String>,
) -> Result<Vec<LanDiscoveryHitDto>, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_or_default_config(&pool).await?;
    let hits = discovery::scan_lan_hosts(
        cfg.udp_discovery_port,
        Duration::from_millis(2500),
        label_contains.as_deref(),
    )
    .await
    .map_err(|e| AppError::Internal(format!("LAN-Scan: {e}")))?;

    Ok(hits
        .into_iter()
        .map(|(addr, p)| LanDiscoveryHitDto {
            from_addr: addr.ip().to_string(),
            http_port: p.http_port,
            instance_id: p.instance_id,
            label: p.label,
            version: p.version,
            tls: p.tls,
            cert_sha256: p.cert_sha256.clone(),
        })
        .collect())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_lan_commands {
    () => {
        $crate::commands::lan_commands::lan_server_get_config,
        $crate::commands::lan_commands::lan_server_set_config,
        $crate::commands::lan_commands::lan_server_status,
        $crate::commands::lan_commands::lan_server_start,
        $crate::commands::lan_commands::lan_server_stop,
        $crate::commands::lan_commands::lan_server_scan,
    };
}
