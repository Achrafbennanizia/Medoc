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

/// Max ARZT accounts (admin slot).
pub const MAX_ARZT: u32 = 1;

/// Max REZEPTION accounts (user slots).
pub const MAX_REZEPTION: u32 = 4;

/// Max total staff accounts.
pub const MAX_TOTAL_PERSONAL: u32 = 5;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct StaffQuotaLimits {
    pub max_arzt: u32,
    pub max_rezeption: u32,
    pub max_total: u32,
}

/// Authoritative quota caps — swap body for license-backed limits later.
/// When limits change at runtime, call [`reinstall_staff_quota_db_triggers`] after activate.
pub fn staff_quota_limits() -> StaffQuotaLimits {
    StaffQuotaLimits {
        max_arzt: MAX_ARZT,
        max_rezeption: MAX_REZEPTION,
        max_total: MAX_TOTAL_PERSONAL,
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StaffQuota {
    pub max_arzt: u32,
    pub max_rezeption: u32,
    pub max_total: u32,
    pub used_arzt: u32,
    pub used_rezeption: u32,
    pub used_total: u32,
}

#[derive(Debug, Clone, Copy)]
struct StaffCounts {
    total: u32,
    arzt: u32,
    rezeption: u32,
}

pub fn require_break_glass_enabled() -> Result<(), AppError> {
    if BREAK_GLASS_ENABLED {
        Ok(())
    } else {
        Err(AppError::Validation(
            "Notfallzugriff ist derzeit deaktiviert".into(),
        ))
    }
}

pub fn require_totp_enabled() -> Result<(), AppError> {
    if TOTP_2FA_ENABLED {
        Ok(())
    } else {
        Err(AppError::Validation(
            "Zwei-Faktor-Authentifizierung ist derzeit deaktiviert".into(),
        ))
    }
}

pub async fn staff_quota(pool: &SqlitePool) -> Result<StaffQuota, AppError> {
    let limits = staff_quota_limits();
    let counts = staff_counts_pool(pool, None).await?;

    Ok(StaffQuota {
        max_arzt: limits.max_arzt,
        max_rezeption: limits.max_rezeption,
        max_total: limits.max_total,
        used_arzt: counts.arzt,
        used_rezeption: counts.rezeption,
        used_total: counts.total,
    })
}

/// Validates quota inside an open `BEGIN IMMEDIATE` transaction.
pub async fn enforce_staff_quota_on_conn(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    rolle: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let counts = staff_counts_tx(tx, exclude_id).await?;
    enforce_staff_quota_from_counts(staff_quota_limits(), rolle, counts)
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
    pub max_arzt: String,
    pub max_rezeption: String,
}

/// German validation messages shared by app-layer checks and DB trigger RAISE text.
pub fn quota_error_messages(limits: StaffQuotaLimits) -> QuotaErrorMessages {
    QuotaErrorMessages {
        max_total: format!("Maximal {} Benutzer erlaubt", limits.max_total),
        max_arzt: format!(
            "Maximal {} Arzt-Konto erlaubt (Admin-Platz belegt)",
            limits.max_arzt
        ),
        max_rezeption: format!(
            "Maximal {} Rezeptions-Konten erlaubt",
            limits.max_rezeption
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
        sql_raise_message_literal(&msgs.max_arzt),
        sql_raise_message_literal(&msgs.max_rezeption),
    )
}

/// Fingerprint of limits written to [`STAFF_QUOTA_LIMITS_KV_KEY`] after trigger reinstall.
pub fn staff_quota_limits_fingerprint(limits: StaffQuotaLimits) -> String {
    format!(
        "{},{},{}",
        limits.max_arzt, limits.max_rezeption, limits.max_total
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
    let (msg_total, msg_arzt, msg_rezeption) = quota_messages_as_raise_literals(&msgs);

    let insert = format!(
        "CREATE TRIGGER trg_personal_quota_insert
         BEFORE INSERT ON personal
         WHEN UPPER(NEW.rolle) IN ('ARZT', 'REZEPTION')
         BEGIN
           SELECT RAISE(ABORT, {msg_total})
           WHERE (SELECT COUNT(*) FROM personal) >= {max_total};
           SELECT RAISE(ABORT, {msg_arzt})
           WHERE UPPER(NEW.rolle) = 'ARZT'
             AND (SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = 'ARZT') >= {max_arzt};
           SELECT RAISE(ABORT, {msg_rezeption})
           WHERE UPPER(NEW.rolle) = 'REZEPTION'
             AND (SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = 'REZEPTION') >= {max_rezeption};
         END",
        max_total = limits.max_total,
        max_arzt = limits.max_arzt,
        max_rezeption = limits.max_rezeption,
    );

    let update = format!(
        "CREATE TRIGGER trg_personal_quota_update_rolle
         BEFORE UPDATE OF rolle ON personal
         WHEN UPPER(NEW.rolle) IN ('ARZT', 'REZEPTION')
           AND UPPER(NEW.rolle) != UPPER(OLD.rolle)
         BEGIN
           SELECT RAISE(ABORT, {msg_total})
           WHERE (SELECT COUNT(*) FROM personal WHERE id != OLD.id) >= {max_total};
           SELECT RAISE(ABORT, {msg_arzt})
           WHERE UPPER(NEW.rolle) = 'ARZT'
             AND (SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = 'ARZT' AND id != OLD.id) >= {max_arzt};
           SELECT RAISE(ABORT, {msg_rezeption})
           WHERE UPPER(NEW.rolle) = 'REZEPTION'
             AND (SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = 'REZEPTION' AND id != OLD.id) >= {max_rezeption};
         END",
        max_total = limits.max_total,
        max_arzt = limits.max_arzt,
        max_rezeption = limits.max_rezeption,
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
    Ok(row.map(|(v,)| v))
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
    for name in ["trg_personal_quota_insert", "trg_personal_quota_update_rolle"] {
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

    for name in ["trg_personal_quota_insert", "trg_personal_quota_update_rolle"] {
        sqlx::query(&format!("DROP TRIGGER IF EXISTS {name}"))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }

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

/// Validates that assigning `rolle` to a new or updated staff member stays within quota.
/// Non-atomic; prefer [`enforce_staff_quota_on_conn`] inside `BEGIN IMMEDIATE` for writes.
pub async fn check_staff_quota(
    pool: &SqlitePool,
    rolle: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let counts = staff_counts_pool(pool, exclude_id).await?;
    enforce_staff_quota_from_counts(staff_quota_limits(), rolle, counts)
}

fn enforce_staff_quota_from_counts(
    limits: StaffQuotaLimits,
    rolle: &str,
    counts: StaffCounts,
) -> Result<(), AppError> {
    let role = rolle.trim().to_uppercase();
    if role != "ARZT" && role != "REZEPTION" {
        return Ok(());
    }

    let msgs = quota_error_messages(limits);

    if counts.total >= limits.max_total {
        return Err(AppError::Validation(msgs.max_total));
    }

    if role == "ARZT" && counts.arzt >= limits.max_arzt {
        return Err(AppError::Validation(msgs.max_arzt));
    }

    if role == "REZEPTION" && counts.rezeption >= limits.max_rezeption {
        return Err(AppError::Validation(msgs.max_rezeption));
    }

    Ok(())
}

async fn staff_counts_pool(
    pool: &SqlitePool,
    exclude_id: Option<&str>,
) -> Result<StaffCounts, AppError> {
    let total = count_personal(pool, exclude_id).await?;
    let arzt = count_personal_by_role(pool, "ARZT", exclude_id).await?;
    let rezeption = count_personal_by_role(pool, "REZEPTION", exclude_id).await?;
    Ok(StaffCounts {
        total,
        arzt,
        rezeption,
    })
}

async fn staff_counts_tx(
    tx: &mut sqlx::Transaction<'_, Sqlite>,
    exclude_id: Option<&str>,
) -> Result<StaffCounts, AppError> {
    let total = count_personal(&mut **tx, exclude_id).await?;
    let arzt = count_personal_by_role(&mut **tx, "ARZT", exclude_id).await?;
    let rezeption = count_personal_by_role(&mut **tx, "REZEPTION", exclude_id).await?;
    Ok(StaffCounts {
        total,
        arzt,
        rezeption,
    })
}

async fn count_personal<'e, E>(
    executor: E,
    exclude_id: Option<&str>,
) -> Result<u32, AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let row: (i64,) = if let Some(id) = exclude_id {
        sqlx::query_as("SELECT COUNT(*) FROM personal WHERE id != ?1")
            .bind(id)
            .fetch_one(executor)
            .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM personal")
            .fetch_one(executor)
            .await?
    };
    Ok(row.0.max(0) as u32)
}

async fn count_personal_by_role<'e, E>(
    executor: E,
    rolle: &str,
    exclude_id: Option<&str>,
) -> Result<u32, AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    let row: (i64,) = if let Some(id) = exclude_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = UPPER(?1) AND id != ?2",
        )
        .bind(rolle)
        .bind(id)
        .fetch_one(executor)
        .await?
    } else {
        sqlx::query_as("SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = UPPER(?1)")
            .bind(rolle)
            .fetch_one(executor)
            .await?
    };
    Ok(row.0.max(0) as u32)
}
