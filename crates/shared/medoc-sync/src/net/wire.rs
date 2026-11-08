//! L6/L7 length-prefixed CBOR message codec.

use std::io::{Read, Write};

use ciborium::{from_reader, into_writer};
use medoc_core::error::AppError;
use serde::{Deserialize, Serialize};

use crate::cluster::SeatRole;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum WireMessage {
    Discover,
    JoinRequest {
        fingerprint: String,
        pubkey: Vec<u8>,
        hostname: String,
        os: String,
        app_version: String,
        ip: String,
        requested_role: SeatRoleWire,
    },
    JoinAccept {
        session_id: String,
        #[serde(default)]
        activation_token: Option<String>,
        #[serde(default)]
        master_pubkey: Option<String>,
        #[serde(default)]
        master_device_id: Option<String>,
        /// SHA-256 of the main device's LAN certificate. Sent after SAS so the
        /// replica can pin HTTPS sync.
        #[serde(default)]
        master_cert_sha256: Option<String>,
        /// HTTPS port of the main device's LAN server (`lan.server.config.v1`
        /// `httpPort`). Absent from older main devices; replicas then use 8787.
        #[serde(default)]
        master_http_port: Option<u16>,
    },
    SasConfirm {
        session_id: String,
        digits: String,
    },
    Provision {
        seat_certificate: String,
        settings_json: String,
        wrapped_secrets: Vec<u8>,
    },
    MemberHello {
        fingerprint: String,
    },
    DataRequest {
        path: String,
    },
    DataPush {
        path: String,
        payload: Vec<u8>,
    },
    Revoke {
        fingerprint: String,
    },
    ClusterReset {
        token_json: String,
        signature_b64: String,
    },
    StaffDirectoryRequest {
        fingerprint: String,
        #[serde(default)]
        session_id: String,
    },
    StaffDirectoryResponse {
        directory_json: String,
    },
    ReplicaAuthRequest {
        fingerprint: String,
        #[serde(default)]
        session_id: String,
    },
    ClusterStatusRequest {
        fingerprint: String,
        cluster_id: String,
    },
    ClusterStatusResponse {
        reset_pending: bool,
        #[serde(default)]
        token_json: Option<String>,
        #[serde(default)]
        signature_b64: Option<String>,
    },
    Error {
        code: String,
        message: String,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SeatRoleWire {
    Admin,
    Member,
}

impl From<SeatRole> for SeatRoleWire {
    fn from(r: SeatRole) -> Self {
        match r {
            SeatRole::Admin => Self::Admin,
            SeatRole::Member => Self::Member,
        }
    }
}

const MAX_FRAME: usize = 4 * 1024 * 1024;

pub fn encode_frame(msg: &WireMessage) -> Result<Vec<u8>, AppError> {
    let mut body = Vec::new();
    into_writer(msg, &mut body).map_err(|e| AppError::Internal(format!("cbor encode: {e}")))?;
    if body.len() > MAX_FRAME {
        return Err(AppError::Validation("Message too large".into()));
    }
    let len = u32::try_from(body.len())
        .map_err(|_| AppError::Internal("frame length overflow".into()))?;
    let mut out = len.to_be_bytes().to_vec();
    out.extend_from_slice(&body);
    Ok(out)
}

pub fn decode_frame(mut data: &[u8]) -> Result<WireMessage, AppError> {
    if data.len() < 4 {
        return Err(AppError::Validation("Frame too short".into()));
    }
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    data = &data[4..];
    if len > MAX_FRAME || data.len() < len {
        return Err(AppError::Validation("Invalid frame length".into()));
    }
    from_reader(&data[..len]).map_err(|e| AppError::Validation(format!("cbor decode: {e}")))
}

pub fn read_frame<R: Read>(reader: &mut R) -> Result<WireMessage, AppError> {
    let mut len_buf = [0u8; 4];
    reader
        .read_exact(&mut len_buf)
        .map_err(|e| AppError::Internal(format!("read len: {e}")))?;
    let len = u32::from_be_bytes(len_buf) as usize;
    if len > MAX_FRAME {
        return Err(AppError::Validation("Frame too large".into()));
    }
    let mut body = vec![0u8; len];
    reader
        .read_exact(&mut body)
        .map_err(|e| AppError::Internal(format!("read body: {e}")))?;
    from_reader(body.as_slice()).map_err(|e| AppError::Validation(format!("cbor decode: {e}")))
}

pub fn write_frame<W: Write>(writer: &mut W, msg: &WireMessage) -> Result<(), AppError> {
    let frame = encode_frame(msg)?;
    writer
        .write_all(&frame)
        .map_err(|e| AppError::Internal(format!("write frame: {e}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_join_request() {
        let msg = WireMessage::JoinRequest {
            fingerprint: "FP".into(),
            pubkey: vec![1, 2, 3],
            hostname: "host".into(),
            os: "macos".into(),
            app_version: "0.1".into(),
            ip: "192.168.0.2".into(),
            requested_role: SeatRoleWire::Member,
        };
        let frame = encode_frame(&msg).expect("encode");
        let decoded = decode_frame(&frame).expect("decode");
        assert_eq!(decoded, msg);
    }

    #[test]
    fn roundtrip_sas_confirm() {
        let msg = WireMessage::SasConfirm {
            session_id: "sess".into(),
            digits: "4829".into(),
        };
        let frame = encode_frame(&msg).expect("encode");
        let decoded = decode_frame(&frame).expect("decode");
        assert_eq!(decoded, msg);
    }

    #[test]
    fn roundtrip_join_accept_with_lan_credentials() {
        let msg = WireMessage::JoinAccept {
            session_id: "sess".into(),
            activation_token: Some("mt2.token".into()),
            master_pubkey: Some("pk".into()),
            master_device_id: Some("master".into()),
            master_cert_sha256: Some("ab".repeat(32)),
            master_http_port: Some(8787),
        };
        let frame = encode_frame(&msg).expect("encode");
        let decoded = decode_frame(&frame).expect("decode");
        assert_eq!(decoded, msg);
    }

    #[test]
    fn roundtrip_replica_auth_request() {
        let msg = WireMessage::ReplicaAuthRequest {
            fingerprint: "fp".into(),
            session_id: "sess".into(),
        };
        let frame = encode_frame(&msg).expect("encode");
        let decoded = decode_frame(&frame).expect("decode");
        assert_eq!(decoded, msg);
    }
}
