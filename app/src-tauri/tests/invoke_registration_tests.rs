//! TASK 3.3 — IPC registration guard.

use medoc_lib::commands::register::EXPECTED_INVOKE_COMMAND_COUNT;

#[test]
fn expected_invoke_command_count_documented() {
    assert_eq!(
        EXPECTED_INVOKE_COMMAND_COUNT, 234,
        "update commands/register.rs (medoc_invoke_handler) and per-module register_*!() when adding IPC"
    );
}
