use medoc_lib::application::rbac::{allowed, Role};

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
    assert!(!allowed("audit.read", Role::Rezeption));
    assert!(!allowed("personal.read", Role::Rezeption));
    assert!(!allowed("ops.backup", Role::Rezeption));
    assert!(allowed("termin.list_aerzte", Role::Rezeption));
}

#[test]
fn steuerberater_only_finanzen() {
    assert!(allowed("finanzen.read", Role::Steuerberater));
    assert!(allowed("finanzen.write", Role::Steuerberater));
    assert!(!allowed("patient.read_medical", Role::Steuerberater));
    assert!(!allowed("termin.write", Role::Steuerberater));
    assert!(!allowed("personal.write", Role::Steuerberater));
    assert!(!allowed("termin.list_aerzte", Role::Steuerberater));
}

#[test]
fn all_roles_can_read_dashboard_aggregates() {
    for role in [
        Role::Arzt,
        Role::Rezeption,
        Role::Steuerberater,
        Role::Pharmaberater,
    ] {
        assert!(
            allowed("dashboard.read", role),
            "{role:?} should see dashboard KPIs"
        );
    }
}

#[test]
fn pharmaberater_only_inventory() {
    assert!(allowed("produkt.read", Role::Pharmaberater));
    assert!(allowed("produkt.write", Role::Pharmaberater));
    assert!(!allowed("patient.read", Role::Pharmaberater));
    assert!(!allowed("finanzen.read", Role::Pharmaberater));
    assert!(!allowed("audit.read", Role::Pharmaberater));
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
