//! Deleting a patient and every row that depends on it (split from `patient.rs`).

use super::*;

/// Runs `DELETE FROM <table> WHERE <cond>` (one bound parameter) and records a
/// sync DELETE for every removed row, so erasure reaches the other devices
/// (F119: bulk deletes used to be invisible to sync).
pub(super) async fn exec_bound(
    tx: &mut Transaction<'_, Sqlite>,
    sql: &str,
    patient_id: &str,
    record: bool,
) -> Result<u64, AppError> {
    let re = regex::Regex::new(r"(?is)^\s*DELETE\s+FROM\s+([a-z_][a-z0-9_]*)\s+(WHERE\s+.*)$")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let Some(caps) = re.captures(sql) else {
        return Err(AppError::Internal(format!(
            "exec_bound expects DELETE … WHERE: {sql}"
        )));
    };
    let table = caps
        .get(1)
        .map(|m| m.as_str())
        .unwrap_or_default()
        .to_string();
    let where_sql = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
    let synced =
        crate::infrastructure::database::sync_registry::synced_tables().any(|t| t == table);
    let ids: Vec<String> = if record && synced {
        let key = crate::infrastructure::database::sync_registry::key_expr(&table);
        sqlx::query_scalar(&format!(
            "SELECT CAST({key} AS TEXT) FROM {table} {where_sql}"
        ))
        .bind(patient_id)
        .fetch_all(&mut **tx)
        .await?
    } else {
        Vec::new()
    };
    let n = sqlx::query(sql)
        .bind(patient_id)
        .execute(&mut **tx)
        .await?
        .rows_affected();
    for id in &ids {
        crate::infrastructure::database::recorded_write::record_in_tx(tx, &table, id, "DELETE")
            .await?;
    }
    Ok(n)
}

/// Delete restrict/cascade children. SQLite may have `foreign_keys` off, so
/// do not rely on `ON DELETE CASCADE` (same class as staff 787).
/// `record = true` for local erasure (rows go to the outbox); `false` on the
/// sync-apply path, which must not echo the remote delete back.
pub async fn delete_dependents(
    tx: &mut Transaction<'_, Sqlite>,
    patient_id: &str,
    record: bool,
) -> Result<u64, AppError> {
    // sync: each removed row is recorded in exec_bound (record_in_tx)
    let mut deleted: u64 = 0;
    deleted += exec_bound(
        tx,
        "DELETE FROM appointment WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM anamnesis_form WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM payment WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM prescription WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM certificate WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_validation WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_next_appointment_hint WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;

    let in_app_needle = format!("%\"patient_id\":\"{patient_id}\"%");
    deleted += exec_bound(
        tx,
        "DELETE FROM in_app_notification WHERE payload_json LIKE ?1",
        &in_app_needle,
        record,
    )
    .await?;

    deleted += exec_bound(
        tx,
        "DELETE FROM invoice_document_audit WHERE document_id IN
         (SELECT id FROM invoice_document WHERE patient_id = ?1)",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM invoice_document WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM practice_ticket WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;

    let task_ids: Vec<String> =
        sqlx::query_scalar("SELECT id FROM practice_task WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(&mut **tx)
            .await?;
    sqlx::query("UPDATE practice_task SET patient_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut **tx)
        .await?;
    for task_id in task_ids.iter().filter(|_| record) {
        crate::infrastructure::database::recorded_write::record_in_tx(
            tx,
            "practice_task",
            task_id,
            "UPDATE",
        )
        .await?;
    }

    deleted += exec_bound(
        tx,
        "DELETE FROM treatment WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM examination WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM dental_finding WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_attachment WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM patient_chart WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    Ok(deleted)
}

/// Hard-delete the patient row after dependents. No outbox (sync apply path).
pub async fn delete_row(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // sync: recorded by caller erase_patient
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_BEGIN",
        patient_id = %id
    );
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    if exists.is_none() {
        tx.rollback().await.map_err(AppError::Database)?;
        tracing::info!(
            target: "medoc::patient",
            event = "PATIENT_DELETE_MISSING",
            patient_id = %id
        );
        return Ok(());
    }
    let n = delete_dependents(&mut tx, id, false).await?;
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_DEPENDENTS",
        patient_id = %id,
        deleted_child_rows = n
    );
    sqlx::query("DELETE FROM patient WHERE id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_OK",
        patient_id = %id
    );
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    delete_row(pool, id).await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}
