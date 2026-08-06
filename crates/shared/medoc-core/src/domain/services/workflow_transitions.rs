//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::domain::rbac::Role;
use crate::error::AppError;

fn log_transition(workflow: &str, current: &str, next: &str, outcome: &str, reason: &str) {
    crate::log_workflow!(
        info,
        event = "DOMAIN_STATE_TRANSITION",
        workflow = workflow,
        from = current,
        to = next,
        outcome = outcome,
        reason = reason
    );
}

fn log_transition_denied(workflow: &str, current: &str, next: &str, reason: &str) {
    crate::log_workflow!(
        warn,
        event = "DOMAIN_STATE_TRANSITION_DENIED",
        workflow = workflow,
        from = current,
        to = next,
        reason = reason
    );
}

fn status_transition_denied(current: &str, next: &str) -> AppError {
    AppError::validation_code_params(
        "error.workflow.status_transition",
        &[("current", current), ("next", next)],
    )
}

fn allowed_transition(
    workflow: &str,
    current: &str,
    next: &str,
    allowed: &[&str],
) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        log_transition(workflow, &cur, &nxt, "no_change", "same_status");
        return Ok(());
    }
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        log_transition(workflow, &cur, &nxt, "allowed", "rule_match");
        Ok(())
    } else {
        log_transition_denied(workflow, &cur, &nxt, "rule_mismatch");
        Err(status_transition_denied(&cur, &nxt))
    }
}

/// FA-TERM-01: Termin status workflow (see `termin_commands.rs` doc).
pub fn termin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "GEPLANT" => &[
            "BESTAETIGT",
            "DURCHGEFUEHRT",
            "ABGESAGT",
            "NICHT_ERSCHIENEN",
        ],
        "BESTAETIGT" => &["DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"],
        "DURCHGEFUEHRT" | "ABGESAGT" | "NICHT_ERSCHIENEN" | "NICHTERSCHIENEN" => &[],
        _ => {
            log_transition(
                "termin_status",
                &cur,
                &next.trim().to_uppercase(),
                "ignored",
                "unknown_current_status",
            );
            return Ok(());
        }
    };
    allowed_transition("termin_status", &cur, next, allowed)
}

/// FA-AKTE-14: reception/physician forward → queue (`IN_BEARBEITUNG`).
pub fn patientenakte_forward_review_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "READONLY" {
        log_transition_denied(
            "patientenakte_forward_review",
            &s,
            "IN_BEARBEITUNG",
            "readonly",
        );
        return Err(AppError::validation_code("error.workflow.akte_readonly"));
    }
    if s == "ENTWURF" || s == "IN_BEARBEITUNG" || s == "VALIDIERT" {
        log_transition(
            "patientenakte_forward_review",
            &s,
            "IN_BEARBEITUNG",
            "allowed",
            "rule_match",
        );
        return Ok(());
    }
    log_transition_denied(
        "patientenakte_forward_review",
        &s,
        "IN_BEARBEITUNG",
        "invalid_status",
    );
    Err(AppError::validation_code_params(
        "error.workflow.akte_status_invalid",
        &[("status", &s)],
    ))
}

/// FA-AKTE-15: validate Patientenakte → `VALIDIERT`.
pub fn patientenakte_validate_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "VALIDIERT" || s == "READONLY" {
        log_transition_denied("patientenakte_validate", &s, "VALIDIERT", "already_closed");
        return Err(AppError::validation_code(
            "error.workflow.akte_already_validated",
        ));
    }
    if s == "ENTWURF" || s == "IN_BEARBEITUNG" {
        log_transition(
            "patientenakte_validate",
            &s,
            "VALIDIERT",
            "allowed",
            "rule_match",
        );
        return Ok(());
    }
    log_transition_denied("patientenakte_validate", &s, "VALIDIERT", "invalid_status");
    Err(AppError::validation_code_params(
        "error.workflow.akte_status_invalid",
        &[("status", &s)],
    ))
}

/// FA-PERS-08: Praxis ticket lifecycle.
pub fn praxis_ticket_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["IN_BEARBEITUNG", "ERLEDIGT"],
        "IN_BEARBEITUNG" => &["ERLEDIGT", "OFFEN"],
        "ERLEDIGT" => &[],
        _ => {
            log_transition_denied(
                "praxis_ticket_status",
                &cur,
                &next.trim().to_uppercase(),
                "unknown_current_status",
            );
            return Err(AppError::validation_code_params(
                "error.workflow.ticket_unknown_status",
                &[("status", &cur)],
            ));
        }
    };
    allowed_transition("praxis_ticket_status", &cur, next, allowed)
}

const AUFGABE_STATUSES: &[&str] = &[
    "OFFEN",
    "IN_BEARBEITUNG",
    "ERLEDIGT_REZEPTION",
    "VALIDIERT",
    "ZURUECK",
];

fn aufgabe_closed() -> AppError {
    AppError::validation_code("error.workflow.aufgabe_closed")
}

/// Admin RBAC: any status change (except out of `VALIDIERT`).
pub fn praxis_aufgabe_admin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        log_transition(
            "praxis_aufgabe_admin_status",
            &cur,
            &nxt,
            "no_change",
            "same_status",
        );
        return Ok(());
    }
    if cur == "VALIDIERT" {
        log_transition_denied("praxis_aufgabe_admin_status", &cur, &nxt, "already_closed");
        return Err(aufgabe_closed());
    }
    if !AUFGABE_STATUSES
        .iter()
        .any(|s| s.eq_ignore_ascii_case(&nxt))
    {
        log_transition_denied(
            "praxis_aufgabe_admin_status",
            &cur,
            &nxt,
            "unknown_target_status",
        );
        return Err(AppError::validation_code_params(
            "error.workflow.aufgabe_unknown_status",
            &[("status", &nxt)],
        ));
    }
    log_transition(
        "praxis_aufgabe_admin_status",
        &cur,
        &nxt,
        "allowed",
        "admin_override",
    );
    Ok(())
}

/// Fulfill RBAC / assignee: `IN_BEARBEITUNG` and `ERLEDIGT_REZEPTION` (incl. reopen to `OFFEN`).
fn praxis_aufgabe_fulfill_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == "VALIDIERT" {
        log_transition_denied(
            "praxis_aufgabe_fulfill_status",
            &cur,
            &nxt,
            "already_closed",
        );
        return Err(aufgabe_closed());
    }
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["IN_BEARBEITUNG"],
        "IN_BEARBEITUNG" => &["ERLEDIGT_REZEPTION", "OFFEN"],
        "ZURUECK" => &["OFFEN", "IN_BEARBEITUNG"],
        "ERLEDIGT_REZEPTION" => &[],
        _ => {
            log_transition_denied(
                "praxis_aufgabe_fulfill_status",
                &cur,
                &nxt,
                "unknown_current_status",
            );
            return Err(AppError::validation_code_params(
                "error.workflow.aufgabe_unknown_status",
                &[("status", &cur)],
            ));
        }
    };
    allowed_transition("praxis_aufgabe_fulfill_status", &cur, &nxt, allowed)
}

/// FA-AUFG-06: practice task — assignee (REZ pool or named physician) vs. creator (validation).
/// `rbac_fulfill` / `rbac_admin` mirror `aufgabe.status.fulfill` / `aufgabe.status.admin`.
#[allow(clippy::too_many_arguments)]
pub fn praxis_aufgabe_status_transition(
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
    if rbac_admin {
        return praxis_aufgabe_admin_status_transition(current, next);
    }

    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == "VALIDIERT" {
        return Err(aufgabe_closed());
    }

    let to_rezeption = assignee_role
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("REZEPTION"));
    let assigned_user = assignee_user_id.map(str::trim).filter(|s| !s.is_empty());

    let is_fulfiller = match actor_role {
        Role::Rezeption => assigned_user
            .map(|id| id == actor_user_id)
            .unwrap_or(to_rezeption),
        Role::Arzt if assigned_user.is_some_and(|id| id == actor_user_id) => true,
        _ => false,
    };
    let is_validator = actor_user_id == created_by.trim();

    // Completed task: creator validates/returns — even if creator was also the assignee.
    if is_validator && cur == "ERLEDIGT_REZEPTION" {
        return allowed_transition(
            "praxis_aufgabe_status_validator",
            &cur,
            &nxt,
            &["VALIDIERT", "ZURUECK"],
        );
    }

    if is_fulfiller {
        return praxis_aufgabe_fulfill_status_transition(current, next);
    }

    if rbac_fulfill {
        if nxt != "IN_BEARBEITUNG" && nxt != "ERLEDIGT_REZEPTION" {
            return Err(AppError::Unauthorized);
        }
        return praxis_aufgabe_fulfill_status_transition(current, next);
    }

    if is_validator {
        return match cur.as_str() {
            "ERLEDIGT_REZEPTION" => allowed_transition(
                "praxis_aufgabe_status_validator",
                &cur,
                &nxt,
                &["VALIDIERT", "ZURUECK"],
            ),
            _ => Err(AppError::validation_code(
                "error.workflow.aufgabe_validate_only_done",
            )),
        };
    }

    Err(AppError::Unauthorized)
}

/// Bestellung lifecycle: `OFFEN` → `UNTERWEGS` → `GELIEFERT` (or `STORNIERT`).
pub fn bestellung_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["UNTERWEGS", "GELIEFERT", "STORNIERT"],
        "UNTERWEGS" => &["GELIEFERT", "STORNIERT"],
        "GELIEFERT" | "STORNIERT" => &[],
        _ => {
            log_transition_denied(
                "bestellung_status",
                &cur,
                &next.trim().to_uppercase(),
                "unknown_current_status",
            );
            return Err(AppError::validation_code_params(
                "error.workflow.bestellung_unknown_status",
                &[("status", &cur)],
            ));
        }
    };
    allowed_transition("bestellung_status", &cur, next, allowed)
}
