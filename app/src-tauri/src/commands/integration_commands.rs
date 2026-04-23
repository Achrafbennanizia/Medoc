// Notifications, telematik, and ad-hoc system commands.

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::{notifications, telematik};

#[tauri::command]
pub async fn list_upcoming_appointments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    lead_minutes: Option<i64>,
) -> Result<Vec<notifications::AppointmentReminder>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    notifications::upcoming(&pool, lead_minutes.unwrap_or(24 * 60)).await
}

#[tauri::command]
pub fn validate_eprescription(
    session_state: State<'_, SessionState>,
    rx: telematik::EPrescription,
) -> Result<(), AppError> {
    rbac::require(&session_state, "patient.write_medical")?;
    telematik::validate(&rx)
}

#[tauri::command]
pub fn submit_eprescription(
    session_state: State<'_, SessionState>,
    rx: telematik::EPrescription,
) -> Result<telematik::EPrescriptionToken, AppError> {
    rbac::require(&session_state, "patient.write_medical")?;
    telematik::submit_via_ti(&rx)
}

#[tauri::command]
pub fn send_kim_message(
    session_state: State<'_, SessionState>,
    msg: telematik::KimMessage,
) -> Result<(), AppError> {
    rbac::require(&session_state, "patient.write_medical")?;
    telematik::kim_send(&msg)
}
