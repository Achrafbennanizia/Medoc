//! History (T5.8 phase 2): who changed a record, on which device, when, and what (old → new).
//! Duo and Group. Each table needs the permission that reads that table, so reception never sees
//! the history of clinical text. Cabinet+: the row owner's "History of my records" rule
//! (`ShareArea::History`) applies; rows of doctors who do not share it are left out and named.

use std::collections::{BTreeSet, HashMap};

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use medoc_core::application::auth_service::Session;
use medoc_core::application::history::{self, HistoryEntry};
use medoc_core::application::rbac::{effective_allowed, Role};
use medoc_core::domain::allowances::ShareArea;
use medoc_core::infrastructure::database::change_record::TRACKED;

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::{require, require_authenticated};
use crate::commands::share_scope;
use crate::error::AppError;

const MEDICAL: &[&str] = &["patient.read_medical"];

/// Permission that reads each table with a history (any one of them).
const READ_PERMISSIONS: &[(&str, &[&str])] = &[
    ("patient", &["patient.read"]),
    ("patient_chart", MEDICAL),
    ("anamnesis_form", MEDICAL),
    ("dental_finding", MEDICAL),
    ("examination", MEDICAL),
    ("treatment", MEDICAL),
    ("chart_attachment", MEDICAL),
    ("chart_validation", MEDICAL),
    ("prescription", MEDICAL),
    ("certificate", MEDICAL),
    ("sick_leave_certificate", MEDICAL),
    ("issued_document", &["patient.read_documents"]),
    ("appointment", &["appointment.read"]),
    ("payment", &["finance.read", "finance.reception.view"]),
    (
        "practice_task",
        &["task.status.fulfill", "administration.read"],
    ),
    ("purchase_order", &["purchase_order.read"]),
];

/// Column naming the doctor a row belongs to (Cabinet+ sharing).
const OWNER_COLUMNS: &[(&str, &str)] = &[
    ("appointment", "physician_id"),
    ("examination", "responsible_staff_id"),
    ("treatment", "responsible_staff_id"),
    ("patient_chart", "responsible_staff_id"),
    ("prescription", "signed_by_staff_id"),
    ("certificate", "signed_by_staff_id"),
    ("practice_task", "doctor_id"),
    ("purchase_order", "ordered_for_staff_id"),
    ("payment", "for_staff_id"),
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryList {
    pub items: Vec<HistoryEntry>,
    /// Doctors whose history is not shared with the viewer.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub hidden_doctors: Vec<String>,
}

pub fn may_read(session: &Session, table: &str) -> bool {
    let Some(role) = Role::parse(&session.role) else {
        return false;
    };
    READ_PERMISSIONS
        .iter()
        .find(|(t, _)| *t == table)
        .is_some_and(|(_, perms)| {
            perms
                .iter()
                .any(|p| effective_allowed(p, role, &session.permission_overrides))
        })
}

fn tracked(table: &str) -> Result<&'static str, AppError> {
    TRACKED
        .iter()
        .copied()
        .find(|t| *t == table)
        .ok_or_else(|| AppError::validation_code("error.history.unknown_table"))
}

async fn owner_of(pool: &SqlitePool, table: &str, id: &str) -> Option<String> {
    let col = OWNER_COLUMNS.iter().find(|(t, _)| *t == table)?.1;
    sqlx::query_scalar::<_, Option<String>>(&format!("SELECT {col} FROM {table} WHERE id = ?1"))
        .bind(id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .flatten()
        .filter(|s| !s.is_empty())
}

/// Leave out entries whose row owner does not share History with the viewer.
pub async fn apply_sharing(
    pool: &SqlitePool,
    session: &Session,
    items: Vec<HistoryEntry>,
) -> Result<HistoryList, AppError> {
    let mut scopes = HashMap::new();
    let mut owners: HashMap<(String, String), Option<String>> = HashMap::new();
    let mut hidden: BTreeSet<String> = BTreeSet::new();
    let mut kept = Vec::with_capacity(items.len());
    for e in items {
        let table = tracked(&e.table)?;
        if !scopes.contains_key(table) {
            let s = share_scope::load(pool, session, ShareArea::History, table, None).await?;
            scopes.insert(table, s);
        }
        let scope = &scopes[table];
        let key = (e.table.clone(), e.entity_id.clone());
        if !owners.contains_key(&key) {
            owners.insert(key.clone(), owner_of(pool, &e.table, &e.entity_id).await);
        }
        let owner = owners[&key].as_deref();
        if scope.keeps(None, &e.entity_id, owner) {
            kept.push(e);
        } else if let Some(o) = owner {
            hidden.insert(o.to_string());
        }
    }
    Ok(HistoryList {
        items: kept,
        hidden_doctors: hidden.into_iter().collect(),
    })
}

/// History of one record (a task, an order, a payment, an appointment, a clinical entry…).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn history_for_record(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    table: String,
    entity_id: String,
) -> Result<HistoryList, AppError> {
    let session = require_authenticated(&session_state)?;
    let table = tracked(&table)?;
    if !may_read(&session, table) {
        return Err(AppError::Forbidden);
    }
    if let Some(owner) = owner_of(&pool, table, &entity_id).await {
        let scope = share_scope::load(&pool, &session, ShareArea::History, table, None).await?;
        if !scope.keeps(None, &entity_id, Some(&owner)) {
            return Err(AppError::validation_code(
                "error.access.not_allowed_by_owner",
            ));
        }
    }
    let items = history::for_record(&pool, table, &entity_id).await?;
    Ok(HistoryList {
        items,
        hidden_doctors: Vec::new(),
    })
}

/// Everything changed in one patient's records that this person may read.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn history_for_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<HistoryList, AppError> {
    let session = require(&session_state, "patient.read")?;
    let tables: Vec<&str> = TRACKED
        .iter()
        .copied()
        .filter(|t| may_read(&session, t))
        .collect();
    let items = history::for_patient(&pool, &patient_id, &tables).await?;
    apply_sharing(&pool, &session, items).await
}
