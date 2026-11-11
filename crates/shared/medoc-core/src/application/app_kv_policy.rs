//! Single source of truth for which `app_kv` keys exist and which RBAC permission guards writes.
//! Used by [`crate::commands::app_kv_commands`] and the LAN HTTP API (`lan_server::http`).

const APPOINTMENT_DRAFT_PREFIX: &str = "appointment.draft.v1.";

/// Returns `Some(permission_action)` for keys that may be written only by roles matching `rbac::allowed`.
/// `None` means the key is unknown (reject).
/// Reads and writes both use the permission returned here.
/// Read permission. Time zone is readable by every signed-in role.
pub fn read_permission_for_app_kv_key(key: &str) -> Option<&'static str> {
    if key == "practice.timezone.v1" {
        return Some("dashboard.read");
    }
    // The calendar draws these on every signed-in role. Writing hours and
    // closures stays with the practice admin.
    if matches!(
        key,
        "practice.work_hours.v1"
            | "practice.blockedTimes.v1"
            | "practice.calendar-workflows.v1"
            | "practice.header_privacy.v1"
            | "invoice.practice.v1"
    ) {
        return Some("dashboard.read");
    }
    // F32: every signed-in role sees the work plan (work-time page, calendar);
    // writing it still needs `staff.write`.
    if key.starts_with("staff.work_plan.v1.") && permission_for_app_kv_key(key).is_some() {
        return Some("dashboard.read");
    }
    permission_for_app_kv_key(key)
}

pub fn permission_for_app_kv_key(key: &str) -> Option<&'static str> {
    if let Some(draft_id) = key.strip_prefix(APPOINTMENT_DRAFT_PREFIX) {
        return is_safe_appointment_draft_id(draft_id).then_some("appointment.write");
    }
    if let Some(staff_id) = key.strip_prefix("staff.work_plan.v1.") {
        return is_safe_appointment_draft_id(staff_id).then_some("staff.write");
    }
    match key {
        "practice.work_hours.v1" | "practice.blockedTimes.v1" | "practice.header_privacy.v1" => {
            Some("ops.system")
        }
        "practice.preferences.v1" | "practice.preferences-appointment.v1" => Some("dashboard.read"),
        "export.path.v1"
        | "export.formats.v1"
        | "practice.logo.v1"
        | "invoice.practice.v1"
        | "documents.locale.v1" => Some("ops.system"),
        // Whoever can change an appointment can change how the calendar behaves,
        // and that row syncs to the other device.
        "practice.calendar-workflows.v1" => Some("appointment.write"),
        "lan.server.config.v1" | "practice.timezone.v1" => Some("ops.system"),
        "pairing.enabled.v1"
        | "network.hidden.v1"
        | "sync.deployment.v1"
        | "company.portal.config.v1" => Some("ops.system"),
        key if key.starts_with("onboarding.progress.v1.") => Some("dashboard.read"),
        _ => None,
    }
}

fn is_safe_appointment_draft_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkHoursBlob {
    plan: serde_json::Value,
    #[serde(default)]
    _break_from: Option<String>,
    #[serde(default)]
    _break_until: Option<String>,
    #[serde(default)]
    _slot_min: Option<String>,
}

/// F110: reject malformed `practice.work_hours.v1` JSON.
pub fn validate_app_kv_value(key: &str, value: &str) -> Result<(), crate::error::AppError> {
    if key == "practice.work_hours.v1" {
        let parsed: WorkHoursBlob = serde_json::from_str(value).map_err(|_| {
            crate::error::AppError::Validation("Stored work hours are invalid".into())
        })?;
        if !parsed.plan.is_object() {
            return Err(crate::error::AppError::Validation(
                "Stored work hours are invalid".into(),
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn work_plan_is_readable_by_everyone_and_writable_with_staff_write() {
        assert_eq!(
            read_permission_for_app_kv_key("staff.work_plan.v1.seed-rez-001"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("staff.work_plan.v1.seed-rez-001"),
            Some("staff.write")
        );
        assert_eq!(
            read_permission_for_app_kv_key("staff.work_plan.v1.bad id"),
            None
        );
    }

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
    fn invoice_profile_requires_ops_system() {
        assert_eq!(
            permission_for_app_kv_key("invoice.practice.v1"),
            Some("ops.system")
        );
        assert_eq!(
            permission_for_app_kv_key("export.path.v1"),
            Some("ops.system")
        );
        assert_eq!(
            permission_for_app_kv_key("practice.logo.v1"),
            Some("ops.system")
        );
        assert_eq!(
            permission_for_app_kv_key("practice.calendar-workflows.v1"),
            Some("appointment.write")
        );
        assert_eq!(
            read_permission_for_app_kv_key("practice.calendar-workflows.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            read_permission_for_app_kv_key("practice.work_hours.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("practice.work_hours.v1"),
            Some("ops.system")
        );
        assert_eq!(
            read_permission_for_app_kv_key("practice.header_privacy.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("practice.header_privacy.v1"),
            Some("ops.system")
        );
        assert_eq!(
            read_permission_for_app_kv_key("invoice.practice.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("invoice.practice.v1"),
            Some("ops.system")
        );
        assert_eq!(
            read_permission_for_app_kv_key("practice.blockedTimes.v1"),
            Some("dashboard.read")
        );
        assert_eq!(
            permission_for_app_kv_key("documents.locale.v1"),
            Some("ops.system")
        );
    }

    #[test]
    fn staff_work_plan_prefix_whitelisted() {
        assert_eq!(
            permission_for_app_kv_key("staff.work_plan.v1.seed-physician-001"),
            Some("staff.write")
        );
        assert!(permission_for_app_kv_key("staff.work_plan.v1.").is_none());
    }

    #[test]
    fn invalid_work_hours_are_rejected() {
        assert!(validate_app_kv_value("practice.work_hours.v1", "not-json").is_err());
        assert!(validate_app_kv_value(
            "practice.work_hours.v1",
            r#"{"plan":{"mo":{"active":true,"segments":[]}}}"#
        )
        .is_ok());
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
