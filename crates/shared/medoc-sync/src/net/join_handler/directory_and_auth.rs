//! Cluster status, staff directory and replica-auth requests.

use super::*;

pub(super) async fn handle_cluster_status_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    cluster_id: &str,
) -> Result<(), AppError> {
    let pending = load_pending_reset(pool).await?;
    let response = if let Some(p) = pending {
        WireMessage::ClusterStatusResponse {
            reset_pending: true,
            token_json: Some(p.token_json),
            signature_b64: Some(p.signature_b64),
        }
    } else {
        WireMessage::ClusterStatusResponse {
            reset_pending: false,
            token_json: None,
            signature_b64: None,
        }
    };
    let _ = cluster_id;
    send_wire_message(stream, transport, &response).await?;
    Ok(())
}

pub(super) async fn handle_staff_directory_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<(), AppError> {
    let allowed = staff_directory_request_allowed(pool, fingerprint, session_id).await?;
    if !allowed {
        tracing::warn!(
            target: "medoc::cluster",
            event = "STAFF_DENIED",
            fingerprint = %fingerprint.trim(),
            session_id = %session_id.trim()
        );
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "STAFF_DENIED".into(),
                message: "Device not authorised for staff directory.".into(),
            },
        )
        .await?;
        return Ok(());
    }

    let directory_json = export_staff_directory_json(pool).await?;
    send_wire_message(
        stream,
        transport,
        &WireMessage::StaffDirectoryResponse { directory_json },
    )
    .await?;
    Ok(())
}

pub(super) async fn handle_replica_auth_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<(), AppError> {
    let allowed = staff_directory_request_allowed(pool, fingerprint, session_id).await?;
    if !allowed {
        tracing::warn!(
            target: "medoc::cluster",
            event = "REPLICA_AUTH_DENIED",
            fingerprint = %fingerprint.trim(),
            session_id = %session_id.trim()
        );
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "STAFF_DENIED".into(),
                message: "Device not authorised for replica auth.".into(),
            },
        )
        .await?;
        return Ok(());
    }
    match issue_replica_lan_auth(pool, fingerprint, session_id).await {
        Ok(lan) => {
            send_wire_message(
                stream,
                transport,
                &WireMessage::JoinAccept {
                    session_id: session_id.trim().to_string(),
                    activation_token: lan.activation_token,
                    master_pubkey: lan.master_pubkey,
                    master_device_id: lan.master_device_id,
                    master_cert_sha256: lan.master_cert_sha256,
                    master_http_port: lan.master_http_port,
                },
            )
            .await?;
        }
        Err(e) => {
            tracing::warn!(
                target: "medoc::cluster",
                event = "REPLICA_AUTH_FAILED",
                error = %e
            );
            send_wire_message(
                stream,
                transport,
                &WireMessage::Error {
                    code: "AUTH_FAILED".into(),
                    message: e.to_string(),
                },
            )
            .await?;
        }
    }
    Ok(())
}

pub(super) async fn staff_directory_request_allowed(
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<bool, AppError> {
    // Callers have already verified that the peer owns the key behind `fp`.
    // A session id alone is not a credential: it used to unlock the staff
    // directory for any session row, including requests the admin never
    // accepted or explicitly rejected.
    let fp = fingerprint.trim();
    let sid = session_id.trim();
    if fp.is_empty() {
        return Ok(false);
    }
    if crate::cluster::services::is_fingerprint_blocklisted(pool, fp).await? {
        return Ok(false);
    }
    if !sid.is_empty() {
        let by_session: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pairing_request
             WHERE id = ?1 AND status = 'ACCEPTED'
               AND (TRIM(fingerprint) = ?2 OR TRIM(device_id) = ?2)",
        )
        .bind(sid)
        .bind(fp)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if by_session > 0 {
            return Ok(true);
        }
    }
    let device: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_device
         WHERE TRIM(fingerprint) = ?1
           AND device_status = 'ACTIVE'",
    )
    .bind(fp)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if device > 0 {
        return Ok(true);
    }
    let session: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pairing_request
         WHERE status = 'ACCEPTED'
           AND (TRIM(fingerprint) = ?1 OR TRIM(device_id) = ?1)",
    )
    .bind(fp)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(session > 0)
}
