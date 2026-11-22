//! Classify SQLite errors in one place, so every retry and every sync rule reads them the same way.

use crate::error::AppError;

/// A foreign-key constraint failed (SQLite extended code 787): the referenced row is not there yet.
pub fn is_foreign_key_error(err: &AppError) -> bool {
    match err {
        AppError::Database(sqlx::Error::Database(db)) => {
            db.code().is_some_and(|code| code == "787") || db.message().contains("FOREIGN KEY")
        }
        _ => false,
    }
}

/// The database is locked or busy (SQLITE_BUSY = 5, SQLITE_LOCKED = 6): worth a short retry.
pub fn is_sqlite_busy(err: &AppError) -> bool {
    let s = err.to_string().to_lowercase();
    s.contains("database is locked")
        || s.contains("database is busy")
        || s.contains("(code: 5)")
        || s.contains("(code: 6)")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn busy_and_locked_are_recognised_from_the_message() {
        assert!(is_sqlite_busy(&AppError::Internal(
            "database is locked".into()
        )));
        assert!(!is_sqlite_busy(&AppError::Internal("no such table".into())));
    }

    #[test]
    fn non_database_errors_are_not_foreign_key_errors() {
        assert!(!is_foreign_key_error(&AppError::Validation(
            "FOREIGN KEY".into()
        )));
    }
}
