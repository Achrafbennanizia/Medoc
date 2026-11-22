//! After a remote `practice_task` INSERT lands via sync, ensure local assignees
//! have a `PRACTICE_TASK_ASSIGNED` notification when the origin did not (or the
//! notification row has not arrived yet). Gap-fill inserts stay local (no outbox).

use crate::application::practice_task_notify::{assigned_notice, assignee_recipients, patient_name};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::staff as staff_repo;
use crate::infrastructure::database::repos::practice::in_app_notification as in_app_notification_repo;
use crate::infrastructure::database::repos::scheduling::practice_task as practice_task_repo;
use sqlx::SqlitePool;

/// Best-effort: fill missing assignee notifications after remote task INSERT.
pub async fn ensure_assignee_notifications_after_remote_insert(
    pool: &SqlitePool,
    task_id: &str,
) {
    if let Err(e) = try_ensure(pool, task_id).await {
        tracing::warn!(
            target: "medoc::sync",
            event = "PRACTICE_TASK_SYNC_NOTIFY_SKIP",
            task_id = %task_id,
            error = %e,
        );
    }
}

async fn try_ensure(pool: &SqlitePool, task_id: &str) -> Result<(), AppError> {
    let Some(task) = practice_task_repo::find_by_id(pool, task_id).await? else {
        return Ok(());
    };
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
    let (title, body, pay) = assigned_notice(&task, &pname);

    for user_id in recipients {
        if user_id.trim() == task.created_by.trim() {
            continue;
        }
        if in_app_notification_repo::exists_assigned_for_task(pool, &user_id, &task.id).await? {
            continue;
        }
        if staff_repo::find_by_id(pool, &user_id).await?.is_none() {
            continue;
        }
        in_app_notification_repo::insert_local_gap_fill(
            pool,
            &user_id,
            "PRACTICE_TASK_ASSIGNED",
            &title,
            &body,
            Some(&pay),
        )
        .await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::practice_task::CreatePracticeTask;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn ensure_fills_missing_assigned_notification() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
             VALUES ('t-sync-pat', 'Sync Pat', '1990-01-01', 'MALE', 'V-SYNC')",
        )
        .execute(&pool)
        .await
        .expect("patient");

        let task = practice_task_repo::insert(
            &pool,
            &CreatePracticeTask {
                patient_id: Some("t-sync-pat".into()),
                kind: "TICKET".into(),
                title: "Remote ticket".into(),
                body: Some("Please review".into()),
                assignee_role: None,
                assignee_user_id: Some("seed-physician-001".into()),
                treatment_id: None,
                examination_id: None,
                service_name: Some("Root canal anterior".into()),
                total_cost: None,
            },
            "seed-rez-001",
        )
        .await
        .expect("insert task without notify");

        let before = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
            .await
            .expect("count");
        ensure_assignee_notifications_after_remote_insert(&pool, &task.id).await;
        let after = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
            .await
            .expect("count");
        assert!(after > before, "gap-fill should create PRACTICE_TASK_ASSIGNED");

        // Idempotent: second call does not duplicate.
        ensure_assignee_notifications_after_remote_insert(&pool, &task.id).await;
        let again = in_app_notification_repo::count_unread(&pool, "seed-physician-001")
            .await
            .expect("count");
        assert_eq!(again, after);

        let rows = in_app_notification_repo::list_for_user(&pool, "seed-physician-001", 10)
            .await
            .expect("list");
        assert!(rows.iter().any(|n| {
            n.kind == "PRACTICE_TASK_ASSIGNED"
                && n.payload_json
                    .as_deref()
                    .is_some_and(|p| p.contains(&task.id) && p.contains("Root canal anterior"))
        }));
    }
}
