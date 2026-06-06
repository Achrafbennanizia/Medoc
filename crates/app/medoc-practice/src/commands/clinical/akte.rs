use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung, UpdateBehandlung,
    UpdateUntersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Zahnbefund};
use crate::error::AppError;
use crate::infrastructure::database::{akte_repo, audit_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_akte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Patientenakte, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let mut a = akte_repo::find_akte_by_patient(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if !rbac::allowed("patient.read_medical", role) {
        // Rezeption sees administrative shell only — no diagnoses / clinical text.
        a.diagnose = None;
        a.befunde = None;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Patientenakte",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_zahnbefund(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateZahnbefund,
) -> Result<Zahnbefund, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let z = akte_repo::upsert_zahnbefund(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "Zahnbefund",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_zahnbefunde(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Zahnbefund>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let rows = akte_repo::find_zahnbefunde(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Zahnbefund",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_behandlungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Behandlung>, AppError> {
    let session = rbac::require(&session_state, "patient.behandlungen_list_for_zahlung")?;
    let rows = akte_repo::list_behandlungen(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Behandlung",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(
        crate::application::akte::rezeption_redact::apply_rezeption_redact_behandlungen(
            &session.rolle,
            rows,
        ),
    )
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_untersuchungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Untersuchung>, AppError> {
    let session = rbac::require(&session_state, "patient.behandlungen_list_for_zahlung")?;
    let rows = akte_repo::list_untersuchungen(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Untersuchung",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(
        crate::application::akte::rezeption_redact::apply_rezeption_redact_untersuchungen(
            &session.rolle,
            rows,
        ),
    )
}

/// FA-LEIST-05: Behandlung zur Abrechnung freigeben (nur ärztliche Akte).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn release_behandlung_for_billing(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    behandlung_id: String,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::billing_release::release_behandlung_for_billing(
        &pool,
        &session.user_id,
        &behandlung_id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn release_untersuchung_for_billing(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    untersuchung_id: String,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::billing_release::release_untersuchung_for_billing(
        &pool,
        &session.user_id,
        &untersuchung_id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn save_anamnesebogen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: SaveAnamnesebogen,
) -> Result<Anamnesebogen, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let a = akte_repo::save_anamnesebogen(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "Anamnesebogen",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_anamnesebogen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<Anamnesebogen>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let bogen = akte_repo::find_anamnesebogen(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Anamnesebogen",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(bogen)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::create_untersuchung(
        &pool,
        &session.user_id,
        &session.rolle,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBehandlung,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::create_behandlung(
        &pool,
        &session.user_id,
        &session.rolle,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateBehandlung,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::update_behandlung(
        &pool,
        &session.user_id,
        &session.rolle,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::delete_behandlung(
        &pool,
        &session.user_id,
        &id,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::update_untersuchung(
        &pool,
        &session.user_id,
        &session.rolle,
        &data,
    )
    .await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    crate::application::akte::clinical_line_persistence::delete_untersuchung(
        &pool,
        &session.user_id,
        &id,
    )
    .await
}

/// FA-AKTE-04 / Erweiterung: Patientenakte als PDF (Abschnitte wählbar).
/// Returns base64-encoded PDF bytes for safe transport across the Tauri bridge.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn export_akte_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: crate::application::akte::pdf_export::ExportAktePdfArgs,
) -> Result<String, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    crate::application::akte::pdf_export::export_akte_pdf(&pool, &session, args).await
}

/// FA-DOK-08: Entlassungs-Merkblatt / Nachsorge als PDF (kompakte Zusammenfassung).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn export_discharge_merkblatt_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: crate::application::akte::pdf_export::ExportDischargeMerkblattPdfArgs,
) -> Result<String, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    crate::application::akte::pdf_export::export_discharge_merkblatt_pdf(&pool, &session, args)
        .await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_akte_commands {
    () => {
        $crate::commands::akte_commands::get_akte,
        $crate::commands::akte_commands::update_zahnbefund,
        $crate::commands::akte_commands::list_zahnbefunde,
        $crate::commands::akte_commands::list_behandlungen,
        $crate::commands::akte_commands::list_untersuchungen,
        $crate::commands::akte_commands::save_anamnesebogen,
        $crate::commands::akte_commands::get_anamnesebogen,
        $crate::commands::akte_commands::create_untersuchung,
        $crate::commands::akte_commands::create_behandlung,
        $crate::commands::akte_commands::update_behandlung,
        $crate::commands::akte_commands::delete_behandlung,
        $crate::commands::akte_commands::release_behandlung_for_billing,
        $crate::commands::akte_commands::release_untersuchung_for_billing,
        $crate::commands::akte_commands::update_untersuchung,
        $crate::commands::akte_commands::delete_untersuchung,
        $crate::commands::akte_commands::export_akte_pdf,
        $crate::commands::akte_commands::export_discharge_merkblatt_pdf,
    };
}
