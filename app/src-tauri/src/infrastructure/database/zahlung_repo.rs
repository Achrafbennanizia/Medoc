use crate::domain::entities::zahlung::{Bilanz, CreateZahlung};
use crate::domain::entities::Zahlung;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Zahlung>, AppError> {
    let rows = sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung ORDER BY created_at DESC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreateZahlung) -> Result<Zahlung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let zahlungsart = serde_json::to_string(&data.zahlungsart)
        .unwrap()
        .trim_matches('"')
        .to_uppercase();

    // If leistung_id is provided, auto-fill betrag from leistung price
    let betrag = if data.betrag <= 0.0 {
        if let Some(ref lid) = data.leistung_id {
            let row: Option<(f64,)> = sqlx::query_as("SELECT preis FROM leistung WHERE id = ?1")
                .bind(lid)
                .fetch_optional(pool)
                .await?;
            row.map(|r| r.0).unwrap_or(data.betrag)
        } else {
            return Err(AppError::Validation("Betrag muss größer als 0 sein".into()));
        }
    } else {
        data.betrag
    };

    sqlx::query(
        "INSERT INTO zahlung (id, patient_id, betrag, zahlungsart, leistung_id, beschreibung)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(betrag)
    .bind(&zahlungsart)
    .bind(&data.leistung_id)
    .bind(&data.beschreibung)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<Zahlung, AppError> {
    sqlx::query("UPDATE zahlung SET status = ?1 WHERE id = ?2")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Zahlung".into()))
}

pub async fn get_bilanz(pool: &SqlitePool) -> Result<Bilanz, AppError> {
    let einnahmen: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status = 'BEZAHLT'")
            .fetch_one(pool)
            .await?;

    let ausstehend: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status IN ('AUSSTEHEND', 'TEILBEZAHLT')"
    ).fetch_one(pool).await?;

    let storniert: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status = 'STORNIERT'")
            .fetch_one(pool)
            .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM zahlung")
        .fetch_one(pool)
        .await?;

    Ok(Bilanz {
        einnahmen: einnahmen.0,
        ausstehend: ausstehend.0,
        storniert: storniert.0,
        anzahl_zahlungen: count.0,
    })
}
