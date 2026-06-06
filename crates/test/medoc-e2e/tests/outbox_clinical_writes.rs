//! Outbox coverage for `behandlung` + `untersuchung` repo write paths.
//!
//! These two tables are in [`SYNCED_TABLES`](medoc_core::infrastructure::database::sync_outbox)
//! but are not directly exercised by `sync_outbox_hooks_tests.rs` (which
//! focuses on patient/termin/aufgabe/zahlung). This file closes the gap
//! end-to-end:
//!
//! - `akte_repo::create_behandlung` → 1 outbox row on `behandlung`.
//! - `akte_repo::update_behandlung` → +1 row.
//! - `akte_repo::delete_behandlung` → +1 row.
//! - same lifecycle for `untersuchung`.
//! - `practice_desktop` mode must not append any rows.

use chrono::NaiveDate;
use medoc_core::domain::entities::behandlung::{
    CreateBehandlung, CreateUntersuchung, UpdateBehandlung, UpdateUntersuchung,
};
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Geschlecht;
use medoc_core::infrastructure::database::{akte_repo, app_kv_repo, connection, patient_repo};
use sqlx::SqlitePool;

const SERVERLESS_DEPLOYMENT_JSON: &str = r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"E2E"}"#;

async fn fresh_pool() -> SqlitePool {
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    pool
}

async fn enable_serverless(pool: &SqlitePool) {
    app_kv_repo::set(pool, "sync.deployment.v1", SERVERLESS_DEPLOYMENT_JSON)
        .await
        .expect("deployment kv");
}

async fn outbox_count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity_table = ?1")
        .bind(table)
        .fetch_one(pool)
        .await
        .unwrap()
}

async fn seed_patient_with_akte(pool: &SqlitePool, name: &str) -> (String, String) {
    let p = patient_repo::create(
        pool,
        &CreatePatient {
            name: name.into(),
            geburtsdatum: NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
            geschlecht: Geschlecht::Maennlich,
            versicherungsnummer: format!("V-{name}"),
            telefon: None,
            email: None,
            adresse: None,
        },
    )
    .await
    .expect("create patient");
    let akte = akte_repo::find_akte_by_patient(pool, &p.id)
        .await
        .expect("akte query")
        .expect("patientenakte auto-created on patient insert");
    (p.id, akte.id)
}

#[tokio::test]
async fn behandlung_lifecycle_emits_three_outbox_rows_in_serverless_peer() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let (_p_id, akte_id) = seed_patient_with_akte(&pool, "behandlung-alpha").await;
    // Reset baseline AFTER seeding so we count only behandlung mutations.
    let baseline_behandlung = outbox_count(&pool, "behandlung").await;

    let b = akte_repo::create_behandlung(
        &pool,
        &CreateBehandlung {
            akte_id: akte_id.clone(),
            art: "FÜLLUNG".into(),
            beschreibung: Some("Füllung 36".into()),
            zaehne: Some("36".into()),
            material: None,
            notizen: None,
            kategorie: None,
            leistungsname: None,
            behandlungsnummer: None,
            sitzung: Some(1),
            behandlung_status: Some("DURCHGEFUEHRT".into()),
            gesamtkosten: Some(120.0),
            termin_erforderlich: Some(false),
            behandlung_datum: Some("2099-01-15".into()),
        },
    )
    .await
    .expect("create behandlung");

    akte_repo::update_behandlung(
        &pool,
        &UpdateBehandlung {
            id: b.id.clone(),
            art: "FÜLLUNG".into(),
            beschreibung: Some("Füllung 36 (revidiert)".into()),
            zaehne: Some("36".into()),
            material: Some("Composite".into()),
            notizen: None,
            kategorie: None,
            leistungsname: None,
            behandlungsnummer: None,
            sitzung: Some(1),
            behandlung_status: Some("DURCHGEFUEHRT".into()),
            gesamtkosten: Some(150.0),
            termin_erforderlich: Some(false),
            behandlung_datum: Some("2099-01-15".into()),
        },
    )
    .await
    .expect("update behandlung");

    akte_repo::delete_behandlung(&pool, &b.id)
        .await
        .expect("delete behandlung");

    let after = outbox_count(&pool, "behandlung").await;
    assert_eq!(after - baseline_behandlung, 3, "insert + update + delete");
}

#[tokio::test]
async fn untersuchung_lifecycle_emits_three_outbox_rows_in_serverless_peer() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let (_p_id, akte_id) = seed_patient_with_akte(&pool, "untersuchung-beta").await;
    let baseline = outbox_count(&pool, "untersuchung").await;

    let u = akte_repo::create_untersuchung(
        &pool,
        &CreateUntersuchung {
            akte_id: akte_id.clone(),
            beschwerden: Some("Schmerz".into()),
            ergebnisse: None,
            diagnose: Some("Karies".into()),
            untersuchungsnummer: None,
            kategorie: None,
            leistungsname: None,
            gesamtkosten: Some(75.0),
        },
    )
    .await
    .expect("create untersuchung");

    akte_repo::update_untersuchung(
        &pool,
        &UpdateUntersuchung {
            id: u.id.clone(),
            beschwerden: Some("Schmerz".into()),
            ergebnisse: Some("PSI 2".into()),
            diagnose: Some("Karies tief".into()),
            kategorie: None,
            leistungsname: None,
            gesamtkosten: Some(80.0),
        },
    )
    .await
    .expect("update untersuchung");

    akte_repo::delete_untersuchung(&pool, &u.id)
        .await
        .expect("delete untersuchung");

    let after = outbox_count(&pool, "untersuchung").await;
    assert_eq!(after - baseline, 3, "insert + update + delete");
}

#[tokio::test]
async fn behandlung_writes_in_practice_desktop_mode_record_no_outbox() {
    let pool = fresh_pool().await;
    // No `enable_serverless` — default is practice_desktop.

    let (_p, akte_id) = seed_patient_with_akte(&pool, "behandlung-gamma").await;

    let b = akte_repo::create_behandlung(
        &pool,
        &CreateBehandlung {
            akte_id,
            art: "ANAMNESE".into(),
            beschreibung: None,
            zaehne: None,
            material: None,
            notizen: None,
            kategorie: None,
            leistungsname: None,
            behandlungsnummer: None,
            sitzung: None,
            behandlung_status: None,
            gesamtkosten: None,
            termin_erforderlich: None,
            behandlung_datum: None,
        },
    )
    .await
    .expect("create behandlung");

    let _ = b.id;
    assert_eq!(outbox_count(&pool, "behandlung").await, 0);
    assert_eq!(outbox_count(&pool, "patient").await, 0);
    assert_eq!(outbox_count(&pool, "patientenakte").await, 0);
}
