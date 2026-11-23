use std::time::Duration;

use medoc_core::error::AppError;
use medoc_core::infrastructure::database::sync_registry::{
    class_of, queue_of, synced_tables, SyncClass,
};
use serde::Deserialize;
use sqlx::SqlitePool;

use crate::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use crate::merge::{apply_remote_entry_phased, ConflictPolicy};
use crate::repo::{
    bump_deferred_pull, clear_pull_failure, ensure_local_device, list_deferred_pulls,
    list_entries_since, list_pending_outbox_for_peer, list_pending_outbox_tables, load_deployment,
    load_row_payload_json, mark_outbox_failed, mark_outbox_ids_delivered, mark_peer_delivery,
    record_pull_failure, save_deferred_pull, save_deployment, set_observed_seq, status_snapshot,
    SyncStatusSnapshot,
};

/// Failed pull rows are retried on later cycles. After this many failures the
/// cursor moves past the row so one bad entry cannot stall every newer change.
pub const PULL_ROW_RETRY_LIMIT: i64 = 8;

fn tables_for_queue(queue: &str, member_only: bool) -> Vec<&'static str> {
    synced_tables()
        .filter(|table| queue_of(table) == queue)
        .filter(|table| {
            !member_only
                || matches!(
                    class_of(table),
                    Some(SyncClass::Shared | SyncClass::Numbered | SyncClass::Files)
                )
        })
        .collect()
}

const PUSH_PAGE_LIMIT: i64 = 500;
const PUSH_MAX_PAGES: usize = 10;
const PUSH_MAX_BYTES: usize = 12 * 1024 * 1024;

use super::types::{
    MeshSyncReport, ReplicaPullPage, SyncExchangePage, SyncPullResult, SyncPushResult,
    SyncRunReport,
};
use medoc_core::infrastructure::database::sqlite_error::is_foreign_key_error;

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct MeshPeerInfo {
    device_id: String,
    #[serde(default)]
    peer_base_url: Option<String>,
}

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SignedMeshPeerEntry {
    device_id: String,
    slave_label: String,
    slave_pubkey: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    peer_base_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MeshPeerListResponse {
    master_device_id: String,
    #[serde(default)]
    peers: Vec<SignedMeshPeerEntry>,
    signature: String,
}

pub struct SyncEngine;

impl SyncEngine {
    pub async fn status(pool: &SqlitePool) -> Result<SyncStatusSnapshot, AppError> {
        let mut snap = status_snapshot(pool).await?;
        snap.initial_copy = super::initial_copy::status_for(pool, &snap.deployment).await?;
        Ok(snap)
    }

    /// Ingest remote outbox batch (master or replica receiving peer push).
    pub async fn ingest_push(
        pool: &SqlitePool,
        from_device_id: &str,
        entries: &[crate::repo::OutboxEntry],
    ) -> Result<SyncPushResult, AppError> {
        let deployment = load_deployment(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        let local_is_master = deployment.role == DeviceRole::Master || local_id == from_device_id;
        // Replicas pull this device's outbox only. A change that arrived from
        // another replica has to be copied onto that outbox or it never
        // leaves this device. The copied payload is the row as stored here,
        // so a stale push forwards the newer local row rather than the body
        // that was rejected.
        let relay = deployment.role == DeviceRole::Master && from_device_id != local_id;
        // A replica serving an exchange receives the main device's own queue.
        // Those rows carry the main device's authority (the same as a pull):
        // access-control rows are accepted from it and from nobody else.
        let from_main = deployment.role == DeviceRole::Replica
            && !deployment.master_device_id.trim().is_empty()
            && from_device_id == deployment.master_device_id.trim();
        let mut accepted = 0u32;
        let mut last_seq = 0i64;
        for source in entries {
            if source.device_id != from_device_id {
                return Err(AppError::Validation("sync push device_id mismatch".into()));
            }
            let mut entry = source.clone();
            if local_is_master && entry.device_id != local_id {
                let local_ts =
                    crate::merge::local_row_updated_at(pool, &entry.entity_table, &entry.entity_id)
                        .await
                        .ok()
                        .flatten();
                entry.payload_json = crate::merge::clamp_future_updated_at(
                    &entry.payload_json,
                    chrono::Utc::now(),
                    local_ts,
                );
                entry.payload_json = crate::merge::clamp_future_hlc(
                    &entry.payload_json,
                    chrono::Utc::now().timestamp_millis(),
                );
            }
            let applied = match crate::merge::apply_remote_entry_defer_mark(
                pool,
                &local_id,
                local_is_master,
                from_main,
                ConflictPolicy::LastWriteWins,
                &entry,
            )
            .await
            {
                Ok(applied) => {
                    clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    applied
                }
                Err(e) => {
                    let attempts = record_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "PUSH_ENTRY_FAILED",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        op = %entry.op,
                        seq = entry.seq,
                        attempts,
                        error = %e
                    );
                    if attempts >= PULL_ROW_RETRY_LIMIT {
                        tracing::warn!(
                            target: "medoc::sync",
                            event = "PUSH_ENTRY_GAVE_UP",
                            table = %entry.entity_table,
                            id = %entry.entity_id,
                            seq = entry.seq,
                            attempts
                        );
                        clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                        // Kept, with its payload, on the sync problems list.
                        crate::problems::record_incoming(
                            pool,
                            &entry,
                            crate::problems::kind::GAVE_UP,
                            from_main,
                            &e.to_string(),
                        )
                        .await;
                        // Quarantine this seq so the sender can move past it.
                        last_seq = entry.seq;
                        continue;
                    }
                    // Keep order. Entries after this one stay pending.
                    break;
                }
            };
            if applied {
                let payload = if relay {
                    Some(relay_payload(pool, &entry).await?)
                } else {
                    None
                };
                mark_applied_with_relay(pool, &local_id, &entry, payload.as_deref()).await?;
                if let Err(e) =
                    crate::watch::note_remote_applied(pool, &entry.entity_table, &entry.entity_id)
                        .await
                {
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "SHARED_SYNC_SEEN_FAILED",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        error = %e
                    );
                }
                accepted += 1;
            }
            last_seq = entry.seq;
        }
        Ok(SyncPushResult { accepted, last_seq })
    }

    /// Return entries from `device_id` newer than `since_seq` (pull API).
    pub async fn collect_pull(
        pool: &SqlitePool,
        device_id: &str,
        since_seq: i64,
    ) -> Result<Vec<crate::repo::OutboxEntry>, AppError> {
        list_entries_since(pool, device_id, since_seq).await
    }

    /// First replica pull (`since_seq = 0`) queues one full row snapshot, then
    /// returns packages from **this node's** outbox. The replica-supplied
    /// `device_id` is ignored: independently seeded replicas never know the
    /// master's local outbox id, so serving by that id returned an empty pull.
    ///
    /// A brand-new requester also gets `initial_copy` so both devices can show
    /// how far that snapshot has been handed over. Later pulls with a cursor
    /// only update that span; they do not queue another snapshot.
    pub async fn collect_pull_for_replica(
        pool: &SqlitePool,
        device_id: &str,
        since_seq: i64,
        live_since_seq: i64,
    ) -> Result<ReplicaPullPage, AppError> {
        let deployment = load_deployment(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        // Rows below this replica's cursor were pruned: it cannot catch up
        // from the outbox, so it receives a fresh copy, merged with normal
        // conflict rules (nothing is cleared on an established replica).
        let floor = crate::repo::pruned_through(pool).await;
        let since_seq = if since_seq > 0 && since_seq < floor {
            tracing::warn!(
                target: "medoc::sync",
                event = "SYNC_REPLICA_BEHIND_PRUNED_OUTBOX",
                device_id = %device_id,
                since_seq,
                pruned_through = floor
            );
            0
        } else {
            since_seq
        };
        if since_seq > 0 {
            // The replica asks for rows after `since_seq`: it holds everything
            // up to it. That is the cursor outbox pruning waits for.
            mark_peer_delivery(pool, &local_id, device_id, since_seq).await?;
        }
        let initial_copy =
            super::initial_copy::note_master_pull(pool, device_id, since_seq, &local_id).await?;
        // Copy rows queued for another joining device are skipped.
        let mut entries =
            crate::repo::list_entries_since_for(pool, &local_id, since_seq, Some(device_id))
                .await?;
        let live = match &initial_copy {
            Some(span) if since_seq < span.end_seq => {
                // The snapshot page is capped at its end so a newer edit
                // cannot advance the cursor past rows that are not copied yet.
                entries.retain(|entry| entry.seq <= span.end_seq);
                let after = span.end_seq.max(live_since_seq);
                crate::repo::list_entries_since_for(pool, &local_id, after, Some(device_id)).await?
            }
            _ => Vec::new(),
        };
        crate::repo::maybe_prune_outbox(pool).await;
        Ok(ReplicaPullPage {
            entries,
            initial_copy,
            live,
        })
    }

    /// Replica: push pending local outbox to master over HTTPS.
    pub async fn push_to_master(pool: &SqlitePool) -> Result<SyncPushResult, AppError> {
        Self::push_queues(pool, None).await
    }

    /// Push one page queue, or every queue when `only` is `None`.
    ///
    /// Each queue is its own request: a 400 on one leaves the others free. Accepted rows are
    /// marked by id, so an undelivered row in another queue is not treated as delivered.
    pub async fn push_queues(
        pool: &SqlitePool,
        only: Option<&[String]>,
    ) -> Result<SyncPushResult, AppError> {
        let deployment = load_deployment(pool).await?;
        if deployment.mode != DeploymentMode::ServerlessPeer {
            return Err(AppError::Validation(
                "sync push requires serverless_peer mode".into(),
            ));
        }
        if deployment.role != DeviceRole::Replica {
            return Err(AppError::Validation(
                "sync push to master requires REPLICA role".into(),
            ));
        }
        if deployment.master_base_url.is_empty() {
            return Err(AppError::Validation("master_base_url missing".into()));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let local_id = align_local_id_to_activation(pool, &deployment).await?;
        let client = master_http_client(pool, &deployment).await?;
        let url = crate::paths::api_url(&deployment.master_base_url, crate::paths::SYNC_PUSH);
        let mut accepted = 0u32;
        let mut last_seq = 0i64;
        requeue_blob_rows_with_bytes(pool).await?;
        let member_only = super::initial_copy::replica_initial_copy_blocks_catchup(pool)
            .await
            .unwrap_or(false);
        let mut queues: Vec<&str> = synced_tables().map(queue_of).collect();
        queues.sort_unstable();
        queues.dedup();
        if let Some(only) = only {
            queues.retain(|queue| only.iter().any(|want| want == *queue));
        }
        for queue in queues {
            let tables = tables_for_queue(queue, member_only);
            for _ in 0..PUSH_MAX_PAGES {
                let pending =
                    list_pending_outbox_tables(pool, &local_id, &tables, PUSH_PAGE_LIMIT).await?;
                if pending.is_empty() {
                    break;
                }
                let mut page: Vec<crate::repo::OutboxEntry> = Vec::new();
                for entry in pending {
                    let entry_bytes = serde_json::to_vec(&entry).unwrap_or_default();
                    if entry_bytes.len() > PUSH_MAX_BYTES {
                        tracing::error!(
                            target: "medoc::sync",
                            event = "ENTRY_TOO_LARGE",
                            id = %entry.id,
                            seq = entry.seq,
                            bytes = entry_bytes.len()
                        );
                        mark_outbox_failed(pool, &entry.id, "ENTRY_TOO_LARGE").await?;
                        continue;
                    }
                    let candidate: Vec<&crate::repo::OutboxEntry> =
                        page.iter().chain(std::iter::once(&entry)).collect();
                    let page_bytes = serde_json::to_vec(&candidate).unwrap_or_default().len();
                    if !page.is_empty() && page_bytes > PUSH_MAX_BYTES {
                        break;
                    }
                    page.push(entry);
                }
                if page.is_empty() {
                    break;
                }
                let blobs = put_attachment_blobs(
                    &client,
                    &deployment.master_base_url,
                    &bearer_token,
                    pool,
                    &page,
                )
                .await;
                for id in &blobs.gave_up {
                    mark_outbox_failed(pool, id, "BLOB_MISSING").await?;
                }
                let ready = page_ready_to_send(&page, &blobs.held, &blobs.gave_up);
                if ready.is_empty() {
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "SYNC_BLOB_PUT_HELD",
                        queue,
                        held = blobs.held.len(),
                        gave_up = blobs.gave_up.len()
                    );
                    break;
                }
                let page = ready;
                let page_last = page.last().map(|e| e.seq).unwrap_or(0);
                let body = crate::entry_signature::signed_body(&local_id, "entries", &page);
                let resp = client
                    .post(&url)
                    .bearer_auth(&bearer_token)
                    .json(&body)
                    .send()
                    .await
                    .map_err(|e| crate::outbound_http_log::send_failed("sync push", &e))?;
                let status = resp.status();
                if status.as_u16() == 401 || status.as_u16() == 403 {
                    return Err(http_status_error("sync push", resp).await);
                }
                if !status.is_success() {
                    let err = http_status_error("sync push", resp).await;
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "QUEUE_PUSH_DEFERRED",
                        queue,
                        error = %err
                    );
                    break;
                }
                crate::durable_queue::confirm_send(crate::durable_queue::SendChannel::Push);
                let result: SyncPushResult = resp
                    .json()
                    .await
                    .map_err(|e| AppError::Internal(format!("sync push decode: {e}")))?;
                let through = result.last_seq;
                if through > 0 {
                    let ids: Vec<String> = page
                        .iter()
                        .filter(|entry| entry.seq <= through)
                        .map(|entry| entry.id.clone())
                        .collect();
                    mark_outbox_ids_delivered(pool, &ids).await?;
                }
                accepted = accepted.saturating_add(result.accepted);
                last_seq = last_seq.max(through);
                if through < page_last {
                    break;
                }
            }
        }
        Ok(SyncPushResult { accepted, last_seq })
    }

    /// Add one local change to this device's packet queue.
    ///
    /// Works on the main device and on a replica. The next exchange sends it.
    pub async fn enqueue_update_packet(
        pool: &SqlitePool,
        entity_table: &str,
        entity_id: &str,
        op: &str,
        payload_json: &str,
    ) -> Result<crate::repo::OutboxEntry, AppError> {
        crate::repo::enqueue_update_packet(pool, entity_table, entity_id, op, payload_json).await
    }

    /// Apply the caller's packets and return this device's own pending packets.
    ///
    /// `ack_through_seq` is the caller's high-water mark for this device's
    /// queue. Packets at or below it are not sent again.
    pub async fn serve_exchange(
        pool: &SqlitePool,
        from_device_id: &str,
        packets: &[crate::repo::OutboxEntry],
        ack_through_seq: i64,
        queues: &[String],
    ) -> Result<SyncExchangePage, AppError> {
        let from_device_id = from_device_id.trim();
        if from_device_id.is_empty() {
            return Err(AppError::Validation(
                "sync exchange requires fromDeviceId".into(),
            ));
        }
        let deployment = load_deployment(pool).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        if ack_through_seq > 0 {
            // A queue-filtered exchange acknowledges only those queues.
            crate::repo::mark_peer_delivery_for_queues(
                pool,
                &local_id,
                from_device_id,
                queues,
                ack_through_seq,
            )
            .await?;
        }
        let pushed = if packets.is_empty() {
            SyncPushResult {
                accepted: 0,
                last_seq: 0,
            }
        } else {
            Self::ingest_push(pool, from_device_id, packets).await?
        };
        if pushed.last_seq > 0 {
            // Next time this device dials the caller, it acknowledges these.
            crate::repo::note_received(pool, from_device_id, &local_id, queues, pushed.last_seq)
                .await?;
        }
        let outgoing =
            crate::repo::list_exchange_packets(pool, &local_id, from_device_id, queues, 500)
                .await?;
        crate::repo::maybe_prune_outbox(pool).await;
        Ok(SyncExchangePage {
            accepted: pushed.accepted,
            last_seq: pushed.last_seq,
            packets: outgoing,
        })
    }

    /// Send this device's packet queue to each peer and apply the packets that
    /// come back. The main device calls every joined replica it can reach. A
    /// replica calls the main device.
    pub async fn exchange_packets(
        pool: &SqlitePool,
        queues: Option<&[String]>,
    ) -> Result<SyncRunReport, AppError> {
        let deployment = load_deployment(pool).await?;
        let local_id = if deployment.role == DeviceRole::Replica {
            align_local_id_to_activation(pool, &deployment).await?
        } else {
            ensure_local_device(pool, &deployment.device_label).await?
        };
        let plan = exchange_targets(pool, &deployment, &local_id).await?;
        let queues = queues.unwrap_or(&[]);
        let mut accepted = 0u32;
        let mut last_seq = 0i64;
        let mut applied = 0u32;
        let mut skipped = 0u32;
        let mut errors = plan.errors;
        for target in plan.targets {
            match exchange_one(pool, &deployment, &local_id, &target, queues).await {
                Ok(one) => {
                    accepted = accepted.saturating_add(one.accepted);
                    last_seq = last_seq.max(one.last_seq);
                    applied = applied.saturating_add(one.applied);
                    skipped = skipped.saturating_add(one.skipped);
                }
                Err(e) => errors.push(format!("{}: {e}", target.device_id)),
            }
        }
        Ok(SyncRunReport {
            push: Some(SyncPushResult { accepted, last_seq }),
            pull: Some(SyncPullResult { applied, skipped }),
            mesh: None,
            error: if errors.is_empty() {
                None
            } else {
                Some(errors.join("; "))
            },
        })
    }

    /// Replica: pull master changes since last known vector.
    pub async fn pull_from_master(pool: &SqlitePool) -> Result<SyncPullResult, AppError> {
        let deployment = load_deployment(pool).await?;
        if deployment.mode != DeploymentMode::ServerlessPeer
            || deployment.role != DeviceRole::Replica
        {
            return Err(AppError::Validation(
                "sync pull requires serverless_peer REPLICA".into(),
            ));
        }
        if deployment.master_base_url.is_empty() {
            return Err(AppError::Validation("master_base_url missing".into()));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let vectors = crate::repo::all_vectors(pool).await?;
        let local_id = align_local_id_to_activation(pool, &deployment).await?;
        let master_device_id = resolve_master_device_id(pool, &deployment)
            .await
            .unwrap_or_default();
        let since_seq = if master_device_id.is_empty() {
            0
        } else {
            vectors.get(&master_device_id).copied().unwrap_or(0)
        };
        let client = master_http_client(pool, &deployment).await?;
        let url = crate::paths::api_url(&deployment.master_base_url, crate::paths::SYNC_PULL);
        let live_since = super::initial_copy::live_seq(pool).await.unwrap_or(0);
        let body = serde_json::json!({
            "deviceId": master_device_id,
            "sinceSeq": since_seq,
            "requesterId": local_id,
            "liveSinceSeq": live_since,
        });
        let resp = client
            .post(&url)
            .bearer_auth(&bearer_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| crate::outbound_http_log::send_failed("sync pull", &e))?;
        if !resp.status().is_success() {
            return Err(http_status_error("sync pull", resp).await);
        }
        let pulled: ReplicaPullPage = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("sync pull decode: {e}")))?;
        let copying = pulled.initial_copy.is_some()
            && super::initial_copy::should_skip_push(pool)
                .await
                .unwrap_or(false);
        if copying {
            super::initial_copy::clear_practice_once(pool).await?;
        } else if since_seq <= 0 {
            // Independent year seeds use the same `seed-yr-apt-*` ids with
            // different rows. LWW then keeps the replica's calendar. Drop
            // local seed appointments so the master's snapshot is the source.
            // Once: an unresolved main-device id kept the cursor at 0 and
            // repeated this on every pull.
            const SEED_DROPPED: &str = "sync.seed_appointments_dropped.v1";
            let done =
                medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, SEED_DROPPED)
                    .await
                    .ok()
                    .flatten()
                    .is_some();
            if !done {
                let _ = sqlx::query("DELETE FROM appointment WHERE id LIKE 'seed-yr-apt-%'")
                    .execute(pool)
                    .await;
                let _ = medoc_core::infrastructure::database::repos::admin::app_kv::set(
                    pool,
                    SEED_DROPPED,
                    "1",
                )
                .await;
            }
        }
        let live_page = apply_pulled_entries(pool, &local_id, &pulled.live).await?;
        if let Some((_, seq)) = &live_page.cursor {
            super::initial_copy::save_live_seq(pool, *seq).await?;
        }
        let snapshot_page = apply_pulled_entries(pool, &local_id, &pulled.entries).await?;
        let mut applied = live_page.applied.saturating_add(snapshot_page.applied);
        let skipped = live_page.skipped.saturating_add(snapshot_page.skipped);
        let cursor = snapshot_page.cursor;
        let page_moved = !pulled.entries.is_empty() || !pulled.live.is_empty();
        match retry_deferred_pulls(pool, &local_id, page_moved).await {
            Ok(n) => applied += n,
            Err(e) => tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_PULL_DEFER_RETRY_FAILED",
                error = %e
            ),
        }
        let applied_through = cursor.as_ref().map(|(_, seq)| *seq).unwrap_or(since_seq);
        if let Some((device_id, seq)) = cursor {
            set_observed_seq(pool, &device_id, seq).await?;
        }
        if let Some(span) = &pulled.initial_copy {
            super::initial_copy::record_replica_progress(pool, span, applied_through).await?;
        }
        // Live rows (edits made on the main device during the first copy)
        // can reference attachments too.
        let mut with_files = pulled.entries.clone();
        with_files.extend(pulled.live.iter().cloned());
        fetch_attachment_blobs(
            &client,
            &deployment.master_base_url,
            &bearer_token,
            pool,
            &with_files,
        )
        .await;
        Ok(SyncPullResult { applied, skipped })
    }

    /// Per-peer delivery is tracked in `sync_peer_vector` so repeated mesh
    /// cycles do not re-push the same seq to the same peer.
    pub async fn run_mesh_sync(pool: &SqlitePool) -> Result<MeshSyncReport, AppError> {
        let deployment = load_deployment(pool).await?;
        if !deployment.unstable_mesh {
            return Ok(MeshSyncReport {
                attempted: 0,
                succeeded: 0,
                errors: vec!["unstable_mesh flag is OFF".into()],
            });
        }
        if deployment.mode != DeploymentMode::ServerlessPeer
            || deployment.role != DeviceRole::Replica
        {
            return Err(AppError::Validation(
                "mesh sync requires serverless_peer REPLICA".into(),
            ));
        }
        let bearer_token = pick_bearer(&deployment)?;
        let peers = fetch_peer_list(pool, &deployment, &bearer_token).await?;
        let local_id = ensure_local_device(pool, &deployment.device_label).await?;
        requeue_blob_rows_with_bytes(pool).await?;
        let mut report = MeshSyncReport::default();
        if peers.is_empty() {
            return Ok(report);
        }
        for peer in peers {
            if peer.device_id == local_id {
                continue;
            }
            report.attempted += 1;
            let Some(base) = peer.peer_base_url.as_deref().filter(|s| !s.is_empty()) else {
                report.errors.push(format!(
                    "peer {} skipped: no peer_base_url advertised",
                    peer.device_id
                ));
                continue;
            };
            let pending = list_pending_outbox_for_peer(pool, &local_id, &peer.device_id).await?;
            if pending.is_empty() {
                report.succeeded += 1;
                continue;
            }
            match push_to_peer(
                pool,
                base,
                &bearer_token,
                &local_id,
                &peer.device_id,
                &pending,
            )
            .await
            {
                Ok(_) => report.succeeded += 1,
                Err(e) => report.errors.push(format!("peer {}: {e}", peer.device_id)),
            }
        }
        Ok(report)
    }

    /// Bidirectional sync for serverless replica.
    ///
    /// Product order (C8): **push** member changes (LWW merge on master), then
    /// **pull** admin authoritative rows onto the replica (`admin_pull` phase).
    pub async fn run_replica_sync(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
        let mut report = SyncRunReport {
            push: None,
            pull: None,
            mesh: None,
            error: None,
        };
        let skip_push = super::initial_copy::should_skip_push(pool)
            .await
            .unwrap_or(false);
        if !skip_push {
            match Self::push_to_master(pool).await {
                Ok(push) => report.push = Some(push),
                Err(e) => report.error = Some(format!("push: {e}")),
            }
        }
        match Self::pull_from_master(pool).await {
            Ok(pull) => report.pull = Some(pull),
            Err(e) => {
                let msg = format!("pull: {e}");
                report.error = Some(match report.error {
                    Some(prev) => format!("{prev}; {msg}"),
                    None => msg,
                });
            }
        }
        let deployment = load_deployment(pool).await?;
        if deployment.unstable_mesh {
            match Self::run_mesh_sync(pool).await {
                Ok(mesh) => {
                    if !mesh.errors.is_empty() {
                        let msg = format!("mesh: {}", mesh.errors.join("; "));
                        report.error = Some(match report.error {
                            Some(prev) => format!("{prev}; {msg}"),
                            None => msg,
                        });
                    }
                    report.mesh = Some(mesh);
                }
                Err(e) => {
                    let msg = format!("mesh: {e}");
                    report.error = Some(match report.error {
                        Some(prev) => format!("{prev}; {msg}"),
                        None => msg,
                    });
                }
            }
        }
        let pulled = report
            .pull
            .as_ref()
            .map(|p| p.applied.saturating_add(p.skipped))
            .unwrap_or(0);
        crate::repo::maybe_prune_outbox(pool).await;
        if let Err(e) = crate::reconcile::maybe_hourly(pool, pulled, report.error.as_deref()).await
        {
            tracing::warn!(
                target: "medoc::sync",
                event = "RECONCILE_HOURLY_FAILED",
                error = %e
            );
        }
        Ok(report)
    }

    /// Repeat push/pull until a pull returns fewer than one outbox page (initial catch-up).
    pub async fn run_replica_sync_until_caught_up(
        pool: &SqlitePool,
    ) -> Result<SyncRunReport, AppError> {
        let mut last = SyncRunReport {
            push: None,
            pull: None,
            mesh: None,
            error: None,
        };
        for _ in 0..256 {
            last = Self::run_replica_sync(pool).await?;
            let pulled = last
                .pull
                .as_ref()
                .map(|p| p.applied.saturating_add(p.skipped))
                .unwrap_or(0);
            if pulled < 500 {
                break;
            }
        }
        Ok(last)
    }

    pub async fn set_deployment(
        pool: &SqlitePool,
        cfg: crate::deployment::SyncDeploymentConfig,
    ) -> Result<(), AppError> {
        save_deployment(pool, &cfg).await?;
        let local_id = align_local_id_to_activation(pool, &cfg).await?;
        let display = if cfg.device_label.is_empty() {
            "This device"
        } else {
            cfg.device_label.as_str()
        };
        let (peer_url, peer_cert) = if cfg.role == DeviceRole::Replica {
            (
                (!cfg.master_base_url.is_empty()).then_some(cfg.master_base_url.as_str()),
                (!cfg.master_cert_sha256.is_empty()).then_some(cfg.master_cert_sha256.as_str()),
            )
        } else {
            (None, None)
        };
        crate::repo::register_local_device(pool, &local_id, display, cfg.role, peer_url, peer_cert)
            .await?;
        Ok(())
    }
}

async fn find_master_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    let id: Option<String> = sqlx::query_scalar(
        "SELECT device_id FROM sync_device WHERE role = 'MASTER' AND is_local = 0 LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    if let Some(id) = id {
        return Ok(id);
    }
    let local: String = sqlx::query_scalar(
        "SELECT device_id FROM sync_device WHERE role = 'MASTER' AND is_local = 1 LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .ok_or_else(|| AppError::Validation("no master device registered".into()))?;
    Ok(local)
}

/// Prefer the deployment's `master_device_id` (set during pairing). Falls
/// back to the sync_device registry when the id is missing.
struct PulledPage {
    applied: u32,
    skipped: u32,
    cursor: Option<(String, i64)>,
}

/// Apply one pull page. The cursor is the last seq before a row that is
/// still inside the retry limit, so a later parent can arrive and the
/// child is tried again. Foreign-key misses are deferred and do not hold
/// the cursor: the parent may be further down the snapshot.
async fn apply_pulled_entries(
    pool: &SqlitePool,
    local_id: &str,
    entries: &[crate::repo::OutboxEntry],
) -> Result<PulledPage, AppError> {
    let mut applied = 0u32;
    let mut skipped = 0u32;
    let mut cursor: Option<(String, i64)> = None;
    let mut blocked = false;
    for entry in entries {
        match apply_remote_entry_phased(
            pool,
            local_id,
            false,
            true,
            ConflictPolicy::LastWriteWins,
            entry,
        )
        .await
        {
            Ok(did_apply) => {
                if did_apply {
                    applied += 1;
                } else {
                    skipped += 1;
                }
                clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                if !blocked {
                    cursor = Some((entry.device_id.clone(), entry.seq));
                }
            }
            Err(e) => {
                skipped += 1;
                if is_foreign_key_error(&e) {
                    save_deferred_pull(pool, entry).await?;
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_PULL_ROW_DEFER",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        seq = entry.seq,
                        error = %e
                    );
                    if !blocked {
                        cursor = Some((entry.device_id.clone(), entry.seq));
                    }
                } else if is_unsynced_table_error(&e) {
                    // The table will never be in the allow-list. Retrying it
                    // holds the pull cursor and blocks the page behind it.
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_PULL_ROW_GAVE_UP",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        seq = entry.seq,
                        error = %e
                    );
                    clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    crate::problems::record_incoming(
                        pool,
                        entry,
                        crate::problems::kind::GAVE_UP,
                        true,
                        &e.to_string(),
                    )
                    .await;
                    if !blocked {
                        cursor = Some((entry.device_id.clone(), entry.seq));
                    }
                } else {
                    let attempts = record_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_PULL_ROW_SKIP",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        attempts,
                        error = %e
                    );
                    if attempts >= PULL_ROW_RETRY_LIMIT {
                        tracing::warn!(
                            target: "medoc::sync",
                            event = "REPLICA_PULL_ROW_GAVE_UP",
                            table = %entry.entity_table,
                            id = %entry.entity_id,
                            seq = entry.seq,
                            attempts
                        );
                        clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                        crate::problems::record_incoming(
                            pool,
                            entry,
                            crate::problems::kind::GAVE_UP,
                            true,
                            &e.to_string(),
                        )
                        .await;
                        if !blocked {
                            cursor = Some((entry.device_id.clone(), entry.seq));
                        }
                    } else {
                        blocked = true;
                    }
                }
            }
        }
    }
    Ok(PulledPage {
        applied,
        skipped,
        cursor,
    })
}

fn is_unsynced_table_error(err: &AppError) -> bool {
    match err {
        AppError::Validation(msg) => msg.contains("not allow-listed"),
        _ => false,
    }
}

/// Apply rows that missed a parent. While new pages are still arriving, a
/// failure does not count toward the give-up limit.
async fn retry_deferred_pulls(
    pool: &SqlitePool,
    local_id: &str,
    page_moved: bool,
) -> Result<u32, AppError> {
    let mut applied = 0u32;
    for entry in list_deferred_pulls(pool).await? {
        match apply_remote_entry_phased(
            pool,
            local_id,
            false,
            true,
            ConflictPolicy::LastWriteWins,
            &entry,
        )
        .await
        {
            Ok(_) => {
                clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                applied += 1;
                tracing::info!(
                    target: "medoc::sync",
                    event = "REPLICA_PULL_ROW_DEFER_APPLIED",
                    table = %entry.entity_table,
                    id = %entry.entity_id,
                    seq = entry.seq
                );
            }
            Err(e) if is_foreign_key_error(&e) && page_moved => {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_PULL_ROW_DEFER",
                    table = %entry.entity_table,
                    id = %entry.entity_id,
                    seq = entry.seq,
                    error = %e
                );
            }
            Err(e) => {
                let attempts = bump_deferred_pull(pool, &entry.device_id, entry.seq).await?;
                tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_PULL_ROW_SKIP",
                    table = %entry.entity_table,
                    id = %entry.entity_id,
                    attempts,
                    error = %e
                );
                if attempts >= PULL_ROW_RETRY_LIMIT {
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_PULL_ROW_GAVE_UP",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        seq = entry.seq,
                        attempts
                    );
                    clear_pull_failure(pool, &entry.device_id, entry.seq).await?;
                    crate::problems::record_incoming(
                        pool,
                        &entry,
                        crate::problems::kind::GAVE_UP,
                        true,
                        &e.to_string(),
                    )
                    .await;
                }
            }
        }
    }
    Ok(applied)
}

async fn resolve_master_device_id(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<String, AppError> {
    if !deployment.master_device_id.is_empty() {
        return Ok(deployment.master_device_id.clone());
    }
    find_master_device_id(pool).await
}

/// Choose the Authorization bearer for replica → master calls. Prefers the
/// new activation token (Ed25519-signed by master); falls back to the
/// legacy JWT for installs paired before Slice 4.
/// `fromDeviceId` has to be the device id baked into the activation token.
/// Join can leave `sync.device_id.v1` as a later fingerprint while the token
/// still names the paired one; the master answers that push with 403.
async fn align_local_id_to_activation(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<String, AppError> {
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let Some(authorized) = verified_activation_device_id(deployment) else {
        return Ok(local_id);
    };
    if authorized == local_id {
        return Ok(local_id);
    }
    if !activation_names_this_install(pool, &authorized).await? {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_DEVICE_ID_TOKEN_NOT_THIS_INSTALL",
            local_id = %local_id,
            token_device_id = %authorized
        );
        return Ok(local_id);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "SYNC_DEVICE_ID_ALIGNED_TO_TOKEN",
        from = %local_id,
        to = %authorized
    );
    crate::repo::adopt_local_device_id(
        pool,
        &local_id,
        &authorized,
        &deployment.device_label,
        deployment.role,
    )
    .await?;
    Ok(authorized)
}

/// The activation token names this install when its device id is the loaded
/// cluster key, or the fingerprint this device presented when it joined.
/// A verified token alone is not enough: that would let a copied token rename
/// this install to someone else's device.
async fn activation_names_this_install(
    pool: &SqlitePool,
    authorized: &str,
) -> Result<bool, AppError> {
    let fingerprint = crate::cluster::crypto::DeviceIdentity::try_load()
        .ok()
        .flatten()
        .map(|identity| identity.fingerprint);
    if fingerprint.as_deref() == Some(authorized) {
        return Ok(true);
    }
    let joined: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pairing_request
         WHERE TRIM(fingerprint) = ?1 OR TRIM(device_id) = ?1",
    )
    .bind(authorized)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(joined > 0)
}

fn verified_activation_device_id(deployment: &SyncDeploymentConfig) -> Option<String> {
    let token = deployment.activation_token.trim();
    let pk = deployment.master_pubkey.trim();
    if token.is_empty() || pk.is_empty() {
        return None;
    }
    let key = crate::master_keys::parse_pubkey_b64(pk).ok()?;
    let payload = crate::pairing::verify_activation_token(token, &key).ok()?;
    let id = payload.device_id.trim();
    if id.is_empty() {
        None
    } else {
        Some(id.to_string())
    }
}

fn pick_bearer(deployment: &SyncDeploymentConfig) -> Result<String, AppError> {
    if !deployment.activation_token.is_empty() {
        return Ok(deployment.activation_token.clone());
    }
    if !deployment.master_access_token.is_empty() {
        return Ok(deployment.master_access_token.clone());
    }
    Err(AppError::Validation(
        "Replica not paired — complete the pairing flow".into(),
    ))
}

async fn relay_payload(
    pool: &SqlitePool,
    entry: &crate::repo::OutboxEntry,
) -> Result<String, AppError> {
    if entry.op == "DELETE" {
        return Ok(entry.payload_json.clone());
    }
    match load_row_payload_json(pool, &entry.entity_table, &entry.entity_id).await? {
        Some(json) => {
            crate::hlc::attach_row_hlc(pool, &entry.entity_table, &entry.entity_id, &json).await
        }
        None => Ok(entry.payload_json.clone()),
    }
}

const MISSING_BLOBS_KV: &str = "sync.missing_blobs.v1";
const BLOB_ATTEMPTS_KV: &str = "sync.blob_put_attempts.v1";

struct BlobPutOutcome {
    held: std::collections::HashSet<String>,
    gave_up: std::collections::HashSet<String>,
}

fn payload_sha256(payload_json: &str) -> Option<String> {
    let value: serde_json::Value = serde_json::from_str(payload_json).ok()?;
    value
        .get("sha256")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_ascii_lowercase())
}

async fn load_missing_blobs(pool: &SqlitePool) -> Vec<String> {
    let raw =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, MISSING_BLOBS_KV)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "[]".into());
    serde_json::from_str(&raw).unwrap_or_default()
}

async fn store_missing_blobs(pool: &SqlitePool, shas: &[String]) {
    let _ = medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        MISSING_BLOBS_KV,
        &serde_json::to_string(shas).unwrap_or_else(|_| "[]".into()),
    )
    .await;
}

async fn remember_missing_blob(pool: &SqlitePool, sha: &str) {
    let mut list = load_missing_blobs(pool).await;
    if !list.iter().any(|s| s == sha) {
        list.push(sha.to_string());
        store_missing_blobs(pool, &list).await;
    }
}

async fn forget_missing_blob(pool: &SqlitePool, sha: &str) {
    let list = load_missing_blobs(pool).await;
    let next: Vec<String> = list.into_iter().filter(|s| s != sha).collect();
    store_missing_blobs(pool, &next).await;
}

/// Drop entries whose file will never arrive, then stop at the first entry
/// that is still waiting for a retry. Rows after a retry stay pending.
fn page_ready_to_send(
    page: &[crate::repo::OutboxEntry],
    held: &std::collections::HashSet<String>,
    gave_up: &std::collections::HashSet<String>,
) -> Vec<crate::repo::OutboxEntry> {
    page.iter()
        .filter(|entry| !gave_up.contains(&entry.id))
        .take_while(|entry| !held.contains(&entry.id))
        .cloned()
        .collect()
}

/// Last sequence of the longest prefix of `offered` that was actually posted.
/// A missing file in the middle stops the mesh watermark so later rows in the
/// same page do not hide it.
fn contiguous_prefix_seq(
    offered: &[crate::repo::OutboxEntry],
    sent: &[crate::repo::OutboxEntry],
) -> i64 {
    let sent_ids: std::collections::HashSet<&str> =
        sent.iter().map(|entry| entry.id.as_str()).collect();
    let mut through = 0i64;
    for entry in offered {
        if !sent_ids.contains(entry.id.as_str()) {
            break;
        }
        through = entry.seq;
    }
    through
}

async fn requeue_blob_rows_with_bytes(pool: &SqlitePool) -> Result<u32, AppError> {
    let rows: Vec<(String, String, String, i64)> = sqlx::query_as(
        "SELECT id, payload_json, device_id, seq FROM sync_outbox
         WHERE fail_reason = 'BLOB_MISSING' AND delivered_at IS NULL",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut ready = 0u32;
    for (id, payload, device_id, seq) in rows {
        let Some(sha) = payload_sha256(&payload) else {
            continue;
        };
        let bytes = medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha).await;
        let Ok(bytes) = bytes else {
            continue;
        };
        if bytes.is_empty() {
            continue;
        }
        sqlx::query("UPDATE sync_outbox SET fail_reason = NULL WHERE id = ?1")
            .bind(&id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        forget_blob_attempt(pool, &id).await;
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "UPDATE sync_peer_vector SET through_seq = ?1, updated_at = ?2
             WHERE source_device_id = ?3 AND through_seq >= ?4",
        )
        .bind(seq.saturating_sub(1))
        .bind(&now)
        .bind(&device_id)
        .bind(seq)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        ready += 1;
    }
    if ready > 0 {
        tracing::info!(
            target: "medoc::sync",
            event = "SYNC_BLOB_REQUEUED",
            rows = ready
        );
    }
    Ok(ready)
}

async fn put_attachment_blobs(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    pool: &SqlitePool,
    page: &[crate::repo::OutboxEntry],
) -> BlobPutOutcome {
    let mut held = std::collections::HashSet::new();
    let mut gave_up = std::collections::HashSet::new();
    for entry in page {
        if entry.entity_table != "chart_attachment" || entry.op == "DELETE" {
            continue;
        }
        let Some(sha) = payload_sha256(&entry.payload_json) else {
            continue;
        };
        let bytes =
            match medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha).await {
                Ok(b) if !b.is_empty() => b,
                _ => {
                    tracing::warn!(
                        target: "medoc::sync",
                        event = "SYNC_BLOB_PUT_MISSING",
                        id = %entry.id,
                        sha = %sha
                    );
                    remember_missing_blob(pool, &sha).await;
                    note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
                    continue;
                }
            };
        match client
            .put(crate::paths::blob_url(base, &sha))
            .bearer_auth(token)
            .body(bytes)
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                forget_missing_blob(pool, &sha).await;
                forget_blob_attempt(pool, &entry.id).await;
            }
            Ok(resp) => {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "SYNC_BLOB_PUT_FAILED",
                    id = %entry.id,
                    sha = %sha,
                    status = %resp.status()
                );
                remember_missing_blob(pool, &sha).await;
                note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
            }
            Err(error) => {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "SYNC_BLOB_PUT_FAILED",
                    id = %entry.id,
                    sha = %sha,
                    error = %error
                );
                remember_missing_blob(pool, &sha).await;
                note_blob_attempt(pool, &entry.id, &mut held, &mut gave_up).await;
            }
        }
    }
    BlobPutOutcome { held, gave_up }
}

async fn note_blob_attempt(
    pool: &SqlitePool,
    entry_id: &str,
    held: &mut std::collections::HashSet<String>,
    gave_up: &mut std::collections::HashSet<String>,
) {
    let attempts = bump_blob_attempts(pool, entry_id).await;
    if attempts >= PULL_ROW_RETRY_LIMIT {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_BLOB_GAVE_UP",
            id = %entry_id,
            attempts
        );
        gave_up.insert(entry_id.to_string());
        forget_blob_attempt(pool, entry_id).await;
    } else {
        held.insert(entry_id.to_string());
    }
}

async fn bump_blob_attempts(pool: &SqlitePool, entry_id: &str) -> i64 {
    let mut map = load_blob_attempts(pool).await;
    let next = map
        .get(entry_id)
        .and_then(|v| v.as_i64())
        .unwrap_or(0)
        .saturating_add(1);
    map.insert(entry_id.to_string(), serde_json::Value::from(next));
    store_blob_attempts(pool, &map).await;
    next
}

async fn forget_blob_attempt(pool: &SqlitePool, entry_id: &str) {
    let mut map = load_blob_attempts(pool).await;
    if map.remove(entry_id).is_some() {
        store_blob_attempts(pool, &map).await;
    }
}

async fn load_blob_attempts(pool: &SqlitePool) -> serde_json::Map<String, serde_json::Value> {
    let raw =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, BLOB_ATTEMPTS_KV)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "{}".into());
    serde_json::from_str(&raw).unwrap_or_default()
}

async fn store_blob_attempts(pool: &SqlitePool, map: &serde_json::Map<String, serde_json::Value>) {
    let _ = medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        BLOB_ATTEMPTS_KV,
        &serde_json::to_string(map).unwrap_or_else(|_| "{}".into()),
    )
    .await;
}

async fn fetch_attachment_blobs(
    client: &reqwest::Client,
    base: &str,
    token: &str,
    pool: &SqlitePool,
    entries: &[crate::repo::OutboxEntry],
) {
    let mut shas: Vec<String> = entries
        .iter()
        .filter(|e| e.entity_table == "chart_attachment" && e.op != "DELETE")
        .filter_map(|e| payload_sha256(&e.payload_json))
        .collect();
    shas.extend(load_missing_blobs(pool).await);
    shas.sort();
    shas.dedup();
    for sha in shas {
        if medoc_core::infrastructure::database::sync_blob::get_bytes(pool, &sha)
            .await
            .is_ok()
        {
            forget_missing_blob(pool, &sha).await;
            continue;
        }
        let resp = match client
            .get(crate::paths::blob_url(base, &sha))
            .bearer_auth(token)
            .send()
            .await
        {
            Ok(r) => r,
            Err(_) => {
                remember_missing_blob(pool, &sha).await;
                continue;
            }
        };
        if !resp.status().is_success() {
            remember_missing_blob(pool, &sha).await;
            continue;
        }
        let Ok(bytes) = resp.bytes().await else {
            remember_missing_blob(pool, &sha).await;
            continue;
        };
        match medoc_core::infrastructure::database::sync_blob::put_verified(pool, &sha, &bytes)
            .await
        {
            Ok(()) => forget_missing_blob(pool, &sha).await,
            Err(_) => remember_missing_blob(pool, &sha).await,
        }
    }
}

fn build_http_client(cert_sha256: &str) -> Result<reqwest::Client, AppError> {
    crate::tls_pin::pinned_http_client(cert_sha256, Duration::from_secs(60))
}

/// Deployment pin, or the fingerprint already stored on the device row.
pub(crate) async fn master_http_client_for_reconcile(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<reqwest::Client, AppError> {
    master_http_client(pool, deployment).await
}

async fn master_http_client(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
) -> Result<reqwest::Client, AppError> {
    let pin = if crate::tls_pin::is_sha256_pin(&deployment.master_cert_sha256) {
        crate::tls_pin::normalize_sha256_pin(&deployment.master_cert_sha256)
    } else {
        // Only the master's own certificate may be pinned for master calls.
        // The old query took *any* stored pin and preferred `is_local = 1`,
        // i.e. this device's own LAN certificate (or another replica's).
        let master_id = deployment.master_device_id.trim();
        if master_id.is_empty() {
            return Err(AppError::Validation(
                "sync TLS pin missing — refusing to accept an unpinned certificate".into(),
            ));
        }
        let stored: Option<String> = sqlx::query_scalar::<_, Option<String>>(
            "SELECT peer_cert_sha256 FROM sync_device
             WHERE device_id = ?1 AND is_local = 0
               AND peer_cert_sha256 IS NOT NULL AND length(trim(peer_cert_sha256)) > 0
             LIMIT 1",
        )
        .bind(master_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?
        .flatten()
        .filter(|value| crate::tls_pin::is_sha256_pin(value))
        .map(|value| crate::tls_pin::normalize_sha256_pin(&value));
        let Some(pin) = stored else {
            return Err(AppError::Validation(
                "sync TLS pin missing — refusing to accept an unpinned certificate".into(),
            ));
        };
        let mut cfg = deployment.clone();
        cfg.master_cert_sha256 = pin.clone();
        save_deployment(pool, &cfg).await?;
        pin
    };
    build_http_client(&pin)
}

/// Fetches the signed peer list from the master and verifies the Ed25519
/// signature against the pinned `master_pubkey` from pairing.
async fn fetch_peer_list(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    bearer_token: &str,
) -> Result<Vec<MeshPeerInfo>, AppError> {
    if deployment.master_base_url.is_empty() {
        return Err(AppError::Validation(
            "master_base_url missing for mesh sync".into(),
        ));
    }
    if deployment.master_pubkey.is_empty() {
        return Err(AppError::Validation(
            "master_pubkey missing for mesh peer-list verification".into(),
        ));
    }
    let url = format!(
        "{}/api/v1/pairing/peers",
        deployment.master_base_url.trim_end_matches('/')
    );
    let client = master_http_client(pool, deployment).await?;
    let resp = client
        .get(&url)
        .bearer_auth(bearer_token)
        .send()
        .await
        .map_err(|e| crate::outbound_http_log::send_failed("peers", &e))?;
    if !resp.status().is_success() {
        return Err(http_status_error("peers", resp).await);
    }
    let body: MeshPeerListResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("peers decode: {e}")))?;
    let canonical = serde_json::json!({
        "masterDeviceId": body.master_device_id,
        "peers": body.peers,
    });
    let bytes = serde_json::to_vec(&canonical)
        .map_err(|e| AppError::Internal(format!("peers canonical json: {e}")))?;
    let pubkey = crate::master_keys::parse_pubkey_b64(&deployment.master_pubkey)?;
    crate::master_keys::verify(&pubkey, &bytes, &body.signature)?;
    Ok(body
        .peers
        .into_iter()
        .map(|p| MeshPeerInfo {
            device_id: p.device_id,
            peer_base_url: p.peer_base_url,
        })
        .collect())
}

async fn push_to_peer(
    pool: &SqlitePool,
    peer_base_url: &str,
    bearer_token: &str,
    local_id: &str,
    target_device_id: &str,
    pending: &[crate::repo::OutboxEntry],
) -> Result<SyncPushResult, AppError> {
    if pending.is_empty() {
        return Ok(SyncPushResult {
            accepted: 0,
            last_seq: 0,
        });
    }
    let stored_pin: Option<Option<String>> =
        sqlx::query_scalar("SELECT peer_cert_sha256 FROM sync_device WHERE device_id = ?1")
            .bind(target_device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    let Some(pin) = stored_pin
        .flatten()
        .filter(|value| !value.trim().is_empty())
    else {
        return Err(AppError::Validation(format!(
            "peer {target_device_id} has no TLS pin"
        )));
    };
    let client = build_http_client(&pin)?;
    let blobs = put_attachment_blobs(&client, peer_base_url, bearer_token, pool, pending).await;
    for id in &blobs.gave_up {
        mark_outbox_failed(pool, id, "BLOB_MISSING").await?;
    }
    let ready = page_ready_to_send(pending, &blobs.held, &blobs.gave_up);
    if ready.is_empty() {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_BLOB_PUT_HELD",
            held = blobs.held.len(),
            gave_up = blobs.gave_up.len()
        );
        return Ok(SyncPushResult {
            accepted: 0,
            last_seq: 0,
        });
    }
    let url = crate::paths::api_url(peer_base_url, crate::paths::SYNC_PUSH);
    let body = serde_json::json!({
        "fromDeviceId": local_id,
        "entries": ready,
    });
    let resp = client
        .post(&url)
        .bearer_auth(bearer_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::outbound_http_log::send_failed("peer push", &e))?;
    if !resp.status().is_success() {
        return Err(http_status_error("peer push", resp).await);
    }
    let result: SyncPushResult = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("peer push decode: {e}")))?;
    let prefix = contiguous_prefix_seq(pending, &ready);
    let through = if result.last_seq > 0 {
        prefix.min(result.last_seq)
    } else {
        0
    };
    if through > 0 {
        mark_peer_delivery(pool, local_id, target_device_id, through).await?;
    }
    Ok(result)
}

struct ExchangeTarget {
    device_id: String,
    base_url: String,
    bearer: String,
    client: reqwest::Client,
}

struct ExchangePlan {
    targets: Vec<ExchangeTarget>,
    errors: Vec<String>,
}

struct ExchangeOne {
    accepted: u32,
    last_seq: i64,
    applied: u32,
    skipped: u32,
}

async fn exchange_targets(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    local_id: &str,
) -> Result<ExchangePlan, AppError> {
    if deployment.role == DeviceRole::Replica {
        if deployment.master_base_url.trim().is_empty() {
            return Ok(ExchangePlan {
                targets: Vec::new(),
                errors: vec!["master_base_url missing".into()],
            });
        }
        let bearer = pick_bearer(deployment)?;
        let client = master_http_client(pool, deployment).await?;
        let device_id = resolve_master_device_id(pool, deployment)
            .await
            .unwrap_or_default();
        if device_id.is_empty() {
            return Ok(ExchangePlan {
                targets: Vec::new(),
                errors: vec!["master device id missing".into()],
            });
        }
        return Ok(ExchangePlan {
            targets: vec![ExchangeTarget {
                device_id,
                base_url: deployment.master_base_url.clone(),
                bearer,
                client,
            }],
            errors: Vec::new(),
        });
    }
    let bearer = mint_main_exchange_token(pool, local_id).await?;
    let rows = sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT device_id, peer_base_url, peer_cert_sha256
         FROM sync_device
         WHERE is_local = 0 AND role = 'REPLICA'
           AND peer_base_url IS NOT NULL AND length(trim(peer_base_url)) > 0",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let mut targets = Vec::new();
    let mut errors = Vec::new();
    for (device_id, base_url, pin) in rows {
        let Some(pin) = pin.filter(|value| crate::tls_pin::is_sha256_pin(value)) else {
            errors.push(format!(
                "{device_id}: TLS pin missing — main device will not dial this replica"
            ));
            continue;
        };
        let pin = crate::tls_pin::normalize_sha256_pin(&pin);
        match build_http_client(&pin) {
            Ok(client) => targets.push(ExchangeTarget {
                device_id,
                base_url,
                bearer: bearer.clone(),
                client,
            }),
            Err(e) => errors.push(format!("{device_id}: {e}")),
        }
    }
    Ok(ExchangePlan { targets, errors })
}

async fn mint_main_exchange_token(pool: &SqlitePool, local_id: &str) -> Result<String, AppError> {
    let key = crate::master_keys::align_to_license(pool).await?;
    let payload = crate::pairing::ActivationTokenPayload {
        version: 2,
        device_id: local_id.to_string(),
        slave_label: "main".into(),
        master_device_id: local_id.to_string(),
        allowed_actions: vec![
            "sync.push".into(),
            "sync.pull".into(),
            "sync.blob.get".into(),
        ],
        issued_at: chrono::Utc::now().to_rfc3339(),
        nonce: uuid::Uuid::new_v4().to_string(),
    };
    crate::pairing::mint_activation_token(&key, &payload)
}

async fn post_exchange(
    target: &ExchangeTarget,
    from_device_id: &str,
    packets: &[crate::repo::OutboxEntry],
    ack_through_seq: i64,
    queues: &[String],
) -> Result<SyncExchangePage, AppError> {
    let url = crate::paths::api_url(&target.base_url, crate::paths::SYNC_EXCHANGE);
    let body =
        crate::entry_signature::exchange_body(from_device_id, packets, ack_through_seq, queues);
    let resp = target
        .client
        .post(&url)
        .bearer_auth(&target.bearer)
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::outbound_http_log::send_failed("sync exchange", &e))?;
    if !resp.status().is_success() {
        return Err(http_status_error("sync exchange", resp).await);
    }
    crate::durable_queue::confirm_send(crate::durable_queue::SendChannel::Exchange);
    resp.json()
        .await
        .map_err(|e| AppError::Internal(format!("sync exchange decode: {e}")))
}

async fn exchange_one(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    local_id: &str,
    target: &ExchangeTarget,
    queues: &[String],
) -> Result<ExchangeOne, AppError> {
    let queue_list: Vec<String> = queues.to_vec();
    let ack = crate::repo::received_through(pool, &target.device_id, local_id, queues).await?;
    let pending =
        crate::repo::list_exchange_packets(pool, local_id, &target.device_id, queues, 500).await?;
    let blobs = put_attachment_blobs(
        &target.client,
        &target.base_url,
        &target.bearer,
        pool,
        &pending,
    )
    .await;
    for id in &blobs.gave_up {
        mark_outbox_failed(pool, id, "BLOB_MISSING").await?;
    }
    let ready = page_ready_to_send(&pending, &blobs.held, &blobs.gave_up);
    let page = post_exchange(target, local_id, &ready, ack, queues).await?;
    if page.last_seq > 0 {
        crate::repo::mark_peer_delivery_for_queues(
            pool,
            local_id,
            &target.device_id,
            &queue_list,
            page.last_seq,
        )
        .await?;
        if deployment.role == DeviceRole::Replica {
            let ids: Vec<String> = ready
                .iter()
                .filter(|entry| entry.seq <= page.last_seq)
                .map(|entry| entry.id.clone())
                .collect();
            mark_outbox_ids_delivered(pool, &ids).await?;
        }
    }
    let first =
        receive_exchange_page(pool, deployment, local_id, target, &page.packets, queues).await?;
    let mut applied = first.applied;
    let mut skipped = first.skipped;
    if let Some(seq) = first.through {
        if let Ok(rest) = post_exchange(target, local_id, &[], seq, queues).await {
            let more =
                receive_exchange_page(pool, deployment, local_id, target, &rest.packets, queues)
                    .await?;
            applied = applied.saturating_add(more.applied);
            skipped = skipped.saturating_add(more.skipped);
        }
    }
    Ok(ExchangeOne {
        accepted: page.accepted,
        last_seq: page.last_seq,
        applied,
        skipped,
    })
}

struct ReceivedPage {
    applied: u32,
    skipped: u32,
    through: Option<i64>,
}

/// Apply the packets the other device sent back.
///
/// The main device receiving a replica's queue treats it exactly like a push:
/// master conflict rules (not "the sender is the main device"), the
/// access-control guard, and a relay copy on its own outbox so every other
/// replica gets the change. Before, it used the replica pull path: the
/// replica won every tie, calendar rows skipped conflict checks, nothing was
/// relayed, and access rows were accepted from a replica.
async fn receive_exchange_page(
    pool: &SqlitePool,
    deployment: &SyncDeploymentConfig,
    local_id: &str,
    target: &ExchangeTarget,
    packets: &[crate::repo::OutboxEntry],
    queues: &[String],
) -> Result<ReceivedPage, AppError> {
    if packets.is_empty() {
        return Ok(ReceivedPage {
            applied: 0,
            skipped: 0,
            through: None,
        });
    }
    if deployment.role == DeviceRole::Master {
        let pushed = SyncEngine::ingest_push(pool, &target.device_id, packets).await?;
        let through = (pushed.last_seq > 0).then_some(pushed.last_seq);
        if let Some(seq) = through {
            crate::repo::note_received(pool, &target.device_id, local_id, queues, seq).await?;
        }
        let applied = pushed.accepted;
        let processed = packets.iter().filter(|p| p.seq <= pushed.last_seq).count() as u32;
        return Ok(ReceivedPage {
            applied,
            skipped: processed.saturating_sub(applied),
            through,
        });
    }
    let pulled = apply_pulled_entries(pool, local_id, packets).await?;
    let through = pulled.cursor.as_ref().map(|(_, seq)| *seq);
    if let Some((device_id, seq)) = pulled.cursor {
        crate::repo::note_received(pool, &device_id, local_id, queues, seq).await?;
    }
    // Attachments that arrived on this path need their bytes too.
    fetch_attachment_blobs(
        &target.client,
        &target.base_url,
        &target.bearer,
        pool,
        packets,
    )
    .await;
    Ok(ReceivedPage {
        applied: pulled.applied,
        skipped: pulled.skipped,
        through,
    })
}

/// Logs the failed call (`outbound_http_log`) and returns the same error as before.
async fn http_status_error(kind: &str, resp: reqwest::Response) -> AppError {
    crate::outbound_http_log::status_failed(kind, resp).await
}

/// Relay outbox row and `sync_applied` commit together. A failed relay leaves
/// the source sequence unmarked so the next push retries both.
async fn mark_applied_with_relay(
    pool: &SqlitePool,
    local_id: &str,
    entry: &crate::repo::OutboxEntry,
    relay_payload: Option<&str>,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    if let Some(payload) = relay_payload {
        let seq: i64 = sqlx::query_scalar(
            "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 1)
             ON CONFLICT(device_id) DO UPDATE SET seq = seq + 1
             RETURNING seq",
        )
        .bind(local_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(AppError::Database)?;
        let id = uuid::Uuid::new_v4().to_string();
        let created_at = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            "INSERT INTO sync_outbox (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )
        .bind(&id)
        .bind(local_id)
        .bind(seq)
        .bind(&entry.entity_table)
        .bind(&entry.entity_id)
        .bind(&entry.op)
        .bind(payload)
        .bind(&created_at)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO sync_applied (source_device_id, source_seq) VALUES (?1, ?2)",
    )
    .bind(&entry.device_id)
    .bind(entry.seq)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::repo::save_deployment;
    use crate::schema::ensure_sync_tables;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    #[tokio::test]
    async fn blob_put_reaches_the_server_and_a_missing_file_holds_the_row() {
        use medoc_core::infrastructure::database::sync_blob::{put_verified, sha256_hex};
        use wiremock::matchers::{body_bytes, header, method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let bytes = b"chart-file";
        let sha = sha256_hex(bytes);
        put_verified(&pool, &sha, bytes).await.expect("store blob");
        let ready = attachment_entry("file-ok", &sha);
        let missing = attachment_entry("file-missing", &"ab".repeat(32));

        let server = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path(format!("/api/v1/sync/blob/{sha}")))
            .and(header("authorization", "Bearer practice-token"))
            .and(body_bytes(bytes.as_slice()))
            .respond_with(ResponseTemplate::new(201))
            .expect(1)
            .mount(&server)
            .await;

        let client = reqwest::Client::new();
        let page = vec![ready.clone(), missing.clone()];
        let held =
            put_attachment_blobs(&client, &server.uri(), "practice-token", &pool, &page).await;
        assert!(!held.held.contains(&ready.id), "uploaded file is not held");
        assert!(
            held.held.contains(&missing.id),
            "row without bytes stays pending"
        );
        assert!(held.gave_up.is_empty());
        assert_eq!(
            page_ready_to_send(&page, &held.held, &held.gave_up).len(),
            1
        );

        let failing = MockServer::start().await;
        Mock::given(method("PUT"))
            .and(path(format!("/api/v1/sync/blob/{sha}")))
            .respond_with(ResponseTemplate::new(500).set_body_string("disk full"))
            .expect(1)
            .mount(&failing)
            .await;
        let held =
            put_attachment_blobs(&client, &failing.uri(), "practice-token", &pool, &[ready]).await;
        assert!(held.held.contains("file-ok"));
    }

    #[tokio::test]
    async fn a_missing_file_gives_up_after_eight_tries_and_later_rows_can_send() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let missing = attachment_entry("gone", &"cd".repeat(32));
        let later = outbox_entry("later", 9);
        let client = reqwest::Client::new();
        let page = vec![missing, later];
        let mut outcome = BlobPutOutcome {
            held: std::collections::HashSet::new(),
            gave_up: std::collections::HashSet::new(),
        };
        for attempt in 1..=PULL_ROW_RETRY_LIMIT {
            outcome = put_attachment_blobs(&client, "http://127.0.0.1:9", "t", &pool, &page).await;
            if attempt < PULL_ROW_RETRY_LIMIT {
                assert!(outcome.held.contains("gone"), "attempt {attempt}");
                assert!(page_ready_to_send(&page, &outcome.held, &outcome.gave_up).is_empty());
            }
        }
        assert!(outcome.gave_up.contains("gone"));
        assert!(!outcome.held.contains("gone"));
        let ready = page_ready_to_send(&page, &outcome.held, &outcome.gave_up);
        assert_eq!(ready.len(), 1);
        assert_eq!(ready[0].id, "later");
    }

    #[tokio::test]
    async fn a_missing_blob_is_queued_again_when_the_bytes_arrive() {
        use medoc_core::infrastructure::database::sync_blob::{put_verified, sha256_hex};

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "blob-retry")
            .await
            .expect("device");
        let bytes = b"chart-file-later";
        let sha = sha256_hex(bytes);
        let entry = crate::repo::append_outbox(
            &pool,
            &device,
            "chart_attachment",
            "file-later",
            "INSERT",
            &format!(r#"{{"sha256":"{sha}"}}"#),
        )
        .await
        .expect("outbox");
        mark_outbox_failed(&pool, &entry.id, "BLOB_MISSING")
            .await
            .expect("fail");
        assert_eq!(
            requeue_blob_rows_with_bytes(&pool).await.expect("requeue"),
            0
        );
        put_verified(&pool, &sha, bytes).await.expect("bytes");
        assert_eq!(
            requeue_blob_rows_with_bytes(&pool).await.expect("requeue"),
            1
        );
        let pending = crate::repo::list_pending_outbox(&pool, &device, 20)
            .await
            .expect("pending");
        assert!(pending.iter().any(|row| row.id == entry.id));
    }

    #[tokio::test]
    async fn a_peer_past_a_missing_file_sees_it_again_when_the_bytes_arrive() {
        use medoc_core::infrastructure::database::sync_blob::{put_verified, sha256_hex};

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "mesh-blob")
            .await
            .expect("device");
        let bytes = b"chart-file-mesh";
        let sha = sha256_hex(bytes);
        let blob = crate::repo::append_outbox(
            &pool,
            &device,
            "chart_attachment",
            "file-mesh",
            "INSERT",
            &format!(r#"{{"sha256":"{sha}"}}"#),
        )
        .await
        .expect("blob");
        let later = crate::repo::append_outbox(
            &pool,
            &device,
            "patient",
            "patient-mesh",
            "UPDATE",
            r#"{"name":"later"}"#,
        )
        .await
        .expect("later");
        mark_outbox_failed(&pool, &blob.id, "BLOB_MISSING")
            .await
            .expect("fail");
        mark_peer_delivery(&pool, &device, "peer-b", later.seq)
            .await
            .expect("watermark");
        let hidden = list_pending_outbox_for_peer(&pool, &device, "peer-b")
            .await
            .expect("hidden");
        assert!(hidden.iter().all(|row| row.id != blob.id));
        put_verified(&pool, &sha, bytes).await.expect("bytes");
        assert_eq!(
            requeue_blob_rows_with_bytes(&pool).await.expect("requeue"),
            1
        );
        let visible = list_pending_outbox_for_peer(&pool, &device, "peer-b")
            .await
            .expect("visible");
        assert!(visible.iter().any(|row| row.id == blob.id));
        let through: i64 = sqlx::query_scalar(
            "SELECT through_seq FROM sync_peer_vector
             WHERE source_device_id = ?1 AND target_device_id = 'peer-b'",
        )
        .bind(&device)
        .fetch_one(&pool)
        .await
        .expect("through");
        assert_eq!(through, blob.seq - 1);
    }

    fn attachment_entry(id: &str, sha: &str) -> crate::repo::OutboxEntry {
        crate::repo::OutboxEntry {
            id: id.into(),
            device_id: "device".into(),
            seq: 1,
            entity_table: "chart_attachment".into(),
            entity_id: id.into(),
            op: "INSERT".into(),
            payload_json: format!(r#"{{"sha256":"{sha}"}}"#),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn a_failed_blob_holds_back_that_entry_and_everything_after_it() {
        let page = vec![
            outbox_entry("a", 1),
            outbox_entry("b", 2),
            outbox_entry("c", 3),
        ];
        let held = std::collections::HashSet::from(["b".to_string()]);
        let none = std::collections::HashSet::new();
        let ready = page_ready_to_send(&page, &held, &none);
        assert_eq!(ready.len(), 1);
        assert_eq!(ready[0].id, "a");
        assert_eq!(page_ready_to_send(&page, &none, &none).len(), 3);
        let sent = vec![outbox_entry("a", 1), outbox_entry("c", 3)];
        assert_eq!(contiguous_prefix_seq(&page, &sent), 1);
        assert_eq!(contiguous_prefix_seq(&page, &page), 3);
        assert_eq!(contiguous_prefix_seq(&page, &[]), 0);
    }

    fn outbox_entry(id: &str, seq: i64) -> crate::repo::OutboxEntry {
        crate::repo::OutboxEntry {
            id: id.into(),
            device_id: "device".into(),
            seq,
            entity_table: "chart_attachment".into(),
            entity_id: id.into(),
            op: "INSERT".into(),
            payload_json: "{}".into(),
            created_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[tokio::test]
    async fn push_ingest_applies_app_kv_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "test").await.expect("device");
        let entry = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "sync.test.key",
            "INSERT",
            r#"{"key":"sync.test.key","value":"42"}"#,
        )
        .await
        .expect("outbox");
        let result = SyncEngine::ingest_push(&pool, &device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        assert_eq!(result.accepted, 1);
    }

    /// Slice 6 regression — replica's locally-newer row must not be clobbered
    /// when the master pushes an older `updated_at`.
    #[tokio::test]
    async fn master_does_not_overwrite_newer_replica_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");

        // Seed a local patient row that already has a *newer* updated_at than
        // the incoming master push.
        let id = "00000000-0000-0000-0000-0000000000aa";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                                  phone, email, address, status, created_at, updated_at)
             VALUES (?1, 'Local Newer', '1990-01-01', 'MALE', 'V-A',
                     NULL, NULL, NULL, 'ACTIVE', '2099-01-01 00:00:00', '2099-01-02 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");

        // Outbox entry from a remote (master) device with an *older* updated_at.
        let master_device = "master-device-id";
        let entry = crate::repo::OutboxEntry {
            id: "e1".into(),
            device_id: master_device.into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Master Older","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };

        // Local is REPLICA. The freshness policy should keep the local "Local Newer" row.
        let res = SyncEngine::ingest_push(&pool, master_device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        assert_eq!(res.accepted, 1, "applied flag should still be marked");

        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("read back");
        assert_eq!(name, "Local Newer", "newer local row must be preserved");
    }

    /// Slice 6 — older local row must be overwritten by a newer master push.
    #[tokio::test]
    async fn newer_master_push_overwrites_older_replica_row() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");

        let id = "00000000-0000-0000-0000-0000000000bb";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                                  phone, email, address, status, created_at, updated_at)
             VALUES (?1, 'Local Older', '1990-01-01', 'MALE', 'V-B',
                     NULL, NULL, NULL, 'ACTIVE', '2099-01-01 00:00:00', '2099-01-01 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");

        let master_device = "master-device-id-2";
        let entry = crate::repo::OutboxEntry {
            id: "e2".into(),
            device_id: master_device.into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Master Newer","updated_at":"2099-02-01T00:00:00Z"}}"#
            ),
            created_at: "2099-02-01T00:00:00Z".into(),
        };

        SyncEngine::ingest_push(&pool, master_device, std::slice::from_ref(&entry))
            .await
            .expect("ingest");

        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .expect("read back");
        assert_eq!(
            name, "Master Newer",
            "older local row must yield to newer master push"
        );
    }

    #[tokio::test]
    async fn ingest_push_rejects_outbox_device_id_mismatch() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "local").await.expect("device");
        let entry = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "mismatch.key",
            "INSERT",
            r#"{"key":"mismatch.key","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let err = SyncEngine::ingest_push(&pool, "other-device", std::slice::from_ref(&entry))
            .await
            .expect_err("mismatch");
        assert!(matches!(err, medoc_core::error::AppError::Validation(_)));
    }

    #[tokio::test]
    async fn collect_pull_returns_entries_after_since_seq() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let device = ensure_local_device(&pool, "pull-device")
            .await
            .expect("device");
        crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "pull-a",
            "INSERT",
            r#"{"key":"pull-a","value":"1"}"#,
        )
        .await
        .expect("o1");
        let e2 = crate::repo::append_outbox(
            &pool,
            &device,
            "app_kv",
            "pull-b",
            "INSERT",
            r#"{"key":"pull-b","value":"2"}"#,
        )
        .await
        .expect("o2");
        let pulled = SyncEngine::collect_pull(&pool, &device, 1)
            .await
            .expect("pull");
        assert_eq!(pulled.len(), 1);
        assert_eq!(pulled[0].seq, e2.seq);
    }

    #[tokio::test]
    async fn collect_pull_for_replica_ignores_caller_device_id() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::PracticeDesktop,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Main").await.expect("device");
        crate::repo::append_outbox(
            &pool,
            &local,
            "app_kv",
            "from-master",
            "INSERT",
            r#"{"key":"from-master","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let pulled = SyncEngine::collect_pull_for_replica(&pool, "unknown-replica-guess", 0, 0)
            .await
            .expect("pull");
        assert!(
            pulled.entries.iter().any(|e| e.entity_id == "from-master"),
            "master must serve its own outbox, not the replica-supplied device id"
        );
    }

    #[tokio::test]
    async fn master_forwards_its_row_not_a_stale_replica_payload() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Main").await.expect("device");
        let id = "00000000-0000-0000-0000-0000000000d1";
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, updated_at)
             VALUES (?1, 'Master Newer', '1990-01-01', 'MALE', 'V-STALE', 'ACTIVE', '2099-03-01 00:00:00')",
        )
        .bind(id)
        .execute(&pool)
        .await
        .expect("seed");
        let entry = crate::repo::OutboxEntry {
            id: "stale".into(),
            device_id: "replica-a".into(),
            seq: 4,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "UPDATE".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Stale Replica","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };
        SyncEngine::ingest_push(&pool, "replica-a", std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        let name: String = sqlx::query_scalar("SELECT name FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(name, "Master Newer");
        let forwarded = crate::repo::list_entries_since(&pool, &local, 0)
            .await
            .expect("outbox");
        let row = forwarded
            .iter()
            .find(|e| e.entity_id == id)
            .expect("stale push must still be relayed from the master's current row");
        assert!(row.payload_json.contains("Master Newer"));
        assert!(!row.payload_json.contains("Stale Replica"));
    }

    #[tokio::test]
    async fn replica_does_not_relay_a_peer_push() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        save_deployment(
            &pool,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Replica,
                device_label: "Replica".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        let local = ensure_local_device(&pool, "Replica").await.expect("device");
        let id = "00000000-0000-0000-0000-0000000000d2";
        let entry = crate::repo::OutboxEntry {
            id: "peer".into(),
            device_id: "replica-a".into(),
            seq: 1,
            entity_table: "patient".into(),
            entity_id: id.into(),
            op: "INSERT".into(),
            payload_json: format!(
                r#"{{"id":"{id}","name":"Peer","date_of_birth":"1990-01-01","sex":"MALE","insurance_number":"V-PEER","status":"ACTIVE","updated_at":"2099-01-01T00:00:00Z"}}"#
            ),
            created_at: "2099-01-01T00:00:00Z".into(),
        };
        SyncEngine::ingest_push(&pool, "replica-a", std::slice::from_ref(&entry))
            .await
            .expect("ingest");
        let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE device_id = ?1")
            .bind(&local)
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(n, 0);
    }

    #[tokio::test]
    async fn align_moves_pending_outbox_onto_the_activation_token_device() {
        use ed25519_dalek::SigningKey;
        use rand::rngs::OsRng;

        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        ensure_sync_tables(&pool).await.expect("schema");
        let signing_key = SigningKey::generate(&mut OsRng);
        let previous_secret = std::env::var("MEDOC_CLUSTER_DEVICE_SECRET").ok();
        std::env::set_var(
            "MEDOC_CLUSTER_DEVICE_SECRET",
            "1111111111111111111111111111111111111111111111111111111111111111",
        );
        let fingerprint = crate::cluster::crypto::DeviceIdentity::try_load()
            .expect("identity")
            .expect("loaded")
            .fingerprint;
        let foreign = crate::pairing::mint_activation_token(
            &signing_key,
            &crate::pairing::ActivationTokenPayload {
                version: 2,
                device_id: "not-this-install".into(),
                slave_label: "Replica".into(),
                master_device_id: "master".into(),
                allowed_actions: vec!["sync.push".into()],
                issued_at: "2026-11-06T00:00:00Z".into(),
                nonce: "n".into(),
            },
        )
        .expect("mint");
        medoc_core::infrastructure::database::repos::admin::app_kv::set(
            &pool,
            crate::deployment::APP_KV_DEVICE_ID_KEY,
            "local-wrong",
        )
        .await
        .expect("kv");
        ensure_local_device(&pool, "Replica").await.expect("device");
        crate::repo::append_outbox(
            &pool,
            "local-wrong",
            "app_kv",
            "pending-key",
            "INSERT",
            r#"{"key":"pending-key","value":"1"}"#,
        )
        .await
        .expect("outbox");
        let mut cfg = crate::deployment::SyncDeploymentConfig {
            schema_version: 1,
            mode: crate::deployment::DeploymentMode::ServerlessPeer,
            role: crate::deployment::DeviceRole::Replica,
            device_label: "Replica".into(),
            activation_token: foreign,
            master_pubkey: crate::master_keys::pubkey_b64(&signing_key),
            ..Default::default()
        };
        let kept = align_local_id_to_activation(&pool, &cfg)
            .await
            .expect("foreign token");
        assert_eq!(kept, "local-wrong");
        sqlx::query(
            "INSERT INTO pairing_request (id, device_id, slave_pubkey, fingerprint)
             VALUES ('join-paired', 'paired-fp', '', 'paired-fp')",
        )
        .execute(&pool)
        .await
        .expect("pairing row");
        let paired = crate::pairing::mint_activation_token(
            &signing_key,
            &crate::pairing::ActivationTokenPayload {
                version: 2,
                device_id: "paired-fp".into(),
                slave_label: "Replica".into(),
                master_device_id: "master".into(),
                allowed_actions: vec!["sync.push".into()],
                issued_at: "2026-11-06T00:00:00Z".into(),
                nonce: "paired".into(),
            },
        )
        .expect("mint paired token");
        cfg.activation_token = paired;
        let adopted = align_local_id_to_activation(&pool, &cfg)
            .await
            .expect("joined token");
        assert_eq!(adopted, "paired-fp");
        let token = crate::pairing::mint_activation_token(
            &signing_key,
            &crate::pairing::ActivationTokenPayload {
                version: 2,
                device_id: fingerprint.clone(),
                slave_label: "Replica".into(),
                master_device_id: "master".into(),
                allowed_actions: vec!["sync.push".into()],
                issued_at: "2026-11-06T00:00:00Z".into(),
                nonce: "n2".into(),
            },
        )
        .expect("mint fingerprint token");
        cfg.activation_token = token;
        let id = align_local_id_to_activation(&pool, &cfg)
            .await
            .expect("align");
        assert_eq!(id, fingerprint);
        let pending = crate::repo::list_pending_outbox(&pool, &fingerprint, 500)
            .await
            .expect("pending");
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].device_id, fingerprint);
        let stored = medoc_core::infrastructure::database::repos::admin::app_kv::get(
            &pool,
            crate::deployment::APP_KV_DEVICE_ID_KEY,
        )
        .await
        .expect("read")
        .expect("device id");
        assert_eq!(stored, fingerprint);
        if let Some(previous) = previous_secret {
            std::env::set_var("MEDOC_CLUSTER_DEVICE_SECRET", previous);
        } else {
            std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
        }
        let wrong: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE device_id = 'local-wrong'")
                .fetch_one(&pool)
                .await
                .expect("count");
        assert_eq!(wrong, 0);
    }

    #[tokio::test]
    async fn initial_copy_skips_push_and_second_pull_advances_through_seq() {
        let master = test_memory_pool().await.expect("pool");
        run_migrations(&master).await.expect("migrate");
        ensure_sync_tables(&master).await.expect("schema");
        save_deployment(
            &master,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::PracticeDesktop,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("deploy");
        ensure_local_device(&master, "Main").await.expect("device");
        for (id, name, insurance) in [
            (
                "00000000-0000-0000-0000-0000000000c1",
                "Copy One",
                "V-COPY-1",
            ),
            (
                "00000000-0000-0000-0000-0000000000c2",
                "Copy Two",
                "V-COPY-2",
            ),
        ] {
            sqlx::query(
                "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, updated_at)
                 VALUES (?1, ?2, '1990-01-01', 'FEMALE', ?3, 'ACTIVE', '2099-03-01 00:00:00')",
            )
            .bind(id)
            .bind(name)
            .bind(insurance)
            .execute(&master)
            .await
            .expect("patient");
        }
        let first = SyncEngine::collect_pull_for_replica(&master, "new-replica-copy", 0, 0)
            .await
            .expect("first pull");
        let span = first.initial_copy.expect("snapshot span");
        assert!(span.end_seq > 1, "snapshot must cover more than one row");
        assert_eq!(span.through_seq, 0);
        assert_eq!(span.total, span.end_seq);
        assert!(!first.entries.is_empty());

        let second = SyncEngine::collect_pull_for_replica(&master, "new-replica-copy", 1, 0)
            .await
            .expect("second pull");
        let next = second.initial_copy.expect("copy still open");
        assert!(next.through_seq > span.through_seq);
        assert_eq!(next.through_seq, 1);
        assert_eq!(next.end_seq, span.end_seq);

        let replica = test_memory_pool().await.expect("pool");
        run_migrations(&replica).await.expect("migrate");
        ensure_sync_tables(&replica).await.expect("schema");
        save_deployment(
            &replica,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Replica,
                device_label: "Replica".into(),
                ..Default::default()
            },
        )
        .await
        .expect("replica deploy");
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, updated_at)
             VALUES ('00000000-0000-0000-0000-0000000000c3', 'Local Seed', '1990-01-01', 'MALE', 'V-SEED', 'ACTIVE', '2099-03-01 00:00:00')",
        )
        .execute(&replica)
        .await
        .expect("seed patient");
        sqlx::query("INSERT INTO app_kv (key, value) VALUES ('ui.keep', 'yes')")
            .execute(&replica)
            .await
            .expect("kv");
        let report = SyncEngine::run_replica_sync(&replica).await.expect("sync");
        assert!(report.push.is_none());
        let err = report.error.expect("pull has no master url");
        assert!(
            !err.contains("push:"),
            "a new replica must not push before the snapshot is applied: {err}"
        );
        let kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient")
            .fetch_one(&replica)
            .await
            .expect("count");
        assert_eq!(kept, 1, "a failed pull must not wipe local rows");

        super::super::initial_copy::clear_practice_rows(&replica)
            .await
            .expect("clear");
        let patients: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient")
            .fetch_one(&replica)
            .await
            .expect("count");
        assert_eq!(patients, 0);
        let kv: Option<String> =
            sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'ui.keep'")
                .fetch_optional(&replica)
                .await
                .expect("kv");
        assert_eq!(kv.as_deref(), Some("yes"));

        let local = ensure_local_device(&master, "Main").await.expect("device");
        crate::repo::append_outbox(
            &master,
            &local,
            "patient",
            "00000000-0000-0000-0000-0000000000c9",
            "INSERT",
            r#"{"id":"00000000-0000-0000-0000-0000000000c9","name":"Live","updated_at":"2099-04-01T00:00:00Z"}"#,
        )
        .await
        .expect("live row");
        let live = SyncEngine::collect_pull_for_replica(&master, "new-replica-copy", 1, 0)
            .await
            .expect("live pull");
        assert!(
            live.live
                .iter()
                .any(|entry| entry.entity_id == "00000000-0000-0000-0000-0000000000c9"),
            "a change made after the snapshot must travel with the copy"
        );
        assert!(
            live.entries.iter().all(|entry| entry.seq <= next.end_seq),
            "the live row must not skip the snapshot cursor"
        );

        medoc_core::infrastructure::database::repos::admin::app_kv::set(
            &replica,
            "sync.initial_copy.cleared.v1",
            "1",
        )
        .await
        .expect("cleared");
        let skip = super::super::initial_copy::should_skip_push(&replica)
            .await
            .expect("skip");
        assert!(
            !skip,
            "an edit made on this device after the wipe has to be sent"
        );
    }

    #[tokio::test]
    async fn packet_exchange_applies_each_devices_queue_on_the_other() {
        let main = test_memory_pool().await.expect("main");
        let replica = test_memory_pool().await.expect("replica");
        run_migrations(&main).await.expect("migrate main");
        run_migrations(&replica).await.expect("migrate replica");
        ensure_sync_tables(&main).await.expect("schema main");
        ensure_sync_tables(&replica).await.expect("schema replica");
        save_deployment(
            &main,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::PracticeDesktop,
                role: crate::deployment::DeviceRole::Master,
                device_label: "Main".into(),
                ..Default::default()
            },
        )
        .await
        .expect("main deploy");
        save_deployment(
            &replica,
            &crate::deployment::SyncDeploymentConfig {
                schema_version: 1,
                mode: crate::deployment::DeploymentMode::ServerlessPeer,
                role: crate::deployment::DeviceRole::Replica,
                device_label: "Replica".into(),
                ..Default::default()
            },
        )
        .await
        .expect("replica deploy");
        let main_id = ensure_local_device(&main, "Main").await.expect("main id");
        let replica_id = ensure_local_device(&replica, "Replica")
            .await
            .expect("replica id");

        let main_packet = SyncEngine::enqueue_update_packet(
            &main,
            "app_kv",
            "practice.packet.main",
            "INSERT",
            r#"{"key":"practice.packet.main","value":"from-main"}"#,
        )
        .await
        .expect("main packet");
        let replica_packet = SyncEngine::enqueue_update_packet(
            &replica,
            "app_kv",
            "practice.packet.replica",
            "INSERT",
            r#"{"key":"practice.packet.replica","value":"from-replica"}"#,
        )
        .await
        .expect("replica packet");
        let queued: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sync_packet_queue WHERE queue_name = 'parameters'",
        )
        .fetch_one(&main)
        .await
        .expect("queue count");
        assert_eq!(queued, 1);

        let replica_out =
            crate::repo::list_exchange_packets(&replica, &replica_id, &main_id, &[], 50)
                .await
                .expect("replica list");
        assert_eq!(replica_out.len(), 1);
        assert_eq!(replica_out[0].id, replica_packet.id);

        let on_main = SyncEngine::serve_exchange(&main, &replica_id, &replica_out, 0, &[])
            .await
            .expect("main serve");
        assert_eq!(on_main.accepted, 1);
        let replica_value: String =
            sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'practice.packet.replica'")
                .fetch_one(&main)
                .await
                .expect("main stored replica value");
        assert_eq!(replica_value, "from-replica");
        assert!(
            on_main
                .packets
                .iter()
                .any(|packet| packet.entity_id == "practice.packet.main"),
            "main queue must be offered back"
        );

        let main_out: Vec<_> = on_main
            .packets
            .into_iter()
            .filter(|packet| packet.id == main_packet.id)
            .collect();
        let on_replica = SyncEngine::serve_exchange(&replica, &main_id, &main_out, 0, &[])
            .await
            .expect("replica serve");
        assert_eq!(on_replica.accepted, 1);
        let main_value: String =
            sqlx::query_scalar("SELECT value FROM app_kv WHERE key = 'practice.packet.main'")
                .fetch_one(&replica)
                .await
                .expect("replica stored main value");
        assert_eq!(main_value, "from-main");

        let acked = SyncEngine::serve_exchange(&main, &replica_id, &[], main_packet.seq, &[])
            .await
            .expect("ack");
        assert!(
            acked
                .packets
                .iter()
                .all(|packet| packet.seq > main_packet.seq),
            "acknowledged main packets stay off the next page"
        );
    }
}
