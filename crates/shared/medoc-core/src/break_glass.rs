// Break-glass emergency access (NFA-SEC-EMERGENCY).
//
// Allows an Physician to acknowledge an emergency and perform read-only access
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
        let mut version = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut version);
        version.push(grant);
    }

    pub fn is_active(&self, user_id: &str, patient_id: Option<&str>) -> bool {
        self.audit_context_for(user_id, "Patient", patient_id)
            .is_some()
    }

    /// Active break-glass reason for an audit row (`user_id` + entity context).
    pub fn audit_context_for(
        &self,
        user_id: &str,
        entity: &str,
        entity_id: Option<&str>,
    ) -> Option<String> {
        let mut version = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut version);
        version.iter()
            .find(|g| g.user_id == user_id && grant_matches_audit(g, entity, entity_id))
            .map(|g| g.reason.clone())
    }

    pub fn list(&self) -> Vec<BreakGlassGrant> {
        let mut version = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        self.prune(&mut version);
        version.clone()
    }

    fn prune(&self, version: &mut Vec<BreakGlassGrant>) {
        let now = Instant::now();
        version.retain(|g| now.duration_since(g.granted_at) < BREAK_GLASS_DURATION);
    }
}

fn grant_matches_audit(g: &BreakGlassGrant, entity: &str, entity_id: Option<&str>) -> bool {
    match &g.patient_id {
        None => true,
        Some(pid) => {
            entity_id == Some(pid.as_str())
                || (entity == "Patient" && entity_id == Some(pid.as_str()))
        }
    }
}
