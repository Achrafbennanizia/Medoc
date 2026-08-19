//! FA-PERS-07: granular permission overrides per staff row.

use crate::domain::rbac::PermissionOverride;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn list_for_staff(
    pool: &SqlitePool,
    staff_id: &str,
) -> Result<Vec<PermissionOverride>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT action, effect FROM staff_permission_override WHERE staff_id = ?1 ORDER BY action",
    )
    .bind(staff_id)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(action, effect)| PermissionOverride { action, effect })
        .collect())
}

pub async fn upsert(
    pool: &SqlitePool,
    staff_id: &str,
    action: &str,
    effect: &str,
) -> Result<(), AppError> {
    let action = action.trim();
    if action.is_empty() {
        return Err(AppError::Validation("Action must not be empty.".into()));
    }
    let eff = effect.trim().to_ascii_uppercase();
    if eff != "ALLOW" && eff != "DENY" {
        return Err(AppError::Validation(
            "effect must be ALLOW or DENY.".into(),
        ));
    }
    sqlx::query(
        "INSERT INTO staff_permission_override (staff_id, action, effect) VALUES (?1, ?2, ?3)
         ON CONFLICT(staff_id, action) DO UPDATE SET effect = excluded.effect",
    )
    .bind(staff_id)
    .bind(action)
    .bind(&eff)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_override(
    pool: &SqlitePool,
    staff_id: &str,
    action: &str,
) -> Result<(), AppError> {
    let n = sqlx::query(
        "DELETE FROM staff_permission_override WHERE staff_id = ?1 AND action = ?2",
    )
    .bind(staff_id)
    .bind(action.trim())
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Berechtigungs-Override".into()));
    }
    Ok(())
}

pub async fn delete_all_for_staff(
    pool: &SqlitePool,
    staff_id: &str,
) -> Result<u64, AppError> {
    let n = sqlx::query("DELETE FROM staff_permission_override WHERE staff_id = ?1")
        .bind(staff_id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(n)
}
