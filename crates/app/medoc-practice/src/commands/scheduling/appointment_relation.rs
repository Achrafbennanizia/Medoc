//! Relationship check for the calendar: a person whose calendar access is limited to their own
//! appointments may only create, change, move or delete appointments assigned to them
//! (domain::access_relation). Without that scope this check always passes.

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;
use medoc_core::domain::access::Area;
use medoc_core::domain::access_relation::may_act_on;
use medoc_core::infrastructure::database::repos::scheduling::appointment as appointment_repo;

use crate::error::AppError;

pub const ERR_OWN_ONLY: &str = "error.access.own_appointments_only";

pub fn require_own_clinician(session: &Session, clinician_id: &str) -> Result<(), AppError> {
    if may_act_on(
        &session.permission_overrides,
        Area::Calendar,
        &session.user_id,
        clinician_id,
    ) {
        Ok(())
    } else {
        Err(AppError::validation_code(ERR_OWN_ONLY))
    }
}

/// Loads the appointment and checks its assigned clinician. Missing appointments pass through,
/// so the command reports "not found" as before.
pub async fn require_own_appointment(
    pool: &SqlitePool,
    session: &Session,
    id: &str,
) -> Result<(), AppError> {
    match appointment_repo::find_by_id(pool, id).await? {
        Some(a) => require_own_clinician(session, &a.physician_id),
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::domain::rbac::PermissionOverride;

    fn session(scoped: bool) -> Session {
        Session {
            user_id: "me".into(),
            name: String::new(),
            email: String::new(),
            role: "PHYSICIAN".into(),
            permission_overrides: if scoped {
                vec![PermissionOverride {
                    action: "scope.own.calendar".into(),
                    effect: "ALLOW".into(),
                }]
            } else {
                vec![]
            },
            device_session_id: None,
            token_version: 0,
        }
    }

    #[test]
    fn scoped_person_may_only_touch_own_appointments() {
        assert!(require_own_clinician(&session(true), "me").is_ok());
        assert!(require_own_clinician(&session(true), "other").is_err());
        assert!(require_own_clinician(&session(false), "other").is_ok());
    }
}
