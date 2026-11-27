//! Allowances store and query filter (Group, T5.1). Decisions live in `domain::allowances`.
//!
//! * `allowance_rule`: one row per owner, area and kind (`view` / `change`).
//! * `record_visibility`: one row per record made private or hidden from people.
//!
//! Both replicate to every device (one legal entity, the full database everywhere) and are
//! **owner-only**: a row is written here only by its owner, every write records the writer
//! (`updated_by_staff_id`), and a device refuses an incoming row whose writer is not its
//! owner (`is_owner_signed`, checked by the sync merge, T4.2). Every change is audited.
//!
//! [`ScopeFilter`] is the one place lists ask "which owners and which records may this person
//! see": it gives a SQL condition to add to a query and a per-row [`Sight`].

use std::collections::{BTreeMap, HashMap, HashSet};

use sqlx::SqlitePool;

use crate::application::access_control::{self, MANAGE_ACTION};
use crate::application::auth_service::Session;
use crate::application::rbac::Role;
use crate::domain::allowances::{
    default_change, default_view, may_change, record_sight, sight, ChangeRule, RecordRule,
    ShareArea, Sight, ViewRule, Viewer,
};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::sync_outbox;

pub const RULE_TABLE: &str = "allowance_rule";
pub const RECORD_TABLE: &str = "record_visibility";

pub async fn ensure_tables(pool: &SqlitePool) -> Result<(), AppError> {
    for sql in [
        "CREATE TABLE IF NOT EXISTS allowance_rule (
            id TEXT PRIMARY KEY,
            owner_staff_id TEXT NOT NULL,
            area TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('view', 'change')),
            rule_json TEXT NOT NULL,
            updated_by_staff_id TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )",
        "CREATE TABLE IF NOT EXISTS record_visibility (
            id TEXT PRIMARY KEY,
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            owner_staff_id TEXT NOT NULL,
            rule_json TEXT NOT NULL,
            updated_by_staff_id TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )",
        "CREATE INDEX IF NOT EXISTS ix_record_visibility_table ON record_visibility (entity_table)",
    ] {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// T4.2: an incoming row of an owner-only table is accepted only when its owner wrote it. A
/// rule's id names its owner, so nobody can file a rule under someone else's name either.
pub fn is_owner_signed(
    table: &str,
    entity_id: &str,
    payload: &serde_json::Map<String, serde_json::Value>,
) -> bool {
    if table != RULE_TABLE && table != RECORD_TABLE {
        return true;
    }
    let field = |k: &str| payload.get(k).and_then(|v| v.as_str()).unwrap_or("");
    let owner = field("owner_staff_id");
    let signed = !owner.is_empty() && owner == field("updated_by_staff_id");
    signed && (table != RULE_TABLE || entity_id.starts_with(&format!("{owner}|")))
}

fn rule_id(owner: &str, area: ShareArea, kind: &str) -> String {
    format!("{owner}|{}|{kind}", area.wire())
}

/// The person behind a session, as the rules see them.
pub async fn viewer_of(pool: &SqlitePool, session: &Session) -> Result<Viewer, AppError> {
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    let snap = access_control::snapshot(pool, &session.user_id, role).await?;
    Ok(Viewer {
        staff_id: session.user_id.clone(),
        is_admin: snap.allows(MANAGE_ACTION),
        is_reception: role == Role::Reception,
    })
}

/// Every owner's rules, defaults filled in.
#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerRules {
    pub view: BTreeMap<ShareArea, ViewRule>,
    pub change: BTreeMap<ShareArea, ChangeRule>,
}

impl OwnerRules {
    fn defaults() -> Self {
        Self {
            view: ShareArea::ALL
                .iter()
                .map(|a| (*a, default_view(*a)))
                .collect(),
            change: ShareArea::ALL
                .iter()
                .map(|a| (*a, default_change(*a)))
                .collect(),
        }
    }
}

/// Rules of every owner that has set any; owners without a row use the defaults.
pub async fn load_rules(pool: &SqlitePool) -> Result<HashMap<String, OwnerRules>, AppError> {
    ensure_tables(pool).await?;
    let rows: Vec<(String, String, String, String)> =
        sqlx::query_as("SELECT owner_staff_id, area, kind, rule_json FROM allowance_rule")
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    let mut out: HashMap<String, OwnerRules> = HashMap::new();
    for (owner, area, kind, json) in rows {
        let Some(area) = ShareArea::parse(&area) else {
            continue;
        };
        let entry = out.entry(owner).or_insert_with(OwnerRules::defaults);
        match kind.as_str() {
            "view" => {
                if let Ok(r) = serde_json::from_str(&json) {
                    entry.view.insert(area, r);
                }
            }
            _ => {
                if let Ok(r) = serde_json::from_str(&json) {
                    entry.change.insert(area, r);
                }
            }
        }
    }
    Ok(out)
}

/// The rules of one owner (defaults when none are stored).
pub async fn rules_of(pool: &SqlitePool, owner: &str) -> Result<OwnerRules, AppError> {
    Ok(load_rules(pool)
        .await?
        .remove(owner)
        .unwrap_or_else(OwnerRules::defaults))
}

/// A rule change asked for by the owner.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum RuleChange {
    View { area: ShareArea, rule: ViewRule },
    Change { area: ShareArea, rule: ChangeRule },
}

/// Owner-only: set one of my rules. Nobody sets rules about someone else's data.
pub async fn set_my_rule(
    pool: &SqlitePool,
    session: &Session,
    change: &RuleChange,
) -> Result<OwnerRules, AppError> {
    ensure_tables(pool).await?;
    let owner = session.user_id.as_str();
    let (area, kind, json) = match change {
        RuleChange::View { area, rule } => (*area, "view", serde_json::to_string(rule)),
        RuleChange::Change { area, rule } => (*area, "change", serde_json::to_string(rule)),
    };
    let json = json.map_err(|e| AppError::Internal(format!("rule json: {e}")))?;
    let id = rule_id(owner, area, kind);
    sqlx::query(
        "INSERT INTO allowance_rule (id, owner_staff_id, area, kind, rule_json, updated_by_staff_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?2)
         ON CONFLICT(id) DO UPDATE SET rule_json = excluded.rule_json,
            updated_by_staff_id = excluded.updated_by_staff_id,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
    )
    .bind(&id)
    .bind(owner)
    .bind(area.wire())
    .bind(kind)
    .bind(&json)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sync_outbox::record_or_noop(pool, RULE_TABLE, &id, "UPDATE", "").await?;
    let details = serde_json::json!({ "area": area.wire(), "kind": kind, "rule": json });
    audit_repo::create(
        pool,
        owner,
        "ALLOWANCE_SET",
        "AllowanceRule",
        Some(&id),
        Some(&details.to_string()),
    )
    .await?;
    rules_of(pool, owner).await
}

/// Owner-only: make one of my records private, hide it from people, or (`None`) share it again.
pub async fn set_record_rule(
    pool: &SqlitePool,
    session: &Session,
    entity_table: &str,
    entity_id: &str,
    record_owner: &str,
    rule: Option<&RecordRule>,
) -> Result<(), AppError> {
    ensure_tables(pool).await?;
    if record_owner != session.user_id {
        return Err(AppError::Forbidden);
    }
    let id = format!("{entity_table}|{entity_id}");
    match rule {
        Some(rule) => {
            let json = serde_json::to_string(rule)
                .map_err(|e| AppError::Internal(format!("rule json: {e}")))?;
            sqlx::query(
                "INSERT INTO record_visibility
                    (id, entity_table, entity_id, owner_staff_id, rule_json, updated_by_staff_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?4)
                 ON CONFLICT(id) DO UPDATE SET rule_json = excluded.rule_json,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')",
            )
            .bind(&id)
            .bind(entity_table)
            .bind(entity_id)
            .bind(record_owner)
            .bind(&json)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
            sync_outbox::record_or_noop(pool, RECORD_TABLE, &id, "UPDATE", "").await?;
        }
        None => {
            sqlx::query("DELETE FROM record_visibility WHERE id = ?1")
                .bind(&id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            sync_outbox::record_or_noop(pool, RECORD_TABLE, &id, "DELETE", "").await?;
        }
    }
    let details = serde_json::json!({ "table": entity_table, "rule": rule });
    audit_repo::create(
        pool,
        &session.user_id,
        "RECORD_VISIBILITY_SET",
        entity_table,
        Some(entity_id),
        Some(&details.to_string()),
    )
    .await?;
    Ok(())
}

/// Which owners' data and which records a viewer may see in one area.
#[derive(Debug, Clone)]
pub struct ScopeFilter {
    viewer: Viewer,
    area: ShareArea,
    rules: HashMap<String, OwnerRules>,
    records: HashMap<String, (String, RecordRule)>,
}

impl ScopeFilter {
    /// Build the filter for `entity_table` (record rules of that table are loaded once).
    pub async fn load(
        pool: &SqlitePool,
        viewer: Viewer,
        area: ShareArea,
        entity_table: &str,
    ) -> Result<Self, AppError> {
        let rules = load_rules(pool).await?;
        let rows: Vec<(String, String, String)> = sqlx::query_as(
            "SELECT entity_id, owner_staff_id, rule_json FROM record_visibility WHERE entity_table = ?1",
        )
        .bind(entity_table)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        let records = rows
            .into_iter()
            .filter_map(|(id, owner, json)| Some((id, (owner, serde_json::from_str(&json).ok()?))))
            .collect();
        Ok(Self {
            viewer,
            area,
            rules,
            records,
        })
    }

    fn area_sight(&self, owner: Option<&str>) -> Sight {
        let rule = owner
            .and_then(|o| self.rules.get(o))
            .and_then(|r| r.view.get(&self.area).cloned())
            .unwrap_or_else(|| default_view(self.area));
        sight(owner, &self.viewer, &rule)
    }

    /// What the viewer sees of one record.
    pub fn sight_of(&self, entity_id: &str, owner: Option<&str>) -> Sight {
        let record = self.records.get(entity_id).map(|(_, r)| r);
        record_sight(owner, &self.viewer, self.area_sight(owner), record)
    }

    /// Owners whose data in this area the viewer does not see at all.
    pub fn hidden_owners(&self) -> Vec<String> {
        let mut out: Vec<String> = self
            .rules
            .keys()
            .filter(|o| self.area_sight(Some(o)) == Sight::Hidden)
            .cloned()
            .collect();
        out.sort();
        out
    }

    /// Records hidden from the viewer by a record rule.
    pub fn hidden_records(&self) -> Vec<String> {
        let mut out: Vec<String> = self
            .records
            .iter()
            .filter(|(id, (owner, _))| self.sight_of(id, Some(owner)) == Sight::Hidden)
            .map(|(id, _)| id.clone())
            .collect();
        out.sort();
        out
    }

    /// SQL condition (with `?` placeholders, values in order) that drops hidden owners and
    /// hidden records: `AND <condition>` it into a list query. The placeholders are bare `?`: do not
    /// mix them with numbered ones (`?1`) in one query, sqlx then counts the bare ones from 1.
    pub fn sql(&self, id_column: &str, owner_column: &str) -> (String, Vec<String>) {
        let owners = self.hidden_owners();
        let records = self.hidden_records();
        let mut parts = Vec::new();
        let mut binds = Vec::new();
        if !owners.is_empty() {
            parts.push(format!(
                "({owner_column} IS NULL OR {owner_column} NOT IN ({}))",
                vec!["?"; owners.len()].join(", ")
            ));
            binds.extend(owners);
        }
        if !records.is_empty() {
            parts.push(format!(
                "{id_column} NOT IN ({})",
                vec!["?"; records.len()].join(", ")
            ));
            binds.extend(records);
        }
        if parts.is_empty() {
            ("1 = 1".to_string(), binds)
        } else {
            (parts.join(" AND "), binds)
        }
    }

    /// Owners with data hidden from the viewer, for the "not shared by Dr X" note in lists.
    pub fn notes(&self) -> HashSet<String> {
        let mut owners: HashSet<String> = self.hidden_owners().into_iter().collect();
        owners.extend(
            self.records
                .values()
                .map(|(o, _)| o.clone())
                .filter(|o| *o != self.viewer.staff_id),
        );
        owners
    }
}

/// May the actor change `owner`'s data in `area`? (Single-row commands.)
pub async fn require_change(
    pool: &SqlitePool,
    actor: &Viewer,
    area: ShareArea,
    owner: Option<&str>,
) -> Result<(), AppError> {
    let rule = match owner {
        Some(o) => rules_of(pool, o).await?.change.remove(&area),
        None => None,
    }
    .unwrap_or_else(|| default_change(area));
    if may_change(owner, actor, &rule) {
        Ok(())
    } else {
        Err(AppError::validation_code(
            "error.access.not_allowed_by_owner",
        ))
    }
}
