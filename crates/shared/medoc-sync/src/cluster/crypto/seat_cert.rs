//! Seat certificate signing and verification (cluster CA).

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::Utc;
use ed25519_dalek::{SigningKey, VerifyingKey};
use medoc_core::error::AppError;
use uuid::Uuid;

use crate::master_keys;
use crate::cluster::entities::SeatCertificate;
use crate::cluster::enums::SeatRole;

pub const SEAT_CERT_PREFIX: &str = "sc1.";

/// Issue a seat certificate signed by the cluster CA.
pub fn mint_seat_certificate(
    cluster_signing_key: &SigningKey,
    cluster_id: &str,
    device_pubkey: &[u8],
    seat_role: SeatRole,
    license_ref: &str,
) -> Result<(SeatCertificate, String), AppError> {
    if device_pubkey.len() != 32 {
        return Err(AppError::Validation(
            "device_pubkey must be 32 bytes".into(),
        ));
    }
    let cert = SeatCertificate {
        cluster_id: cluster_id.to_string(),
        device_pubkey: device_pubkey.to_vec(),
        seat_id: Uuid::new_v4().to_string(),
        seat_role,
        issued_at: Utc::now(),
        license_ref: license_ref.to_string(),
    };
    let body = serde_json::to_vec(&cert)
        .map_err(|e| AppError::Internal(format!("seat cert serialise: {e}")))?;
    let body_b64 = STANDARD_NO_PAD.encode(&body);
    let sig = master_keys::sign(cluster_signing_key, body_b64.as_bytes());
    let token = format!("{SEAT_CERT_PREFIX}{body_b64}.{sig}");
    Ok((cert, token))
}

/// Verify a seat certificate token and return the payload.
pub fn verify_seat_certificate(
    token: &str,
    cluster_pubkey: &VerifyingKey,
) -> Result<SeatCertificate, AppError> {
    let rest = token.strip_prefix(SEAT_CERT_PREFIX).ok_or_else(|| {
        AppError::Validation(format!(
            "Seat certificate: expected prefix `{SEAT_CERT_PREFIX}`"
        ))
    })?;
    let (body_b64, sig_b64) = rest
        .split_once('.')
        .ok_or_else(|| AppError::Validation("Seat certificate: missing separator".into()))?;
    master_keys::verify(cluster_pubkey, body_b64.as_bytes(), sig_b64)?;
    let body_bytes = STANDARD_NO_PAD
        .decode(body_b64)
        .map_err(|e| AppError::Validation(format!("Seat certificate decode: {e}")))?;
    serde_json::from_slice(&body_bytes)
        .map_err(|e| AppError::Validation(format!("Seat certificate JSON: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use rand::rngs::OsRng;

    #[test]
    fn seat_cert_roundtrip() {
        let sk = SigningKey::generate(&mut OsRng);
        let pk = sk.verifying_key();
        let (cert, token) =
            mint_seat_certificate(&sk, "cluster-1", &[1u8; 32], SeatRole::Member, "lic-ref")
                .expect("mint");
        let parsed = verify_seat_certificate(&token, &pk).expect("verify");
        assert_eq!(parsed.cluster_id, cert.cluster_id);
        assert_eq!(parsed.seat_role, SeatRole::Member);
    }
}
