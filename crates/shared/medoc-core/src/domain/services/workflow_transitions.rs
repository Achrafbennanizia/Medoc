//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::domain::rbac::Role;
use crate::error::AppError;

fn status_transition_denied(current: &str, next: &str) -> AppError {
    AppError::validation_code_params(
        "error.workflow.status_transition",
        &[("current", current), ("next", next)],
    )
}

fn allowed_transition(current: &str, next: &str, allowed: &[&str]) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        return Ok(());
    }
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        Ok(())
    } else {
        Err(status_transition_denied(&cur, &nxt))
    }
}

/// FA-TERM-01: Appointment status workflow (see `commands/scheduling/appointment.rs`).
pub fn appointment_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "PLANNED" => &["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        "CONFIRMED" => &["COMPLETED", "CANCELLED", "NO_SHOW"],
        "COMPLETED" | "CANCELLED" | "NO_SHOW" | "NICHTERSCHIENEN" => &[],
        _ => return Ok(()),
    };
    allowed_transition(&cur, next, allowed)
}

/// FA-AKTE-14: reception/physician forward → queue (`IN_PROGRESS`).
pub fn patient_chart_forward_review_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "READONLY" {
        return Err(AppError::validation_code("error.workflow.chart_readonly"));
    }
    if s == "DRAFT" || s == "IN_PROGRESS" || s == "VALIDATED" || s == "DECLINED" {
        return Ok(());
    }
    Err(AppError::validation_code_params(
        "error.workflow.chart_status_invalid",
        &[("status", &s)],
    ))
}

/// FA-AKTE-15: validate PatientChart → `VALIDATED`.
pub fn patient_chart_validate_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "VALIDATED" || s == "READONLY" {
        return Err(AppError::validation_code(
            "error.workflow.chart_already_validated",
        ));
    }
    if s == "DRAFT" || s == "IN_PROGRESS" || s == "DECLINED" {
        return Ok(());
    }
    Err(AppError::validation_code_params(
        "error.workflow.chart_status_invalid",
        &[("status", &s)],
    ))
}

/// Pending-approval decline: PatientChart → `DECLINED` (leaves the validation queue).
pub fn patient_chart_decline_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "DECLINED" {
        return Ok(());
    }
    if s == "VALIDATED" || s == "READONLY" {
        return Err(AppError::validation_code(
            "error.workflow.chart_already_validated",
        ));
    }
    if s == "DRAFT" || s == "IN_PROGRESS" {
        return Ok(());
    }
    Err(AppError::validation_code_params(
        "error.workflow.chart_status_invalid",
        &[("status", &s)],
    ))
}

/// FA-PERS-08: Practice ticket lifecycle.
pub fn practice_ticket_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OPEN" => &["IN_PROGRESS", "DONE"],
        "IN_PROGRESS" => &["DONE", "OPEN"],
        "DONE" => &[],
        _ => {
            return Err(AppError::validation_code_params(
                "error.workflow.ticket_unknown_status",
                &[("status", &cur)],
            ))
        }
    };
    allowed_transition(&cur, next, allowed)
}

const TASK_STATUSES: &[&str] = &[
    "OPEN",
    "IN_PROGRESS",
    "DONE_RECEPTION",
    "VALIDATED",
    "BACK",
    "VIEWED",
    "DONE",
];

/// Workflow track derived from kind (no DB column): simple vs verify.
pub fn practice_task_workflow_track(kind: &str) -> &'static str {
    match kind.trim().to_uppercase().as_str() {
        "TICKET" | "APPOINTMENT" => "simple",
        _ => "verify",
    }
}

fn task_is_closed(status: &str) -> bool {
    let s = status.trim().to_uppercase();
    s == "VALIDATED" || s == "DONE"
}

fn task_closed() -> AppError {
    AppError::validation_code("error.workflow.task_closed")
}

/// Admin RBAC: any status change (except out of a closed terminal status).
pub fn practice_task_admin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        return Ok(());
    }
    if task_is_closed(&cur) {
        return Err(task_closed());
    }
    if !TASK_STATUSES.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        return Err(AppError::validation_code_params(
            "error.workflow.task_unknown_status",
            &[("status", &nxt)],
        ));
    }
    Ok(())
}

/// Verify track fulfill: `IN_PROGRESS` and `DONE_RECEPTION` (incl. reopen to `OPEN`).
fn practice_task_verify_fulfill_status_transition(
    current: &str,
    next: &str,
) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if task_is_closed(&cur) {
        return Err(task_closed());
    }
    let allowed: &[&str] = match cur.as_str() {
        "OPEN" => &["IN_PROGRESS"],
        "IN_PROGRESS" => &["DONE_RECEPTION", "OPEN"],
        "BACK" => &["OPEN", "IN_PROGRESS"],
        "DONE_RECEPTION" => &[],
        _ => {
            return Err(AppError::validation_code_params(
                "error.workflow.task_unknown_status",
                &[("status", &cur)],
            ))
        }
    };
    allowed_transition(&cur, &nxt, allowed)
}

/// Simple track fulfill: `OPEN → VIEWED → DONE` (reopen VIEWED → OPEN).
fn practice_task_simple_fulfill_status_transition(
    current: &str,
    next: &str,
) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if task_is_closed(&cur) {
        return Err(task_closed());
    }
    let allowed: &[&str] = match cur.as_str() {
        "OPEN" => &["VIEWED"],
        "VIEWED" => &["DONE", "OPEN"],
        "DONE" => &[],
        _ => {
            return Err(AppError::validation_code_params(
                "error.workflow.task_unknown_status",
                &[("status", &cur)],
            ))
        }
    };
    allowed_transition(&cur, &nxt, allowed)
}

fn practice_task_fulfill_status_transition(
    current: &str,
    next: &str,
    kind: &str,
) -> Result<(), AppError> {
    if practice_task_workflow_track(kind) == "simple" {
        practice_task_simple_fulfill_status_transition(current, next)
    } else {
        practice_task_verify_fulfill_status_transition(current, next)
    }
}

/// FA-AUFG-06: practice task — assignee (REZ pool or named physician) vs. creator (validation).
/// `rbac_fulfill` / `rbac_admin` mirror `task.status.fulfill` / `task.status.admin`.
/// Track is derived from `kind` (`TICKET`/`APPOINTMENT` = simple; else verify).
#[allow(clippy::too_many_arguments)]
pub fn practice_task_status_transition(
    current: &str,
    next: &str,
    kind: &str,
    actor_role: Role,
    assignee_role: Option<&str>,
    assignee_user_id: Option<&str>,
    created_by: &str,
    actor_user_id: &str,
    rbac_fulfill: bool,
    rbac_admin: bool,
) -> Result<(), AppError> {
    if rbac_admin {
        return practice_task_admin_status_transition(current, next);
    }

    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if task_is_closed(&cur) {
        return Err(task_closed());
    }

    let simple = practice_task_workflow_track(kind) == "simple";

    let to_reception = assignee_role
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("RECEPTION"));
    let assigned_user = assignee_user_id.map(str::trim).filter(|s| !s.is_empty());

    let is_fulfiller = match actor_role {
        Role::Reception => assigned_user
            .map(|id| id == actor_user_id)
            .unwrap_or(to_reception),
        Role::Physician if assigned_user.is_some_and(|id| id == actor_user_id) => true,
        _ => false,
    };
    let is_validator = !simple && actor_user_id == created_by.trim();

    // Verify track: completed task — creator validates/returns (even if also assignee).
    if is_validator && cur == "DONE_RECEPTION" {
        return allowed_transition(&cur, &nxt, &["VALIDATED", "BACK"]);
    }

    if is_fulfiller {
        return practice_task_fulfill_status_transition(current, next, kind);
    }

    if rbac_fulfill {
        if simple {
            if nxt != "VIEWED" && nxt != "DONE" {
                return Err(AppError::Unauthorized);
            }
        } else if nxt != "IN_PROGRESS" && nxt != "DONE_RECEPTION" {
            return Err(AppError::Unauthorized);
        }
        return practice_task_fulfill_status_transition(current, next, kind);
    }

    if is_validator {
        return match cur.as_str() {
            "DONE_RECEPTION" => allowed_transition(&cur, &nxt, &["VALIDATED", "BACK"]),
            _ => Err(AppError::validation_code(
                "error.workflow.task_validate_only_done",
            )),
        };
    }

    Err(AppError::Unauthorized)
}

/// PurchaseOrder lifecycle: `OPEN` → `IN_TRANSIT` → `DELIVERED` (or `CANCELLED`).
pub fn purchase_order_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OPEN" => &["IN_TRANSIT", "DELIVERED", "CANCELLED"],
        "IN_TRANSIT" => &["DELIVERED", "CANCELLED"],
        "DELIVERED" | "CANCELLED" => &[],
        _ => {
            return Err(AppError::validation_code_params(
                "error.workflow.purchase_order_unknown_status",
                &[("status", &cur)],
            ))
        }
    };
    allowed_transition(&cur, next, allowed)
}
