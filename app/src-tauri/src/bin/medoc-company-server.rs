//! **MeDoc Company Server** — Hersteller-Backend für Abonnements, Lizenzen, Integrationsstatus, Update-Manifest.
//!
//! ```text
//! medoc-company-server --data-dir ./company-data [--http-bind 0.0.0.0] [--http-port 9797]
//! ```
//!
//! Demo-Mandant: `X-Practice-Slug: demo-praxis` + `Authorization: Bearer sk_demo_company_practice_key`
//!
//! Ausführliche Anleitung: `docs/medoc-company-server.md` im Repository-Root.

use std::net::SocketAddr;
use std::path::PathBuf;

use tokio::net::TcpListener;

#[derive(Debug)]
struct Args {
    data_dir: PathBuf,
    http_bind: String,
    http_port: u16,
}

fn usage() -> &'static str {
    "Usage:\n  medoc-company-server --data-dir <PATH> [--http-bind ADDR] [--http-port PORT]\n\n\
     Default bind 0.0.0.0:9797. Erzeugt `company.db` unter dem Datenverzeichnis.\n"
}

fn parse_args() -> Result<Args, String> {
    let mut args = std::env::args().skip(1);
    let mut data_dir: Option<PathBuf> = None;
    let mut http_bind = "0.0.0.0".to_string();
    let mut http_port: u16 = 9797;
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
            _ => return Err(format!("Unknown argument: {a}\n{}", usage())),
        }
    }
    let data_dir = data_dir.ok_or_else(|| "--data-dir is required\n".to_string() + usage())?;
    Ok(Args {
        data_dir,
        http_bind,
        http_port,
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

    std::fs::create_dir_all(&args.data_dir)?;
    let db_path = args.data_dir.join("company.db");
    let pool = medoc_lib::infrastructure::company_host::db::init_company_db(&db_path).await?;
    let router = medoc_lib::infrastructure::company_host::http::build_company_router(pool);
    let addr: SocketAddr = format!("{}:{}", args.http_bind, args.http_port)
        .parse()
        .map_err(|e| format!("bind: {e}"))?;
    let listener = TcpListener::bind(addr).await?;
    tracing::info!(target = "medoc::company", event = "LISTEN_HTTP", %addr, db = %db_path.display());
    axum::serve(listener, router).await?;
    Ok(())
}
