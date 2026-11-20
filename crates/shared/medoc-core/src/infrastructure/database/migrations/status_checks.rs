//! F144: widen `status` CHECK constraints on databases created before the
//! new status values existed.

use crate::error::AppError;
use regex::Regex;
use sqlx::{Connection, SqliteConnection, SqlitePool};

/// (table, column, full list of allowed values after the upgrade)
pub const STATUS_CHECKS: &[(&str, &str, &[&str])] = &[
    (
        "patient",
        "status",
        &["NEW", "ACTIVE", "VALIDATED", "READONLY", "ARCHIVED"],
    ),
    (
        "patient_chart",
        "status",
        &["DRAFT", "IN_PROGRESS", "VALIDATED", "READONLY", "DECLINED"],
    ),
    (
        "appointment",
        "status",
        &[
            "PLANNED",
            "CONFIRMED",
            "IN_PROGRESS",
            "COMPLETED",
            "NO_SHOW",
            "CANCELLED",
        ],
    ),
];

pub async fn widen_status_checks(pool: &SqlitePool) -> Result<(), AppError> {
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    for (table, column, values) in STATUS_CHECKS {
        widen_one(&mut conn, table, column, values).await?;
    }
    Ok(())
}

/// Returns the CREATE TABLE text with the CHECK list on `column` replaced, or
/// `None` when the table has no CHECK on that column or already allows every value.
pub fn rewrite_check(create_sql: &str, column: &str, values: &[&str]) -> Option<String> {
    let re = Regex::new(&format!(
        r#"(?is)CHECK\s*\(\s*"?{col}"?\s+IN\s*\(([^)]*)\)\s*\)"#,
        col = regex::escape(column)
    ))
    .ok()?;
    let caps = re.captures(create_sql)?;
    let current: Vec<String> = caps
        .get(1)?
        .as_str()
        .split(',')
        .map(|v| v.trim().trim_matches('\'').trim_matches('"').to_string())
        .collect();
    if values.iter().all(|v| current.iter().any(|c| c == v)) {
        return None;
    }
    let mut merged: Vec<String> = values.iter().map(|v| v.to_string()).collect();
    for c in current {
        if !c.is_empty() && !merged.contains(&c) {
            merged.push(c);
        }
    }
    let list = merged
        .iter()
        .map(|v| format!("'{v}'"))
        .collect::<Vec<_>>()
        .join(",");
    let whole = caps.get(0)?;
    let mut out = String::with_capacity(create_sql.len() + 32);
    out.push_str(&create_sql[..whole.start()]);
    out.push_str(&format!("CHECK ({column} IN ({list}))"));
    out.push_str(&create_sql[whole.end()..]);
    Some(out)
}

async fn widen_one(
    conn: &mut SqliteConnection,
    table: &str,
    column: &str,
    values: &[&str],
) -> Result<(), AppError> {
    let create_sql: Option<String> =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .bind(table)
            .fetch_optional(&mut *conn)
            .await
            .map_err(AppError::Database)?;
    let Some(create_sql) = create_sql else {
        return Ok(());
    };
    let Some(new_sql) = rewrite_check(&create_sql, column, values) else {
        return Ok(());
    };
    rebuild_table_on_conn(conn, table, &new_sql, "STATUS_CHECK_WIDENED").await?;
    tracing::info!(
        target: "medoc::migration",
        event = "STATUS_CHECK_WIDENED",
        table = table,
        column = column
    );
    Ok(())
}

pub async fn rebuild_table_from_sql(
    pool: &SqlitePool,
    table: &str,
    new_sql: &str,
) -> Result<(), AppError> {
    let mut conn = pool.acquire().await.map_err(AppError::Database)?;
    rebuild_table_on_conn(&mut conn, table, new_sql, "TABLE_REBUILD").await
}

async fn rebuild_table_on_conn(
    conn: &mut SqliteConnection,
    table: &str,
    new_sql: &str,
    event: &str,
) -> Result<(), AppError> {
    let tmp = format!("{table}__status_upgrade");
    let name_re = Regex::new(&format!(
        r#"(?i)^\s*CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?["'`]?{}["'`]?"#,
        regex::escape(table)
    ))
    .map_err(|e| AppError::Internal(e.to_string()))?;
    if !name_re.is_match(&new_sql) {
        return Err(AppError::Internal(format!(
            "status CHECK upgrade: cannot parse CREATE TABLE for {table}"
        )));
    }
    let tmp_sql = name_re
        .replace(&new_sql, format!("CREATE TABLE \"{tmp}\""))
        .into_owned();

    let side_sql: Vec<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master
         WHERE tbl_name = ?1 AND type IN ('index','trigger') AND sql IS NOT NULL",
    )
    .bind(table)
    .fetch_all(&mut *conn)
    .await
    .map_err(AppError::Database)?;

    let cols: Vec<String> = sqlx::query_scalar("SELECT name FROM pragma_table_info(?1)")
        .bind(table)
        .fetch_all(&mut *conn)
        .await
        .map_err(AppError::Database)?;
    let col_list = cols
        .iter()
        .map(|c| format!("\"{c}\""))
        .collect::<Vec<_>>()
        .join(", ");

    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database)?;

    let result: Result<(), AppError> = async {
        let mut tx = conn.begin().await.map_err(AppError::Database)?;
        sqlx::query(&format!("DROP TABLE IF EXISTS \"{tmp}\""))
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(&tmp_sql)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(&format!(
            "INSERT INTO \"{tmp}\" ({col_list}) SELECT {col_list} FROM \"{table}\""
        ))
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(&format!("DROP TABLE \"{table}\""))
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(&format!("ALTER TABLE \"{tmp}\" RENAME TO \"{table}\""))
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        for sql in &side_sql {
            sqlx::query(sql)
                .execute(&mut *tx)
                .await
                .map_err(AppError::Database)?;
        }
        if !table.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
            return Err(AppError::Internal(format!(
                "status CHECK upgrade: unexpected table name {table}"
            )));
        }
        // Only the rebuilt table. A whole-database check also counts older
        // orphans in other tables and blocks this upgrade.
        let fk_bad: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM pragma_foreign_key_check('{table}')"
        ))
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        if fk_bad > 0 {
            return Err(AppError::Internal(format!(
                "status CHECK upgrade of {table}: {fk_bad} foreign key violations"
            )));
        }
        tx.commit().await.map_err(AppError::Database)?;
        Ok(())
    }
    .await;

    let restore = sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&mut *conn)
        .await
        .map_err(AppError::Database);
    result?;
    restore?;
    tracing::info!(
        target: "medoc::migration",
        event = event,
        table = table
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::rewrite_check;

    #[test]
    fn adds_missing_value_and_keeps_rest_of_ddl() {
        let sql = "CREATE TABLE patient (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACTIVE','VALIDATED','READONLY')), x TEXT REFERENCES staff(id))";
        let out = rewrite_check(
            sql,
            "status",
            &["NEW", "ACTIVE", "VALIDATED", "READONLY", "ARCHIVED"],
        )
        .expect("rewritten");
        assert!(out.contains("'ARCHIVED'"));
        assert!(out.contains("REFERENCES staff(id)"));
        assert!(out.contains("DEFAULT 'NEW'"));
    }

    #[test]
    fn already_wide_list_is_left_alone() {
        let sql = "CREATE TABLE patient (status TEXT CHECK (status IN ('NEW','ARCHIVED')))";
        assert!(rewrite_check(sql, "status", &["NEW", "ARCHIVED"]).is_none());
    }

    #[test]
    fn unknown_old_values_are_kept() {
        let sql = "CREATE TABLE a (status TEXT CHECK (status IN ('PLANNED','LEGACY')))";
        let out = rewrite_check(sql, "status", &["PLANNED", "IN_PROGRESS"]).unwrap();
        assert!(out.contains("'LEGACY'"));
        assert!(out.contains("'IN_PROGRESS'"));
    }
}
