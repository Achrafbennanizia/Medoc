//! T4.5: Group has up to 5 devices. Random field edits on every device, delivered between them
//! in any order, partially (partitions), and more than once (restarts / mode O re-sends), must
//! converge: every device ends with the same row, and for each field the edit with the newest
//! field clock wins (no edit to another field is lost, editions-plan §4.3 `LwwField`).

use std::collections::BTreeMap;

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::hlc::stamp_in_tx;
use medoc_sync::merge::{apply_remote_entry, ConflictPolicy};
use medoc_sync::repo::OutboxEntry;
use medoc_sync::schema::ensure_sync_tables;
use proptest::prelude::*;
use sqlx::SqlitePool;

const ID: &str = "00000000-0000-0000-0000-00000000f5d5";
const DEVICES: usize = 5;
const FIELDS: [&str; 3] = ["phone", "address", "email"];

#[derive(Debug, Clone)]
enum Op {
    /// Device edits one field.
    Edit { device: usize, field: usize, value: u16 },
    /// Device `from` hands its known entries to `to` (one direction of a link that is up).
    Deliver { from: usize, to: usize },
}

fn op() -> impl Strategy<Value = Op> {
    prop_oneof![
        (0..DEVICES, 0..FIELDS.len(), any::<u16>())
            .prop_map(|(device, field, value)| Op::Edit { device, field, value }),
        (0..DEVICES, 0..DEVICES).prop_map(|(from, to)| Op::Deliver { from, to }),
    ]
}

async fn device() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

/// The row is created once, on device 0, and reaches the others through sync (as in the app).
async fn create_row(pool: &SqlitePool) -> OutboxEntry {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at)
         VALUES (?1, 'Anna', '1990-01-01', 'FEMALE', 'V-1', 'ACTIVE', '2026-01-01 00:00:00', '2026-01-01 00:00:00')",
    )
    .bind(ID)
    .execute(pool)
    .await
    .expect("seed");
    let mut e = edit(pool, "device-0", 0, "phone", "start").await;
    e.op = "INSERT".into();
    e
}

async fn row(pool: &SqlitePool) -> (Option<String>, Option<String>, Option<String>) {
    sqlx::query_as("SELECT phone, address, email FROM patient WHERE id = ?1")
        .bind(ID)
        .fetch_one(pool)
        .await
        .unwrap()
}

/// A local edit as the app makes it: write the row, stamp the changed field, queue the entry.
async fn edit(pool: &SqlitePool, origin: &str, seq: i64, field: &str, value: &str) -> OutboxEntry {
    let updated_at = format!("2026-02-01 00:00:{:02}", seq % 60);
    sqlx::query(&format!(
        "UPDATE patient SET {field} = ?1, updated_at = ?2 WHERE id = ?3"
    ))
    .bind(value)
    .bind(&updated_at)
    .bind(ID)
    .execute(pool)
    .await
    .unwrap();
    let (phone, address, email) = row(pool).await;
    let payload = serde_json::json!({
        "id": ID, "name": "Anna", "date_of_birth": "1990-01-01", "sex": "FEMALE",
        "insurance_number": "V-1", "status": "ACTIVE", "created_at": "2026-01-01 00:00:00",
        "phone": phone, "address": address, "email": email, "updated_at": updated_at,
    });
    let mut tx = pool.begin().await.unwrap();
    let stamped = stamp_in_tx(&mut tx, "patient", ID, &payload.to_string()).await.unwrap();
    tx.commit().await.unwrap();
    OutboxEntry {
        id: format!("{origin}-{seq}"),
        device_id: origin.into(),
        seq,
        entity_table: "patient".into(),
        entity_id: ID.into(),
        op: "UPDATE".into(),
        payload_json: stamped,
        created_at: "2026-02-01T00:00:00Z".into(),
    }
}

async fn deliver(pool: &SqlitePool, local: &str, entry: &OutboxEntry) {
    // Receivers are replicas (no main-device tie-break), as in mode O.
    apply_remote_entry(pool, local, false, ConflictPolicy::LastWriteWins, entry)
        .await
        .expect("apply");
}

fn rt() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime")
}

proptest! {
    #![proptest_config(ProptestConfig { cases: 8, max_shrink_iters: 8, .. ProptestConfig::default() })]

    #[test]
    fn five_devices_converge_and_keep_the_newest_edit_of_each_field(
        ops in prop::collection::vec(op(), 1..30),
        final_order in any::<u64>(),
    ) {
        rt().block_on(async {
            let mut pools = Vec::new();
            for _ in 0..DEVICES {
                pools.push(device().await);
            }
            let names: Vec<String> = (0..DEVICES).map(|d| format!("device-{d}")).collect();
            let created = create_row(&pools[0]).await;
            for d in 1..DEVICES {
                deliver(&pools[d], &format!("device-{d}"), &created).await;
            }
            // What each device knows: its own edits plus what it received (forwarding, mode O).
            let mut known: Vec<BTreeMap<String, OutboxEntry>> = vec![BTreeMap::new(); DEVICES];
            let mut seq = vec![0i64; DEVICES];
            // Newest edit per field, in the order edits happened (field clocks follow it).
            let mut expected: BTreeMap<usize, String> = BTreeMap::new();

            for op in &ops {
                match *op {
                    Op::Edit { device, field, value } => {
                        // Field clocks are wall-clock based: keep edits a tick apart.
                        tokio::time::sleep(std::time::Duration::from_millis(2)).await;
                        seq[device] += 1;
                        let value = format!("v{value}-{device}-{}", seq[device]);
                        let e = edit(&pools[device], &names[device], seq[device], FIELDS[field], &value).await;
                        known[device].insert(e.id.clone(), e);
                        expected.insert(field, value);
                    }
                    Op::Deliver { from, to } if from != to => {
                        let batch: Vec<OutboxEntry> = known[from].values().cloned().collect();
                        for e in &batch {
                            deliver(&pools[to], &names[to], e).await;
                            known[to].insert(e.id.clone(), e.clone());
                        }
                    }
                    Op::Deliver { .. } => {}
                }
            }

            // Network heals: everything reaches everyone, in a shuffled order, twice.
            let mut all: Vec<OutboxEntry> = known.iter().flat_map(|k| k.values().cloned()).collect();
            let mut state = final_order | 1;
            for i in (1..all.len()).rev() {
                state ^= state << 13; state ^= state >> 7; state ^= state << 17;
                all.swap(i, (state as usize) % (i + 1));
            }
            for d in 0..DEVICES {
                for e in all.iter().chain(all.iter()) {
                    deliver(&pools[d], &names[d], e).await;
                }
            }

            let first = row(&pools[0]).await;
            for pool in &pools[1..] {
                prop_assert_eq!(row(pool).await, first.clone(), "devices diverge");
            }
            let got = [first.0, first.1, first.2];
            for (field, value) in &expected {
                prop_assert_eq!(got[*field].as_deref(), Some(value.as_str()), "field {} lost its newest edit", FIELDS[*field]);
            }
            Ok(())
        })?;
    }
}
