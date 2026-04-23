use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Zahnbefund};
use crate::error::AppError;
use crate::infrastructure::database::{akte_repo, audit_repo, patient_repo};
use crate::infrastructure::pdf::{render_akte, AkteDocument};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
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
pub async fn list_zahnbefunde(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Zahnbefund>, AppError> {
    rbac::require(&session_state, "patient.read_medical")?;
    akte_repo::find_zahnbefunde(&pool, &akte_id).await
}

#[tauri::command]
pub async fn list_behandlungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Behandlung>, AppError> {
    rbac::require(&session_state, "patient.read_medical")?;
    akte_repo::list_behandlungen(&pool, &akte_id).await
}

#[tauri::command]
pub async fn list_untersuchungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Untersuchung>, AppError> {
    rbac::require(&session_state, "patient.read_medical")?;
    akte_repo::list_untersuchungen(&pool, &akte_id).await
}

#[tauri::command]
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
pub async fn get_anamnesebogen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<Anamnesebogen>, AppError> {
    rbac::require(&session_state, "patient.read_medical")?;
    akte_repo::find_anamnesebogen(&pool, &patient_id).await
}

#[tauri::command]
pub async fn create_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let u = akte_repo::create_untersuchung(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Untersuchung",
        Some(&u.id),
        None,
    )
    .await
    .ok();
    Ok(u)
}

#[tauri::command]
pub async fn create_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBehandlung,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let b = akte_repo::create_behandlung(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Behandlung",
        Some(&b.id),
        None,
    )
    .await
    .ok();
    Ok(b)
}

/// FA-AKTE-04: Patientenakte als PDF exportieren.
/// Returns base64-encoded PDF bytes for safe transport across the Tauri bridge.
#[tauri::command]
pub async fn export_akte_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<String, AppError> {
    use base64::Engine;
    let session = rbac::require(&session_state, "patient.read_medical")?;

    let patient = patient_repo::find_by_id(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let akte = akte_repo::find_akte_by_patient(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;
    let behandlungen = akte_repo::list_behandlungen(&pool, &akte.id).await?;

    let doc = AkteDocument {
        patient_name: patient.name,
        patient_geburtsdatum: patient.geburtsdatum.to_string(),
        patient_versicherungsnummer: patient.versicherungsnummer,
        akte_status: akte.status,
        diagnose: akte.diagnose,
        befunde: akte.befunde,
        behandlungen: behandlungen
            .into_iter()
            .map(|b| {
                (
                    b.created_at.format("%Y-%m-%d").to_string(),
                    format!("{}: {}", b.art, b.beschreibung.unwrap_or_default()),
                )
            })
            .collect(),
        generated_at: chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string(),
    };

    let bytes = render_akte(&doc)?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "EXPORT_PDF",
        "Patientenakte",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}
