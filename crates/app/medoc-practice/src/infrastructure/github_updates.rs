//! GitHub Releases update manifest.
//!
//! CI publishes one signed manifest per edition × flavor on each tagged release,
//! `latest-<edition>-<flavor>[-early].json` (T7.5, `medoc_core::infrastructure::update_manifest`).
//! A build only reads its own file and refuses one the vendor did not sign. The app never embeds a
//! GitHub token at compile time. Private repos need a practice-stored
//! Contents:read PAT in app KV (`updates.github_token`). Public release
//! assets need no token.
//!
//! Missing releases (HTTP 404) are treated as “no update channel”, not a
//! hard failure — private repos hide as 404 without a token, and tagged
//! app uploads may not include `latest.json`.

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::update;
use medoc_core::infrastructure::update_manifest::{self, Channel, MedocBlock};
use sqlx::SqlitePool;

pub const GITHUB_TOKEN_KV_KEY: &str = "updates.github_token";
/// `stable` (default) or `early`.
pub const CHANNEL_KV_KEY: &str = "updates.channel.v1";

#[derive(Debug)]
pub struct GithubUpdateCheck {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: String,
    pub channel: Channel,
    pub block: Option<MedocBlock>,
}

pub async fn channel(pool: &SqlitePool) -> Channel {
    app_kv_repo::get(pool, CHANNEL_KV_KEY)
        .await
        .ok()
        .flatten()
        .map(|raw| Channel::parse(raw.trim()))
        .unwrap_or(Channel::Stable)
}

/// This build's manifest file name.
pub fn manifest_file(channel: Channel) -> String {
    let info = crate::edition::info();
    update_manifest::manifest_name(info.edition, info.flavor, channel)
}

/// Direct download URL of this build's manifest (the Tauri updater endpoint).
pub fn manifest_url(repo: &str, channel: Channel) -> String {
    format!(
        "https://github.com/{repo}/releases/latest/download/{}",
        manifest_file(channel)
    )
}

/// Vendor signature, edition and flavor of a fetched manifest (`update_manifest::verify`).
pub fn verify_manifest(raw: &serde_json::Value) -> Result<MedocBlock, AppError> {
    let info = crate::edition::info();
    update_manifest::verify(raw, info.edition, info.flavor)
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

fn parse_latest_json(bytes: &[u8]) -> Result<serde_json::Value, AppError> {
    serde_json::from_slice(bytes)
        .map_err(|e| AppError::Internal(format!("Invalid update manifest: {e}")))
}

async fn fetch_latest_json(
    repo: &str,
    token: Option<&str>,
    file: &str,
) -> Result<Option<serde_json::Value>, AppError> {
    let client = github_client(token)?;
    let direct = format!("https://github.com/{repo}/releases/latest/download/{file}");
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
        .find(|a| a.get("name").and_then(|n| n.as_str()) == Some(file))
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
    let channel = channel(pool).await;
    let Some(raw) = fetch_latest_json(repo, token.as_deref(), &manifest_file(channel)).await?
    else {
        return Ok(None);
    };
    let current = update::current_version().to_string();
    let block = match verify_manifest(&raw) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(target: "medoc::system", event = "UPDATE_MANIFEST_REFUSED", reason = %e);
            return Ok(None);
        }
    };
    Ok(Some(GithubUpdateCheck {
        update_available: update_manifest::installable(&block, &current),
        current_version: current,
        latest_version: block.version.clone(),
        release_notes: block.notes_for("en"),
        channel,
        block: Some(block),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn absent_release_is_404_or_410() {
        assert!(is_absent_release(reqwest::StatusCode::NOT_FOUND));
        assert!(is_absent_release(reqwest::StatusCode::GONE));
        assert!(!is_absent_release(reqwest::StatusCode::UNAUTHORIZED));
        assert!(!is_absent_release(reqwest::StatusCode::FORBIDDEN));
        assert!(!is_absent_release(
            reqwest::StatusCode::INTERNAL_SERVER_ERROR
        ));
    }

    #[test]
    fn an_unsigned_manifest_is_refused() {
        let parsed = parse_latest_json(br#"{"version":"1.2.3","notes":"hello"}"#).unwrap();
        assert_eq!(parsed["version"], "1.2.3");
        assert!(verify_manifest(&parsed).is_err());
    }

    #[test]
    fn the_manifest_names_this_edition_and_flavor() {
        let info = crate::edition::info();
        let url = manifest_url("acme/medoc", Channel::Early);
        assert!(url.ends_with(&format!(
            "latest-{}-{}-early.json",
            info.edition, info.flavor
        )));
    }
}
