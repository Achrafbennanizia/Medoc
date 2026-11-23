//! Login password recovery: once a bridge has recovered the database key (Bridge A with the
//! activation passphrase, B with the wrap passphrase, C with the vendor key and the printed
//! sheet), set a new password for one staff account in the practice database.
//!
//! Same rules as "set password" in MeDoc: the password policy, an Argon2 hash, the token
//! version bumped (LAN tokens issued before stop working), every device session ended and the
//! account's login lockout cleared. Recorded in the practice audit log (when this computer holds
//! the practice's audit key; the tool never creates one) and in `logs/recovery.log` next to the
//! database. The password itself is never logged. MeDoc must be closed while this runs.

use std::path::Path;

use anyhow::{bail, Context, Result};
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::repos::admin::{
    audit as audit_repo, brute_force as brute_force_repo, device_session as device_session_repo,
    staff as staff_repo,
};
use medoc_core::infrastructure::database::sqlcipher;
use serde::Serialize;
use sqlx::SqlitePool;
use zeroize::Zeroizing;

/// Who the audit log names for a reset made from the recovery tool.
pub const RECOVERY_ACTOR: &str = "recovery-tool";

#[derive(Debug, Clone, Serialize, sqlx::FromRow, PartialEq, Eq)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub email: String,
    pub role: String,
}

/// What a reset did, for the UI, the CLI and the recovery result.
#[derive(Debug, Clone, Serialize)]
pub struct PasswordResetReport {
    pub account: Account,
    /// Written to the practice audit log (needs the practice's audit key on this computer).
    pub audit_logged: bool,
    pub lockouts_cleared: u64,
    pub sessions_ended: u64,
}

/// `medoc.db` in the app data folder.
pub fn practice_db(app_dir: &Path) -> std::path::PathBuf {
    app_dir.join("medoc.db")
}

async fn open(db: &Path, key: &[u8]) -> Result<SqlitePool> {
    if !db.is_file() {
        bail!("practice database not found: {}", db.display());
    }
    if !sqlcipher::opens_with_sqlcipher_key(db, key).await {
        bail!("the recovered key does not open this practice database (another practice?)");
    }
    sqlcipher::open_encrypted_pool(db, Zeroizing::new(key.to_vec()), false)
        .await
        .map_err(|e| anyhow::anyhow!("open practice database: {e}"))
}

/// Accounts that can sign in (staff with an email), dentists first.
pub async fn list_accounts(db: &Path, key: &[u8]) -> Result<Vec<Account>> {
    let pool = open(db, key).await?;
    let rows = sqlx::query_as::<_, Account>(
        "SELECT id, name, email, role FROM staff
          WHERE email IS NOT NULL AND TRIM(email) <> ''
          ORDER BY CASE role WHEN 'PHYSICIAN' THEN 0 ELSE 1 END, name",
    )
    .fetch_all(&pool)
    .await
    .context("read staff accounts")?;
    pool.close().await;
    Ok(rows)
}

/// Sets `new_password` for the account with this email (case-insensitive) or id.
/// `bridge` is written into the audit entry (how the key was recovered).
pub async fn reset_password(
    db: &Path,
    key: &[u8],
    account: &str,
    new_password: &str,
    bridge: &str,
) -> Result<PasswordResetReport> {
    crypto::validate_password_policy(new_password)
        .map_err(|e| anyhow::anyhow!("password does not meet the policy: {}", e.wire_code()))?;
    let pool = open(db, key).await?;
    let found = sqlx::query_as::<_, Account>(
        "SELECT id, name, email, role FROM staff
          WHERE id = ?1 OR LOWER(TRIM(email)) = LOWER(TRIM(?1)) LIMIT 1",
    )
    .bind(account.trim())
    .fetch_optional(&pool)
    .await
    .context("find account")?;
    let Some(found) = found else {
        pool.close().await;
        bail!("no staff account with email or id {account:?}");
    };
    let hash = crypto::hash_password(new_password).map_err(|e| anyhow::anyhow!("hash: {e}"))?;
    let audit_key = audit_repo::init_existing_audit_hmac_key().unwrap_or(false);
    let outcome = async {
        staff_repo::replace_password(&pool, &found.id, &hash).await?;
        let sessions_ended = device_session_repo::end_all_for_user(&pool, &found.id).await?;
        let mut lockouts_cleared = 0;
        if audit_key {
            // The login lockout is keyed by the email as typed; clear the usual spellings.
            let mut subjects = vec![found.email.clone(), found.email.trim().to_lowercase()];
            subjects.dedup();
            for s in subjects {
                if let Ok(h) = audit_repo::subject_hmac(&s) {
                    lockouts_cleared += brute_force_repo::clear_by_subject_prefix(&pool, &h)
                        .await
                        .unwrap_or(0);
                }
            }
            audit_repo::create(
                &pool,
                RECOVERY_ACTOR,
                "PASSWORD_RECOVERY",
                "Staff",
                Some(&found.id),
                Some(&format!("bridge={bridge}")),
            )
            .await?;
        }
        Ok::<_, medoc_core::error::AppError>((sessions_ended, lockouts_cleared))
    }
    .await;
    pool.close().await;
    let (sessions_ended, lockouts_cleared) =
        outcome.map_err(|e| anyhow::anyhow!("reset password: {e}"))?;
    let report = PasswordResetReport {
        account: found,
        audit_logged: audit_key,
        lockouts_cleared,
        sessions_ended,
    };
    append_recovery_log(db, bridge, &report);
    Ok(report)
}

/// One JSON line in `<app data>/logs/recovery.log` (no password, no key).
fn append_recovery_log(db: &Path, bridge: &str, r: &PasswordResetReport) {
    use std::io::Write;
    let Some(dir) = db.parent().map(|d| d.join("logs")) else {
        return;
    };
    let _ = std::fs::create_dir_all(&dir);
    let line = serde_json::json!({
        "at": chrono::Utc::now().to_rfc3339(),
        "event": "PASSWORD_RECOVERY",
        "bridge": bridge,
        "staff_id": r.account.id,
        "audit_logged": r.audit_logged,
        "lockouts_cleared": r.lockouts_cleared,
        "sessions_ended": r.sessions_ended,
    });
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("recovery.log"))
    {
        let _ = writeln!(f, "{line}");
    }
}
