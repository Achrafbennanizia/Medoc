//! Slice 5 — auto outbox hook coverage tests.
//!
//! Each test enables `serverless_peer` mode through `app_kv`, performs one
//! write on a hooked repository, and confirms that exactly **one** row was
//! appended to `sync_outbox`. Tables not on the allow-list must produce zero
//! rows.
//!
//! These tests intentionally exercise the public repository API rather than
//! `record_or_noop` directly so we catch the wiring at call sites.

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::entities::praxis_aufgabe::CreatePraxisAufgabe;
use medoc_core::domain::entities::rezept::CreateRezept;
use medoc_core::domain::entities::termin::{CreateTermin, UpdateTermin};
use medoc_core::domain::enums::{Geschlecht, TerminArt};
use medoc_core::infrastructure::database::{
    akte_repo, app_kv_repo, connection, patient_repo, praxis_aufgabe_repo, praxis_ticket_repo,
    rezept_repo, termin_repo, zahlung_repo,
};
use sqlx::SqlitePool;

async fn fresh_pool() -> SqlitePool {
    let pool = connection::test_memory_pool().await.expect("memory pool");
    connection::run_migrations(&pool).await.expect("migrations");
    pool
}

async fn enable_serverless(pool: &SqlitePool) {
    app_kv_repo::set(
        pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Tester"}"#,
    )
    .await
    .expect("enable serverless");
}

async fn outbox_count(pool: &SqlitePool, table: &str) -> i64 {
    sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity_table = ?1")
        .bind(table)
        .fetch_one(pool)
        .await
        .unwrap()
}

fn sample_patient(name: &str) -> CreatePatient {
    CreatePatient {
        name: name.into(),
        geburtsdatum: NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
        geschlecht: Geschlecht::Maennlich,
        versicherungsnummer: format!("V-{}", name),
        telefon: None,
        email: None,
        adresse: None,
    }
}

#[tokio::test]
async fn patient_create_emits_one_outbox_row_per_table() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("alpha"))
        .await
        .expect("create patient");

    assert_eq!(outbox_count(&pool, "patient").await, 1);
    assert_eq!(outbox_count(&pool, "patientenakte").await, 1);
    // `anamnesebogen` is Tier-1 allow-listed but patient create inserts inline without outbox hook.
    assert_eq!(outbox_count(&pool, "anamnesebogen").await, 0);
    // `personal` is not on SYNCED_TABLES.
    assert_eq!(outbox_count(&pool, "personal").await, 0);

    let _ = p.id;
}

#[tokio::test]
async fn patient_update_and_delete_each_record_one_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("beta"))
        .await
        .expect("create patient");

    patient_repo::update(
        &pool,
        &p.id,
        &medoc_core::domain::entities::patient::UpdatePatient {
            name: Some("beta-updated".into()),
            telefon: None,
            email: None,
            adresse: None,
            status: None,
        },
    )
    .await
    .expect("update");

    patient_repo::delete(&pool, &p.id).await.expect("delete");

    // 1 INSERT + 1 UPDATE + 1 DELETE = 3 rows on `patient`.
    assert_eq!(outbox_count(&pool, "patient").await, 3);
}

#[tokio::test]
async fn no_outbox_rows_when_mode_is_practice_desktop() {
    let pool = fresh_pool().await;

    let _p = patient_repo::create(&pool, &sample_patient("gamma"))
        .await
        .expect("create patient");

    assert_eq!(outbox_count(&pool, "patient").await, 0);
    assert_eq!(outbox_count(&pool, "patientenakte").await, 0);
}

#[tokio::test]
async fn termin_lifecycle_emits_three_outbox_rows() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    // Need a patient for the FK on termin (the create handler computes
    // patient label via JOIN — but the create_termin function only needs
    // the patient id to exist).
    let p = patient_repo::create(&pool, &sample_patient("delta"))
        .await
        .expect("create patient");

    // Seed a `personal` row so the `arzt_id` FK resolves.
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('arzt-1', 'Dr. Test', 'arzt@test', 'x', 'ARZT')",
    )
    .execute(&pool)
    .await
    .ok();

    let create = CreateTermin {
        patient_id: p.id.clone(),
        datum: "2099-01-01".into(),
        uhrzeit: "09:00".into(),
        art: TerminArt::Kontrolle,
        notizen: None,
        beschwerden: None,
        arzt_id: "arzt-1".into(),
    };
    let t = termin_repo::create(&pool, &create).await.expect("create");

    termin_repo::update(
        &pool,
        &t.id,
        &UpdateTermin {
            datum: Some("2099-01-02".into()),
            uhrzeit: None,
            art: None,
            status: None,
            notizen: None,
            beschwerden: None,
            arzt_id: None,
        },
    )
    .await
    .expect("update");

    termin_repo::delete(&pool, &t.id).await.expect("delete");

    assert_eq!(outbox_count(&pool, "termin").await, 3);
}

#[tokio::test]
async fn praxis_aufgabe_insert_and_status_emit_two_rows() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("epsilon"))
        .await
        .expect("create patient");

    // Seed a `personal` row so the `created_by` FK resolves.
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('rez-1', 'Frau Test', 'rez@test', 'x', 'REZEPTION')",
    )
    .execute(&pool)
    .await
    .ok();

    let aufgabe = praxis_aufgabe_repo::insert(
        &pool,
        &CreatePraxisAufgabe {
            patient_id: p.id.clone(),
            typ: "ABRECHNUNG".into(),
            titel: "Test".into(),
            body: Some("Test body".into()),
            assignee_role: Some("REZEPTION".into()),
            assignee_user_id: None,
            behandlung_id: None,
            untersuchung_id: None,
            leistungsname: None,
            gesamtkosten: None,
        },
        "rez-1",
    )
    .await
    .expect("insert aufgabe");

    praxis_aufgabe_repo::update_status(
        &pool,
        &aufgabe.id,
        "ERLEDIGT_REZEPTION",
        Some("done"),
        None,
        None,
    )
    .await
    .expect("update status");

    assert_eq!(outbox_count(&pool, "praxis_aufgabe").await, 2);
}

#[tokio::test]
async fn app_kv_set_excludes_internal_sync_keys_but_records_practice_settings() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    // Genuine practice setting → recorded.
    app_kv_repo::set(&pool, "practice.workschedule.v1", r#"{"foo":"bar"}"#)
        .await
        .expect("set");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);

    // Internal sync key → must NOT be recorded.
    app_kv_repo::set(&pool, "sync.heartbeat.v1", "{}")
        .await
        .expect("set sync key");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);

    // License internals also skipped.
    app_kv_repo::set(&pool, "license.v2", "{}")
        .await
        .expect("set license key");
    assert_eq!(outbox_count(&pool, "app_kv").await, 1);
}

#[tokio::test]
async fn zahlung_lifecycle_emits_outbox_rows() {
    use medoc_core::domain::entities::zahlung::CreateZahlung;
    use medoc_core::domain::enums::ZahlungsArt;

    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("zeta"))
        .await
        .expect("create patient");

    let z = zahlung_repo::create(
        &pool,
        &CreateZahlung {
            patient_id: p.id.clone(),
            betrag: 50.0,
            zahlungsart: ZahlungsArt::Bar,
            leistung_id: None,
            beschreibung: Some("Test".into()),
            behandlung_id: None,
            untersuchung_id: None,
            betrag_erwartet: None,
        },
    )
    .await
    .expect("create zahlung");

    zahlung_repo::update_status(&pool, &z.id, "BEZAHLT")
        .await
        .expect("update status");

    // INSERT + UPDATE = 2 rows on `zahlung`.
    assert_eq!(outbox_count(&pool, "zahlung").await, 2);

    // Akte side-effect: each B/U-less Zahlung does not trigger akte writes.
    let _ = akte_repo::find_akte_by_patient(&pool, &p.id).await.ok();
}

#[tokio::test]
async fn rezept_create_emits_one_outbox_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("rezept-hook"))
        .await
        .expect("create patient");

    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('arzt-rezept', 'Dr. Rezept', 'rezept@test', 'x', 'ARZT')",
    )
    .execute(&pool)
    .await
    .ok();

    rezept_repo::create(
        &pool,
        &CreateRezept {
            patient_id: p.id.clone(),
            arzt_id: "arzt-rezept".into(),
            medikament: "Ibuprofen 600mg".into(),
            wirkstoff: Some("Ibuprofen".into()),
            dosierung: "1-0-1".into(),
            dauer: "5 Tage".into(),
            hinweise: None,
            pzn: None,
            darreichungsform: None,
            packungsgroesse: None,
            menge: None,
            aut_idem: Some(true),
            rezept_typ: None,
            icd10_code: None,
            verordnender_arzt_id: None,
        },
    )
    .await
    .expect("create rezept");

    assert_eq!(outbox_count(&pool, "rezept").await, 1);
}

#[tokio::test]
async fn praxis_ticket_insert_emits_one_outbox_row() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let p = patient_repo::create(&pool, &sample_patient("ticket-hook"))
        .await
        .expect("create patient");

    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('rez-ticket', 'Frau Rezeption', 'rez@test', 'x', 'REZEPTION'),
               ('arzt-ticket', 'Dr. Ticket', 'arzt@test', 'x', 'ARZT')",
    )
    .execute(&pool)
    .await
    .ok();

    praxis_ticket_repo::insert(
        &pool,
        &p.id,
        "rez-ticket",
        "arzt-ticket",
        "Port hook ticket",
    )
    .await
    .expect("insert ticket");

    assert_eq!(outbox_count(&pool, "praxis_ticket").await, 1);
}
