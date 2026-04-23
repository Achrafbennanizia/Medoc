// Break-glass emergency access (NFA-SEC-EMERGENCY).
//
// Allows an Arzt to acknowledge an emergency and perform read-only access
// to medical records that would otherwise be restricted (e.g. accessing a
// patient outside the assigned doctor's caseload). Every break-glass event
// is recorded in the audit log + security log and times out automatically.

use std::sync::Mutex;
use std::time::{Duration, Instant};

const BREAK_GLASS_DURATION: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone)]
pub struct BreakGlassGrant {
    pub user_id: String,
    pub reason: String,
    pub patient_id: Option<String>,
    pub granted_at: Instant,
}

#[derive(Default)]
pub struct BreakGlassState {
    inner: Mutex<Vec<BreakGlassGrant>>,
}

impl BreakGlassState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn grant(&self, grant: BreakGlassGrant) {
        let mut v = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut v);
        v.push(grant);
    }

    pub fn is_active(&self, user_id: &str, patient_id: Option<&str>) -> bool {
        let mut v = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut v);
        v.iter().any(|g| {
            g.user_id == user_id
                && match (&g.patient_id, patient_id) {
                    (None, _) => true,
                    (Some(a), Some(b)) => a == b,
                    (Some(_), None) => false,
                }
        })
    }

    pub fn list(&self) -> Vec<BreakGlassGrant> {
        let mut v = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut v);
        v.clone()
    }

    fn prune(&self, v: &mut Vec<BreakGlassGrant>) {
        let now = Instant::now();
        v.retain(|g| now.duration_since(g.granted_at) < BREAK_GLASS_DURATION);
    }
}
