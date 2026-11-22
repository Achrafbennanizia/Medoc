//! Main link: when someone signs in on a replica, they are also signed in on the main device
//! (same credentials, pinned TLS). The main device's token is kept in memory only, used for
//! forwarded main-only operations, and dropped at sign-out. The main device checks that
//! person's own privileges, so a replica never gains rights of its own.

use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use medoc_core::error::AppError;

const TIMEOUT: Duration = Duration::from_secs(15);
const API: &str = "/api/v1";

/// Error keys (translated in the locale files under `error.device.*`).
pub const ERR_NO_LINK: &str = "error.device.main_link_missing";
pub const ERR_UNREACHABLE: &str = "error.device.main_unreachable";

#[derive(Clone)]
struct Link {
    base_url: String,
    pin: String,
    token: String,
    user_id: String,
}

fn store() -> &'static Mutex<Option<Link>> {
    static LINK: OnceLock<Mutex<Option<Link>>> = OnceLock::new();
    LINK.get_or_init(|| Mutex::new(None))
}

fn current() -> Option<Link> {
    store().lock().ok().and_then(|g| g.clone())
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkStatus {
    pub linked: bool,
    pub user_id: Option<String>,
}

pub fn link_status() -> LinkStatus {
    let link = current();
    LinkStatus {
        linked: link.is_some(),
        user_id: link.map(|l| l.user_id),
    }
}

pub fn clear_link() {
    if let Ok(mut g) = store().lock() {
        *g = None;
    }
}

#[derive(Deserialize)]
struct LoginUser {
    user_id: String,
}
#[derive(Deserialize)]
struct LoginReply {
    access_token: String,
    user: LoginUser,
}

/// Best effort, after a successful local sign-in on a non-main device. Returns whether a link
/// was made; failures are logged, never block the local sign-in (offline work continues).
pub async fn establish_link(pool: &SqlitePool, email: &str, password: &str) -> bool {
    clear_link();
    if super::is_main_device(pool).await {
        return false;
    }
    let Ok(d) = medoc_sync::repo::load_deployment(pool).await else {
        return false;
    };
    let base_url = d.master_base_url.trim().trim_end_matches('/').to_string();
    if base_url.is_empty() {
        return false;
    }
    let result = async {
        let client = medoc_sync::tls_pin::pinned_http_client(&d.master_cert_sha256, TIMEOUT)?;
        let res = client
            .post(format!("{base_url}{API}/auth/login"))
            .json(&serde_json::json!({ "email": email, "password": password }))
            .send()
            .await
            .map_err(|_| AppError::validation_code(ERR_UNREACHABLE))?;
        if !res.status().is_success() {
            return Err(AppError::Unauthorized);
        }
        res.json::<LoginReply>()
            .await
            .map_err(|e| AppError::Internal(format!("main link login reply: {e}")))
    }
    .await;
    match result {
        Ok(reply) => {
            if let Ok(mut g) = store().lock() {
                *g = Some(Link {
                    base_url,
                    pin: d.master_cert_sha256,
                    token: reply.access_token,
                    user_id: reply.user.user_id,
                });
            }
            tracing::info!(target: "medoc::security", event = "MAIN_LINK_ESTABLISHED");
            true
        }
        Err(e) => {
            tracing::warn!(target: "medoc::network", event = "MAIN_LINK_FAILED", error = %e);
            false
        }
    }
}

/// Runs a main-only operation on the main device as the signed-in person.
/// `expected_user`: the local session's user, so a link left from someone else is never used.
pub async fn forward<T: DeserializeOwned>(
    expected_user: &str,
    method: Method,
    path: &str,
    body: Option<serde_json::Value>,
) -> Result<T, AppError> {
    let link = current()
        .filter(|l| l.user_id == expected_user)
        .ok_or_else(|| AppError::validation_code(ERR_NO_LINK))?;
    let client = medoc_sync::tls_pin::pinned_http_client(&link.pin, TIMEOUT)?;
    let mut req = client
        .request(method, format!("{}{API}{path}", link.base_url))
        .bearer_auth(&link.token);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req
        .send()
        .await
        .map_err(|_| AppError::validation_code(ERR_UNREACHABLE))?;
    let status = res.status();
    if status.is_success() {
        return res
            .json::<T>()
            .await
            .map_err(|e| AppError::Internal(format!("main device reply: {e}")));
    }
    // The main device's own error token (same wire format as local IPC errors).
    let message = res
        .json::<serde_json::Value>()
        .await
        .ok()
        .and_then(|v| v.get("error").and_then(|e| e.as_str()).map(str::to_string))
        .unwrap_or_default();
    Err(match status.as_u16() {
        401 => {
            clear_link();
            AppError::validation_code(ERR_NO_LINK)
        }
        403 => AppError::Forbidden,
        _ if message.starts_with("error.") => AppError::validation_code(message),
        _ if !message.is_empty() => AppError::Validation(message),
        _ => AppError::validation_code(ERR_UNREACHABLE),
    })
}
