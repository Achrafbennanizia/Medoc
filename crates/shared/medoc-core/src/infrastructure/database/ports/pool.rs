//! Shared database pool abstraction (portable across Tauri + headless binaries).

use sqlx::SqlitePool;

/// Minimal port implemented by [`SqlitePool`] and wrappers (DIP).
pub trait DatabasePool: Send + Sync {
    fn pool(&self) -> &SqlitePool;
}

impl DatabasePool for SqlitePool {
    fn pool(&self) -> &SqlitePool {
        self
    }
}

impl DatabasePool for &SqlitePool {
    fn pool(&self) -> &SqlitePool {
        self
    }
}

/// Newtype for explicit injection in services/tests.
#[derive(Clone, Copy)]
pub struct SqlitePoolHandle<'a>(pub &'a SqlitePool);

impl DatabasePool for SqlitePoolHandle<'_> {
    fn pool(&self) -> &SqlitePool {
        self.0
    }
}
