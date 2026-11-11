//! Single list of SQLite tables and how they replicate.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncClass {
    Admin,
    Numbered,
    Shared,
    Files,
    DeviceLocal,
}

pub const TABLES: &[(&str, SyncClass)] = &[
    ("staff", SyncClass::DeviceLocal),
    ("device_session", SyncClass::DeviceLocal),
    ("brute_force_lockout", SyncClass::DeviceLocal),
    ("sync_device", SyncClass::DeviceLocal),
    ("sync_vector", SyncClass::DeviceLocal),
    ("sync_outbox", SyncClass::DeviceLocal),
    ("sync_applied", SyncClass::DeviceLocal),
    ("sync_peer_vector", SyncClass::DeviceLocal),
    ("sync_tombstone", SyncClass::DeviceLocal),
    ("pairing_request", SyncClass::DeviceLocal),
    ("slave_permission", SyncClass::DeviceLocal),
    ("device_blocklist", SyncClass::DeviceLocal),
    ("sync_blob", SyncClass::DeviceLocal),
    ("number_sequence", SyncClass::DeviceLocal),
    ("provisioning_state", SyncClass::DeviceLocal),
    ("license", SyncClass::DeviceLocal),
    ("audit_log", SyncClass::DeviceLocal),
    ("feedback", SyncClass::DeviceLocal),
    ("app_kv", SyncClass::Admin),
    ("service_item", SyncClass::Admin),
    ("treatment_catalog", SyncClass::Admin),
    ("document_template", SyncClass::Admin),
    ("document_template_user", SyncClass::Admin),
    ("supplier_master", SyncClass::Admin),
    ("pharma_consultant_master", SyncClass::Admin),
    // Product before the template: the template row references product(id).
    ("product", SyncClass::Shared),
    ("supplier_pharma_template", SyncClass::Admin),
    ("staff_permission_override", SyncClass::Admin),
    ("absence", SyncClass::Admin),
    ("patient", SyncClass::Shared),
    ("patient_chart", SyncClass::Shared),
    ("anamnesis_form", SyncClass::Shared),
    ("dental_finding", SyncClass::Shared),
    ("appointment", SyncClass::Shared),
    ("examination", SyncClass::Shared),
    ("treatment", SyncClass::Shared),
    ("payment", SyncClass::Shared),
    ("prescription", SyncClass::Shared),
    ("certificate", SyncClass::Shared),
    ("sick_leave_certificate", SyncClass::Shared),
    ("practice_task", SyncClass::Shared),
    ("practice_task_comment", SyncClass::Shared),
    ("practice_task_patient_optional", SyncClass::Shared),
    ("practice_ticket", SyncClass::Shared),
    ("in_app_notification", SyncClass::Shared),
    ("chart_validation", SyncClass::Shared),
    ("chart_next_appointment_hint", SyncClass::Shared),
    ("contract", SyncClass::Shared),
    ("purchase_order", SyncClass::Shared),
    ("work_time_session", SyncClass::Shared),
    ("work_time_pause_segment", SyncClass::Shared),
    ("work_time_preference", SyncClass::Shared),
    ("work_plan_adjustment", SyncClass::Shared),
    ("issued_document", SyncClass::Numbered),
    ("invoice_document", SyncClass::Numbered),
    ("invoice_document_audit", SyncClass::Numbered),
    ("day_close_protocol", SyncClass::Numbered),
    ("balance_sheet_snapshot", SyncClass::Numbered),
    ("chart_attachment", SyncClass::Files),
];

pub const DENY_COLUMNS: &[(&str, &str)] = &[
    ("staff", "password_hash"),
    ("staff", "totp_secret"),
    ("staff", "token_version"),
];

pub const DENY_APP_KV_PREFIXES: &[&str] = &[
    // F137: log level is a per-device setting.
    "logging.",
    "sync.",
    "license.",
    "pairing.",
    "onboarding.",
    "cluster.",
    "lan.server.",
    "company.portal.",
    "theme.",
    "ui.",
];

pub fn class_of(table: &str) -> Option<SyncClass> {
    TABLES.iter().find(|(name, _)| *name == table).map(|(_, c)| *c)
}

pub fn is_synced_table(table: &str) -> bool {
    matches!(
        class_of(table),
        Some(SyncClass::Admin | SyncClass::Numbered | SyncClass::Shared | SyncClass::Files)
    )
}

pub fn synced_tables() -> impl Iterator<Item = &'static str> {
    TABLES
        .iter()
        .filter(|(_, class)| {
            matches!(
                class,
                SyncClass::Admin | SyncClass::Numbered | SyncClass::Shared | SyncClass::Files
            )
        })
        .map(|(name, _)| *name)
}

pub fn deny_column(table: &str, column: &str) -> bool {
    DENY_COLUMNS
        .iter()
        .any(|(t, c)| *t == table && *c == column)
}

pub fn deny_app_kv_key(key: &str) -> bool {
    DENY_APP_KV_PREFIXES.iter().any(|prefix| key.starts_with(prefix))
}

/// SQL expression that yields a row's sync id. Composite keys are joined with
/// `|` (F147: `chart_validation` has PRIMARY KEY (patient_id, section_or_item)).
pub fn key_expr(table: &str) -> String {
    match table {
        "chart_validation" => "(patient_id || '|' || section_or_item)".to_string(),
        _ => format!("\"{}\"", id_column(table)),
    }
}

/// `true` when the sync id is stored in one real column (`id_column`).
pub fn key_is_column(table: &str) -> bool {
    table != "chart_validation"
}

/// Sync id for a `chart_validation` row.
pub fn chart_validation_key(patient_id: &str, section_or_item: &str) -> String {
    format!("{patient_id}|{section_or_item}")
}

pub fn id_column(table: &str) -> &'static str {
    match table {
        "app_kv" => "key",
        "chart_next_appointment_hint" => "patient_id",
        "work_time_preference" => "staff_id",
        _ => "id",
    }
}
