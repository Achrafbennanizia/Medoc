//! FA-PERS-07: granular permission overrides per staff row.
//!
//! The rows stay in `staff_permission_override` on this device. Every change
//! is mirrored into `staff_access_profile.action_overrides_json`, which is the
//! copy that replicates (the old table had no usable sync key, so a DENY set
//! on the main device was never enforced on a replica).

use crate::domain::access;
use crate::domain::rbac::{PermissionOverride, Role};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::staff_access;
use sqlx::{Sqlite, SqlitePool, Transaction};

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

async fn list_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
) -> Result<Vec<PermissionOverride>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT action, effect FROM staff_permission_override WHERE staff_id = ?1 ORDER BY action",
    )
    .bind(staff_id)
    .fetch_all(&mut **tx)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(action, effect)| PermissionOverride { action, effect })
        .collect())
}

/// An ALLOW may not lift a person above their role ceiling
/// (e.g. clinical write access or account administration for reception).
async fn check_ceiling(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
    action: &str,
    effect: &str,
) -> Result<(), AppError> {
    if effect != "ALLOW" {
        return Ok(());
    }
    let Some(rule) = access::rule(action) else {
        return Ok(());
    };
    let role: Option<String> = sqlx::query_scalar("SELECT role FROM staff WHERE id = ?1")
        .bind(staff_id)
        .fetch_optional(&mut **tx)
        .await?;
    let role = role
        .as_deref()
        .and_then(Role::parse)
        .ok_or_else(|| AppError::NotFound("staff".into()))?;
    let within = rule
        .any_of
        .iter()
        .any(|(area, needed)| access::ceiling(role, *area).allows(*needed));
    if within {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "{action} cannot be granted to this role"
        )))
    }
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
        return Err(AppError::Validation("effect must be ALLOW or DENY.".into()));
    }
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    check_ceiling(&mut tx, staff_id, action, &eff).await?;
    sqlx::query(
        "INSERT INTO staff_permission_override (staff_id, action, effect) VALUES (?1, ?2, ?3)
         ON CONFLICT(staff_id, action) DO UPDATE SET effect = excluded.effect",
    )
    .bind(staff_id)
    .bind(action)
    .bind(&eff)
    .execute(&mut *tx)
    .await?;
    let all = list_in_tx(&mut tx, staff_id).await?;
    staff_access::mirror_overrides_in_tx(&mut tx, staff_id, all).await?;
    bump_token_version(&mut tx, staff_id).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn delete_override(
    pool: &SqlitePool,
    staff_id: &str,
    action: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let n =
        sqlx::query("DELETE FROM staff_permission_override WHERE staff_id = ?1 AND action = ?2")
            .bind(staff_id)
            .bind(action.trim())
            .execute(&mut *tx)
            .await?
            .rows_affected();
    if n == 0 {
        tx.rollback().await?;
        return Err(AppError::NotFound("Berechtigungs-Override".into()));
    }
    let all = list_in_tx(&mut tx, staff_id).await?;
    staff_access::mirror_overrides_in_tx(&mut tx, staff_id, all).await?;
    bump_token_version(&mut tx, staff_id).await?;
    tx.commit().await?;
    Ok(())
}

pub async fn delete_all_for_staff(pool: &SqlitePool, staff_id: &str) -> Result<u64, AppError> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    let n = sqlx::query("DELETE FROM staff_permission_override WHERE staff_id = ?1")
        .bind(staff_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    staff_access::mirror_overrides_in_tx(&mut tx, staff_id, Vec::new()).await?;
    bump_token_version(&mut tx, staff_id).await?;
    tx.commit().await?;
    Ok(n)
}

/// Rights changed: LAN tokens issued before this point stop working.
pub(crate) async fn bump_token_version(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
) -> Result<(), AppError> {
    sqlx::query("UPDATE staff SET token_version = token_version + 1 WHERE id = ?1")
        .bind(staff_id)
        .execute(&mut **tx)
        .await?;
    Ok(())
}
