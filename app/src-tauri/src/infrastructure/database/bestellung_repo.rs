//! Persistence for [`Bestellung`] (purchase orders).
//!
//! Mirrors the shape of `produkt_repo` for consistency with the rest of the
//! Clean Architecture data layer.

use crate::domain::entities::bestellung::{
    is_valid_status, Bestellung, CreateBestellung, UpdateBestellung, STATUS_GELIEFERT, STATUS_OFFEN,
};
use crate::error::AppError;
use chrono::Datelike;
use sqlx::SqlitePool;

const SELECT_COLUMNS: &str = "id, bestellnummer, lieferant, pharmaberater, artikel, status, \
                              erwartet_am, geliefert_am, menge, einheit, bemerkung, gesamtbetrag, created_by, \
                              created_at, updated_at";

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Bestellung>, AppError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM bestellung
          ORDER BY
            CASE status WHEN 'OFFEN' THEN 0 WHEN 'UNTERWEGS' THEN 1 WHEN 'GELIEFERT' THEN 2 ELSE 3 END,
            COALESCE(erwartet_am, created_at) DESC"
    );
    let rows = sqlx::query_as::<_, Bestellung>(&sql).fetch_all(pool).await?;
    Ok(rows)
}

/// Generate the next free order number for the current year/month, e.g.
/// `B-2026-04-0007`. Cheap to compute (one indexed COUNT(*) per call) and
/// never decreases, so audits stay legible.
async fn next_bestellnummer(pool: &SqlitePool) -> Result<String, AppError> {
    let now = chrono::Local::now().date_naive();
    let prefix = format!("B-{:04}-{:02}-", now.year(), now.month());
    let pattern = format!("{prefix}%");
    let max_seq: Option<String> = sqlx::query_scalar(
        "SELECT MAX(bestellnummer) FROM bestellung WHERE bestellnummer LIKE ?1",
    )
    .bind(&pattern)
    .fetch_one(pool)
    .await?;
    let next = match max_seq.as_deref() {
        Some(prev) => prev
            .rsplit('-')
            .next()
            .and_then(|s| s.parse::<u32>().ok())
            .map(|n| n + 1)
            .unwrap_or(1),
        None => 1,
    };
    Ok(format!("{prefix}{:04}", next))
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreateBestellung,
    created_by: &str,
) -> Result<Bestellung, AppError> {
    if data.lieferant.trim().is_empty() {
        return Err(AppError::Validation("Lieferant erforderlich".into()));
    }
    if data.artikel.trim().is_empty() {
        return Err(AppError::Validation("Artikel erforderlich".into()));
    }
    if data.menge <= 0 {
        return Err(AppError::Validation("Menge muss positiv sein".into()));
    }
    if let Some(g) = data.gesamtbetrag {
        if !g.is_finite() || g < 0.0 {
            return Err(AppError::Validation("Gesamtbetrag ungültig".into()));
        }
    }
    let bestellnummer = match data.bestellnummer.as_ref().map(|s| s.trim()) {
        Some(s) if !s.is_empty() => s.to_string(),
        _ => next_bestellnummer(pool).await?,
    };
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO bestellung
            (id, bestellnummer, lieferant, pharmaberater, artikel, status,
             erwartet_am, menge, einheit, bemerkung, gesamtbetrag, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
    )
    .bind(&id)
    .bind(&bestellnummer)
    .bind(data.lieferant.trim())
    .bind(data.pharmaberater.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(data.artikel.trim())
    .bind(STATUS_OFFEN)
    .bind(data.erwartet_am.as_deref())
    .bind(data.menge)
    .bind(data.einheit.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(data.bemerkung.as_deref().map(str::trim).filter(|s| !s.is_empty()))
    .bind(data.gesamtbetrag)
    .bind(created_by)
    .execute(pool)
    .await?;

    fetch_by_id(pool, &id).await
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
) -> Result<Bestellung, AppError> {
    if !is_valid_status(status) {
        return Err(AppError::Validation(format!("Unbekannter Status: {status}")));
    }
    let geliefert = if status == STATUS_GELIEFERT {
        Some(chrono::Utc::now().date_naive().to_string())
    } else {
        None
    };
    let result = sqlx::query(
        "UPDATE bestellung
            SET status = ?1,
                geliefert_am = COALESCE(?2, geliefert_am),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?3",
    )
    .bind(status)
    .bind(geliefert)
    .bind(id)
    .execute(pool)
    .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Bestellung".into()));
    }
    fetch_by_id(pool, id).await
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateBestellung,
) -> Result<Bestellung, AppError> {
    // Validate the patch before constructing dynamic SQL.
    if let Some(l) = &data.lieferant {
        if l.trim().is_empty() {
            return Err(AppError::Validation("Lieferant erforderlich".into()));
        }
    }
    if let Some(a) = &data.artikel {
        if a.trim().is_empty() {
            return Err(AppError::Validation("Artikel erforderlich".into()));
        }
    }
    if let Some(m) = data.menge {
        if m <= 0 {
            return Err(AppError::Validation("Menge muss positiv sein".into()));
        }
    }

    let mut sets: Vec<&'static str> = Vec::new();
    let mut binds: Vec<Option<String>> = Vec::new();

    if data.lieferant.is_some() {
        sets.push("lieferant = ?");
        binds.push(data.lieferant.as_ref().map(|s| s.trim().to_string()));
    }
    if data.artikel.is_some() {
        sets.push("artikel = ?");
        binds.push(data.artikel.as_ref().map(|s| s.trim().to_string()));
    }
    if let Some(m) = data.menge {
        sets.push("menge = ?");
        binds.push(Some(m.to_string()));
    }
    if let Some(opt) = &data.einheit {
        sets.push("einheit = ?");
        binds.push(opt.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }
    if let Some(opt) = &data.erwartet_am {
        sets.push("erwartet_am = ?");
        binds.push(opt.clone().filter(|s| !s.is_empty()));
    }
    if let Some(opt) = &data.bemerkung {
        sets.push("bemerkung = ?");
        binds.push(opt.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }
    if let Some(opt) = &data.bestellnummer {
        sets.push("bestellnummer = ?");
        binds.push(opt.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }
    if let Some(opt) = &data.pharmaberater {
        sets.push("pharmaberater = ?");
        binds.push(opt.as_ref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()));
    }

    if sets.is_empty() {
        return fetch_by_id(pool, id).await;
    }

    sets.push("updated_at = CURRENT_TIMESTAMP");
    let sql = format!("UPDATE bestellung SET {} WHERE id = ?", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for v in &binds {
        q = q.bind(v);
    }
    q = q.bind(id);
    let result = q.execute(pool).await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Bestellung".into()));
    }
    fetch_by_id(pool, id).await
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let result = sqlx::query("DELETE FROM bestellung WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Bestellung".into()));
    }
    Ok(())
}

async fn fetch_by_id(pool: &SqlitePool, id: &str) -> Result<Bestellung, AppError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM bestellung WHERE id = ?1");
    Ok(sqlx::query_as::<_, Bestellung>(&sql)
        .bind(id)
        .fetch_one(pool)
        .await?)
}
