use medoc_lib::application::auth_service::PermissionOverride;
use medoc_lib::application::rbac::{allowed, effective_allowed, Role};

#[test]
fn role_parse_round_trip() {
    assert_eq!(Role::parse("PHYSICIAN"), Some(Role::Physician));
    assert_eq!(Role::parse("RECEPTION"), Some(Role::Reception));
    assert_eq!(Role::parse("TAX_ADVISOR"), Some(Role::TaxAdvisor));
    assert_eq!(Role::parse("PHARMA_CONSULTANT"), Some(Role::PharmaConsultant));
    assert_eq!(Role::parse("HACKER"), None);
}

#[test]
fn physician_can_do_everything_clinical_and_admin() {
    for action in [
        "patient.read_medical",
        "patient.write_medical",
        "patient.write",
        "appointment.write",
        "appointment.list_physicians",
        "staff.write",
        "audit.read",
        "ops.backup",
        "ops.dsgvo",
        "ops.logs",
        "dashboard.read",
        "finance.write",
    ] {
        assert!(
            allowed(action, Role::Physician),
            "Physician should be allowed {action}"
        );
    }
}

#[test]
fn reception_cannot_read_medical_records_or_audit() {
    assert!(!allowed("patient.read_medical", Role::Reception));
    assert!(!allowed("patient.write_medical", Role::Reception));
    assert!(allowed("patient.read_documents", Role::Reception));
    assert!(!allowed("audit.read", Role::Reception));
    assert!(!allowed("staff.read", Role::Reception));
    assert!(!allowed("administration.team.read", Role::Reception));
    assert!(!allowed("administration.practice_planning.read", Role::Reception));
    assert!(!allowed("administration.practice_planning.write", Role::Reception));
    assert!(!allowed("ops.backup", Role::Reception));
    assert!(allowed("appointment.list_physicians", Role::Reception));
    assert!(!allowed("administration.read", Role::Reception));
    assert!(allowed("administration.catalogs.read", Role::Reception));
    assert!(!allowed("administration.templates.read", Role::Reception));
}

// TODO(deferred-roles): re-enable tax_advisor_only_finance — docs/coordination/todos-deferred-roles.md
// TODO(deferred-roles): re-enable pharma_consultant_only_inventory

#[test]
fn all_roles_can_read_dashboard_aggregates() {
    for role in [Role::Physician, Role::Reception] {
        assert!(
            allowed("dashboard.read", role),
            "{role:?} should see dashboard KPIs"
        );
    }
}

#[test]
fn ops_logs_physician_only() {
    assert!(allowed("ops.logs", Role::Physician));
    assert!(!allowed("ops.logs", Role::Reception));
}

#[test]
fn unknown_action_denied_by_default() {
    assert!(!allowed("evil.shell", Role::Physician));
    assert!(!allowed("", Role::Physician));
}

#[test]
fn effective_allow_grants_action_denied_by_role() {
    let o = vec![PermissionOverride {
        action: "audit.read".into(),
        effect: "ALLOW".into(),
    }];
    assert!(!allowed("audit.read", Role::Reception));
    assert!(effective_allowed("audit.read", Role::Reception, &o));
}

#[test]
fn effective_deny_blocks_action_allowed_by_role() {
    let o = vec![PermissionOverride {
        action: "dashboard.read".into(),
        effect: "DENY".into(),
    }];
    assert!(allowed("dashboard.read", Role::Reception));
    assert!(!effective_allowed("dashboard.read", Role::Reception, &o));
}

#[test]
fn full_chart_readonly_preset_for_reception() {
    let o = vec![
        PermissionOverride {
            action: "patient.read_medical".into(),
            effect: "ALLOW".into(),
        },
        PermissionOverride {
            action: "patient.write_medical".into(),
            effect: "DENY".into(),
        },
    ];
    assert!(!allowed("patient.read_medical", Role::Reception));
    assert!(!allowed("patient.write_medical", Role::Reception));
    assert!(effective_allowed("patient.read_medical", Role::Reception, &o));
    assert!(!effective_allowed("patient.write_medical", Role::Reception, &o));
}

#[test]
fn full_chart_readonly_preset_blocks_physician_write() {
    let o = vec![
        PermissionOverride {
            action: "patient.read_medical".into(),
            effect: "ALLOW".into(),
        },
        PermissionOverride {
            action: "patient.write_medical".into(),
            effect: "DENY".into(),
        },
    ];
    assert!(allowed("patient.write_medical", Role::Physician));
    assert!(effective_allowed("patient.read_medical", Role::Physician, &o));
    assert!(!effective_allowed("patient.write_medical", Role::Physician, &o));
}
