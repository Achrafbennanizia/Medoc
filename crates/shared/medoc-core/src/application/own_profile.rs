//! Eigenes Profil (Einstellungen » Mein Konto) — jede eingeloggte Rolle darf lesen/schreiben,
//! ohne `personal.write` (nur Arzt). LAN-API spiegelt dieselbe Logik unter `GET|PATCH /api/v1/me`.

use crate::domain::entities::personal::{Personal, UpdateOwnProfile, UpdatePersonal};
use crate::error::AppError;
use crate::infrastructure::database::personal_repo;
use crate::infrastructure::logging::workflow;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize)]
pub struct OwnProfileDto {
    pub user_id: String,
    pub name: String,
    pub email: String,
    pub rolle: String,
    pub taetigkeitsbereich: Option<String>,
    pub fachrichtung: Option<String>,
    pub telefon: Option<String>,
}

impl From<&Personal> for OwnProfileDto {
    fn from(p: &Personal) -> Self {
        OwnProfileDto {
            user_id: p.id.clone(),
            name: p.name.clone(),
            email: p.email.clone(),
            rolle: p.rolle.clone(),
            taetigkeitsbereich: p.taetigkeitsbereich.clone(),
            fachrichtung: p.fachrichtung.clone(),
            telefon: p.telefon.clone(),
        }
    }
}

pub async fn get_own_profile(pool: &SqlitePool, user_id: &str) -> Result<OwnProfileDto, AppError> {
    workflow::run_service_call_async("application.own_profile", "get_own_profile", || async {
        let p = personal_repo::find_by_id(pool, user_id)
            .await?
            .ok_or_else(|| AppError::NotFound("error.entity.personal".into()))?;
        Ok(OwnProfileDto::from(&p))
    })
    .await
}

/// Wendet Profilfelder an (ohne Rolle / Verfügbarkeit). Prüft E-Mail-Kollision.
pub async fn apply_own_profile_update(
    pool: &SqlitePool,
    user_id: &str,
    data: &UpdateOwnProfile,
) -> Result<Personal, AppError> {
    workflow::run_service_call_async(
        "application.own_profile",
        "apply_own_profile_update",
        || async {
            let has_any = data.name.is_some()
                || data.email.is_some()
                || data.taetigkeitsbereich.is_some()
                || data.fachrichtung.is_some()
                || data.telefon.is_some();
            if !has_any {
                return Err(AppError::validation_code("error.profile.no_fields"));
            }

            let existing = personal_repo::find_by_id(pool, user_id)
                .await?
                .ok_or_else(|| AppError::NotFound("error.entity.personal".into()))?;

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
                    if let Some(other) = personal_repo::find_by_email(pool, t).await? {
                        if other.id != user_id {
                            return Err(AppError::validation_code("error.personal.email_taken"));
                        }
                    }
                }
            }

            let upd = UpdatePersonal {
                name: data.name.as_ref().map(|s| s.trim().to_string()),
                email: data.email.as_ref().map(|s| s.trim().to_string()),
                rolle: None,
                taetigkeitsbereich: data
                    .taetigkeitsbereich
                    .as_ref()
                    .map(|s| s.trim().to_string()),
                fachrichtung: data.fachrichtung.as_ref().map(|s| s.trim().to_string()),
                telefon: data.telefon.as_ref().map(|s| s.trim().to_string()),
                verfuegbar: None,
            };

            personal_repo::update(pool, user_id, &upd).await
        },
    )
    .await
}
