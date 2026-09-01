//! Single source of truth for which `app_kv` keys exist and which RBAC permission guards writes.
//! Used by [`crate::commands::app_kv_commands`] and the LAN HTTP API (`lan_server::http`).

const APPOINTMENT_DRAFT_PREFIX: &str = "appointment.draft.v1.";

/// Returns `Some(permission_action)` for keys that may be written only by roles matching `rbac::allowed`.
/// `None` means the key is unknown (reject).
/// Reads (`get_app_kv`): any authenticated user may access whitelisted keys (same as Tauri commands).
pub fn permission_for_app_kv_key(key: &str) -> Option<&'static str> {
    if let Some(draft_id) = key.strip_prefix(APPOINTMENT_DRAFT_PREFIX) {
        return is_safe_appointment_draft_id(draft_id).then_some("appointment.write");
    }
    match key {
        "practice.work_hours.v1" | "practice.blockedTimes.v1" => Some("ops.system"),
        "practice.preferences.v1" | "practice.preferences-appointment.v1" => {
            Some("dashboard.read")
        }
        "export.path.v1" | "export.formats.v1" | "practice.logo.v1" | "invoice.practice.v1" => {
            Some("dashboard.read")
        }
        "lan.server.config.v1" => Some("ops.system"),
        "pairing.enabled.v1" | "sync.deployment.v1" => Some("ops.system"),
        key if key.starts_with("onboarding.progress.v1.") => Some("dashboard.read"),
        _ => None,
    }
}

fn is_safe_appointment_draft_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn appointment_draft_prefix_whitelisted() {
        let key = "appointment.draft.v1.550e8400-e29b-41d4-a716-446655440000";
        assert_eq!(permission_for_app_kv_key(key), Some("appointment.write"));
    }

    #[test]
    fn appointment_draft_rejects_path_traversal() {
        assert!(permission_for_app_kv_key("appointment.draft.v1.../etc").is_none());
        assert!(permission_for_app_kv_key("appointment.draft.v1.").is_none());
    }

    #[test]
    fn onboarding_progress_whitelisted() {
        assert_eq!(
            permission_for_app_kv_key("onboarding.progress.v1.physician"),
            Some("dashboard.read")
        );
    }

    #[test]
    fn practice_preferences_english_key_whitelisted() {
        assert_eq!(
            permission_for_app_kv_key("practice.preferences.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("practice.preferences.v1"),
            Some("dashboard.read")
        );
    }
}
