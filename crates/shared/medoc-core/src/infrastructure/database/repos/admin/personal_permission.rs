//! FA-PERS-07: granulare Berechtigungs-Overrides pro Personal-Zeile.

use crate::domain::rbac::PermissionOverride;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn list_for_personal(
    pool: &SqlitePool,
    personal_id: &str,
) -> Result<Vec<PermissionOverride>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT action, effect FROM personal_permission_override WHERE personal_id = ?1 ORDER BY action",
    )
    .bind(personal_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(action, effect)| PermissionOverride { action, effect })
        .collect())
}

pub async fn upsert(
    pool: &SqlitePool,
    personal_id: &str,
    action: &str,
    effect: &str,
) -> Result<(), AppError> {
    let action = action.trim();
    if action.is_empty() {
        return Err(AppError::Validation("Aktion darf nicht leer sein.".into()));
    }
    let eff = effect.trim().to_ascii_uppercase();
    if eff != "ALLOW" && eff != "DENY" {
        return Err(AppError::Validation(
            "effect muss ALLOW oder DENY sein.".into(),
        ));
    }
    sqlx::query(
        "INSERT INTO personal_permission_override (personal_id, action, effect) VALUES (?1, ?2, ?3)
         ON CONFLICT(personal_id, action) DO UPDATE SET effect = excluded.effect",
    )
    .bind(personal_id)
    .bind(action)
    .bind(&eff)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_override(
    pool: &SqlitePool,
    personal_id: &str,
    action: &str,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "DELETE FROM personal_permission_override WHERE personal_id = ?1 AND action = ?2",
    )
    .bind(personal_id)
    .bind(action.trim())
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Berechtigungs-Override".into()));
    }
    Ok(())
}
