//! Row type and the Markdown results ledger of the LAN route matrix (split from `http_route_matrix_tests.rs`).

use std::fs;
use std::path::PathBuf;

pub struct Row {
    pub name: String,
    pub method: String,
    pub path: String,
    pub expect: String,
    pub status: u16,
    pub ok: bool,
    pub body: String,
}

pub fn truncate(s: &str, max: usize) -> String {
    let t = s.replace('\n', " ");
    if t.chars().count() <= max {
        t
    } else {
        format!("{}…", t.chars().take(max).collect::<String>())
    }
}

fn results_path() -> PathBuf {
    // crates/server/lan/medoc-lan → repo root
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../../docs/coordination/backend-http-route-matrix-results.md")
}

/// Writes `docs/coordination/backend-http-route-matrix-results.md` and prints it.
pub fn write(rows: &[Row]) {
    let passed = rows.iter().filter(|r| r.ok).count();
    let failed = rows.iter().filter(|r| !r.ok).count();

    let mut md = String::new();
    md.push_str("# LAN backend HTTP route matrix\n\n");
    md.push_str(&format!(
        "**Generated:** `cargo test -p medoc-lan --test http_route_matrix_tests`  \n\
         **Harness:** in-process `LanTestHarness` (same handlers as `medoc-server`)  \n\
         **Result:** {passed} passed / {failed} failed / {} total\n\n",
        rows.len()
    ));
    md.push_str(
        "| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |\n",
    );
    md.push_str("|---:|---|---|---|---|---:|:---:|---|\n");
    for (i, r) in rows.iter().enumerate() {
        let mark = if r.ok { "PASS" } else { "**FAIL**" };
        md.push_str(&format!(
            "| {} | `{}` | {} | `{}` | {} | {} | {} | {} |\n",
            i + 1,
            r.name,
            r.method,
            r.path.replace('|', "\\|"),
            r.expect,
            r.status,
            mark,
            r.body.replace('|', "\\|")
        ));
    }
    md.push_str("\n## Notes\n\n");
    md.push_str("- `eprescription.submit_stub` expects 500/501 without TI connector.\n");
    md.push_str("- Company proxy routes expect 400 when vendor portal URL is unset.\n");
    md.push_str("- Auth uses seeded `ahmed@practice.de` / `password123` plus ops JWT.\n");
    md.push_str("- Sync/peers use activation token after pairing decide + PIN confirm.\n");
    md.push_str(
        "- `license.activate_invalid` returns HTTP 200 with `valid:false` (structured status).\n",
    );

    let out = results_path();
    if let Some(parent) = out.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&out, &md).expect("write results markdown");
    eprintln!("Wrote {}", out.display());
    eprintln!("{md}");
}
