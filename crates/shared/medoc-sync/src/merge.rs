#[path = "merge_fields.rs"]
mod merge_fields;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;
use sqlx::{Connection, SqlitePool};

use crate::repo::{mark_applied, was_applied, OutboxEntry};
use medoc_core::infrastructure::database::sqlite_error::is_foreign_key_error;
pub(crate) use merge_fields::clamp_future_hlc;

/// Conflict resolution when two devices edited the same row offline.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictPolicy {
    /// Newer `updated_at` wins. Equal timestamps: the main device wins.
    /// Between two replicas (mesh) an equal timestamp keeps the local row.
    ///
    /// Missing remote `updated_at`: accept only on admin pull (sender is main).
    /// Missing local `updated_at` with a remote timestamp: apply remote.
    LastWriteWins,
}

pub async fn apply_remote_entry(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_phased(pool, local_device_id, local_is_master, false, policy, entry).await
}

/// Same as [`apply_remote_entry_phased`], but does not write `sync_applied`.
/// The caller marks the row in the same transaction as the master relay.
pub async fn apply_remote_entry_defer_mark(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_inner(
        pool,
        local_device_id,
        local_is_master,
        admin_pull,
        policy,
        entry,
        false,
    )
    .await
}

/// `admin_pull`: replica applying master rows after push-then-pull — admin
/// authoritative when timestamps are missing (product: merge member, then admin).
pub async fn apply_remote_entry_phased(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_inner(
        pool,
        local_device_id,
        local_is_master,
        admin_pull,
        policy,
        entry,
        true,
    )
    .await
}

async fn apply_remote_entry_inner(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
    mark: bool,
) -> Result<bool, AppError> {
    if was_applied(pool, &entry.device_id, entry.seq).await? {
        return Ok(false);
    }

    let applied = match entry.op.as_str() {
        "INSERT" | "UPDATE" => {
            apply_upsert(
                pool,
                local_device_id,
                local_is_master,
                admin_pull,
                policy,
                entry,
                false,
            )
            .await?
        }
        "DELETE" => apply_delete(pool, entry, admin_pull).await?,
        _ => {
            return Err(AppError::Validation(format!(
                "unknown sync op: {}",
                entry.op
            )))
        }
    };

    if applied && mark {
        mark_applied(pool, &entry.device_id, entry.seq).await?;
        if let Err(e) =
            crate::watch::note_remote_applied(pool, &entry.entity_table, &entry.entity_id).await
        {
            tracing::warn!(
                target: "medoc::sync",
                event = "SHARED_SYNC_SEEN_FAILED",
                table = %entry.entity_table,
                id = %entry.entity_id,
                error = %e
            );
        }
    }
    // Remote practice_task INSERT: ensure assignee notifications exist locally
    // when the origin did not sync a PRACTICE_TASK_ASSIGNED row (or it lagged).
    if applied && entry.entity_table == "practice_task" && entry.op.eq_ignore_ascii_case("INSERT") {
        medoc_core::application::practice_task_sync_notify::ensure_assignee_notifications_after_remote_insert(
            pool,
            &entry.entity_id,
        )
        .await;
    }
    Ok(applied)
}

/// Apply a reconcile row from the main device, ignoring last-write-wins.
pub async fn force_apply_payload(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<(), AppError> {
    let entry = OutboxEntry {
        id: format!("reconcile-{entity_id}"),
        device_id: "reconcile".into(),
        seq: 0,
        entity_table: table.to_string(),
        entity_id: entity_id.to_string(),
        op: op.to_string(),
        payload_json: payload_json.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    match op {
        "DELETE" => {
            apply_delete_checked(pool, &entry, true, false).await?;
        }
        _ => {
            apply_upsert(
                pool,
                "reconcile",
                false,
                true,
                ConflictPolicy::LastWriteWins,
                &entry,
                true,
            )
            .await?;
        }
    }
    Ok(())
}

/// Calendar rows and the practice profile follow the main device on a pull.
fn replica_takes_main_row(table: &str, entity_id: &str) -> bool {
    table == "appointment"
        || (table == "app_kv"
            && matches!(
                entity_id,
                "invoice.practice.v1"
                    | "practice.work_hours.v1"
                    | "practice.blockedTimes.v1"
                    | "practice.calendar-workflows.v1"
                    | "practice.preferences.v1"
                    | "practice.preferences-appointment.v1"
            ))
}

async fn apply_upsert(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
    force: bool,
) -> Result<bool, AppError> {
    let payload: serde_json::Value = serde_json::from_str(&entry.payload_json)
        .map_err(|e| AppError::Validation(format!("sync payload json: {e}")))?;
    let Some(obj) = payload.as_object() else {
        return Err(AppError::Validation(
            "sync payload must be a JSON object".into(),
        ));
    };

    if !admin_pull && !force && is_master_only_table(&entry.entity_table) {
        // Access rights are decided on the main device. A replica (or a mesh
        // peer) must not be able to grant a login more rights by pushing a row.
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_MASTER_ONLY_ROW_REJECTED",
            table = %entry.entity_table,
            id = %entry.entity_id,
            from_device = %entry.device_id,
        );
        return Ok(true);
    }

    if !medoc_core::application::allowances::is_owner_signed(
        &entry.entity_table,
        &entry.entity_id,
        obj,
    ) {
        // T4.2: sharing rules are written by the dentist they belong to, on any device.
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_OWNER_ONLY_ROW_REJECTED",
            table = %entry.entity_table,
            id = %entry.entity_id,
            from_device = %entry.device_id,
        );
        return Ok(true);
    }

    let exists: i64 = if entry.entity_table == "app_kv" {
        sqlx::query_scalar("SELECT COUNT(*) FROM app_kv WHERE key = ?1")
            .bind(&entry.entity_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?
    } else {
        let table = sanitize_table(&entry.entity_table)?;
        // F146: tables keyed by something other than `id` (hint, preference).
        let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE {key} = ?1"))
            .bind(&entry.entity_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?
    };

    if exists == 0 && !force {
        if let Some(reason) =
            older_than_tombstone(pool, &entry.entity_table, &entry.entity_id, obj).await?
        {
            // The row was deleted after this edit was made (offline edit of a
            // row another device removed). Applying it would bring it back on
            // this device only, so devices would disagree.
            tracing::debug!(
                target: "medoc::sync",
                event = "SKIP_EDIT_OF_DELETED_ROW",
                table = %entry.entity_table,
                id = %entry.entity_id,
                reason,
            );
            return Ok(true);
        }
    }

    let mut logical_wins = false;
    let now_ms = chrono::Utc::now().timestamp_millis();
    let mut hlc_to_save = crate::hlc::payload_hlc(obj);
    // Every incoming stamp advances this device's clock — new rows, rows taken
    // from the main device and forced rows included. Otherwise a replica whose
    // wall clock runs behind stamps its next edit of a freshly copied row
    // *older* than the copy, and the main device drops that edit. The observed
    // value is capped at real time so a fast peer clock cannot drag this
    // device's clock into the future.
    if let Some(remote_hlc) = hlc_to_save {
        // Only the main device caps stamps (it is the reference clock and
        // rewrites incoming replica stamps once, in `ingest_push`). A replica
        // takes the main device's stamps as they are: capping them at its own
        // — possibly slow — clock made its next edit look older than the copy.
        let observed = if !admin_pull && remote_hlc.wall_ms > now_ms {
            crate::hlc::Hlc {
                wall_ms: now_ms,
                counter: remote_hlc.counter,
            }
        } else {
            remote_hlc
        };
        crate::hlc::observe_clock(pool, observed).await?;
    }
    // The main device owns the shared calendar and the practice profile.
    // A replica demo seed stamps a newer `updated_at`, which used to hide
    // the main device's appointments and currency.
    // A calendar edit on this device that has not reached the main device yet
    // is not overwritten by the main device's copy (the push may have failed
    // while the pull went through); normal conflict rules decide instead.
    let take_main = admin_pull
        && replica_takes_main_row(&entry.entity_table, &entry.entity_id)
        && !has_pending_local_edit(pool, local_device_id, &entry.entity_table, &entry.entity_id)
            .await?;
    let lww = !take_main && !force && exists > 0 && policy == ConflictPolicy::LastWriteWins;
    let field_ctx = (admin_pull, local_is_master, now_ms);
    if let Some(done) =
        merge_fields::try_merge(pool, entry, obj, hlc_to_save.filter(|_| lww), field_ctx).await?
    {
        return Ok(done);
    }
    if !take_main && !force && exists > 0 && policy == ConflictPolicy::LastWriteWins {
        if let Some(remote_hlc) = hlc_to_save {
            if let Some(local_hlc) =
                crate::hlc::load_row(pool, &entry.entity_table, &entry.entity_id).await?
            {
                let remote_cmp = if admin_pull {
                    remote_hlc
                } else {
                    bounded_hlc(remote_hlc, local_hlc, now_ms)
                };
                hlc_to_save = Some(remote_cmp);
                match remote_cmp
                    .wall_ms
                    .cmp(&local_hlc.wall_ms)
                    .then(remote_cmp.counter.cmp(&local_hlc.counter))
                {
                    std::cmp::Ordering::Greater => logical_wins = true,
                    std::cmp::Ordering::Less => return Ok(true),
                    std::cmp::Ordering::Equal if !admin_pull => return Ok(true),
                    std::cmp::Ordering::Equal => logical_wins = true,
                }
            } else if !admin_pull && remote_hlc.wall_ms > now_ms {
                hlc_to_save = Some(crate::hlc::Hlc {
                    wall_ms: now_ms,
                    counter: remote_hlc.counter,
                });
            }
        }
    }
    if !take_main
        && !force
        && exists > 0
        && policy == ConflictPolicy::LastWriteWins
        && !logical_wins
    {
        let remote_ts = obj.get("updated_at").and_then(parse_ts);
        let local_ts = load_local_updated_at(pool, &entry.entity_table, &entry.entity_id).await?;
        match (local_ts, remote_ts) {
            (Some(local), Some(remote)) => {
                if remote > local {
                    // Remote is fresher → apply.
                } else if remote < local {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_STALE_REMOTE",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        local = %local,
                        remote = %remote,
                    );
                    return Ok(true);
                } else if !admin_pull {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_TIE_MAIN_OR_LOCAL",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        remote_device = %entry.device_id,
                        local_device = %local_device_id,
                        local_is_master,
                    );
                    return Ok(true);
                }
            }
            (None, Some(_)) => {}
            (_, None) => {
                // A stamped change is decided by its stamp; only an unstamped
                // change without `updated_at` from a replica stays unprovable.
                // Before, a stamped row of a table without `updated_at` (and
                // no local stamp yet) was skipped forever.
                if !admin_pull && crate::hlc::payload_hlc(obj).is_none() {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_MISSING_REMOTE_UPDATED_AT",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                    );
                    return Ok(true);
                }
            }
        }
    }

    if entry.entity_table == "app_kv" {
        if !apply_app_kv(pool, &entry.entity_id, obj).await? {
            // Device-local key: skipped on purpose; report as handled so the
            // entry is not retried forever.
            return Ok(true);
        }
    } else if exists == 0 {
        match insert_from_json(pool, &entry.entity_table, &entry.entity_id, obj).await {
            Ok(()) => {}
            Err(err) if is_unique_error(&err) => {
                // A different local row holds the same unique value. Nothing is
                // overwritten; the admin resolves it from the problems list.
                crate::problems::record_incoming(
                    pool,
                    entry,
                    crate::problems::kind::UNIQUE_CONFLICT,
                    admin_pull,
                    &err.to_string(),
                )
                .await;
                return Ok(true);
            }
            Err(err) => return Err(err),
        }
        // A newer re-creation: the old delete no longer applies to this row.
        clear_tombstone(pool, &entry.entity_table, &entry.entity_id).await?;
    } else {
        update_from_json(pool, &entry.entity_table, &entry.entity_id, obj).await?;
    }
    // Saved only after the row is written. Saving it first meant a failed
    // write left the remote stamp behind; the retry then compared equal to
    // itself and was dropped as "already seen".
    if let Some(mut remote_hlc) = hlc_to_save {
        if !admin_pull && remote_hlc.wall_ms > now_ms && (exists == 0 || take_main || force) {
            // No local stamp was compared: do not store a future one either.
            remote_hlc.wall_ms = now_ms;
        }
        crate::hlc::save_row(pool, &entry.entity_table, &entry.entity_id, remote_hlc).await?;
        merge_fields::save_row_fields(pool, entry, obj, remote_hlc).await?;
    }
    Ok(true)
}

fn hlc_order(a: crate::hlc::Hlc, b: crate::hlc::Hlc) -> std::cmp::Ordering {
    a.wall_ms.cmp(&b.wall_ms).then(a.counter.cmp(&b.counter))
}

/// `Some(reason)` when a tombstone proves this edit is older than the delete.
/// Without a usable stamp on either side the edit is applied, as before.
async fn older_than_tombstone(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<Option<&'static str>, AppError> {
    let deleted_at: Option<String> = sqlx::query_scalar(
        "SELECT deleted_at FROM sync_tombstone WHERE entity_table = ?1 AND entity_id = ?2",
    )
    .bind(table)
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    let Some(deleted_at) = deleted_at else {
        return Ok(None);
    };
    // The delete's clock stamp is kept on the row's HLC slot.
    if let (Some(remote), Some(delete)) = (
        crate::hlc::payload_hlc(obj),
        crate::hlc::load_row(pool, table, id).await?,
    ) {
        return Ok((hlc_order(remote, delete) != std::cmp::Ordering::Greater)
            .then_some("hlc_not_after_delete"));
    }
    if let (Some(edited), Some(deleted)) = (
        obj.get("updated_at").and_then(parse_ts),
        parse_ts_str(&deleted_at),
    ) {
        return Ok((edited <= deleted).then_some("edited_before_delete"));
    }
    Ok(None)
}

async fn clear_tombstone(pool: &SqlitePool, table: &str, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM sync_tombstone WHERE entity_table = ?1 AND entity_id = ?2")
        .bind(table)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn has_pending_local_edit(
    pool: &SqlitePool,
    local_device_id: &str,
    table: &str,
    id: &str,
) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox
         WHERE device_id = ?1 AND entity_table = ?2 AND entity_id = ?3
           AND delivered_at IS NULL AND (fail_reason IS NULL OR fail_reason = '')",
    )
    .bind(local_device_id)
    .bind(table)
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n > 0)
}

/// Tables only the main device may write through sync (access control).
fn is_master_only_table(table: &str) -> bool {
    medoc_core::infrastructure::database::sync_registry::is_master_only_table(table)
}

/// `updated_at` of the local row, when the column exists and parses.
pub(crate) async fn local_row_updated_at(
    pool: &SqlitePool,
    table: &str,
    id: &str,
) -> Result<Option<chrono::DateTime<chrono::FixedOffset>>, AppError> {
    load_local_updated_at(pool, table, id).await
}

/// Reads `updated_at` from the existing local row, if any. Returns `None`
/// for a missing row or any parse error: the caller falls back to master-wins.
async fn load_local_updated_at(
    pool: &SqlitePool,
    table: &str,
    id: &str,
) -> Result<Option<chrono::DateTime<chrono::FixedOffset>>, AppError> {
    if table == "app_kv" {
        let raw: Option<String> =
            sqlx::query_scalar("SELECT updated_at FROM app_kv WHERE key = ?1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        return Ok(raw.and_then(|s| parse_ts_str(&s)));
    }
    let safe = sanitize_table(table)?;
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(safe);
    let raw: Option<String> = sqlx::query_scalar(&format!(
        "SELECT CAST(updated_at AS TEXT) FROM {safe} WHERE {key} = ?1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(raw.and_then(|s| parse_ts_str(&s)))
}

fn parse_ts(version: &serde_json::Value) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    version.as_str().and_then(parse_ts_str)
}

/// Accepts RFC 3339 (preferred) and SQLite's `YYYY-MM-DD HH:MM:SS[.fff]`
/// default form, treating naive timestamps as UTC.
fn parse_ts_str(s: &str) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(trimmed) {
        return Some(ts);
    }
    let normalised = trimmed.replacen(' ', "T", 1);
    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&format!("{normalised}Z")) {
        return Some(ts);
    }
    // chrono's `NaiveDateTime` JSON is `YYYY-MM-DDTHH:MM:SS[.fff]` with no offset.
    let with_space = trimmed.replacen('T', " ", 1);
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S") {
        let utc: chrono::DateTime<chrono::Utc> =
            chrono::TimeZone::from_utc_datetime(&chrono::Utc, &naive);
        return Some(utc.fixed_offset());
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&with_space, "%Y-%m-%d %H:%M:%S%.f") {
        let utc: chrono::DateTime<chrono::Utc> =
            chrono::TimeZone::from_utc_datetime(&chrono::Utc, &naive);
        return Some(utc.fixed_offset());
    }
    None
}

/// A fast peer clock is compared as `now` when this device's stamp is not
/// itself ahead of `now`. Two stamps that are both ahead keep their order.
fn bounded_hlc(remote: crate::hlc::Hlc, local: crate::hlc::Hlc, now_ms: i64) -> crate::hlc::Hlc {
    if remote.wall_ms > now_ms && local.wall_ms <= now_ms {
        crate::hlc::Hlc {
            wall_ms: now_ms,
            counter: remote.counter,
        }
    } else {
        remote
    }
}

/// A peer clock ahead of this device must not outrank a row written at the
/// real current time. A stamp behind `now` stays as written, so an older
/// edit cannot be promoted over a newer local row. When the local row is
/// itself ahead of `now`, both stamps keep their order.
pub(crate) fn clamp_future_updated_at(
    payload_json: &str,
    now: chrono::DateTime<chrono::Utc>,
    local_updated_at: Option<chrono::DateTime<chrono::FixedOffset>>,
) -> String {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return payload_json.to_string();
    };
    let Some(obj) = value.as_object_mut() else {
        return payload_json.to_string();
    };
    let Some(remote) = obj
        .get("updated_at")
        .and_then(|v| v.as_str())
        .and_then(parse_ts_str)
    else {
        return payload_json.to_string();
    };
    let now_fixed = now.fixed_offset();
    if local_updated_at.is_some_and(|local| local > now_fixed) {
        return payload_json.to_string();
    }
    if remote <= now_fixed {
        return payload_json.to_string();
    }
    obj.insert(
        "updated_at".to_string(),
        serde_json::Value::String(now.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)),
    );
    serde_json::to_string(&value).unwrap_or_else(|_| payload_json.to_string())
}

/// Returns `false` when the key is device-local and was not written.
async fn apply_app_kv(
    pool: &SqlitePool,
    key: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<bool, AppError> {
    // The row key is the entry's entity id. The payload's own `key` field
    // used to win, so a pushed entry could name one key (passing the LWW
    // check) and write another. It must agree with the entity id.
    if let Some(payload_key) = obj.get("key").and_then(|v| v.as_str()) {
        if payload_key != key {
            return Err(AppError::Validation(
                "sync app_kv: payload key does not match entity id".into(),
            ));
        }
    }
    // Device-local settings (sync deployment, device id, TLS pin, license,
    // pairing, cluster, LAN server …) must never be overwritten by a peer.
    // The snapshot side already skips them; the apply side did not, so a
    // paired device could rewrite the master's sync config and TLS pin.
    if medoc_core::infrastructure::database::sync_registry::deny_app_kv_key(key) {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_APP_KV_DENIED",
            key = %key
        );
        return Ok(false);
    }
    let value = obj
        .get("value")
        .and_then(json_to_sql_value)
        .unwrap_or_default();
    let row_key = key;
    let updated_at = obj
        .get("updated_at")
        .and_then(|version| version.as_str())
        .filter(|s| !s.trim().is_empty());
    if let Some(ts) = updated_at {
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(row_key)
        .bind(value)
        .bind(ts)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    } else {
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(row_key)
        .bind(value)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(true)
}

async fn apply_delete(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    from_main: bool,
) -> Result<bool, AppError> {
    apply_delete_checked(pool, entry, from_main, true).await
}

/// `check_order`: skip a delete that is older than the local row's last edit.
/// Reconcile (`force_apply_payload`) passes `false`: the main device's table
/// state is authoritative there.
async fn apply_delete_checked(
    pool: &SqlitePool,
    entry: &OutboxEntry,
    from_main: bool,
    check_order: bool,
) -> Result<bool, AppError> {
    let table = sanitize_table(&entry.entity_table)?;
    if !from_main && is_master_only_table(table) {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_MASTER_ONLY_DELETE_REJECTED",
            table = %table,
            id = %entry.entity_id,
            from_device = %entry.device_id,
        );
        return Ok(true);
    }
    // Device-local settings are never deleted (or tombstoned) by a peer.
    if table == "app_kv"
        && medoc_core::infrastructure::database::sync_registry::deny_app_kv_key(&entry.entity_id)
    {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_APP_KV_DELETE_DENIED",
            key = %entry.entity_id
        );
        return Ok(true);
    }
    let delete_hlc = serde_json::from_str::<serde_json::Value>(&entry.payload_json)
        .ok()
        .and_then(|v| v.as_object().and_then(crate::hlc::payload_hlc));
    if check_order {
        if let (Some(remote), Some(local)) = (
            delete_hlc,
            crate::hlc::load_row(pool, table, &entry.entity_id).await?,
        ) {
            if hlc_order(local, remote) == std::cmp::Ordering::Greater {
                // The row was edited after the delete was issued: the edit
                // wins, and it reaches the deleting device the normal way.
                tracing::info!(
                    target: "medoc::sync",
                    event = "SKIP_STALE_DELETE",
                    table = %table,
                    id = %entry.entity_id,
                    from_device = %entry.device_id,
                );
                return Ok(true);
            }
        }
    }
    let applied = apply_delete_rows(pool, table, entry).await?;
    // Remember the delete's stamp: a later, older edit of the same row is
    // then recognised and not re-inserted.
    if let Some(remote) = delete_hlc {
        crate::hlc::save_row(pool, table, &entry.entity_id, remote).await?;
    }
    Ok(applied)
}

async fn apply_delete_rows(
    pool: &SqlitePool,
    table: &str,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    // Patient erasure already runs its own transaction (children, then the row).
    // The tombstone is written only after that commits, so a failed delete does
    // not leave a tombstone for a row that is still there. A retry is safe:
    // `delete_row` succeeds when the patient is already gone.
    if table == "patient" {
        patient_repo::delete_row(pool, &entry.entity_id).await?;
        insert_tombstone(pool, table, &entry.entity_id, &entry.device_id).await?;
        // Erasing a patient record is audited on every device it reaches,
        // not only where it was started.
        if let Err(e) = medoc_core::infrastructure::database::repos::admin::audit::create(
            pool,
            "sync",
            "DELETE",
            "patient",
            Some(&entry.entity_id),
            Some(&format!("erased by sync from device {}", entry.device_id)),
        )
        .await
        {
            tracing::warn!(target: "medoc::sync", event = "SYNC_ERASE_AUDIT_FAILED", error = %e);
        }
        return Ok(true);
    }
    match delete_entry_deferred(pool, table, entry).await {
        Ok(()) => Ok(true),
        Err(err) if is_foreign_key_error(&err) => {
            delete_entry_fk_off(pool, table, entry).await?;
            tracing::debug!(
                target: "medoc::sync",
                event = "SYNC_ROW_BEFORE_PARENT",
                table = %table,
                id = %entry.entity_id
            );
            Ok(true)
        }
        Err(err) => Err(err),
    }
}

async fn delete_entry_deferred(
    pool: &SqlitePool,
    table: &str,
    entry: &OutboxEntry,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    // Checked at COMMIT, so child and parent statements in this entry can
    // run in either order. The connection's foreign_keys flag is untouched.
    sqlx::query("PRAGMA defer_foreign_keys = ON")
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    apply_delete_statements(&mut tx, table, entry).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

/// Parent is on a later page, so this entry cannot satisfy FKs inside one
/// transaction. SQLite ignores `foreign_keys` changes while a transaction is
/// open, so the switch happens before BEGIN and is verified before the
/// connection returns to the pool.
async fn delete_entry_fk_off(
    pool: &SqlitePool,
    table: &str,
    entry: &OutboxEntry,
) -> Result<(), AppError> {
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    let written = async {
        let mut tx = Connection::begin(&mut *conn)
            .await
            .map_err(AppError::Database)?;
        apply_delete_statements(&mut tx, table, entry).await?;
        tx.commit().await.map_err(AppError::Database)?;
        Ok(())
    }
    .await;
    finish_foreign_keys(conn, written).await
}

async fn apply_delete_statements(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    table: &str,
    entry: &OutboxEntry,
) -> Result<(), AppError> {
    insert_tombstone(&mut **tx, table, &entry.entity_id, &entry.device_id).await?;
    if table == "app_kv" {
        sqlx::query("DELETE FROM app_kv WHERE key = ?1")
            .bind(&entry.entity_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        return Ok(());
    }
    if table == "patient_chart" {
        for sql in [
            "DELETE FROM treatment WHERE chart_id = ?1",
            "DELETE FROM examination WHERE chart_id = ?1",
            "DELETE FROM dental_finding WHERE chart_id = ?1",
            "DELETE FROM chart_attachment WHERE chart_id = ?1",
        ] {
            sqlx::query(sql)
                .bind(&entry.entity_id)
                .execute(&mut **tx)
                .await
                .map_err(AppError::Database)?;
        }
        sqlx::query("DELETE FROM patient_chart WHERE id = ?1")
            .bind(&entry.entity_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        return Ok(());
    }
    if table == "service_item" {
        sqlx::query("UPDATE payment SET service_item_id = NULL WHERE service_item_id = ?1")
            .bind(&entry.entity_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DELETE FROM service_item WHERE id = ?1")
            .bind(&entry.entity_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
        return Ok(());
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    sqlx::query(&format!("DELETE FROM {table} WHERE {key} = ?1"))
        .bind(&entry.entity_id)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn insert_tombstone<'e, E>(
    executor: E,
    table: &str,
    entity_id: &str,
    device_id: &str,
) -> Result<(), AppError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let deleted_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    sqlx::query(
        "INSERT INTO sync_tombstone (entity_table, entity_id, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id",
    )
    .bind(table)
    .bind(entity_id)
    .bind(deleted_at)
    .bind(device_id)
    .execute(executor)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn table_column_names(pool: &SqlitePool, table: &str) -> Result<Vec<String>, AppError> {
    sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
}

fn keep_known_column(known: &[String], name: &str) -> bool {
    known.iter().any(|c| c == name)
}

async fn insert_from_json(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let table = sanitize_table(table)?;
    if table == "staff" {
        return apply_staff_without_secrets(pool, id, obj).await;
    }
    let known = table_column_names(pool, table).await?;
    // F146/F147: the key column is not always `id` (hint, preference) and
    // `chart_validation` has a composite key carried in the payload itself.
    let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
    let (mut cols, mut binds): (Vec<String>, Vec<Option<String>>) =
        if medoc_core::infrastructure::database::sync_registry::key_is_column(table) {
            (vec![id_col.to_string()], vec![Some(id.to_string())])
        } else {
            (Vec::new(), Vec::new())
        };
    for (k, version) in obj {
        if (k == "id" && known.iter().any(|c| c == "id") && id_col == "id")
            || k == id_col
            || !keep_known_column(&known, k)
            || crate::repo::deny_column(table, k)
        {
            continue;
        }
        cols.push(k.clone());
        binds.push(json_to_sql_value(version));
    }
    let placeholders: Vec<String> = (1..=binds.len()).map(|i| format!("?{i}")).collect();
    let sql = format!(
        // Plain INSERT. `INSERT OR REPLACE` resolved a clash on *another*
        // unique column by deleting that other row: a patient registered on
        // two devices with the same insurance number silently deleted the
        // local patient — and, through ON DELETE CASCADE, the chart.
        "INSERT INTO {table} ({}) VALUES ({})",
        cols.join(", "),
        placeholders.join(", ")
    );
    execute_write(pool, &sql, &binds).await
}

/// A staff snapshot never carries `password_hash` or `totp_secret`. A new row
/// gets a hash that cannot log in. An existing row is updated by the normal
/// path, which also ignores those columns.
async fn apply_staff_without_secrets(
    pool: &SqlitePool,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let known = table_column_names(pool, "staff").await?;
    let mut cols = vec!["id".to_string(), "password_hash".to_string()];
    let mut binds: Vec<Option<String>> = vec![Some(id.to_string()), Some("!".to_string())];
    for (k, version) in obj {
        if k == "id"
            || k == "password_hash"
            || crate::repo::deny_column("staff", k)
            || !keep_known_column(&known, k)
        {
            continue;
        }
        cols.push(k.clone());
        binds.push(json_to_sql_value(version));
    }
    let placeholders: Vec<String> = (1..=binds.len()).map(|i| format!("?{i}")).collect();
    let sql = format!(
        "INSERT INTO staff ({}) VALUES ({})",
        cols.join(", "),
        placeholders.join(", ")
    );
    execute_write(pool, &sql, &binds).await
}

async fn update_from_json(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let table = sanitize_table(table)?;
    let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
    let known = table_column_names(pool, table).await?;
    let mut sets = Vec::new();
    let mut binds: Vec<Option<String>> = Vec::new();
    let mut idx = 1;
    for (k, version) in obj {
        if k == "id"
            || k == id_col
            || !keep_known_column(&known, k)
            || crate::repo::deny_column(table, k)
        {
            continue;
        }
        sets.push(format!("{k} = ?{idx}"));
        binds.push(json_to_sql_value(version));
        idx += 1;
    }
    if sets.is_empty() {
        return Ok(());
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    // Skip the write when every column already holds the incoming value.
    // Append-only tables (cash book, reminders, saved reports) reject any
    // UPDATE in a trigger; the echo of a row this device wrote itself used to
    // fail there eight times before being dropped.
    let same: Vec<String> = sets
        .iter()
        .map(|set| {
            let (col, param) = set.split_once(" = ").unwrap_or((set.as_str(), ""));
            format!("{col} IS {param}")
        })
        .collect();
    let sql = format!(
        "UPDATE {table} SET {} WHERE {key} = ?{idx} AND NOT ({})",
        sets.join(", "),
        same.join(" AND ")
    );
    binds.push(Some(id.to_string()));
    execute_write(pool, &sql, &binds).await
}

/// Run a sync write. If the only problem is that a parent row is later in the
/// copy, store this row anyway. The parent lands on a following page and the
/// reference already points at it.
///
/// `defer_foreign_keys` cannot replace this. It only postpones the check until
/// commit, and a parent that is not in this statement still fails the commit.
async fn execute_write(
    pool: &SqlitePool,
    sql: &str,
    binds: &[Option<String>],
) -> Result<(), AppError> {
    match bind_and_execute(pool, sql, binds).await {
        Ok(()) => Ok(()),
        Err(err) if is_foreign_key_error(&err) => {
            let mut conn = pool.acquire().await.map_err(AppError::Database)?;
            sqlx::query("PRAGMA foreign_keys = OFF")
                .execute(&mut *conn)
                .await
                .map_err(AppError::Database)?;
            let written = bind_and_execute(&mut *conn, sql, binds).await;
            finish_foreign_keys(conn, written).await?;
            tracing::debug!(
                target: "medoc::sync",
                event = "SYNC_ROW_BEFORE_PARENT"
            );
            Ok(())
        }
        Err(err) => Err(err),
    }
}

/// Turn foreign keys back on. If that does not stick, close the connection so
/// the pool cannot hand it out with checks disabled.
pub(crate) async fn finish_foreign_keys<T>(
    mut conn: sqlx::pool::PoolConnection<sqlx::Sqlite>,
    outcome: Result<T, AppError>,
) -> Result<T, AppError> {
    match restore_foreign_keys(&mut conn).await {
        Ok(()) => outcome,
        Err(restore_err) => {
            let _ = conn.close().await;
            let _ = outcome;
            Err(restore_err)
        }
    }
}

pub(crate) async fn restore_foreign_keys(
    conn: &mut sqlx::SqliteConnection,
) -> Result<(), AppError> {
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    let on: i32 = sqlx::query_scalar("PRAGMA foreign_keys")
        .fetch_one(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    if on == 1 {
        Ok(())
    } else {
        Err(AppError::Internal(
            "PRAGMA foreign_keys stayed off after restore".into(),
        ))
    }
}

mod sql_values;
#[allow(unused_imports)]
pub use sql_values::*;

#[cfg(test)]
mod tests {
    use super::sanitize_table;

    #[test]
    fn allow_list_rejects_unknown_tables() {
        assert!(sanitize_table("staff").is_err());
        assert!(sanitize_table("license").is_err());
        assert!(sanitize_table("patient").is_ok());
        assert!(sanitize_table("absence").is_ok());
    }

    #[test]
    fn tier1_tables_are_allow_listed() {
        for table in [
            "anamnesis_form",
            "dental_finding",
            "prescription",
            "certificate",
            "service_item",
            "in_app_notification",
            "practice_ticket",
            "issued_document",
        ] {
            assert!(sanitize_table(table).is_ok(), "{table}");
        }
    }

    #[test]
    fn parse_ts_str_handles_rfc3339_and_sqlite_naive() {
        use super::parse_ts_str;
        assert!(parse_ts_str("2099-01-01T00:00:00Z").is_some());
        assert!(parse_ts_str("2099-01-01 00:00:00").is_some());
        assert!(parse_ts_str("2099-01-01 00:00:00.123").is_some());
        let naive = parse_ts_str("2026-06-01 12:00:00").unwrap();
        let utc = parse_ts_str("2026-06-01T12:00:00Z").unwrap();
        assert_eq!(naive, utc, "a timestamp with no offset is compared as UTC");
        let ahead = parse_ts_str("2026-06-01T14:00:00Z").unwrap();
        assert!(ahead > utc, "a clock two hours ahead wins last-write-wins");
        assert!(parse_ts_str("").is_none());
        assert!(parse_ts_str("   ").is_none());
        assert!(parse_ts_str("not-a-date").is_none());
    }

    #[test]
    fn a_future_stamp_is_clamped_to_the_master_clock() {
        let now = chrono::DateTime::parse_from_rfc3339("2099-06-01T12:00:00Z")
            .unwrap()
            .with_timezone(&chrono::Utc);
        let fast = r#"{"name":"Fast","updated_at":"2099-06-01T12:02:00Z"}"#;
        let clamped = super::clamp_future_updated_at(fast, now, None);
        let value: serde_json::Value = serde_json::from_str(&clamped).unwrap();
        assert_eq!(value["updated_at"], "2099-06-01T12:00:00.000Z");
        assert_eq!(value["name"], "Fast");
        let older = r#"{"name":"Older","updated_at":"2099-06-01T11:00:00Z"}"#;
        assert_eq!(super::clamp_future_updated_at(older, now, None), older);
        let slow = r#"{"name":"Slow","updated_at":"2099-06-01T11:58:30Z"}"#;
        assert_eq!(
            super::clamp_future_updated_at(slow, now, None),
            slow,
            "a stamp behind now must stay behind, so it cannot leap over a newer local row"
        );
        let local_ahead = chrono::DateTime::parse_from_rfc3339("2099-07-01T00:00:00Z")
            .unwrap()
            .fixed_offset();
        assert_eq!(
            super::clamp_future_updated_at(fast, now, Some(local_ahead)),
            fast,
            "two stamps ahead of this clock keep their own order"
        );
    }
}
