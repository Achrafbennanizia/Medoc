//! LAN HTTP endpoints for e-prescription validate/submit (Tauri telematik parity).
//!
//! - `POST /api/v1/eprescriptions/validate` — JWT — pure validation (PZN/KVNR/LANR).
//! - `POST /api/v1/eprescriptions/submit` — JWT — same stub as Tauri (`telematik::submit_via_ti`).

use axum::extract::Extension;
use axum::Json;
use medoc_core::application::rbac::Role;
use medoc_core::error::AppError;
use medoc_core::infrastructure::telematik::{self, EPrescription};
use serde::Deserialize;
use serde_json::{json, Value};

use super::ApiError;
use crate::jwt;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EPrescriptionBody {
    #[serde(default)]
    pub patient_id: String,
    pub kvnr: String,
    pub pzn: String,
    #[serde(default)]
    pub medication_name: String,
    #[serde(default)]
    pub dosage: String,
    #[serde(default = "default_quantity")]
    pub quantity: u32,
    pub doctor_lanr: String,
    #[serde(default)]
    pub issued_at: String,
}

fn default_quantity() -> u32 {
    1
}

fn require_authenticated(claims: &jwt::LanClaims) -> Result<(), AppError> {
    Role::parse(&claims.role).ok_or(AppError::Forbidden)?;
    Ok(())
}

fn to_rx(body: EPrescriptionBody) -> EPrescription {
    let issued = if body.issued_at.trim().is_empty() {
        chrono::Utc::now().date_naive().to_string()
    } else {
        body.issued_at
    };
    EPrescription {
        patient_id: body.patient_id,
        kvnr: body.kvnr,
        pzn: body.pzn,
        medication_name: body.medication_name,
        dosage: body.dosage,
        quantity: body.quantity,
        doctor_lanr: body.doctor_lanr,
        issued_at: issued,
    }
}

/// Validate without TI — mirrors Tauri `validate_eprescription`.
pub async fn validate(
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<EPrescriptionBody>,
) -> Result<Json<Value>, ApiError> {
    require_authenticated(&claims)?;
    let rx = to_rx(body);
    telematik::validate(&rx)?;
    Ok(Json(json!({
        "taskId": "",
        "accessCode": "",
        "redeemUrl": "",
        "status": "VALIDATED",
        "message": "Validation passed"
    })))
}

/// Submit via TI stub — mirrors Tauri `submit_eprescription` (not implemented without connector).
pub async fn submit(
    Extension(claims): Extension<jwt::LanClaims>,
    Json(body): Json<EPrescriptionBody>,
) -> Result<Json<Value>, ApiError> {
    require_authenticated(&claims)?;
    let rx = to_rx(body);
    let token = telematik::submit_via_ti(&rx)?;
    Ok(Json(json!({
        "taskId": token.task_id,
        "accessCode": token.access_code,
        "redeemUrl": token.redeem_url,
        "status": "SUBMITTED",
        "message": "Submitted via TI"
    })))
}
