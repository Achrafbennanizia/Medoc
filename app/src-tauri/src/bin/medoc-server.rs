//! Headless MeDoc LAN API (`medoc-server`) — same SQLite store as the desktop app when `--data-dir` matches.
//!
//! Install / run (example macOS, GUI app data dir):
//! `medoc-server --data-dir "$HOME/Library/Application Support/de.medoc.app"`
//!
//! Linux (often): `medoc-server --data-dir ~/.local/share/de.medoc.app`

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpListener;
use tokio::signal;

#[derive(Debug)]
struct Args {
    data_dir: PathBuf,
    http_bind: String,
    http_port: u16,
    discovery_port: u16,
    label: String,
}

fn usage() -> &'static str {
    "Usage:\n  medoc-server --data-dir <PATH> [--http-bind ADDR] [--http-port PORT] [--discovery-port PORT] [--label NAME]\n\n\
     ADDR defaults to 0.0.0.0; PORT defaults to 8787; discovery UDP defaults to 47830.\n"
}

fn parse_args() -> Result<Args, String> {
    let mut args = std::env::args().skip(1);
    let mut data_dir: Option<PathBuf> = None;
    let mut http_bind = "0.0.0.0".to_string();
    let mut http_port: u16 = 8787;
    let mut discovery_port: u16 = 47_830;
    let mut label = "MeDoc Praxis (Server)".to_string();
    while let Some(a) = args.next() {
        match a.as_str() {
            "--help" | "-h" => return Err(usage().into()),
            "--data-dir" => {
                let v = args.next().ok_or_else(|| "--data-dir requires a path".to_string())?;
                data_dir = Some(PathBuf::from(v));
            }
            "--http-bind" => {
                http_bind = args.next().ok_or_else(|| "--http-bind requires ADDR".to_string())?;
            }
            "--http-port" => {
                let v = args.next().ok_or_else(|| "--http-port requires PORT".to_string())?;
                http_port = v.parse().map_err(|_| "invalid http port".to_string())?;
            }
            "--discovery-port" => {
                let v = args.next().ok_or_else(|| "--discovery-port requires PORT".to_string())?;
                discovery_port = v.parse().map_err(|_| "invalid discovery port".to_string())?;
            }
            "--label" => {
                label = args.next().ok_or_else(|| "--label requires NAME".to_string())?;
            }
            _ => return Err(format!("Unknown argument: {a}\n{}", usage())),
        }
    }
    let data_dir = data_dir.ok_or_else(|| "--data-dir is required\n".to_string() + usage())?;
    Ok(Args {
        data_dir,
        http_bind,
        http_port,
        discovery_port,
        label,
    })
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let args = match parse_args() {
        Ok(a) => a,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    };

    let pool = medoc_lib::infrastructure::database::connection::init_db_headless(&args.data_dir).await?;
    let jwt_raw = medoc_lib::infrastructure::lan_server::secrets::ensure_jwt_secret_bytes(&args.data_dir)?;
    let jwt_secret = Arc::new(jwt_raw);
    let instance_id =
        medoc_lib::infrastructure::lan_server::secrets::ensure_instance_id(&args.data_dir)?;

    let brute = Arc::new(medoc_lib::infrastructure::logging::brute_force::BruteForceTracker::new());
    let state = medoc_lib::infrastructure::lan_server::http::LanHttpState {
        pool: pool.clone(),
        jwt_secret,
        brute,
    };

    let router = medoc_lib::infrastructure::lan_server::http::build_router(state);
    let addr: SocketAddr = format!("{}:{}", args.http_bind, args.http_port)
        .parse()
        .map_err(|e| format!("bind address: {e}"))?;

    let beacon = medoc_lib::infrastructure::lan_server::discovery::LanBeaconPayload {
        schema: medoc_lib::infrastructure::lan_server::discovery::SCHEMA.into(),
        version: env!("CARGO_PKG_VERSION").into(),
        http_port: args.http_port,
        instance_id,
        label: args.label,
    }
    .to_json_line();

    let shutdown = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let sd_udp = shutdown.clone();
    tokio::spawn(async move {
        if let Err(e) =
            medoc_lib::infrastructure::lan_server::discovery::run_discovery_responder(args.discovery_port, beacon, sd_udp).await
        {
            tracing::error!(target: "medoc::lan", event = "DISCOVERY_FAIL", error = %e);
        }
    });

    let listener = TcpListener::bind(addr).await?;
    tracing::info!(
        target: "medoc::lan",
        event = "LISTEN_HTTP",
        addr = %addr,
        discovery_udp = args.discovery_port,
    );

    let graceful = async move {
        let _ = signal::ctrl_c().await;
        shutdown.store(true, std::sync::atomic::Ordering::SeqCst);
        tracing::info!(target: "medoc::lan", event = "SHUTDOWN");
    };

    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(graceful)
    .await?;

    tokio::time::sleep(Duration::from_millis(200)).await;
    Ok(())
}
