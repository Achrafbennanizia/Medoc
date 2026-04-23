// Update server schema (FA-SYS-UPDATE).
//
// Network transport is intentionally not bundled — the actual HTTPS call
// happens in the frontend so we don't drag a heavyweight HTTP client into
// the binary. This module owns the response schema, version comparison and
// "newer?" decision so the rules stay consistent across call sites.

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub url: String,
    pub notes: String,
    #[serde(default)]
    pub min_supported: String,
    #[serde(default)]
    pub signature: String,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum UpdateStatus {
    UpToDate { current: String },
    Available { current: String, info: UpdateInfo },
    Error { message: String },
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn version_newer(candidate: &str, current: &str) -> bool {
    let parse = |s: &str| -> Vec<u32> { s.split('.').filter_map(|p| p.parse().ok()).collect() };
    let a = parse(candidate);
    let b = parse(current);
    for (x, y) in a.iter().zip(b.iter()) {
        if x != y {
            return x > y;
        }
    }
    a.len() > b.len()
}

pub fn evaluate(payload: UpdateInfo) -> UpdateStatus {
    let current = current_version().to_string();
    if version_newer(&payload.version, &current) {
        UpdateStatus::Available {
            current,
            info: payload,
        }
    } else {
        UpdateStatus::UpToDate { current }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_compare() {
        assert!(version_newer("1.0.1", "1.0.0"));
        assert!(version_newer("2.0.0", "1.9.9"));
        assert!(!version_newer("1.0.0", "1.0.0"));
        assert!(!version_newer("0.9.0", "1.0.0"));
        assert!(version_newer("1.0.0.1", "1.0.0"));
    }
}
