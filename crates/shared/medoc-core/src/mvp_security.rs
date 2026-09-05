//! MVP security feature flags and staff quota enforcement.
//!
//! TODO(deferred-security): Re-enable via `docs/coordination/todos-deferred-security-features.md`.

use crate::error::AppError;
use serde::Serialize;
use sqlx::{Sqlite, SqlitePool};

/// Break-Glass (Notfallzugriff) — disabled for MVP.
pub const BREAK_GLASS_ENABLED: bool = false;

/// TOTP two-factor authentication — disabled for MVP.
pub const TOTP_2FA_ENABLED: bool = false;

/// Max PHYSICIAN accounts (admin slot).
pub const MAX_PHYSICIAN: u32 = 1;

/// Max RECEPTION accounts (user slots).
pub const MAX_RECEPTION: u32 = 4;

/// Max total staff accounts.
pub const MAX_TOTAL_STAFF: u32 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct StaffQuotaLimits {
    pub max_physician: u32,
    pub max_reception: u32,
    pub max_total: u32,
}

/// Authoritative quota caps — swap body for license-backed limits later.
/// When limits change at runtime, call [`reinstall_staff_quota_db_triggers`] after activate.
pub fn staff_quota_limits() -> StaffQuotaLimits {
    StaffQuotaLimits {
        max_physician: MAX_PHYSICIAN,
        max_reception: MAX_RECEPTION,
        max_total: MAX_TOTAL_STAFF,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StaffQuota {
    pub max_physician: u32,
    pub max_reception: u32,
    pub max_total: u32,
    pub used_physician: u32,
    pub used_reception: u32,
    pub used_total: u32,
}

#[derive(Debug, Clone, Copy)]
struct StaffCounts {
    total: u32,
    physician: u32,
    reception: u32,
}

pub fn require_break_glass_enabled() -> Result<(), AppError> {
    if BREAK_GLASS_ENABLED {
        Ok(())
    } else {
        Err(AppError::Validation(
            "Break-glass access is currently disabled".into(),
        ))
    }
}

pub fn require_totp_enabled() -> Result<(), AppError> {
    if TOTP_2FA_ENABLED {
        Ok(())
    } else {
        Err(AppError::Validation(
            "Two-factor authentication is currently disabled".into(),
        ))
    }
}

pub async fn staff_quota(pool: &SqlitePool) -> Result<StaffQuota, AppError> {
    let limits = staff_quota_limits();
    let counts = staff_counts_pool(pool, None).await?;

    Ok(StaffQuota {
        max_physician: limits.max_physician,
        max_reception: limits.max_reception,
        max_total: limits.max_total,
        used_physician: counts.physician,
        used_reception: counts.reception,
        used_total: counts.total,
    })
}

/// Validates quota inside an open `BEGIN IMMEDIATE` transaction.
pub async fn enforce_staff_quota_on_conn(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    role: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let counts = staff_counts_tx(tx, exclude_id).await?;
    enforce_staff_quota_from_counts(staff_quota_limits(), role, counts)
}

/// Sentinel `app_kv` row touched at the start of quota transactions to acquire a
/// write lock eagerly (belt-and-suspenders if the driver ever opened DEFERRED).
const STAFF_QUOTA_LOCK_KV: &str = "mvp.staff_quota.write_lock.v1";

/// Atomic create path: `BEGIN IMMEDIATE` → pin write lock → count → insert (via caller).
///
/// Uses [`Pool::begin_with`](sqlx::Pool::begin_with) with `"BEGIN IMMEDIATE"` — **not**
/// `pool.begin()` followed by a second `BEGIN`, which would nest or no-op and reopen TOCTOU.
pub async fn begin_immediate_quota_tx(
    pool: &SqlitePool,
) -> Result<sqlx::Transaction<'_, Sqlite>, AppError> {
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    pin_staff_quota_write_lock(&mut tx).await?;
    Ok(tx)
}

/// First statement in a quota transaction: upsert sentinel so RESERVED/EXCLUSIVE lock
/// is held before `COUNT(*)` (read) queries run.
async fn pin_staff_quota_write_lock(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, '1', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
    )
    .bind(STAFF_QUOTA_LOCK_KV)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QuotaErrorMessages {
    pub max_total: String,
    pub max_physician: String,
    pub max_reception: String,
}

/// English validation messages shared by app-layer checks and DB trigger RAISE text.
pub fn quota_error_messages(limits: StaffQuotaLimits) -> QuotaErrorMessages {
    QuotaErrorMessages {
        max_total: format!("Maximum {} users allowed", limits.max_total),
        max_physician: format!(
            "Maximum {} physician account allowed (admin slot taken)",
            limits.max_physician
        ),
        max_reception: format!(
            "Maximum {} reception accounts allowed",
            limits.max_reception
        ),
    }
}

/// Escape `message` as a SQLite string literal for `RAISE(ABORT, …)`.
///
/// Every user-facing RAISE text in staff-quota trigger DDL must pass through here.
pub fn sql_raise_message_literal(message: &str) -> String {
    format!("'{}'", message.replace('\'', "''"))
}

fn quota_messages_as_raise_literals(msgs: &QuotaErrorMessages) -> (String, String, String) {
    (
        sql_raise_message_literal(&msgs.max_total),
        sql_raise_message_literal(&msgs.max_physician),
        sql_raise_message_literal(&msgs.max_reception),
    )
}

/// Fingerprint of limits written to [`STAFF_QUOTA_LIMITS_KV_KEY`] after trigger reinstall.
pub fn staff_quota_limits_fingerprint(limits: StaffQuotaLimits) -> String {
    format!(
        "{},{},{}",
        limits.max_physician, limits.max_reception, limits.max_total
    )
}

/// `app_kv` key recording which limits the installed triggers were built from.
pub const STAFF_QUOTA_LIMITS_KV_KEY: &str = "mvp.staff_quota.limits.v1";

/// Pure DDL builder for staff-quota triggers — unit-testable without SQLite.
///
/// **Safety:** `limits` numeric fields are interpolated as integer thresholds only.
/// Message strings come from [`quota_error_messages`] (or test overrides) and are escaped
/// via [`sql_raise_message_literal`]. Never pass license payload or user input into
/// `limits` or unescaped message text — that would be SQL injection in trigger DDL.
pub fn staff_quota_trigger_ddl(limits: StaffQuotaLimits) -> (String, String) {
    staff_quota_trigger_ddl_with_messages(limits, quota_error_messages(limits))
}

/// Same as [`staff_quota_trigger_ddl`] but accepts explicit messages (tests, apostrophe checks).
pub fn staff_quota_trigger_ddl_with_messages(
    limits: StaffQuotaLimits,
    msgs: QuotaErrorMessages,
) -> (String, String) {
    let (msg_total, msg_physician, msg_reception) = quota_messages_as_raise_literals(&msgs);

    let insert = format!(
        "CREATE TRIGGER trg_staff_quota_insert
         BEFORE INSERT ON staff
         WHEN UPPER(NEW.role) IN ('PHYSICIAN', 'RECEPTION')
         BEGIN
           SELECT RAISE(ABORT, {msg_total})
           WHERE (SELECT COUNT(*) FROM staff) >= {max_total};
           SELECT RAISE(ABORT, {msg_physician})
           WHERE UPPER(NEW.role) = 'PHYSICIAN'
             AND (SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'PHYSICIAN') >= {max_physician};
           SELECT RAISE(ABORT, {msg_reception})
           WHERE UPPER(NEW.role) = 'RECEPTION'
             AND (SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'RECEPTION') >= {max_reception};
         END",
        max_total = limits.max_total,
        max_physician = limits.max_physician,
        max_reception = limits.max_reception,
    );

    let update = format!(
        "CREATE TRIGGER trg_staff_quota_update_role
         BEFORE UPDATE OF role ON staff
         WHEN UPPER(NEW.role) IN ('PHYSICIAN', 'RECEPTION')
           AND UPPER(NEW.role) != UPPER(OLD.role)
         BEGIN
           SELECT RAISE(ABORT, {msg_total})
           WHERE (SELECT COUNT(*) FROM staff WHERE id != OLD.id) >= {max_total};
           SELECT RAISE(ABORT, {msg_physician})
           WHERE UPPER(NEW.role) = 'PHYSICIAN'
             AND (SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'PHYSICIAN' AND id != OLD.id) >= {max_physician};
           SELECT RAISE(ABORT, {msg_reception})
           WHERE UPPER(NEW.role) = 'RECEPTION'
             AND (SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'RECEPTION' AND id != OLD.id) >= {max_reception};
         END",
        max_total = limits.max_total,
        max_physician = limits.max_physician,
        max_reception = limits.max_reception,
    );

    (insert, update)
}

async fn stored_staff_quota_limits_fingerprint(
    pool: &SqlitePool,
) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
            .bind(STAFF_QUOTA_LIMITS_KV_KEY)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(row.map(|(version,)| version))
}

fn log_staff_quota_trigger_drift(stored: &str, expected: &str) {
    tracing::warn!(
        target: "medoc::security",
        event = "STAFF_QUOTA_TRIGGER_DRIFT",
        stored = %stored,
        expected = %expected,
        hint = "triggers will be reinstalled from current staff_quota_limits()"
    );
}

async fn staff_quota_triggers_present(pool: &SqlitePool) -> Result<bool, AppError> {
    for name in ["trg_staff_quota_insert", "trg_staff_quota_update_role"] {
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='trigger' AND name=?1",
        )
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if n == 0 {
            return Ok(false);
        }
    }
    Ok(true)
}

/// Drop staff-quota triggers (idempotent). Call before migration/demo seed so
/// `INSERT OR IGNORE` of already-present staff does not trip `BEFORE INSERT`
/// when the table is already at [`MAX_TOTAL_STAFF`].
pub async fn drop_staff_quota_db_triggers(pool: &SqlitePool) -> Result<(), AppError> {
    for name in ["trg_staff_quota_insert", "trg_staff_quota_update_role"] {
        sqlx::query(&format!("DROP TRIGGER IF EXISTS {name}"))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// DB-level belt-and-suspenders: (re)install triggers from [`staff_quota_limits`].
pub async fn reinstall_staff_quota_db_triggers(pool: &SqlitePool) -> Result<(), AppError> {
    let limits = staff_quota_limits();
    let expected_fp = staff_quota_limits_fingerprint(limits);
    if let Some(stored) = stored_staff_quota_limits_fingerprint(pool).await? {
        if stored == expected_fp && staff_quota_triggers_present(pool).await? {
            return Ok(());
        }
        if stored != expected_fp {
            log_staff_quota_trigger_drift(&stored, &expected_fp);
        }
    }

    let (insert_sql, update_sql) = staff_quota_trigger_ddl(limits);

    drop_staff_quota_db_triggers(pool).await?;

    sqlx::query(&insert_sql)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(&update_sql)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(STAFF_QUOTA_LIMITS_KV_KEY)
    .bind(&expected_fp)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}

/// Alias for migration/tests — reinstalls (DROP + CREATE) from current [`staff_quota_limits`].
///
/// Not a cheap create-if-missing: always drops existing triggers first so cap changes
/// take effect on upgraded DBs (`CREATE TRIGGER IF NOT EXISTS` would silently no-op).
pub async fn ensure_staff_quota_db_triggers(pool: &SqlitePool) -> Result<(), AppError> {
    reinstall_staff_quota_db_triggers(pool).await
}

/// Validates that assigning `role` to a new or updated staff member stays within quota.
/// Non-atomic; prefer [`enforce_staff_quota_on_conn`] inside `BEGIN IMMEDIATE` for writes.
pub async fn check_staff_quota(
    pool: &SqlitePool,
    role: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let counts = staff_counts_pool(pool, exclude_id).await?;
    enforce_staff_quota_from_counts(staff_quota_limits(), role, counts)
}

fn enforce_staff_quota_from_counts(
    limits: StaffQuotaLimits,
    role: &str,
    counts: StaffCounts,
) -> Result<(), AppError> {
    let role = role.trim().to_uppercase();
    if role != "PHYSICIAN" && role != "RECEPTION" {
        return Ok(());
    }

    let msgs = quota_error_messages(limits);

    if counts.total >= limits.max_total {
        return Err(AppError::Validation(msgs.max_total));
    }

    if role == "PHYSICIAN" && counts.physician >= limits.max_physician {
        return Err(AppError::Validation(msgs.max_physician));
    }

    if role == "RECEPTION" && counts.reception >= limits.max_reception {
        return Err(AppError::Validation(msgs.max_reception));
    }

    Ok(())
}

async fn staff_counts_pool(
    pool: &SqlitePool,
    exclude_id: Option<&str>,
) -> Result<StaffCounts, AppError> {
    let total = count_staff(pool, exclude_id).await?;
    let physician = count_staff_by_role(pool, "PHYSICIAN", exclude_id).await?;
    let reception = count_staff_by_role(pool, "RECEPTION", exclude_id).await?;
    Ok(StaffCounts {
        total,
        physician,
        reception,
    })
}

async fn staff_counts_tx(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    exclude_id: Option<&str>,
) -> Result<StaffCounts, AppError> {
    let total = count_staff(&mut **tx, exclude_id).await?;
    let physician = count_staff_by_role(&mut **tx, "PHYSICIAN", exclude_id).await?;
    let reception = count_staff_by_role(&mut **tx, "RECEPTION", exclude_id).await?;
    Ok(StaffCounts {
        total,
        physician,
        reception,
    })
}

async fn count_staff<'e, E>(
    executor: E,
    exclude_id: Option<&str>,
) -> Result<u32, AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let row: (i64,) = if let Some(id) = exclude_id {
        sqlx::query_as("SELECT COUNT(*) FROM staff WHERE id != ?1")
            .bind(id)
            .fetch_one(executor)
            .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM staff")
            .fetch_one(executor)
            .await?
    };
    Ok(row.0.max(0) as u32)
}

async fn count_staff_by_role<'e, E>(
    executor: E,
    role: &str,
    exclude_id: Option<&str>,
) -> Result<u32, AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let row: (i64,) = if let Some(id) = exclude_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM staff WHERE UPPER(role) = UPPER(?1) AND id != ?2",
        )
        .bind(role)
        .bind(id)
        .fetch_one(executor)
        .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM staff WHERE UPPER(role) = UPPER(?1)")
            .bind(role)
            .fetch_one(executor)
            .await?
    };
    Ok(row.0.max(0) as u32)
}
