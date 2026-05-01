//! Practice calendar (absences) and reusable prescription / certificate templates.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, praxis_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_abwesenheiten(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::Abwesenheit>, AppError> {
    rbac::require(&session_state, "personal.read")?;
    praxis_repo::list_abwesenheiten(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_abwesenheit(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreateAbwesenheit,
) -> Result<praxis_repo::Abwesenheit, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let row = praxis_repo::create_abwesenheit(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Abwesenheit",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_abwesenheit(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: praxis_repo::UpdateAbwesenheit,
) -> Result<praxis_repo::Abwesenheit, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let row = praxis_repo::update_abwesenheit(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Abwesenheit",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_abwesenheit(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    praxis_repo::delete_abwesenheit(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Abwesenheit",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_dokument_vorlagen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::DokumentVorlage>, AppError> {
    rbac::require(&session_state, "vorlagen.read")?;
    praxis_repo::list_dokument_vorlagen(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_dokument_vorlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreateDokumentVorlage,
) -> Result<praxis_repo::DokumentVorlage, AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    let row = praxis_repo::create_dokument_vorlage(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "DokumentVorlage",
        Some(&row.id),
        Some(&row.kind),
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_dokument_vorlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: praxis_repo::UpdateDokumentVorlage,
) -> Result<praxis_repo::DokumentVorlage, AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    let row = praxis_repo::update_dokument_vorlage(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "DokumentVorlage",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_dokument_vorlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "vorlagen.write")?;
    praxis_repo::delete_dokument_vorlage(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "DokumentVorlage",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_behandlungs_katalog(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::BehandlungsKatalogItem>, AppError> {
    rbac::require(&session_state, "personal.read")?;
    praxis_repo::list_behandlungs_katalog(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_behandlungs_katalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreateBehandlungsKatalogItem,
) -> Result<praxis_repo::BehandlungsKatalogItem, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let row = praxis_repo::create_behandlungs_katalog_item(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "BehandlungsKatalog",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_behandlungs_katalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: praxis_repo::UpdateBehandlungsKatalogItem,
) -> Result<praxis_repo::BehandlungsKatalogItem, AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    let row = praxis_repo::update_behandlungs_katalog_item(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "BehandlungsKatalog",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_behandlungs_katalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "personal.write")?;
    praxis_repo::delete_behandlungs_katalog_item(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "BehandlungsKatalog",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

// --- Bestellstamm (Lieferant / Pharmaberater / Kombi) ---

#[tauri::command]
pub async fn list_lieferant_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::LieferantStammRow>, AppError> {
    rbac::require(&session_state, "bestellung.read")?;
    praxis_repo::list_lieferant_stamm(&pool).await
}

#[tauri::command]
pub async fn create_lieferant_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreateLieferantStamm,
) -> Result<praxis_repo::LieferantStammRow, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let row = praxis_repo::create_lieferant_stamm(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "LieferantStamm",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_lieferant_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    praxis_repo::delete_lieferant_stamm(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "LieferantStamm",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn list_pharmaberater_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::PharmaberaterStammRow>, AppError> {
    rbac::require(&session_state, "bestellung.read")?;
    praxis_repo::list_pharmaberater_stamm(&pool).await
}

#[tauri::command]
pub async fn create_pharmaberater_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreatePharmaberaterStamm,
) -> Result<praxis_repo::PharmaberaterStammRow, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let row = praxis_repo::create_pharmaberater_stamm(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PharmaberaterStamm",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_pharmaberater_stamm(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    praxis_repo::delete_pharmaberater_stamm(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "PharmaberaterStamm",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn list_lieferant_pharma_vorlagen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<praxis_repo::LieferantPharmaVorlageRow>, AppError> {
    rbac::require(&session_state, "bestellung.read")?;
    praxis_repo::list_lieferant_pharma_vorlagen(&pool).await
}

#[tauri::command]
pub async fn create_lieferant_pharma_vorlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: praxis_repo::CreateLieferantPharmaVorlage,
) -> Result<praxis_repo::LieferantPharmaVorlageRow, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let row = praxis_repo::create_lieferant_pharma_vorlage(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "LieferantPharmaVorlage",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_lieferant_pharma_vorlage(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    praxis_repo::delete_lieferant_pharma_vorlage(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "LieferantPharmaVorlage",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
