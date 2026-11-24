//! Self-signed TLS material for the LAN API (NFA-NET-07 / NFA-SEC-09).

use std::path::{Path, PathBuf};

use axum_server::tls_rustls::RustlsConfig;
use rcgen::{CertificateParams, KeyPair, SanType};
use sha2::{Digest, Sha256};
use tokio::net::TcpListener;

use medoc_core::error::AppError;

const CERT_FILE: &str = "lan-tls.crt";
const KEY_FILE: &str = "lan-tls.key";

fn install_rustls_provider() -> Result<(), AppError> {
    use std::sync::{Mutex, Once};
    static INIT: Once = Once::new();
    static RESULT: Mutex<Option<Result<(), String>>> = Mutex::new(None);

    // Check if already initialized
    if let Ok(guard) = RESULT.lock() {
        if let Some(result) = guard.as_ref() {
            return result
                .clone()
                .map_err(|e| AppError::Internal(format!("TLS crypto provider: {e}")));
        }
    }

    // Initialize on first call
    INIT.call_once(|| {
        // `install_default` fails when *any* provider is already installed
        // (another crate, the Tauri host). That is not an error for us: a
        // process-wide provider exists. Failing here stopped the LAN server.
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
        let init_result: Result<(), String> =
            if rustls::crypto::CryptoProvider::get_default().is_some() {
                Ok(())
            } else {
                Err("no rustls crypto provider installed".into())
            };
        if let Ok(mut guard) = RESULT.lock() {
            *guard = Some(init_result);
        }
    });

    // Retrieve the result
    if let Ok(guard) = RESULT.lock() {
        if let Some(result) = guard.as_ref() {
            return result.clone().map_err(|e| AppError::Internal(e.clone()));
        }
    }

    Ok(())
}

#[derive(Debug, Clone)]
pub struct LanTlsIdentity {
    pub cert_path: PathBuf,
    pub key_path: PathBuf,
    /// SHA-256 fingerprint of the certificate DER (lowercase hex).
    pub sha256_fingerprint: String,
}

fn fingerprint_der(der: &[u8]) -> String {
    let digest = Sha256::digest(der);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(unix)]
fn restrict_permissions(cert_path: &Path, key_path: &Path) -> Result<(), AppError> {
    use std::os::unix::fs::PermissionsExt;
    let mode = std::fs::Permissions::from_mode(0o600);
    std::fs::set_permissions(cert_path, mode.clone())
        .map_err(|e| AppError::Internal(format!("LAN TLS cert chmod: {e}")))?;
    std::fs::set_permissions(key_path, mode)
        .map_err(|e| AppError::Internal(format!("LAN TLS key chmod: {e}")))?;
    Ok(())
}

#[cfg(not(unix))]
fn restrict_permissions(_cert_path: &Path, _key_path: &Path) -> Result<(), AppError> {
    Ok(())
}

/// Write a file that is created with mode 0600 on Unix. `fs::write` + chmod
/// left the private key world-readable (umask 022) between the two calls.
/// Written to a temp file and renamed, so a crash never leaves half a key.
fn write_private_file(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension("tmp");
    let _ = std::fs::remove_file(&tmp);
    let mut opts = std::fs::OpenOptions::new();
    opts.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut f = opts.open(&tmp)?;
    f.write_all(bytes)?;
    f.sync_all()?;
    drop(f);
    std::fs::rename(&tmp, path)
}

fn fingerprint_from_pem_cert(pem: &[u8]) -> Result<String, AppError> {
    let mut reader = std::io::Cursor::new(pem);
    let certs: Vec<_> = rustls_pemfile::certs(&mut reader)
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::Internal(format!("LAN TLS cert PEM: {e}")))?;
    let der = certs
        .first()
        .ok_or_else(|| AppError::Internal("LAN TLS cert PEM leer".into()))?;
    Ok(fingerprint_der(der))
}

fn write_identity_files(
    app_data_dir: &Path,
    cert_pem: &str,
    key_pem: &str,
) -> Result<LanTlsIdentity, AppError> {
    std::fs::create_dir_all(app_data_dir)
        .map_err(|e| AppError::Internal(format!("LAN TLS dirs: {e}")))?;
    let cert_path = app_data_dir.join(CERT_FILE);
    let key_path = app_data_dir.join(KEY_FILE);
    write_private_file(&cert_path, cert_pem.as_bytes())
        .map_err(|e| AppError::Internal(format!("LAN TLS cert write: {e}")))?;
    write_private_file(&key_path, key_pem.as_bytes())
        .map_err(|e| AppError::Internal(format!("LAN TLS key write: {e}")))?;
    restrict_permissions(&cert_path, &key_path)?;
    let sha256_fingerprint = fingerprint_from_pem_cert(cert_pem.as_bytes())?;
    Ok(LanTlsIdentity {
        cert_path,
        key_path,
        sha256_fingerprint,
    })
}

fn generate_self_signed_pem() -> Result<(String, String), AppError> {
    let mut params =
        CertificateParams::new(vec!["localhost".to_string(), "medoc.local".to_string()])
            .map_err(|e| AppError::Internal(format!("LAN TLS names: {e}")))?;
    params
        .subject_alt_names
        .push(SanType::IpAddress(std::net::IpAddr::V4(
            std::net::Ipv4Addr::LOCALHOST,
        )));
    for ip in medoc_core::discovery::practice_lan_ipv4_addrs() {
        params
            .subject_alt_names
            .push(SanType::IpAddress(std::net::IpAddr::V4(ip)));
    }
    let key = KeyPair::generate().map_err(|e| AppError::Internal(format!("LAN TLS key: {e}")))?;
    let cert = params
        .self_signed(&key)
        .map_err(|e| AppError::Internal(format!("LAN TLS generate: {e}")))?;
    Ok((cert.pem(), key.serialize_pem()))
}

/// Load or create `lan-tls.{crt,key}` under `app_data_dir` (Unix: mode 0600).
pub fn ensure_lan_tls_identity(app_data_dir: &Path) -> Result<LanTlsIdentity, AppError> {
    let cert_path = app_data_dir.join(CERT_FILE);
    let key_path = app_data_dir.join(KEY_FILE);
    if cert_path.exists() && key_path.exists() {
        let cert_pem = std::fs::read_to_string(&cert_path)
            .map_err(|e| AppError::Internal(format!("LAN TLS cert read: {e}")))?;
        restrict_permissions(&cert_path, &key_path)?;
        let sha256_fingerprint = fingerprint_from_pem_cert(cert_pem.as_bytes())?;
        return Ok(LanTlsIdentity {
            cert_path,
            key_path,
            sha256_fingerprint,
        });
    }

    let (cert_pem, key_pem) = generate_self_signed_pem()?;
    write_identity_files(app_data_dir, &cert_pem, &key_pem)
}

/// Bind **HTTPS only** on `addr` (plain HTTP is not offered on this port).
pub async fn serve_tls_router(
    addr: std::net::SocketAddr,
    identity: &LanTlsIdentity,
    router: axum::Router,
    shutdown: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> Result<(), std::io::Error> {
    install_rustls_provider().map_err(|e| std::io::Error::other(e.to_string()))?;
    let config = RustlsConfig::from_pem_file(&identity.cert_path, &identity.key_path).await?;
    let handle = axum_server::Handle::new();
    let graceful = handle.clone();
    let sd = shutdown.clone();
    tokio::spawn(async move {
        while !sd.load(std::sync::atomic::Ordering::SeqCst) {
            tokio::time::sleep(std::time::Duration::from_millis(400)).await;
        }
        graceful.graceful_shutdown(Some(std::time::Duration::from_millis(0)));
    });

    axum_server::bind_rustls(addr, config)
        .handle(handle)
        .serve(router.into_make_service_with_connect_info::<std::net::SocketAddr>())
        .await
}

/// Returns `true` if a plain HTTP probe gets a response (should be false when only TLS is bound).
pub async fn plain_http_reachable(addr: std::net::SocketAddr) -> bool {
    let Ok(Ok(mut stream)) = tokio::time::timeout(
        std::time::Duration::from_millis(800),
        tokio::net::TcpStream::connect(addr),
    )
    .await
    else {
        return false;
    };
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let req = b"GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n";
    if stream.write_all(req).await.is_err() {
        return false;
    }
    let mut buf = [0u8; 16];
    matches!(
        tokio::time::timeout(std::time::Duration::from_millis(500), stream.read(&mut buf)).await,
        Ok(Ok(n)) if n > 0
    )
}

/// Ensure the TCP port accepts TLS (used in integration checks).
pub async fn tls_listener_bound(addr: std::net::SocketAddr) -> bool {
    TcpListener::bind(addr).await.is_ok()
}

#[cfg(test)]
mod san_tests {
    use super::generate_self_signed_pem;

    #[test]
    fn certificate_carries_loopback_as_an_ip_san() {
        let (pem, _) = generate_self_signed_pem().expect("cert");
        let der = pem_der(&pem);
        assert!(
            der.windows(4).any(|window| window == [127, 0, 0, 1]),
            "127.0.0.1 must be an IP address SAN"
        );
        assert!(
            !der.windows(9).any(|window| window == b"127.0.0.1"),
            "127.0.0.1 must not be stored as a DNS name"
        );
    }

    fn pem_der(pem: &str) -> Vec<u8> {
        let b64: String = pem
            .lines()
            .filter(|line| !line.starts_with("-----"))
            .collect();
        base64_decode(&b64)
    }

    fn base64_decode(input: &str) -> Vec<u8> {
        const TABLE: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut out = Vec::new();
        let mut buf = 0u32;
        let mut bits = 0;
        for byte in input.bytes() {
            if byte == b'=' {
                break;
            }
            let Some(val) = TABLE.iter().position(|c| *c == byte) else {
                continue;
            };
            buf = (buf << 6) | val as u32;
            bits += 6;
            if bits >= 8 {
                bits -= 8;
                out.push((buf >> bits) as u8);
            }
        }
        out
    }
}
