//! SQL binding helpers: unique-error check, table name check, JSON to SQL values (split from `merge.rs`).

use super::*;

/// UNIQUE (not primary key: the row was checked absent) constraint violation.
pub(super) fn is_unique_error(err: &AppError) -> bool {
    match err {
        AppError::Database(sqlx::Error::Database(db)) => {
            db.code().is_some_and(|code| code == "2067")
                || db.message().contains("UNIQUE constraint failed")
        }
        _ => false,
    }
}

pub(super) async fn bind_and_execute<'e, E>(
    executor: E,
    sql: &str,
    binds: &[Option<String>],
) -> Result<(), AppError>
where
    E: sqlx::Executor<'e, Database = sqlx::Sqlite>,
{
    let mut q = sqlx::query(sql);
    for b in binds {
        q = q.bind(b.clone());
    }
    q.execute(executor).await.map_err(AppError::Database)?;
    Ok(())
}

pub(super) fn sanitize_table(table: &str) -> Result<&str, AppError> {
    if crate::repo::is_synced_table(table) {
        Ok(table)
    } else {
        Err(AppError::Validation(format!(
            "sync entity_table not allow-listed: {table}"
        )))
    }
}

/// `None` binds as SQL NULL. An empty string is a real value and must not
/// stand in for JSON null: foreign keys reject `''`, and `IS NULL` filters
/// (unread notifications) stop matching.
pub(super) fn json_to_sql_value(version: &serde_json::Value) -> Option<String> {
    match version {
        serde_json::Value::Null => None,
        serde_json::Value::Bool(b) => Some(if *b { "1" } else { "0" }.into()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}
