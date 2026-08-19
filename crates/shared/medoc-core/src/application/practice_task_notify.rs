//! FA-AUFG-04/05 — In-app notifications for the practice-task workflow.
use crate::domain::entities::practice_task::PracticeTask;
use crate::error::AppError;
use crate::infrastructure::database::{in_app_notification_repo, patient_repo, staff_repo};
use serde_json::json;
use sqlx::SqlitePool;

pub async fn notify_creator_if_task_done_by_other(
    pool: &SqlitePool,
    before: &PracticeTask,
    updated: &PracticeTask,
    new_status: &str,
    completing_user_id: &str,
    done_note: Option<&str>,
) -> Result<(), AppError> {
    if new_status != "DONE_RECEPTION" || before.created_by == completing_user_id {
        return Ok(());
    }
    let pname = patient_name(pool, before.patient_id.as_deref()).await?;
    let title = if pname.is_empty() {
        format!("Task completed: {}", before.title.trim())
    } else {
        format!("Task completed: {pname}")
    };
    let body = done_note
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Reception marked the task as completed.");
    let pay = json!({
        "taskId": updated.id,
        "patientId": before.patient_id,
        "kind": before.kind,
    })
    .to_string();
    in_app_notification_repo::insert(
        pool,
        &before.created_by,
        "PRACTICE_TASK_DONE",
        &title,
        body,
        Some(&pay),
    )
    .await
}

/// FA-AUFG-05 — Notify recipients (reception pool or target physician) on `BACK`.
pub async fn notify_assignees_if_task_back(
    pool: &SqlitePool,
    before: &PracticeTask,
    updated: &PracticeTask,
    new_status: &str,
    returning_user_id: &str,
    return_reason: Option<&str>,
) -> Result<(), AppError> {
    if new_status != "BACK" {
        return Ok(());
    }

    let recipients = resolve_back_recipients(pool, before).await?;
    if recipients.is_empty() {
        return Ok(());
    }

    let pname = patient_name(pool, before.patient_id.as_deref()).await?;
    let title = if pname.is_empty() {
        format!("Task returned: {}", before.title.trim())
    } else {
        format!("Task returned: {pname}")
    };
    let body = return_reason
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Please process again.");
    let pay = json!({
        "taskId": updated.id,
        "patientId": before.patient_id,
        "kind": before.kind,
        "status": "BACK",
    })
    .to_string();

    for user_id in recipients {
        if user_id.trim() == returning_user_id.trim() {
            continue;
        }
        in_app_notification_repo::insert(
            pool,
            &user_id,
            "PRACTICE_TASK_BACK",
            &title,
            body,
            Some(&pay),
        )
        .await?;
    }
    Ok(())
}

async fn patient_name(pool: &SqlitePool, patient_id: Option<&str>) -> Result<String, AppError> {
    match patient_id.filter(|s| !s.trim().is_empty()) {
        Some(pid) => Ok(patient_repo::find_by_id(pool, pid)
            .await?
            .map(|p| p.name)
            .unwrap_or_default()),
        None => Ok(String::new()),
    }
}

async fn resolve_back_recipients(
    pool: &SqlitePool,
    task: &PracticeTask,
) -> Result<Vec<String>, AppError> {
    if let Some(uid) = task
        .assignee_user_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(vec![uid.to_string()]);
    }
    if task
        .assignee_role
        .as_deref()
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("RECEPTION"))
    {
        return staff_repo::find_user_ids_by_role(pool, "RECEPTION").await;
    }
    Ok(vec![])
}
