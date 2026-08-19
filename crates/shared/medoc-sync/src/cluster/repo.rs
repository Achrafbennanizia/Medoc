//! SQLite adapters for device-cluster repositories.

#![allow(clippy::type_complexity, clippy::too_many_arguments)]

use chrono::{DateTime, Utc};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::migrations::ensure_cluster_tables;
use sqlx::SqlitePool;

use super::entities::{Device, PairingSession, License, SeatUsage};
use super::enums::{DeviceStatus, PairingStatus, SeatRole};

async fn ensure(pool: &SqlitePool) -> Result<(), AppError> {
    crate::schema::ensure_sync_tables(pool).await?;
    ensure_cluster_tables(pool).await
}

fn parse_sync_timestamp(raw: &str, field: &str) -> Result<DateTime<Utc>, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(Utc::now());
    }
    if let Ok(dt) = trimmed.parse::<DateTime<Utc>>() {
        return Ok(dt);
    }
    chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S%.f"))
        .map(|ndt| ndt.and_utc())
        .map_err(|e| AppError::Internal(format!("{field}: {e}")))
}

pub async fn load_license(pool: &SqlitePool) -> Result<Option<License>, AppError> {
    ensure(pool).await?;
    let row: Option<(
        String,
        String,
        Vec<u8>,
        i64,
        i64,
        i64,
        String,
    )> = sqlx::query_as(
        "SELECT cluster_id, license_ref, signing_key_enc, max_total, max_admin, max_member, activated_at
         FROM license LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    let Some((
        cluster_id,
        license_ref,
        signing_key_enc,
        max_total,
        max_admin,
        max_member,
        activated_at,
    )) = row
    else {
        return Ok(None);
    };

    Ok(Some(License {
        cluster_id,
        license_ref,
        signing_key_enc,
        max_total: max_total as u32,
        max_admin: max_admin as u32,
        max_member: max_member as u32,
        activated_at: activated_at.parse().map_err(|e: chrono::ParseError| {
            AppError::Internal(format!("license.activated_at: {e}"))
        })?,
    }))
}

pub async fn save_license(pool: &SqlitePool, license: &License) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query(
        "INSERT INTO license (cluster_id, license_ref, signing_key_enc, max_total, max_admin, max_member, activated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(cluster_id) DO UPDATE SET
            license_ref = excluded.license_ref,
            signing_key_enc = excluded.signing_key_enc,
            max_total = excluded.max_total,
            max_admin = excluded.max_admin,
            max_member = excluded.max_member,
            activated_at = excluded.activated_at",
    )
    .bind(&license.cluster_id)
    .bind(&license.license_ref)
    .bind(&license.signing_key_enc)
    .bind(license.max_total as i64)
    .bind(license.max_admin as i64)
    .bind(license.max_member as i64)
    .bind(license.activated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn seat_usage(pool: &SqlitePool, cluster_id: &str) -> Result<SeatUsage, AppError> {
    ensure(pool).await?;
    let license = load_license(pool).await?;
    let (max_total, max_admin, max_member) = license
        .map(|l| (l.max_total, l.max_admin, l.max_member))
        .unwrap_or((10, 3, 7));

    let row: (i64, i64, i64) = sqlx::query_as(
        "SELECT
            COALESCE(SUM(CASE WHEN seat_role = 'ADMIN' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN seat_role = 'MEMBER' THEN 1 ELSE 0 END), 0),
            COALESCE(COUNT(*), 0)
         FROM sync_device
         WHERE cluster_id = ?1
           AND device_status IN ('PENDING','ACTIVE')
           AND fingerprint IS NOT NULL AND TRIM(fingerprint) != ''
           AND pubkey IS NOT NULL AND length(pubkey) = 32
           AND pubkey != X'0000000000000000000000000000000000000000000000000000000000000000'",
    )
    .bind(cluster_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(SeatUsage {
        admin_used: row.0 as u32,
        member_used: row.1 as u32,
        total_used: row.2 as u32,
        max_admin,
        max_member,
        max_total,
    })
}

fn parse_device_row(
    fingerprint: String,
    cluster_id: String,
    device_id: String,
    pubkey: Option<Vec<u8>>,
    hostname: Option<String>,
    os: Option<String>,
    last_ip: Option<String>,
    seat_role: Option<String>,
    device_status: Option<String>,
    seat_cert: Option<Vec<u8>>,
    last_seen: Option<String>,
    created_at: String,
) -> Result<Device, AppError> {
    let seat_role = seat_role
        .as_deref()
        .and_then(SeatRole::parse)
        .unwrap_or(SeatRole::Member);
    let status = device_status
        .as_deref()
        .and_then(DeviceStatus::parse)
        .unwrap_or(DeviceStatus::Pending);
    Ok(Device {
        fingerprint,
        cluster_id,
        device_id,
        pubkey: pubkey.unwrap_or_default(),
        hostname,
        os,
        last_ip,
        seat_role,
        status,
        seat_cert,
        last_seen: last_seen
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .map(|s| parse_sync_timestamp(s, "device.last_seen_at"))
            .transpose()?,
        created_at: parse_sync_timestamp(&created_at, "device.created_at")?,
    })
}

pub async fn find_by_fingerprint(
    pool: &SqlitePool,
    fingerprint: &str,
) -> Result<Option<Device>, AppError> {
    ensure(pool).await?;
    let row: Option<(
        String,
        String,
        String,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT fingerprint, cluster_id, device_id, pubkey, hostname, os, last_ip,
                seat_role, device_status, seat_cert, last_seen_at, created_at
         FROM sync_device WHERE fingerprint = ?1",
    )
    .bind(fingerprint)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| parse_device_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .transpose()
}

pub async fn find_by_device_id(
    pool: &SqlitePool,
    device_id: &str,
    cluster_id: &str,
) -> Result<Option<Device>, AppError> {
    ensure(pool).await?;
    let row: Option<(
        String,
        String,
        String,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT fingerprint, cluster_id, device_id, pubkey, hostname, os, last_ip,
                seat_role, device_status, seat_cert, last_seen_at, created_at
         FROM sync_device WHERE device_id = ?1 AND cluster_id = ?2",
    )
    .bind(device_id)
    .bind(cluster_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| parse_device_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .transpose()
}

pub async fn upsert_device(pool: &SqlitePool, device: &Device) -> Result<(), AppError> {
    ensure(pool).await?;
    let role_legacy = match device.seat_role {
        SeatRole::Admin => "MASTER",
        SeatRole::Member => "REPLICA",
    };
    sqlx::query(
        "INSERT INTO sync_device (
            device_id, display_name, role, is_local, fingerprint, pubkey, hostname, os,
            last_ip, seat_role, device_status, seat_cert, cluster_id, last_seen_at, created_at
         ) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(device_id) DO UPDATE SET
            fingerprint = excluded.fingerprint,
            pubkey = excluded.pubkey,
            hostname = excluded.hostname,
            os = excluded.os,
            last_ip = excluded.last_ip,
            seat_role = excluded.seat_role,
            device_status = excluded.device_status,
            seat_cert = excluded.seat_cert,
            cluster_id = excluded.cluster_id,
            last_seen_at = excluded.last_seen_at,
            role = excluded.role,
            created_at = COALESCE(NULLIF(sync_device.created_at, ''), excluded.created_at)",
    )
    .bind(&device.device_id)
    .bind(device.hostname.as_deref().unwrap_or(""))
    .bind(role_legacy)
    .bind(&device.fingerprint)
    .bind(&device.pubkey)
    .bind(&device.hostname)
    .bind(&device.os)
    .bind(&device.last_ip)
    .bind(device.seat_role.as_str())
    .bind(device.status.as_str())
    .bind(&device.seat_cert)
    .bind(&device.cluster_id)
    .bind(device.last_seen.map(|t| t.to_rfc3339()))
    .bind(device.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn list_devices(pool: &SqlitePool, cluster_id: &str) -> Result<Vec<Device>, AppError> {
    ensure(pool).await?;
    let rows: Vec<(
        String,
        String,
        String,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT fingerprint, cluster_id, device_id, pubkey, hostname, os, last_ip,
                seat_role, device_status, seat_cert, last_seen_at, created_at
         FROM sync_device WHERE cluster_id = ?1 ORDER BY created_at",
    )
    .bind(cluster_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    rows.into_iter()
        .map(|r| parse_device_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .collect()
}

pub async fn set_device_status(
    pool: &SqlitePool,
    fingerprint: &str,
    status: DeviceStatus,
) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query("UPDATE sync_device SET device_status = ?1 WHERE fingerprint = ?2")
        .bind(status.as_str())
        .bind(fingerprint)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn is_blocklisted(pool: &SqlitePool, fingerprint: &str) -> Result<bool, AppError> {
    ensure(pool).await?;
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM device_blocklist WHERE fingerprint = ?1")
        .bind(fingerprint)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(n > 0)
}

pub async fn block_fingerprint(
    pool: &SqlitePool,
    fingerprint: &str,
    reason: &str,
) -> Result<(), AppError> {
    ensure(pool).await?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO device_blocklist (fingerprint, reason, blocked_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(fingerprint) DO UPDATE SET reason = excluded.reason, blocked_at = excluded.blocked_at",
    )
    .bind(fingerprint)
    .bind(reason)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    set_device_status(pool, fingerprint, DeviceStatus::Blocked).await?;
    Ok(())
}

pub async fn unblock_fingerprint(pool: &SqlitePool, fingerprint: &str) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query("DELETE FROM device_blocklist WHERE fingerprint = ?1")
        .bind(fingerprint)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn create_pairing_session(
    pool: &SqlitePool,
    session: &PairingSession,
) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query(
        "INSERT INTO pairing_request (
            id, device_id, slave_pubkey, slave_label, requester_ip, status,
            pairing_state, sas_hash, requested_role, expires_at, fingerprint, hostname, requested_at
         ) VALUES (?1, ?2, '', '', '', 'PENDING', ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    )
    .bind(&session.id)
    .bind(&session.fingerprint)
    .bind(session.state.as_str())
    .bind(&session.sas_hash)
    .bind(session.requested_role.as_str())
    .bind(session.expires_at.to_rfc3339())
    .bind(&session.fingerprint)
    .bind(&session.hostname)
    .bind(session.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn store_handshake_transcript(
    pool: &SqlitePool,
    session_id: &str,
    transcript: &[u8],
) -> Result<(), AppError> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    ensure(pool).await?;
    if transcript.is_empty() {
        return Ok(());
    }
    let b64 = STANDARD.encode(transcript);
    sqlx::query("UPDATE pairing_request SET handshake_transcript_b64 = ?1 WHERE id = ?2")
        .bind(b64)
        .bind(session_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn load_handshake_transcript(
    pool: &SqlitePool,
    session_id: &str,
) -> Result<Option<Vec<u8>>, AppError> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    ensure(pool).await?;
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT handshake_transcript_b64 FROM pairing_request WHERE id = ?1")
            .bind(session_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    let Some((Some(b64),)) = row else {
        return Ok(None);
    };
    let trimmed = b64.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    STANDARD
        .decode(trimmed)
        .map(Some)
        .map_err(|e| AppError::Internal(format!("handshake_transcript_b64 decode: {e}")))
}

pub async fn find_active_device_by_hostname(
    pool: &SqlitePool,
    cluster_id: &str,
    hostname: &str,
) -> Result<Option<Device>, AppError> {
    ensure(pool).await?;
    let row: Option<(
        String,
        String,
        String,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT fingerprint, cluster_id, device_id, pubkey, hostname, os, last_ip,
                seat_role, device_status, seat_cert, last_seen_at, created_at
         FROM sync_device
         WHERE cluster_id = ?1
           AND hostname = ?2
           AND device_status = 'ACTIVE'
           AND fingerprint IS NOT NULL AND TRIM(fingerprint) != ''
           AND pubkey IS NOT NULL AND length(pubkey) = 32
         LIMIT 1",
    )
    .bind(cluster_id)
    .bind(hostname)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| parse_device_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .transpose()
}

pub async fn load_pairing_session(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<PairingSession>, AppError> {
    ensure(pool).await?;
    let row: Option<(
        String,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT id, fingerprint, pairing_state, sas_hash, requested_role, expires_at, hostname, requested_at
         FROM pairing_request WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| {
        Ok(PairingSession {
            id: r.0,
            fingerprint: r.1.unwrap_or_default(),
            state: r
                .2
                .as_deref()
                .and_then(PairingStatus::parse)
                .unwrap_or(PairingStatus::JoinRequested),
            sas_hash: r.3,
            requested_role: r
                .4
                .as_deref()
                .and_then(SeatRole::parse)
                .unwrap_or(SeatRole::Member),
            hostname: r.6,
            expires_at: r
                .5
                .unwrap_or_default()
                .parse()
                .map_err(|e: chrono::ParseError| {
                    AppError::Internal(format!("pairing.expires_at: {e}"))
                })?,
            created_at: r.7.parse().map_err(|e: chrono::ParseError| {
                AppError::Internal(format!("pairing.created_at: {e}"))
            })?,
        })
    })
    .transpose()
}

pub async fn update_pairing_state(
    pool: &SqlitePool,
    id: &str,
    state: PairingStatus,
    sas_hash: Option<&[u8]>,
) -> Result<(), AppError> {
    ensure(pool).await?;
    if let Some(hash) = sas_hash {
        sqlx::query("UPDATE pairing_request SET pairing_state = ?1, sas_hash = ?2 WHERE id = ?3")
            .bind(state.as_str())
            .bind(hash)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    } else {
        sqlx::query("UPDATE pairing_request SET pairing_state = ?1 WHERE id = ?2")
            .bind(state.as_str())
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

pub async fn list_pending_pairing(
    pool: &SqlitePool,
    _cluster_id: &str,
) -> Result<Vec<PairingSession>, AppError> {
    ensure(pool).await?;
    let rows: Vec<(
        String,
        Option<String>,
        Option<String>,
        Option<Vec<u8>>,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
    )> = sqlx::query_as(
        "SELECT id, fingerprint, pairing_state, sas_hash, requested_role, expires_at, hostname, requested_at
         FROM pairing_request
         WHERE status = 'PENDING' AND pairing_state IN ('JOIN_REQUESTED','AWAITING_SAS')
         ORDER BY requested_at",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    rows.into_iter()
        .map(|r| {
            Ok(PairingSession {
                id: r.0,
                fingerprint: r.1.unwrap_or_default(),
                state: r
                    .2
                    .as_deref()
                    .and_then(PairingStatus::parse)
                    .unwrap_or(PairingStatus::JoinRequested),
                sas_hash: r.3,
                requested_role: r
                    .4
                    .as_deref()
                    .and_then(SeatRole::parse)
                    .unwrap_or(SeatRole::Member),
                hostname: r.6,
                expires_at: r
                    .5
                    .unwrap_or_default()
                    .parse()
                    .map_err(|e: chrono::ParseError| {
                        AppError::Internal(format!("pairing.expires_at: {e}"))
                    })?,
                created_at: r.7.parse().map_err(|e: chrono::ParseError| {
                    AppError::Internal(format!("pairing.created_at: {e}"))
                })?,
            })
        })
        .collect()
}

pub async fn is_provisioned(pool: &SqlitePool, fingerprint: &str) -> Result<bool, AppError> {
    ensure(pool).await?;
    let n: Option<i64> =
        sqlx::query_scalar("SELECT provisioned FROM provisioning_state WHERE fingerprint = ?1")
            .bind(fingerprint)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(n.unwrap_or(0) != 0)
}

pub async fn mark_provisioned(pool: &SqlitePool, fingerprint: &str) -> Result<(), AppError> {
    ensure(pool).await?;
    if is_provisioned(pool, fingerprint).await? {
        return Err(AppError::Validation(
            "Device already provisioned (one-time only)".into(),
        ));
    }
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO provisioning_state (fingerprint, provisioned, counter, provisioned_at)
         VALUES (?1, 1, 1, ?2)
         ON CONFLICT(fingerprint) DO UPDATE SET
            provisioned = 1,
            counter = counter + 1,
            provisioned_at = excluded.provisioned_at",
    )
    .bind(fingerprint)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn provisioning_counter(pool: &SqlitePool, fingerprint: &str) -> Result<i64, AppError> {
    ensure(pool).await?;
    let n: Option<i64> =
        sqlx::query_scalar("SELECT counter FROM provisioning_state WHERE fingerprint = ?1")
            .bind(fingerprint)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(n.unwrap_or(0))
}
