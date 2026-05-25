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
