//! TASK 3.3 — IPC registration guard.

use medoc_lib::commands::register::EXPECTED_INVOKE_COMMAND_COUNT;
use std::collections::HashSet;

const REGISTER_RS: &str =
    include_str!("../../../crates/app/medoc-practice/src/commands/register.rs");

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
fn expected_invoke_command_count_documented() {
    assert_eq!(
        EXPECTED_INVOKE_COMMAND_COUNT, 294,
        "update commands/register.rs (medoc_invoke_handler) and per-module register_*!() when adding IPC"
    );
}

#[test]
fn invoke_handlers_are_unique() {
    let names = extract_handler_names(REGISTER_RS);
    let unique: HashSet<_> = names.iter().collect();
    assert_eq!(
        names.len(),
        unique.len(),
        "duplicate IPC handler entries in register.rs"
    );
    assert_eq!(names.len(), EXPECTED_INVOKE_COMMAND_COUNT);
}
