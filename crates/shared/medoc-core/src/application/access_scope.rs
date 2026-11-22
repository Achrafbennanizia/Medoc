//! Change a person's relationship scopes ("own appointments only"), with the same rules as
//! every access change (access_control: main device only, `access.manage`, not yourself,
//! last manager kept, audited, ends the person's LAN tokens).

use std::collections::BTreeSet;

use sqlx::SqlitePool;

use crate::application::access_control::{self, check_change, write_change, StaffAccessDto};
use crate::application::auth_service::Session;
use crate::application::rbac::Role;
use crate::domain::access::Area;
use crate::domain::access_relation::{own_scopes, with_own_scopes, SCOPABLE_AREAS};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::database::repos::admin::staff_access::{self, StaffAccessRow};

/// Parse wire area names; unknown or unscopable areas are refused, not ignored.
pub fn parse_scopes(raw: &[String]) -> Result<BTreeSet<Area>, AppError> {
    raw.iter()
        .map(|a| {
            Area::parse(a)
                .filter(|area| SCOPABLE_AREAS.contains(area))
                .ok_or_else(|| {
                    AppError::Validation(format!("This area cannot be limited to own records: {a}"))
                })
        })
        .collect()
}

pub async fn set_staff_scopes(
    pool: &SqlitePool,
    actor: &Session,
    staff_id: &str,
    own: &BTreeSet<Area>,
) -> Result<StaffAccessDto, AppError> {
    // Levels stay as they are: a scope only narrows them, so it can never escalate.
    let target = staff_repo::find_by_id(pool, staff_id)
        .await?
        .ok_or_else(|| AppError::NotFound("staff".into()))?;
    let role = Role::parse(&target.role).ok_or(AppError::Forbidden)?;
    let current = access_control::snapshot(pool, staff_id, role).await?.levels;
    let (checked, _) = check_change(pool, actor, staff_id, |_| Ok(current.clone())).await?;
    let existing = staff_access::get(pool, staff_id)
        .await?
        .unwrap_or_else(|| StaffAccessRow {
            staff_id: staff_id.to_string(),
            ..StaffAccessRow::default()
        });
    let before = own_scopes(&existing.action_overrides);
    let row = StaffAccessRow {
        action_overrides: with_own_scopes(&existing.action_overrides, own),
        updated_by: checked.actor_id.clone(),
        ..existing
    };
    let wires = |s: &BTreeSet<Area>| s.iter().map(|a| a.wire()).collect::<Vec<_>>();
    let details =
        serde_json::json!({ "scopes_before": wires(&before), "scopes_after": wires(own) });
    write_change(pool, &checked, Some(row), "ACCESS_SCOPE_SET", details).await?;
    access_control::get_staff_access(pool, actor, staff_id).await
}
