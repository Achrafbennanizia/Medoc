//! TASK 3.4 — RBAC matrix is generated from `config/rbac.yaml`.

use medoc_lib::application::rbac::{allowed, Role};

const YAML_ACTIONS: &[&str] = &[
    "patient.read_medical",
    "patient.write_medical",
    "patient.read_documents",
    "patient.behandlungen_list_for_zahlung",
    "patient.read",
    "patient.write",
    "termin.list_aerzte",
    "termin.read",
    "termin.write",
    "finanzen.read",
    "finanzen.reception.view",
    "finanzen.write",
    "dashboard.read",
    "produkt.read",
    "produkt.write",
    "bestellung.read",
    "bestellung.write",
    "verwaltung.read",
    "verwaltung.lager.read",
    "verwaltung.lager.write",
    "verwaltung.vertraege.read",
    "verwaltung.vertraege.write",
    "verwaltung.kataloge.read",
    "verwaltung.kataloge.write",
    "verwaltung.vorlagen.read",
    "verwaltung.vorlagen.write",
    "verwaltung.team.read",
    "verwaltung.praxisplanung.read",
    "verwaltung.praxisplanung.write",
    "finanzen.tagesabschluss.write",
    "personal.read",
    "personal.write",
    "vorlagen.read",
    "vorlagen.write",
    "audit.read",
    "ops.backup",
    "ops.dsgvo",
    "ops.migration",
    "ops.system",
    "ops.logs",
    "ops.audit_chain_ack",
    "aufgabe.status.fulfill",
    "aufgabe.status.admin",
    "work_time.self",
    "work_time.team.read",
    "work_time.admin",
    "statistik.read",
];

#[test]
fn yaml_action_count_matches_const_list() {
    let yaml = include_str!("../../../config/rbac.yaml");
    let doc: serde_yaml::Value = serde_yaml::from_str(yaml).expect("parse rbac.yaml");
    let perms = doc
        .get("permissions")
        .and_then(|p| p.as_mapping())
        .expect("permissions map");
    assert_eq!(
        perms.len(),
        YAML_ACTIONS.len(),
        "update YAML_ACTIONS in rbac_codegen_tests when adding permissions"
    );
}

#[test]
fn rezeption_denied_medical_still() {
    assert!(!allowed("patient.read_medical", Role::Rezeption));
    assert!(allowed("patient.read", Role::Rezeption));
}
