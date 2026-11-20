//! The access catalogue must cover every permission the role matrix knows.
//!
//! An action that is in `config/rbac.yaml` but has no rule in
//! `domain::access::ACTION_RULES` is not restricted by access profiles: a
//! profiled person keeps whatever the role matrix gives for it. This test
//! fails for such an action, so a new screen cannot bypass the profiles.

use medoc_core::application::rbac;
use medoc_core::domain::access::{self, ActionKind};

fn rbac_yaml() -> Option<String> {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../config/rbac.yaml");
    std::fs::read_to_string(path).ok()
}

/// Dotted permission names that appear as YAML keys or list items.
fn yaml_actions(raw: &str) -> Vec<String> {
    let re = regex::Regex::new(r#"(?m)^\s*-?\s*["']?([a-z_]+(?:\.[a-z_]+)+)["']?\s*:?"#).unwrap();
    let mut out: Vec<String> = re
        .captures_iter(raw)
        .map(|c| c[1].to_string())
        .filter(|a| rbac::is_matrix_action(a))
        .collect();
    out.sort();
    out.dedup();
    out
}

#[test]
fn every_rbac_yaml_action_has_a_rule() {
    let Some(raw) = rbac_yaml() else {
        eprintln!("config/rbac.yaml not found next to the workspace; skipped");
        return;
    };
    let missing: Vec<String> = yaml_actions(&raw)
        .into_iter()
        .filter(|a| access::rule(a).is_none() && !access::UNSCOPED_ACTIONS.contains(&a.as_str()))
        .collect();
    assert!(
        missing.is_empty(),
        "add these actions to domain::access::ACTION_RULES (or UNSCOPED_ACTIONS): {missing:?}"
    );
}

#[test]
fn every_legacy_fallback_is_a_real_matrix_action() {
    for rule in access::ACTION_RULES {
        if rule.kind == ActionKind::Legacy {
            continue;
        }
        for legacy in rule.legacy {
            assert!(
                rbac::is_matrix_action(legacy),
                "{} falls back to {legacy}, which config/rbac.yaml does not define — \
                 fix the name or clear the fallback",
                rule.action
            );
        }
    }
}
