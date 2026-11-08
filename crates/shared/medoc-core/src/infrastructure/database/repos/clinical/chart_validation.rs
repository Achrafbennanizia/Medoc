use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChartValidationRow {
    pub patient_id: String,
    pub section_or_item: String,
    pub validated_at: String,
    pub validated_by: Option<String>,
}

pub async fn list_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<ChartValidationRow>, AppError> {
    let rows = sqlx::query_as::<_, ChartValidationRow>(
        "SELECT patient_id, section_or_item, validated_at, validated_by
         FROM chart_validation WHERE patient_id = ?1
         ORDER BY section_or_item",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert_row(
    pool: &SqlitePool,
    patient_id: &str,
    section_or_item: &str,
    validated_at: &str,
    validated_by: Option<&str>,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO chart_validation (patient_id, section_or_item, validated_at, validated_by)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(patient_id, section_or_item) DO UPDATE SET
            validated_at = excluded.validated_at,
            validated_by = excluded.validated_by",
    )
    .bind(patient_id)
    .bind(section_or_item)
    .bind(validated_at)
    .bind(validated_by)
    .execute(&mut *tx)
    .await?;
    // F147: sync id is the composite key, not patient_id alone.
    let key = crate::infrastructure::database::sync_registry::chart_validation_key(
        patient_id,
        section_or_item,
    );
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "chart_validation",
        &key,
        "UPDATE",
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn delete_row(
    pool: &SqlitePool,
    patient_id: &str,
    section_or_item: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;
    let key = crate::infrastructure::database::sync_registry::chart_validation_key(
        patient_id,
        section_or_item,
    );
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "chart_validation",
        &key,
        "DELETE",
    )
    .await?;
    sqlx::query("DELETE FROM chart_validation WHERE patient_id = ?1 AND section_or_item = ?2")
        .bind(patient_id)
        .bind(section_or_item)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(())
}

/// When `section_or_item` is None, deletes all rows for the patient.
pub async fn clear_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
    section_or_item: Option<&str>,
) -> Result<u64, AppError> {
    let mut tx = pool.begin().await?;
    let sections: Vec<String> = match section_or_item {
        Some(s) => vec![s.to_string()],
        None => sqlx::query_scalar(
            "SELECT section_or_item FROM chart_validation WHERE patient_id = ?1",
        )
        .bind(patient_id)
        .fetch_all(&mut *tx)
        .await?,
    };
    for section in &sections {
        let key = crate::infrastructure::database::sync_registry::chart_validation_key(
            patient_id, section,
        );
        crate::infrastructure::database::recorded_write::record_in_tx(
            &mut tx,
            "chart_validation",
            &key,
            "DELETE",
        )
        .await?;
    }
    let n = if let Some(s) = section_or_item {
        sqlx::query("DELETE FROM chart_validation WHERE patient_id = ?1 AND section_or_item = ?2")
            .bind(patient_id)
            .bind(s)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    } else {
        sqlx::query("DELETE FROM chart_validation WHERE patient_id = ?1")
            .bind(patient_id)
            .execute(&mut *tx)
            .await?
            .rows_affected()
    };
    tx.commit().await?;
    Ok(n)
}

pub async fn delete_all_for_patient(pool: &SqlitePool, patient_id: &str) -> Result<u64, AppError> {
    clear_for_patient(pool, patient_id, None).await
}
