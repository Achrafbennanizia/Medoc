//! Settings → Allowances (Group, T5.2): each dentist's sharing rules and per-record privacy.
//! Decisions and storage live in `medoc_core::application::allowances`.

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac::Role;
use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require_authenticated;
use crate::error::AppError;
use medoc_core::application::allowances::{self, OwnerRules, RuleChange};
use medoc_core::domain::allowances::RecordRule;

/// Tables whose records name an owner, and the column that names them.
const OWNED_TABLES: &[(&str, &str)] = &[
    ("appointment", "physician_id"),
    ("examination", "responsible_staff_id"),
    ("treatment", "responsible_staff_id"),
    ("patient_chart", "responsible_staff_id"),
    ("prescription", "signed_by_staff_id"),
    ("certificate", "signed_by_staff_id"),
    ("practice_task", "doctor_id"),
    ("purchase_order", "ordered_for_staff_id"),
];

fn owner_column(table: &str) -> Result<&'static str, AppError> {
    OWNED_TABLES
        .iter()
        .find(|(t, _)| *t == table)
        .map(|(_, c)| *c)
        .ok_or_else(|| AppError::Validation(format!("records of {table} have no owner")))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OwnerAllowances {
    pub staff_id: String,
    pub name: String,
    pub is_me: bool,
    pub rules: OwnerRules,
}

/// Every dentist's rules, mine first: I edit mine and read the others'.
#[tauri::command]
pub async fn allowances_list(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<OwnerAllowances>, AppError> {
    let session = require_authenticated(&session_state)?;
    let doctors: Vec<(String, String)> =
        sqlx::query_as("SELECT id, name FROM staff WHERE UPPER(role) = 'PHYSICIAN' ORDER BY name")
            .fetch_all(&*pool)
            .await
            .map_err(AppError::Database)?;
    let mut out = Vec::with_capacity(doctors.len());
    for (id, name) in doctors {
        out.push(OwnerAllowances {
            is_me: id == session.user_id,
            rules: allowances::rules_of(&pool, &id).await?,
            staff_id: id,
            name,
        });
    }
    out.sort_by_key(|o| !o.is_me);
    Ok(out)
}

/// Change one of my own rules. Only a dentist owns data, so only a dentist sets rules.
#[tauri::command]
pub async fn allowances_set(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    change: RuleChange,
) -> Result<OwnerRules, AppError> {
    let session = require_authenticated(&session_state)?;
    if Role::parse(&session.role) != Some(Role::Physician) {
        return Err(AppError::Forbidden);
    }
    allowances::set_my_rule(&pool, &session, &change).await
}

async fn record_owner(pool: &SqlitePool, table: &str, id: &str) -> Result<String, AppError> {
    let column = owner_column(table)?;
    let owner: Option<Option<String>> =
        sqlx::query_scalar(&format!("SELECT {column} FROM {table} WHERE id = ?1"))
            .bind(id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    owner
        .ok_or_else(|| AppError::NotFound(table.into()))?
        .filter(|o| !o.is_empty())
        .ok_or_else(|| AppError::Validation("this record names no dentist".into()))
}

/// "Make private" / "Hide from …" / share again on one of my records.
#[tauri::command]
pub async fn record_visibility_set(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    entity_table: String,
    entity_id: String,
    rule: Option<RecordRule>,
) -> Result<(), AppError> {
    let session = require_authenticated(&session_state)?;
    let owner = record_owner(&pool, &entity_table, &entity_id).await?;
    allowances::set_record_rule(
        &pool,
        &session,
        &entity_table,
        &entity_id,
        &owner,
        rule.as_ref(),
    )
    .await
}

#[tauri::command]
pub async fn record_visibility_get(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    entity_table: String,
    entity_id: String,
) -> Result<Option<RecordRule>, AppError> {
    require_authenticated(&session_state)?;
    owner_column(&entity_table)?;
    allowances::ensure_tables(&pool).await?;
    let json: Option<String> =
        sqlx::query_scalar("SELECT rule_json FROM record_visibility WHERE id = ?1")
            .bind(format!("{entity_table}|{entity_id}"))
            .fetch_optional(&*pool)
            .await
            .map_err(AppError::Database)?;
    Ok(json.and_then(|j| serde_json::from_str(&j).ok()))
}

#[cfg(test)]
mod tests {
    use super::owner_column;

    #[test]
    fn only_owned_tables_take_record_rules() {
        assert_eq!(owner_column("appointment").unwrap(), "physician_id");
        assert!(
            owner_column("patient").is_err(),
            "patient master data is always shared"
        );
    }
}
