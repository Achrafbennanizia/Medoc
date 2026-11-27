//! Looking up and evaluating action rules (split from `access.rs`).

use super::*;

pub fn rule(action: &str) -> Option<&'static ActionRule> {
    ACTION_RULES.iter().find(|r| r.action == action)
}

pub fn rule_allows(levels: &Levels, rule: &ActionRule) -> bool {
    rule.any_of
        .iter()
        .any(|(area, needed)| level_of(levels, *area).allows(*needed))
}

/// Explicit ALLOW/DENY for every catalogued action.
pub fn compile_overrides(levels: &Levels) -> Vec<PermissionOverride> {
    ACTION_RULES
        .iter()
        .map(|rule| PermissionOverride {
            action: rule.action.to_string(),
            effect: if rule_allows(levels, rule) {
                "ALLOW".to_string()
            } else {
                "DENY".to_string()
            },
        })
        .collect()
}

/// `(area, level)` an action needs, for messages and the access screen.
pub fn first_requirement(action: &str) -> Option<(Area, Level)> {
    rule(action).and_then(|r| r.any_of.first().copied())
}
