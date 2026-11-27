//! Pools, entries and seed rows for the merge tests (split from `merge_apply_tests.rs`).

use super::*;

pub(super) const LOCAL_MASTER: &str = "local-master-id";
pub(super) const LOCAL_REPLICA: &str = "local-replica-id";

pub(super) async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

pub(super) fn entry(
    device: &str,
    seq: i64,
    table: &str,
    id: &str,
    op: &str,
    payload: &str,
) -> OutboxEntry {
    OutboxEntry {
        id: format!("e{seq}"),
        device_id: device.into(),
        seq,
        entity_table: table.into(),
        entity_id: id.into(),
        op: op.into(),
        payload_json: payload.into(),
        created_at: "2099-01-01T00:00:00Z".into(),
    }
}

pub(super) async fn seed_patient(pool: &SqlitePool, id: &str, name: &str, updated_at: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                              phone, email, address, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MALE', 'V-1', NULL, NULL, NULL, 'ACTIVE',
                 '2099-01-01 00:00:00', ?3)",
    )
    .bind(id)
    .bind(name)
    .bind(updated_at)
    .execute(pool)
    .await
    .expect("seed patient");
}
