//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::domain::rbac::Role;
use crate::error::AppError;
use crate::infrastructure::logging::sanitizer;
use crate::log_workflow;

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

fn log_transition_attempt(workflow: &str, current: &str, next: &str) {
    log_workflow!(
        info,
        event = "DOMAIN_WORKFLOW_TRANSITION_ATTEMPT",
        workflow,
        current,
        next
    );
}

fn log_transition_result(workflow: &str, current: &str, next: &str, result: &Result<(), AppError>) {
    match result {
        Ok(()) => {
            log_workflow!(
                info,
                event = "DOMAIN_WORKFLOW_TRANSITION_ALLOWED",
                workflow,
                current,
                next
            );
        }
        Err(err) => {
            let error = sanitizer::sanitize(&err.to_string());
            log_workflow!(
                warn,
                event = "DOMAIN_WORKFLOW_TRANSITION_DENIED",
                workflow,
                current,
                next,
                error = %error
            );
        }
    }
}

fn role_label(role: Role) -> &'static str {
    match role {
        Role::Arzt => "ARZT",
        Role::Rezeption => "REZEPTION",
        Role::Steuerberater => "STEUERBERATER",
        Role::Pharmaberater => "PHARMABERATER",
    }
}

/// FA-TERM-01: Termin status workflow (see `termin_commands.rs` doc).
pub fn termin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    log_transition_attempt("termin_status", &cur, &nxt);
    let result = match cur.as_str() {
        "GEPLANT" => allowed_transition(
            &cur,
            &nxt,
            &[
                "BESTAETIGT",
                "DURCHGEFUEHRT",
                "ABGESAGT",
                "NICHT_ERSCHIENEN",
            ],
        ),
        "BESTAETIGT" => allowed_transition(
            &cur,
            &nxt,
            &["DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"],
        ),
        "DURCHGEFUEHRT" | "ABGESAGT" | "NICHT_ERSCHIENEN" | "NICHTERSCHIENEN" => {
            allowed_transition(&cur, &nxt, &[])
        }
        _ => Ok(()),
    };
    log_transition_result("termin_status", &cur, &nxt, &result);
    result
}

/// FA-AKTE-14: reception/physician forward → queue (`IN_BEARBEITUNG`).
pub fn patientenakte_forward_review_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    log_transition_attempt("patientenakte_forward_review", &s, "IN_BEARBEITUNG");
    let result = if s == "READONLY" {
        Err(AppError::validation_code("error.workflow.akte_readonly"))
    } else if s == "ENTWURF" || s == "IN_BEARBEITUNG" || s == "VALIDIERT" {
        Ok(())
    } else {
        Err(AppError::validation_code_params(
            "error.workflow.akte_status_invalid",
            &[("status", &s)],
        ))
    };
    log_transition_result(
        "patientenakte_forward_review",
        &s,
        "IN_BEARBEITUNG",
        &result,
    );
    result
}

/// FA-AKTE-15: validate Patientenakte → `VALIDIERT`.
pub fn patientenakte_validate_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    log_transition_attempt("patientenakte_validate", &s, "VALIDIERT");
    let result = if s == "VALIDIERT" || s == "READONLY" {
        Err(AppError::validation_code(
            "error.workflow.akte_already_validated",
        ))
    } else if s == "ENTWURF" || s == "IN_BEARBEITUNG" {
        Ok(())
    } else {
        Err(AppError::validation_code_params(
            "error.workflow.akte_status_invalid",
            &[("status", &s)],
        ))
    };
    log_transition_result("patientenakte_validate", &s, "VALIDIERT", &result);
    result
}

/// FA-PERS-08: Praxis ticket lifecycle.
pub fn praxis_ticket_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    log_transition_attempt("praxis_ticket_status", &cur, &nxt);
    let result = match cur.as_str() {
        "OFFEN" => allowed_transition(&cur, &nxt, &["IN_BEARBEITUNG", "ERLEDIGT"]),
        "IN_BEARBEITUNG" => allowed_transition(&cur, &nxt, &["ERLEDIGT", "OFFEN"]),
        "ERLEDIGT" => allowed_transition(&cur, &nxt, &[]),
        _ => Err(AppError::validation_code_params(
            "error.workflow.ticket_unknown_status",
            &[("status", &cur)],
        )),
    };
    log_transition_result("praxis_ticket_status", &cur, &nxt, &result);
    result
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
    log_transition_attempt("praxis_aufgabe_admin_status", &cur, &nxt);
    let result = if cur == nxt {
        Ok(())
    } else if cur == "VALIDIERT" {
        Err(aufgabe_closed())
    } else if !AUFGABE_STATUSES
        .iter()
        .any(|s| s.eq_ignore_ascii_case(&nxt))
    {
        Err(AppError::validation_code_params(
            "error.workflow.aufgabe_unknown_status",
            &[("status", &nxt)],
        ))
    } else {
        Ok(())
    };
    log_transition_result("praxis_aufgabe_admin_status", &cur, &nxt, &result);
    result
}

/// Fulfill RBAC / assignee: `IN_BEARBEITUNG` and `ERLEDIGT_REZEPTION` (incl. reopen to `OFFEN`).
fn praxis_aufgabe_fulfill_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    log_transition_attempt("praxis_aufgabe_fulfill_status", &cur, &nxt);
    let result = if cur == "VALIDIERT" {
        Err(aufgabe_closed())
    } else {
        match cur.as_str() {
            "OFFEN" => allowed_transition(&cur, &nxt, &["IN_BEARBEITUNG"]),
            "IN_BEARBEITUNG" => allowed_transition(&cur, &nxt, &["ERLEDIGT_REZEPTION", "OFFEN"]),
            "ZURUECK" => allowed_transition(&cur, &nxt, &["OFFEN", "IN_BEARBEITUNG"]),
            "ERLEDIGT_REZEPTION" => allowed_transition(&cur, &nxt, &[]),
            _ => Err(AppError::validation_code_params(
                "error.workflow.aufgabe_unknown_status",
                &[("status", &cur)],
            )),
        }
    };
    log_transition_result("praxis_aufgabe_fulfill_status", &cur, &nxt, &result);
    result
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
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    log_workflow!(
        info,
        event = "DOMAIN_WORKFLOW_TRANSITION_ATTEMPT",
        workflow = "praxis_aufgabe_status",
        current = %cur,
        next = %nxt,
        actor_role = role_label(actor_role),
        assignee_role = ?assignee_role,
        assignee_user_id = ?assignee_user_id,
        created_by = %created_by,
        actor_user_id = %actor_user_id,
        rbac_fulfill,
        rbac_admin
    );

    let result = if rbac_admin {
        praxis_aufgabe_admin_status_transition(current, next)
    } else if cur == "VALIDIERT" {
        Err(aufgabe_closed())
    } else {
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
            allowed_transition(&cur, &nxt, &["VALIDIERT", "ZURUECK"])
        } else if is_fulfiller {
            praxis_aufgabe_fulfill_status_transition(current, next)
        } else if rbac_fulfill {
            if nxt != "IN_BEARBEITUNG" && nxt != "ERLEDIGT_REZEPTION" {
                Err(AppError::Unauthorized)
            } else {
                praxis_aufgabe_fulfill_status_transition(current, next)
            }
        } else if is_validator {
            match cur.as_str() {
                "ERLEDIGT_REZEPTION" => allowed_transition(&cur, &nxt, &["VALIDIERT", "ZURUECK"]),
                _ => Err(AppError::validation_code(
                    "error.workflow.aufgabe_validate_only_done",
                )),
            }
        } else {
            Err(AppError::Unauthorized)
        }
    };

    log_transition_result("praxis_aufgabe_status", &cur, &nxt, &result);
    result
}

/// Bestellung lifecycle: `OFFEN` → `UNTERWEGS` → `GELIEFERT` (or `STORNIERT`).
pub fn bestellung_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    log_transition_attempt("bestellung_status", &cur, &nxt);
    let result = match cur.as_str() {
        "OFFEN" => allowed_transition(&cur, &nxt, &["UNTERWEGS", "GELIEFERT", "STORNIERT"]),
        "UNTERWEGS" => allowed_transition(&cur, &nxt, &["GELIEFERT", "STORNIERT"]),
        "GELIEFERT" | "STORNIERT" => allowed_transition(&cur, &nxt, &[]),
        _ => Err(AppError::validation_code_params(
            "error.workflow.bestellung_unknown_status",
            &[("status", &cur)],
        )),
    };
    log_transition_result("bestellung_status", &cur, &nxt, &result);
    result
}
