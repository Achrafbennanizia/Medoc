//! Tagesabschluss-Protokolle (Finanzen / Kasse).
use crate::domain::entities::tagesabschluss_protokoll::{CreateTagesabschlussProtokoll, TagesabschlussProtokoll};
use crate::error::AppError;
use chrono::NaiveDate;
use sqlx::SqlitePool;

fn validate_stichtag(s: &str) -> Result<(), AppError> {
    let t = s.trim();
    if t.is_empty() {
        return Err(AppError::Validation("Stichtag erforderlich".into()));
    }
    NaiveDate::parse_from_str(t, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("Stichtag muss YYYY-MM-DD sein".into()))?;
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> Result<Vec<TagesabschlussProtokoll>, AppError> {
    let rows = sqlx::query_as::<_, TagesabschlussProtokoll>(
        "SELECT id, stichtag, gezaehlt_eur, bar_laut_system_eur, einnahmen_laut_system_eur, abweichung_eur,
                bar_stimmt, anzahl_zahlungen_tag, anzahl_kasse_geprueft, alle_zahlungen_geprueft, notiz, protokolliert_at
           FROM tagesabschluss_protokoll
          ORDER BY protokolliert_at DESC, id DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn get(pool: &SqlitePool, id: &str) -> Result<TagesabschlussProtokoll, AppError> {
    sqlx::query_as::<_, TagesabschlussProtokoll>(
        "SELECT id, stichtag, gezaehlt_eur, bar_laut_system_eur, einnahmen_laut_system_eur, abweichung_eur,
                bar_stimmt, anzahl_zahlungen_tag, anzahl_kasse_geprueft, alle_zahlungen_geprueft, notiz, protokolliert_at
           FROM tagesabschluss_protokoll
          WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound("TagesabschlussProtokoll".into()))
}

pub async fn create(pool: &SqlitePool, data: &CreateTagesabschlussProtokoll) -> Result<TagesabschlussProtokoll, AppError> {
    validate_stichtag(&data.stichtag)?;
    if !data.bar_laut_system_eur.is_finite() || !data.einnahmen_laut_system_eur.is_finite() {
        return Err(AppError::Validation("Beträge ungültig".into()));
    }
    if let Some(g) = data.gezaehlt_eur {
        if !g.is_finite() {
            return Err(AppError::Validation("Gezählter Betrag ungültig".into()));
        }
    }
    if let Some(a) = data.abweichung_eur {
        if !a.is_finite() {
            return Err(AppError::Validation("Abweichung ungültig".into()));
        }
    }
    if data.anzahl_zahlungen_tag < 0
        || data.anzahl_kasse_geprueft < 0
        || (data.bar_stimmt != 0 && data.bar_stimmt != 1)
        || (data.alle_zahlungen_geprueft != 0 && data.alle_zahlungen_geprueft != 1)
    {
        return Err(AppError::Validation("Kennzahlen ungültig".into()));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let notiz = data
        .notiz
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    sqlx::query(
        "INSERT INTO tagesabschluss_protokoll
            (id, stichtag, gezaehlt_eur, bar_laut_system_eur, einnahmen_laut_system_eur, abweichung_eur,
             bar_stimmt, anzahl_zahlungen_tag, anzahl_kasse_geprueft, alle_zahlungen_geprueft, notiz)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&id)
    .bind(data.stichtag.trim())
    .bind(data.gezaehlt_eur)
    .bind(data.bar_laut_system_eur)
    .bind(data.einnahmen_laut_system_eur)
    .bind(data.abweichung_eur)
    .bind(data.bar_stimmt)
    .bind(data.anzahl_zahlungen_tag)
    .bind(data.anzahl_kasse_geprueft)
    .bind(data.alle_zahlungen_geprueft)
    .bind(notiz)
    .execute(pool)
    .await?;
    get(pool, &id).await
}

pub async fn delete_row(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM tagesabschluss_protokoll WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("TagesabschlussProtokoll".into()));
    }
    Ok(())
}
