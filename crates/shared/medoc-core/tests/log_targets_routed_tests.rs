//! Every `target: "medoc::…"` in the code lands where the logging architecture says
//! (docs/architecture/logging.md): a channel file, or app.log for the listed domain areas.
//! A typo or an unlisted area (it used to be `medoc::network`) fails here instead of quietly
//! writing to the wrong file.

use std::path::Path;

use medoc_core::infrastructure::logging::channels::channel_for;

/// Domain areas that intentionally go to app.log (their WARN/ERROR also reach errors.log).
const APP_LOG_AREAS: &[&str] = &["medoc::staff", "medoc::patient", "medoc::clinical"];

fn collect(dir: &Path, out: &mut Vec<(String, String)>) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for e in entries.flatten() {
        let p = e.path();
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if p.is_dir() {
            if !matches!(name, "target" | "node_modules" | ".git") {
                collect(&p, out);
            }
        } else if name.ends_with(".rs") {
            let text = std::fs::read_to_string(&p).unwrap_or_default();
            for part in text.split("target: \"").skip(1) {
                if let Some(t) = part.split('"').next().filter(|t| {
                    t.starts_with("medoc::")
                        && t.bytes()
                            .all(|b| b.is_ascii_lowercase() || b == b'_' || b == b':')
                }) {
                    out.push((t.to_owned(), p.display().to_string()));
                }
            }
        }
    }
}

#[test]
fn every_log_target_is_routed() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    let mut found = Vec::new();
    for dir in ["crates", "apps/practice-host/src"] {
        collect(&root.join(dir), &mut found);
    }
    assert!(
        !found.is_empty(),
        "no log targets found under {}",
        root.display()
    );
    let unrouted: Vec<_> = found
        .iter()
        .filter(|(t, _)| {
            channel_for(t).is_none()
                && !APP_LOG_AREAS
                    .iter()
                    .any(|a| t == a || t.starts_with(&format!("{a}::")))
        })
        .collect();
    assert!(
        unrouted.is_empty(),
        "log targets without a channel (add to channels.rs or APP_LOG_AREAS): {unrouted:?}"
    );
}
