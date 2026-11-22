use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::patient::{CreatePatient, UpdatePatient};
use crate::domain::entities::Patient;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_patients(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Patient>, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let rows = patient_repo::find_all(&pool).await?;
    // NFA-SEC-04 ext.: every bulk patient read is auditable. We log only the
    // count to avoid leaking ids/PII into the audit-detail field.
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ_LIST",
        "Patient",
        None,
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

/// Patient list flag "Record open" (record is draft, in review or declined).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_patient_ids_open_chart(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<String>, AppError> {
    rbac::require(&session_state, "patient.read")?;
    patient_repo::patient_ids_open_chart(&pool).await
}

/// F57: tab counts over all patients (the list itself loads page by page).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn count_patients_by_filter(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    show_archived: Option<bool>,
) -> Result<
    medoc_core::infrastructure::database::repos::clinical::patient::PatientFilterCounts,
    AppError,
> {
    rbac::require(&session_state, "patient.read")?;
    let with_invoices = rbac::require_one_of(
        &session_state,
        crate::application::rbac::FINANCE_READ_OR_RECEPTION,
    )
    .is_ok();
    patient_repo::filter_counts(&pool, show_archived.unwrap_or(false), with_invoices).await
}

/// Settings → Search → "Patient search: insurance number" (`filter.includeInsuranceNumber`, default on).
fn search_scope(p: &crate::commands::list_params::ListParams) -> patient_repo::PatientSearchScope {
    patient_repo::PatientSearchScope {
        include_insurance_number: p.filter_bool("includeInsuranceNumber").unwrap_or(true),
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, params))]
pub async fn list_patients_paged(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    params: Option<crate::commands::list_params::ListParams>,
) -> Result<crate::commands::list_params::ListResponse<Patient>, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let mut p = params.unwrap_or_default();
    p.page_size = Some(p.limit().min(50));
    let limit = p.limit();
    let offset = p.offset();
    let include_archived = p.filter_bool("showArchived").unwrap_or(false);
    let status = p.filter_str("status");
    let (items, total) = patient_repo::find_paginated(
        &pool,
        limit,
        offset,
        p.search.as_deref().or(p.filter_str("query")),
        include_archived,
        status,
        search_scope(&p),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ_LIST",
        "Patient",
        None,
        Some(&format!(
            "count={} page={}",
            items.len(),
            p.page_one_based()
        )),
    )
    .await
    .ok();
    Ok(crate::commands::list_params::ListResponse {
        items,
        total,
        page: p.page_one_based(),
        page_size: limit,
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, ids))]
pub async fn list_patients_by_ids(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    ids: Vec<String>,
) -> Result<Vec<Patient>, AppError> {
    rbac::require(&session_state, "patient.read")?;
    patient_repo::find_by_ids(&pool, &ids).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let p = patient_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    audit_repo::create(&pool, &session.user_id, "READ", "Patient", Some(&id), None)
        .await
        .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePatient,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let p = patient_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Patient",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdatePatient,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.write")?;

    // FA-PAT-03 / F62: allowed values and forward-only transitions are enforced
    // by `PatientStatus::require_transition` inside `patient_repo::update`.
    let p = patient_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Patient",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app))]
pub async fn delete_patient(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let _app_dir = crate::commands::app_data_dir(&app)?;
    patient_repo::archive(&pool, &id).await?;
    let _ = app;
    audit_repo::create(
        &pool,
        &session.user_id,
        "ARCHIVE",
        "Patient",
        Some(&id),
        Some("ARCHIVED"),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn restore_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.system")?;
    patient_repo::restore_archived(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "RESTORE",
        "Patient",
        Some(&id),
        Some("ACTIVE"),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, query))]
pub async fn search_patients(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    query: String,
    include_insurance_number: Option<bool>,
) -> Result<Vec<Patient>, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let include_vn = include_insurance_number.unwrap_or(true);
    let rows = patient_repo::search(&pool, &query, include_vn).await?;
    // NFA-SEC-04 ext.: searches against patient PII are auditable. The query
    // string itself is omitted so we don't echo possibly-private input back.
    audit_repo::create(
        &pool,
        &session.user_id,
        "SEARCH",
        "Patient",
        None,
        Some(&format!("hits={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, params))]
pub async fn export_patients_csv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    params: Option<crate::commands::list_params::ListParams>,
) -> Result<String, AppError> {
    // Bulk PII export: migration/admin permission, not plain `patient.read`.
    let session = rbac::require(&session_state, "ops.migration")?;
    use medoc_core::application::documents::export_audit::csv_safe_cell as safe;
    let p = params.unwrap_or_default();
    let include_archived = p.filter_bool("showArchived").unwrap_or(false);
    let rows = patient_repo::find_all_matching(
        &pool,
        p.search.as_deref().or(p.filter_str("query")),
        include_archived,
        p.filter_str("status"),
        search_scope(&p),
    )
    .await?;
    let mut wtr = csv::WriterBuilder::new()
        .delimiter(b';')
        .from_writer(Vec::new());
    wtr.write_record([
        "name",
        "date_of_birth",
        "sex",
        "insurance_number",
        "phone",
        "email",
        "address",
        "status",
        "id",
    ])
    .map_err(|e| AppError::Internal(e.to_string()))?;
    for r in &rows {
        wtr.write_record([
            safe(r.name.as_str()),
            safe(&r.date_of_birth.to_string()),
            safe(r.sex.as_str()),
            safe(r.insurance_number.as_deref().unwrap_or("")),
            safe(r.phone.as_deref().unwrap_or("")),
            safe(r.email.as_deref().unwrap_or("")),
            safe(r.address.as_deref().unwrap_or("")),
            safe(r.status.as_str()),
            safe(r.id.as_str()),
        ])
        .map_err(|e| AppError::Internal(e.to_string()))?;
    }
    let bytes = wtr
        .into_inner()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let csv = String::from_utf8(bytes).map_err(|e| AppError::Internal(e.to_string()))?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "EXPORT_CSV",
        "Patient",
        None,
        Some(&format!("count={}", rows.len())),
    )
    .await?;
    // BOM so spreadsheet apps detect UTF-8 (umlauts).
    Ok(format!("\u{FEFF}{csv}"))
}
