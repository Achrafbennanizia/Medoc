//! Field-by-field merge (T3.2, docs/architecture/editions-plan.md).

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::field_hlc;
use sqlx::SqlitePool;

use super::{bounded_hlc, hlc_order, table_column_names, update_from_json};
use crate::repo::OutboxEntry;

/// Field-merge tables with a stamp on both sides are decided here (`Some`); others go on with
/// row-level LWW. `ctx` = (admin pull, this device is the main device, now in ms).
pub(super) async fn try_merge(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    obj: &serde_json::Map<String, serde_json::Value>,
    remote: Option<crate::hlc::Hlc>,
    ctx: (bool, bool, i64),
) -> Result<Option<bool>, AppError> {
    let Some(remote) = remote.filter(|_| field_hlc::is_field_lww(&entry.entity_table)) else {
        return Ok(None);
    };
    let Some(local) = crate::hlc::load_row(pool, &entry.entity_table, &entry.entity_id).await?
    else {
        return Ok(None);
    };
    let (admin_pull, local_is_master, now_ms) = ctx;
    merge_fields(
        pool,
        entry,
        obj,
        remote,
        local,
        admin_pull,
        local_is_master,
        now_ms,
    )
    .await
    .map(Some)
}

/// The whole row was taken: remember each field's stamp and value, so the next local write
/// bumps only what it really changes.
pub(super) async fn save_row_fields(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    obj: &serde_json::Map<String, serde_json::Value>,
    row: crate::hlc::Hlc,
) -> Result<(), AppError> {
    if !field_hlc::is_field_lww(&entry.entity_table) {
        return Ok(());
    }
    let fields = field_hlc::payload_fields(obj);
    for (k, v) in obj {
        if !field_hlc::is_merged_field(k) {
            continue;
        }
        let stamp = fields.get(k).copied().unwrap_or(row).min_hlc(row);
        let hash = field_hlc::value_hash(v);
        field_hlc::save(pool, &entry.entity_table, &entry.entity_id, k, stamp, &hash).await?;
    }
    Ok(())
}

/// T3.2: patient, appointment and task rows are decided field by field. A field is taken
/// when its incoming stamp (the row stamp for a peer that sends none) is newer than the
/// local field's stamp. Two devices that edit different fields offline both keep their edit.
#[allow(clippy::too_many_arguments)]
async fn merge_fields(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    obj: &serde_json::Map<String, serde_json::Value>,
    remote_row: crate::hlc::Hlc,
    local_row: crate::hlc::Hlc,
    admin_pull: bool,
    local_is_master: bool,
    now_ms: i64,
) -> Result<bool, AppError> {
    let (table, id) = (entry.entity_table.as_str(), entry.entity_id.as_str());
    let cap = |h: crate::hlc::Hlc| {
        if admin_pull {
            h
        } else {
            bounded_hlc(h, local_row, now_ms)
        }
    };
    let remote_row = cap(remote_row);
    let remote_fields = field_hlc::payload_fields(obj);
    let local_fields = { field_hlc::load(pool, table, id).await? };
    let bases = field_hlc::payload_bases(obj);
    let mut won = serde_json::Map::new();
    let mut stamps = Vec::new();
    // (field, remote value, remote won)
    let mut conflicts: Vec<(String, serde_json::Value, bool)> = Vec::new();
    for (k, v) in obj {
        if !field_hlc::is_merged_field(k) {
            continue;
        }
        let remote = cap(remote_fields.get(k).copied().unwrap_or(remote_row)).min_hlc(remote_row);
        let local = local_fields.get(k).map(|(h, _)| *h).unwrap_or(local_row);
        let takes = match hlc_order(remote, local) {
            std::cmp::Ordering::Greater => true,
            std::cmp::Ordering::Equal => admin_pull,
            std::cmp::Ordering::Less => false,
        };
        if local_is_master && !field_hlc::is_bookkeeping_field(k) {
            // The writer changed this field without having seen this device's current value.
            if let (Some(base), Some((local_stamp, local_hash))) =
                (bases.get(k), local_fields.get(k))
            {
                if base != local_stamp && *local_hash != field_hlc::value_hash(v) {
                    conflicts.push((k.clone(), v.clone(), takes));
                }
            }
        }
        if takes {
            won.insert(k.clone(), v.clone());
            stamps.push((k.clone(), remote, field_hlc::value_hash(v)));
        }
    }
    if !conflicts.is_empty() {
        record_conflicts(pool, entry, &conflicts).await?;
    }
    if won.is_empty() {
        tracing::debug!(
            target: "medoc::sync",
            event = "SKIP_STALE_REMOTE_FIELDS",
            table = %table,
            id = %id,
        );
        return Ok(true);
    }
    update_from_json(pool, table, id, &won).await?;
    for (field, stamp, hash) in &stamps {
        field_hlc::save(pool, table, id, field, *stamp, hash).await?;
    }
    if hlc_order(remote_row, local_row) == std::cmp::Ordering::Greater {
        crate::hlc::save_row(pool, table, id, remote_row).await?;
    }
    tracing::debug!(
        target: "medoc::sync",
        event = "MERGE_FIELDS",
        table = %table,
        id = %id,
        taken = stamps.len(),
    );
    Ok(true)
}

pub(super) trait MinHlc {
    fn min_hlc(self, other: Self) -> Self;
}

impl MinHlc for crate::hlc::Hlc {
    /// A field is never stamped after its row.
    fn min_hlc(self, other: Self) -> Self {
        if hlc_order(self, other) == std::cmp::Ordering::Greater {
            other
        } else {
            self
        }
    }
}

/// T3.3: two devices changed the same field without seeing each other's edit. The newer one
/// is kept; the other value goes to the main device's conflict inbox, where the admin keeps
/// the result or takes the other value (`problems::retry`).
async fn record_conflicts(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    conflicts: &[(String, serde_json::Value, bool)],
) -> Result<(), AppError> {
    let (table, id) = (entry.entity_table.as_str(), entry.entity_id.as_str());
    let known = table_column_names(pool, table).await?;
    let cols: Vec<&str> = conflicts
        .iter()
        .map(|(k, _, _)| k.as_str())
        .filter(|k| known.iter().any(|c| c == k))
        .collect();
    if cols.is_empty() {
        return Ok(());
    }
    let expr = cols
        .iter()
        .map(|c| format!("'{c}', \"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    let local_json: Option<String> = sqlx::query_scalar(&format!(
        "SELECT json_object({expr}) FROM {table} WHERE {key} = ?1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    let local: serde_json::Map<String, serde_json::Value> = local_json
        .and_then(|j| serde_json::from_str(&j).ok())
        .unwrap_or_default();
    let mut kept = serde_json::Map::new();
    let mut other = serde_json::Map::new();
    let mut other_from_this_device = false;
    for (k, remote, remote_won) in conflicts {
        let Some(local_value) = local.get(k) else {
            continue;
        };
        let (k_val, o_val) = if *remote_won {
            other_from_this_device = true;
            (remote.clone(), local_value.clone())
        } else {
            (local_value.clone(), remote.clone())
        };
        kept.insert(k.clone(), k_val);
        other.insert(k.clone(), o_val);
    }
    let mut payload = other.clone();
    payload.insert("id".into(), serde_json::Value::String(id.to_string()));
    let detail = serde_json::json!({
        "kept": kept,
        "other": other,
        "otherFromThisDevice": other_from_this_device,
    });
    let problem = OutboxEntry {
        payload_json: serde_json::Value::Object(payload).to_string(),
        ..entry.clone()
    };
    crate::problems::record_incoming(
        pool,
        &problem,
        crate::problems::kind::FIELD_CONFLICT,
        false,
        &detail.to_string(),
    )
    .await;
    Ok(())
}

/// Main device only: an incoming stamp ahead of this clock is rewritten to
/// now, once, before the row is applied and relayed. Every device then holds
/// the same stamp for the same version.
pub(crate) fn clamp_future_hlc(payload_json: &str, now_ms: i64) -> String {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return payload_json.to_string();
    };
    let Some(obj) = value.as_object_mut() else {
        return payload_json.to_string();
    };
    let Some(hlc) = crate::hlc::payload_hlc(obj) else {
        return payload_json.to_string();
    };
    if hlc.wall_ms <= now_ms {
        return payload_json.to_string();
    }
    let capped = crate::hlc::Hlc {
        wall_ms: now_ms,
        counter: hlc.counter,
    };
    obj.insert(
        "syncHlc".to_string(),
        serde_json::Value::String(crate::hlc::format_hlc(capped)),
    );
    field_hlc::clamp(obj, capped);
    serde_json::to_string(&value).unwrap_or_else(|_| payload_json.to_string())
}
