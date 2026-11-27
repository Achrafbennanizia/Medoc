//! Remote commands from MeDoc support (T7.4, docs/architecture/editions-plan.md §11.5): built, off.
//!
//! Later the app pulls commands from the company server (nothing listens, no inbound port). Each one
//! is an envelope signed with the vendor Ed25519 key (`VENDOR_PUBKEY`, the licence key) naming the
//! practice, the target device, an allow-listed command, a nonce and an expiry of at most 24 hours.
//! Forged, foreign, expired or replayed envelopes are refused. An accepted one waits until an admin
//! approves or refuses it; nothing runs on its own. Commands never read patient data, run code or
//! change access.
//!
//! [`ENABLED`] stays `false` until the server channel exists: the UI hides the approval list and
//! [`decide`] refuses.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::crypto::sig::verify_ed25519;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use crate::infrastructure::license::VENDOR_PUBKEY;

/// Off until the company-server channel is released (§11).
pub const ENABLED: bool = false;
const MAX_LIFETIME_HOURS: i64 = 24;
/// Clock skew allowed between the vendor server and this computer.
const SKEW_MINUTES: i64 = 5;
const PENDING_KV: &str = "remote_commands.pending.v1";
const SEEN_KV: &str = "remote_commands.seen_nonces.v1";

/// The allow-list. Anything else fails to parse and is refused.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Command {
    SupportBundle,
    HealthSummary,
    SyncCheck,
    CheckUpdates,
    ScheduleUpdate,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Envelope {
    pub practice_id: String,
    pub device_id: String,
    pub command: Command,
    pub nonce: String,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    /// Only for `schedule_update`: the approved version.
    #[serde(default)]
    pub version: Option<String>,
}

/// Why an envelope was refused (shown to support in the reply, never to the practice as an error).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Refusal {
    BadSignature,
    Malformed,
    WrongPractice,
    WrongDevice,
    NotYetValid,
    Expired,
    LifetimeTooLong,
    Replayed,
}

/// Who this computer is.
pub struct Target<'a> {
    pub practice_id: &'a str,
    pub device_id: &'a str,
}

/// Checks the signature over the exact bytes received, then the fields.
pub fn verify(
    raw: &str,
    sig_b64: &str,
    target: &Target<'_>,
    now: DateTime<Utc>,
    seen: impl Fn(&str) -> bool,
) -> Result<Envelope, Refusal> {
    verify_with_key(&VENDOR_PUBKEY, raw, sig_b64, target, now, seen)
}

fn verify_with_key(
    key: &[u8; 32],
    raw: &str,
    sig_b64: &str,
    target: &Target<'_>,
    now: DateTime<Utc>,
    seen: impl Fn(&str) -> bool,
) -> Result<Envelope, Refusal> {
    verify_ed25519(key, raw.as_bytes(), sig_b64).map_err(|_| Refusal::BadSignature)?;
    let env: Envelope = serde_json::from_str(raw).map_err(|_| Refusal::Malformed)?;
    if env.nonce.trim().is_empty() || env.nonce.len() > 64 {
        return Err(Refusal::Malformed);
    }
    if env.practice_id != target.practice_id {
        return Err(Refusal::WrongPractice);
    }
    if env.device_id != target.device_id {
        return Err(Refusal::WrongDevice);
    }
    if env.expires_at - env.issued_at > Duration::hours(MAX_LIFETIME_HOURS) {
        return Err(Refusal::LifetimeTooLong);
    }
    if env.issued_at > now + Duration::minutes(SKEW_MINUTES) {
        return Err(Refusal::NotYetValid);
    }
    if env.expires_at <= now {
        return Err(Refusal::Expired);
    }
    if seen(&env.nonce) {
        return Err(Refusal::Replayed);
    }
    Ok(env)
}

/// A nonce is remembered until its envelope expires (then a replay fails as expired anyway).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Seen {
    nonce: String,
    expires_at: DateTime<Utc>,
}

async fn read<T: serde::de::DeserializeOwned + Default>(pool: &SqlitePool, key: &str) -> T {
    app_kv_repo::get(pool, key)
        .await
        .ok()
        .flatten()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

async fn write<T: Serialize>(pool: &SqlitePool, key: &str, value: &T) -> Result<(), AppError> {
    let raw = serde_json::to_string(value).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(pool, key, &raw).await
}

/// Verifies an envelope and queues it for the admin's decision.
pub async fn receive(
    pool: &SqlitePool,
    raw: &str,
    sig_b64: &str,
    target: &Target<'_>,
    now: DateTime<Utc>,
) -> Result<Result<Envelope, Refusal>, AppError> {
    let mut seen: Vec<Seen> = read(pool, SEEN_KV).await;
    seen.retain(|s| s.expires_at > now);
    let checked = verify(raw, sig_b64, target, now, |n| {
        seen.iter().any(|s| s.nonce == n)
    });
    if let Ok(env) = &checked {
        seen.push(Seen {
            nonce: env.nonce.clone(),
            expires_at: env.expires_at,
        });
        let mut pending: Vec<Envelope> = read(pool, PENDING_KV).await;
        pending.push(env.clone());
        write(pool, PENDING_KV, &pending).await?;
    }
    write(pool, SEEN_KV, &seen).await?;
    Ok(checked)
}

/// Waiting for the admin, without expired ones.
pub async fn pending(pool: &SqlitePool, now: DateTime<Utc>) -> Vec<Envelope> {
    let all: Vec<Envelope> = read(pool, PENDING_KV).await;
    all.into_iter().filter(|e| e.expires_at > now).collect()
}

/// The admin approves (returns the command to run) or refuses. Refused while [`ENABLED`] is off.
pub async fn decide(
    pool: &SqlitePool,
    nonce: &str,
    approve: bool,
    now: DateTime<Utc>,
) -> Result<Option<Envelope>, AppError> {
    if !ENABLED {
        return Err(AppError::Conflict(
            "remote commands are not available yet".into(),
        ));
    }
    decide_queued(pool, nonce, approve, now).await
}

async fn decide_queued(
    pool: &SqlitePool,
    nonce: &str,
    approve: bool,
    now: DateTime<Utc>,
) -> Result<Option<Envelope>, AppError> {
    let mut all = pending(pool, now).await;
    let Some(i) = all.iter().position(|e| e.nonce == nonce) else {
        return Err(AppError::NotFound("remote command".into()));
    };
    let env = all.remove(i);
    write(pool, PENDING_KV, &all).await?;
    Ok(approve.then_some(env))
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
    use ed25519_dalek::{Signer, SigningKey};

    const T: Target<'static> = Target {
        practice_id: "practice-1",
        device_id: "device-a",
    };

    fn key() -> SigningKey {
        SigningKey::from_bytes(&[7u8; 32])
    }

    fn now() -> DateTime<Utc> {
        "2026-11-25T10:00:00Z".parse().unwrap()
    }

    fn envelope(command: &str, nonce: &str, issued: &str, expires: &str) -> String {
        format!(
            r#"{{"practiceId":"practice-1","deviceId":"device-a","command":"{command}","nonce":"{nonce}","issuedAt":"{issued}","expiresAt":"{expires}"}}"#
        )
    }

    fn sign(raw: &str) -> String {
        STANDARD_NO_PAD.encode(key().sign(raw.as_bytes()).to_bytes())
    }

    fn check(raw: &str, sig: &str, target: &Target<'_>) -> Result<Envelope, Refusal> {
        verify_with_key(
            &key().verifying_key().to_bytes(),
            raw,
            sig,
            target,
            now(),
            |n| n == "used",
        )
    }

    #[test]
    fn a_signed_allow_listed_command_for_this_device_is_accepted() {
        let raw = envelope(
            "health_summary",
            "n1",
            "2026-11-25T09:00:00Z",
            "2026-11-25T20:00:00Z",
        );
        let env = check(&raw, &sign(&raw), &T).expect("accepted");
        assert_eq!(env.command, Command::HealthSummary);
    }

    #[test]
    fn forged_foreign_expired_replayed_and_unknown_commands_are_refused() {
        let ok = envelope(
            "sync_check",
            "n2",
            "2026-11-25T09:00:00Z",
            "2026-11-25T20:00:00Z",
        );
        let tampered = ok.replace("sync_check", "check_updates");
        assert_eq!(check(&tampered, &sign(&ok), &T), Err(Refusal::BadSignature));

        let other = Target {
            practice_id: "practice-1",
            device_id: "device-b",
        };
        assert_eq!(check(&ok, &sign(&ok), &other), Err(Refusal::WrongDevice));

        let old = envelope(
            "sync_check",
            "n3",
            "2026-11-24T08:00:00Z",
            "2026-11-25T08:00:00Z",
        );
        assert_eq!(check(&old, &sign(&old), &T), Err(Refusal::Expired));

        let long = envelope(
            "sync_check",
            "n4",
            "2026-11-25T09:00:00Z",
            "2026-11-27T09:00:00Z",
        );
        assert_eq!(
            check(&long, &sign(&long), &T),
            Err(Refusal::LifetimeTooLong)
        );

        let future = envelope(
            "sync_check",
            "n5",
            "2026-11-25T11:00:00Z",
            "2026-11-25T20:00:00Z",
        );
        assert_eq!(
            check(&future, &sign(&future), &T),
            Err(Refusal::NotYetValid)
        );

        let replay = envelope(
            "sync_check",
            "used",
            "2026-11-25T09:00:00Z",
            "2026-11-25T20:00:00Z",
        );
        assert_eq!(check(&replay, &sign(&replay), &T), Err(Refusal::Replayed));

        let run_code = envelope(
            "run_shell",
            "n6",
            "2026-11-25T09:00:00Z",
            "2026-11-25T20:00:00Z",
        );
        assert_eq!(
            check(&run_code, &sign(&run_code), &T),
            Err(Refusal::Malformed)
        );
    }

    #[tokio::test]
    async fn queued_commands_wait_for_the_admin_and_decide_is_off() {
        let pool = crate::infrastructure::database::connection::test_memory_pool()
            .await
            .unwrap();
        crate::infrastructure::database::connection::run_migrations(&pool)
            .await
            .unwrap();
        let env: Envelope = serde_json::from_str(&envelope(
            "check_updates",
            "n7",
            "2026-11-25T09:00:00Z",
            "2026-11-25T20:00:00Z",
        ))
        .unwrap();
        write(&pool, PENDING_KV, &vec![env.clone()]).await.unwrap();
        assert_eq!(pending(&pool, now()).await, vec![env.clone()]);
        assert!(decide(&pool, "n7", true, now()).await.is_err(), "off");
        let run = decide_queued(&pool, "n7", true, now()).await.unwrap();
        assert_eq!(run, Some(env));
        assert!(pending(&pool, now()).await.is_empty());
    }
}
