//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::domain::rbac::Role;
use crate::error::AppError;
use crate::log_workflow;

fn status_transition_denied(current: &str, next: &str) -> AppError {
    AppError::validation_code_params(
        "error.workflow.status_transition",
        &[("current", current), ("next", next)],
    )
}

fn allowed_transition(
    machine: &str,
    current: &str,
    next: &str,
    allowed: &[&str],
) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        log_workflow!(
            info,
            event = "DOMAIN_STATE_NOOP",
            machine = machine,
            state = %cur
        );
        return Ok(());
    }
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        log_workflow!(
            info,
            event = "DOMAIN_STATE_TRANSITION_ALLOWED",
            machine = machine,
            from = %cur,
            to = %nxt
        );
        Ok(())
    } else {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = machine,
            from = %cur,
            to = %nxt,
            allowed = ?allowed
        );
        Err(status_transition_denied(&cur, &nxt))
    }
}

/// FA-TERM-01: Appointment status workflow (see `appointment_commands.rs` doc).
pub fn appointment_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "PLANNED" => &["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
        "CONFIRMED" => &["COMPLETED", "CANCELLED", "NO_SHOW"],
        "COMPLETED" | "CANCELLED" | "NO_SHOW" | "NICHTERSCHIENEN" => &[],
        _ => return Ok(()),
    };
    allowed_transition("appointment.status", &cur, next, allowed)
}

/// FA-AKTE-14: reception/physician forward → queue (`IN_PROGRESS`).
pub fn patient_chart_forward_review_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "READONLY" {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = "patient_chart.review",
            from = %s,
            to = "IN_PROGRESS"
        );
        return Err(AppError::validation_code("error.workflow.chart_readonly"));
    }
    if s == "DRAFT" || s == "IN_PROGRESS" || s == "VALIDATED" {
        log_workflow!(
            info,
            event = "DOMAIN_STATE_TRANSITION_ALLOWED",
            machine = "patient_chart.review",
            from = %s,
            to = "IN_PROGRESS"
        );
        return Ok(());
    }
    log_workflow!(
        warn,
        event = "DOMAIN_STATE_TRANSITION_DENIED",
        machine = "patient_chart.review",
        from = %s,
        to = "IN_PROGRESS"
    );
    Err(AppError::validation_code_params(
        "error.workflow.chart_status_invalid",
        &[("status", &s)],
    ))
}

/// FA-AKTE-15: validate PatientChart → `VALIDATED`.
pub fn patient_chart_validate_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "VALIDATED" || s == "READONLY" {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = "patient_chart.validate",
            from = %s,
            to = "VALIDATED"
        );
        return Err(AppError::validation_code(
            "error.workflow.chart_already_validated",
        ));
    }
    if s == "DRAFT" || s == "IN_PROGRESS" {
        log_workflow!(
            info,
            event = "DOMAIN_STATE_TRANSITION_ALLOWED",
            machine = "patient_chart.validate",
            from = %s,
            to = "VALIDATED"
        );
        return Ok(());
    }
    log_workflow!(
        warn,
        event = "DOMAIN_STATE_TRANSITION_DENIED",
        machine = "patient_chart.validate",
        from = %s,
        to = "VALIDATED"
    );
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
    allowed_transition("practice_ticket.status", &cur, next, allowed)
}

const TASK_STATUSES: &[&str] = &["OPEN", "IN_PROGRESS", "DONE_RECEPTION", "VALIDATED", "BACK"];

fn task_closed() -> AppError {
    AppError::validation_code("error.workflow.task_closed")
}

/// Admin RBAC: any status change (except out of `VALIDATED`).
pub fn practice_task_admin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        log_workflow!(
            info,
            event = "DOMAIN_STATE_NOOP",
            machine = "practice_task.admin",
            state = %cur
        );
        return Ok(());
    }
    if cur == "VALIDATED" {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = "practice_task.admin",
            from = %cur,
            to = %nxt
        );
        return Err(task_closed());
    }
    if !TASK_STATUSES.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = "practice_task.admin",
            from = %cur,
            to = %nxt
        );
        return Err(AppError::validation_code_params(
            "error.workflow.task_unknown_status",
            &[("status", &nxt)],
        ));
    }
    log_workflow!(
        info,
        event = "DOMAIN_STATE_TRANSITION_ALLOWED",
        machine = "practice_task.admin",
        from = %cur,
        to = %nxt
    );
    Ok(())
}

/// Fulfill RBAC / assignee: `IN_PROGRESS` and `DONE_RECEPTION` (incl. reopen to `OPEN`).
fn practice_task_fulfill_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == "VALIDATED" {
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
    allowed_transition("practice_task.fulfill", &cur, &nxt, allowed)
}

/// FA-AUFG-06: practice task — assignee (REZ pool or named physician) vs. creator (validation).
/// `rbac_fulfill` / `rbac_admin` mirror `task.status.fulfill` / `task.status.admin`.
#[allow(clippy::too_many_arguments)]
pub fn practice_task_status_transition(
    current: &str,
    next: &str,
    actor_role: Role,
    assignee_role: Option<&str>,
    assignee_user_id: Option<&str>,
    created_by: &str,
    actor_user_id: &str,
    rbac_fulfill: bool,
    rbac_admin: bool,
) -> Result<(), AppError> {
    let current_state = current.trim().to_uppercase();
    let next_state = next.trim().to_uppercase();
    if rbac_admin {
        return practice_task_admin_status_transition(current, next);
    }

    if current_state == "VALIDATED" {
        log_workflow!(
            warn,
            event = "DOMAIN_STATE_TRANSITION_DENIED",
            machine = "practice_task.status",
            from = %current_state,
            to = %next_state
        );
        return Err(task_closed());
    }

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
    let is_validator = actor_user_id == created_by.trim();

    // Completed task: creator validates/returns — even if creator was also the assignee.
    if is_validator && current_state == "DONE_RECEPTION" {
        return allowed_transition(
            "practice_task.status",
            &current_state,
            &next_state,
            &["VALIDATED", "BACK"],
        );
    }

    if is_fulfiller {
        return practice_task_fulfill_status_transition(current, next);
    }

    if rbac_fulfill {
        if next_state != "IN_PROGRESS" && next_state != "DONE_RECEPTION" {
            log_workflow!(
                warn,
                event = "DOMAIN_STATE_TRANSITION_DENIED",
                machine = "practice_task.status",
                from = %current_state,
                to = %next_state
            );
            return Err(AppError::Unauthorized);
        }
        return practice_task_fulfill_status_transition(current, next);
    }

    if is_validator {
        return match current_state.as_str() {
            "DONE_RECEPTION" => allowed_transition(
                "practice_task.status",
                &current_state,
                &next_state,
                &["VALIDATED", "BACK"],
            ),
            _ => {
                log_workflow!(
                    warn,
                    event = "DOMAIN_STATE_TRANSITION_DENIED",
                    machine = "practice_task.status",
                    from = %current_state,
                    to = %next_state
                );
                Err(AppError::validation_code(
                    "error.workflow.task_validate_only_done",
                ))
            }
        };
    }

    log_workflow!(
        warn,
        event = "DOMAIN_STATE_TRANSITION_DENIED",
        machine = "practice_task.status",
        from = %current_state,
        to = %next_state
    );
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
    allowed_transition("purchase_order.status", &cur, next, allowed)
}
