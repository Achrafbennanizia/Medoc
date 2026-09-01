use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct ContractRow {
    pub id: String,
    pub designation: String,
    pub partner: String,
    pub amount: f64,
    pub interval: String,
    pub unlimited: i64,
    pub period_from: Option<String>,
    pub period_until: Option<String>,
    pub created_at: String,
    pub document_path: Option<String>,
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<ContractRow>, AppError> {
    let row = sqlx::query_as::<_, ContractRow>(
        "SELECT id, designation, partner, amount, interval, unlimited, period_from, period_until, created_at, document_path
         FROM contract WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<ContractRow>, AppError> {
    let rows = sqlx::query_as::<_, ContractRow>(
        "SELECT id, designation, partner, amount, interval, unlimited, period_from, period_until, created_at, document_path
         FROM contract ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert(pool: &SqlitePool, row: &ContractRow) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO contract (id, designation, partner, amount, interval, unlimited, period_from, period_until, created_at, document_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
            designation = excluded.designation,
            partner = excluded.partner,
            amount = excluded.amount,
            interval = excluded.interval,
            unlimited = excluded.unlimited,
            period_from = excluded.period_from,
            period_until = excluded.period_until,
            document_path = excluded.document_path",
    )
    .bind(&row.id)
    .bind(&row.designation)
    .bind(&row.partner)
    .bind(row.amount)
    .bind(&row.interval)
    .bind(row.unlimited)
    .bind(&row.period_from)
    .bind(&row.period_until)
    .bind(&row.created_at)
    .bind(&row.document_path)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<u64, AppError> {
    let n = sqlx::query("DELETE FROM contract WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(n)
}

/// DEV / demo only: inserts sample rows when table is empty and flag is set at startup.
pub async fn dev_seed_demo(pool: &SqlitePool) -> Result<(), AppError> {
    let n: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM contract")
        .fetch_one(pool)
        .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let now = chrono::Utc::now().to_rfc3339();
    for row in [
        ContractRow {
            id: "seed-version-1".into(),
            designation: "Miete Praxisräume".into(),
            partner: "North Property Management".into(),
            amount: 3200.0,
            interval: "MONTH".into(),
            unlimited: 1,
            period_from: None,
            period_until: None,
            created_at: now.clone(),
            document_path: None,
        },
        ContractRow {
            id: "seed-version-2".into(),
            designation: "Dental-Labor".into(),
            partner: "Labor Müller KG · billing variabel laut Invoice".into(),
            amount: 0.0,
            interval: "MONTH".into(),
            unlimited: 1,
            period_from: None,
            period_until: None,
            created_at: now.clone(),
            document_path: None,
        },
        ContractRow {
            id: "seed-version-3".into(),
            designation: "Versicherung Haftpflicht".into(),
            partner: "Allianz".into(),
            amount: 840.0,
            interval: "YEAR".into(),
            unlimited: 0,
            period_from: Some("2024-01-01".into()),
            period_until: Some("2027-12-31".into()),
            created_at: now,
            document_path: None,
        },
    ] {
        upsert(pool, &row).await?;
    }
    Ok(())
}
