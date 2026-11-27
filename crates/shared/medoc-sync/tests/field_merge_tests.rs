//! T3.2: patient, appointment and task rows merge field by field (editions plan, P3).

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::hlc::{parse_hlc, stamp_in_tx};
use medoc_sync::merge::{apply_remote_entry, ConflictPolicy};
use medoc_sync::repo::OutboxEntry;
use medoc_sync::schema::ensure_sync_tables;
use sqlx::SqlitePool;

const ID: &str = "00000000-0000-0000-0000-00000000f001";

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number,
                              phone, email, address, status, created_at, updated_at)
         VALUES (?1, 'Anna', '1990-01-01', 'FEMALE', 'V-1', NULL, NULL, NULL, 'ACTIVE',
                 '2026-01-01 00:00:00', '2026-01-01 00:00:00')",
    )
    .bind(ID)
    .execute(&pool)
    .await
    .expect("seed patient");
    pool
}

/// A local write as `recorded_write` makes it: stamps the row and its changed fields.
async fn local_write(pool: &SqlitePool, payload: serde_json::Value) -> serde_json::Value {
    let mut tx = pool.begin().await.unwrap();
    let out = stamp_in_tx(&mut tx, "patient", ID, &payload.to_string())
        .await
        .unwrap();
    tx.commit().await.unwrap();
    serde_json::from_str(&out).unwrap()
}

fn row(phone: Option<&str>, address: Option<&str>, updated_at: &str) -> serde_json::Value {
    serde_json::json!({
        "id": ID, "name": "Anna", "phone": phone, "address": address, "updated_at": updated_at
    })
}

#[tokio::test]
async fn a_local_write_bumps_only_the_fields_it_changes() {
    let pool = fresh_pool().await;
    let first = local_write(&pool, row(None, None, "2026-01-01 00:00:00")).await;
    let second = local_write(&pool, row(Some("0151"), None, "2026-01-02 00:00:00")).await;
    let f1 = &first["syncFieldHlc"];
    let f2 = &second["syncFieldHlc"];
    assert_eq!(f1["name"], f2["name"], "unchanged field keeps its stamp");
    assert_eq!(f1["address"], f2["address"]);
    assert_ne!(f1["phone"], f2["phone"], "changed field gets the new stamp");
    assert_eq!(f2["phone"], second["syncHlc"]);
}

#[tokio::test]
async fn two_devices_editing_different_fields_offline_both_keep_their_edit() {
    let pool = fresh_pool().await;
    local_write(&pool, row(None, None, "2026-01-01 00:00:00")).await;
    // This device changes the phone number.
    sqlx::query(
        "UPDATE patient SET phone = '0151', updated_at = '2026-01-02 00:00:00' WHERE id = ?1",
    )
    .bind(ID)
    .execute(&pool)
    .await
    .unwrap();
    let local = local_write(&pool, row(Some("0151"), None, "2026-01-02 00:00:00")).await;
    let local_hlc = parse_hlc(local["syncHlc"].as_str().unwrap()).unwrap();

    // The other device changed only the address, later, and still holds the old phone.
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    let later = format!("{}:0", local_hlc.wall_ms + 1);
    let mut remote = row(None, Some("Hauptstr. 1"), "2026-01-03 00:00:00");
    remote["syncHlc"] = serde_json::json!(later);
    remote["syncFieldHlc"] = serde_json::json!({
        "id": "1:0", "name": "1:0", "phone": "1:0", "address": later, "updated_at": later
    });
    let entry = OutboxEntry {
        id: "e1".into(),
        device_id: "other-device".into(),
        seq: 1,
        entity_table: "patient".into(),
        entity_id: ID.into(),
        op: "UPDATE".into(),
        payload_json: remote.to_string(),
        created_at: "2026-01-03T00:00:00Z".into(),
    };
    assert!(apply_remote_entry(
        &pool,
        "this-device",
        true,
        ConflictPolicy::LastWriteWins,
        &entry
    )
    .await
    .unwrap());

    let (phone, address): (Option<String>, Option<String>) =
        sqlx::query_as("SELECT phone, address FROM patient WHERE id = ?1")
            .bind(ID)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(phone.as_deref(), Some("0151"), "local phone edit survives");
    assert_eq!(
        address.as_deref(),
        Some("Hauptstr. 1"),
        "remote address edit arrives"
    );

    // The next local write does not re-stamp the address it just received.
    let next = local_write(
        &pool,
        row(Some("0151"), Some("Hauptstr. 1"), "2026-01-03 00:00:00"),
    )
    .await;
    assert_eq!(next["syncFieldHlc"]["address"], serde_json::json!(later));
}

fn update_from(device: &str, seq: i64, payload: &serde_json::Value) -> OutboxEntry {
    OutboxEntry {
        id: format!("{device}-{seq}"),
        device_id: device.into(),
        seq,
        entity_table: "patient".into(),
        entity_id: ID.into(),
        op: "UPDATE".into(),
        payload_json: payload.to_string(),
        created_at: "2026-01-03T00:00:00Z".into(),
    }
}

/// A replica's change of `phone`, made on top of the phone stamp `base`.
fn replica_phone_edit(phone: &str, base: &str, stamp: &str) -> serde_json::Value {
    let mut p = row(Some(phone), None, "2026-01-03 00:00:00");
    p["syncHlc"] = serde_json::json!(stamp);
    p["syncFieldHlc"] = serde_json::json!({
        "name": "1:0", "phone": stamp, "address": "1:0", "updated_at": stamp
    });
    p["syncFieldBase"] = serde_json::json!({ "phone": base, "updated_at": base });
    p
}

async fn open_conflicts(pool: &SqlitePool) -> Vec<medoc_sync::problems::SyncProblem> {
    medoc_sync::problems::list(pool, false)
        .await
        .unwrap()
        .into_iter()
        .filter(|p| p.kind == medoc_sync::problems::kind::FIELD_CONFLICT)
        .collect()
}

async fn phone(pool: &SqlitePool) -> Option<String> {
    sqlx::query_scalar("SELECT phone FROM patient WHERE id = ?1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

#[tokio::test]
async fn a_concurrent_edit_of_the_same_field_lands_in_the_main_inbox() {
    let pool = fresh_pool().await;
    let base = local_write(&pool, row(None, None, "2026-01-01 00:00:00")).await;
    let base_phone = base["syncFieldHlc"]["phone"].as_str().unwrap().to_string();
    // The main device changes the phone…
    sqlx::query("UPDATE patient SET phone = '0151' WHERE id = ?1")
        .bind(ID)
        .execute(&pool)
        .await
        .unwrap();
    let main = local_write(&pool, row(Some("0151"), None, "2026-01-02 00:00:00")).await;
    let main_hlc = parse_hlc(main["syncHlc"].as_str().unwrap()).unwrap();
    // …and a replica, which never saw that, changes it too, later.
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    let later = format!("{}:0", main_hlc.wall_ms + 1);
    let e = update_from(
        "replica",
        1,
        &replica_phone_edit("0170", &base_phone, &later),
    );
    apply_remote_entry(&pool, "main", true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();

    assert_eq!(
        phone(&pool).await.as_deref(),
        Some("0170"),
        "newer edit kept"
    );
    let open = open_conflicts(&pool).await;
    assert_eq!(open.len(), 1);
    let detail: serde_json::Value = serde_json::from_str(&open[0].error).unwrap();
    assert_eq!(detail["kept"]["phone"], "0170");
    assert_eq!(detail["other"]["phone"], "0151");

    // The admin takes the other value: written as a new local edit.
    medoc_sync::problems::retry(&pool, &open[0].id, "admin")
        .await
        .unwrap();
    assert_eq!(phone(&pool).await.as_deref(), Some("0151"));
    assert!(open_conflicts(&pool).await.is_empty());
}

#[tokio::test]
async fn a_later_edit_made_on_top_of_the_main_value_is_no_conflict() {
    let pool = fresh_pool().await;
    local_write(&pool, row(None, None, "2026-01-01 00:00:00")).await;
    sqlx::query("UPDATE patient SET phone = '0151' WHERE id = ?1")
        .bind(ID)
        .execute(&pool)
        .await
        .unwrap();
    let main = local_write(&pool, row(Some("0151"), None, "2026-01-02 00:00:00")).await;
    let main_phone = main["syncFieldHlc"]["phone"].as_str().unwrap().to_string();
    let main_hlc = parse_hlc(main["syncHlc"].as_str().unwrap()).unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
    let later = format!("{}:0", main_hlc.wall_ms + 1);
    // The replica had received 0151 and then changed it.
    let e = update_from(
        "replica",
        1,
        &replica_phone_edit("0170", &main_phone, &later),
    );
    apply_remote_entry(&pool, "main", true, ConflictPolicy::LastWriteWins, &e)
        .await
        .unwrap();
    assert_eq!(phone(&pool).await.as_deref(), Some("0170"));
    assert!(open_conflicts(&pool).await.is_empty());
}
