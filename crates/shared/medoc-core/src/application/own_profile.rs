//! Own profile (Settings » My account) — any signed-in role may read/write,
//! without `staff.write` (physician-only). The LAN API mirrors the same logic under `GET|PATCH /api/v1/me`.

use crate::domain::entities::staff::{Staff, UpdateOwnProfile, UpdateStaff};
use crate::error::AppError;
use crate::infrastructure::database::staff_repo;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize)]
pub struct OwnProfileDto {
    pub user_id: String,
    pub name: String,
    pub email: String,
    pub role: String,
    pub activity_area: Option<String>,
    pub specialty: Option<String>,
    pub phone: Option<String>,
}

impl From<&Staff> for OwnProfileDto {
    fn from(p: &Staff) -> Self {
        OwnProfileDto {
            user_id: p.id.clone(),
            name: p.name.clone(),
            email: p.email.clone(),
            role: p.role.clone(),
            activity_area: p.activity_area.clone(),
            specialty: p.specialty.clone(),
            phone: p.phone.clone(),
        }
    }
}

pub async fn get_own_profile(pool: &SqlitePool, user_id: &str) -> Result<OwnProfileDto, AppError> {
    let p = staff_repo::find_by_id(pool, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("error.entity.staff".into()))?;
    Ok(OwnProfileDto::from(&p))
}

/// Applies profile fields (excluding role / availability). Checks for email collisions.
pub async fn apply_own_profile_update(
    pool: &SqlitePool,
    user_id: &str,
    data: &UpdateOwnProfile,
) -> Result<Staff, AppError> {
    let has_any = data.name.is_some()
        || data.email.is_some()
        || data.activity_area.is_some()
        || data.specialty.is_some()
        || data.phone.is_some();
    if !has_any {
        return Err(AppError::validation_code("error.profile.no_fields"));
    }

    let existing = staff_repo::find_by_id(pool, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("error.entity.staff".into()))?;

    if let Some(ref raw) = data.name {
        let t = raw.trim();
        if t.is_empty() {
            return Err(AppError::validation_code("error.profile.name_empty"));
        }
        if t.chars().count() > 120 {
            return Err(AppError::validation_code("error.profile.name_too_long"));
        }
    }

    if let Some(ref raw) = data.email {
        let t = raw.trim();
        if t.is_empty() {
            return Err(AppError::validation_code("error.profile.email_empty"));
        }
        if t != existing.email {
            if let Some(other) = staff_repo::find_by_email(pool, t).await? {
                if other.id != user_id {
                    return Err(AppError::validation_code("error.staff.email_taken"));
                }
            }
        }
    }

    let upd = UpdateStaff {
        name: data.name.as_ref().map(|s| s.trim().to_string()),
        email: data.email.as_ref().map(|s| s.trim().to_string()),
        role: None,
        activity_area: data
            .activity_area
            .as_ref()
            .map(|s| s.trim().to_string()),
        specialty: data.specialty.as_ref().map(|s| s.trim().to_string()),
        phone: data.phone.as_ref().map(|s| s.trim().to_string()),
        available: None,
    };

    staff_repo::update(pool, user_id, &upd).await
}
