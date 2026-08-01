//! L6/L7 length-prefixed CBOR message codec.

use std::io::{Read, Write};

use ciborium::{from_reader, into_writer};
use medoc_core::error::AppError;
use serde::{Deserialize, Serialize};

use crate::verbund::SeatRolle;

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
        requested_role: SeatRolleWire,
    },
    JoinAccept {
        session_id: String,
    },
    SasConfirm {
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
    },
    StaffDirectoryResponse {
        directory_json: String,
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
pub enum SeatRolleWire {
    Admin,
    Member,
}

impl From<SeatRolle> for SeatRolleWire {
    fn from(r: SeatRolle) -> Self {
        match r {
            SeatRolle::Admin => Self::Admin,
            SeatRolle::Member => Self::Member,
        }
    }
}

const MAX_FRAME: usize = 4 * 1024 * 1024;

pub fn encode_frame(msg: &WireMessage) -> Result<Vec<u8>, AppError> {
    let mut body = Vec::new();
    into_writer(msg, &mut body).map_err(|e| AppError::Internal(format!("cbor encode: {e}")))?;
    if body.len() > MAX_FRAME {
        return Err(AppError::Validation("Nachricht zu groß".into()));
    }
    let len = u32::try_from(body.len())
        .map_err(|_| AppError::Internal("frame length overflow".into()))?;
    let mut out = len.to_be_bytes().to_vec();
    out.extend_from_slice(&body);
    Ok(out)
}

pub fn decode_frame(mut data: &[u8]) -> Result<WireMessage, AppError> {
    if data.len() < 4 {
        return Err(AppError::Validation("Frame zu kurz".into()));
    }
    let len = u32::from_be_bytes([data[0], data[1], data[2], data[3]]) as usize;
    data = &data[4..];
    if len > MAX_FRAME || data.len() < len {
        return Err(AppError::Validation("Frame-Länge ungültig".into()));
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
        return Err(AppError::Validation("Frame zu groß".into()));
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
            requested_role: SeatRolleWire::Member,
        };
        let frame = encode_frame(&msg).expect("encode");
        let decoded = decode_frame(&frame).expect("decode");
        assert_eq!(decoded, msg);
    }
}
