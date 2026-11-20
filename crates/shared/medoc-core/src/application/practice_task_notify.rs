//! FA-AUFG-04/05 — In-app notifications for the practice-task workflow.
use crate::domain::entities::practice_task::PracticeTask;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use crate::infrastructure::database::repos::practice::in_app_notification as in_app_notification_repo;
use serde_json::json;
use sqlx::SqlitePool;

fn task_notice_payload(
    task_id: &str,
    patient_id: &Option<String>,
    patient_name: &str,
    task_title: &str,
    service_name: Option<&str>,
    kind: &str,
    status: &str,
) -> String {
    json!({
        "taskId": task_id,
        "patientId": patient_id,
        "patient_name": patient_name,
        "task_title": task_title,
        "service_name": service_name.unwrap_or(""),
        "kind": kind,
        "status": status,
    })
    .to_string()
}

pub(crate) fn assigned_notice(task: &PracticeTask, patient: &str) -> (String, String, String) {
    let title = notice_label(patient, task.title.trim());
    let body = task
        .body
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(task.title.trim())
        .to_string();
    let pay = task_notice_payload(
        &task.id,
        &task.patient_id,
        patient,
        task.title.trim(),
        task.service_name.as_deref(),
        &task.kind,
        &task.status,
    );
    (title, body, pay)
}

pub(crate) async fn assignee_recipients(
    pool: &SqlitePool,
    assignee_user_id: Option<&str>,
    assignee_role: Option<&str>,
) -> Result<Vec<String>, AppError> {
    if let Some(uid) = assignee_user_id.map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(vec![uid.to_string()]);
    }
    if assignee_role
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("RECEPTION"))
    {
        return staff_repo::find_user_ids_by_role(pool, "RECEPTION").await;
    }
    Ok(vec![])
}

fn status_notice(
    before: &PracticeTask,
    task_id: &str,
    patient: &str,
    status: &str,
    note: Option<&str>,
) -> (String, String, String) {
    let title = notice_label(patient, before.title.trim());
    let body = note
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("")
        .to_string();
    let pay = task_notice_payload(
        task_id,
        &before.patient_id,
        patient,
        before.title.trim(),
        before.service_name.as_deref(),
        &before.kind,
        status,
    );
    (title, body, pay)
}

async fn notify_except(
    pool: &SqlitePool,
    recipients: Vec<String>,
    skip_user_id: &str,
    kind: &str,
    title: &str,
    body: &str,
    pay: &str,
) -> Result<(), AppError> {
    for user_id in recipients {
        if user_id.trim() == skip_user_id.trim() {
            continue;
        }
        in_app_notification_repo::insert(pool, &user_id, kind, title, body, Some(pay)).await?;
    }
    Ok(())
}

/// Patient name, or the task title when the patient is unknown. The client adds the translated heading.
fn notice_label(patient: &str, task_title: &str) -> String {
    let name = patient.trim();
    if !name.is_empty() {
        name.to_string()
    } else {
        task_title.trim().to_string()
    }
}

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
    let (title, body, pay) = status_notice(before, &updated.id, &pname, new_status, done_note);
    in_app_notification_repo::insert(
        pool,
        &before.created_by,
        "PRACTICE_TASK_DONE",
        &title,
        &body,
        Some(&pay),
    )
    .await
}

/// Notify reception pool or assigned physician when a new task is created for them.
pub async fn notify_assignees_on_task_created(
    pool: &SqlitePool,
    task: &PracticeTask,
    creating_user_id: &str,
) -> Result<(), AppError> {
    let recipients = assignee_recipients(
        pool,
        task.assignee_user_id.as_deref(),
        task.assignee_role.as_deref(),
    )
    .await?;
    if recipients.is_empty() {
        return Ok(());
    }

    let pname = patient_name(pool, task.patient_id.as_deref()).await?;
    let (title, body, pay) = assigned_notice(task, &pname);
    notify_except(
        pool,
        recipients,
        creating_user_id,
        "PRACTICE_TASK_ASSIGNED",
        &title,
        &body,
        &pay,
    )
    .await
}

/// F99: create a task and its assignee notifications in one transaction.
/// A recipient that is not a local staff account fails the whole create
/// (before, the task was saved and the notification silently dropped).
pub async fn create_task_and_notify(
    pool: &SqlitePool,
    data: &crate::domain::entities::practice_task::CreatePracticeTask,
    creating_user_id: &str,
) -> Result<PracticeTask, AppError> {
    let recipients = assignee_recipients(
        pool,
        data.assignee_user_id.as_deref(),
        data.assignee_role.as_deref(),
    )
    .await?;
    let recipients: Vec<String> = recipients
        .into_iter()
        .filter(|u| u.trim() != creating_user_id.trim())
        .collect();
    for uid in &recipients {
        if staff_repo::find_by_id(pool, uid).await?.is_none() {
            return Err(AppError::Validation(
                "Notification user is not a staff account on this device.".into(),
            ));
        }
    }
    let pname = patient_name(pool, data.patient_id.as_deref()).await?;

    let mut tx = pool.begin().await?;
    let task = crate::infrastructure::database::repos::scheduling::practice_task::insert_in_tx(
        &mut tx,
        data,
        creating_user_id,
    )
    .await?;
    if !recipients.is_empty() {
        let (title, body, pay) = assigned_notice(&task, &pname);
        for uid in &recipients {
            in_app_notification_repo::insert_in_tx(
                &mut tx,
                uid,
                "PRACTICE_TASK_ASSIGNED",
                &title,
                &body,
                Some(&pay),
            )
            .await?;
        }
    }
    tx.commit().await?;
    Ok(task)
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

    let recipients = assignee_recipients(
        pool,
        before.assignee_user_id.as_deref(),
        before.assignee_role.as_deref(),
    )
    .await?;
    if recipients.is_empty() {
        return Ok(());
    }

    let pname = patient_name(pool, before.patient_id.as_deref()).await?;
    let (title, body, pay) = status_notice(before, &updated.id, &pname, new_status, return_reason);
    notify_except(
        pool,
        recipients,
        returning_user_id,
        "PRACTICE_TASK_BACK",
        &title,
        &body,
        &pay,
    )
    .await
}

pub(crate) async fn patient_name(pool: &SqlitePool, patient_id: Option<&str>) -> Result<String, AppError> {
    match patient_id.filter(|s| !s.trim().is_empty()) {
        Some(pid) => Ok(patient_repo::find_by_id(pool, pid)
            .await?
            .map(|p| p.name)
            .unwrap_or_default()),
        None => Ok(String::new()),
    }
}

