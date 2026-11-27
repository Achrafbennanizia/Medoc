//! Help → Send to support (T7.2, docs/architecture/editions-plan.md §11.3).

use medoc_core::application::support_bundle::{self, BundleInput, BundleResult};
use medoc_core::infrastructure::{logging, support_seal};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, State};

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;

/// Support address baked in at build time; unset: the mail opens with an empty "To".
const SUPPORT_EMAIL: Option<&str> = option_env!("MEDOC_SUPPORT_EMAIL");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SupportBundleArgs {
    pub description: String,
    pub include_logs: bool,
    pub error_ref: Option<String>,
    /// Mail body line in the UI language ("attach the file saved in Downloads").
    pub body_intro: String,
}

async fn device_short_id(pool: &SqlitePool) -> String {
    let id: Option<String> =
        sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'sync.device_id.v1'")
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();
    id.unwrap_or_default().chars().take(8).collect()
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, app, args))]
pub async fn support_bundle_create(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: SupportBundleArgs,
) -> Result<BundleResult, AppError> {
    let session = require(&session_state, "ops.system")?;
    let info = crate::edition::info();
    let input = BundleInput {
        description: args.description.chars().take(10_000).collect(),
        error_ref: args.error_ref.clone(),
        meta: serde_json::json!({
            "version": info.version,
            "edition": info.edition,
            "flavor": info.flavor,
            "os": std::env::consts::OS,
            "arch": std::env::consts::ARCH,
            "device": device_short_id(&pool).await,
            "createdAt": chrono::Utc::now().to_rfc3339(),
        }),
        health: super::health::summary(&pool, &app).await,
        errors: medoc_core::infrastructure::error_reports::recent(),
        logs_zip: if args.include_logs {
            Some(logging::export::export_to_vec(logging::log_dir()?)?)
        } else {
            None
        },
    };
    let sealed = support_seal::seal(&support_bundle::build_zip(&input)?)?;
    let file_name = support_bundle::file_name(chrono::Local::now(), args.error_ref.as_deref());
    let dir = dirs::download_dir()
        .or_else(dirs::home_dir)
        .ok_or_else(|| AppError::Internal("no Downloads folder".into()))?;
    let path = dir.join(&file_name);
    std::fs::write(&path, &sealed)
        .map_err(|e| AppError::Internal(format!("save support file: {e}")))?;
    let details = serde_json::json!({
        "file": file_name,
        "bytes": sealed.len(),
        "contents": support_bundle::contents(&input),
        "sink": "email",
    });
    audit_repo::create(
        &pool,
        &session.user_id,
        "SUPPORT_BUNDLE_CREATED",
        "support",
        None,
        Some(&details.to_string()),
    )
    .await?;
    Ok(BundleResult {
        path: path.display().to_string(),
        mailto: support_bundle::mailto(
            SUPPORT_EMAIL,
            info.edition,
            info.version,
            args.error_ref.as_deref(),
            &file_name,
            &args.body_intro,
        ),
        file_name,
        bytes: sealed.len() as u64,
        dev_key: support_seal::uses_dev_key(),
    })
}
