//! Vendor portal configuration (`ops.system` only — contains API keys).
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
use medoc_core::domain::enums::Role;
use medoc_sync::cluster::services::{sync_staff_from_stored_admin_endpoint, sync_staff_from_stored_admin_endpoint_required, cluster_status};

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

/// For `check_for_updates` — returns JSON shaped like `UpdateInfo`, or an error.
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

/// Connectivity probe (no sensitive data in the failure path except HTTP status).
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
    /// Login emails when `needs_admin_account` is false (reuse existing staff).
    pub existing_account_emails: Vec<String>,
    pub staff_count: i64,
    /// Licensed owner device still needs full practice initialization.
    pub needs_practice_setup: bool,
    /// Joined member device still needs account choice (create or sign in).
    pub needs_member_account: bool,
    /// Licensed owner may skip practice form and sign in with an existing account.
    pub can_skip_to_login: bool,
    /// All staff emails available for sign-in (includes demo seed in dev).
    pub login_ready_emails: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSkipResult {
    pub login_emails: Vec<String>,
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

async fn compute_needs_practice_setup(
    pool: &SqlitePool,
    vs: &medoc_sync::cluster::services::license_service::ClusterStatus,
) -> Result<bool, AppError> {
    if !vs.licensed || !vs.is_owner {
        return Ok(false);
    }
    Ok(!onboarding_setup_complete(pool).await?)
}

/// Owner license activation before portal registration — drop stale setup flag
/// (e.g. prior member "use existing account" or interrupted onboarding).
pub async fn reset_onboarding_after_owner_license_activation(
    pool: &SqlitePool,
) -> Result<(), AppError> {
    let vs = cluster_status(pool).await?;
    if !vs.licensed || !vs.is_owner {
        return Ok(());
    }
    let cfg = load_company_portal_config(pool).await;
    if !is_portal_configured(&cfg) {
        app_kv_repo::delete(pool, ONBOARDING_SETUP_KV_KEY).await?;
    }
    Ok(())
}

async fn count_staff_rows(pool: &SqlitePool) -> Result<i64, AppError> {
    let (n,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM staff")
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(n)
}

/// Demo seed rows (`seed-*`) must not suppress the admin password form after license reset.
async fn count_non_seed_staff_rows(pool: &SqlitePool) -> Result<i64, AppError> {
    let (n,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM staff WHERE id NOT LIKE 'seed-%'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n)
}

async fn list_existing_login_emails(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT email FROM staff WHERE id NOT LIKE 'seed-%' ORDER BY email COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(|(e,)| e).collect())
}

async fn list_login_ready_emails(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT email FROM staff ORDER BY email COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(|(e,)| e).collect())
}

async fn find_seed_physician_id(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT id FROM staff WHERE id LIKE 'seed-%' AND role = 'PHYSICIAN' LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row.map(|(id,)| id))
}

async fn needs_onboarding_admin_account(pool: &SqlitePool) -> Result<bool, AppError> {
    Ok(count_non_seed_staff_rows(pool).await? == 0)
}

async fn ensure_portal_config_for_onboarding_skip(pool: &SqlitePool) -> Result<(), AppError> {
    let cfg = load_company_portal_config(pool).await;
    if is_portal_configured(&cfg) {
        return Ok(());
    }
    persist_local_onboarding_portal_stub(pool, "practice").await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingSubscriptionRequest {
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
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
    pub admin_email: String,
    pub admin_account_created: bool,
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
        return Err(AppError::Validation("License code missing.".into()));
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

/// Licensed USB / offline practice: no vendor portal on this Mac.
async fn persist_local_onboarding_portal_stub(
    pool: &SqlitePool,
    practice_slug: &str,
) -> Result<(), AppError> {
    let mut slug = normalize_slug(practice_slug);
    if slug.len() < 3 {
        slug = "practice".into();
    }
    let api_key = format!("local-{}", uuid::Uuid::new_v4());
    persist_portal_config(pool, default_onboarding_base_url(), slug, api_key).await
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
    match register_practice_onboarding(&base, body).await {
        Ok(resp) => {
            let practice_slug = resp
                .get("practice_slug")
                .and_then(|version| version.as_str())
                .ok_or_else(|| AppError::Internal("Registration missing practice_slug.".into()))?
                .to_string();
            let api_key = resp
                .get("api_key")
                .and_then(|version| version.as_str())
                .ok_or_else(|| AppError::Internal("Registration missing api_key.".into()))?
                .to_string();
            persist_portal_config(pool, base, practice_slug, api_key).await
        }
        Err(e) => {
            tracing::warn!(
                target: "medoc::onboarding",
                event = "PORTAL_REGISTER_LOCAL_FALLBACK",
                error = %e
            );
            persist_local_onboarding_portal_stub(pool, slug).await
        }
    }
}

async fn create_onboarding_staff_account(
    pool: &SqlitePool,
    name: &str,
    email: &str,
    password: &str,
    role: Role,
) -> Result<(), AppError> {
    use medoc_core::domain::entities::staff::CreateStaff;

    if medoc_core::infrastructure::database::staff_repo::find_by_email(pool, email)
        .await?
        .is_some()
    {
        return Err(AppError::validation_code("error.staff.email_taken"));
    }
    crate::infrastructure::crypto::validate_password_policy(password)?;
    let hash = crate::infrastructure::crypto::hash_password(password)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let specialty = if matches!(role, Role::Physician) {
        Some("Dentistry".into())
    } else {
        None
    };
    let data = CreateStaff {
        name: name.to_string(),
        email: email.to_string(),
        password: password.to_string(),
        role,
        activity_area: None,
        specialty,
        phone: None,
    };
    medoc_core::infrastructure::database::staff_repo::create_with_quota(pool, &data, &hash)
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
        Role::Physician,
    )
    .await
}

async fn ensure_dev_demo_reception_account(pool: &SqlitePool) -> Result<(), AppError> {
    if std::env::var("MEDOC_DEV_SEED").ok().as_deref() != Some("1") {
        return Ok(());
    }
    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'RECEPTION'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if count.0 > 0 {
        return Ok(());
    }
    let hash = crate::infrastructure::crypto::hash_password("password123")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    sqlx::query(
        "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, available)
         VALUES ('seed-rez-001', 'Aya M.', 'aya@practice.de', ?1, 'RECEPTION', 1)",
    )
    .bind(&hash)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Create admin or reuse the demo `seed-physician-001` slot when staff quota is already taken.
async fn assign_onboarding_admin_account(
    pool: &SqlitePool,
    admin_name: &str,
    admin_email: &str,
    admin_password: &str,
) -> Result<(), AppError> {
    if let Some(existing) =
        medoc_core::infrastructure::database::staff_repo::find_by_email(pool, admin_email).await?
    {
        if !existing.id.starts_with("seed-") {
            return Err(AppError::validation_code("error.staff.email_taken"));
        }
    }

    crate::infrastructure::crypto::validate_password_policy(admin_password)?;
    let hash = crate::infrastructure::crypto::hash_password(admin_password)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    if let Some(seed_id) = find_seed_physician_id(pool).await? {
        use medoc_core::domain::entities::staff::UpdateStaff;
        medoc_core::infrastructure::database::staff_repo::update(
            pool,
            &seed_id,
            &UpdateStaff {
                name: Some(admin_name.to_string()),
                email: Some(admin_email.to_string()),
                role: None,
                activity_area: None,
                specialty: None,
                phone: None,
                available: None,
            },
        )
        .await?;
        medoc_core::infrastructure::database::staff_repo::update_password_hash(
            pool, &seed_id, &hash,
        )
        .await?;
        ensure_dev_demo_reception_account(pool).await?;
        return Ok(());
    }

    create_onboarding_admin_account(pool, admin_name, admin_email, admin_password).await?;
    ensure_dev_demo_reception_account(pool).await
}

/// Pre-login onboarding: whether vendor-portal credentials were stored.
#[tauri::command]
pub async fn onboarding_subscription_status(
    pool: State<'_, SqlitePool>,
) -> Result<OnboardingSubscriptionStatus, AppError> {
    if std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1") {
        let _ = ensure_dev_demo_reception_account(&pool).await;
    }
    let cfg = load_company_portal_config(&pool).await;
    let staff_count = count_staff_rows(&pool).await?;
    let needs_admin_account = needs_onboarding_admin_account(&pool).await?;
    let login_ready_emails = list_login_ready_emails(&pool).await?;
    let existing_account_emails = if needs_admin_account {
        vec![]
    } else {
        list_existing_login_emails(&pool).await?
    };
    let vs = cluster_status(&pool).await?;
    let needs_practice_setup = compute_needs_practice_setup(&pool, &vs).await?;
    let needs_member_account = vs.provisioned && !vs.is_owner
        && !onboarding_setup_complete(&pool).await?;
    let can_skip_to_login =
        needs_practice_setup && vs.licensed && vs.is_owner && staff_count > 0;
    Ok(OnboardingSubscriptionStatus {
        registered: is_portal_configured(&cfg),
        practice_slug: if cfg.practice_slug.trim().is_empty() {
            None
        } else {
            Some(cfg.practice_slug.trim().to_string())
        },
        setup_complete: onboarding_setup_complete(&pool).await?,
        needs_admin_account,
        existing_account_emails,
        staff_count,
        needs_practice_setup,
        needs_member_account,
        can_skip_to_login,
        login_ready_emails,
    })
}

/// Pre-login: skip practice subscription form and sign in with an existing account.
#[tauri::command]
pub async fn onboarding_skip_practice_setup(
    pool: State<'_, SqlitePool>,
) -> Result<OnboardingSkipResult, AppError> {
    let vs = cluster_status(&pool).await?;
    if !vs.licensed || !vs.is_owner {
        return Err(AppError::Validation(
            "Skip is only allowed on the licensed primary device.".into(),
        ));
    }
    if onboarding_setup_complete(&pool).await? {
        let emails = list_login_ready_emails(&pool).await?;
        return Ok(OnboardingSkipResult { login_emails: emails });
    }
    let emails = list_login_ready_emails(&pool).await?;
    if emails.is_empty() {
        return Err(AppError::Validation(
            "No user account exists — please create an administrator.".into(),
        ));
    }
    ensure_portal_config_for_onboarding_skip(&pool).await?;
    mark_onboarding_setup_complete(&pool).await?;
    Ok(OnboardingSkipResult {
        login_emails: emails,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OnboardingMemberAccountRequest {
    pub name: String,
    pub email: String,
    pub password: String,
    #[serde(default = "default_member_role")]
    pub role: String,
}

fn default_member_role() -> String {
    "RECEPTION".into()
}

fn parse_member_role(raw: &str) -> Result<Role, AppError> {
    match raw.trim().to_uppercase().as_str() {
        "PHYSICIAN" => Ok(Role::Physician),
        "RECEPTION" => Ok(Role::Reception),
        _ => Err(AppError::Validation(
            "Role must be PHYSICIAN or RECEPTION.".into(),
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
    let vs = cluster_status(&pool).await?;
    if !vs.provisioned || vs.is_owner {
        return Err(AppError::Validation(
            "New account only after joining an existing practice.".into(),
        ));
    }
    let name = request.name.trim();
    let email = request.email.trim();
    let password = request.password.trim();
    if name.len() < 2 {
        return Err(AppError::Validation("Name too short.".into()));
    }
    if !email.contains('@') {
        return Err(AppError::Validation("Invalid email.".into()));
    }
    if password.len() < 8 {
        return Err(AppError::Validation(
            "Password required (min. 8 characters).".into(),
        ));
    }
    let role = parse_member_role(&request.role)?;
    create_onboarding_staff_account(&pool, name, email, password, role).await?;
    mark_onboarding_setup_complete(&pool).await
}

/// Pre-login: member chose to sign in with an existing account (skip account creation).
#[tauri::command]
pub async fn onboarding_use_existing_account(pool: State<'_, SqlitePool>) -> Result<(), AppError> {
    let vs = cluster_status(&pool).await?;
    if !vs.provisioned || vs.is_owner {
        return Err(AppError::Validation(
            "Member devices only after joining the practice network.".into(),
        ));
    }
    sync_staff_from_stored_admin_endpoint_required(&pool).await?;
    mark_onboarding_setup_complete(&pool).await
}

fn resolve_onboarding_practice_defaults(
    display_name: &str,
    practice_slug: &str,
    admin_name: &str,
    admin_email: &str,
) -> (String, String) {
    let name = if display_name.trim().len() >= 2 {
        display_name.trim().to_string()
    } else if admin_name.trim().len() >= 2 {
        admin_name.trim().to_string()
    } else {
        "MeDoc Practice".to_string()
    };
    let mut slug = normalize_slug(practice_slug);
    if slug.len() < 3 {
        slug = normalize_slug(&name);
    }
    if slug.len() < 3 {
        slug = normalize_slug(admin_email.split('@').next().unwrap_or("practice"));
    }
    if slug.len() < 3 {
        slug = "practice".into();
    }
    (name, slug)
}

/// Pre-login onboarding: register practice subscription at vendor portal and persist config.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, request))]
pub async fn register_onboarding_subscription(
    pool: State<'_, SqlitePool>,
    request: OnboardingSubscriptionRequest,
) -> Result<OnboardingSubscriptionResult, AppError> {
    let admin_name = request.admin_name.trim();
    let admin_email = request.admin_email.trim();
    let plan = request.plan.trim().to_uppercase();
    let (display_name, slug) = resolve_onboarding_practice_defaults(
        &request.display_name,
        &request.practice_slug,
        admin_name,
        admin_email,
    );

    if admin_name.len() < 2 {
        return Err(AppError::Validation("Administrator name too short.".into()));
    }
    if !admin_email.contains('@') {
        return Err(AppError::Validation("Invalid email.".into()));
    }
    if !matches!(plan.as_str(), "BASIC" | "PRO" | "ENTERPRISE") {
        return Err(AppError::Validation(
            "Plan must be BASIC, PRO, or ENTERPRISE.".into(),
        ));
    }

    let vs = cluster_status(&pool).await?;
    if !vs.licensed || !vs.is_owner {
        return Err(AppError::Validation(
            "Practice setup only on the licensed primary device.".into(),
        ));
    }

    let needs_admin = needs_onboarding_admin_account(&pool).await?;
    let admin_password = request
        .admin_password
        .as_deref()
        .map(str::trim)
        .unwrap_or("");
    if needs_admin {
        if admin_password.len() < 8 {
            return Err(AppError::Validation(
                "Administrator password required (min. 8 characters).".into(),
            ));
        }
    }

    register_portal_subscription(
        &pool,
        &display_name,
        &slug,
        admin_name,
        admin_email,
        &plan,
        request.portal_base_url.as_deref(),
    )
    .await?;

    if needs_admin {
        assign_onboarding_admin_account(&pool, admin_name, admin_email, admin_password).await?;
    }

    mark_onboarding_setup_complete(&pool).await?;

    let cfg = load_company_portal_config(&pool).await;
    let practice_slug = cfg.practice_slug.clone();
    let plan_name = match plan.as_str() {
        "BASIC" => "MeDoc Practice Basis",
        "ENTERPRISE" => "MeDoc Practice Enterprise",
        _ => "MeDoc Practice Pro",
    }
    .to_string();

    Ok(OnboardingSubscriptionResult {
        practice_slug,
        plan_name,
        license_token: None,
        admin_email: admin_email.to_string(),
        admin_account_created: needs_admin,
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
        $crate::commands::company_portal_commands::onboarding_skip_practice_setup,
    };
}
