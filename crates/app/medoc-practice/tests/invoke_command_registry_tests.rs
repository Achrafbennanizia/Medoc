//! Characterization: IPC command registry integrity (TASK 3.3 guard extension).

use medoc_practice::commands::register::EXPECTED_INVOKE_COMMAND_COUNT;
use std::collections::HashSet;

const REGISTER_RS: &str = include_str!("../src/commands/register.rs");

/// Critical commands the frontend relies on; must stay registered.
const CRITICAL_COMMANDS: &[&str] = &[
    "login",
    "logout",
    "get_session",
    "list_patients",
    "create_patient",
    "list_appointments",
    "create_appointment",
    "get_chart",
    "list_practice_tasks_for_me",
    "transition_practice_task",
    "list_charts_to_validate",
    "count_charts_to_validate",
    "validate_patient_chart",
    "list_examinations",
    "create_examination",
    "update_examination",
    "delete_examination",
    "list_dental_findings",
    "update_dental_finding",
    "list_chart_attachments",
    "create_chart_attachment",
    "create_chart_attachment_from_path",
    "delete_chart_attachment",
    "set_chart_attachment_document_kind",
    "get_app_kv",
    "set_app_kv",
    "pairing_list_pending",
    "cluster_status_cmd",
    "license_activate",
    "import_activation_manifest",
    "cluster_cluster_reset_preview",
    "cluster_execute_cluster_reset",
    "work_time_get_week_overview",
    "work_time_get_team_overview",
    "work_time_get_statistics",
    "work_time_start",
    "work_time_end",
];

fn extract_handler_names(source: &str) -> Vec<String> {
    source
        .lines()
        .filter_map(|line| {
            let trimmed = line.trim();
            if !trimmed.starts_with("$crate::commands::") {
                return None;
            }
            let name = trimmed.rsplit("::").next()?.trim_end_matches(',');
            Some(name.to_string())
        })
        .collect()
}

#[test]
fn invoke_handlers_unique_and_match_documented_count() {
    let names = extract_handler_names(REGISTER_RS);
    let unique: HashSet<_> = names.iter().collect();
    assert_eq!(
        names.len(),
        unique.len(),
        "duplicate IPC handler entries in register.rs"
    );
    assert_eq!(
        names.len(),
        EXPECTED_INVOKE_COMMAND_COUNT,
        "update EXPECTED_INVOKE_COMMAND_COUNT and medoc_invoke_handler when adding IPC"
    );
}

#[test]
fn critical_invoke_commands_registered() {
    let names: HashSet<_> = extract_handler_names(REGISTER_RS).into_iter().collect();
    for cmd in CRITICAL_COMMANDS {
        assert!(
            names.contains(*cmd),
            "critical command {cmd} missing from medoc_invoke_handler"
        );
    }
}
