//! Architecture guard: medoc-practice must not depend on the Tauri shell crate.

#[test]
fn practice_crate_does_not_depend_on_tauri_shell() {
    let manifest = include_str!("../Cargo.toml");
    assert!(
        !manifest.contains("path = \"../../apps/practice-host\""),
        "medoc-practice must not depend on apps/practice-host; commands belong here, shell re-exports"
    );
    assert!(
        !manifest.contains("name = \"medoc\""),
        "medoc-practice must not depend on the medoc Tauri binary crate"
    );
}
