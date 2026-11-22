//! Patch 3: no silent loss, no unbounded outbox, no overwritten local edits.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::merge::{apply_remote_entry, apply_remote_entry_phased, ConflictPolicy};
use medoc_sync::repo::{
    append_outbox, ensure_local_device, mark_peer_delivery, prune_outbox, pruned_through,
    save_deployment, OutboxEntry,
};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn pool_as(role: DeviceRole) -> (SqlitePool, String) {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role,
            device_label: "Device".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
    let id = ensure_local_device(&pool, "Device").await.expect("device");
    (pool, id)
}

fn entry(seq: i64, table: &str, id: &str, op: &str, payload: String) -> OutboxEntry {
    OutboxEntry {
        id: format!("remote-{seq}"),
        device_id: "remote-device".into(),
        seq,
        entity_table: table.into(),
        entity_id: id.into(),
        op: op.into(),
        payload_json: payload,
        created_at: "2099-01-01T00:00:00Z".into(),
    }
}

async fn seed_patient(pool: &SqlitePool, id: &str, insurance: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status,
                              created_at, updated_at)
         VALUES (?1, 'Local', '1990-01-01', 'MALE', ?2, 'ACTIVE',
                 '2099-01-01 00:00:00', '2099-01-01T00:00:00.000Z')",
    )
    .bind(id)
    .bind(insurance)
    .execute(pool)
    .await
    .expect("seed patient");
}

#[tokio::test]
async fn a_duplicate_patient_from_another_device_never_deletes_the_local_one() {
    let (pool, local) = pool_as(DeviceRole::Master).await;
    seed_patient(&pool, "local-p", "V-SAME").await;
    let remote = serde_json::json!({
        "id": "remote-p", "name": "Remote", "date_of_birth": "1990-01-01", "sex": "MALE",
        "insurance_number": "V-SAME", "status": "ACTIVE",
        "created_at": "2099-01-01 00:00:00", "updated_at": "2099-02-01T00:00:00Z",
    })
    .to_string();
    let e = entry(1, "patient", "remote-p", "INSERT", remote);
    apply_remote_entry(&pool, &local, true, ConflictPolicy::LastWriteWins, &e)
        .await
        .expect("handled");
    let local_kept: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE id = 'local-p'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(
        local_kept, 1,
        "INSERT OR REPLACE used to delete this patient"
    );
    let problems = medoc_sync::problems::list(&pool, false).await.unwrap();
    assert!(problems.iter().any(
        |p| p.kind == medoc_sync::problems::kind::UNIQUE_CONFLICT && p.entity_id == "remote-p"
    ));
}

#[tokio::test]
async fn the_outbox_is_pruned_only_behind_every_replica() {
    let (pool, main) = pool_as(DeviceRole::Master).await;
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, last_seen_at)
         VALUES ('replica-1', 'R1', 'REPLICA', 0, CURRENT_TIMESTAMP)",
    )
    .execute(&pool)
    .await
    .unwrap();
    let mut seqs = Vec::new();
    for i in 0..4 {
        let e = append_outbox(
            &pool,
            &main,
            "app_kv",
            &format!("practice.k{i}"),
            "UPDATE",
            "{}",
        )
        .await
        .unwrap();
        seqs.push(e.seq);
    }
    sqlx::query("UPDATE sync_outbox SET created_at = '2000-01-01T00:00:00+00:00'")
        .execute(&pool)
        .await
        .unwrap();
    mark_peer_delivery(&pool, &main, "replica-1", seqs[1])
        .await
        .unwrap();
    prune_outbox(&pool).await.unwrap();
    let left: Vec<i64> = sqlx::query_scalar("SELECT seq FROM sync_outbox ORDER BY seq")
        .fetch_all(&pool)
        .await
        .unwrap();
    assert_eq!(
        left,
        vec![seqs[2], seqs[3]],
        "rows the replica has not got must stay"
    );
    assert_eq!(pruned_through(&pool).await, seqs[1]);
}

#[tokio::test]
async fn the_main_calendar_does_not_overwrite_an_unsent_local_edit() {
    let (pool, local) = pool_as(DeviceRole::Replica).await;
    seed_patient(&pool, "cal-p", "V-CAL").await;
    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id, updated_at)
         VALUES ('apt-1', '2099-03-01', '09:00', 'CHECKUP', 'PLANNED', 'cal-p',
                 'seed-physician-001', '2099-02-01T10:00:00.000Z')",
    )
    .execute(&pool)
    .await
    .unwrap();
    // The receptionist moved the appointment; the push has not gone through yet.
    append_outbox(&pool, &local, "appointment", "apt-1", "UPDATE", "{}")
        .await
        .unwrap();
    let older_main = serde_json::json!({
        "id": "apt-1", "date": "2099-03-01", "time": "11:00", "kind": "CHECKUP",
        "status": "PLANNED", "patient_id": "cal-p", "physician_id": "seed-physician-001",
        "updated_at": "2099-01-15T10:00:00.000Z",
    })
    .to_string();
    let e = entry(1, "appointment", "apt-1", "UPDATE", older_main);
    apply_remote_entry_phased(
        &pool,
        &local,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap();
    let time: String = sqlx::query_scalar("SELECT time FROM appointment WHERE id = 'apt-1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(time, "09:00");
}

#[tokio::test]
async fn a_replica_keeps_the_main_devices_stamp_as_sent() {
    let (pool, local) = pool_as(DeviceRole::Replica).await;
    seed_patient(&pool, "hlc-p", "V-HLC").await;
    medoc_sync::hlc::save_row(
        &pool,
        "patient",
        "hlc-p",
        medoc_sync::hlc::Hlc {
            wall_ms: 1,
            counter: 0,
        },
    )
    .await
    .unwrap();
    // The main device's clock is ahead of this (slow) replica.
    let ahead = chrono::Utc::now().timestamp_millis() + 3_600_000;
    let payload = serde_json::json!({
        "id": "hlc-p", "name": "From main", "updated_at": "2099-05-01T00:00:00Z",
        "syncHlc": format!("{ahead}:2"),
    })
    .to_string();
    let e = entry(1, "patient", "hlc-p", "UPDATE", payload);
    apply_remote_entry_phased(
        &pool,
        &local,
        false,
        true,
        ConflictPolicy::LastWriteWins,
        &e,
    )
    .await
    .unwrap();
    let saved = medoc_sync::hlc::load_row(&pool, "patient", "hlc-p")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(
        saved.wall_ms, ahead,
        "the main device's stamp must not be rewritten"
    );
}
