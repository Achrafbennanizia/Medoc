//! Repair: allow `patient_chart.status = 'DECLINED'`.
//!
//! The decline workflow (`chart_repo::decline_patient_chart_status`, `workflow_transitions.rs`) writes
//! `DECLINED`, but both schema paths (`0001_initial_schema.sql`, `legacy_embedded.rs`) created the table
//! with `CHECK (status IN ('DRAFT','IN_PROGRESS','VALIDATED','READONLY'))`, so every decline failed with
//! `CHECK constraint failed` (surfaced to users as a database error).
//!
//! SQLite cannot alter a CHECK constraint, so this follows the documented 12-step table rebuild
//! (<https://sqlite.org/lang_altertable.html#otheralter>) on ONE dedicated connection:
//! foreign keys off → transaction → copy into a new table built from the *current* DDL with the widened
//! CHECK → drop old → rename → recreate indexes/triggers → `foreign_key_check` → commit → foreign keys on.
//! Idempotent: skipped when the stored DDL already mentions `DECLINED`.

use sqlx::{Acquire, SqlitePool};

use crate::error::AppError;

const OLD_CHECK: &str = "'DRAFT','IN_PROGRESS','VALIDATED','READONLY'";
const NEW_CHECK: &str = "'DRAFT','IN_PROGRESS','VALIDATED','DECLINED','READONLY'";

pub async fn ensure_patient_chart_declined_status(pool: &SqlitePool) -> Result<(), AppError> {
    let ddl: Option<String> =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'patient_chart'")
            .fetch_optional(pool)
            .await?;
    let Some(ddl) = ddl else { return Ok(()) };
    if ddl.contains("DECLINED") {
        return Ok(());
    }
    let compact = ddl.replace([' ', '\n', '\t', '\r'], "");
    if !compact.contains(OLD_CHECK) {
        // Unknown shape — do not guess; leave the table untouched.
        crate::log_migration!(warn, event = "CHART_CHECK_REPAIR_SKIPPED", reason = "unexpected DDL");
        return Ok(());
    }
    let widened = widen_check(&ddl);
    let new_ddl = widened.replacen("patient_chart", "patient_chart__declined_fix", 1);

    let side_objects: Vec<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE tbl_name = 'patient_chart' AND type IN ('index','trigger') AND sql IS NOT NULL",
    )
    .fetch_all(pool)
    .await?;

    let mut conn = pool.acquire().await?;
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *conn).await?;
    let result: Result<(), AppError> = async {
        let mut tx = conn.begin().await?;
        sqlx::query("DROP TABLE IF EXISTS patient_chart__declined_fix").execute(&mut *tx).await?;
        sqlx::query(&new_ddl).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO patient_chart__declined_fix SELECT * FROM patient_chart")
            .execute(&mut *tx)
            .await?;
        sqlx::query("DROP TABLE patient_chart").execute(&mut *tx).await?;
        sqlx::query("ALTER TABLE patient_chart__declined_fix RENAME TO patient_chart")
            .execute(&mut *tx)
            .await?;
        for sql in &side_objects {
            sqlx::query(sql).execute(&mut *tx).await?;
        }
        let violations: Vec<(String,)> = sqlx::query_as("SELECT \"table\" FROM pragma_foreign_key_check")
            .fetch_all(&mut *tx)
            .await?;
        if !violations.is_empty() {
            return Err(AppError::Internal(format!(
                "patient_chart rebuild: {} foreign key violation(s)",
                violations.len()
            )));
        }
        tx.commit().await?;
        Ok(())
    }
    .await;
    sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *conn).await?;
    result?;
    crate::log_migration!(info, event = "CHART_CHECK_REPAIRED", allowed = NEW_CHECK);
    Ok(())
}

/// Insert `'DECLINED'` into the status CHECK list regardless of whitespace around the commas.
fn widen_check(ddl: &str) -> String {
    let needle = "'VALIDATED'";
    if let Some(pos) = ddl.find(needle) {
        let mut out = String::with_capacity(ddl.len() + 12);
        out.push_str(&ddl[..pos + needle.len()]);
        out.push_str(",'DECLINED'");
        out.push_str(&ddl[pos + needle.len()..]);
        return out;
    }
    ddl.to_string()
}

#[cfg(test)]
mod tests {
    use super::widen_check;

    #[test]
    fn widens_status_check() {
        let ddl = "CREATE TABLE patient_chart (status TEXT CHECK (status IN ('DRAFT','IN_PROGRESS','VALIDATED','READONLY')))";
        assert!(widen_check(ddl).contains("'VALIDATED','DECLINED','READONLY'"));
    }
}
