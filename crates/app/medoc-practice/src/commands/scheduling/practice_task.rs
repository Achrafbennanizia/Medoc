//! FA-AUFG-01..06 — Practice tasks (bidirectional, status machine).
use crate::application::auth_service::Session;
use crate::application::rbac::{self, effective_allowed, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::practice_task::{
    AddPracticeTaskCommentArgs, CreatePracticeTask, PracticeTask, PracticeTaskComment,
    TransitionPracticeTaskArgs, UpdatePracticeTaskAdmin,
};
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{
    audit_repo, patient_repo, staff_repo, practice_task_repo,
};
use sqlx::SqlitePool;
use tauri::State;

const TASK_KINDS: &[&str] = &["BILLING", "APPOINTMENT", "PRINT", "MASTER_DATA", "OTHER"];

/// Inbox visibility or practice-task admin (`administration.read`).
fn assert_task_readable(
    session: &Session,
    role: Role,
    a: &PracticeTask,
) -> Result<(), AppError> {
    if effective_allowed("administration.read", role, &session.permission_overrides) {
        return Ok(());
    }
    crate::domain::services::task_visibility::assert_user_can_view_task(
        a,
        &session.user_id,
        role,
    )
}

fn normalize_patient_id(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn normalize_kind(raw: &str) -> Result<String, AppError> {
    let t = match raw.trim().to_uppercase().as_str() {
        "TERMIN" | "APPOINTMENT" => "APPOINTMENT".to_string(),
        "DRUCK" | "PRINT" => "PRINT".to_string(),
        "ABRECHNUNG" | "BILLING" => "BILLING".to_string(),
        "STAMMDATEN" | "MASTER_DATA" => "MASTER_DATA".to_string(),
        "SONSTIGES" | "OTHER" => "OTHER".to_string(),
        other => other.to_string(),
    };
    if TASK_KINDS.iter().any(|x| *x == t) {
        Ok(t)
    } else {
        Err(AppError::Validation(format!(
            "Unknown task type: {t} (allowed: {})",
            TASK_KINDS.join(", ")
        )))
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_practice_task(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePracticeTask,
) -> Result<PracticeTask, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let title = data.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::validation_code("error.practice_task.title_required"));
    }
    let patient_id = normalize_patient_id(data.patient_id.as_deref());
    let pid = patient_id
        .as_deref()
        .ok_or_else(|| AppError::validation_code("error.practice_task.patient_required"))?;
    patient_repo::find_by_id(&pool, pid)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;

    let mut payload = data;
    payload.patient_id = patient_id;
    payload.kind = normalize_kind(&payload.kind)?;
    payload.title = title;

    match role {
        Role::Physician => {
            if let Some(rid) = payload
                .assignee_user_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
            {
                let rez = staff_repo::find_by_id(&pool, rid)
                    .await?
                    .ok_or(AppError::NotFound("Staff".into()))?;
                if !rez.role.eq_ignore_ascii_case("RECEPTION") {
                    return Err(AppError::validation_code(
                        "error.practice_task.target_must_be_reception",
                    ));
                }
                payload.assignee_role = None;
            } else {
                payload.assignee_role = Some("RECEPTION".into());
                payload.assignee_user_id = None;
            }
        }
        Role::Reception => {
            let aid = payload
                .assignee_user_id
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .ok_or_else(|| AppError::validation_code("error.practice_task.assignee_doctor_required"))?;
            let physician = staff_repo::find_by_id(&pool, aid)
                .await?
                .ok_or(AppError::NotFound("Physician".into()))?;
            if !physician.role.eq_ignore_ascii_case("PHYSICIAN") {
                return Err(AppError::validation_code("error.practice_task.target_must_be_doctor"));
            }
            payload.assignee_role = None;
        }
        _ => return Err(AppError::Unauthorized),
    }

    let a = practice_task_repo::insert(&pool, &payload, &session.user_id).await?;
    crate::application::practice_task_notify::notify_assignees_on_task_created(
        &pool,
        &a,
        &session.user_id,
    )
    .await
    .ok();
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PracticeTask",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_practice_tasks_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PracticeTask>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Reception => {
            practice_task_repo::list_for_user(&pool, &session.user_id, true, 200).await
        }
        Role::Physician => practice_task_repo::list_for_user(&pool, &session.user_id, false, 200).await,
        _ => Err(AppError::Unauthorized),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn transition_practice_task(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: TransitionPracticeTaskArgs,
) -> Result<PracticeTask, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let st = args.status.trim().to_uppercase();
    let current = practice_task_repo::find_by_id(&pool, &args.id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;

    let can_admin_status =
        effective_allowed("task.status.admin", role, &session.permission_overrides);
    if !can_admin_status {
        crate::domain::services::task_visibility::assert_user_can_view_task(
            &current,
            &session.user_id,
            role,
        )?;
    }

    let can_fulfill_status = effective_allowed(
        "task.status.fulfill",
        role,
        &session.permission_overrides,
    );

    workflow_transitions::practice_task_status_transition(
        &current.status,
        &st,
        role,
        current.assignee_role.as_deref(),
        current.assignee_user_id.as_deref(),
        &current.created_by,
        &session.user_id,
        can_fulfill_status,
        can_admin_status,
    )?;

    if st == "DONE_RECEPTION" {
        let has_note = args
            .done_note
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty());
        let has_payment = args
            .payment_id
            .as_deref()
            .map(str::trim)
            .is_some_and(|s| !s.is_empty());
        if !has_note && !has_payment {
            return Err(AppError::Validation(
                "Short note or payment link required (FA-AUFG-04).".into(),
            ));
        }
    }
    if st == "BACK" {
        let reason = args.return_reason.as_deref().unwrap_or("").trim();
        if reason.is_empty() {
            return Err(AppError::Validation(
                "Reason for return to reception is required (FA-AUFG-05).".into(),
            ));
        }
    }

    let out = practice_task_repo::update_status(
        &pool,
        &args.id,
        &st,
        args.done_note.as_deref(),
        args.payment_id.as_deref(),
        args.return_reason.as_deref(),
    )
    .await?;

    crate::application::practice_task_notify::notify_creator_if_task_done_by_other(
        &pool,
        &current,
        &out,
        &st,
        &session.user_id,
        args.done_note.as_deref(),
    )
    .await?;
    crate::application::practice_task_notify::notify_assignees_if_task_back(
        &pool,
        &current,
        &out,
        &st,
        &session.user_id,
        args.return_reason.as_deref(),
    )
    .await?;

    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PracticeTask",
        Some(&args.id),
        Some(&st),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_open_practice_tasks_for_me(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    match role {
        Role::Reception => {
            practice_task_repo::count_open_for_user(&pool, &session.user_id, true).await
        }
        Role::Physician => {
            practice_task_repo::count_open_for_user(&pool, &session.user_id, false).await
        }
        _ => Ok(0),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_practice_tasks_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PracticeTask>, AppError> {
    rbac::require(&session_state, "administration.read")?;
    practice_task_repo::list_all_admin(&pool, 500).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_practice_task_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePracticeTask,
) -> Result<PracticeTask, AppError> {
    let session = rbac::require(&session_state, "administration.read")?;
    let title = data.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::validation_code("error.practice_task.title_required"));
    }
    let patient_id = normalize_patient_id(data.patient_id.as_deref());
    if let Some(pid) = patient_id.as_deref() {
        patient_repo::find_by_id(&pool, pid)
            .await?
            .ok_or(AppError::NotFound("Patient".into()))?;
    }

    let mut payload = data;
    payload.patient_id = patient_id;
    payload.kind = normalize_kind(&payload.kind)?;
    payload.title = title;
    if payload
        .assignee_role
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .is_none()
        && payload
            .assignee_user_id
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .is_none()
    {
        payload.assignee_role = Some("RECEPTION".into());
    }

    let a = practice_task_repo::insert(&pool, &payload, &session.user_id).await?;
    crate::application::practice_task_notify::notify_assignees_on_task_created(
        &pool,
        &a,
        &session.user_id,
    )
    .await
    .ok();
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PracticeTask",
        Some(&a.id),
        Some("admin"),
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patch))]
pub async fn update_practice_task_admin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patch: UpdatePracticeTaskAdmin,
) -> Result<PracticeTask, AppError> {
    let session = rbac::require(&session_state, "administration.read")?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if patch
        .title
        .as_deref()
        .map(str::trim)
        .is_some_and(|s| s.is_empty())
    {
        return Err(AppError::validation_code("error.practice_task.title_required"));
    }
    if let Some(t) = patch.kind.as_deref() {
        normalize_kind(t)?;
    }
    if let Some(next_status) = patch.status.as_deref() {
        let current = practice_task_repo::find_by_id(&pool, &patch.id)
            .await?
            .ok_or(AppError::NotFound("Task".into()))?;
        let st = next_status.trim().to_uppercase();
        if st != current.status.trim().to_uppercase()
            && !effective_allowed("task.status.admin", role, &session.permission_overrides)
        {
            return Err(AppError::Unauthorized);
        }
        if st != current.status.trim().to_uppercase() {
            workflow_transitions::practice_task_admin_status_transition(&current.status, &st)?;
        }
    }
    let out = practice_task_repo::update_admin(&pool, &patch).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "PracticeTask",
        Some(&patch.id),
        Some("admin"),
    )
    .await
    .ok();
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_practice_task_comments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    task_id: String,
) -> Result<Vec<PracticeTaskComment>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let current = practice_task_repo::find_by_id(&pool, &task_id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;
    assert_task_readable(&session, role, &current)?;
    practice_task_repo::list_comments(&pool, &task_id, 200).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, args))]
pub async fn add_practice_task_comment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: AddPracticeTaskCommentArgs,
) -> Result<PracticeTaskComment, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let current = practice_task_repo::find_by_id(&pool, &args.task_id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;
    assert_task_readable(&session, role, &current)?;
    let out = practice_task_repo::insert_comment(
        &pool,
        &args.task_id,
        &session.user_id,
        &args.body,
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PracticeTaskComment",
        Some(&out.id),
        Some(&args.task_id),
    )
    .await
    .ok();
    Ok(out)
}

#[macro_export]
macro_rules! register_practice_task_commands {
    ($register:ident) => {
        $register!(
            $crate::commands::practice_task_commands::create_practice_task,
            $crate::commands::practice_task_commands::list_practice_tasks_for_me,
            $crate::commands::practice_task_commands::transition_practice_task,
            $crate::commands::practice_task_commands::count_open_practice_tasks_for_me,
            $crate::commands::practice_task_commands::list_practice_tasks_admin,
            $crate::commands::practice_task_commands::create_practice_task_admin,
            $crate::commands::practice_task_commands::update_practice_task_admin,
            $crate::commands::practice_task_commands::list_practice_task_comments,
            $crate::commands::practice_task_commands::add_practice_task_comment,
        );
    };
}
