//! Single list of SQLite tables and how they replicate.

/// `app_kv` row that stores [`crate::infrastructure::database::recorded_write`] deployment mode.
pub const APP_KV_DEPLOYMENT_KEY: &str = "sync.deployment.v1";
/// `app_kv` row that stores this install's sync device id.
pub const APP_KV_DEVICE_ID_KEY: &str = "sync.device_id.v1";
/// `app_kv` row that stores the hybrid logical clock.
pub const APP_KV_HLC_KEY: &str = "sync.hlc.v1";

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
    // Gap-free document numbers are allocated on the master only (ensure_numbering_authority);
    // issued documents carry their number when they replicate.
    ("document_sequence", SyncClass::DeviceLocal),
    // Outgoing sync packets waiting for a peer: transport state of this device.
    ("sync_packet_queue", SyncClass::DeviceLocal),
    ("provisioning_state", SyncClass::DeviceLocal),
    ("license", SyncClass::DeviceLocal),
    ("audit_log", SyncClass::DeviceLocal),
    ("change_record", SyncClass::DeviceLocal),
    ("feedback", SyncClass::DeviceLocal),
    // Guest proposals: Solo only, one device.
    ("staged_change", SyncClass::DeviceLocal),
    // Number blocks reserved for / held by the second admin hub (T4.3).
    ("number_block", SyncClass::DeviceLocal),
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
    // Per-action overrides are keyed by (staff_id, action) and have no `id`
    // column, so their sync key never matched a row: they did not replicate
    // and a DENY set on the main device was not enforced on a replica. They
    // now travel inside `staff_access_profile` (one row per staff member).
    ("staff_permission_override", SyncClass::DeviceLocal),
    ("staff_access_profile", SyncClass::Admin),
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
    // Group sharing rules (T5.1). Owner-only: merge refuses a row its owner did not write.
    ("allowance_rule", SyncClass::Shared),
    ("record_visibility", SyncClass::Shared),
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
    // Cash book lines and dunning letters. They used to stay on the device
    // that wrote them: the main device's day close missed cash booked on a
    // replica, and a reminder issued on one device was invisible on the
    // others (the same patient could receive the same level twice).
    // `payment_receipt` stays local on purpose: each device derives it from
    // `payment` with triggers, so replicating it would double every line.
    ("cash_movement", SyncClass::Numbered),
    // Print log (original + copies): a PDF printed on one device verifies
    // by its hash on every device. Insert-only.
    ("issued_document_print", SyncClass::Numbered),
    ("payment_reminder", SyncClass::Numbered),
    ("chart_attachment", SyncClass::Files),
];

/// Synced tables that only the main device may write. Rows for them are
/// accepted from the main device (pull, or its exchange queue) and rejected
/// from any replica or mesh peer, so a paired device cannot raise a login's
/// rights by pushing a row.
pub const MASTER_ONLY_TABLES: &[&str] = &["staff_access_profile"];

pub fn is_master_only_table(table: &str) -> bool {
    MASTER_ONLY_TABLES.contains(&table)
}

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

/// One queue per screen. A failed row stays in its own queue.
pub fn queue_of(table: &str) -> &'static str {
    match table {
        "patient" | "anamnesis_form" => "patients",
        "appointment" | "chart_next_appointment_hint" => "appointments",
        "patient_chart"
        | "dental_finding"
        | "examination"
        | "treatment"
        | "prescription"
        | "certificate"
        | "sick_leave_certificate"
        | "chart_validation"
        | "chart_attachment" => "charts",
        "payment"
        | "invoice_document"
        | "invoice_document_audit"
        | "day_close_protocol"
        | "balance_sheet_snapshot"
        | "cash_movement"
        | "payment_reminder"
        | "issued_document_print"
        | "issued_document" => "finance",
        // Practice profile, currency, and system settings. One failed catalog
        // row must not hold these back.
        "app_kv" => "parameters",
        "purchase_order"
        | "product"
        | "supplier_pharma_template"
        | "supplier_master"
        | "pharma_consultant_master"
        | "service_item"
        | "treatment_catalog" => "orders",
        "practice_task"
        | "practice_task_comment"
        | "practice_task_patient_optional"
        | "practice_ticket"
        | "in_app_notification" => "tasks",
        "work_time_session"
        | "work_time_pause_segment"
        | "work_time_preference"
        | "work_plan_adjustment"
        | "absence" => "work_time",
        _ => "practice",
    }
}

pub fn class_of(table: &str) -> Option<SyncClass> {
    TABLES
        .iter()
        .find(|(name, _)| *name == table)
        .map(|(_, c)| *c)
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
    DENY_APP_KV_PREFIXES
        .iter()
        .any(|prefix| key.starts_with(prefix))
}

/// SQL predicate for `app_kv` rows that replicate: practice and system
/// settings, including `invoice.practice.v1` (currency). Device-local keys
/// listed in [`DENY_APP_KV_PREFIXES`] stay on the device that wrote them.
pub fn synced_app_kv_predicate(column: &str) -> String {
    DENY_APP_KV_PREFIXES
        .iter()
        .map(|prefix| format!("{column} NOT LIKE '{prefix}%'"))
        .collect::<Vec<_>>()
        .join(" AND ")
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

#[cfg(test)]
mod tests {
    use super::queue_of;

    #[test]
    fn a_task_and_a_product_are_different_queues() {
        assert_eq!(queue_of("practice_task"), "tasks");
        assert_eq!(queue_of("product"), "orders");
        assert_ne!(queue_of("practice_task"), queue_of("product"));
    }

    #[test]
    fn cash_book_and_reminders_replicate_on_the_finance_queue() {
        for t in ["cash_movement", "payment_reminder"] {
            assert!(super::is_synced_table(t), "{t}");
            assert_eq!(queue_of(t), "finance");
        }
        assert!(!super::is_synced_table("payment_receipt"));
    }

    #[test]
    fn practice_parameters_have_their_own_queue() {
        assert_eq!(queue_of("app_kv"), "parameters");
        assert_ne!(queue_of("app_kv"), queue_of("document_template"));
        assert!(!super::deny_app_kv_key("invoice.practice.v1"));
        assert!(!super::deny_app_kv_key("practice.timezone.v1"));
        assert!(!super::deny_app_kv_key("documents.locale.v1"));
        assert!(super::deny_app_kv_key("sync.device_id.v1"));
        let predicate = super::synced_app_kv_predicate("key");
        assert!(predicate.contains("key NOT LIKE 'sync.%'"));
        assert!(predicate.contains("key NOT LIKE 'theme.%'"));
    }
}
