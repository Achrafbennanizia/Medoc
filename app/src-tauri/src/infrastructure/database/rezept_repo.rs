use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::rezept::{CreateRezept, Rezept, UpdateRezept};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Rezept>, AppError> {
    let rows = sqlx::query_as::<_, Rezept>(
        "SELECT * FROM rezept WHERE patient_id = ?1 ORDER BY ausgestellt_am DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Rezept>, AppError> {
    let row = sqlx::query_as::<_, Rezept>("SELECT * FROM rezept WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, data: &CreateRezept) -> Result<Rezept, AppError> {
    let id = Uuid::new_v4().to_string();
    let aut_idem = data.aut_idem.unwrap_or(true);
    let rezept_typ = data
        .rezept_typ
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("PRIVAT");
    sqlx::query(
        "INSERT INTO rezept (
            id, patient_id, arzt_id, medikament, wirkstoff, dosierung, dauer, hinweise,
            pzn, darreichungsform, packungsgroesse, menge, aut_idem, rezept_typ, icd10_code, verordnender_arzt_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(&data.arzt_id)
    .bind(&data.medikament)
    .bind(&data.wirkstoff)
    .bind(&data.dosierung)
    .bind(&data.dauer)
    .bind(&data.hinweise)
    .bind(&data.pzn)
    .bind(&data.darreichungsform)
    .bind(&data.packungsgroesse)
    .bind(data.menge)
    .bind(aut_idem)
    .bind(rezept_typ)
    .bind(&data.icd10_code)
    .bind(&data.verordnender_arzt_id)
    .execute(pool)
    .await?;
    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Rezept create failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM rezept WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, data: &UpdateRezept) -> Result<Rezept, AppError> {
    let ex = find_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Rezept".into()))?;
    let aut_idem = data.aut_idem.or(ex.aut_idem).unwrap_or(true);
    let rezept_typ = data
        .rezept_typ
        .as_deref()
        .or(ex.rezept_typ.as_deref())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("PRIVAT");
    sqlx::query(
        "UPDATE rezept SET
            medikament = ?1, wirkstoff = ?2, dosierung = ?3, dauer = ?4, hinweise = ?5,
            pzn = ?6, darreichungsform = ?7, packungsgroesse = ?8, menge = ?9,
            aut_idem = ?10, rezept_typ = ?11, icd10_code = ?12, verordnender_arzt_id = ?13
         WHERE id = ?14",
    )
    .bind(&data.medikament)
    .bind(&data.wirkstoff)
    .bind(&data.dosierung)
    .bind(&data.dauer)
    .bind(&data.hinweise)
    .bind(&data.pzn)
    .bind(&data.darreichungsform)
    .bind(&data.packungsgroesse)
    .bind(data.menge)
    .bind(aut_idem)
    .bind(rezept_typ)
    .bind(&data.icd10_code)
    .bind(&data.verordnender_arzt_id)
    .bind(&data.id)
    .execute(pool)
    .await?;
    find_by_id(pool, &ex.id)
        .await?
        .ok_or(AppError::Internal("Rezept update failed".into()))
}
