//! TASK 3.4 — RBAC matrix is generated from `config/rbac.yaml`.

use medoc_lib::application::rbac::{allowed, Role};

const YAML_ACTIONS: &[&str] = &[
    "patient.read_medical",
    "patient.write_medical",
    "patient.read_documents",
    "patient.treatments_list_for_payment",
    "patient.read",
    "patient.write",
    "appointment.list_physicians",
    "appointment.read",
    "appointment.write",
    "finance.read",
    "finance.reception.view",
    "finance.write",
    "dashboard.read",
    "product.read",
    "product.write",
    "purchase_order.read",
    "purchase_order.write",
    "administration.read",
    "administration.inventory.read",
    "administration.inventory.write",
    "administration.contracts.read",
    "administration.contracts.write",
    "administration.catalogs.read",
    "administration.catalogs.write",
    "administration.templates.read",
    "administration.templates.write",
    "administration.team.read",
    "administration.practice_planning.read",
    "administration.practice_planning.write",
    "finance.day_close.write",
    "staff.read",
    "staff.write",
    "templates.read",
    "templates.write",
    "audit.read",
    "ops.backup",
    "ops.dsgvo",
    "ops.migration",
    "ops.system",
    "ops.logs",
    "ops.audit_chain_ack",
    "task.status.fulfill",
    "task.status.admin",
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
fn reception_denied_medical_still() {
    assert!(!allowed("patient.read_medical", Role::Reception));
    assert!(allowed("patient.read", Role::Reception));
}
