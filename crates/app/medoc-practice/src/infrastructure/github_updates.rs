//! GitHub Releases update manifest.
//!
//! CI publishes `latest.json` on each tagged release. The app never embeds a
//! GitHub token at compile time. Private repos need a practice-stored
//! Contents:read PAT in app KV (`updates.github_token`). Public release
//! assets need no token.
//!
//! Missing releases (HTTP 404) are treated as “no update channel”, not a
//! hard failure — private repos hide as 404 without a token, and tagged
//! app uploads may not include `latest.json`.

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

enum FetchBody {
    Bytes(Vec<u8>),
    Missing,
}

pub fn configured_repo() -> Option<&'static str> {
    option_env!("MEDOC_UPDATER_GITHUB_REPO").filter(|s| !s.is_empty())
}

pub async fn resolve_github_token(pool: &SqlitePool) -> Option<String> {
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

fn is_absent_release(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::NOT_FOUND || status == reqwest::StatusCode::GONE
}

async fn fetch_bytes(
    url: &str,
    client: &reqwest::Client,
    octet_stream: bool,
) -> Result<FetchBody, AppError> {
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
    let status = res.status();
    if is_absent_release(status) {
        return Ok(FetchBody::Missing);
    }
    if !status.is_success() {
        return Err(AppError::Internal(format!(
            "GitHub update fetch failed (HTTP {status})"
        )));
    }
    let bytes = res
        .bytes()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(FetchBody::Bytes(bytes.to_vec()))
}

fn parse_latest_json(bytes: &[u8]) -> Result<LatestJson, AppError> {
    serde_json::from_slice(bytes).map_err(|e| AppError::Internal(format!("Invalid latest.json: {e}")))
}

async fn fetch_latest_json(
    repo: &str,
    token: Option<&str>,
) -> Result<Option<LatestJson>, AppError> {
    let client = github_client(token)?;
    let direct = format!("https://github.com/{repo}/releases/latest/download/latest.json");
    match fetch_bytes(&direct, &client, true).await? {
        FetchBody::Bytes(bytes) => return parse_latest_json(&bytes).map(Some),
        FetchBody::Missing => {}
    }

    // Private repos (or missing public asset): GitHub REST latest release.
    let api_url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let meta_bytes = match fetch_bytes(&api_url, &client, false).await? {
        FetchBody::Bytes(bytes) => bytes,
        FetchBody::Missing => return Ok(None),
    };
    let meta: serde_json::Value = serde_json::from_slice(&meta_bytes)
        .map_err(|e| AppError::Internal(format!("Invalid release metadata: {e}")))?;
    let Some(assets) = meta.get("assets").and_then(|version| version.as_array()) else {
        return Ok(None);
    };
    let Some(asset) = assets
        .iter()
        .find(|a| a.get("name").and_then(|n| n.as_str()) == Some("latest.json"))
    else {
        return Ok(None);
    };
    let Some(asset_url) = asset.get("url").and_then(|u| u.as_str()) else {
        return Ok(None);
    };
    match fetch_bytes(asset_url, &client, true).await? {
        FetchBody::Bytes(bytes) => parse_latest_json(&bytes).map(Some),
        FetchBody::Missing => Ok(None),
    }
}

pub async fn check_github_updates(
    pool: &SqlitePool,
) -> Result<Option<GithubUpdateCheck>, AppError> {
    let Some(repo) = configured_repo() else {
        return Ok(None);
    };
    let token = resolve_github_token(pool).await;
    let Some(manifest) = fetch_latest_json(repo, token.as_deref()).await? else {
        return Ok(None);
    };
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

    #[test]
    fn absent_release_is_404_or_410() {
        assert!(is_absent_release(reqwest::StatusCode::NOT_FOUND));
        assert!(is_absent_release(reqwest::StatusCode::GONE));
        assert!(!is_absent_release(reqwest::StatusCode::UNAUTHORIZED));
        assert!(!is_absent_release(reqwest::StatusCode::FORBIDDEN));
        assert!(!is_absent_release(reqwest::StatusCode::INTERNAL_SERVER_ERROR));
    }

    #[test]
    fn parse_latest_json_reads_version_and_notes() {
        let parsed = parse_latest_json(br#"{"version":"1.2.3","notes":"hello"}"#).unwrap();
        assert_eq!(parsed.version, "1.2.3");
        assert_eq!(parsed.notes, "hello");
    }
}
