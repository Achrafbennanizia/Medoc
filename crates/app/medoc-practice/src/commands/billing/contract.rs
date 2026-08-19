//! Practice contracts (`contract` table — replaces browser `localStorage`).

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::path::Path;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, contract_repo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractDto {
    pub id: String,
    pub designation: String,
    pub partner: String,
    pub amount: f64,
    pub interval: String,
    pub unlimited: bool,
    pub period_from: Option<String>,
    pub period_until: Option<String>,
    pub created_at: String,
    #[serde(default)]
    pub document_path: Option<String>,
}

fn row_to_dto(r: contract_repo::ContractRow) -> ContractDto {
    ContractDto {
        id: r.id,
        designation: r.designation,
        partner: r.partner,
        amount: r.amount,
        interval: r.interval,
        unlimited: r.unlimited != 0,
        period_from: r.period_from,
        period_until: r.period_until,
        created_at: r.created_at,
        document_path: r.document_path,
    }
}

fn dto_to_row(d: &ContractDto) -> Result<contract_repo::ContractRow, AppError> {
    let iv = d.interval.to_uppercase();
    if iv != "DAY" && iv != "WEEK" && iv != "MONTH" && iv != "YEAR" {
        return Err(AppError::Validation("Invalid interval".into()));
    }
    Ok(contract_repo::ContractRow {
        id: d.id.clone(),
        designation: d.designation.clone(),
        partner: d.partner.clone(),
        amount: d.amount,
        interval: iv,
        unlimited: if d.unlimited { 1 } else { 0 },
        period_from: d.period_from.clone(),
        period_until: d.period_until.clone(),
        created_at: d.created_at.clone(),
        document_path: d.document_path.clone(),
    })
}

/// Open a contract PDF/scan with the OS default handler (no arbitrary path from FE).
fn open_path_with_os_default(path: &Path) -> Result<(), AppError> {
    let p = path
        .to_str()
        .ok_or_else(|| AppError::Internal("Invalid file path".into()))?;
    if cfg!(target_os = "macos") {
        let st = std::process::Command::new("open")
            .arg(p)
            .status()
            .map_err(|e| AppError::Internal(format!("open: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Could not open file with the default application.".into(),
            ));
        }
        return Ok(());
    }
    if cfg!(target_os = "windows") {
        let st = std::process::Command::new("cmd")
            .args(["/C", "start", "", p])
            .status()
            .map_err(|e| AppError::Internal(format!("start: {e}")))?;
        if !st.success() {
            return Err(AppError::Internal(
                "Could not open file.".into(),
            ));
        }
        return Ok(());
    }
    let st = std::process::Command::new("xdg-open")
        .arg(p)
        .status()
        .map_err(|e| AppError::Internal(format!("xdg-open: {e}")))?;
    if !st.success() {
        return Err(AppError::Internal(
            "Could not open file.".into(),
        ));
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_contracts(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<ContractDto>, AppError> {
    let session = rbac::require(&session_state, "administration.contracts.read")?;
    let rows = contract_repo::list_all(&pool).await?;
    audit_repo::create(&pool, &session.user_id, "READ", "Contract", None, None).await?;
    Ok(rows.into_iter().map(row_to_dto).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn upsert_contract(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: ContractDto,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "administration.contracts.write")?;
    let row = dto_to_row(&data)?;
    contract_repo::upsert(&pool, &row).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Contract",
        Some(&data.id),
        Some(&data.designation),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_contract(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "administration.contracts.write")?;
    let n = contract_repo::delete_by_id(&pool, &id).await?;
    if n == 0 {
        return Err(AppError::NotFound("Contract".into()));
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Contract",
        Some(&id),
        None,
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn open_contract_document(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    contract_id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "administration.contracts.read")?;
    let row = contract_repo::find_by_id(&pool, &contract_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Contract".into()))?;
    let rel = row
        .document_path
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| AppError::NotFound("Kein Vertragsdokument".into()))?;
    let path = Path::new(&rel);
    if !path.is_file() {
        return Err(AppError::NotFound("Contract file not found".into()));
    }
    open_path_with_os_default(path)?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "OPEN_EXTERNAL",
        "ContractDocument",
        Some(&contract_id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_contract_commands {
    () => {
        $crate::commands::contract_commands::list_contracts,
        $crate::commands::contract_commands::upsert_contract,
        $crate::commands::contract_commands::delete_contract,
        $crate::commands::contract_commands::open_contract_document,
    };
}
