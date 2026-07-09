//! GitHub Releases update manifest (private repo via PAT).
//!
//! CI publishes `latest.json` on each tagged release. The app reads the same
//! artifact using an optional bearer token (`MEDOC_UPDATER_GITHUB_TOKEN` at
//! build time, or `updates.github_token` in app_kv).

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use medoc_core::infrastructure::update;
use serde::Deserialize;
use sqlx::SqlitePool;

pub const GITHUB_TOKEN_KV_KEY: &str = "updates.github_token";

#[derive(Debug, Deserialize)]
struct LatestJson {
    version: String,
    #[serde(default)]
    notes: String,
}

#[derive(Debug)]
pub struct GithubUpdateCheck {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: String,
}

pub fn configured_repo() -> Option<&'static str> {
    option_env!("MEDOC_UPDATER_GITHUB_REPO").filter(|s| !s.is_empty())
}

fn compile_time_token() -> Option<&'static str> {
    option_env!("MEDOC_UPDATER_GITHUB_TOKEN").filter(|s| !s.is_empty())
}

pub async fn resolve_github_token(pool: &SqlitePool) -> Option<String> {
    if let Some(t) = compile_time_token() {
        return Some(t.to_string());
    }
    app_kv_repo::get(pool, GITHUB_TOKEN_KV_KEY)
        .await
        .ok()
        .flatten()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn github_client(token: Option<&str>) -> Result<reqwest::Client, AppError> {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::USER_AGENT,
        reqwest::header::HeaderValue::from_static("MeDoc-Updater/1.0"),
    );
    if let Some(t) = token {
        let value = format!("Bearer {t}");
        headers.insert(
            reqwest::header::AUTHORIZATION,
            reqwest::header::HeaderValue::from_str(&value)
                .map_err(|e| AppError::Internal(e.to_string()))?,
        );
    }
    reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))
}

async fn fetch_bytes(
    url: &str,
    client: &reqwest::Client,
    octet_stream: bool,
) -> Result<Vec<u8>, AppError> {
    let mut req = client.get(url);
    if octet_stream {
        req = req.header(reqwest::header::ACCEPT, "application/octet-stream");
    } else {
        req = req.header(reqwest::header::ACCEPT, "application/vnd.github+json");
    }
    let res = req
        .send()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !res.status().is_success() {
        return Err(AppError::Internal(format!(
            "GitHub update fetch failed (HTTP {})",
            res.status()
        )));
    }
    let bytes = res
        .bytes()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(bytes.to_vec())
}

async fn fetch_latest_json(repo: &str, token: Option<&str>) -> Result<LatestJson, AppError> {
    let client = github_client(token)?;
    let direct = format!("https://github.com/{repo}/releases/latest/download/latest.json");
    match fetch_bytes(&direct, &client, true).await {
        Ok(bytes) => {
            return serde_json::from_slice(&bytes)
                .map_err(|e| AppError::Internal(format!("Invalid latest.json: {e}")));
        }
        Err(_) if token.is_some() => {}
        Err(e) => return Err(e),
    }

    // Private repos: resolve latest.json via GitHub REST API asset URLs.
    let api_url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let meta_bytes = fetch_bytes(&api_url, &client, false).await?;
    let meta: serde_json::Value = serde_json::from_slice(&meta_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid release metadata: {e}")))?;
    let assets = meta
        .get("assets")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::Internal("Release has no assets".into()))?;
    let asset = assets
        .iter()
        .find(|a| a.get("name").and_then(|n| n.as_str()) == Some("latest.json"))
        .ok_or_else(|| AppError::Internal("Release has no latest.json asset".into()))?;
    let asset_url = asset
        .get("url")
        .and_then(|u| u.as_str())
        .ok_or_else(|| AppError::Internal("latest.json asset has no url".into()))?;
    let bytes = fetch_bytes(asset_url, &client, true).await?;
    serde_json::from_slice(&bytes)
        .map_err(|e| AppError::Internal(format!("Invalid latest.json: {e}")))
}

pub async fn check_github_updates(
    pool: &SqlitePool,
) -> Result<Option<GithubUpdateCheck>, AppError> {
    let Some(repo) = configured_repo() else {
        return Ok(None);
    };
    let token = resolve_github_token(pool).await;
    let manifest = fetch_latest_json(repo, token.as_deref()).await?;
    let current = update::current_version().to_string();
    let update_available = update::version_newer(&manifest.version, &current);
    Ok(Some(GithubUpdateCheck {
        current_version: current,
        latest_version: manifest.version,
        update_available,
        release_notes: manifest.notes,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_repo_reads_compile_time_env() {
        let _ = configured_repo();
    }
}
