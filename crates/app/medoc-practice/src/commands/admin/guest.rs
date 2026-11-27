//! Solo guest account and inbox (docs/architecture/editions-plan.md §4.2).
//!
//! The guest proposes; the admin adds or dismisses. A proposal stores the IPC command it would run
//! and its arguments (checked against that command's input type when proposed). Adding replays the
//! command with the admin's session, so it passes the same checks as if the admin had made it.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac::{self, Role};
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::appointment::{AppointmentMove, CreateAppointment, UpdateAppointment};
use crate::domain::entities::patient::{CreatePatient, UpdatePatient};
use crate::domain::entities::payment::CreatePayment;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::admin::staged_change::{
    self as staged_repo, StagedChange, STATUS_ADDED, STATUS_DISMISSED, STATUS_PENDING,
};
use medoc_core::application::guest::{self, GuestAccount, SetGuestAccount};

/// Commands a guest may propose, and the action its profile must grant for it.
const PROPOSABLE: &[(&str, &str)] = &[
    ("create_appointment", "calendar.create"),
    ("update_appointment", "calendar.update"),
    ("move_appointments", "calendar.update"),
    ("create_patient", "patients.create"),
    ("update_patient", "patients.update"),
    ("create_payment", "cash.create"),
];

/// Admin-only commands here: the owner account manages the guest.
const ADMIN_ACTION: &str = "staff.write";

fn arg<T: serde::de::DeserializeOwned>(args: &Value, key: &str) -> Result<T, AppError> {
    let v = args
        .get(key)
        .cloned()
        .ok_or_else(|| AppError::Validation(format!("missing argument {key}")))?;
    serde_json::from_value(v).map_err(|e| AppError::Validation(format!("{key}: {e}")))
}

/// Same input types as the commands themselves: a malformed proposal is refused at once.
fn check_args(command: &str, args: &Value) -> Result<(), AppError> {
    match command {
        "create_appointment" => arg::<CreateAppointment>(args, "data").map(drop),
        "update_appointment" => {
            arg::<String>(args, "id")?;
            arg::<UpdateAppointment>(args, "data").map(drop)
        }
        "move_appointments" => arg::<Vec<AppointmentMove>>(args, "changes").map(drop),
        "create_patient" => arg::<CreatePatient>(args, "data").map(drop),
        "update_patient" => {
            arg::<String>(args, "id")?;
            arg::<UpdatePatient>(args, "data").map(drop)
        }
        "create_payment" => arg::<CreatePayment>(args, "data").map(drop),
        _ => Err(AppError::validation_code("error.guest.not_proposable")),
    }
}

fn id_of<T: Serialize>(value: &T) -> Option<String> {
    serde_json::to_value(value)
        .ok()?
        .get("id")?
        .as_str()
        .map(str::to_string)
}

/// Runs the proposal as the signed-in admin. Returns the id of the record it created or changed.
async fn replay(app: &AppHandle, command: &str, args: &Value) -> Result<Option<String>, AppError> {
    use crate::commands::{billing::payment, clinical::patient, scheduling::appointment};
    let pool = app.state::<SqlitePool>();
    let session = app.state::<SessionState>();
    Ok(match command {
        "create_appointment" => {
            id_of(&appointment::create_appointment(pool, session, arg(args, "data")?).await?)
        }
        "update_appointment" => id_of(
            &appointment::update_appointment(pool, session, arg(args, "id")?, arg(args, "data")?)
                .await?,
        ),
        "move_appointments" => {
            appointment::move_appointments(pool, session, arg(args, "changes")?).await?;
            None
        }
        "create_patient" => {
            id_of(&patient::create_patient(pool, session, arg(args, "data")?).await?)
        }
        "update_patient" => id_of(
            &patient::update_patient(pool, session, arg(args, "id")?, arg(args, "data")?).await?,
        ),
        "create_payment" => {
            id_of(&payment::create_payment(pool, session, arg(args, "data")?).await?)
        }
        _ => return Err(AppError::validation_code("error.guest.not_proposable")),
    })
}

#[tauri::command]
pub async fn guest_account_get(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<GuestAccount, AppError> {
    rbac::require(&session_state, ADMIN_ACTION)?;
    guest::get_account(&pool).await
}

#[tauri::command]
pub async fn guest_account_set(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    request: SetGuestAccount,
) -> Result<GuestAccount, AppError> {
    let session = rbac::require(&session_state, ADMIN_ACTION)?;
    let account = guest::set_account(&pool, &session, &request).await?;
    let details = serde_json::json!({
        "enabled": account.enabled,
        "clinicalRead": account.clinical_read,
        "documentsRead": account.documents_read,
    });
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "GuestAccount",
        account.staff_id.as_deref(),
        Some(&details.to_string()),
    )
    .await
    .ok();
    Ok(account)
}

/// The guest proposes a change. Nothing is written but the proposal.
#[tauri::command]
pub async fn staged_change_submit(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    command: String,
    args: Value,
    summary: Value,
) -> Result<StagedChange, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    if role != Role::Reception {
        return Err(AppError::validation_code(
            "error.guest.admin_writes_directly",
        ));
    }
    let (_, action) = PROPOSABLE
        .iter()
        .find(|(c, _)| *c == command)
        .ok_or_else(|| AppError::validation_code("error.guest.not_proposable"))?;
    if !rbac::proposal_allowed(action, role, &session.permission_overrides) {
        return Err(AppError::Forbidden);
    }
    check_args(&command, &args)?;
    let row = staged_repo::insert(
        &pool,
        &command,
        &args.to_string(),
        &summary.to_string(),
        &session.user_id,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "PROPOSE",
        "StagedChange",
        Some(&row.id),
        Some(&command),
    )
    .await
    .ok();
    Ok(row)
}

/// Admin: every proposal. Guest: its own.
#[tauri::command]
pub async fn staged_change_list(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    status: Option<String>,
) -> Result<Vec<StagedChange>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let own = Role::parse(&session.role) == Some(Role::Reception);
    staged_repo::list(
        &pool,
        status.as_deref(),
        own.then_some(session.user_id.as_str()),
    )
    .await
}

#[tauri::command]
pub async fn staged_change_count_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    if rbac::require(&session_state, ADMIN_ACTION).is_err() {
        return Ok(0);
    }
    staged_repo::count_pending(&pool).await
}

/// Admin adds a proposal: it runs now, with the admin's rights. A failure leaves it pending.
#[tauri::command]
pub async fn staged_change_add(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<StagedChange, AppError> {
    let session = rbac::require(&session_state, ADMIN_ACTION)?;
    let row = staged_repo::get(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("staged_change".into()))?;
    if row.status != STATUS_PENDING {
        return Err(AppError::validation_code("error.guest.already_decided"));
    }
    let args: Value =
        serde_json::from_str(&row.args_json).map_err(|e| AppError::Internal(e.to_string()))?;
    let result_id = replay(&app, &row.command, &args).await?;
    staged_repo::decide(
        &pool,
        &id,
        STATUS_ADDED,
        &session.user_id,
        None,
        result_id.as_deref(),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "ADD_PROPOSAL",
        "StagedChange",
        Some(&id),
        Some(&row.command),
    )
    .await
    .ok();
    staged_repo::get(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("staged_change".into()))
}

#[tauri::command]
pub async fn staged_change_dismiss(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    reason: Option<String>,
) -> Result<StagedChange, AppError> {
    let session = rbac::require(&session_state, ADMIN_ACTION)?;
    let reason = reason
        .map(|r| r.trim().to_string())
        .filter(|r| !r.is_empty());
    staged_repo::decide(
        &pool,
        &id,
        STATUS_DISMISSED,
        &session.user_id,
        reason.as_deref(),
        None,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DISMISS_PROPOSAL",
        "StagedChange",
        Some(&id),
        reason.as_deref(),
    )
    .await
    .ok();
    staged_repo::get(&pool, &id)
        .await?
        .ok_or_else(|| AppError::NotFound("staged_change".into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_proposable_command_has_an_input_check_and_a_real_action() {
        for (command, action) in PROPOSABLE {
            let err = check_args(command, &serde_json::json!({})).unwrap_err();
            assert!(
                !matches!(err, AppError::ValidationCode(ref c) if c == "error.guest.not_proposable"),
                "{command}"
            );
            assert!(
                medoc_core::domain::access::rule(action).is_some(),
                "{action}"
            );
        }
        assert!(check_args("delete_patient", &serde_json::json!({})).is_err());
    }
}
