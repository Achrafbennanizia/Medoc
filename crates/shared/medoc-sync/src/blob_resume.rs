//! Attachment downloads that survive a broken connection (T3.4, editions plan).
//!
//! The replica streams a blob from the main device. If the stream breaks off, what arrived is kept
//! in `sync_blob_partial` and the next round asks for the rest (`Range: bytes=N-`). A main device
//! that ignores the range answers 200 with the whole blob, which replaces the partial. The caller
//! still verifies the SHA-256 of the result; a mismatch drops the partial ([`forget`]).

use medoc_core::error::AppError;
use sqlx::SqlitePool;

const TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS sync_blob_partial (
    sha256 TEXT PRIMARY KEY,
    bytes BLOB NOT NULL,
    updated_at TEXT NOT NULL
)";

async fn ensure(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(TABLE_SQL)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn load(pool: &SqlitePool, sha: &str) -> Vec<u8> {
    sqlx::query_scalar("SELECT bytes FROM sync_blob_partial WHERE sha256 = ?1")
        .bind(sha)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .unwrap_or_default()
}

async fn save(pool: &SqlitePool, sha: &str, bytes: &[u8]) {
    let _ = sqlx::query(
        "INSERT INTO sync_blob_partial (sha256, bytes, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(sha256) DO UPDATE SET bytes = excluded.bytes, updated_at = excluded.updated_at",
    )
    .bind(sha)
    .bind(bytes)
    .bind(chrono::Utc::now().to_rfc3339())
    .execute(pool)
    .await;
}

/// Drops the partial download (finished, or the result did not verify).
pub async fn forget(pool: &SqlitePool, sha: &str) {
    let _ = sqlx::query("DELETE FROM sync_blob_partial WHERE sha256 = ?1")
        .bind(sha)
        .execute(pool)
        .await;
}

/// The whole blob, or `None` when it could not be fetched this round (a broken stream keeps
/// its part for the next round).
pub async fn fetch(
    client: &reqwest::Client,
    url: &str,
    token: &str,
    pool: &SqlitePool,
    sha: &str,
) -> Option<Vec<u8>> {
    ensure(pool).await.ok()?;
    let mut buf = load(pool, sha).await;
    let mut req = client.get(url).bearer_auth(token);
    if !buf.is_empty() {
        req = req.header(reqwest::header::RANGE, format!("bytes={}-", buf.len()));
    }
    let mut resp = req.send().await.ok()?;
    match resp.status().as_u16() {
        206 => {}
        200 => buf.clear(),
        // 416: the partial no longer fits the blob; start over next round.
        416 => {
            forget(pool, sha).await;
            return None;
        }
        _ => return None,
    }
    loop {
        match resp.chunk().await {
            Ok(Some(chunk)) => buf.extend_from_slice(&chunk),
            Ok(None) => return Some(buf),
            Err(_) => {
                if !buf.is_empty() {
                    save(pool, sha, &buf).await;
                }
                return None;
            }
        }
    }
}
