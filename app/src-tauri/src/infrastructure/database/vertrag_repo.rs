use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct VertragRow {
    pub id: String,
    pub bezeichnung: String,
    pub partner: String,
    pub betrag: f64,
    pub intervall: String,
    pub unbefristet: i64,
    pub periode_von: Option<String>,
    pub periode_bis: Option<String>,
    pub created_at: String,
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<VertragRow>, AppError> {
    let rows = sqlx::query_as::<_, VertragRow>(
        "SELECT id, bezeichnung, partner, betrag, intervall, unbefristet, periode_von, periode_bis, created_at
         FROM vertrag ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert(
    pool: &SqlitePool,
    row: &VertragRow,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO vertrag (id, bezeichnung, partner, betrag, intervall, unbefristet, periode_von, periode_bis, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(id) DO UPDATE SET
            bezeichnung = excluded.bezeichnung,
            partner = excluded.partner,
            betrag = excluded.betrag,
            intervall = excluded.intervall,
            unbefristet = excluded.unbefristet,
            periode_von = excluded.periode_von,
            periode_bis = excluded.periode_bis",
    )
    .bind(&row.id)
    .bind(&row.bezeichnung)
    .bind(&row.partner)
    .bind(row.betrag)
    .bind(&row.intervall)
    .bind(row.unbefristet)
    .bind(&row.periode_von)
    .bind(&row.periode_bis)
    .bind(&row.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_by_id(pool: &SqlitePool, id: &str) -> Result<u64, AppError> {
    let n = sqlx::query("DELETE FROM vertrag WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(n)
}

/// DEV / demo only: inserts sample rows when table is empty and flag is set at startup.
pub async fn dev_seed_demo(pool: &SqlitePool) -> Result<(), AppError> {
    let n: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM vertrag")
        .fetch_one(pool)
        .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let now = chrono::Utc::now().to_rfc3339();
    for row in [
        VertragRow {
            id: "seed-v-1".into(),
            bezeichnung: "Miete Praxisräume".into(),
            partner: "Hausverwaltung Nord".into(),
            betrag: 3200.0,
            intervall: "MONAT".into(),
            unbefristet: 1,
            periode_von: None,
            periode_bis: None,
            created_at: now.clone(),
        },
        VertragRow {
            id: "seed-v-2".into(),
            bezeichnung: "Dental-Labor".into(),
            partner: "Labor Müller KG · abrechnung variabel laut Rechnung".into(),
            betrag: 0.0,
            intervall: "MONAT".into(),
            unbefristet: 1,
            periode_von: None,
            periode_bis: None,
            created_at: now.clone(),
        },
        VertragRow {
            id: "seed-v-3".into(),
            bezeichnung: "Versicherung Haftpflicht".into(),
            partner: "Allianz".into(),
            betrag: 840.0,
            intervall: "JAHR".into(),
            unbefristet: 0,
            periode_von: Some("2024-01-01".into()),
            periode_bis: Some("2027-12-31".into()),
            created_at: now,
        },
    ] {
        upsert(pool, &row).await?;
    }
    Ok(())
}
