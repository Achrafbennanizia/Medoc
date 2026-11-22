//! Every change must reach every device, in both directions, exactly once.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::merge::{apply_remote_entry, ConflictPolicy};
use medoc_sync::repo::{
    enqueue_snapshot_for, ensure_local_device, list_entries_since_for, list_exchange_packets,
    mark_peer_delivery_for_queues, save_deployment, OutboxEntry,
};
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

async fn main_pool() -> (SqlitePool, String) {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    save_deployment(
        &pool,
        &SyncDeploymentConfig {
            schema_version: 1,
            mode: DeploymentMode::ServerlessPeer,
            role: DeviceRole::Master,
            device_label: "Main".into(),
            ..Default::default()
        },
    )
    .await
    .expect("deployment");
    let id = ensure_local_device(&pool, "Main").await.expect("device");
    (pool, id)
}

async fn seed_patient(pool: &SqlitePool, id: &str, insurance: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status,
                              created_at, updated_at)
         VALUES (?1, 'Pat', '1990-01-01', 'MALE', ?2, 'ACTIVE',
                 '2099-01-01 00:00:00', '2099-01-01T00:00:00.000Z')",
    )
    .bind(id)
    .bind(insurance)
    .execute(pool)
    .await
    .expect("seed patient");
}

fn entry(seq: i64, table: &str, id: &str, op: &str, payload: String) -> OutboxEntry {
    OutboxEntry {
        id: format!("remote-{seq}"),
        device_id: "remote-replica".into(),
        seq,
        entity_table: table.into(),
        entity_id: id.into(),
        op: op.into(),
        payload_json: payload,
        created_at: "2099-01-01T00:00:00Z".into(),
    }
}

fn patient_payload(id: &str, hlc: &str, updated_at: &str) -> String {
    serde_json::json!({
        "id": id, "name": "Edited", "date_of_birth": "1990-01-01", "sex": "MALE",
        "insurance_number": "V-RES", "status": "ACTIVE",
        "created_at": "2099-01-01 00:00:00", "updated_at": updated_at, "syncHlc": hlc,
    })
    .to_string()
}

async fn patients(pool: &SqlitePool, id: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn a_live_edit_recorded_by_a_repository_reaches_the_exchange() {
    let (pool, main_id) = main_pool().await;
    seed_patient(&pool, "live-p", "V-LIVE").await;
    // The path every repository uses (no `sync_packet_queue` row).
    medoc_core::infrastructure::database::recorded_write::record_row(
        &pool, "patient", "live-p", "INSERT",
    )
    .await
    .expect("record");
    let out = list_exchange_packets(&pool, &main_id, "replica-a", &[], 50)
        .await
        .expect("list");
    assert!(
        out.iter().any(|e| e.entity_id == "live-p"),
        "a repository write must be offered on the exchange path"
    );
}

#[tokio::test]
async fn a_queue_filtered_exchange_does_not_skip_other_queues() {
    let (pool, main_id) = main_pool().await;
    medoc_core::infrastructure::database::repos::admin::app_kv::set(
        &pool,
        "practice.preferences.v1",
        "{}",
    )
    .await
    .unwrap();
    seed_patient(&pool, "q-p", "V-Q").await;
    medoc_core::infrastructure::database::recorded_write::record_row(
        &pool, "patient", "q-p", "INSERT",
    )
    .await
    .unwrap();
    let all = list_exchange_packets(&pool, &main_id, "replica-a", &[], 50)
        .await
        .unwrap();
    let last = all.iter().map(|e| e.seq).max().unwrap();

    // The replica exchanged only the patients queue and acknowledged it.
    mark_peer_delivery_for_queues(&pool, &main_id, "replica-a", &["patients".into()], last)
        .await
        .unwrap();
    let rest = list_exchange_packets(&pool, &main_id, "replica-a", &[], 50)
        .await
        .unwrap();
    assert!(
        rest.iter().any(|e| e.entity_table == "app_kv"),
        "the parameters queue was never sent and must still be offered"
    );
    assert!(!rest.iter().any(|e| e.entity_id == "q-p"));
}

#[tokio::test]
async fn an_initial_copy_goes_to_the_joining_device_only() {
    let (pool, main_id) = main_pool().await;
    seed_patient(&pool, "snap-p", "V-SNAP").await;
    let n = enqueue_snapshot_for(&pool, Some("replica-b"))
        .await
        .unwrap();
    assert!(n > 0);
    let for_b = list_entries_since_for(&pool, &main_id, 0, Some("replica-b"))
        .await
        .unwrap();
    assert!(for_b.iter().any(|e| e.entity_id == "snap-p"));
    let for_a = list_entries_since_for(&pool, &main_id, 0, Some("replica-a"))
        .await
        .unwrap();
    assert!(
        !for_a.iter().any(|e| e.entity_id == "snap-p"),
        "replica A must not download B's copy"
    );
    // A second request replaces the copy instead of doubling it.
    enqueue_snapshot_for(&pool, Some("replica-b"))
        .await
        .unwrap();
    let copies: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE snapshot_for = 'replica-b' AND entity_id = 'snap-p'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(copies, 1);
}

#[tokio::test]
async fn an_older_offline_edit_does_not_bring_a_deleted_row_back() {
    let (pool, main_id) = main_pool().await;
    seed_patient(&pool, "del-p", "V-DEL").await;
    let del = entry(
        1,
        "patient",
        "del-p",
        "DELETE",
        r#"{"id":"del-p","syncHlc":"2000000000000:0"}"#.into(),
    );
    apply_remote_entry(&pool, &main_id, true, ConflictPolicy::LastWriteWins, &del)
        .await
        .unwrap();
    assert_eq!(patients(&pool, "del-p").await, 0);

    let old_edit = entry(
        2,
        "patient",
        "del-p",
        "UPDATE",
        patient_payload("del-p", "1000000000000:0", "2001-01-01T00:00:00Z"),
    );
    apply_remote_entry(
        &pool,
        &main_id,
        true,
        ConflictPolicy::LastWriteWins,
        &old_edit,
    )
    .await
    .unwrap();
    assert_eq!(
        patients(&pool, "del-p").await,
        0,
        "stale edit resurrected the row"
    );

    let new_edit = entry(
        3,
        "patient",
        "del-p",
        "UPDATE",
        patient_payload("del-p", "3000000000000:0", "2099-06-01T00:00:00Z"),
    );
    apply_remote_entry(
        &pool,
        &main_id,
        true,
        ConflictPolicy::LastWriteWins,
        &new_edit,
    )
    .await
    .unwrap();
    assert_eq!(
        patients(&pool, "del-p").await,
        1,
        "a newer re-creation applies"
    );
}

#[tokio::test]
async fn an_older_delete_does_not_remove_a_newer_edit() {
    let (pool, main_id) = main_pool().await;
    seed_patient(&pool, "keep-p", "V-KEEP").await;
    medoc_sync::hlc::save_row(
        &pool,
        "patient",
        "keep-p",
        medoc_sync::hlc::Hlc {
            wall_ms: 5_000_000_000_000,
            counter: 0,
        },
    )
    .await
    .unwrap();
    let stale = entry(
        1,
        "patient",
        "keep-p",
        "DELETE",
        r#"{"id":"keep-p","syncHlc":"1000000000000:0"}"#.into(),
    );
    apply_remote_entry(&pool, &main_id, true, ConflictPolicy::LastWriteWins, &stale)
        .await
        .unwrap();
    assert_eq!(patients(&pool, "keep-p").await, 1);
}

#[test]
fn cash_book_and_reminders_are_replicated() {
    use medoc_core::infrastructure::database::sync_registry::{is_synced_table, queue_of};
    for t in ["cash_movement", "payment_reminder"] {
        assert!(is_synced_table(t), "{t}");
        assert_eq!(queue_of(t), "finance");
    }
}
