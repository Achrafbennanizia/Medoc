//! FA-AKTE-14/15, FA-PERS-08 — Akten-Workflow (Validierungs-Warteschlange, Weiterleitung, Tickets).
use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{
    akte_repo, audit_repo, in_app_notification_repo, patient_repo, personal_repo,
    praxis_ticket_repo,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForwardAkteArgs {
    pub patient_id: String,
    pub arzt_ids: Vec<String>,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePraxisTicketArgs {
    pub patient_id: String,
    pub to_arzt_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePraxisTicketStatusArgs {
    pub id: String,
    pub status: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_akten_zu_validieren(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<akte_repo::AkteZuValidierenRow>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if role != Role::Arzt {
        return Err(AppError::Unauthorized);
    }
    akte_repo::list_akten_zu_validieren(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_akten_zu_validieren(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if role != Role::Arzt {
        return Ok(0);
    }
    akte_repo::count_akten_zu_validieren(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn validate_patientenakte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<crate::domain::entities::Patientenakte, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let akte = akte_repo::validate_patientenakte_status(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "VALIDATE_AKTE",
        "Patientenakte",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(akte)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn forward_akte_to_physicians(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: ForwardAkteArgs,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if !matches!(role, Role::Arzt | Role::Rezeption) {
        return Err(AppError::Unauthorized);
    }
    let ids: Vec<String> = args
        .arzt_ids
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    if ids.is_empty() {
        return Err(AppError::validation_code(
            "error.akte.select_doctor_required",
        ));
    }
    patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let patient_name = patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_default();
    let from_name = personal_repo::find_by_id(&pool, &session.user_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_else(|| session.user_id.clone());
    for aid in &ids {
        let p = personal_repo::find_by_id(&pool, aid)
            .await?
            .ok_or_else(|| {
                AppError::validation_code_params("error.akte.unknown_doctor", &[("id", aid)])
            })?;
        if !p.rolle.eq_ignore_ascii_case("ARZT") {
            return Err(AppError::validation_code_params(
                "error.akte.not_doctor",
                &[("name", &p.name)],
            ));
        }
    }
    let note = args.message.as_deref().unwrap_or("").trim();
    let payload = json!({
        "patientId": args.patient_id,
        "fromUserId": session.user_id,
        "fromName": from_name,
        "note": note,
    });
    let payload_str = payload.to_string();
    let title = "Akte — Review angefragt";
    let body = if note.is_empty() {
        format!("{from_name} bittet um Prüfung der Akte ({patient_name}).")
    } else {
        format!("{from_name} ({patient_name}): {note}")
    };
    for aid in &ids {
        if aid == &session.user_id {
            continue;
        }
        in_app_notification_repo::insert(
            &pool,
            aid,
            "AKTE_FORWARD",
            title,
            &body,
            Some(&payload_str),
        )
        .await?;
    }
    let details = format!("an {} Empfänger", ids.len());
    audit_repo::create(
        &pool,
        &session.user_id,
        "FORWARD_AKTE",
        "Patient",
        Some(&args.patient_id),
        Some(&details),
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn create_praxis_ticket(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CreatePraxisTicketArgs,
) -> Result<praxis_ticket_repo::PraxisTicket, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if role != Role::Rezeption {
        return Err(AppError::Unauthorized);
    }
    let body = args.body.trim();
    if body.is_empty() {
        return Err(AppError::validation_code("error.akte.message_empty"));
    }
    patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let to = personal_repo::find_by_id(&pool, &args.to_arzt_id)
        .await?
        .ok_or(AppError::NotFound("error.entity.arzt".into()))?;
    if !to.rolle.eq_ignore_ascii_case("ARZT") {
        return Err(AppError::validation_code(
            "error.akte.target_must_be_doctor",
        ));
    }
    let t = praxis_ticket_repo::insert(
        &pool,
        &args.patient_id,
        &session.user_id,
        &args.to_arzt_id,
        body,
    )
    .await?;
    let pname = patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_default();
    let title = format!("Ticket: {pname}");
    let notif_body = if body.len() > 200 {
        format!("{}…", &body[..200])
    } else {
        body.to_string()
    };
    let pay = json!({ "ticketId": t.id, "patientId": args.patient_id }).to_string();
    in_app_notification_repo::insert(
        &pool,
        &args.to_arzt_id,
        "PRAXIS_TICKET",
        &title,
        &notif_body,
        Some(&pay),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PraxisTicket",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_praxis_tickets_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_ticket_repo::PraxisTicket>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Arzt => praxis_ticket_repo::list_for_arzt(&pool, &session.user_id, 200).await,
        Role::Rezeption => praxis_ticket_repo::list_created_by(&pool, &session.user_id, 200).await,
        _ => Err(AppError::Unauthorized),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn update_praxis_ticket_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: UpdatePraxisTicketStatusArgs,
) -> Result<praxis_ticket_repo::PraxisTicket, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if role != Role::Arzt {
        return Err(AppError::Unauthorized);
    }
    let st = args.status.trim().to_uppercase();
    let current = praxis_ticket_repo::find_by_id(&pool, &args.id)
        .await?
        .ok_or(AppError::NotFound("error.entity.ticket".into()))?;
    workflow_transitions::praxis_ticket_status_transition(&current.status, &st)?;
    let out = praxis_ticket_repo::update_status(&pool, &args.id, &session.user_id, &st).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PraxisTicket",
        Some(&args.id),
        Some(&st),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_open_praxis_tickets_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if role != Role::Arzt {
        return Ok(0);
    }
    praxis_ticket_repo::count_open_for_arzt(&pool, &session.user_id).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_akte_workflow_commands {
    () => {
        $crate::commands::akte_workflow_commands::list_akten_zu_validieren,
        $crate::commands::akte_workflow_commands::count_akten_zu_validieren,
        $crate::commands::akte_workflow_commands::validate_patientenakte,
        $crate::commands::akte_workflow_commands::forward_akte_to_physicians,
        $crate::commands::akte_workflow_commands::create_praxis_ticket,
        $crate::commands::akte_workflow_commands::list_praxis_tickets_for_me,
        $crate::commands::akte_workflow_commands::update_praxis_ticket_status,
        $crate::commands::akte_workflow_commands::count_open_praxis_tickets_for_me,
    };
}
