use crate::domain::enums::{AppointmentKind, AppointmentStatus};
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Appointment {
    pub id: String,
    pub date: String,
    pub time: String,
    pub kind: String,
    pub status: String,
    pub notes: Option<String>,
    pub chief_complaint: Option<String>,
    pub patient_id: String,
    pub physician_id: String,
    /// F65: slot length; rows synced from older devices default to 30.
    #[sqlx(default)]
    #[serde(default = "default_duration_minutes")]
    pub duration_minutes: i64,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

pub const DEFAULT_DURATION_MINUTES: i64 = 30;

fn default_duration_minutes() -> i64 {
    DEFAULT_DURATION_MINUTES
}

/// Valid appointment length: 5 minutes to 12 hours.
pub fn normalize_duration(d: Option<i64>) -> Result<i64, crate::error::AppError> {
    match d {
        None => Ok(DEFAULT_DURATION_MINUTES),
        Some(m) if (5..=720).contains(&m) => Ok(m),
        Some(_) => Err(crate::error::AppError::Validation(
            "Duration must be between 5 and 720 minutes".into(),
        )),
    }
}

/// F70: one entry of a bulk calendar move.
#[derive(Debug, Clone, Deserialize)]
pub struct AppointmentMove {
    pub id: String,
    pub date: String,
    pub time: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointment {
    pub date: String,
    pub time: String,
    pub kind: AppointmentKind,
    pub patient_id: String,
    pub physician_id: String,
    pub notes: Option<String>,
    pub chief_complaint: Option<String>,
    #[serde(default)]
    pub duration_minutes: Option<i64>,
    /// F67: initial status set in the same INSERT (PLANNED or CONFIRMED);
    /// the UI no longer needs a second, unchecked update.
    #[serde(default)]
    pub status: Option<AppointmentStatus>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppointment {
    pub date: Option<String>,
    pub time: Option<String>,
    pub kind: Option<AppointmentKind>,
    pub status: Option<AppointmentStatus>,
    /// F69: missing = keep, `null` or "" = clear.
    #[serde(default, deserialize_with = "crate::domain::serde_util::double_option")]
    pub notes: Option<Option<String>>,
    #[serde(default, deserialize_with = "crate::domain::serde_util::double_option")]
    pub chief_complaint: Option<Option<String>>,
    pub physician_id: Option<String>,
    /// F65: length in minutes; missing = keep.
    #[serde(default)]
    pub duration_minutes: Option<i64>,
}
