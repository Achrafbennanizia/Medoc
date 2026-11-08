//! Startup audit-chain integrity gate for `ops.*` commands (TASK 2.5).

use std::sync::{Arc, Mutex, OnceLock};

static GUARD: OnceLock<Arc<AuditChainGuard>> = OnceLock::new();

pub fn register(guard: Arc<AuditChainGuard>) {
    let _ = GUARD.set(guard);
}

pub fn global() -> Option<&'static Arc<AuditChainGuard>> {
    GUARD.get()
}

pub fn blocks_ops() -> bool {
    global().is_some_and(|g| g.blocks_ops())
}

/// F100: acknowledgements are stored per broken row, so a restart does not
/// block `ops.*` again for a break an admin already acknowledged.
pub async fn ensure_ack_table(pool: &sqlx::SqlitePool) -> Result<(), crate::error::AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS audit_chain_ack (
            broken_row_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            acknowledged_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn save_ack(
    pool: &sqlx::SqlitePool,
    broken_row_id: &str,
    user_id: &str,
) -> Result<(), crate::error::AppError> {
    ensure_ack_table(pool).await?;
    sqlx::query(
        "INSERT OR REPLACE INTO audit_chain_ack (broken_row_id, user_id, acknowledged_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(broken_row_id)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn is_acked(pool: &sqlx::SqlitePool, broken_row_id: &str) -> Result<bool, crate::error::AppError> {
    ensure_ack_table(pool).await?;
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM audit_chain_ack WHERE broken_row_id = ?1")
        .bind(broken_row_id)
        .fetch_one(pool)
        .await?;
    Ok(n > 0)
}

#[derive(Debug, Default)]
pub struct AuditChainGuard {
    broken_at: Mutex<Option<String>>,
    acknowledged: Mutex<bool>,
}

impl AuditChainGuard {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_broken(&self, row_id: String) {
        *self.broken_at.lock().unwrap_or_else(|e| e.into_inner()) = Some(row_id);
        *self.acknowledged.lock().unwrap_or_else(|e| e.into_inner()) = false;
    }

    pub fn set_ok(&self) {
        *self.broken_at.lock().unwrap_or_else(|e| e.into_inner()) = None;
        *self.acknowledged.lock().unwrap_or_else(|e| e.into_inner()) = false;
    }

    pub fn acknowledge(&self) {
        *self.acknowledged.lock().unwrap_or_else(|e| e.into_inner()) = true;
    }

    pub fn broken_at(&self) -> Option<String> {
        self.broken_at
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone()
    }

    pub fn acknowledged(&self) -> bool {
        *self.acknowledged.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// True when `ops.*` must be blocked until an admin acknowledges the break.
    pub fn blocks_ops(&self) -> bool {
        self.broken_at().is_some() && !self.acknowledged()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_ops_until_acknowledged() {
        let g = AuditChainGuard::new();
        assert!(!g.blocks_ops());
        g.set_broken("row-1".into());
        assert!(g.blocks_ops());
        g.acknowledge();
        assert!(!g.blocks_ops());
        assert_eq!(g.broken_at().as_deref(), Some("row-1"));
    }
}

#[cfg(test)]
mod ack_tests {
    #[tokio::test]
    async fn ack_survives_restart() {
        let pool = crate::infrastructure::database::connection::test_memory_pool().await.unwrap();
        assert!(!super::is_acked(&pool, "row-7").await.unwrap());
        super::save_ack(&pool, "row-7", "seed-admin-001").await.unwrap();
        // A new guard (restart) consults the table.
        let g = super::AuditChainGuard::new();
        g.set_broken("row-7".into());
        if super::is_acked(&pool, "row-7").await.unwrap() {
            g.acknowledge();
        }
        assert!(!g.blocks_ops());
        assert!(!super::is_acked(&pool, "row-8").await.unwrap(), "a new break is not pre-acknowledged");
    }
}
