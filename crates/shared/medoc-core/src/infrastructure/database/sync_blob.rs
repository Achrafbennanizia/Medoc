//! Content-addressed attachment bytes for LAN blob sync (F31).

use sha2::{Digest, Sha256};
use sqlx::SqlitePool;

use crate::error::AppError;

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex_encode(&digest)
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

pub async fn put_verified(pool: &SqlitePool, claimed_sha256: &str, bytes: &[u8]) -> Result<(), AppError> {
    let actual = sha256_hex(bytes);
    if actual != claimed_sha256.trim().to_ascii_lowercase() {
        return Err(AppError::Validation("blob hash mismatch".into()));
    }
    sqlx::query(
        "INSERT INTO sync_blob (sha256, bytes) VALUES (?1, ?2)
         ON CONFLICT(sha256) DO UPDATE SET bytes = excluded.bytes",
    )
    .bind(&actual)
    .bind(bytes)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_bytes(pool: &SqlitePool, sha256: &str) -> Result<Vec<u8>, AppError> {
    let row: Option<Vec<u8>> = sqlx::query_scalar("SELECT bytes FROM sync_blob WHERE sha256 = ?1")
        .bind(sha256.trim().to_ascii_lowercase())
        .fetch_optional(pool)
        .await?;
    row.ok_or_else(|| AppError::NotFound("Blob".into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn blob_with_wrong_hash_is_rejected() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        let bytes = b"hello-blob";
        let err = put_verified(&pool, "00".repeat(32).as_str(), bytes)
            .await
            .expect_err("mismatch");
        assert!(err.to_string().contains("hash"));
        let hex = sha256_hex(bytes);
        put_verified(&pool, &hex, bytes).await.expect("put");
        let got = get_bytes(&pool, &hex).await.expect("get");
        assert_eq!(got, bytes);
    }
}
