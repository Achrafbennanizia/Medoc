//! TASK 3.5 — domain enums generated from `config/enums.yaml`.

use medoc_lib::domain::enums::{Sex, AppointmentKind, AppointmentStatus, PaymentMethod};

const RUST_ENUMS: &[(&str, usize)] = &[
    ("Role", 4),
    ("Sex", 3),
    ("AppointmentKind", 5),
    ("AppointmentStatus", 5),
    ("PatientStatus", 4),
    ("ChartStatus", 4),
    ("PaymentMethod", 4),
    ("PaymentStatus", 4),
    ("AuditAction", 5),
];

#[test]
fn yaml_rust_enum_variant_counts() {
    let yaml = include_str!("../../../config/enums.yaml");
    let doc: serde_yaml::Value = serde_yaml::from_str(yaml).expect("parse enums.yaml");
    let enums = doc
        .get("enums")
        .and_then(|e| e.as_mapping())
        .expect("enums map");
    for (name, expected) in RUST_ENUMS {
        let def = enums
            .get(serde_yaml::Value::String(name.to_string()))
            .unwrap_or_else(|| panic!("missing enum {name}"));
        let variants = def
            .get("variants")
            .and_then(|version| version.as_sequence())
            .unwrap_or_else(|| panic!("{name} variants"));
        let generate_rust = def
            .get("generate_rust")
            .and_then(|version| version.as_bool())
            .unwrap_or(true);
        if generate_rust {
            assert_eq!(variants.len(), *expected, "update RUST_ENUMS for {name}");
        }
    }
}

#[test]
fn wire_values_roundtrip_json() {
    assert_eq!(
        serde_json::to_string(&AppointmentStatus::NoShow).unwrap(),
        "\"NO_SHOW\""
    );
    assert_eq!(
        serde_json::from_str::<Sex>("\"MALE\"").unwrap(),
        Sex::Male
    );
    assert_eq!(
        serde_json::from_str::<AppointmentKind>("\"CHECKUP\"").unwrap(),
        AppointmentKind::Checkup
    );
    assert_eq!(
        serde_json::from_str::<PaymentMethod>("\"INVOICE\"").unwrap(),
        PaymentMethod::Invoice
    );
}
