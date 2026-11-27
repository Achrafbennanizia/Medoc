//! Access levels and role templates the access screen offers (split from `access_control.rs`).

use super::*;

pub fn role_wire(role: Role) -> &'static str {
    match role {
        Role::Physician => "PHYSICIAN",
        Role::Reception => "RECEPTION",
        Role::TaxAdvisor => "TAX_ADVISOR",
        Role::PharmaConsultant => "PHARMA_CONSULTANT",
    }
}

pub fn list_levels() -> Vec<LevelDto> {
    Level::ALL
        .into_iter()
        .map(|l| LevelDto {
            id: l.wire(),
            label: l.label(),
        })
        .collect()
}

/// Predefined profiles, optionally only those for one login role.
pub fn list_templates(role: Option<Role>) -> Vec<TemplateDto> {
    access::TEMPLATES
        .iter()
        .filter(|t| access::template_available(t))
        .filter(|t| match role {
            Some(r) => r == t.base_role,
            None => true,
        })
        .map(|t| TemplateDto {
            id: t.id,
            label: t.label,
            description: t.description,
            base_role: role_wire(t.base_role),
            levels: t
                .levels()
                .into_iter()
                .map(|(a, l)| (a.wire(), l.wire()))
                .collect(),
        })
        .collect()
}
