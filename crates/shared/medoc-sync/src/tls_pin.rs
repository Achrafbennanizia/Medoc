//! HTTPS client that accepts a LAN certificate only when its SHA-256 matches
//! the fingerprint stored at pairing. An empty pin is a hard error.

use std::sync::Arc;
use std::time::Duration;

use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use sha2::{Digest, Sha256};

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use sqlx::SqlitePool;

use crate::deployment::APP_KV_LAN_TLS_PIN;

pub fn certificate_pin_matches(der: &[u8], expected_hex: &str) -> bool {
    let digest = Sha256::digest(der);
    let actual: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    actual == normalize_sha256_pin(expected_hex)
}

/// Lowercase hex only. Colons and spaces from a copied fingerprint are ignored.
pub fn normalize_sha256_pin(raw: &str) -> String {
    raw.chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect::<String>()
        .to_ascii_lowercase()
}

pub fn is_sha256_pin(raw: &str) -> bool {
    normalize_sha256_pin(raw).len() == 64
}

#[derive(Debug)]
struct PinVerifier {
    expected_hex: String,
}

impl ServerCertVerifier for PinVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        _intermediates: &[CertificateDer<'_>],
        _server_name: &ServerName<'_>,
        _ocsp_response: &[u8],
        _now: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        if certificate_pin_matches(end_entity.as_ref(), &self.expected_hex) {
            Ok(ServerCertVerified::assertion())
        } else {
            Err(rustls::Error::General("certificate pin mismatch".into()))
        }
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(
            message,
            cert,
            dss,
            &rustls::crypto::aws_lc_rs::default_provider().signature_verification_algorithms,
        )
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(
            message,
            cert,
            dss,
            &rustls::crypto::aws_lc_rs::default_provider().signature_verification_algorithms,
        )
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        rustls::crypto::aws_lc_rs::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

/// Remember this install's LAN certificate fingerprint so join can hand it to replicas.
pub async fn remember_local_pin(pool: &SqlitePool, fingerprint: &str) -> Result<(), AppError> {
    let pin = normalize_sha256_pin(fingerprint);
    if !is_sha256_pin(&pin) {
        return Err(AppError::Validation(
            "LAN TLS pin is not a SHA-256 fingerprint".into(),
        ));
    }
    app_kv_repo::set(pool, APP_KV_LAN_TLS_PIN, &pin).await
}

pub async fn load_local_pin(pool: &SqlitePool) -> Option<String> {
    let raw = app_kv_repo::get(pool, APP_KV_LAN_TLS_PIN).await.ok()??;
    let pin = normalize_sha256_pin(&raw);
    is_sha256_pin(&pin).then_some(pin)
}

/// Build a client that checks `cert_sha256` and rejects every other certificate.
pub fn pinned_http_client(
    cert_sha256: &str,
    timeout: Duration,
) -> Result<reqwest::Client, AppError> {
    let pin = normalize_sha256_pin(cert_sha256);
    if !is_sha256_pin(&pin) {
        return Err(AppError::Validation(
            "sync TLS pin missing — refusing to accept an unpinned certificate".into(),
        ));
    }
    let provider = Arc::new(rustls::crypto::aws_lc_rs::default_provider());
    let verifier = Arc::new(PinVerifier { expected_hex: pin });
    let config = rustls::ClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()
        .map_err(|e| AppError::Internal(format!("tls versions: {e}")))?
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();
    reqwest::Client::builder()
        .timeout(timeout)
        .use_preconfigured_tls(config)
        .build()
        .map_err(|e| AppError::Internal(format!("sync http client: {e}")))
}

#[cfg(test)]
mod tests {
    use super::{certificate_pin_matches, pinned_http_client};
    use sha2::{Digest, Sha256};
    use std::time::Duration;

    #[test]
    fn pin_matches_the_certificate_bytes_only() {
        let der = b"practice-certificate";
        let digest = Sha256::digest(der);
        let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
        assert!(certificate_pin_matches(der, &hex));
        assert!(certificate_pin_matches(der, &hex.to_ascii_uppercase()));
        assert!(!certificate_pin_matches(der, &"ab".repeat(32)));
    }

    #[test]
    fn colon_separated_fingerprint_is_a_pin() {
        let hex = "ab".repeat(32);
        let colon: String = hex
            .as_bytes()
            .chunks(2)
            .map(|pair| std::str::from_utf8(pair).unwrap())
            .collect::<Vec<_>>()
            .join(":");
        assert!(super::is_sha256_pin(&colon));
        assert!(pinned_http_client(&colon, Duration::from_secs(1)).is_ok());
    }

    #[test]
    fn empty_pin_is_refused() {
        let err = pinned_http_client("", Duration::from_secs(1)).unwrap_err();
        assert!(err.to_string().contains("unpinned"));
        assert!(pinned_http_client(&"ab".repeat(32), Duration::from_secs(1)).is_ok());
    }
}
