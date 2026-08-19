//! FA-AUFG-01/06 — `practice_task` persistence.
use crate::domain::entities::practice_task::{
    CreatePracticeTask, PracticeTask, PracticeTaskComment, UpdatePracticeTaskAdmin,
};
use crate::error::AppError;
use sqlx::SqlitePool;

const ACTIVE_STATUSES: &str = "'OPEN','IN_PROGRESS','BACK'";

/// Chat-like visibility: creator, named assignee, or (Reception only) shared pool rows.
const VISIBILITY_WHERE: &str = "
    assignee_user_id = ?1
    OR (created_by = ?1 AND COALESCE(TRIM(assignee_user_id), '') != '')
    OR (created_by = ?1 AND assignee_role = 'RECEPTION' AND COALESCE(TRIM(assignee_user_id), '') = '')
    OR (?2 = 1 AND assignee_role = 'RECEPTION' AND COALESCE(TRIM(assignee_user_id), '') = '')
";

pub async fn insert(
    pool: &SqlitePool,
    data: &CreatePracticeTask,
    created_by: &str,
) -> Result<PracticeTask, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO practice_task (
            id, patient_id, kind, title, body, assignee_role, assignee_user_id, created_by,
            treatment_id, examination_id, service_name, total_cost, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'OPEN')",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(data.kind.trim().to_uppercase())
    .bind(data.title.trim())
    .bind(&data.body)
    .bind(&data.assignee_role)
    .bind(&data.assignee_user_id)
    .bind(created_by)
    .bind(&data.treatment_id)
    .bind(&data.examination_id)
    .bind(&data.service_name)
    .bind(data.total_cost)
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("practice_task insert".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "practice_task",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

/// FA-AUFG-02 — automatic billing task after B/U + service.
pub struct BillingTaskParams<'a> {
    pub patient_id: &'a str,
    pub created_by: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub treatment_id: Option<&'a str>,
    pub examination_id: Option<&'a str>,
    pub service_name: Option<&'a str>,
    pub total_cost: Option<f64>,
}

pub async fn insert_billing_for_clinical_line(
    pool: &SqlitePool,
    p: BillingTaskParams<'_>,
) -> Result<PracticeTask, AppError> {
    let data = CreatePracticeTask {
        patient_id: Some(p.patient_id.to_string()),
        kind: "BILLING".into(),
        title: p.title.into(),
        body: Some(p.body.into()),
        assignee_role: Some("RECEPTION".into()),
        assignee_user_id: None,
        treatment_id: p.treatment_id.map(str::to_string),
        examination_id: p.examination_id.map(str::to_string),
        service_name: p.service_name.map(str::to_string),
        total_cost: p.total_cost,
    };
    insert(pool, &data, p.created_by).await
}

/// FA-AUFG-02 / G18 — idempotent auto-task after billable B/U save.
pub async fn ensure_billing_task_for_clinical_line(
    pool: &SqlitePool,
    patient_id: &str,
    created_by: &str,
    service_name: Option<&str>,
    total_cost: Option<f64>,
    treatment_id: Option<&str>,
    examination_id: Option<&str>,
) -> Result<(), AppError> {
    use crate::domain::services::pricing;
    if !pricing::treatment_has_billable_service_item(service_name, total_cost) {
        return Ok(());
    }
    let open: (i64,) = if let Some(bid) = treatment_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM practice_task
             WHERE kind = 'BILLING' AND treatment_id = ?1
               AND status NOT IN ('VALIDATED')",
        )
        .bind(bid)
        .fetch_one(pool)
        .await?
    } else if let Some(uid) = examination_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM practice_task
             WHERE kind = 'BILLING' AND examination_id = ?1
               AND status NOT IN ('VALIDATED')",
        )
        .bind(uid)
        .fetch_one(pool)
        .await?
    } else {
        return Ok(());
    };
    if open.0 > 0 {
        return Ok(());
    }
    let ln = service_name.unwrap_or("ServiceItem").trim();
    let title = if ln.is_empty() {
        "Payment erfassen".to_string()
    } else {
        format!("Payment erfassen: {ln}")
    };
    let body = match total_cost.filter(|g| g.is_finite() && *g > 0.0) {
        Some(g) => format!("{title} ({:.2} €)", g),
        None => title.clone(),
    };
    insert_billing_for_clinical_line(
        pool,
        BillingTaskParams {
            patient_id,
            created_by,
            title: &title,
            body: &body,
            treatment_id,
            examination_id,
            service_name: service_name.filter(|s| !s.trim().is_empty()),
            total_cost,
        },
    )
    .await?;
    Ok(())
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>("SELECT * FROM practice_task WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

/// Inbox for the current user — creator/assignee threads + optional REZ pool.
pub async fn list_for_user(
    pool: &SqlitePool,
    user_id: &str,
    include_reception_pool: bool,
    limit: i64,
) -> Result<Vec<PracticeTask>, AppError> {
    let pool_flag: i64 = if include_reception_pool { 1 } else { 0 };
    let sql = format!(
        "SELECT * FROM practice_task
         WHERE (
           status IN ({ACTIVE_STATUSES})
           AND ({VISIBILITY_WHERE})
         ) OR (
           created_by = ?1 AND status != 'VALIDATED'
         )
         ORDER BY
           CASE status WHEN 'BACK' THEN 0 WHEN 'OPEN' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'DONE_RECEPTION' THEN 3 ELSE 4 END,
           datetime(updated_at) DESC
         LIMIT ?3"
    );
    sqlx::query_as::<_, PracticeTask>(&sql)
        .bind(user_id)
        .bind(pool_flag)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn count_open_for_user(
    pool: &SqlitePool,
    user_id: &str,
    include_reception_pool: bool,
) -> Result<i64, AppError> {
    let pool_flag: i64 = if include_reception_pool { 1 } else { 0 };
    let count_sql = format!(
        "SELECT COUNT(DISTINCT id) FROM practice_task
         WHERE (
           status IN ({ACTIVE_STATUSES}) AND ({VISIBILITY_WHERE})
         ) OR (
           created_by = ?1 AND status != 'VALIDATED'
         )"
    );
    let row: (i64,) = sqlx::query_as(&count_sql)
        .bind(user_id)
        .bind(pool_flag)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

/// Reception inbox: pool tasks (OPEN, IN_PROGRESS, BACK).
pub async fn list_inbox_reception(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>(
        "SELECT * FROM practice_task
         WHERE assignee_role = 'RECEPTION'
           AND status IN ('OPEN','IN_PROGRESS','BACK')
         ORDER BY
           CASE status WHEN 'BACK' THEN 0 WHEN 'OPEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Doctor inbox: directly assigned tasks (REZ → PHYSICIAN).
pub async fn list_inbox_physician(
    pool: &SqlitePool,
    physician_id: &str,
    limit: i64,
) -> Result<Vec<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>(
        "SELECT * FROM practice_task
         WHERE assignee_user_id = ?1
           AND status IN ('OPEN','IN_PROGRESS','BACK')
         ORDER BY
           CASE status WHEN 'BACK' THEN 0 WHEN 'OPEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(physician_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Reception inbox: sent by me to a doctor (still open).
pub async fn list_outgoing_reception(
    pool: &SqlitePool,
    created_by: &str,
    limit: i64,
) -> Result<Vec<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>(
        "SELECT * FROM practice_task
         WHERE created_by = ?1
           AND assignee_user_id IS NOT NULL
           AND assignee_user_id != ''
           AND status IN ('OPEN','IN_PROGRESS','BACK')
         ORDER BY
           CASE status WHEN 'BACK' THEN 0 WHEN 'OPEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(created_by)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Doctor/reception: completed tasks awaiting validation (created by me).
pub async fn list_pending_validation(
    pool: &SqlitePool,
    created_by: &str,
    limit: i64,
) -> Result<Vec<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>(
        "SELECT * FROM practice_task
         WHERE created_by = ?1 AND status = 'DONE_RECEPTION'
         ORDER BY datetime(updated_at) DESC
         LIMIT ?2",
    )
    .bind(created_by)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn count_open_for_reception(pool: &SqlitePool, user_id: &str) -> Result<i64, AppError> {
    let pool_open: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task
         WHERE assignee_role = 'RECEPTION'
           AND status IN ('OPEN','IN_PROGRESS','BACK')",
    )
    .fetch_one(pool)
    .await?;
    let outgoing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task
         WHERE created_by = ?1
           AND assignee_user_id IS NOT NULL
           AND assignee_user_id != ''
           AND status IN ('OPEN','IN_PROGRESS','BACK')",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    let validate: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task
         WHERE created_by = ?1 AND status = 'DONE_RECEPTION'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(pool_open.0 + outgoing.0 + validate.0)
}

pub async fn count_open_for_physician(pool: &SqlitePool, physician_id: &str) -> Result<i64, AppError> {
    let assigned: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task
         WHERE assignee_user_id = ?1
           AND status IN ('OPEN','IN_PROGRESS','BACK')",
    )
    .bind(physician_id)
    .fetch_one(pool)
    .await?;
    let validate: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM practice_task
         WHERE created_by = ?1 AND status = 'DONE_RECEPTION'",
    )
    .bind(physician_id)
    .fetch_one(pool)
    .await?;
    Ok(assigned.0 + validate.0)
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    done_note: Option<&str>,
    payment_id: Option<&str>,
    return_reason: Option<&str>,
) -> Result<PracticeTask, AppError> {
    let n = sqlx::query(
        "UPDATE practice_task SET
            status = ?1,
            done_note = COALESCE(?2, done_note),
            payment_id = COALESCE(?3, payment_id),
            return_reason = COALESCE(?4, return_reason),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
    )
    .bind(status)
    .bind(done_note)
    .bind(payment_id)
    .bind(return_reason)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Task".into()));
    }
    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "practice_task",
        id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

/// Admin: all tasks (newest first).
pub async fn list_all_admin(pool: &SqlitePool, limit: i64) -> Result<Vec<PracticeTask>, AppError> {
    sqlx::query_as::<_, PracticeTask>(
        "SELECT * FROM practice_task ORDER BY datetime(updated_at) DESC LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

const TASK_STATUSES: &[&str] = &[
    "OPEN",
    "IN_PROGRESS",
    "DONE_RECEPTION",
    "VALIDATED",
    "BACK",
];

pub async fn update_admin(
    pool: &SqlitePool,
    patch: &UpdatePracticeTaskAdmin,
) -> Result<PracticeTask, AppError> {
    let current = find_by_id(pool, &patch.id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;

    let title = patch
        .title
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| current.title.clone());
    let body = patch.body.clone().or(current.body.clone());
    let kind = patch
        .kind
        .as_deref()
        .map(|t| t.trim().to_uppercase())
        .unwrap_or_else(|| current.kind.clone());
    let assignee_role = patch
        .assignee_role
        .as_ref()
        .map(|version| {
            let t = version.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_uppercase())
            }
        })
        .unwrap_or_else(|| current.assignee_role.clone());
    let assignee_user_id = patch
        .assignee_user_id
        .as_ref()
        .map(|version| {
            let t = version.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        })
        .unwrap_or_else(|| current.assignee_user_id.clone());
    let status = patch
        .status
        .as_deref()
        .map(|s| s.trim().to_uppercase())
        .unwrap_or_else(|| current.status.clone());
    if !TASK_STATUSES.iter().any(|s| *s == status) {
        return Err(AppError::Validation(format!(
            "Unknown status: {status}"
        )));
    }

    let n = sqlx::query(
        "UPDATE practice_task SET
            title = ?1,
            body = ?2,
            kind = ?3,
            assignee_role = ?4,
            assignee_user_id = ?5,
            status = ?6,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?7",
    )
    .bind(&title)
    .bind(&body)
    .bind(&kind)
    .bind(&assignee_role)
    .bind(&assignee_user_id)
    .bind(&status)
    .bind(&patch.id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Task".into()));
    }
    let updated = find_by_id(pool, &patch.id)
        .await?
        .ok_or(AppError::NotFound("Task".into()))?;
    let body_json =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", patch.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "practice_task",
        &patch.id,
        "UPDATE",
        &body_json,
    )
    .await?;
    Ok(updated)
}

pub async fn list_comments(
    pool: &SqlitePool,
    task_id: &str,
    limit: i64,
) -> Result<Vec<PracticeTaskComment>, AppError> {
    sqlx::query_as::<_, PracticeTaskComment>(
        "SELECT * FROM practice_task_comment
         WHERE task_id = ?1
         ORDER BY datetime(created_at) ASC
         LIMIT ?2",
    )
    .bind(task_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn insert_comment(
    pool: &SqlitePool,
    task_id: &str,
    author_id: &str,
    body: &str,
) -> Result<PracticeTaskComment, AppError> {
    let text = body.trim();
    if text.is_empty() {
        return Err(AppError::Validation(
            "Comment must not be empty.".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO practice_task_comment (id, task_id, author_id, body)
         VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(&id)
    .bind(task_id)
    .bind(author_id)
    .bind(text)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, PracticeTaskComment>(
        "SELECT * FROM practice_task_comment WHERE id = ?1",
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}
