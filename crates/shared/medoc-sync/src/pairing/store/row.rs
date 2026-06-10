//! SQL row mapping for `pairing_request`.

use super::super::types::PairingRequest;

pub(crate) const PAIRING_SELECT: &str =
    "SELECT id, device_id, slave_pubkey, slave_label, requester_ip, status,
                allowed_actions_json, activation_token, requested_at, decided_at, decided_by,
                confirm_pin_hash, confirm_pin_expires_at, confirm_pin_attempts, transport";

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
}

impl From<RawRow> for PairingRequest {
    fn from(r: RawRow) -> Self {
        let actions: Vec<String> =
            serde_json::from_str(&r.allowed_actions_json).unwrap_or_default();
        let awaiting_pin =
            r.status == "PENDING" && r.confirm_pin_hash.is_some() && r.activation_token.is_none();
        Self {
            id: r.id,
            device_id: r.device_id,
            slave_pubkey: r.slave_pubkey,
            slave_label: r.slave_label,
            requester_ip: r.requester_ip,
            status: r.status,
            allowed_actions: actions,
            activation_token: r.activation_token,
            requested_at: r.requested_at,
            decided_at: r.decided_at,
            decided_by: r.decided_by,
            awaiting_pin,
            transport: r.transport,
        }
    }
}
