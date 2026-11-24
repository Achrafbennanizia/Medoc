//! H2: every repo write of a synced table goes through `record_in_tx`.

use medoc_core::infrastructure::database::sync_registry::{synced_tables, SyncClass, TABLES};
use regex::Regex;
use std::fs;
use std::path::Path;

#[test]
fn every_synced_write_is_recorded() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/infrastructure/database/repos");
    scan_and_assert(&[root], false);
}

/// F145: writes outside `repos/` (desktop commands, core services) must be
/// recorded too. `app_kv` is skipped here because its keys decide whether a
/// write syncs; app_kv writes go through `app_kv_repo`, which records.
#[test]
fn command_and_service_writes_are_recorded() {
    let core = Path::new(env!("CARGO_MANIFEST_DIR"));
    let roots = vec![
        core.join("../../app/medoc-practice/src/commands"),
        core.join("src/infrastructure/gdpr.rs"),
        core.join("src/infrastructure/migration.rs"),
        core.join("src/application"),
    ];
    scan_and_assert(&roots, true);
}

fn scan_and_assert(roots: &[std::path::PathBuf], skip_app_kv: bool) {
    let synced: Vec<&str> = synced_tables().collect();
    let sql_re =
        Regex::new(r#"(?i)(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["']?([a-z_][a-z0-9_]*)"#)
            .expect("sql re");
    let fn_re =
        Regex::new(r"(?m)^(?:\s*(?:pub(?:\([^)]+\))?\s+)?)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)")
            .expect("fn re");
    let mut offenders = Vec::new();
    for root in roots {
        visit_rs(root, &mut |path, src| {
            let src = match src.find("#[cfg(test)]") {
                Some(i) => &src[..i],
                None => src,
            };
            let mut starts: Vec<(usize, &str)> = fn_re
                .captures_iter(src)
                .map(|c| (c.get(0).unwrap().start(), c.get(1).unwrap().as_str()))
                .collect();
            starts.push((src.len(), ""));
            for window in starts.windows(2) {
                let (start, name) = window[0];
                let end = window[1].0;
                let body = &src[start..end];
                let recorded = body.contains("record_in_tx")
                    || body.contains("record_or_noop")
                    || body.contains("record_row(")
                    || body.contains("sync: recorded by caller");
                for cap in sql_re.captures_iter(body) {
                    let kind = cap.get(1).unwrap().as_str().to_ascii_uppercase();
                    let table = cap.get(2).unwrap().as_str();
                    if !synced.contains(&table) {
                        continue;
                    }
                    if skip_app_kv && table == "app_kv" {
                        continue;
                    }
                    if !recorded {
                        offenders.push(format!(
                            "{}::{name}: {kind} {table} without record_in_tx",
                            path.display()
                        ));
                    }
                    if kind == "UPDATE" && !body.contains("updated_at") {
                        offenders.push(format!(
                            "{}::{name}: UPDATE {table} missing updated_at",
                            path.display()
                        ));
                    }
                }
            }
        });
    }
    let _classes: Vec<_> = TABLES
        .iter()
        .filter(|(_, c)| *c != SyncClass::DeviceLocal)
        .collect();
    assert!(
        offenders.is_empty(),
        "H2 offenders ({}):\n{}",
        offenders.len(),
        offenders.join("\n")
    );
}

fn visit_rs(dir: &Path, on_file: &mut impl FnMut(&Path, &str)) {
    if dir.is_file() {
        let src = fs::read_to_string(dir).expect("read rs");
        on_file(dir, &src);
        return;
    }
    let entries = fs::read_dir(dir).unwrap_or_else(|e| panic!("read {}: {e}", dir.display()));
    for entry in entries {
        let entry = entry.expect("dirent");
        let path = entry.path();
        if path.is_dir() {
            visit_rs(&path, on_file);
        } else if path.extension().and_then(|s| s.to_str()) == Some("rs") {
            let src = fs::read_to_string(&path).expect("read rs");
            on_file(&path, &src);
        }
    }
}
