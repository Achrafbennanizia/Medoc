//! `staff_access_profile`: one row per staff member, replicated from the main
//! device only (see `sync_registry::MASTER_ONLY_TABLES`).
//!
//! - `template`: predefined profile id (`reception.cashier` …), or NULL for the
//!   role default;
//! - `grants_json`: per-area levels the admin changed for this person,
//!   e.g. `{"cash_desk":"edit","calendar":"full"}`;
//! - `action_overrides_json`: hand-set ALLOW/DENY entries for single actions
//!   (FA-PERS-07). They used to live only in `staff_permission_override`,
//!   which never replicated; they are mirrored here so a DENY set on the main
//!   device also holds on every replica.

use sqlx::{Sqlite, SqlitePool, Transaction};

use crate::domain::access::{Area, Level, Levels};
use crate::domain::rbac::PermissionOverride;
use crate::error::AppError;
use crate::infrastructure::database::recorded_write;

pub const TABLE: &str = "staff_access_profile";

const TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS staff_access_profile (
    id TEXT PRIMARY KEY,
    template TEXT,
    grants_json TEXT NOT NULL DEFAULT '{}',
    action_overrides_json TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
)";

pub async fn ensure_table<'e, E>(executor: E) -> Result<(), AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query(TABLE_SQL)
        .execute(executor)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct StaffAccessRow {
    pub staff_id: String,
    pub template: Option<String>,
    pub grants: Levels,
    pub action_overrides: Vec<PermissionOverride>,
    pub updated_at: String,
    pub updated_by: String,
}

type RawRow = (String, Option<String>, String, String, String, String);

const SELECT: &str =
    "SELECT id, template, grants_json, action_overrides_json, updated_at, updated_by
                      FROM staff_access_profile WHERE id = ?1";

/// Unknown areas or levels in stored JSON are dropped (never widened).
pub fn parse_grants(raw: &str) -> Levels {
    let parsed: std::collections::BTreeMap<String, String> = match serde_json::from_str(raw) {
        Ok(map) => map,
        Err(e) => {
            tracing::warn!(
                target: "medoc::security",
                event = "ACCESS_GRANTS_UNREADABLE",
                error = %e
            );
            return Levels::new();
        }
    };
    parsed
        .into_iter()
        .filter_map(|(area, level)| Some((Area::parse(&area)?, Level::parse(&level)?)))
        .collect()
}

pub fn grants_json(grants: &Levels) -> String {
    let map: std::collections::BTreeMap<&str, &str> = grants
        .iter()
        .map(|(area, level)| (area.wire(), level.wire()))
        .collect();
    serde_json::to_string(&map).unwrap_or_else(|_| "{}".into())
}

fn parse_overrides(raw: &str) -> Vec<PermissionOverride> {
    serde_json::from_str::<Vec<PermissionOverride>>(raw)
        .unwrap_or_default()
        .into_iter()
        .filter(|o| o.effect == "ALLOW" || o.effect == "DENY")
        .collect()
}

fn from_raw(row: RawRow) -> StaffAccessRow {
    let (staff_id, template, grants, overrides, updated_at, updated_by) = row;
    StaffAccessRow {
        staff_id,
        template: template.filter(|t| !t.trim().is_empty()),
        grants: parse_grants(&grants),
        action_overrides: parse_overrides(&overrides),
        updated_at,
        updated_by,
    }
}

pub async fn get(pool: &SqlitePool, staff_id: &str) -> Result<Option<StaffAccessRow>, AppError> {
    let row: Option<RawRow> = sqlx::query_as(SELECT)
        .bind(staff_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(row.map(from_raw))
}

pub async fn get_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
) -> Result<Option<StaffAccessRow>, AppError> {
    let row: Option<RawRow> = sqlx::query_as(SELECT)
        .bind(staff_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    Ok(row.map(from_raw))
}

/// Write the row and queue it for replication in the caller's transaction.
pub async fn upsert_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    row: &StaffAccessRow,
) -> Result<(), AppError> {
    let existing = get_in_tx(tx, &row.staff_id).await?;
    let updated_at =
        recorded_write::next_updated_at(existing.as_ref().map(|r| r.updated_at.as_str()));
    let overrides = serde_json::to_string(&row.action_overrides).unwrap_or_else(|_| "[]".into());
    sqlx::query(
        "INSERT INTO staff_access_profile
            (id, template, grants_json, action_overrides_json, updated_at, updated_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
            template = excluded.template,
            grants_json = excluded.grants_json,
            action_overrides_json = excluded.action_overrides_json,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by",
    )
    .bind(&row.staff_id)
    .bind(row.template.as_deref())
    .bind(grants_json(&row.grants))
    .bind(overrides)
    .bind(&updated_at)
    .bind(&row.updated_by)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    recorded_write::record_in_tx(
        tx,
        TABLE,
        &row.staff_id,
        if existing.is_some() {
            "UPDATE"
        } else {
            "INSERT"
        },
    )
    .await
}

pub async fn delete_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
) -> Result<bool, AppError> {
    let n = sqlx::query("DELETE FROM staff_access_profile WHERE id = ?1")
        .bind(staff_id)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    if n > 0 {
        recorded_write::record_in_tx(tx, TABLE, staff_id, "DELETE").await?;
    }
    Ok(n > 0)
}

/// Copy the staff member's per-action overrides into the replicated row,
/// keeping template and area grants as they are.
pub async fn mirror_overrides_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    staff_id: &str,
    overrides: Vec<PermissionOverride>,
) -> Result<(), AppError> {
    let mut row = get_in_tx(tx, staff_id).await?.unwrap_or(StaffAccessRow {
        staff_id: staff_id.to_string(),
        ..StaffAccessRow::default()
    });
    if overrides.is_empty() && row.template.is_none() && row.grants.is_empty() {
        delete_in_tx(tx, staff_id).await?;
        return Ok(());
    }
    row.action_overrides = overrides;
    upsert_in_tx(tx, &row).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grants_round_trip_and_drop_unknown_entries() {
        let mut g = Levels::new();
        g.insert(Area::CashDesk, Level::Edit);
        g.insert(Area::Calendar, Level::Full);
        let json = grants_json(&g);
        assert_eq!(parse_grants(&json), g);
        let tampered = r#"{"cash_desk":"edit","root":"full","calendar":"superuser"}"#;
        let parsed = parse_grants(tampered);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed.get(&Area::CashDesk), Some(&Level::Edit));
        assert!(parse_grants("not json").is_empty());
    }
}
