//! Outbox coverage for `treatment` + `examination` repo write paths.
//!
//! These two tables are in [`SYNCED_TABLES`](medoc_core::infrastructure::database::sync_outbox)
//! but are not directly exercised by `sync_outbox_hooks_tests.rs` (which
//! focuses on patient/appointment/task/payment). This file closes the gap
//! end-to-end:
//!
//! - `chart_repo::create_treatment` → 1 outbox row on `treatment`.
//! - `chart_repo::update_treatment` → +1 row.
//! - `chart_repo::delete_treatment` → +1 row.
//! - same lifecycle for `examination`.
//! - `practice_desktop` mode must not append any rows.

use chrono::NaiveDate;
use medoc_core::domain::entities::treatment::{
    CreateTreatment, CreateExamination, UpdateTreatment, UpdateExamination,
};
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::infrastructure::database::{chart_repo, app_kv_repo, connection, patient_repo};
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

async fn seed_patient_with_chart(pool: &SqlitePool, name: &str) -> (String, String) {
    let p = patient_repo::create(
        pool,
        &CreatePatient {
            name: name.into(),
            date_of_birth: NaiveDate::from_ymd_opt(1990, 1, 1).unwrap(),
            sex: Sex::Male,
            insurance_number: format!("V-{name}"),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("create patient");
    let chart = chart_repo::find_chart_by_patient(pool, &p.id)
        .await
        .expect("chart query")
        .expect("patient_chart auto-created on patient insert");
    (p.id, chart.id)
}

#[tokio::test]
async fn treatment_lifecycle_emits_three_outbox_rows_in_serverless_peer() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let (_p_id, chart_id) = seed_patient_with_chart(&pool, "treatment-alpha").await;
    // Reset baseline AFTER seeding so we count only treatment mutations.
    let baseline_treatment = outbox_count(&pool, "treatment").await;

    let b = chart_repo::create_treatment(
        &pool,
        &CreateTreatment {
            chart_id: chart_id.clone(),
            kind: "FÜLLUNG".into(),
            description: Some("Füllung 36".into()),
            teeth: Some("36".into()),
            material: None,
            notes: None,
            category: None,
            service_name: None,
            treatment_number: None,
            session_number: Some(1),
            treatment_status: Some("COMPLETED".into()),
            total_cost: Some(120.0),
            appointment_required: Some(false),
            treatment_date: Some("2099-01-15".into()),
        },
    )
    .await
    .expect("create treatment");

    chart_repo::update_treatment(
        &pool,
        &UpdateTreatment {
            id: b.id.clone(),
            kind: "FÜLLUNG".into(),
            description: Some("Füllung 36 (revidiert)".into()),
            teeth: Some("36".into()),
            material: Some("Composite".into()),
            notes: None,
            category: None,
            service_name: None,
            treatment_number: None,
            session_number: Some(1),
            treatment_status: Some("COMPLETED".into()),
            total_cost: Some(150.0),
            appointment_required: Some(false),
            treatment_date: Some("2099-01-15".into()),
        },
    )
    .await
    .expect("update treatment");

    chart_repo::delete_treatment(&pool, &b.id)
        .await
        .expect("delete treatment");

    let after = outbox_count(&pool, "treatment").await;
    assert_eq!(after - baseline_treatment, 3, "insert + update + delete");
}

#[tokio::test]
async fn examination_lifecycle_emits_three_outbox_rows_in_serverless_peer() {
    let pool = fresh_pool().await;
    enable_serverless(&pool).await;

    let (_p_id, chart_id) = seed_patient_with_chart(&pool, "examination-beta").await;
    let baseline = outbox_count(&pool, "examination").await;

    let u = chart_repo::create_examination(
        &pool,
        &CreateExamination {
            chart_id: chart_id.clone(),
            chief_complaint: Some("Schmerz".into()),
            results: None,
            diagnosis: Some("Karies".into()),
            examination_number: None,
            category: None,
            service_name: None,
            total_cost: Some(75.0),
        },
    )
    .await
    .expect("create examination");

    chart_repo::update_examination(
        &pool,
        &UpdateExamination {
            id: u.id.clone(),
            chief_complaint: Some("Schmerz".into()),
            results: Some("PSI 2".into()),
            diagnosis: Some("Karies tief".into()),
            category: None,
            service_name: None,
            total_cost: Some(80.0),
        },
    )
    .await
    .expect("update examination");

    chart_repo::delete_examination(&pool, &u.id)
        .await
        .expect("delete examination");

    let after = outbox_count(&pool, "examination").await;
    assert_eq!(after - baseline, 3, "insert + update + delete");
}

#[tokio::test]
async fn treatment_writes_in_practice_desktop_mode_record_no_outbox() {
    let pool = fresh_pool().await;
    // No `enable_serverless` — default is practice_desktop.

    let (_p, chart_id) = seed_patient_with_chart(&pool, "treatment-gamma").await;

    let b = chart_repo::create_treatment(
        &pool,
        &CreateTreatment {
            chart_id,
            kind: "ANAMNESE".into(),
            description: None,
            teeth: None,
            material: None,
            notes: None,
            category: None,
            service_name: None,
            treatment_number: None,
            session_number: None,
            treatment_status: None,
            total_cost: None,
            appointment_required: None,
            treatment_date: None,
        },
    )
    .await
    .expect("create treatment");

    let _ = b.id;
    assert_eq!(outbox_count(&pool, "treatment").await, 0);
    assert_eq!(outbox_count(&pool, "patient").await, 0);
    assert_eq!(outbox_count(&pool, "patient_chart").await, 0);
}
