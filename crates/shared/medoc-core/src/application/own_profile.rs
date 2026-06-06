//! Eigenes Profil (Einstellungen » Mein Konto) — jede eingeloggte Rolle darf lesen/schreiben,
//! ohne `personal.write` (nur Arzt). LAN-API spiegelt dieselbe Logik unter `GET|PATCH /api/v1/me`.

use crate::domain::entities::personal::{Personal, UpdateOwnProfile, UpdatePersonal};
use crate::error::AppError;
use crate::infrastructure::database::personal_repo;
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
    let p = personal_repo::find_by_id(pool, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Personal".into()))?;
    Ok(OwnProfileDto::from(&p))
}

/// Wendet Profilfelder an (ohne Rolle / Verfügbarkeit). Prüft E-Mail-Kollision.
pub async fn apply_own_profile_update(
    pool: &SqlitePool,
    user_id: &str,
    data: &UpdateOwnProfile,
) -> Result<Personal, AppError> {
    let has_any = data.name.is_some()
        || data.email.is_some()
        || data.taetigkeitsbereich.is_some()
        || data.fachrichtung.is_some()
        || data.telefon.is_some();
    if !has_any {
        return Err(AppError::Validation(
            "Keine Felder zum Aktualisieren übermittelt".into(),
        ));
    }

    let existing = personal_repo::find_by_id(pool, user_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Personal".into()))?;

    if let Some(ref raw) = data.name {
        let t = raw.trim();
        if t.is_empty() {
            return Err(AppError::Validation("Name darf nicht leer sein".into()));
        }
        if t.chars().count() > 120 {
            return Err(AppError::Validation(
                "Name zu lang (max. 120 Zeichen)".into(),
            ));
        }
    }

    if let Some(ref raw) = data.email {
        let t = raw.trim();
        if t.is_empty() {
            return Err(AppError::Validation("E-Mail darf nicht leer sein".into()));
        }
        if t != existing.email {
            if let Some(other) = personal_repo::find_by_email(pool, t).await? {
                if other.id != user_id {
                    return Err(AppError::Conflict("E-Mail bereits vergeben".into()));
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
}
