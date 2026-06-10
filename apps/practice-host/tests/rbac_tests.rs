use medoc_lib::application::auth_service::PermissionOverride;
use medoc_lib::application::rbac::{allowed, effective_allowed, Role};

#[test]
fn role_parse_round_trip() {
    assert_eq!(Role::parse("ARZT"), Some(Role::Arzt));
    assert_eq!(Role::parse("REZEPTION"), Some(Role::Rezeption));
    assert_eq!(Role::parse("STEUERBERATER"), Some(Role::Steuerberater));
    assert_eq!(Role::parse("PHARMABERATER"), Some(Role::Pharmaberater));
    assert_eq!(Role::parse("HACKER"), None);
}

#[test]
fn arzt_can_do_everything_clinical_and_admin() {
    for action in [
        "patient.read_medical",
        "patient.write_medical",
        "patient.write",
        "termin.write",
        "termin.list_aerzte",
        "personal.write",
        "audit.read",
        "ops.backup",
        "ops.dsgvo",
        "ops.logs",
        "dashboard.read",
        "finanzen.write",
    ] {
        assert!(
            allowed(action, Role::Arzt),
            "Arzt should be allowed {action}"
        );
    }
}

#[test]
fn rezeption_cannot_read_medical_records_or_audit() {
    assert!(!allowed("patient.read_medical", Role::Rezeption));
    assert!(!allowed("patient.write_medical", Role::Rezeption));
    assert!(allowed("patient.read_documents", Role::Rezeption));
    assert!(!allowed("audit.read", Role::Rezeption));
    assert!(!allowed("personal.read", Role::Rezeption));
    assert!(!allowed("verwaltung.team.read", Role::Rezeption));
    assert!(!allowed("verwaltung.praxisplanung.read", Role::Rezeption));
    assert!(!allowed("verwaltung.praxisplanung.write", Role::Rezeption));
    assert!(!allowed("ops.backup", Role::Rezeption));
    assert!(allowed("termin.list_aerzte", Role::Rezeption));
    assert!(!allowed("verwaltung.read", Role::Rezeption));
    assert!(allowed("verwaltung.kataloge.read", Role::Rezeption));
    assert!(!allowed("verwaltung.vorlagen.read", Role::Rezeption));
}

// TODO(deferred-roles): re-enable steuerberater_only_finanzen — docs/coordination/todos-deferred-roles.md
// TODO(deferred-roles): re-enable pharmaberater_only_inventory

#[test]
fn all_roles_can_read_dashboard_aggregates() {
    for role in [Role::Arzt, Role::Rezeption] {
        assert!(
            allowed("dashboard.read", role),
            "{role:?} should see dashboard KPIs"
        );
    }
}

#[test]
fn ops_logs_arzt_only() {
    assert!(allowed("ops.logs", Role::Arzt));
    assert!(!allowed("ops.logs", Role::Rezeption));
}

#[test]
fn unknown_action_denied_by_default() {
    assert!(!allowed("evil.shell", Role::Arzt));
    assert!(!allowed("", Role::Arzt));
}

#[test]
fn effective_allow_grants_action_denied_by_role() {
    let o = vec![PermissionOverride {
        action: "audit.read".into(),
        effect: "ALLOW".into(),
    }];
    assert!(!allowed("audit.read", Role::Rezeption));
    assert!(effective_allowed("audit.read", Role::Rezeption, &o));
}

#[test]
fn effective_deny_blocks_action_allowed_by_role() {
    let o = vec![PermissionOverride {
        action: "dashboard.read".into(),
        effect: "DENY".into(),
    }];
    assert!(allowed("dashboard.read", Role::Rezeption));
    assert!(!effective_allowed("dashboard.read", Role::Rezeption, &o));
}
