//! SQL row mapping for `pairing_request`.

use super::super::types::PairingRequest;

pub(crate) const PAIRING_SELECT: &str = "SELECT id, device_id, slave_pubkey, slave_label,
            COALESCE(
                NULLIF(TRIM(requester_ip), ''),
                (SELECT NULLIF(TRIM(last_ip), '') FROM sync_device
                  WHERE sync_device.fingerprint = pairing_request.device_id
                     OR sync_device.device_id = pairing_request.device_id
                     OR sync_device.fingerprint = pairing_request.fingerprint
                  LIMIT 1),
                ''
            ) AS requester_ip,
            status,
            allowed_actions_json, activation_token, requested_at, decided_at, decided_by,
            confirm_pin_hash, confirm_pin_expires_at, confirm_pin_attempts, transport,
            pairing_state, handshake_transcript_b64,
            COALESCE(
                NULLIF(TRIM(hostname), ''),
                (SELECT NULLIF(TRIM(hostname), '') FROM sync_device
                  WHERE sync_device.fingerprint = pairing_request.device_id
                     OR sync_device.device_id = pairing_request.device_id
                     OR sync_device.fingerprint = pairing_request.fingerprint
                  LIMIT 1)
            ) AS hostname";

#[derive(sqlx::FromRow)]
#[allow(dead_code)] // pin expiry/attempts loaded for schema parity; confirm path reads via scalar queries
pub(crate) struct RawRow {
    pub id: String,
    pub device_id: String,
    pub slave_pubkey: String,
    pub slave_label: String,
    pub requester_ip: String,
    pub status: String,
    pub allowed_actions_json: String,
    pub activation_token: Option<String>,
    pub requested_at: String,
    pub decided_at: Option<String>,
    pub decided_by: Option<String>,
    pub confirm_pin_hash: Option<String>,
    pub confirm_pin_expires_at: Option<String>,
    pub confirm_pin_attempts: i32,
    pub transport: String,
    pub pairing_state: Option<String>,
    pub handshake_transcript_b64: Option<String>,
    pub hostname: Option<String>,
}

impl From<RawRow> for PairingRequest {
    fn from(r: RawRow) -> Self {
        let actions: Vec<String> =
            serde_json::from_str(&r.allowed_actions_json).unwrap_or_default();
        let cluster_sas = is_cluster_sas_state(r.pairing_state.as_deref());
        let awaiting_pin =
            r.status == "PENDING" && r.confirm_pin_hash.is_some() && r.activation_token.is_none();
        let coupling_code = if r.status == "PENDING" {
            coupling_code_from_transcript_b64(r.handshake_transcript_b64.as_deref())
        } else {
            None
        };
        let slave_label = display_device_label(&r.slave_label, r.hostname.as_deref(), &r.device_id);
        let requester_ip = super::super::policy::canonical_ip_str(&r.requester_ip);
        Self {
            id: r.id,
            device_id: r.device_id,
            slave_pubkey: r.slave_pubkey,
            slave_label,
            requester_ip,
            status: r.status,
            allowed_actions: actions,
            activation_token: r.activation_token,
            requested_at: r.requested_at,
            decided_at: r.decided_at,
            decided_by: r.decided_by,
            awaiting_pin,
            transport: r.transport,
            cluster_sas,
            coupling_code,
        }
    }
}

fn coupling_code_from_transcript_b64(b64: Option<&str>) -> Option<String> {
    use crate::cluster::crypto::derive_sas_from_transcript;
    use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
    use base64::Engine;
    let raw = b64?.trim();
    if raw.is_empty() {
        return None;
    }
    for engine in [&STANDARD, &STANDARD_NO_PAD, &URL_SAFE, &URL_SAFE_NO_PAD] {
        if let Ok(bytes) = engine.decode(raw) {
            if !bytes.is_empty() {
                return Some(derive_sas_from_transcript(&bytes));
            }
        }
    }
    None
}

pub(crate) fn is_cluster_sas_state(pairing_state: Option<&str>) -> bool {
    matches!(
        pairing_state.map(str::trim),
        Some("JOIN_REQUESTED" | "AWAITING_SAS" | "SAS_CONFIRMED" | "PROVISIONED" | "ABORTED")
    )
}

/// Prefer the operator label, then the computer name sent with the join.
/// A label that is only the device fingerprint is not a name.
pub(crate) fn display_device_label(
    slave_label: &str,
    hostname: Option<&str>,
    device_id: &str,
) -> String {
    let device_id = device_id.trim();
    let label = slave_label.trim();
    if !label.is_empty() && label != device_id {
        return label.to_string();
    }
    let host = hostname.unwrap_or("").trim();
    if !host.is_empty() && host != device_id {
        return host.to_string();
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::display_device_label;

    #[test]
    fn label_uses_hostname_when_slave_label_is_blank() {
        assert_eq!(
            display_device_label("", Some("Reception-iMac"), "FINGERPRINT"),
            "Reception-iMac"
        );
        assert_eq!(
            display_device_label("   ", Some(" Reception-iMac "), "FINGERPRINT"),
            "Reception-iMac"
        );
        assert_eq!(
            display_device_label("Front desk", Some("other"), "FINGERPRINT"),
            "Front desk"
        );
        assert_eq!(display_device_label("", None, "FINGERPRINT"), "");
        assert_eq!(
            display_device_label("FINGERPRINT", Some("Clinic-Mac"), "FINGERPRINT"),
            "Clinic-Mac"
        );
        assert_eq!(display_device_label("FINGERPRINT", None, "FINGERPRINT"), "");
    }
}
