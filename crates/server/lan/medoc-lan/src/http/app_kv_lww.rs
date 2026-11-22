//! Last-writer-wins for setting writes a LAN web client queued while it was offline.
//!
//! The client sends the time of the edit (`editedAt`) when it replays its queue. If the stored
//! value changed after that (another device or person wrote later), the queued write is older
//! and must not overwrite it: the route answers 409 and the client drops that write.

use chrono::{DateTime, NaiveDateTime, Utc};
use sqlx::SqlitePool;

/// `true` when the stored value was written after `edited_at`.
pub async fn offline_write_is_stale(pool: &SqlitePool, key: &str, edited_at: Option<&str>) -> bool {
    let Some(edited) = edited_at.and_then(|s| DateTime::parse_from_rfc3339(s.trim()).ok()) else {
        return false;
    };
    let stored: Option<String> =
        sqlx::query_scalar("SELECT CAST(updated_at AS TEXT) FROM app_kv WHERE key = ?1")
            .bind(key)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    stored
        .as_deref()
        .and_then(parse_sqlite_utc)
        .is_some_and(|stored| stored > edited.with_timezone(&Utc))
}

/// `CURRENT_TIMESTAMP` text (`YYYY-MM-DD HH:MM:SS`, UTC) or RFC 3339.
fn parse_sqlite_utc(s: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc));
    }
    NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f")
        .ok()
        .map(|n| n.and_utc())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn older_offline_write_is_stale_newer_is_not() {
        let pool = medoc_core::infrastructure::database::connection::test_memory_pool()
            .await
            .unwrap();
        medoc_core::infrastructure::database::connection::run_migrations(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES ('k', 'v', '2026-11-22 10:00:00')",
        )
        .execute(&pool)
        .await
        .unwrap();
        assert!(offline_write_is_stale(&pool, "k", Some("2026-11-22T09:59:00Z")).await);
        assert!(!offline_write_is_stale(&pool, "k", Some("2026-11-22T10:01:00Z")).await);
        assert!(!offline_write_is_stale(&pool, "k", None).await);
        assert!(!offline_write_is_stale(&pool, "missing", Some("2000-01-01T00:00:00Z")).await);
    }
}
