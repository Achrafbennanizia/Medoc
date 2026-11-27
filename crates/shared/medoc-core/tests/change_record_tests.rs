//! T5.8 phase 2: every change to a patient or money record keeps who made it, on which device,
//! and the record as it was after the change; History shows field-by-field old → new.
//! Duo and Group only (`cap-multi-staff`).

use medoc_core::application::history::{self, HistoryEntry};
use medoc_core::infrastructure::database::actor;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::sync_outbox::record_or_noop;
use sqlx::SqlitePool;

async fn pool() -> SqlitePool {
    let pool = test_memory_pool().await.unwrap();
    run_migrations(&pool).await.unwrap();
    pool
}

async fn insert_patient(pool: &SqlitePool, id: &str, name: &str) {
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at)
         VALUES (?1, ?2, '1990-01-01', 'FEMALE', ?1 || '-V', 'ACTIVE', 'now', 'now')",
    )
    .bind(id)
    .bind(name)
    .execute(pool)
    .await
    .unwrap();
}

async fn rename(pool: &SqlitePool, id: &str, name: &str, by: &str) {
    sqlx::query("UPDATE patient SET name = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?2")
        .bind(name)
        .bind(id)
        .execute(pool)
        .await
        .unwrap();
    actor::with_actor(by, async {
        record_or_noop(pool, "patient", id, "UPDATE", "").await.unwrap();
    })
    .await;
}

fn change<'a>(e: &'a HistoryEntry, field: &str) -> Option<&'a history::FieldChange> {
    e.changes.iter().find(|c| c.field == field)
}

#[tokio::test]
async fn a_local_change_is_recorded_with_its_author_even_without_replicas() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = pool().await;
    insert_patient(&pool, "p1", "Salma").await;
    actor::with_actor("dr-a", async {
        record_or_noop(&pool, "patient", "p1", "INSERT", "").await.unwrap();
    })
    .await;
    rename(&pool, "p1", "Salma B.", "desk-1").await;

    let h = history::for_record(&pool, "patient", "p1").await.unwrap();
    assert_eq!(h.len(), 2, "{h:?}");
    // Newest first.
    assert_eq!(h[0].actor_staff_id.as_deref(), Some("desk-1"));
    assert_eq!(h[1].actor_staff_id.as_deref(), Some("dr-a"));
    let c = change(&h[0], "name").expect("name changed");
    assert_eq!(c.old, serde_json::json!("Salma"));
    assert_eq!(c.new, serde_json::json!("Salma B."));
    assert!(change(&h[0], "updated_at").is_none(), "bookkeeping fields are not shown");
    assert!(change(&h[0], "date_of_birth").is_none(), "unchanged fields are not shown");
    assert!(!h[0].device_id.is_empty());
}

#[tokio::test]
async fn clinical_rows_are_filed_under_their_patient() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = pool().await;
    insert_patient(&pool, "p2", "Omar").await;
    sqlx::query("INSERT INTO patient_chart (id, patient_id) VALUES ('ch2', 'p2')")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("INSERT INTO examination (id, chart_id, results) VALUES ('ex2', 'ch2', 'caries 16')")
        .execute(&pool)
        .await
        .unwrap();
    actor::with_actor("dr-a", async {
        record_or_noop(&pool, "examination", "ex2", "INSERT", "").await.unwrap();
    })
    .await;
    let h = history::for_patient(&pool, "p2", &["examination"]).await.unwrap();
    assert_eq!(h.len(), 1);
    assert_eq!(h[0].table, "examination");
    assert!(
        history::for_patient(&pool, "p2", &["patient"]).await.unwrap().is_empty(),
        "only the tables the caller may see"
    );
}

#[tokio::test]
async fn untracked_tables_have_no_history() {
    let pool = pool().await;
    sqlx::query("INSERT INTO product (id, name, category, price) VALUES ('pr1', 'Gloves', 'CONSUMABLE', 1.0)")
        .execute(&pool)
        .await
        .unwrap();
    record_or_noop(&pool, "product", "pr1", "INSERT", "").await.unwrap();
    assert!(history::for_record(&pool, "product", "pr1").await.unwrap().is_empty());
}

/// GDPR: once a patient is pseudonymised, the old values leave History (the pseudonymised
/// row itself is the only record left). Other devices do the same when the row arrives.
#[tokio::test]
async fn erasure_removes_old_values_from_history() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = pool().await;
    insert_patient(&pool, "p3", "Leila Secret").await;
    rename(&pool, "p3", "Leila Secret 2", "dr-a").await;
    sqlx::query("UPDATE patient SET name = 'Anonymisiert (p3)', insurance_number = 'ANON-p3', phone = NULL WHERE id = 'p3'")
        .execute(&pool)
        .await
        .unwrap();
    record_or_noop(&pool, "patient", "p3", "UPDATE", "").await.unwrap();

    let h = history::for_record(&pool, "patient", "p3").await.unwrap();
    assert_eq!(h.len(), 1, "{h:?}");
    let all: String = sqlx::query_scalar("SELECT group_concat(payload_json) FROM change_record")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(!all.contains("Leila"), "no trace of the old name: {all}");
}

/// Fields holding a staff id show the person's name next to the id.
#[tokio::test]
async fn staff_fields_carry_names() {
    if !medoc_core::edition::CORE_CAPS.multi_staff {
        return;
    }
    let pool = pool().await;
    sqlx::query("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES ('dr-n', 'Dr. Nadia', 'n@x', 'x', 'PHYSICIAN', 1)")
        .execute(&pool)
        .await
        .unwrap();
    insert_patient(&pool, "p4", "Karim").await;
    sqlx::query("UPDATE patient SET treating_staff_id = 'dr-n' WHERE id = 'p4'")
        .execute(&pool)
        .await
        .unwrap();
    record_or_noop(&pool, "patient", "p4", "UPDATE", "").await.unwrap();
    let h = history::for_record(&pool, "patient", "p4").await.unwrap();
    let c = change(&h[0], "treating_staff_id").expect("treating doctor");
    assert_eq!(c.new_label.as_deref(), Some("Dr. Nadia"));
}
