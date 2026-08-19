//! Practice calendar (absences) and reusable prescription / certificate templates.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, practice_repo};
use sqlx::SqlitePool;
use tauri::State;

const ABSENCE_LIST: &[&str] = &["administration.practice_planning.read", "appointment.read"];

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_absences(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::Absence>, AppError> {
    rbac::require_one_of(&session_state, ABSENCE_LIST)?;
    practice_repo::list_absences(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_absence(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreateAbsence,
) -> Result<practice_repo::Absence, AppError> {
    let session = rbac::require(&session_state, "administration.practice_planning.write")?;
    let row = practice_repo::create_absence(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Absence",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_absence(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: practice_repo::UpdateAbsence,
) -> Result<practice_repo::Absence, AppError> {
    let session = rbac::require(&session_state, "administration.practice_planning.write")?;
    let row = practice_repo::update_absence(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Absence",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_absence(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "administration.practice_planning.write")?;
    practice_repo::delete_absence(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Absence",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_document_templates(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::DocumentTemplate>, AppError> {
    rbac::require(&session_state, "templates.read")?;
    practice_repo::list_document_templates(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_document_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreateDocumentTemplate,
) -> Result<practice_repo::DocumentTemplate, AppError> {
    let session = rbac::require(&session_state, "templates.write")?;
    let row = practice_repo::create_document_template(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "DocumentTemplate",
        Some(&row.id),
        Some(&row.kind),
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_document_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: practice_repo::UpdateDocumentTemplate,
) -> Result<practice_repo::DocumentTemplate, AppError> {
    let session = rbac::require(&session_state, "templates.write")?;
    let row = practice_repo::update_document_template(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "DocumentTemplate",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_document_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "templates.write")?;
    practice_repo::delete_document_template(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "DocumentTemplate",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_treatment_catalog(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::TreatmentCatalogItem>, AppError> {
    rbac::require(&session_state, "administration.catalogs.read")?;
    practice_repo::list_treatment_catalog(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_treatment_catalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreateTreatmentCatalogItem,
) -> Result<practice_repo::TreatmentCatalogItem, AppError> {
    let session = rbac::require(&session_state, "administration.catalogs.write")?;
    let row = practice_repo::create_treatment_catalog_item(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "TreatmentCatalog",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id, data))]
pub async fn update_treatment_catalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: practice_repo::UpdateTreatmentCatalogItem,
) -> Result<practice_repo::TreatmentCatalogItem, AppError> {
    let session = rbac::require(&session_state, "administration.catalogs.write")?;
    let row = practice_repo::update_treatment_catalog_item(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "TreatmentCatalog",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_treatment_catalog_item(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "administration.catalogs.write")?;
    practice_repo::delete_treatment_catalog_item(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "TreatmentCatalog",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

// --- OrderMaster (Supplier / PharmaConsultant / Kombi) ---

#[tauri::command]
pub async fn list_supplier_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::SupplierMasterRow>, AppError> {
    rbac::require(&session_state, "purchase_order.read")?;
    practice_repo::list_supplier_master(&pool).await
}

#[tauri::command]
pub async fn create_supplier_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreateSupplierMaster,
) -> Result<practice_repo::SupplierMasterRow, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let row = practice_repo::create_supplier_master(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "SupplierMaster",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_supplier_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    practice_repo::delete_supplier_master(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "SupplierMaster",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn list_pharma_consultant_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::PharmaConsultantMasterRow>, AppError> {
    rbac::require(&session_state, "purchase_order.read")?;
    practice_repo::list_pharma_consultant_master(&pool).await
}

#[tauri::command]
pub async fn create_pharma_consultant_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreatePharmaConsultantMaster,
) -> Result<practice_repo::PharmaConsultantMasterRow, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let row = practice_repo::create_pharma_consultant_master(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "PharmaConsultantMaster",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_pharma_consultant_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    practice_repo::delete_pharma_consultant_master(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "PharmaConsultantMaster",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn list_supplier_pharma_templates(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<practice_repo::SupplierPharmaTemplateRow>, AppError> {
    rbac::require(&session_state, "purchase_order.read")?;
    practice_repo::list_supplier_pharma_templates(&pool).await
}

#[tauri::command]
pub async fn create_supplier_pharma_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: practice_repo::CreateSupplierPharmaTemplate,
) -> Result<practice_repo::SupplierPharmaTemplateRow, AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    let row = practice_repo::create_supplier_pharma_template(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "SupplierPharmaTemplate",
        Some(&row.id),
        None,
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
pub async fn delete_supplier_pharma_template(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "purchase_order.write")?;
    practice_repo::delete_supplier_pharma_template(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "SupplierPharmaTemplate",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_practice_commands {
    () => {
        $crate::commands::practice_commands::list_absences,
        $crate::commands::practice_commands::create_absence,
        $crate::commands::practice_commands::update_absence,
        $crate::commands::practice_commands::delete_absence,
        $crate::commands::practice_commands::list_document_templates,
        $crate::commands::practice_commands::create_document_template,
        $crate::commands::practice_commands::update_document_template,
        $crate::commands::practice_commands::delete_document_template,
        $crate::commands::practice_commands::list_treatment_catalog,
        $crate::commands::practice_commands::create_treatment_catalog_item,
        $crate::commands::practice_commands::update_treatment_catalog_item,
        $crate::commands::practice_commands::delete_treatment_catalog_item,
        $crate::commands::practice_commands::list_supplier_master,
        $crate::commands::practice_commands::create_supplier_master,
        $crate::commands::practice_commands::delete_supplier_master,
        $crate::commands::practice_commands::list_pharma_consultant_master,
        $crate::commands::practice_commands::create_pharma_consultant_master,
        $crate::commands::practice_commands::delete_pharma_consultant_master,
        $crate::commands::practice_commands::list_supplier_pharma_templates,
        $crate::commands::practice_commands::create_supplier_pharma_template,
        $crate::commands::practice_commands::delete_supplier_pharma_template,
    };
}
