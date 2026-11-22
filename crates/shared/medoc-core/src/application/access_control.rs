//! Access profiles: assign, change and evaluate what a staff member may do.
//!
//! See [`crate::domain::access`] for areas, levels, templates and ceilings.
//!
//! Rules enforced here (OWASP ASVS V4, ISO/IEC 27002 §5.15–5.18):
//! - only a person holding `access.manage` (team area at full level) changes
//!   access rights, and only on the main device (rows replicate from there);
//! - nobody changes their own rights;
//! - nobody grants more than they hold themselves, area by area;
//! - a level above the person's role ceiling is refused, not silently capped;
//! - the last person able to manage access cannot lose that right;
//! - every change is audited, replicated, and ends the person's LAN tokens.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::application::auth_service::Session;
use crate::application::rbac::{effective_allowed, Role};
use crate::domain::access::{self, Area, Level, Levels};
use crate::domain::entities::staff::Staff;
use crate::domain::rbac::PermissionOverride;
use crate::error::AppError;
use crate::infrastructure::database::recorded_write;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::database::repos::admin::staff_access::{self, StaffAccessRow};
use crate::infrastructure::database::repos::admin::staff_permission;
use crate::infrastructure::database::sync_registry::APP_KV_DEPLOYMENT_KEY;

pub const MANAGE_ACTION: &str = "access.manage";

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/// What one person holds right now.
#[derive(Debug, Clone)]
pub struct AccessSnapshot {
    pub role: Role,
    /// `false`: no profile assigned. Legacy actions then follow the role
    /// matrix exactly as before, and `levels` shows the role default.
    pub profiled: bool,
    pub template: Option<String>,
    pub custom: Levels,
    pub levels: Levels,
    pub manual: Vec<PermissionOverride>,
    pub updated_at: Option<String>,
    pub updated_by: Option<String>,
}

impl AccessSnapshot {
    /// Hand-set entries first (they win), then the compiled profile.
    pub fn overrides(&self) -> Vec<PermissionOverride> {
        let mut out = self.manual.clone();
        if self.profiled {
            for compiled in access::compile_overrides(&self.levels) {
                if !out.iter().any(|o| o.action == compiled.action) {
                    out.push(compiled);
                }
            }
        }
        out
    }

    pub fn allows(&self, action: &str) -> bool {
        effective_allowed(action, self.role, &self.overrides())
    }
}

pub async fn snapshot(
    pool: &SqlitePool,
    staff_id: &str,
    role: Role,
) -> Result<AccessSnapshot, AppError> {
    let row = staff_access::get(pool, staff_id).await?;
    let legacy = staff_permission::list_for_staff(pool, staff_id).await?;
    let mut manual: Vec<PermissionOverride> = row
        .as_ref()
        .map(|r| r.action_overrides.clone())
        .unwrap_or_default();
    for o in legacy {
        if !manual.iter().any(|m| m.action == o.action) {
            manual.push(o);
        }
    }
    let (template, custom, updated_at, updated_by) = match &row {
        Some(r) => (
            r.template.clone(),
            r.grants.clone(),
            Some(r.updated_at.clone()),
            Some(r.updated_by.clone()),
        ),
        None => (None, Levels::new(), None, None),
    };
    let profiled = template.is_some() || !custom.is_empty();
    let levels = if profiled {
        access::resolve_levels(role, template.as_deref(), &custom)
    } else {
        access::default_levels(role)
    };
    Ok(AccessSnapshot {
        role,
        profiled,
        template,
        custom,
        levels,
        manual,
        updated_at,
        updated_by,
    })
}

/// Overrides to store on a [`Session`] (login, LAN JWT, desktop command).
///
/// Every `effective_allowed(action, role, &session.permission_overrides)`
/// call site then enforces the person's profile.
pub async fn session_overrides(
    pool: &SqlitePool,
    staff_id: &str,
    role_wire: &str,
) -> Result<Vec<PermissionOverride>, AppError> {
    match Role::parse(role_wire) {
        Some(role) => Ok(snapshot(pool, staff_id, role).await?.overrides()),
        None => staff_permission::list_for_staff(pool, staff_id).await,
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelDto {
    pub id: &'static str,
    pub label: &'static str,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TemplateDto {
    pub id: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub base_role: &'static str,
    pub levels: BTreeMap<&'static str, &'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AreaAccessDto {
    pub area: &'static str,
    pub label: &'static str,
    /// Effective level.
    pub level: &'static str,
    /// Level the template (or role default) gives.
    pub template_level: &'static str,
    /// Highest level this role may receive.
    pub ceiling: &'static str,
    /// The admin changed this area for this person.
    pub customised: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StaffAccessDto {
    pub staff_id: String,
    pub name: String,
    pub role: &'static str,
    pub template: Option<String>,
    /// No profile assigned yet: the role matrix still decides legacy checks.
    pub uses_role_default: bool,
    pub areas: Vec<AreaAccessDto>,
    pub action_overrides: Vec<PermissionOverride>,
    pub updated_at: Option<String>,
    pub updated_by: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MyAccessDto {
    pub role: &'static str,
    pub template: Option<String>,
    pub areas: BTreeMap<&'static str, &'static str>,
    /// Every catalogued action this person may perform (drives the UI).
    pub allowed_actions: Vec<String>,
}

/// Body of "change access" (`grants`: area → level, e.g. `{"cash_desk":"edit"}`).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetStaffAccess {
    pub template: Option<String>,
    #[serde(default)]
    pub grants: BTreeMap<String, String>,
}

pub fn role_wire(role: Role) -> &'static str {
    match role {
        Role::Physician => "PHYSICIAN",
        Role::Reception => "RECEPTION",
        Role::TaxAdvisor => "TAX_ADVISOR",
        Role::PharmaConsultant => "PHARMA_CONSULTANT",
    }
}

pub fn list_levels() -> Vec<LevelDto> {
    Level::ALL
        .into_iter()
        .map(|l| LevelDto {
            id: l.wire(),
            label: l.label(),
        })
        .collect()
}

/// Predefined profiles, optionally only those for one login role.
pub fn list_templates(role: Option<Role>) -> Vec<TemplateDto> {
    access::TEMPLATES
        .iter()
        .filter(|t| match role {
            Some(r) => r == t.base_role,
            None => true,
        })
        .map(|t| TemplateDto {
            id: t.id,
            label: t.label,
            description: t.description,
            base_role: role_wire(t.base_role),
            levels: t
                .levels()
                .into_iter()
                .map(|(a, l)| (a.wire(), l.wire()))
                .collect(),
        })
        .collect()
}

fn template_levels(snap: &AccessSnapshot) -> Levels {
    snap.template
        .as_deref()
        .and_then(access::template)
        .filter(|t| t.base_role == snap.role)
        .map(|t| t.levels())
        .unwrap_or_else(|| access::default_levels(snap.role))
}

fn staff_dto(staff: &Staff, snap: &AccessSnapshot) -> StaffAccessDto {
    let base = template_levels(snap);
    StaffAccessDto {
        staff_id: staff.id.clone(),
        name: staff.name.clone(),
        role: role_wire(snap.role),
        template: snap.template.clone(),
        uses_role_default: !snap.profiled,
        areas: Area::ALL
            .into_iter()
            .map(|area| AreaAccessDto {
                area: area.wire(),
                label: area.label(),
                level: access::level_of(&snap.levels, area).wire(),
                template_level: access::level_of(&base, area).wire(),
                ceiling: access::ceiling(snap.role, area).wire(),
                customised: snap.custom.contains_key(&area),
            })
            .collect(),
        action_overrides: snap.manual.clone(),
        updated_at: snap.updated_at.clone(),
        updated_by: snap.updated_by.clone(),
    }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

async fn load_staff(pool: &SqlitePool, staff_id: &str) -> Result<(Staff, Role), AppError> {
    let staff = staff_repo::find_by_id(pool, staff_id)
        .await?
        .ok_or_else(|| AppError::NotFound("staff".into()))?;
    let role = Role::parse(&staff.role).ok_or(AppError::Forbidden)?;
    Ok((staff, role))
}

/// Access screen for one person. Needs `staff.read` (any team viewer).
pub async fn get_staff_access(
    pool: &SqlitePool,
    actor: &Session,
    staff_id: &str,
) -> Result<StaffAccessDto, AppError> {
    let actor_snap = live_actor(pool, actor).await?.1;
    if actor.user_id != staff_id && !actor_snap.allows("staff.read") {
        return Err(AppError::Forbidden);
    }
    let (staff, role) = load_staff(pool, staff_id).await?;
    let snap = snapshot(pool, staff_id, role).await?;
    Ok(staff_dto(&staff, &snap))
}

/// What the signed-in person may do (menus, buttons, LAN `/me/access`).
pub async fn my_access(pool: &SqlitePool, user_id: &str) -> Result<MyAccessDto, AppError> {
    let (_, role) = load_staff(pool, user_id).await?;
    let snap = snapshot(pool, user_id, role).await?;
    let overrides = snap.overrides();
    let allowed_actions = access::ACTION_RULES
        .iter()
        .map(|r| r.action)
        .chain(access::UNSCOPED_ACTIONS.iter().copied())
        .filter(|a| effective_allowed(a, role, &overrides))
        .map(str::to_string)
        .collect();
    Ok(MyAccessDto {
        role: role_wire(role),
        template: snap.template.clone(),
        areas: snap
            .levels
            .iter()
            .map(|(a, l)| (a.wire(), l.wire()))
            .collect(),
        allowed_actions,
    })
}

// ---------------------------------------------------------------------------
// Changes
// ---------------------------------------------------------------------------

/// Re-read the actor from the database: a stale desktop session must not
/// keep a right that was taken away.
async fn live_actor(
    pool: &SqlitePool,
    actor: &Session,
) -> Result<(Staff, AccessSnapshot), AppError> {
    let staff = staff_repo::find_by_id(pool, &actor.user_id)
        .await?
        .ok_or(AppError::Unauthorized)?;
    if !staff.available {
        return Err(AppError::Unauthorized);
    }
    let role = Role::parse(&staff.role).ok_or(AppError::Forbidden)?;
    let snap = snapshot(pool, &staff.id, role).await?;
    Ok((staff, snap))
}

/// Access rows replicate from the main device; a replica would be overruled.
async fn ensure_main_device(pool: &SqlitePool) -> Result<(), AppError> {
    let raw =
        crate::infrastructure::database::repos::admin::app_kv::get(pool, APP_KV_DEPLOYMENT_KEY)
            .await?;
    let is_replica = raw
        .as_deref()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
        .and_then(|v| v.get("role")?.as_str().map(str::to_ascii_uppercase))
        .is_some_and(|role| role == "REPLICA");
    if is_replica {
        return Err(AppError::Validation(
            "Access rights are managed on the main device.".into(),
        ));
    }
    Ok(())
}

fn parse_grants(role: Role, raw: &BTreeMap<String, String>) -> Result<Levels, AppError> {
    let mut out = Levels::new();
    for (area_raw, level_raw) in raw {
        let area = Area::parse(area_raw)
            .ok_or_else(|| AppError::Validation(format!("Unknown access area: {area_raw}")))?;
        let level = Level::parse(level_raw)
            .ok_or_else(|| AppError::Validation(format!("Unknown access level: {level_raw}")))?;
        let cap = access::ceiling(role, area);
        if level > cap {
            return Err(AppError::Validation(format!(
                "{} cannot exceed \"{}\" for this role",
                area.label(),
                cap.label()
            )));
        }
        out.insert(area, level);
    }
    Ok(out)
}

/// Every available person other than `except` who can manage access.
async fn other_managers(pool: &SqlitePool, except: &str) -> Result<usize, AppError> {
    let ids: Vec<(String, String)> =
        sqlx::query_as("SELECT id, role FROM staff WHERE available = 1 AND id <> ?1")
            .bind(except)
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    let mut n = 0;
    for (id, role_raw) in ids {
        let Some(role) = Role::parse(&role_raw) else {
            continue;
        };
        if snapshot(pool, &id, role).await?.allows(MANAGE_ACTION) {
            n += 1;
        }
    }
    Ok(n)
}

pub(crate) struct Checked {
    pub(crate) target: Staff,
    pub(crate) target_role: Role,
    pub(crate) before: AccessSnapshot,
    pub(crate) actor_id: String,
}

pub(crate) async fn check_change(
    pool: &SqlitePool,
    actor: &Session,
    staff_id: &str,
    new_levels_for: impl Fn(Role) -> Result<Levels, AppError>,
) -> Result<(Checked, Levels), AppError> {
    ensure_main_device(pool).await?;
    let (actor_staff, actor_snap) = live_actor(pool, actor).await?;
    if !actor_snap.allows(MANAGE_ACTION) {
        return Err(AppError::Forbidden);
    }
    if actor_staff.id == staff_id {
        return Err(AppError::Validation(
            "You cannot change your own access rights.".into(),
        ));
    }
    let (target, target_role) = load_staff(pool, staff_id).await?;
    let new_levels = new_levels_for(target_role)?;
    // No escalation by proxy: an admin cannot hand out more than they hold.
    for area in Area::ALL {
        let wanted = access::level_of(&new_levels, area);
        let held = access::level_of(&actor_snap.levels, area);
        if wanted > held {
            return Err(AppError::Validation(format!(
                "You cannot grant more than your own access to {}",
                area.label()
            )));
        }
    }
    let before = snapshot(pool, staff_id, target_role).await?;
    let loses_manage = before.allows(MANAGE_ACTION)
        && !access::rule(MANAGE_ACTION).is_some_and(|r| access::rule_allows(&new_levels, r));
    if loses_manage && other_managers(pool, staff_id).await? == 0 {
        return Err(AppError::Validation(
            "At least one active person must keep the right to manage access.".into(),
        ));
    }
    Ok((
        Checked {
            target,
            target_role,
            before,
            actor_id: actor_staff.id,
        },
        new_levels,
    ))
}

pub(crate) async fn write_change(
    pool: &SqlitePool,
    checked: &Checked,
    row: Option<StaffAccessRow>,
    audit_action: &str,
    details: serde_json::Value,
) -> Result<(), AppError> {
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    match row {
        Some(row) => staff_access::upsert_in_tx(&mut tx, &row).await?,
        None => {
            staff_access::delete_in_tx(&mut tx, &checked.target.id).await?;
        }
    }
    staff_permission::bump_token_version(&mut tx, &checked.target.id).await?;
    recorded_write::audit_in_tx(
        &mut tx,
        &checked.actor_id,
        audit_action,
        "staff",
        Some(&checked.target.id),
        Some(&details.to_string()),
    )
    .await?;
    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::security",
        event = audit_action,
        actor = %checked.actor_id,
        staff_id = %checked.target.id,
    );
    Ok(())
}

fn level_map(levels: &Levels) -> BTreeMap<&'static str, &'static str> {
    levels.iter().map(|(a, l)| (a.wire(), l.wire())).collect()
}

/// Assign a template and per-area changes to one person.
pub async fn set_staff_access(
    pool: &SqlitePool,
    actor: &Session,
    staff_id: &str,
    req: &SetStaffAccess,
) -> Result<StaffAccessDto, AppError> {
    let template_id = req
        .template
        .as_deref()
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .map(str::to_string);
    let (checked, new_levels) = check_change(pool, actor, staff_id, |role| {
        if let Some(id) = template_id.as_deref() {
            let t = access::template(id)
                .ok_or_else(|| AppError::Validation(format!("Unknown access profile: {id}")))?;
            if t.base_role != role {
                return Err(AppError::Validation(
                    "This access profile is made for another role.".into(),
                ));
            }
        }
        let custom = parse_grants(role, &req.grants)?;
        Ok(access::resolve_levels(
            role,
            template_id.as_deref(),
            &custom,
        ))
    })
    .await?;

    // Store only what differs from the template, so a later template change
    // still reaches the areas the admin did not touch.
    let base = access::resolve_levels(checked.target_role, template_id.as_deref(), &Levels::new());
    let custom: Levels = new_levels
        .iter()
        .filter(|(area, level)| access::level_of(&base, **area) != **level)
        .map(|(a, l)| (*a, *l))
        .collect();
    let row = StaffAccessRow {
        staff_id: checked.target.id.clone(),
        // Explicit template even for the role default: "profiled" from now on.
        template: Some(
            template_id
                .clone()
                .unwrap_or_else(|| access::default_template_id(checked.target_role).to_string()),
        ),
        grants: custom,
        action_overrides: staff_access::get(pool, &checked.target.id)
            .await?
            .map(|r| r.action_overrides)
            .unwrap_or_default(),
        updated_at: String::new(),
        updated_by: checked.actor_id.clone(),
    };
    let details = serde_json::json!({
        "template": row.template,
        "before": level_map(&checked.before.levels),
        "after": level_map(&new_levels),
    });
    write_change(pool, &checked, Some(row), "ACCESS_PROFILE_SET", details).await?;
    get_staff_access(pool, actor, staff_id).await
}

/// Back to "no profile": the role matrix decides again.
pub async fn reset_staff_access(
    pool: &SqlitePool,
    actor: &Session,
    staff_id: &str,
) -> Result<StaffAccessDto, AppError> {
    let (checked, _) = check_change(pool, actor, staff_id, |role| {
        Ok(access::default_levels(role))
    })
    .await?;
    let existing = staff_access::get(pool, staff_id).await?;
    let row = existing
        .filter(|r| !r.action_overrides.is_empty())
        .map(|mut r| {
            r.template = None;
            r.grants = Levels::new();
            r.updated_by = checked.actor_id.clone();
            r
        });
    let details = serde_json::json!({ "before": level_map(&checked.before.levels) });
    write_change(pool, &checked, row, "ACCESS_PROFILE_RESET", details).await?;
    get_staff_access(pool, actor, staff_id).await
}

/// Give every person without a profile the default profile of their role,
/// so enforcement no longer depends on the coarse role matrix.
/// The caller keeps their own rights (no self-change); returns how many changed.
pub async fn assign_default_profiles(pool: &SqlitePool, actor: &Session) -> Result<u32, AppError> {
    ensure_main_device(pool).await?;
    let (actor_staff, actor_snap) = live_actor(pool, actor).await?;
    if !actor_snap.allows(MANAGE_ACTION) {
        return Err(AppError::Forbidden);
    }
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT id, role FROM staff")
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    let mut changed = 0u32;
    for (id, role_raw) in rows {
        if id == actor_staff.id {
            continue;
        }
        let Some(role) = Role::parse(&role_raw) else {
            continue;
        };
        if snapshot(pool, &id, role).await?.profiled {
            continue;
        }
        let req = SetStaffAccess {
            template: Some(access::default_template_id(role).to_string()),
            grants: BTreeMap::new(),
        };
        match set_staff_access(pool, actor, &id, &req).await {
            Ok(_) => changed += 1,
            Err(e) => tracing::warn!(
                target: "medoc::security",
                event = "ACCESS_DEFAULT_PROFILE_SKIPPED",
                staff_id = %id,
                error = %e
            ),
        }
    }
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn templates_can_be_filtered_by_role() {
        let reception = list_templates(Some(Role::Reception));
        assert!(reception.len() >= 6);
        assert!(reception.iter().all(|t| t.base_role == "RECEPTION"));
        assert!(list_templates(None).len() > reception.len());
    }

    #[test]
    fn grants_above_the_ceiling_are_refused_not_capped() {
        let mut raw = BTreeMap::new();
        raw.insert("medical_record".to_string(), "edit".to_string());
        assert!(parse_grants(Role::Reception, &raw).is_err());
        assert!(parse_grants(Role::Physician, &raw).is_ok());
        let mut bad = BTreeMap::new();
        bad.insert("everything".to_string(), "full".to_string());
        assert!(parse_grants(Role::Physician, &bad).is_err());
    }
}
