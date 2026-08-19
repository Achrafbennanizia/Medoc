use crate::domain::enums::Role;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

/// Minimal staff row for Physician dropdowns (no e-mail / hash).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PhysicianSummary {
    pub id: String,
    pub name: String,
}

/// Minimal physician/reception directory for practice tasks (no HR fields).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TaskTeamMember {
    pub id: String,
    pub name: String,
    pub role: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Staff {
    pub id: String,
    pub name: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub activity_area: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub available: bool,
    #[serde(skip_serializing)]
    pub totp_secret: Option<String>,
    pub totp_enrolled_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateStaff {
    pub name: String,
    pub email: String,
    pub password: String,
    pub role: Role,
    pub activity_area: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateStaff {
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<Role>,
    pub activity_area: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
    pub available: Option<bool>,
}

/// Self-service profile (Settings » Account) — no role / no `available`.
#[derive(Debug, Deserialize)]
pub struct UpdateOwnProfile {
    pub name: Option<String>,
    pub email: Option<String>,
    pub activity_area: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
}
