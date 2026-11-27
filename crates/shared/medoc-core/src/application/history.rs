//! History of a record or a patient (T5.8 phase 2): who changed what, on which device, when,
//! field by field (old → new). Built from `change_record`; each record is compared with the
//! previous record of the same row. Permissions and sharing are checked by the caller.

use std::collections::HashMap;

use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;

/// Keys that change with every write or are not row content.
fn is_hidden_field(table: &str, key: &str) -> bool {
    key.starts_with("sync")
        || matches!(
            key,
            "id" | "updated_at" | "updated_by" | "device_id" | "password_hash"
        )
        || crate::infrastructure::database::sync_registry::deny_column(table, key)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldChange {
    pub field: String,
    pub old: serde_json::Value,
    pub new: serde_json::Value,
    /// Staff name for fields that hold a staff id (doctor, assignee, collector…).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub old_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub new_label: Option<String>,
}

/// Fields whose value is a staff id.
fn is_staff_field(key: &str) -> bool {
    key.ends_with("staff_id")
        || matches!(
            key,
            "physician_id"
                | "assignee_user_id"
                | "doctor_id"
                | "collected_by"
                | "approved_by"
                | "created_by"
                | "released_by_physician_id"
        )
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub table: String,
    pub entity_id: String,
    pub op: String,
    pub actor_staff_id: Option<String>,
    pub actor_name: Option<String>,
    pub device_id: String,
    pub device_label: Option<String>,
    pub at: String,
    /// Fields that changed; for the first record of a row, every field with a value.
    pub changes: Vec<FieldChange>,
}

type Row = (
    String,
    String,
    String,
    String,
    Option<String>,
    String,
    String,
    String,
);

/// History of one row, newest first.
pub async fn for_record(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
) -> Result<Vec<HistoryEntry>, AppError> {
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT id, entity_table, entity_id, op, actor_staff_id, device_id, payload_json, created_at
           FROM change_record WHERE entity_table = ?1 AND entity_id = ?2
          ORDER BY created_at, rowid",
    )
    .bind(table)
    .bind(entity_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    build(pool, rows).await
}

/// History of everything filed under a patient, limited to `tables`, newest first.
pub async fn for_patient(
    pool: &SqlitePool,
    patient_id: &str,
    tables: &[&str],
) -> Result<Vec<HistoryEntry>, AppError> {
    if tables.is_empty() {
        return Ok(Vec::new());
    }
    let marks: Vec<String> = (0..tables.len()).map(|i| format!("?{}", i + 2)).collect();
    let sql = format!(
        "SELECT id, entity_table, entity_id, op, actor_staff_id, device_id, payload_json, created_at
           FROM change_record WHERE patient_id = ?1 AND entity_table IN ({})
          ORDER BY created_at, rowid",
        marks.join(", ")
    );
    let mut q = sqlx::query_as::<_, Row>(&sql).bind(patient_id);
    for t in tables {
        q = q.bind(*t);
    }
    let rows = q.fetch_all(pool).await.map_err(AppError::Database)?;
    build(pool, rows).await
}

/// Old → new for each field that differs. `prev = None`: every field with a value.
pub fn diff(
    table: &str,
    prev: Option<&serde_json::Value>,
    next: &serde_json::Value,
) -> Vec<FieldChange> {
    let empty = serde_json::Map::new();
    let before = prev.and_then(|v| v.as_object()).unwrap_or(&empty);
    let after = next.as_object().unwrap_or(&empty);
    let mut keys: Vec<&String> = before.keys().chain(after.keys()).collect();
    keys.sort();
    keys.dedup();
    keys.into_iter()
        .filter(|k| !is_hidden_field(table, k))
        .filter_map(|k| {
            let old = before.get(k).cloned().unwrap_or(serde_json::Value::Null);
            let new = after.get(k).cloned().unwrap_or(serde_json::Value::Null);
            (old != new).then(|| FieldChange {
                field: k.clone(),
                old,
                new,
                old_label: None,
                new_label: None,
            })
        })
        .collect()
}

async fn build(pool: &SqlitePool, rows: Vec<Row>) -> Result<Vec<HistoryEntry>, AppError> {
    let names = lookup(pool, "SELECT id, name FROM staff").await;
    let devices = lookup(pool, "SELECT device_id, display_name FROM sync_device").await;
    let mut last: HashMap<(String, String), serde_json::Value> = HashMap::new();
    let mut out = Vec::with_capacity(rows.len());
    for (id, table, entity_id, op, actor, device_id, payload, at) in rows {
        let next: serde_json::Value =
            serde_json::from_str(&payload).unwrap_or(serde_json::Value::Null);
        let key = (table.clone(), entity_id.clone());
        let mut changes = if op == "DELETE" {
            Vec::new()
        } else {
            diff(&table, last.get(&key), &next)
        };
        for c in changes.iter_mut().filter(|c| is_staff_field(&c.field)) {
            let name = |v: &serde_json::Value| v.as_str().and_then(|id| names.get(id).cloned());
            c.old_label = name(&c.old);
            c.new_label = name(&c.new);
        }
        last.insert(key, next);
        out.push(HistoryEntry {
            id,
            actor_name: actor.as_ref().and_then(|a| names.get(a).cloned()),
            actor_staff_id: actor,
            device_label: devices.get(&device_id).cloned(),
            device_id,
            table,
            entity_id,
            op,
            at,
            changes,
        });
    }
    out.reverse();
    Ok(out)
}

/// Id → name; empty when the table is missing (sync tables in a fresh database).
async fn lookup(pool: &SqlitePool, sql: &str) -> HashMap<String, String> {
    sqlx::query_as::<_, (String, Option<String>)>(sql)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
        .into_iter()
        .filter_map(|(id, name)| name.map(|n| (id, n)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diff_shows_only_changed_visible_fields() {
        let a = serde_json::json!({"id":"x","name":"A","phone":"1","updated_at":"t1","syncHlc":"1:0"});
        let b = serde_json::json!({"id":"x","name":"B","phone":"1","updated_at":"t2","syncHlc":"2:0"});
        let d = diff("patient", Some(&a), &b);
        assert_eq!(d.len(), 1);
        assert_eq!(d[0].field, "name");
        let first = diff("patient", None, &a);
        assert_eq!(
            first.iter().map(|c| c.field.as_str()).collect::<Vec<_>>(),
            ["name", "phone"]
        );
    }
}
