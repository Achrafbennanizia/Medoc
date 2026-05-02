//! Practice contracts (`vertrag` table — replaces browser `localStorage`).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, vertrag_repo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VertragDto {
    pub id: String,
    pub bezeichnung: String,
    pub partner: String,
    pub betrag: f64,
    pub intervall: String,
    pub unbefristet: bool,
    pub periode_von: Option<String>,
    pub periode_bis: Option<String>,
    pub created_at: String,
}

fn row_to_dto(r: vertrag_repo::VertragRow) -> VertragDto {
    VertragDto {
        id: r.id,
        bezeichnung: r.bezeichnung,
        partner: r.partner,
        betrag: r.betrag,
        intervall: r.intervall,
        unbefristet: r.unbefristet != 0,
        periode_von: r.periode_von,
        periode_bis: r.periode_bis,
        created_at: r.created_at,
    }
}

fn dto_to_row(d: &VertragDto) -> Result<vertrag_repo::VertragRow, AppError> {
    let iv = d.intervall.to_uppercase();
    if iv != "TAG" && iv != "WOCHE" && iv != "MONAT" && iv != "JAHR" {
        return Err(AppError::Validation("intervall ungültig".into()));
    }
    Ok(vertrag_repo::VertragRow {
        id: d.id.clone(),
        bezeichnung: d.bezeichnung.clone(),
        partner: d.partner.clone(),
        betrag: d.betrag,
        intervall: iv,
        unbefristet: if d.unbefristet { 1 } else { 0 },
        periode_von: d.periode_von.clone(),
        periode_bis: d.periode_bis.clone(),
        created_at: d.created_at.clone(),
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_vertraege(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<VertragDto>, AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.read")?;
    let rows = vertrag_repo::list_all(&pool).await?;
    audit_repo::create(&pool, &session.user_id, "READ", "Vertrag", None, None).await?;
    Ok(rows.into_iter().map(row_to_dto).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn upsert_vertrag(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: VertragDto,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let row = dto_to_row(&data)?;
    vertrag_repo::upsert(&pool, &row).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Vertrag",
        Some(&data.id),
        Some(&data.bezeichnung),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_vertrag(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "verwaltung.vertraege.write")?;
    let n = vertrag_repo::delete_by_id(&pool, &id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Vertrag".into()));
    }
    audit_repo::create(&pool, &session.user_id, "DELETE", "Vertrag", Some(&id), None).await?;
    Ok(())
}
