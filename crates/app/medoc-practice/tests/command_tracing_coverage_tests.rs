//! Guardrail: every Tauri IPC command should emit a tracing span.

use std::fs;
use std::path::{Path, PathBuf};

fn rust_files(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
                    files.push(path);
                }
            }
        }
    }
    files.sort();
    files
}

fn first_non_empty_line_after(lines: &[&str], start: usize) -> Option<String> {
    for line in lines.iter().skip(start) {
        let trimmed = line.trim();
        if !trimmed.is_empty() {
            return Some(trimmed.to_string());
        }
    }
    None
}

fn missing_instrumentation(path: &Path, source: &str) -> Vec<String> {
    let lines: Vec<&str> = source.lines().collect();
    let mut missing = Vec::new();

    for (idx, line) in lines.iter().enumerate() {
        if !line.contains("#[tauri::command") {
            continue;
        }
        let lookahead = lines
            .iter()
            .skip(idx + 1)
            .take(6)
            .any(|candidate| candidate.contains("tracing::instrument"));
        if lookahead {
            continue;
        }
        let signature = first_non_empty_line_after(&lines, idx + 1)
            .unwrap_or_else(|| "<missing function signature>".to_string());
        missing.push(format!("{}:{} {}", path.display(), idx + 1, signature));
    }
    missing
}

#[test]
fn tauri_commands_are_tracing_instrumented() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/commands");
    let mut missing = Vec::new();
    for file in rust_files(&root) {
        let src = fs::read_to_string(&file).expect("read command module");
        missing.extend(missing_instrumentation(&file, &src));
    }

    assert!(
        missing.is_empty(),
        "Add #[tracing::instrument(..)] to these Tauri commands:\n{}",
        missing.join("\n")
    );
}
