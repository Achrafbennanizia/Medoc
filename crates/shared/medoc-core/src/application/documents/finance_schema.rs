//! Schema for the cash journal, cash movements, the extended day close and
//! payment reminders.
//!
//! The tables are created idempotently on first use (`ensure`), so the
//! feature works without touching the migration chain. Every finance command
//! calls `ensure` first; the check is two `sqlite_master` lookups.
//!
//! # Cash journal (`payment_receipt`)
//!
//! `payment` rows are mutable: a 0 € placeholder is later filled with the
//! real amount, a partial payment is raised, a booking is cancelled. The day
//! close needs *when* money moved, not when the row was created. Triggers on
//! `payment` therefore append one signed journal line per money movement
//! with the real timestamp. The journal is append-only (triggers block
//! changes), and `reconcile` repairs it if a change ever bypassed the
//! triggers (e.g. rows written before this schema existed).

use sqlx::SqlitePool;

use crate::error::AppError;

/// Bump when the trigger SQL changes; old triggers are dropped and recreated.
const SCHEMA_VERSION: &str = "v2";

fn effective_cents(alias: &str) -> String {
    format!(
        "(CASE WHEN UPPER(COALESCE({a}.status,'')) = 'CANCELLED' THEN 0 \
          ELSE CAST(ROUND(COALESCE({a}.amount,0) * 100) AS INTEGER) END)",
        a = alias
    )
}

const NEW_ID: &str = "lower(hex(randomblob(16)))";
const NOW_UTC: &str = "strftime('%Y-%m-%d %H:%M:%S','now')";
/// When a payment changed. A change that moved `updated_at` (a local edit
/// stamps now; a synced edit carries the time it was made on the other
/// device) is dated by it. Before (v1), a change synced the next day landed
/// on the receiving device's journal for the next day.
const CHANGED_AT: &str = "COALESCE(CASE WHEN NEW.updated_at IS NOT NULL \
     AND NEW.updated_at IS NOT OLD.updated_at \
     THEN strftime('%Y-%m-%d %H:%M:%S', NEW.updated_at) END, \
     strftime('%Y-%m-%d %H:%M:%S','now'))";

async fn table_exists(pool: &SqlitePool, name: &str) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type IN ('table','trigger','index') AND name = ?1",
    )
    .bind(name)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(&format!(
        "SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = ?1"
    ))
    .bind(column)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

/// Create tables, columns and triggers if missing. Safe to call often.
pub async fn ensure(pool: &SqlitePool) -> Result<(), AppError> {
    let marker = format!("trg_payment_receipt_{SCHEMA_VERSION}_ins");
    if table_exists(pool, &marker).await? && table_exists(pool, "payment_reminder").await? {
        return Ok(());
    }
    let fresh_journal = !table_exists(pool, "payment_receipt").await?;

    let mut tx = pool.begin().await?;
    for ddl in [
        // ---- Cash journal -------------------------------------------------
        "CREATE TABLE IF NOT EXISTS payment_receipt (
            id TEXT PRIMARY KEY,
            payment_id TEXT NOT NULL,
            patient_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            method TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('RECEIPT','REVERSAL','CORRECTION','BACKFILL')),
            received_at TEXT NOT NULL,
            local_day TEXT NOT NULL,
            day_close_id TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
        )",
        "CREATE INDEX IF NOT EXISTS idx_payment_receipt_day ON payment_receipt(local_day, day_close_id)",
        "CREATE INDEX IF NOT EXISTS idx_payment_receipt_payment ON payment_receipt(payment_id)",
        // ---- Cash movements (Einlage, Entnahme, Bankeinzahlung, Barausgabe) -
        "CREATE TABLE IF NOT EXISTS cash_movement (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN
                ('OPENING_FLOAT','DEPOSIT','WITHDRAWAL','BANK_DEPOSIT','EXPENSE','REVERSAL')),
            amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
            direction INTEGER NOT NULL CHECK (direction IN (1,-1)),
            reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
            receipt_ref TEXT,
            reverses_id TEXT REFERENCES cash_movement(id),
            occurred_at TEXT NOT NULL,
            local_day TEXT NOT NULL,
            created_by TEXT NOT NULL,
            day_close_id TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%S','now'))
        )",
        "CREATE INDEX IF NOT EXISTS idx_cash_movement_day ON cash_movement(local_day, day_close_id)",
        // ---- Payment reminders (Zahlungserinnerung / Mahnung) --------------
        "CREATE TABLE IF NOT EXISTS payment_reminder (
            id TEXT PRIMARY KEY,
            invoice_document_id TEXT NOT NULL,
            invoice_number TEXT NOT NULL,
            patient_id TEXT,
            level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 3),
            document_number TEXT NOT NULL UNIQUE,
            open_cents INTEGER NOT NULL,
            fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
            pay_by TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            issued_by TEXT NOT NULL,
            issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )",
        "CREATE INDEX IF NOT EXISTS idx_payment_reminder_invoice ON payment_reminder(invoice_document_id)",
        // ---- Append-only rules ---------------------------------------------
        "CREATE TRIGGER IF NOT EXISTS trg_payment_receipt_no_update
         BEFORE UPDATE ON payment_receipt
         WHEN NEW.amount_cents IS NOT OLD.amount_cents OR NEW.received_at IS NOT OLD.received_at
           OR NEW.method IS NOT OLD.method OR NEW.payment_id IS NOT OLD.payment_id
           OR NEW.local_day IS NOT OLD.local_day
           OR (OLD.day_close_id IS NOT NULL AND NEW.day_close_id IS NOT OLD.day_close_id)
         BEGIN SELECT RAISE(ABORT, 'error.cash_book.journal_immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_payment_receipt_no_delete
         BEFORE DELETE ON payment_receipt
         WHEN OLD.received_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.cash_book.journal_immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_cash_movement_no_update
         BEFORE UPDATE ON cash_movement
         WHEN NEW.amount_cents IS NOT OLD.amount_cents OR NEW.direction IS NOT OLD.direction
           OR NEW.kind IS NOT OLD.kind OR NEW.occurred_at IS NOT OLD.occurred_at
           OR NEW.reason IS NOT OLD.reason
           OR (OLD.day_close_id IS NOT NULL AND NEW.day_close_id IS NOT OLD.day_close_id)
         BEGIN SELECT RAISE(ABORT, 'error.cash_book.journal_immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_cash_movement_no_delete
         BEFORE DELETE ON cash_movement
         WHEN OLD.occurred_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.cash_book.journal_immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_payment_reminder_immutable
         BEFORE UPDATE ON payment_reminder
         BEGIN SELECT RAISE(ABORT, 'error.documents.immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_payment_reminder_no_delete
         BEFORE DELETE ON payment_reminder
         WHEN OLD.issued_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.documents.immutable'); END",
        // Saved period reports are final (numbered, hashed BE document).
        "CREATE TRIGGER IF NOT EXISTS trg_balance_snapshot_immutable
         BEFORE UPDATE ON balance_sheet_snapshot
         BEGIN SELECT RAISE(ABORT, 'error.documents.immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_balance_snapshot_no_delete
         BEFORE DELETE ON balance_sheet_snapshot
         WHEN OLD.created_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.documents.immutable'); END",
                // A paid booking keeps its money trail: deleting it would erase cash
        // that was received (only possible after the 10-year retention).
        "CREATE TRIGGER IF NOT EXISTS trg_payment_keep_receipts
         BEFORE DELETE ON payment
         WHEN (SELECT COALESCE(SUM(amount_cents),0) FROM payment_receipt WHERE payment_id = OLD.id) <> 0
          AND OLD.created_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.payment.delete_has_receipts'); END",
    ] {
        sqlx::query(ddl).execute(&mut *tx).await?;
    }
    tx.commit().await?;

    extend_day_close_protocol(pool).await?;
    install_payment_triggers(pool).await?;
    if fresh_journal {
        // Existing payments: one BACKFILL line each, dated at creation (the
        // best information available for money received before the journal).
        reconcile(pool).await?;
    }
    Ok(())
}

async fn install_payment_triggers(pool: &SqlitePool) -> Result<(), AppError> {
    let old = effective_cents("OLD");
    let new = effective_cents("NEW");
    let mut tx = pool.begin().await?;
    // Drop older trigger generations.
    let names: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'trg_payment_receipt_v%'",
    )
    .fetch_all(&mut *tx)
    .await?;
    for n in names {
        sqlx::query(&format!("DROP TRIGGER IF EXISTS {n}"))
            .execute(&mut *tx)
            .await?;
    }
    let v = SCHEMA_VERSION;
    let insert = |kind: &str, amount: &str, method: &str, at: &str| {
        format!(
            "INSERT INTO payment_receipt (id, payment_id, patient_id, amount_cents, method, kind, received_at, local_day)
             VALUES ({NEW_ID}, NEW.id, NEW.patient_id, {amount}, {method}, {kind}, {at}, date({at}, 'localtime'));"
        )
    };
    let ddl = [
        // New booking with money.
        format!(
            "CREATE TRIGGER trg_payment_receipt_{v}_ins AFTER INSERT ON payment
             WHEN {new} <> 0
             BEGIN {} END",
            insert(
                "'RECEIPT'",
                &new,
                "UPPER(NEW.payment_method)",
                &format!("COALESCE(NEW.created_at, {NOW_UTC})")
            )
        ),
        // Amount or status changed, same method: book the difference now.
        format!(
            "CREATE TRIGGER trg_payment_receipt_{v}_upd AFTER UPDATE ON payment
             WHEN UPPER(OLD.payment_method) = UPPER(NEW.payment_method) AND {new} <> {old}
             BEGIN {} END",
            insert(
                &format!(
                    "CASE WHEN UPPER(NEW.status) = 'CANCELLED' THEN 'REVERSAL' \
                     WHEN {new} > {old} THEN 'RECEIPT' ELSE 'CORRECTION' END"
                ),
                &format!("({new} - {old})"),
                "UPPER(NEW.payment_method)",
                CHANGED_AT
            )
        ),
        // Method changed (e.g. cash → card): reverse under the old method,
        // book again under the new one. Both lines land on the day of the change.
        format!(
            "CREATE TRIGGER trg_payment_receipt_{v}_method AFTER UPDATE ON payment
             WHEN UPPER(OLD.payment_method) <> UPPER(NEW.payment_method) AND ({old} <> 0 OR {new} <> 0)
             BEGIN
               INSERT INTO payment_receipt (id, payment_id, patient_id, amount_cents, method, kind, received_at, local_day)
               SELECT {NEW_ID}, NEW.id, NEW.patient_id, -{old}, UPPER(OLD.payment_method), 'CORRECTION', {CHANGED_AT}, date({CHANGED_AT}, 'localtime')
               WHERE {old} <> 0;
               INSERT INTO payment_receipt (id, payment_id, patient_id, amount_cents, method, kind, received_at, local_day)
               SELECT {NEW_ID}, NEW.id, NEW.patient_id, {new}, UPPER(NEW.payment_method), 'CORRECTION', {CHANGED_AT}, date({CHANGED_AT}, 'localtime')
               WHERE {new} <> 0;
             END"
        ),
    ];
    for d in ddl {
        sqlx::query(&d).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Columns for the server-computed day close; older rows keep NULLs.
async fn extend_day_close_protocol(pool: &SqlitePool) -> Result<(), AppError> {
    if !table_exists(pool, "day_close_protocol").await? {
        return Ok(());
    }
    for (col, ty) in [
        ("status", "TEXT NOT NULL DEFAULT 'FINAL'"),
        ("period_from", "TEXT"),
        ("opening_cents", "INTEGER"),
        ("cash_receipts_cents", "INTEGER"),
        ("cash_movements_cents", "INTEGER"),
        ("expected_cents", "INTEGER"),
        ("counted_cents", "INTEGER"),
        ("variance_cents", "INTEGER"),
        ("card_cents", "INTEGER"),
        ("card_terminal_cents", "INTEGER"),
        ("transfer_cents", "INTEGER"),
        ("other_cents", "INTEGER"),
        ("receipt_count", "INTEGER"),
        ("denominations_json", "TEXT"),
        ("closed_by", "TEXT"),
        ("closed_by_name", "TEXT"),
        ("document_id", "TEXT"),
        ("document_number", "TEXT"),
        ("corrects_id", "TEXT"),
    ] {
        if !column_exists(pool, "day_close_protocol", col).await? {
            sqlx::query(&format!(
                "ALTER TABLE day_close_protocol ADD COLUMN {col} {ty}"
            ))
            .execute(pool)
            .await?;
        }
    }
    // On an old database this can run before the sync migration adds `updated_at`.
    let stamp = if column_exists(pool, "day_close_protocol", "updated_at").await? {
        ", updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"
    } else {
        ""
    };
    let mut tx = pool.begin().await?;
    // Old data may hold several runs for one date; keep the newest as FINAL.
    // sync: recorded by caller is not needed — this schema migration runs on every device
    // against its own copy, so each device reaches the same state without replicating it.
    sqlx::query(&format!(
        "UPDATE day_close_protocol SET status = 'CORRECTED'{stamp}
          WHERE status = 'FINAL' AND id NOT IN (
                SELECT id FROM (
                  SELECT id, ROW_NUMBER() OVER (PARTITION BY as_of_date ORDER BY recorded_at DESC, id DESC) AS rn
                    FROM day_close_protocol WHERE status = 'FINAL')
                 WHERE rn = 1)"
    ))
    .execute(&mut *tx)
    .await?;
    for ddl in [
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_day_close_final_date
            ON day_close_protocol(as_of_date) WHERE status = 'FINAL'",
        // GoBD: a recorded closing is never edited or deleted. The only
        // allowed change is FINAL → CORRECTED when a correction is recorded.
        "CREATE TRIGGER IF NOT EXISTS trg_day_close_no_delete
         BEFORE DELETE ON day_close_protocol
         WHEN OLD.recorded_at > strftime('%Y-%m-%d', 'now', '-10 years')
         BEGIN SELECT RAISE(ABORT, 'error.day_close.immutable'); END",
        "CREATE TRIGGER IF NOT EXISTS trg_day_close_no_update
         BEFORE UPDATE ON day_close_protocol
         WHEN (NEW.status IS NOT OLD.status AND NOT (OLD.status = 'FINAL' AND NEW.status = 'CORRECTED'))
            OR (OLD.document_id IS NOT NULL AND NEW.document_id IS NOT OLD.document_id)
            OR NEW.as_of_date IS NOT OLD.as_of_date
            OR NEW.counted_eur IS NOT OLD.counted_eur
            OR NEW.system_cash_eur IS NOT OLD.system_cash_eur
            OR NEW.counted_cents IS NOT OLD.counted_cents
            OR NEW.expected_cents IS NOT OLD.expected_cents
            OR NEW.variance_cents IS NOT OLD.variance_cents
            OR NEW.note IS NOT OLD.note
         BEGIN SELECT RAISE(ABORT, 'error.day_close.immutable'); END",
    ] {
        sqlx::query(ddl).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    Ok(())
}

/// Bring the journal in line with the current payment rows. Normally a
/// no-op; books differences caused by writes that bypassed the triggers.
/// Returns the number of lines added.
pub async fn reconcile(pool: &SqlitePool) -> Result<u64, AppError> {
    let eff = effective_cents("p");
    let sql = format!(
        "INSERT INTO payment_receipt (id, payment_id, patient_id, amount_cents, method, kind, received_at, local_day)
         SELECT {NEW_ID}, x.id, x.patient_id, x.eff - x.j, x.method,
                CASE WHEN x.n = 0 THEN 'BACKFILL' ELSE 'CORRECTION' END,
                CASE WHEN x.n = 0 THEN x.created_at ELSE {NOW_UTC} END,
                date(CASE WHEN x.n = 0 THEN x.created_at ELSE {NOW_UTC} END, 'localtime')
           FROM (SELECT p.id, p.patient_id, UPPER(p.payment_method) AS method,
                        COALESCE(p.created_at, {NOW_UTC}) AS created_at,
                        {eff} AS eff,
                        COALESCE((SELECT SUM(r.amount_cents) FROM payment_receipt r WHERE r.payment_id = p.id), 0) AS j,
                        (SELECT COUNT(*) FROM payment_receipt r WHERE r.payment_id = p.id) AS n
                   FROM payment p) x
          WHERE x.eff <> x.j"
    );
    Ok(sqlx::query(&sql).execute(pool).await?.rows_affected())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

    async fn pool() -> SqlitePool {
        let pool = test_memory_pool().await.unwrap();
        run_migrations(&pool).await.unwrap();
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status) VALUES ('p1','A','1990-01-01','FEMALE','X1','ACTIVE')",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn journal(pool: &SqlitePool, id: &str) -> Vec<(i64, String, String)> {
        sqlx::query_as(
            "SELECT amount_cents, method, kind FROM payment_receipt WHERE payment_id = ?1 ORDER BY rowid",
        )
        .bind(id)
        .fetch_all(pool)
        .await
        .unwrap()
    }

    #[tokio::test]
    async fn every_money_movement_is_journaled() {
        let pool = pool().await;
        ensure(&pool).await.unwrap();
        ensure(&pool).await.unwrap(); // idempotent
        let q = |sql: &'static str| sqlx::query(sql);
        // 0 € placeholder: nothing received yet.
        q("INSERT INTO payment (id, patient_id, amount, payment_method, status, amount_expected) VALUES ('z1','p1',0,'CASH','OUTSTANDING',100)")
            .execute(&pool).await.unwrap();
        assert!(journal(&pool, "z1").await.is_empty());
        // Placeholder filled with 40 €, then raised to 100 €.
        q("UPDATE payment SET amount = 40, status = 'PARTIALLY_PAID' WHERE id = 'z1'")
            .execute(&pool)
            .await
            .unwrap();
        q("UPDATE payment SET amount = 100, status = 'PAID' WHERE id = 'z1'")
            .execute(&pool)
            .await
            .unwrap();
        // Paid by card instead.
        q("UPDATE payment SET payment_method = 'CARD' WHERE id = 'z1'")
            .execute(&pool)
            .await
            .unwrap();
        // Cancelled.
        q("UPDATE payment SET status = 'CANCELLED' WHERE id = 'z1'")
            .execute(&pool)
            .await
            .unwrap();
        let j = journal(&pool, "z1").await;
        assert_eq!(
            j,
            vec![
                (4000, "CASH".into(), "RECEIPT".into()),
                (6000, "CASH".into(), "RECEIPT".into()),
                (-10000, "CASH".into(), "CORRECTION".into()),
                (10000, "CARD".into(), "CORRECTION".into()),
                (-10000, "CARD".into(), "REVERSAL".into()),
            ]
        );
        assert_eq!(
            reconcile(&pool).await.unwrap(),
            0,
            "triggers kept the journal exact"
        );
        // Journal is append-only.
        assert!(q("UPDATE payment_receipt SET amount_cents = 1")
            .execute(&pool)
            .await
            .is_err());
        assert!(q("DELETE FROM payment_receipt")
            .execute(&pool)
            .await
            .is_err());
    }

    #[tokio::test]
    async fn existing_payments_are_backfilled_and_paid_rows_cannot_be_deleted() {
        let pool = pool().await;
        sqlx::query("INSERT INTO payment (id, patient_id, amount, payment_method, status) VALUES ('old','p1',55.5,'CASH','PAID')")
            .execute(&pool).await.unwrap();
        ensure(&pool).await.unwrap();
        assert_eq!(
            journal(&pool, "old").await,
            vec![(5550, "CASH".into(), "BACKFILL".into())]
        );
        assert!(sqlx::query("DELETE FROM payment WHERE id = 'old'")
            .execute(&pool)
            .await
            .is_err());
    }
}
