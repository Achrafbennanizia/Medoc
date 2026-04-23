use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Zahnbefund};
use crate::error::AppError;
use sqlx::SqlitePool;

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
    sqlx::query(
        "INSERT INTO untersuchung (id, akte_id, beschwerden, ergebnisse, diagnose)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(&data.akte_id)
    .bind(&data.beschwerden)
    .bind(&data.ergebnisse)
    .bind(&data.diagnose)
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
        "SELECT * FROM behandlung WHERE akte_id = ?1 ORDER BY created_at DESC",
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
    sqlx::query(
        "INSERT INTO behandlung (id, akte_id, art, beschreibung, zaehne, material, notizen)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(&data.akte_id)
    .bind(&data.art)
    .bind(&data.beschreibung)
    .bind(&data.zaehne)
    .bind(&data.material)
    .bind(&data.notizen)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Behandlung>("SELECT * FROM behandlung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}
