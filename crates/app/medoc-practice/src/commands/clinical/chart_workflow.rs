//! FA-AKTE-14/15, FA-PERS-08 — Chart workflow (validation queue, forwarding, tickets).
use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{
    chart_repo, audit_repo, in_app_notification_repo, patient_repo, staff_repo,
    practice_ticket_repo,
};
use serde::Deserialize;
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForwardChartArgs {
    pub patient_id: String,
    pub physician_ids: Vec<String>,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePracticeTicketArgs {
    pub patient_id: String,
    pub to_physician_id: String,
    pub body: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePracticeTicketStatusArgs {
    pub id: String,
    pub status: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_charts_to_validate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<chart_repo::ChartToValidateRow>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if role != Role::Physician {
        return Err(AppError::Unauthorized);
    }
    chart_repo::list_charts_to_validate(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_charts_to_validate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if role != Role::Physician {
        return Ok(0);
    }
    chart_repo::count_charts_to_validate(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn validate_patient_chart(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<crate::domain::entities::PatientChart, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let chart = chart_repo::validate_patient_chart_status(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "VALIDATE_CHART",
        "PatientChart",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(chart)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn forward_chart_to_physicians(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: ForwardChartArgs,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if !matches!(role, Role::Physician | Role::Reception) {
        return Err(AppError::Unauthorized);
    }
    let ids: Vec<String> = args
        .physician_ids
        .into_iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();
    if ids.is_empty() {
        return Err(AppError::validation_code("error.chart.select_doctor_required"));
    }
    patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    chart_repo::mark_chart_for_physician_review(&pool, &args.patient_id).await?;
    let patient_name = patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_default();
    let from_name = staff_repo::find_by_id(&pool, &session.user_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_else(|| session.user_id.clone());
    for aid in &ids {
        let p = staff_repo::find_by_id(&pool, aid)
            .await?
            .ok_or_else(|| {
                AppError::validation_code_params("error.chart.unknown_doctor", &[("id", aid)])
            })?;
        if !p.role.eq_ignore_ascii_case("PHYSICIAN") {
            return Err(AppError::validation_code_params(
                "error.chart.not_doctor",
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
    let title = "Chart — review requested";
    let body = if note.is_empty() {
        format!("{from_name} requests a chart review ({patient_name}).")
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
            "CHART_FORWARD",
            title,
            &body,
            Some(&payload_str),
        )
        .await?;
    }
    let details = format!("to {} recipient(s)", ids.len());
    audit_repo::create(
        &pool,
        &session.user_id,
        "FORWARD_CHART",
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
pub async fn create_practice_ticket(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: CreatePracticeTicketArgs,
) -> Result<practice_ticket_repo::PracticeTicket, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if role != Role::Reception {
        return Err(AppError::Unauthorized);
    }
    let body = args.body.trim();
    if body.is_empty() {
        return Err(AppError::validation_code("error.chart.message_empty"));
    }
    patient_repo::find_by_id(&pool, &args.patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let to = staff_repo::find_by_id(&pool, &args.to_physician_id)
        .await?
        .ok_or(AppError::NotFound("error.entity.physician".into()))?;
    if !to.role.eq_ignore_ascii_case("PHYSICIAN") {
        return Err(AppError::validation_code("error.chart.target_must_be_doctor"));
    }
    let t = practice_ticket_repo::insert(
        &pool,
        &args.patient_id,
        &session.user_id,
        &args.to_physician_id,
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
        &args.to_physician_id,
        "PRACTICE_TICKET",
        &title,
        &notif_body,
        Some(&pay),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PracticeTicket",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_practice_tickets_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_ticket_repo::PracticeTicket>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Physician => practice_ticket_repo::list_for_physician(&pool, &session.user_id, 200).await,
        Role::Reception => practice_ticket_repo::list_created_by(&pool, &session.user_id, 200).await,
        _ => Err(AppError::Unauthorized),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn update_practice_ticket_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: UpdatePracticeTicketStatusArgs,
) -> Result<practice_ticket_repo::PracticeTicket, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if role != Role::Physician {
        return Err(AppError::Unauthorized);
    }
    let st = args.status.trim().to_uppercase();
    let current = practice_ticket_repo::find_by_id(&pool, &args.id)
        .await?
        .ok_or(AppError::NotFound("error.entity.ticket".into()))?;
    workflow_transitions::practice_ticket_status_transition(&current.status, &st)?;
    let out = practice_ticket_repo::update_status(&pool, &args.id, &session.user_id, &st).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PracticeTicket",
        Some(&args.id),
        Some(&st),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_open_practice_tickets_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if role != Role::Physician {
        return Ok(0);
    }
    practice_ticket_repo::count_open_for_physician(&pool, &session.user_id).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_chart_workflow_commands {
    () => {
        $crate::commands::chart_workflow_commands::list_charts_to_validate,
        $crate::commands::chart_workflow_commands::count_charts_to_validate,
        $crate::commands::chart_workflow_commands::validate_patient_chart,
        $crate::commands::chart_workflow_commands::forward_chart_to_physicians,
        $crate::commands::chart_workflow_commands::create_practice_ticket,
        $crate::commands::chart_workflow_commands::list_practice_tickets_for_me,
        $crate::commands::chart_workflow_commands::update_practice_ticket_status,
        $crate::commands::chart_workflow_commands::count_open_practice_tickets_for_me,
    };
}
