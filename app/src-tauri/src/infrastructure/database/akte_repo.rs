use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung, UpdateBehandlung,
    UpdateUntersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Zahnbefund};
use crate::error::AppError;
use sqlx::SqlitePool;

/// Nächste `U-{Jahr}-{nnn}`-Nummer je Akte (Fortlaufend pro Jahr).
pub async fn next_untersuchungsnummer(pool: &SqlitePool, akte_id: &str) -> Result<String, AppError> {
    let year = chrono::Utc::now().format("%Y").to_string();
    let prefix = format!("U-{year}-");
    let rows: Vec<(Option<String>,)> = sqlx::query_as(
        "SELECT untersuchungsnummer FROM untersuchung WHERE akte_id = ?1 AND untersuchungsnummer IS NOT NULL AND TRIM(untersuchungsnummer) != ''",
    )
    .bind(akte_id)
    .fetch_all(pool)
    .await?;
    let mut max = 0u32;
    for (n,) in rows {
        let Some(n) = n else { continue };
        if let Some(rest) = n.strip_prefix(prefix.as_str()) {
            if let Ok(v) = rest.parse::<u32>() {
                max = max.max(v);
            }
        }
    }
    let next = max + 1;
    Ok(format!("{prefix}{:03}", next))
}

pub async fn find_akte_by_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<Patientenakte>, AppError> {
    let row =
        sqlx::query_as::<_, Patientenakte>("SELECT * FROM patientenakte WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

// --- Zahnbefund ---

pub async fn find_zahnbefunde(
    pool: &SqlitePool,
    akte_id: &str,
) -> Result<Vec<Zahnbefund>, AppError> {
    let rows = sqlx::query_as::<_, Zahnbefund>(
        "SELECT * FROM zahnbefund WHERE akte_id = ?1 ORDER BY zahn_nummer",
    )
    .bind(akte_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn upsert_zahnbefund(
    pool: &SqlitePool,
    data: &CreateZahnbefund,
) -> Result<Zahnbefund, AppError> {
    data.validate_zahn_nummer().map_err(AppError::Validation)?;

    // Check if befund for this tooth already exists
    let existing: Option<Zahnbefund> =
        sqlx::query_as("SELECT * FROM zahnbefund WHERE akte_id = ?1 AND zahn_nummer = ?2")
            .bind(&data.akte_id)
            .bind(data.zahn_nummer)
            .fetch_optional(pool)
            .await?;

    if let Some(ex) = existing {
        sqlx::query(
            "UPDATE zahnbefund SET befund = ?1, diagnose = ?2, notizen = ?3, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?4"
        )
        .bind(&data.befund)
        .bind(&data.diagnose)
        .bind(&data.notizen)
        .bind(&ex.id)
        .execute(pool)
        .await?;

        Ok(
            sqlx::query_as::<_, Zahnbefund>("SELECT * FROM zahnbefund WHERE id = ?1")
                .bind(&ex.id)
                .fetch_one(pool)
                .await?,
        )
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO zahnbefund (id, akte_id, zahn_nummer, befund, diagnose, notizen)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .bind(&id)
        .bind(&data.akte_id)
        .bind(data.zahn_nummer)
        .bind(&data.befund)
        .bind(&data.diagnose)
        .bind(&data.notizen)
        .execute(pool)
        .await?;

        Ok(
            sqlx::query_as::<_, Zahnbefund>("SELECT * FROM zahnbefund WHERE id = ?1")
                .bind(&id)
                .fetch_one(pool)
                .await?,
        )
    }
}

// --- Anamnesebogen ---

pub async fn find_anamnesebogen(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<Anamnesebogen>, AppError> {
    let row =
        sqlx::query_as::<_, Anamnesebogen>("SELECT * FROM anamnesebogen WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
    Ok(row)
}

pub async fn save_anamnesebogen(
    pool: &SqlitePool,
    data: &SaveAnamnesebogen,
) -> Result<Anamnesebogen, AppError> {
    let antworten_json =
        serde_json::to_string(&data.antworten).map_err(|e| AppError::Internal(e.to_string()))?;

    let existing = find_anamnesebogen(pool, &data.patient_id).await?;

    if let Some(ex) = existing {
        sqlx::query(
            "UPDATE anamnesebogen SET antworten = ?1, unterschrieben = ?2, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?3"
        )
        .bind(&antworten_json)
        .bind(data.unterschrieben)
        .bind(&ex.id)
        .execute(pool)
        .await?;

        Ok(
            sqlx::query_as::<_, Anamnesebogen>("SELECT * FROM anamnesebogen WHERE id = ?1")
                .bind(&ex.id)
                .fetch_one(pool)
                .await?,
        )
    } else {
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO anamnesebogen (id, patient_id, antworten, unterschrieben)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&id)
        .bind(&data.patient_id)
        .bind(&antworten_json)
        .bind(data.unterschrieben)
        .execute(pool)
        .await?;

        Ok(
            sqlx::query_as::<_, Anamnesebogen>("SELECT * FROM anamnesebogen WHERE id = ?1")
                .bind(&id)
                .fetch_one(pool)
                .await?,
        )
    }
}

// --- Untersuchung ---

pub async fn create_untersuchung(
    pool: &SqlitePool,
    data: &CreateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let nr = match &data.untersuchungsnummer {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => next_untersuchungsnummer(pool, &data.akte_id).await?,
    };
    sqlx::query(
        "INSERT INTO untersuchung (id, akte_id, beschwerden, ergebnisse, diagnose, untersuchungsnummer)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(&data.akte_id)
    .bind(&data.beschwerden)
    .bind(&data.ergebnisse)
    .bind(&data.diagnose)
    .bind(&nr)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Untersuchung>("SELECT * FROM untersuchung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn list_untersuchungen(
    pool: &SqlitePool,
    akte_id: &str,
) -> Result<Vec<Untersuchung>, AppError> {
    let rows = sqlx::query_as::<_, Untersuchung>(
        "SELECT * FROM untersuchung WHERE akte_id = ?1 ORDER BY created_at DESC",
    )
    .bind(akte_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

// --- Behandlung ---

pub async fn list_behandlungen(
    pool: &SqlitePool,
    akte_id: &str,
) -> Result<Vec<Behandlung>, AppError> {
    let rows = sqlx::query_as::<_, Behandlung>(
        "SELECT * FROM behandlung WHERE akte_id = ?1
         ORDER BY
           CASE WHEN behandlungsnummer IS NULL OR behandlungsnummer = '' THEN 1 ELSE 0 END,
           behandlungsnummer DESC,
           COALESCE(sitzung, 0) DESC,
           created_at DESC",
    )
    .bind(akte_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_behandlung(
    pool: &SqlitePool,
    data: &CreateBehandlung,
) -> Result<Behandlung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let kat = data
        .kategorie
        .clone()
        .unwrap_or_else(|| data.art.clone());
    let leist = data
        .leistungsname
        .clone()
        .or_else(|| data.beschreibung.clone());
    let termin = data.termin_erforderlich.map(|b| if b { 1i64 } else { 0i64 });
    sqlx::query(
        "INSERT INTO behandlung (id, akte_id, art, beschreibung, zaehne, material, notizen,
         kategorie, leistungsname, behandlungsnummer, sitzung, behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
    )
    .bind(&id)
    .bind(&data.akte_id)
    .bind(&data.art)
    .bind(&data.beschreibung)
    .bind(&data.zaehne)
    .bind(&data.material)
    .bind(&data.notizen)
    .bind(&kat)
    .bind(&leist)
    .bind(&data.behandlungsnummer)
    .bind(data.sitzung)
    .bind(&data.behandlung_status)
    .bind(data.gesamtkosten)
    .bind(termin)
    .bind(&data.behandlung_datum)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Behandlung>("SELECT * FROM behandlung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn find_behandlung_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Behandlung>, AppError> {
    let row = sqlx::query_as::<_, Behandlung>("SELECT * FROM behandlung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn update_behandlung(
    pool: &SqlitePool,
    data: &UpdateBehandlung,
) -> Result<Behandlung, AppError> {
    let existing = find_behandlung_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Behandlung".into()))?;
    let kat = data
        .kategorie
        .clone()
        .unwrap_or_else(|| data.art.clone());
    let leist = data
        .leistungsname
        .clone()
        .or_else(|| data.beschreibung.clone());
    let termin = data.termin_erforderlich.map(|b| if b { 1i64 } else { 0i64 });
    sqlx::query(
        "UPDATE behandlung SET art = ?1, beschreibung = ?2, zaehne = ?3, material = ?4, notizen = ?5,
         kategorie = ?6, leistungsname = ?7, behandlungsnummer = ?8, sitzung = ?9,
         behandlung_status = ?10, gesamtkosten = ?11, termin_erforderlich = ?12, behandlung_datum = ?13
         WHERE id = ?14",
    )
    .bind(&data.art)
    .bind(&data.beschreibung)
    .bind(&data.zaehne)
    .bind(&data.material)
    .bind(&data.notizen)
    .bind(&kat)
    .bind(&leist)
    .bind(&data.behandlungsnummer)
    .bind(data.sitzung)
    .bind(&data.behandlung_status)
    .bind(data.gesamtkosten)
    .bind(termin)
    .bind(&data.behandlung_datum)
    .bind(&data.id)
    .execute(pool)
    .await?;
    find_behandlung_by_id(pool, &existing.id)
        .await?
        .ok_or(AppError::Internal("Behandlung update failed".into()))
}

pub async fn delete_behandlung(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let n = sqlx::query("DELETE FROM behandlung WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Behandlung".into()));
    }
    Ok(())
}

pub async fn find_untersuchung_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<Untersuchung>, AppError> {
    sqlx::query_as::<_, Untersuchung>("SELECT * FROM untersuchung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

pub async fn update_untersuchung(
    pool: &SqlitePool,
    data: &UpdateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let _ex = find_untersuchung_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Untersuchung".into()))?;
    sqlx::query(
        "UPDATE untersuchung SET beschwerden = ?1, ergebnisse = ?2, diagnose = ?3 WHERE id = ?4",
    )
    .bind(&data.beschwerden)
    .bind(&data.ergebnisse)
    .bind(&data.diagnose)
    .bind(&data.id)
    .execute(pool)
    .await?;
    find_untersuchung_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::Internal("Untersuchung update failed".into()))
}

pub async fn delete_untersuchung(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let n = sqlx::query("DELETE FROM untersuchung WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Untersuchung".into()));
    }
    Ok(())
}
