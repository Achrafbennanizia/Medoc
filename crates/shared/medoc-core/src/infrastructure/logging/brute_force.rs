// Brute-force detection (NFA-LOG-02)
//
// Keys combine HMAC-hashed subject (email / practice slug) + peer IP so an attacker
// cannot lock out a victim account globally from one IP. Lockouts persist in SQLite.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::admin::brute_force as brute_force_repo;

const WINDOW: Duration = Duration::from_secs(10 * 60);
const LOCKOUT: Duration = Duration::from_secs(15 * 60);
const THRESHOLD: usize = 5;

/// Desktop Tauri login has no real client IP — use a stable local sentinel.
pub const DESKTOP_PEER_IP: &str = "local-desktop";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BruteKey {
    pub hashed_subject: String,
    pub peer_ip: String,
}

impl BruteKey {
    pub fn new(hashed_subject: String, peer_ip: impl Into<String>) -> Self {
        Self {
            hashed_subject,
            peer_ip: peer_ip.into(),
        }
    }

    /// Hash `subject` with the audit HMAC key (email, practice slug, etc.).
    pub fn from_subject(subject: &str, peer_ip: impl Into<String>) -> Result<Self, AppError> {
        Ok(Self::new(hash_subject(subject)?, peer_ip))
    }

    pub fn storage_key(&self) -> String {
        format!("{}|{}", self.hashed_subject, self.peer_ip)
    }

    /// Failures for this account, independent of the caller address.
    pub fn account_storage_key(&self) -> String {
        format!("{}|*", self.hashed_subject)
    }
}

pub fn hash_subject(subject: &str) -> Result<String, AppError> {
    audit_repo::subject_hmac(subject)
}

#[derive(Default)]
struct Entry {
    failures: Vec<Instant>,
    locked_until: Option<Instant>,
}

#[derive(Default)]
pub struct BruteForceTracker {
    inner: Mutex<HashMap<String, Entry>>,
}

pub enum CheckResult {
    Allowed,
    Locked { remaining_secs: u64 },
}

impl BruteForceTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Hydrate in-memory lockouts from DB after the pool is ready.
    pub async fn hydrate_from_db(&self, pool: &SqlitePool) -> Result<(), AppError> {
        brute_force_repo::ensure_schema(pool).await?;
        let rows = brute_force_repo::load_active_lockouts(pool).await?;
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        for row in rows {
            if let Some(until_dt) = row.locked_until {
                let until = instant_from_utc(until_dt);
                if until > now {
                    map.entry(row.key_hash).or_default().locked_until = Some(until);
                }
            }
        }
        Ok(())
    }

    pub async fn check(&self, pool: Option<&SqlitePool>, key: &BruteKey) -> CheckResult {
        for storage in [key.storage_key(), key.account_storage_key()] {
            if let CheckResult::Locked { remaining_secs } = self.check_storage(pool, &storage).await
            {
                return CheckResult::Locked { remaining_secs };
            }
        }
        CheckResult::Allowed
    }

    async fn check_storage(&self, pool: Option<&SqlitePool>, storage: &str) -> CheckResult {
        if let Some(pool) = pool {
            if let Ok(Some(row)) = brute_force_repo::get(pool, storage).await {
                if let Some(until_dt) = row.locked_until {
                    let now = Utc::now();
                    if until_dt > now {
                        let remaining = (until_dt - now).num_seconds().max(0) as u64;
                        return CheckResult::Locked {
                            remaining_secs: remaining,
                        };
                    }
                }
            }
        }
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = map.get(storage) {
            if let Some(until) = entry.locked_until {
                if Instant::now() < until {
                    return CheckResult::Locked {
                        remaining_secs: (until - Instant::now()).as_secs(),
                    };
                }
            }
        }
        CheckResult::Allowed
    }

    pub async fn record_failure(&self, pool: Option<&SqlitePool>, key: &BruteKey) -> bool {
        let ip_key = key.storage_key();
        let account_key = key.account_storage_key();
        let (ip_state, account_state) = {
            let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
            (
                bump_entry(&mut map, &ip_key),
                bump_entry(&mut map, &account_key),
            )
        };
        if let Some(pool) = pool {
            let _ = brute_force_repo::upsert(pool, &ip_key, ip_state.0, ip_state.1).await;
            let _ = brute_force_repo::upsert(pool, &account_key, account_state.0, account_state.1)
                .await;
        }
        ip_state.2 || account_state.2
    }

    pub async fn record_success(&self, pool: Option<&SqlitePool>, key: &BruteKey) {
        for storage in [key.storage_key(), key.account_storage_key()] {
            {
                let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
                map.remove(&storage);
            }
            if let Some(pool) = pool {
                let _ = brute_force_repo::delete(pool, &storage).await;
            }
        }
    }

    pub async fn admin_clear_subject(
        &self,
        pool: &SqlitePool,
        hashed_subject: &str,
    ) -> Result<u64, AppError> {
        let removed = brute_force_repo::clear_by_subject_prefix(pool, hashed_subject).await?;
        let prefix = format!("{hashed_subject}|");
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.retain(|k, _| !k.starts_with(&prefix));
        Ok(removed)
    }
}

/// Returns `(failure_count, locked_until, newly_locked)`.
fn bump_entry(
    map: &mut HashMap<String, Entry>,
    storage: &str,
) -> (i64, Option<DateTime<Utc>>, bool) {
    let entry = map.entry(storage.to_string()).or_default();
    let now = Instant::now();
    entry.failures.retain(|t| now.duration_since(*t) <= WINDOW);
    entry.failures.push(now);
    let locked = if entry.failures.len() > THRESHOLD {
        entry.locked_until = Some(now + LOCKOUT);
        entry.failures.clear();
        true
    } else {
        false
    };
    (
        entry.failures.len() as i64,
        entry.locked_until.map(utc_from_instant),
        locked,
    )
}

fn instant_from_utc(dt: DateTime<Utc>) -> Instant {
    let remaining_ms = (dt - Utc::now()).num_milliseconds().max(0);
    Instant::now() + Duration::from_millis(remaining_ms as u64)
}

#[cfg(test)]
mod tests {
    use super::{BruteForceTracker, BruteKey, CheckResult};

    #[tokio::test]
    async fn different_addresses_still_lock_the_account() {
        let tracker = BruteForceTracker::new();
        for i in 0..5 {
            let key = BruteKey::new("acct".into(), format!("10.0.0.{i}"));
            assert!(!tracker.record_failure(None, &key).await);
        }
        let fresh = BruteKey::new("acct".into(), "10.0.0.99");
        assert!(matches!(
            tracker.check(None, &fresh).await,
            CheckResult::Allowed
        ));
        assert!(tracker.record_failure(None, &fresh).await);
        assert!(matches!(
            tracker.check(None, &fresh).await,
            CheckResult::Locked { .. }
        ));
    }
}

fn utc_from_instant(i: Instant) -> DateTime<Utc> {
    if i <= Instant::now() {
        return Utc::now();
    }
    let secs = i.duration_since(Instant::now()).as_secs();
    Utc::now() + chrono::Duration::seconds(secs as i64)
}
