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
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
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
}

#[derive(Debug, Deserialize)]
pub struct UpdateAppointment {
    pub date: Option<String>,
    pub time: Option<String>,
    pub kind: Option<AppointmentKind>,
    pub status: Option<AppointmentStatus>,
    pub notes: Option<String>,
    pub chief_complaint: Option<String>,
    pub physician_id: Option<String>,
}
