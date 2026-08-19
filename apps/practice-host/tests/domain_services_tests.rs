//! Domain services (Phase 3.2): konflikt, pricing, workflow_transitions.

use medoc_lib::domain::services::{device_session_risk, conflict, pricing, workflow_transitions};
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[test]
fn time_to_minutes_parses_hh_mm() {
    assert_eq!(conflict::time_to_minutes("09:30"), 9 * 60 + 30);
    assert_eq!(conflict::time_to_minutes("09:30:00"), 9 * 60 + 30);
}

#[tokio::test]
async fn physician_slot_conflict_detects_duplicate() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    let physician = "seed-physician-001";
    let date = "2030-06-01";
    let time = "10:00";

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES ('t-conflict-pat', 'Konflikt Test', '1990-01-01', 'MALE', 'V-KONFLIKT-1')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query(
        "INSERT INTO appointment (id, date, time, kind, patient_id, physician_id)
         VALUES ('t-conflict-a', ?1, ?2, 'CHECKUP', 't-conflict-pat', ?3)",
    )
    .bind(date)
    .bind(time)
    .bind(physician)
    .execute(&pool)
    .await
    .expect("insert appointment");

    let q = conflict::PhysicianSlotConflictQuery {
        date,
        time,
        physician_id: physician,
        exclude_appointment_id: None,
    };
    assert!(
        conflict::has_physician_slot_conflict(&pool, q)
            .await
            .expect("query"),
        "duplicate slot should conflict"
    );

    let q2 = conflict::PhysicianSlotConflictQuery {
        date,
        time,
        physician_id: physician,
        exclude_appointment_id: Some("t-conflict-a"),
    };
    assert!(
        !conflict::has_physician_slot_conflict(&pool, q2)
            .await
            .expect("query exclude"),
        "same row excluded → no conflict"
    );
}

#[test]
fn pricing_round_trip_and_release() {
    assert!((pricing::round_money_2(10.12) - 10.12).abs() < 1e-9);
    assert_eq!(pricing::money_to_invoice_cents(10.0), 1000);
    assert_eq!(pricing::money_to_invoice_cents(0.01), 1);
    assert!(pricing::is_released_for_billing(
        Some("physician-1"),
        Some("2026-01-01")
    ));
    assert!(!pricing::is_released_for_billing(Some("physician-1"), None));
    assert!(pricing::treatment_has_billable_service_item(
        Some("Füllung"),
        None
    ));
    assert!(pricing::treatment_has_billable_service_item(None, Some(42.0)));
    assert!(!pricing::treatment_has_billable_service_item(None, None));
    assert!(!pricing::treatment_has_billable_service_item(
        Some("  "),
        Some(0.0)
    ));
    assert_eq!(
        pricing::invoice_amount_cents_treatment(Some(50.0), 0.0),
        5000
    );
    assert!(pricing::is_valid_practice_digit_id("123 456 789"));
    assert!(!pricing::is_valid_practice_digit_id("12345"));
}

#[test]
fn workflow_appointment_transitions() {
    assert!(workflow_transitions::appointment_status_transition("PLANNED", "CONFIRMED").is_ok());
    assert!(workflow_transitions::appointment_status_transition("COMPLETED", "PLANNED").is_err());
}

#[test]
fn workflow_patient_chart_validate() {
    assert!(workflow_transitions::patient_chart_validate_transition("DRAFT").is_ok());
    assert!(workflow_transitions::patient_chart_validate_transition("VALIDATED").is_err());
}

#[test]
fn workflow_patient_chart_forward_review() {
    assert!(workflow_transitions::patient_chart_forward_review_transition("DRAFT").is_ok());
    assert!(workflow_transitions::patient_chart_forward_review_transition("VALIDATED").is_ok());
    assert!(workflow_transitions::patient_chart_forward_review_transition("READONLY").is_err());
}

#[test]
fn workflow_practice_task_transitions() {
    use medoc_lib::application::rbac::Role;
    assert!(workflow_transitions::practice_task_status_transition(
        "OPEN",
        "IN_PROGRESS",
        Role::Reception,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-rez-001",
        false,
        false,
    )
    .is_ok());
    assert!(workflow_transitions::practice_task_status_transition(
        "DONE_RECEPTION",
        "VALIDATED",
        Role::Physician,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-physician-001",
        false,
        false,
    )
    .is_ok());
    // Creator who also fulfilled (named assignee) may still validate.
    assert!(workflow_transitions::practice_task_status_transition(
        "DONE_RECEPTION",
        "VALIDATED",
        Role::Physician,
        None,
        Some("seed-physician-001"),
        "seed-physician-001",
        "seed-physician-001",
        false,
        false,
    )
    .is_ok());
    assert!(workflow_transitions::practice_task_status_transition(
        "VALIDATED",
        "OPEN",
        Role::Physician,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-physician-001",
        false,
        false,
    )
    .is_err());
    assert!(workflow_transitions::practice_task_status_transition(
        "OPEN",
        "VALIDATED",
        Role::Reception,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-rez-999",
        true,
        false,
    )
    .is_err());
    assert!(workflow_transitions::practice_task_status_transition(
        "OPEN",
        "VALIDATED",
        Role::Physician,
        Some("RECEPTION"),
        None,
        "seed-physician-001",
        "seed-physician-001",
        false,
        true,
    )
    .is_ok());
}

#[test]
fn workflow_purchase_order_and_ticket() {
    assert!(workflow_transitions::purchase_order_status_transition("OPEN", "IN_TRANSIT").is_ok());
    assert!(workflow_transitions::purchase_order_status_transition("DELIVERED", "OPEN").is_err());
    assert!(
        workflow_transitions::practice_ticket_status_transition("OPEN", "IN_PROGRESS").is_ok()
    );
    assert!(workflow_transitions::practice_ticket_status_transition("DONE", "OPEN").is_err());
}

#[test]
fn pricing_require_release_maps_to_validation() {
    let err =
        pricing::require_released_for_billing(None, None, "error.entity.treatment").expect_err("must fail");
    assert!(matches!(err, AppError::Validation(_)));
}

#[test]
fn device_session_risk_flags_stale_non_current_session() {
    use chrono::NaiveDateTime;
    let now = NaiveDateTime::parse_from_str("2026-06-10 15:00:00", "%Y-%m-%d %H:%M:%S").unwrap();
    let current = device_session_risk::DeviceSessionRiskInput {
        id: "cur".into(),
        user_id: "u1".into(),
        device_label: "MeDoc".into(),
        user_agent: Some("Mozilla/5.0".into()),
        created_at: "2026-06-10 14:00:00".into(),
        last_seen_at: "2026-06-10 14:55:00".into(),
        is_current: true,
        is_trusted: false,
    };
    let other = device_session_risk::DeviceSessionRiskInput {
        id: "old".into(),
        user_id: "u1".into(),
        device_label: "MeDoc".into(),
        user_agent: Some("Mozilla/5.0".into()),
        created_at: "2026-06-07 10:00:00".into(),
        last_seen_at: "2026-06-07 10:00:00".into(),
        is_current: false,
        is_trusted: false,
    };
    let peers = vec![current, other.clone()];
    let assessment = device_session_risk::assess_session(&other, &peers, now);
    assert!(assessment.is_suspected);
    assert!(!assessment.suspected_reasons.is_empty());
}
