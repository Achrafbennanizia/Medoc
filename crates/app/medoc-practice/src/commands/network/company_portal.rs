//! Hersteller-Portal-Konfiguration (nur `ops.system` — enthält API-Schlüssel).
use medoc_core::infrastructure::license::mint_dev_v2_license_envelope;
use medoc_core::infrastructure::license_repo;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::company_portal::config::{
    default_onboarding_base_url, is_portal_configured, load_company_portal_config,
    CompanyPortalConfig, COMPANY_PORTAL_KV_KEY,
};
use crate::infrastructure::company_portal::register_practice_onboarding;
use crate::infrastructure::database::app_kv_repo;
use crate::systems::company::{CompanyPortalPort, COMPANY_PORTAL};
use medoc_core::domain::enums::Rolle;
use medoc_sync::verbund::services::verbund_status;

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_company_portal_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<CompanyPortalConfig, AppError> {
    rbac::require(&session_state, "ops.system")?;
    Ok(load_company_portal_config(&pool).await)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, config))]
pub async fn set_company_portal_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    config: CompanyPortalConfig,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let raw = serde_json::to_string(&config).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(&pool, COMPANY_PORTAL_KV_KEY, &raw).await
}

#[tauri::command]
pub async fn company_portal_fetch_summary(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL.fetch_subscription_summary(&cfg).await
}

#[tauri::command]
pub async fn company_portal_fetch_integrations(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL.fetch_integration_statuses(&cfg).await
}

#[tauri::command]
pub async fn company_portal_fetch_feature_flags(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL.fetch_feature_flags(&cfg).await
}

#[tauri::command]
pub async fn company_portal_billing_portal_url(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<String, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL.post_billing_portal_url(&cfg).await
}

#[tauri::command]
pub async fn company_portal_attach_payment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    provider_token: String,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL
        .attach_payment_method(&cfg, &provider_token)
        .await
}

/// Für `check_for_updates` — liefert JSON wie `UpdateInfo` oder Fehler.
#[tauri::command]
pub async fn company_portal_fetch_update_manifest(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    current_version: String,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    COMPANY_PORTAL
        .fetch_update_manifest(&cfg, &current_version)
        .await
}

/// Verbindungsprobe (ohne sensible Daten im Fehlerfall außer HTTP-Status).
#[tauri::command]
pub async fn company_portal_ping(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    match crate::infrastructure::company_portal::config::effective_base_url(&cfg) {
        None => Ok(json!({ "ok": false, "reason": "no_base_url" })),
        Some(base) => {
            let c = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let url = format!("{base}/v1/health");
            let res = c.get(&url).send().await;
            match res {
                Ok(r) if r.status().is_success() => {
                    let http = r.status().as_u16();
                    let body: Value = r.json().await.unwrap_or_else(|_| json!({}));
                    let mut out = json!({ "ok": true, "http": http });
                    if let Some(demo) = body.get("_demo") {
                        out["_demo"] = demo.clone();
                    }
                    Ok(out)
                }
                Ok(r) => Ok(json!({ "ok": false, "http": r.status().as_u16() })),
                Err(e) => Ok(json!({ "ok": false, "error": e.to_string() })),
            }
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSubscriptionStatus {
    pub registered: bool,
    pub practice_slug: Option<String>,
    pub setup_complete: bool,
    pub needs_admin_account: bool,
    pub personal_count: i64,
    /// Licensed owner device still needs full practice initialization.
    pub needs_practice_setup: bool,
    /// Joined member device still needs account choice (create or sign in).
    pub needs_member_account: bool,
}

const ONBOARDING_SETUP_KV_KEY: &str = "onboarding.setup_complete.v1";

async fn onboarding_setup_complete(pool: &SqlitePool) -> Result<bool, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
            .bind(ONBOARDING_SETUP_KV_KEY)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(row.is_some())
}

async fn mark_onboarding_setup_complete(pool: &SqlitePool) -> Result<(), AppError> {
    app_kv_repo::set(pool, ONBOARDING_SETUP_KV_KEY, "1").await
}

async fn count_personal_rows(pool: &SqlitePool) -> Result<i64, AppError> {
    let (n,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM personal")
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(n)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSubscriptionRequest {
    pub display_name: String,
    pub practice_slug: String,
    pub admin_name: String,
    pub admin_email: String,
    #[serde(default)]
    pub admin_password: Option<String>,
    #[serde(default)]
    pub street: Option<String>,
    #[serde(default)]
    pub postal_code: Option<String>,
    #[serde(default)]
    pub city: Option<String>,
    pub plan: String,
    #[serde(default)]
    pub portal_base_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSubscriptionResult {
    pub practice_slug: String,
    pub plan_name: String,
    pub license_token: Option<String>,
}

fn normalize_slug(raw: &str) -> String {
    raw.trim()
        .to_lowercase()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c
            } else if c.is_whitespace() || c == '_' {
                '-'
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn plan_from_edition(edition: &str) -> &'static str {
    match edition.trim().to_uppercase().as_str() {
        "BASIC" => "BASIC",
        "ENTERPRISE" => "ENTERPRISE",
        _ => "PRO",
    }
}

fn looks_like_short_license_code(key: &str) -> bool {
    let k = key.trim();
    !k.starts_with("v2.")
        && !k.starts_with('{')
        && k.len() >= 3
        && k.len() <= 31
        && !is_keygen_fingerprint(k)
}

fn is_keygen_fingerprint(code: &str) -> bool {
    let k = code.trim();
    k.len() >= 32
        && k.len() <= 56
        && k.bytes().all(|c| {
            matches!(c, b'A'..=b'Z' | b'2'..=b'7')
        })
}

fn customer_id_from_code(code: &str) -> String {
    let k = code.trim();
    if is_keygen_fingerprint(k) {
        normalize_slug(&k[..k.len().min(24)])
    } else {
        normalize_slug(k)
    }
}

/// Resolve pasted input to a vendor license token (keygen fingerprint / dev code → minted v2).
pub async fn resolve_onboarding_license_key(
    pool: &SqlitePool,
    license_key: &str,
) -> Result<String, AppError> {
    let device_id = license_repo::ensure_device_id(pool).await?;
    let trimmed = license_key.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Lizenzcode fehlt.".into()));
    }

    let verified = medoc_core::infrastructure::license::verify(trimmed, &device_id);
    if verified.valid {
        return Ok(trimmed.to_string());
    }

    let dev_seed = std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1");
    if dev_seed && (looks_like_short_license_code(trimmed) || is_keygen_fingerprint(trimmed)) {
        let customer_id = customer_id_from_code(trimmed);
        let plan = plan_from_edition(trimmed);
        return mint_dev_v2_license_envelope(&device_id, &customer_id, plan);
    }

    Ok(trimmed.to_string())
}

async fn persist_portal_config(
    pool: &SqlitePool,
    base: String,
    practice_slug: String,
    api_key: String,
) -> Result<(), AppError> {
    let cfg = CompanyPortalConfig {
        base_url: base,
        practice_slug,
        api_key,
    };
    let raw = serde_json::to_string(&cfg).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(pool, COMPANY_PORTAL_KV_KEY, &raw).await
}

async fn register_portal_subscription(
    pool: &SqlitePool,
    display_name: &str,
    slug: &str,
    admin_name: &str,
    admin_email: &str,
    plan: &str,
    portal_base_url: Option<&str>,
) -> Result<(), AppError> {
    let base = portal_base_url
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(default_onboarding_base_url);
    let body = json!({
        "display_name": display_name,
        "slug": slug,
        "admin_name": admin_name,
        "admin_email": admin_email,
        "plan": plan,
    });
    let dev_seed = std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1");
    match register_practice_onboarding(&base, body).await {
        Ok(resp) => {
            let practice_slug = resp
                .get("practice_slug")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("Registrierung ohne practice_slug.".into()))?
                .to_string();
            let api_key = resp
                .get("api_key")
                .and_then(|v| v.as_str())
                .ok_or_else(|| AppError::Internal("Registrierung ohne api_key.".into()))?
                .to_string();
            persist_portal_config(pool, base, practice_slug, api_key).await
        }
        Err(e) if dev_seed => {
            tracing::warn!(
                target: "medoc::onboarding",
                event = "PORTAL_REGISTER_DEV_FALLBACK",
                error = %e
            );
            let api_key = format!("dev-local-{}", uuid::Uuid::new_v4());
            persist_portal_config(pool, base, slug.to_string(), api_key).await
        }
        Err(e) => Err(e),
    }
}

async fn create_onboarding_staff_account(
    pool: &SqlitePool,
    name: &str,
    email: &str,
    password: &str,
    rolle: Rolle,
) -> Result<(), AppError> {
    use medoc_core::domain::entities::personal::CreatePersonal;

    if medoc_core::infrastructure::database::personal_repo::find_by_email(pool, email)
        .await?
        .is_some()
    {
        return Err(AppError::validation_code("error.personal.email_taken"));
    }
    crate::infrastructure::crypto::validate_password_policy(password)?;
    let hash = crate::infrastructure::crypto::hash_password(password)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let fachrichtung = if matches!(rolle, Rolle::Arzt) {
        Some("Zahnmedizin".into())
    } else {
        None
    };
    let data = CreatePersonal {
        name: name.to_string(),
        email: email.to_string(),
        passwort: password.to_string(),
        rolle,
        taetigkeitsbereich: None,
        fachrichtung,
        telefon: None,
    };
    medoc_core::infrastructure::database::personal_repo::create_with_quota(pool, &data, &hash)
        .await?;
    Ok(())
}

async fn create_onboarding_admin_account(
    pool: &SqlitePool,
    admin_name: &str,
    admin_email: &str,
    admin_password: &str,
) -> Result<(), AppError> {
    create_onboarding_staff_account(
        pool,
        admin_name,
        admin_email,
        admin_password,
        Rolle::Arzt,
    )
    .await
}

/// After license activation: derive portal subscription from license metadata (best-effort).
pub async fn auto_register_subscription_from_license(pool: &SqlitePool) -> Result<(), AppError> {
    if is_portal_configured(&load_company_portal_config(pool).await) {
        return Ok(());
    }
    let lic = license_repo::current_status(pool).await?;
    if !lic.valid {
        return Ok(());
    }

    let customer_id = lic
        .license_v2
        .as_ref()
        .map(|l| l.customer_id.clone())
        .or_else(|| lic.license.as_ref().map(|l| l.customer_id.clone()))
        .unwrap_or_else(|| "medoc-praxis".into());
    let edition = lic
        .license_v2
        .as_ref()
        .map(|l| l.edition.clone())
        .or_else(|| lic.license.as_ref().map(|l| l.edition.clone()))
        .unwrap_or_else(|| "PRO".into());

    let slug = normalize_slug(&customer_id);
    if slug.len() < 3 {
        return Ok(());
    }
    let display_name = if customer_id.contains('-') || customer_id.contains('_') {
        customer_id.replace(['-', '_'], " ")
    } else {
        customer_id.clone()
    };
    let plan = plan_from_edition(&edition);
    let admin_email = format!("admin@{slug}.medoc.local");

    register_portal_subscription(
        pool,
        &display_name,
        &slug,
        "Praxis Administrator",
        &admin_email,
        plan,
        None,
    )
    .await
}

/// Pre-login onboarding: whether Hersteller-Portal credentials were stored.
#[tauri::command]
pub async fn onboarding_subscription_status(
    pool: State<'_, SqlitePool>,
) -> Result<OnboardingSubscriptionStatus, AppError> {
    let cfg = load_company_portal_config(&pool).await;
    let personal_count = count_personal_rows(&pool).await?;
    let setup_complete = onboarding_setup_complete(&pool).await?;
    let vs = verbund_status(&pool).await?;
    let needs_practice_setup = vs.licensed && vs.is_owner && !setup_complete;
    let needs_member_account = vs.provisioned && !vs.is_owner && !setup_complete;
    Ok(OnboardingSubscriptionStatus {
        registered: is_portal_configured(&cfg),
        practice_slug: if cfg.practice_slug.trim().is_empty() {
            None
        } else {
            Some(cfg.practice_slug.trim().to_string())
        },
        setup_complete,
        needs_admin_account: personal_count == 0,
        personal_count,
        needs_practice_setup,
        needs_member_account,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingMemberAccountRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    #[serde(default = "default_member_rolle")]
    pub rolle: String,
}

fn default_member_rolle() -> String {
    "REZEPTION".into()
}

fn parse_member_rolle(raw: &str) -> Result<Rolle, AppError> {
    match raw.trim().to_uppercase().as_str() {
        "ARZT" => Ok(Rolle::Arzt),
        "REZEPTION" => Ok(Rolle::Rezeption),
        _ => Err(AppError::Validation(
            "Rolle muss ARZT oder REZEPTION sein.".into(),
        )),
    }
}

/// Pre-login: member device — create a new staff account on an existing practice network.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, request))]
pub async fn register_onboarding_member_account(
    pool: State<'_, SqlitePool>,
    request: OnboardingMemberAccountRequest,
) -> Result<(), AppError> {
    let vs = verbund_status(&pool).await?;
    if !vs.provisioned || vs.is_owner {
        return Err(AppError::Validation(
            "Neues Konto nur nach Beitritt zu bestehender Praxis.".into(),
        ));
    }
    let name = request.name.trim();
    let email = request.email.trim();
    let password = request.password.trim();
    if name.len() < 2 {
        return Err(AppError::Validation("Name zu kurz.".into()));
    }
    if !email.contains('@') {
        return Err(AppError::Validation("E-Mail ungültig.".into()));
    }
    if password.len() < 8 {
        return Err(AppError::Validation(
            "Passwort erforderlich (min. 8 Zeichen).".into(),
        ));
    }
    let rolle = parse_member_rolle(&request.rolle)?;
    create_onboarding_staff_account(&pool, name, email, password, rolle).await?;
    mark_onboarding_setup_complete(&pool).await
}

/// Pre-login: member chose to sign in with an existing account (skip account creation).
#[tauri::command]
pub async fn onboarding_use_existing_account(pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    let vs = verbund_status(&pool).await?;
    if !vs.provisioned || vs.is_owner {
        return Err(AppError::Validation(
            "Nur Mitgliedergeräte nach Verbund-Beitritt.".into(),
        ));
    }
    mark_onboarding_setup_complete(&pool).await
}

/// Pre-login onboarding: register practice subscription at vendor portal and persist config.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, request))]
pub async fn register_onboarding_subscription(
    pool: State<'_, SqlitePool>,
    request: OnboardingSubscriptionRequest,
) -> Result<OnboardingSubscriptionResult, AppError> {
    let display_name = request.display_name.trim();
    let slug = normalize_slug(&request.practice_slug);
    let admin_name = request.admin_name.trim();
    let admin_email = request.admin_email.trim();
    let plan = request.plan.trim().to_uppercase();

    if display_name.len() < 2 {
        return Err(AppError::Validation("Praxisname zu kurz.".into()));
    }
    if slug.len() < 3 {
        return Err(AppError::Validation("Praxis-Slug zu kurz.".into()));
    }
    if admin_name.len() < 2 {
        return Err(AppError::Validation("Administrator-Name zu kurz.".into()));
    }
    if !admin_email.contains('@') {
        return Err(AppError::Validation("E-Mail ungültig.".into()));
    }
    if !matches!(plan.as_str(), "BASIC" | "PRO" | "ENTERPRISE") {
        return Err(AppError::Validation(
            "Plan muss BASIC, PRO oder ENTERPRISE sein.".into(),
        ));
    }

    let vs = verbund_status(&pool).await?;
    if !vs.licensed || !vs.is_owner {
        return Err(AppError::Validation(
            "Praxis-Einrichtung nur auf dem lizenzierten Hauptgerät.".into(),
        ));
    }

    let personal_count = count_personal_rows(&pool).await?;
    let needs_admin = personal_count == 0;
    let admin_password = request
        .admin_password
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    if needs_admin {
        if admin_password.len() < 8 {
            return Err(AppError::Validation(
                "Administrator-Passwort erforderlich (min. 8 Zeichen).".into(),
            ));
        }
    }

    register_portal_subscription(
        &pool,
        display_name,
        &slug,
        admin_name,
        admin_email,
        &plan,
        request.portal_base_url.as_deref(),
    )
    .await?;

    if needs_admin {
        create_onboarding_admin_account(&pool, admin_name, admin_email, admin_password).await?;
    }

    mark_onboarding_setup_complete(&pool).await?;

    let cfg = load_company_portal_config(&pool).await;
    let practice_slug = cfg.practice_slug.clone();
    let plan_name = match plan.as_str() {
        "BASIC" => "MeDoc Praxis Basis",
        "ENTERPRISE" => "MeDoc Praxis Enterprise",
        _ => "MeDoc Praxis Pro",
    }
    .to_string();

    Ok(OnboardingSubscriptionResult {
        practice_slug,
        plan_name,
        license_token: None,
    })
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_company_portal_commands {
    () => {
        $crate::commands::company_portal_commands::get_company_portal_config,
        $crate::commands::company_portal_commands::set_company_portal_config,
        $crate::commands::company_portal_commands::company_portal_fetch_summary,
        $crate::commands::company_portal_commands::company_portal_fetch_integrations,
        $crate::commands::company_portal_commands::company_portal_fetch_feature_flags,
        $crate::commands::company_portal_commands::company_portal_billing_portal_url,
        $crate::commands::company_portal_commands::company_portal_attach_payment,
        $crate::commands::company_portal_commands::company_portal_fetch_update_manifest,
        $crate::commands::company_portal_commands::company_portal_ping,
        $crate::commands::company_portal_commands::onboarding_subscription_status,
        $crate::commands::company_portal_commands::register_onboarding_subscription,
        $crate::commands::company_portal_commands::register_onboarding_member_account,
        $crate::commands::company_portal_commands::onboarding_use_existing_account,
    };
}
