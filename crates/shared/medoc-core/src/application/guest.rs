//! The Solo guest account: one reception login whose changes go to the admin's inbox
//! (docs/architecture/editions-plan.md §4.2). The admin creates it, sets its password, turns it on
//! or off, and decides whether it may read the clinical record and/or patient documents.
//!
//! Writes by the guest are refused centrally (`rbac::effective_allowed`); what it may *propose*
//! follows its profile (`rbac::proposal_allowed`). Delivery confirmations (`purchase_order.receive`)
//! are the one direct write the guest may perform.

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::application::access_control::{self, SetStaffAccess};
use crate::application::auth_service::Session;
use crate::domain::access::{
    GUEST_CLINICAL_DOCUMENTS_TEMPLATE, GUEST_CLINICAL_TEMPLATE, GUEST_DOCUMENTS_TEMPLATE,
    GUEST_TEMPLATE,
};
use crate::domain::entities::staff::CreateStaff;
use crate::error::AppError;
use crate::infrastructure::crypto;
use crate::infrastructure::database::repos::admin::{app_kv, staff as staff_repo, staff_access};

/// `app_kv`: staff id of the guest account.
pub const GUEST_ID_KEY: &str = "guest.staff_id.v1";
/// `app_kv`: "1" while the guest may sign in.
pub const GUEST_ENABLED_KEY: &str = "guest.enabled.v1";
/// Sign-in name of the guest account.
pub const GUEST_EMAIL: &str = "guest@medoc.local";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuestAccount {
    pub exists: bool,
    pub enabled: bool,
    pub staff_id: Option<String>,
    pub email: String,
    pub clinical_read: bool,
    pub documents_read: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetGuestAccount {
    pub enabled: bool,
    /// Required when the account does not exist yet; otherwise only to change it.
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub clinical_read: bool,
    #[serde(default)]
    pub documents_read: bool,
}

fn guest_template(clinical_read: bool, documents_read: bool) -> &'static str {
    match (clinical_read, documents_read) {
        (true, true) => GUEST_CLINICAL_DOCUMENTS_TEMPLATE,
        (true, false) => GUEST_CLINICAL_TEMPLATE,
        (false, true) => GUEST_DOCUMENTS_TEMPLATE,
        (false, false) => GUEST_TEMPLATE,
    }
}

fn flags_from_template(template: Option<&str>) -> (bool, bool) {
    match template {
        Some(GUEST_CLINICAL_DOCUMENTS_TEMPLATE) => (true, true),
        Some(GUEST_CLINICAL_TEMPLATE) => (true, false),
        Some(GUEST_DOCUMENTS_TEMPLATE) => (false, true),
        _ => (false, false),
    }
}

pub async fn guest_staff_id(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    let Some(id) = app_kv::get(pool, GUEST_ID_KEY).await? else {
        return Ok(None);
    };
    let id = id.trim().trim_matches('"').to_string();
    Ok(staff_repo::find_by_id(pool, &id).await?.map(|_| id))
}

async fn enabled(pool: &SqlitePool) -> Result<bool, AppError> {
    Ok(app_kv::get(pool, GUEST_ENABLED_KEY)
        .await?
        .is_some_and(|v| v.trim().trim_matches('"') == "1"))
}

pub async fn get_account(pool: &SqlitePool) -> Result<GuestAccount, AppError> {
    let staff_id = guest_staff_id(pool).await?;
    let (clinical_read, documents_read) = match &staff_id {
        Some(id) => {
            let template = staff_access::get(pool, id)
                .await?
                .and_then(|r| r.template);
            flags_from_template(template.as_deref())
        }
        None => (false, false),
    };
    Ok(GuestAccount {
        exists: staff_id.is_some(),
        enabled: staff_id.is_some() && enabled(pool).await?,
        staff_id,
        email: GUEST_EMAIL.to_string(),
        clinical_read,
        documents_read,
    })
}

/// Creates or changes the guest account. `actor` is the admin (checked by the caller).
pub async fn set_account(
    pool: &SqlitePool,
    actor: &Session,
    req: &SetGuestAccount,
) -> Result<GuestAccount, AppError> {
    let password = req
        .password
        .as_deref()
        .map(str::trim)
        .filter(|p| !p.is_empty());
    if let Some(p) = password {
        crypto::validate_password_policy(p)?;
    }
    let id = match guest_staff_id(pool).await? {
        Some(id) => {
            if let Some(p) = password {
                let hash = crypto::hash_password(p).map_err(AppError::Internal)?;
                // Bumps the token version: open guest sessions end.
                staff_repo::replace_password(pool, &id, &hash).await?;
            }
            id
        }
        None => {
            let p = password
                .ok_or_else(|| AppError::validation_code("error.guest.password_required"))?;
            if staff_repo::find_by_email(pool, GUEST_EMAIL)
                .await?
                .is_some()
            {
                return Err(AppError::validation_code("error.staff.email_taken"));
            }
            let hash = crypto::hash_password(p).map_err(AppError::Internal)?;
            let data = CreateStaff {
                name: "Guest".into(),
                email: GUEST_EMAIL.into(),
                password: String::new(),
                role: serde_json::from_value(serde_json::json!("RECEPTION"))
                    .map_err(|e| AppError::Internal(e.to_string()))?,
                activity_area: None,
                specialty: None,
                phone: None,
            };
            // Same account cap as every other account. Solo has no team page to free a seat, so
            // say what blocks the guest instead of the generic quota text.
            let staff = staff_repo::create_with_quota(pool, &data, &hash)
                .await
                .map_err(|e| match e {
                    AppError::Validation(_) => {
                        AppError::validation_code("error.guest.account_limit")
                    }
                    other => other,
                })?;
            app_kv::set(pool, GUEST_ID_KEY, &staff.id).await?;
            staff.id
        }
    };
    let template = guest_template(req.clinical_read, req.documents_read);
    access_control::set_staff_access(
        pool,
        actor,
        &id,
        &SetStaffAccess {
            template: Some(template.to_string()),
            grants: Default::default(),
        },
    )
    .await?;
    let was_enabled = enabled(pool).await?;
    app_kv::set(pool, GUEST_ENABLED_KEY, if req.enabled { "1" } else { "0" }).await?;
    if was_enabled && !req.enabled {
        // Turning the guest off ends its sessions (same password, new token version).
        sqlx::query("UPDATE staff SET token_version = token_version + 1 WHERE id = ?1")
            .bind(&id)
            .execute(pool)
            .await?;
    }
    get_account(pool).await
}

/// False for the guest while it is turned off. Everyone else may sign in.
pub async fn login_allowed(pool: &SqlitePool, user_id: &str) -> Result<bool, AppError> {
    match guest_staff_id(pool).await? {
        Some(id) if id == user_id => enabled(pool).await,
        _ => Ok(true),
    }
}
