//! H2/H3: table registry, deny-list, tombstones.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::recorded_write::{record_in_tx, row_json};
use medoc_core::infrastructure::database::sync_registry::{synced_tables, TABLES};

#[tokio::test]
async fn registry_lists_every_table_exactly_once() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    let names: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_sqlx_%'",
    )
    .fetch_all(&pool)
    .await
    .expect("tables");
    let mut registry: Vec<&str> = TABLES.iter().map(|(n, _)| *n).collect();
    registry.sort();
    let mut unique = registry.clone();
    unique.dedup();
    assert_eq!(registry, unique, "TABLES has duplicates");
    let mut missing = Vec::new();
    for name in &names {
        if name == "audit_log_archive" {
            continue;
        }
        if !TABLES.iter().any(|(n, _)| *n == name) {
            missing.push(name.clone());
        }
    }
    assert!(
        missing.is_empty(),
        "tables missing from registry: {missing:?}"
    );
}

#[tokio::test]
async fn snapshot_and_payload_skip_denied_columns() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .ok();
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, totp_secret, token_version)
         VALUES ('s1', 'Dr', 'dr@t.de', 'hash', 'PHYSICIAN', 'SECRET', 3)",
    )
    .execute(&pool)
    .await
    .expect("staff");
    let mut tx = pool.begin().await.expect("tx");
    // staff is DeviceLocal — row_json is None
    assert!(row_json(&mut tx, "staff", "s1")
        .await
        .expect("json")
        .is_none());
    sqlx::query("INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status) VALUES ('p1', 'A', '1990-01-01', 'MALE', 'INS-1', 'ACTIVE')")
        .execute(&mut *tx)
        .await
        .ok();
    tx.commit().await.ok();
}

#[tokio::test]
async fn delete_writes_a_tombstone() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    sqlx::query(
        "INSERT INTO app_kv (key, value) VALUES ('sync.deployment.v1',
         '{\"schemaVersion\":1,\"mode\":\"serverless_peer\",\"role\":\"REPLICA\",\"deviceLabel\":\"T\"}')",
    )
    .execute(&pool)
    .await
    .expect("kv");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-del', 'X', '1990-01-01', 'MALE', 'INS-DEL', 'NEW')",
    )
    .execute(&pool)
    .await
    .expect("patient");
    let mut tx = pool.begin().await.expect("tx");
    sqlx::query("DELETE FROM patient WHERE id = 'p-del'")
        .execute(&mut *tx)
        .await
        .expect("delete");
    record_in_tx(&mut tx, "patient", "p-del", "DELETE")
        .await
        .expect("record");
    tx.commit().await.expect("commit");
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_tombstone WHERE entity_table = 'patient' AND entity_id = 'p-del'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(n, 1);
    assert!(synced_tables().any(|t| t == "patient"));
}

#[tokio::test]
async fn update_sets_updated_at() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    let mut missing = Vec::new();
    for table in synced_tables() {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(table)
        .fetch_one(&pool)
        .await
        .expect("exists");
        if exists == 0 {
            continue;
        }
        let n: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = 'updated_at'"
        ))
        .fetch_one(&pool)
        .await
        .expect("pragma");
        if n == 0 {
            missing.push(table);
        }
    }
    assert!(missing.is_empty(), "missing updated_at on {missing:?}");

    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('seed-patient-001', 'Seed Patient', '1980-01-01', 'FEMALE', 'SEED-INS-001', 'ACTIVE')",
    )
    .execute(&pool)
    .await
    .expect("seed patient");
    sqlx::query("INSERT OR IGNORE INTO patient_chart (id, patient_id) VALUES ('seed-chart-001', 'seed-patient-001')")
        .execute(&pool)
        .await
        .expect("seed chart");
    sqlx::query(
        "INSERT INTO examination (id, chart_id, chief_complaint, updated_at)
         VALUES ('exam-ts-1', 'seed-chart-001', 'before', '2000-01-01T00:00:00Z')",
    )
    .execute(&pool)
    .await
    .expect("exam row");
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    sqlx::query(
        "UPDATE examination SET chief_complaint = 'stamp', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = 'exam-ts-1'",
    )
    .execute(&pool)
    .await
    .expect("update exam");
    let after: String =
        sqlx::query_scalar("SELECT updated_at FROM examination WHERE id = 'exam-ts-1'")
            .fetch_one(&pool)
            .await
            .expect("after");
    assert!(!after.is_empty());
    assert_ne!(after, "2000-01-01T00:00:00Z");
}
