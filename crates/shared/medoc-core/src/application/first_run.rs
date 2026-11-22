//! First launch: create the practice owner account.
//!
//! A practice database no longer ships with demo logins, so the desktop app
//! shows a setup screen while [`needs_first_run_setup`] is true and calls
//! [`create_first_owner`] once. This is a local desktop action only — it is
//! deliberately not exposed on the LAN API, where anyone on the network could
//! claim a fresh install.

use crate::domain::access;
use crate::domain::entities::staff::{CreateStaff, Staff};
use crate::domain::enums::Role as StaffRole;
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::recorded_write;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::database::repos::admin::staff_access::{self, StaffAccessRow};
use sqlx::SqlitePool;

pub const MIN_PASSWORD_LEN: usize = 12;

pub async fn needs_first_run_setup(pool: &SqlitePool) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff")
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(n == 0)
}

pub struct FirstOwner {
    pub name: String,
    pub email: String,
    pub password: String,
    pub specialty: Option<String>,
}

/// Create the owner (physician, `physician.owner` profile). Refused as soon
/// as any account exists, so it cannot be used to add a second owner.
pub async fn create_first_owner(pool: &SqlitePool, input: &FirstOwner) -> Result<Staff, AppError> {
    let name = input.name.trim();
    let email = input.email.trim();
    if name.is_empty() || email.is_empty() || !email.contains('@') {
        return Err(AppError::Validation(
            "Name and a valid e-mail are required.".into(),
        ));
    }
    if input.password.chars().count() < MIN_PASSWORD_LEN {
        return Err(AppError::Validation(format!(
            "The password must have at least {MIN_PASSWORD_LEN} characters."
        )));
    }
    let hash = crypto::hash_password(&input.password).map_err(AppError::Internal)?;

    let mut tx = crate::mvp_security::begin_immediate_quota_tx(pool).await?;
    let existing: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff")
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    if existing > 0 {
        return Err(AppError::Conflict(
            "The practice already has accounts.".into(),
        ));
    }
    let data = CreateStaff {
        name: name.to_string(),
        email: email.to_string(),
        password: String::new(),
        role: StaffRole::Physician,
        activity_area: None,
        specialty: input.specialty.clone(),
        phone: None,
    };
    let owner = staff_repo::create_in_tx(&mut tx, &data, &hash).await?;
    staff_access::upsert_in_tx(
        &mut tx,
        &StaffAccessRow {
            staff_id: owner.id.clone(),
            template: Some(
                access::default_template_id(crate::domain::rbac::Role::Physician).into(),
            ),
            updated_by: owner.id.clone(),
            ..StaffAccessRow::default()
        },
    )
    .await?;
    recorded_write::audit_in_tx(
        &mut tx,
        &owner.id,
        "FIRST_OWNER_CREATED",
        "staff",
        Some(&owner.id),
        None,
    )
    .await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(owner)
}
