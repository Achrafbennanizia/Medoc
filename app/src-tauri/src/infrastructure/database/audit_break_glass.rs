//! Links in-memory break-glass grants to audit row metadata.

use std::sync::{Arc, OnceLock};

use crate::application::break_glass::BreakGlassState;

static BREAK_GLASS: OnceLock<Arc<BreakGlassState>> = OnceLock::new();

pub fn register_break_glass(state: Arc<BreakGlassState>) {
    let _ = BREAK_GLASS.set(state);
}

pub fn break_glass_meta_for_audit(
    user_id: &str,
    entity: &str,
    entity_id: Option<&str>,
) -> (bool, Option<String>) {
    let Some(bg) = BREAK_GLASS.get() else {
        return (false, None);
    };
    if let Some(reason) = bg.audit_context_for(user_id, entity, entity_id) {
        (true, Some(reason))
    } else {
        (false, None)
    }
}
