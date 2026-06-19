//! Characterization: IPC command registry integrity (TASK 3.3 guard extension).

use medoc_practice::commands::register::EXPECTED_INVOKE_COMMAND_COUNT;
use std::collections::HashSet;

const REGISTER_RS: &str = include_str!("../src/commands/register.rs");

/// Critical commands the frontend relies on; must stay registered.
const CRITICAL_COMMANDS: &[&str] = &[
    "login",
    "logout",
    "get_session",
    "list_patienten",
    "create_patient",
    "list_termine",
    "create_termin",
    "get_akte",
    "list_praxis_aufgaben_for_me",
    "transition_praxis_aufgabe",
    "get_app_kv",
    "set_app_kv",
    "pairing_list_pending",
    "verbund_status_cmd",
    "lizenz_activate",
    "import_activation_manifest",
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
