//! FA-AUFG — who may see or work a practice task (chat-like direct assign vs. REZ pool).
use crate::domain::entities::praxis_aufgabe::PraxisAufgabe;
use crate::domain::rbac::Role;
use crate::error::AppError;

/// Shared Rezeption pool — no named assignee.
pub fn is_pool_task(a: &PraxisAufgabe) -> bool {
    a.assignee_role
        .as_deref()
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("REZEPTION"))
        && a.assignee_user_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_none()
}

/// Direct 1:1 thread — visible only to creator and named assignee (plus admin elsewhere).
pub fn is_direct_task(a: &PraxisAufgabe) -> bool {
    a.assignee_user_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|s| !s.is_empty())
}

/// Inbox / transition guard: creator, named assignee, or (reception + pool task).
pub fn user_can_view_aufgabe(a: &PraxisAufgabe, user_id: &str, role: Role) -> bool {
    let uid = user_id.trim();
    if a.created_by.trim() == uid {
        return true;
    }
    if a.assignee_user_id
        .as_deref()
        .map(str::trim)
        .is_some_and(|id| id == uid)
    {
        return true;
    }
    role == Role::Rezeption && is_pool_task(a)
}

pub fn assert_user_can_view_aufgabe(
    a: &PraxisAufgabe,
    user_id: &str,
    role: Role,
) -> Result<(), AppError> {
    if user_can_view_aufgabe(a, user_id, role) {
        Ok(())
    } else {
        Err(AppError::Unauthorized)
    }
}
