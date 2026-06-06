//! Property-based tests for `ConflictPolicy::MasterWinsWithFreshness`
//! as exercised through `SyncEngine::ingest_push` (which fans out to
//! `merge::apply_remote_entry`).
//!
//! Invariants:
//!
//! 1. **Freshest wins**: given a baseline row and N random UPDATE entries
//!    (each with a random `updated_at` and a unique name), the final row's
//!    name equals the entry with the maximum `updated_at` whose timestamp
//!    is strictly newer than the baseline, OR remains the baseline name
//!    when all incoming entries are older.
//!
//! 2. **Order independence**: applying the same set of entries in any
//!    permutation produces the same final row state.
//!
//! 3. **Idempotency**: pushing the same entry N times (same seq) produces
//!    the same end state as pushing it once.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::engine::SyncEngine;
use medoc_sync::repo::OutboxEntry;
use medoc_sync::schema::ensure_sync_tables;
use proptest::prelude::*;
use sqlx::SqlitePool;

const PATIENT_ID: &str = "00000000-0000-0000-0000-000000000abc";
const BASELINE_NAME: &str = "Baseline";
// 2050-01-01 — chosen so we can sample BEFORE and AFTER without overflow.
const BASELINE_TS_STR: &str = "2050-01-01 00:00:00";

async fn fresh_seeded_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("memory pool");
    run_migrations(&pool).await.expect("migrations");
    ensure_sync_tables(&pool).await.expect("schema");
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer,
                              telefon, email, adresse, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'MAENNLICH', 'V-BASELINE',
                 NULL, NULL, NULL, 'AKTIV', '2026-01-01 00:00:00', ?3)",
    )
    .bind(PATIENT_ID)
    .bind(BASELINE_NAME)
    .bind(BASELINE_TS_STR)
    .execute(&pool)
    .await
    .expect("seed patient");
    pool
}

async fn read_patient_state(pool: &SqlitePool) -> (String, String) {
    let row: (String, String) =
        sqlx::query_as("SELECT name, CAST(updated_at AS TEXT) FROM patient WHERE id = ?1")
            .bind(PATIENT_ID)
            .fetch_one(pool)
            .await
            .expect("read patient");
    row
}

fn baseline_ts() -> DateTime<Utc> {
    NaiveDate::from_ymd_opt(2050, 1, 1)
        .unwrap()
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
}

/// A planned update: how many days offset from the baseline, and a unique
/// device+seq combo so `apply_remote_entry` doesn't dedupe via `sync_applied`.
#[derive(Debug, Clone)]
struct Update {
    name: String,
    /// Signed offset from baseline_ts(), in days. Negative => older.
    day_offset: i64,
    device_seed: u8,
    seq: i64,
}

fn update_strat() -> impl Strategy<Value = Update> {
    (
        "[a-zA-Z]{3,16}",
        -1000_i64..=1000,
        1u8..=200,
        1i64..=1_000_000,
    )
        .prop_map(|(name, day_offset, device_seed, seq)| Update {
            name,
            day_offset,
            device_seed,
            seq,
        })
}

fn updates_set_strat() -> impl Strategy<Value = Vec<Update>> {
    prop::collection::vec(update_strat(), 1..=10).prop_map(|mut v| {
        // Dedupe by (device_seed, seq) so was_applied doesn't reject any.
        v.sort_by_key(|u| (u.device_seed, u.seq));
        v.dedup_by_key(|u| (u.device_seed, u.seq));
        // Also dedupe by day_offset+name so the "newest" entry is unique
        // (avoids ambiguity when two entries tie on updated_at).
        let mut seen_offsets = std::collections::HashSet::new();
        v.retain(|u| seen_offsets.insert(u.day_offset));
        v
    })
}

fn update_to_outbox_entry(u: &Update) -> OutboxEntry {
    let ts = baseline_ts() + Duration::days(u.day_offset);
    let iso = ts.to_rfc3339();
    let device_id = format!("merge-prop-dev-{}", u.device_seed);
    OutboxEntry {
        id: format!("e-{}-{}", u.device_seed, u.seq),
        device_id,
        seq: u.seq,
        entity_table: "patient".into(),
        entity_id: PATIENT_ID.into(),
        op: "UPDATE".into(),
        payload_json: format!(
            r#"{{"id":"{PATIENT_ID}","name":"{}","updated_at":"{iso}"}}"#,
            u.name
        ),
        created_at: iso,
    }
}

fn rt() -> tokio::runtime::Runtime {
    tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime")
}

/// Apply a single update via the engine.
async fn apply_one(pool: &SqlitePool, u: &Update) {
    let entry = update_to_outbox_entry(u);
    let dev = entry.device_id.clone();
    SyncEngine::ingest_push(pool, &dev, std::slice::from_ref(&entry))
        .await
        .expect("ingest");
}

proptest! {
    // Each case spins up a fresh in-memory SQLCipher pool, runs all
    // migrations and applies multiple async ingests, so we keep the case
    // count modest. Override via `PROPTEST_CASES=N` for deeper exploration.
    #![proptest_config(ProptestConfig {
        cases: 16,
        max_shrink_iters: 16,
        .. ProptestConfig::default()
    })]

    /// Invariant 1: after applying a random set of updates, the final
    /// `name` is determined entirely by the `updated_at` ordering:
    /// the freshest update strictly newer than the baseline wins.
    /// If all updates are older-or-equal than the baseline, the baseline
    /// row remains untouched.
    #[test]
    fn freshest_update_wins_regardless_of_arrival_order(
        updates in updates_set_strat(),
    ) {
        let rt = rt();
        rt.block_on(async {
            let pool = fresh_seeded_pool().await;
            for u in &updates {
                apply_one(&pool, u).await;
            }
            let (name, _ts) = read_patient_state(&pool).await;

            // Compute expected: among updates with day_offset > 0 (strictly
            // newer than baseline), find the largest offset and its name.
            let newest = updates
                .iter()
                .filter(|u| u.day_offset > 0)
                .max_by_key(|u| u.day_offset);
            let expected_name = newest.map(|u| u.name.clone()).unwrap_or_else(|| BASELINE_NAME.to_string());

            prop_assert_eq!(name.clone(), expected_name.clone());
            Ok(())
        })?;
    }

    /// Invariant 2: applying the same set in two different orders produces
    /// the same end state.
    #[test]
    fn merge_is_order_independent_on_end_state(
        updates in updates_set_strat(),
        order_seed in any::<u64>(),
    ) {
        let rt = rt();
        rt.block_on(async {
            let pool_a = fresh_seeded_pool().await;
            let pool_b = fresh_seeded_pool().await;

            // Order A: as-given.
            for u in &updates {
                apply_one(&pool_a, u).await;
            }

            // Order B: shuffled by a deterministic seed.
            let mut shuffled = updates.clone();
            // Simple Fisher–Yates with a Lehmer LCG seeded from the test input.
            let mut s = order_seed.wrapping_add(1);
            for i in (1..shuffled.len()).rev() {
                s = s.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                let j = (s as usize) % (i + 1);
                shuffled.swap(i, j);
            }
            for u in &shuffled {
                apply_one(&pool_b, u).await;
            }

            let (name_a, ts_a) = read_patient_state(&pool_a).await;
            let (name_b, ts_b) = read_patient_state(&pool_b).await;
            prop_assert_eq!(name_a, name_b, "order independence on name violated");
            prop_assert_eq!(ts_a, ts_b, "order independence on updated_at violated");
            Ok(())
        })?;
    }

    /// Invariant 3: applying the same entry multiple times produces the
    /// same state as applying it once (was_applied dedupes).
    #[test]
    fn idempotent_apply_of_same_entry(
        u in update_strat(),
        repeats in 2usize..=8,
    ) {
        let rt = rt();
        rt.block_on(async {
            let pool_once = fresh_seeded_pool().await;
            apply_one(&pool_once, &u).await;
            let (name_once, ts_once) = read_patient_state(&pool_once).await;

            let pool_many = fresh_seeded_pool().await;
            for _ in 0..repeats {
                apply_one(&pool_many, &u).await;
            }
            let (name_many, ts_many) = read_patient_state(&pool_many).await;

            prop_assert_eq!(name_once, name_many, "idempotency violated: name diverged");
            prop_assert_eq!(ts_once, ts_many, "idempotency violated: updated_at diverged");
            Ok(())
        })?;
    }
}
