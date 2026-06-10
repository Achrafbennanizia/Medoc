//! SQLite adapters for Geräteverbund repositories.

#![allow(clippy::type_complexity, clippy::too_many_arguments)]

use chrono::{DateTime, Utc};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::migrations::ensure_verbund_tables;
use sqlx::SqlitePool;

use super::entities::{Geraet, KopplungSession, Lizenz, SeatUsage};
use super::enums::{GeraetStatus, KopplungStatus, SeatRolle};

async fn ensure(pool: &SqlitePool) -> Result<(), AppError> {
    crate::schema::ensure_sync_tables(pool).await?;
    ensure_verbund_tables(pool).await
}

pub async fn load_lizenz(pool: &SqlitePool) -> Result<Option<Lizenz>, AppError> {
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
         FROM lizenz LIMIT 1",
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

    Ok(Some(Lizenz {
        cluster_id,
        license_ref,
        signing_key_enc,
        max_total: max_total as u32,
        max_admin: max_admin as u32,
        max_member: max_member as u32,
        activated_at: activated_at.parse().map_err(|e: chrono::ParseError| {
            AppError::Internal(format!("lizenz.activated_at: {e}"))
        })?,
    }))
}

pub async fn save_lizenz(pool: &SqlitePool, lizenz: &Lizenz) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query(
        "INSERT INTO lizenz (cluster_id, license_ref, signing_key_enc, max_total, max_admin, max_member, activated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(cluster_id) DO UPDATE SET
            license_ref = excluded.license_ref,
            signing_key_enc = excluded.signing_key_enc,
            max_total = excluded.max_total,
            max_admin = excluded.max_admin,
            max_member = excluded.max_member,
            activated_at = excluded.activated_at",
    )
    .bind(&lizenz.cluster_id)
    .bind(&lizenz.license_ref)
    .bind(&lizenz.signing_key_enc)
    .bind(lizenz.max_total as i64)
    .bind(lizenz.max_admin as i64)
    .bind(lizenz.max_member as i64)
    .bind(lizenz.activated_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn seat_usage(pool: &SqlitePool, cluster_id: &str) -> Result<SeatUsage, AppError> {
    ensure(pool).await?;
    let lizenz = load_lizenz(pool).await?;
    let (max_total, max_admin, max_member) = lizenz
        .map(|l| (l.max_total, l.max_admin, l.max_member))
        .unwrap_or((10, 3, 7));

    let row: (i64, i64, i64) = sqlx::query_as(
        "SELECT
            COALESCE(SUM(CASE WHEN seat_role = 'ADMIN' THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN seat_role = 'MEMBER' THEN 1 ELSE 0 END), 0),
            COALESCE(COUNT(*), 0)
         FROM sync_device
         WHERE cluster_id = ?1
           AND geraet_status IN ('PENDING','ACTIVE')
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

fn parse_geraet_row(
    fingerprint: String,
    cluster_id: String,
    device_id: String,
    pubkey: Option<Vec<u8>>,
    hostname: Option<String>,
    os: Option<String>,
    last_ip: Option<String>,
    seat_role: Option<String>,
    geraet_status: Option<String>,
    seat_cert: Option<Vec<u8>>,
    last_seen: Option<String>,
    created_at: String,
) -> Result<Geraet, AppError> {
    let seat_role = seat_role
        .as_deref()
        .and_then(SeatRolle::parse)
        .unwrap_or(SeatRolle::Member);
    let status = geraet_status
        .as_deref()
        .and_then(GeraetStatus::parse)
        .unwrap_or(GeraetStatus::Pending);
    Ok(Geraet {
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
        last_seen: last_seen.and_then(|s| s.parse::<DateTime<Utc>>().ok()),
        created_at: created_at.parse().map_err(|e: chrono::ParseError| {
            AppError::Internal(format!("geraet.created_at: {e}"))
        })?,
    })
}

pub async fn find_by_fingerprint(
    pool: &SqlitePool,
    fingerprint: &str,
) -> Result<Option<Geraet>, AppError> {
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
                seat_role, geraet_status, seat_cert, last_seen_at, created_at
         FROM sync_device WHERE fingerprint = ?1",
    )
    .bind(fingerprint)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| parse_geraet_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .transpose()
}

pub async fn upsert_geraet(pool: &SqlitePool, geraet: &Geraet) -> Result<(), AppError> {
    ensure(pool).await?;
    let role_legacy = match geraet.seat_role {
        SeatRolle::Admin => "MASTER",
        SeatRolle::Member => "REPLICA",
    };
    sqlx::query(
        "INSERT INTO sync_device (
            device_id, display_name, role, is_local, fingerprint, pubkey, hostname, os,
            last_ip, seat_role, geraet_status, seat_cert, cluster_id, last_seen_at, created_at
         ) VALUES (?1, ?2, ?3, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
         ON CONFLICT(device_id) DO UPDATE SET
            fingerprint = excluded.fingerprint,
            pubkey = excluded.pubkey,
            hostname = excluded.hostname,
            os = excluded.os,
            last_ip = excluded.last_ip,
            seat_role = excluded.seat_role,
            geraet_status = excluded.geraet_status,
            seat_cert = excluded.seat_cert,
            cluster_id = excluded.cluster_id,
            last_seen_at = excluded.last_seen_at,
            role = excluded.role",
    )
    .bind(&geraet.device_id)
    .bind(geraet.hostname.as_deref().unwrap_or(""))
    .bind(role_legacy)
    .bind(&geraet.fingerprint)
    .bind(&geraet.pubkey)
    .bind(&geraet.hostname)
    .bind(&geraet.os)
    .bind(&geraet.last_ip)
    .bind(geraet.seat_role.as_str())
    .bind(geraet.status.as_str())
    .bind(&geraet.seat_cert)
    .bind(&geraet.cluster_id)
    .bind(geraet.last_seen.map(|t| t.to_rfc3339()))
    .bind(geraet.created_at.to_rfc3339())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn list_geraete(pool: &SqlitePool, cluster_id: &str) -> Result<Vec<Geraet>, AppError> {
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
                seat_role, geraet_status, seat_cert, last_seen_at, created_at
         FROM sync_device WHERE cluster_id = ?1 ORDER BY created_at",
    )
    .bind(cluster_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    rows.into_iter()
        .map(|r| parse_geraet_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .collect()
}

pub async fn set_geraet_status(
    pool: &SqlitePool,
    fingerprint: &str,
    status: GeraetStatus,
) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query("UPDATE sync_device SET geraet_status = ?1 WHERE fingerprint = ?2")
        .bind(status.as_str())
        .bind(fingerprint)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn is_blocklisted(pool: &SqlitePool, fingerprint: &str) -> Result<bool, AppError> {
    ensure(pool).await?;
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM geraet_blocklist WHERE fingerprint = ?1")
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
        "INSERT INTO geraet_blocklist (fingerprint, reason, blocked_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(fingerprint) DO UPDATE SET reason = excluded.reason, blocked_at = excluded.blocked_at",
    )
    .bind(fingerprint)
    .bind(reason)
    .bind(now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    set_geraet_status(pool, fingerprint, GeraetStatus::Blocked).await?;
    Ok(())
}

pub async fn unblock_fingerprint(pool: &SqlitePool, fingerprint: &str) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query("DELETE FROM geraet_blocklist WHERE fingerprint = ?1")
        .bind(fingerprint)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn create_kopplung_session(
    pool: &SqlitePool,
    session: &KopplungSession,
) -> Result<(), AppError> {
    ensure(pool).await?;
    sqlx::query(
        "INSERT INTO pairing_request (
            id, device_id, slave_pubkey, slave_label, requester_ip, status,
            kopplung_state, sas_hash, requested_role, expires_at, fingerprint, hostname, requested_at
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

pub async fn find_active_device_by_hostname(
    pool: &SqlitePool,
    cluster_id: &str,
    hostname: &str,
) -> Result<Option<Geraet>, AppError> {
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
                seat_role, geraet_status, seat_cert, last_seen_at, created_at
         FROM sync_device
         WHERE cluster_id = ?1
           AND hostname = ?2
           AND geraet_status = 'ACTIVE'
           AND fingerprint IS NOT NULL AND TRIM(fingerprint) != ''
           AND pubkey IS NOT NULL AND length(pubkey) = 32
         LIMIT 1",
    )
    .bind(cluster_id)
    .bind(hostname)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| parse_geraet_row(r.0, r.1, r.2, r.3, r.4, r.5, r.6, r.7, r.8, r.9, r.10, r.11))
        .transpose()
}

pub async fn load_kopplung_session(
    pool: &SqlitePool,
    id: &str,
) -> Result<Option<KopplungSession>, AppError> {
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
        "SELECT id, fingerprint, kopplung_state, sas_hash, requested_role, expires_at, hostname, requested_at
         FROM pairing_request WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    row.map(|r| {
        Ok(KopplungSession {
            id: r.0,
            fingerprint: r.1.unwrap_or_default(),
            state: r
                .2
                .as_deref()
                .and_then(KopplungStatus::parse)
                .unwrap_or(KopplungStatus::JoinRequested),
            sas_hash: r.3,
            requested_role: r
                .4
                .as_deref()
                .and_then(SeatRolle::parse)
                .unwrap_or(SeatRolle::Member),
            hostname: r.6,
            expires_at: r
                .5
                .unwrap_or_default()
                .parse()
                .map_err(|e: chrono::ParseError| {
                    AppError::Internal(format!("kopplung.expires_at: {e}"))
                })?,
            created_at: r.7.parse().map_err(|e: chrono::ParseError| {
                AppError::Internal(format!("kopplung.created_at: {e}"))
            })?,
        })
    })
    .transpose()
}

pub async fn update_kopplung_state(
    pool: &SqlitePool,
    id: &str,
    state: KopplungStatus,
    sas_hash: Option<&[u8]>,
) -> Result<(), AppError> {
    ensure(pool).await?;
    if let Some(hash) = sas_hash {
        sqlx::query("UPDATE pairing_request SET kopplung_state = ?1, sas_hash = ?2 WHERE id = ?3")
            .bind(state.as_str())
            .bind(hash)
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    } else {
        sqlx::query("UPDATE pairing_request SET kopplung_state = ?1 WHERE id = ?2")
            .bind(state.as_str())
            .bind(id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

pub async fn list_pending_kopplung(
    pool: &SqlitePool,
    _cluster_id: &str,
) -> Result<Vec<KopplungSession>, AppError> {
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
        "SELECT id, fingerprint, kopplung_state, sas_hash, requested_role, expires_at, hostname, requested_at
         FROM pairing_request
         WHERE status = 'PENDING' AND kopplung_state IN ('JOIN_REQUESTED','AWAITING_SAS')
         ORDER BY requested_at",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    rows.into_iter()
        .map(|r| {
            Ok(KopplungSession {
                id: r.0,
                fingerprint: r.1.unwrap_or_default(),
                state: r
                    .2
                    .as_deref()
                    .and_then(KopplungStatus::parse)
                    .unwrap_or(KopplungStatus::JoinRequested),
                sas_hash: r.3,
                requested_role: r
                    .4
                    .as_deref()
                    .and_then(SeatRolle::parse)
                    .unwrap_or(SeatRolle::Member),
                hostname: r.6,
                expires_at: r
                    .5
                    .unwrap_or_default()
                    .parse()
                    .map_err(|e: chrono::ParseError| {
                        AppError::Internal(format!("kopplung.expires_at: {e}"))
                    })?,
                created_at: r.7.parse().map_err(|e: chrono::ParseError| {
                    AppError::Internal(format!("kopplung.created_at: {e}"))
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
            "Gerät bereits provisioniert (einmalig)".into(),
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
