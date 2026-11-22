//! The access model as data, for the staff screen and the Help guide: areas, levels, the actions
//! each level unlocks (taken from the enforcement rules, so the guide cannot drift from what is
//! checked), the predefined roles and each login role's ceiling. Texts are translated in the UI
//! (`access.area.*`, `access.level.*`, `access.role.*`).

use std::collections::BTreeMap;

use serde::Serialize;

use crate::application::access_control::{list_templates, role_wire, TemplateDto};
use crate::application::rbac::Role;
use crate::domain::access::{self, Area, Level};
use crate::domain::access_relation::SCOPABLE_AREAS;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LevelActionsDto {
    pub level: &'static str,
    /// Actions that need exactly this level in this area (higher levels include them).
    pub actions: Vec<&'static str>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AreaCatalogDto {
    pub area: &'static str,
    /// Can be limited to the person's own records.
    pub scopable: bool,
    pub levels: Vec<LevelActionsDto>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessCatalogDto {
    pub levels: Vec<&'static str>,
    pub areas: Vec<AreaCatalogDto>,
    pub roles: Vec<TemplateDto>,
    /// Login role → area → highest level it may ever receive.
    pub ceilings: BTreeMap<&'static str, BTreeMap<&'static str, &'static str>>,
    /// Login role → role used when nobody picked one.
    pub default_roles: BTreeMap<&'static str, &'static str>,
}

const LOGIN_ROLES: [Role; 2] = [Role::Physician, Role::Reception];

fn actions_at(area: Area, level: Level) -> Vec<&'static str> {
    let mut out: Vec<&'static str> = access::ACTION_RULES
        .iter()
        .filter(|r| r.any_of.iter().any(|&(a, l)| a == area && l == level))
        .map(|r| r.action)
        .collect();
    out.sort_unstable();
    out
}

pub fn catalog() -> AccessCatalogDto {
    let levels_after_none = Level::ALL.into_iter().filter(|l| *l != Level::None);
    AccessCatalogDto {
        levels: Level::ALL.into_iter().map(Level::wire).collect(),
        areas: Area::ALL
            .into_iter()
            .map(|area| AreaCatalogDto {
                area: area.wire(),
                scopable: SCOPABLE_AREAS.contains(&area),
                levels: levels_after_none
                    .clone()
                    .map(|level| LevelActionsDto {
                        level: level.wire(),
                        actions: actions_at(area, level),
                    })
                    .collect(),
            })
            .collect(),
        roles: LOGIN_ROLES
            .into_iter()
            .flat_map(|r| list_templates(Some(r)))
            .collect(),
        ceilings: LOGIN_ROLES
            .into_iter()
            .map(|role| {
                let caps = Area::ALL
                    .into_iter()
                    .map(|a| (a.wire(), access::ceiling(role, a).wire()))
                    .collect();
                (role_wire(role), caps)
            })
            .collect(),
        default_roles: LOGIN_ROLES
            .into_iter()
            .map(|r| (role_wire(r), access::default_template_id(r)))
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::catalog;

    #[test]
    fn every_enforced_action_appears_in_the_guide() {
        let c = catalog();
        let listed: std::collections::BTreeSet<&str> = c
            .areas
            .iter()
            .flat_map(|a| a.levels.iter().flat_map(|l| l.actions.iter().copied()))
            .collect();
        for rule in crate::domain::access::ACTION_RULES {
            assert!(
                listed.contains(rule.action),
                "{} missing from the catalogue",
                rule.action
            );
        }
    }

    #[test]
    fn roles_respect_their_ceiling() {
        let c = catalog();
        for role in &c.roles {
            let caps = &c.ceilings[role.base_role];
            for (area, level) in &role.levels {
                let order = |l: &str| c.levels.iter().position(|x| *x == l).unwrap();
                assert!(
                    order(level) <= order(caps[area]),
                    "{} exceeds ceiling in {}",
                    role.id,
                    area
                );
            }
        }
    }

    #[test]
    fn calendar_can_be_limited_to_own_records() {
        assert!(catalog()
            .areas
            .iter()
            .any(|a| a.area == "calendar" && a.scopable));
    }
}
