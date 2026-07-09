//! Domain services (Phase 3.2): konflikt, pricing, workflow_transitions.

use medoc_lib::domain::services::{device_session_risk, konflikt, pricing, workflow_transitions};
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[test]
fn uhrzeit_to_minutes_parses_hh_mm() {
    assert_eq!(konflikt::uhrzeit_to_minutes("09:30"), 9 * 60 + 30);
    assert_eq!(konflikt::uhrzeit_to_minutes("09:30:00"), 9 * 60 + 30);
}

#[tokio::test]
async fn arzt_slot_conflict_detects_duplicate() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    let arzt = "seed-arzt-001";
    let datum = "2030-06-01";
    let uhrzeit = "10:00";

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES ('t-conflict-pat', 'Konflikt Test', '1990-01-01', 'MAENNLICH', 'V-KONFLIKT-1')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query(
        "INSERT INTO termin (id, datum, uhrzeit, art, patient_id, arzt_id)
         VALUES ('t-conflict-a', ?1, ?2, 'KONTROLLE', 't-conflict-pat', ?3)",
    )
    .bind(datum)
    .bind(uhrzeit)
    .bind(arzt)
    .execute(&pool)
    .await
    .expect("insert termin");

    let q = konflikt::ArztSlotConflictQuery {
        datum,
        uhrzeit,
        arzt_id: arzt,
        exclude_termin_id: None,
    };
    assert!(
        konflikt::has_arzt_slot_conflict(&pool, q)
            .await
            .expect("query"),
        "duplicate slot should conflict"
    );

    let q2 = konflikt::ArztSlotConflictQuery {
        datum,
        uhrzeit,
        arzt_id: arzt,
        exclude_termin_id: Some("t-conflict-a"),
    };
    assert!(
        !konflikt::has_arzt_slot_conflict(&pool, q2)
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
        Some("arzt-1"),
        Some("2026-01-01")
    ));
    assert!(!pricing::is_released_for_billing(Some("arzt-1"), None));
    assert!(pricing::behandlung_has_billable_leistung(
        Some("Füllung"),
        None
    ));
    assert!(pricing::behandlung_has_billable_leistung(None, Some(42.0)));
    assert!(!pricing::behandlung_has_billable_leistung(None, None));
    assert!(!pricing::behandlung_has_billable_leistung(
        Some("  "),
        Some(0.0)
    ));
    assert_eq!(
        pricing::invoice_amount_cents_behandlung(Some(50.0), 0.0),
        5000
    );
    assert!(pricing::is_valid_praxis_digit_id("123 456 789"));
    assert!(!pricing::is_valid_praxis_digit_id("12345"));
}

#[test]
fn workflow_termin_transitions() {
    assert!(workflow_transitions::termin_status_transition("GEPLANT", "BESTAETIGT").is_ok());
    assert!(workflow_transitions::termin_status_transition("DURCHGEFUEHRT", "GEPLANT").is_err());
}

#[test]
fn workflow_patientenakte_validate() {
    assert!(workflow_transitions::patientenakte_validate_transition("ENTWURF").is_ok());
    assert!(workflow_transitions::patientenakte_validate_transition("VALIDIERT").is_err());
}

#[test]
fn workflow_praxis_aufgabe_transitions() {
    use medoc_lib::application::rbac::Role;
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "OFFEN",
        "IN_BEARBEITUNG",
        Role::Rezeption,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-rez-001",
        false,
        false,
    )
    .is_ok());
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "ERLEDIGT_REZEPTION",
        "VALIDIERT",
        Role::Arzt,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-arzt-001",
        false,
        false,
    )
    .is_ok());
    // Creator who also fulfilled (named assignee) may still validate.
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "ERLEDIGT_REZEPTION",
        "VALIDIERT",
        Role::Arzt,
        None,
        Some("seed-arzt-001"),
        "seed-arzt-001",
        "seed-arzt-001",
        false,
        false,
    )
    .is_ok());
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "VALIDIERT",
        "OFFEN",
        Role::Arzt,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-arzt-001",
        false,
        false,
    )
    .is_err());
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "OFFEN",
        "VALIDIERT",
        Role::Rezeption,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-rez-999",
        true,
        false,
    )
    .is_err());
    assert!(workflow_transitions::praxis_aufgabe_status_transition(
        "OFFEN",
        "VALIDIERT",
        Role::Arzt,
        Some("REZEPTION"),
        None,
        "seed-arzt-001",
        "seed-arzt-001",
        false,
        true,
    )
    .is_ok());
}

#[test]
fn workflow_bestellung_and_ticket() {
    assert!(workflow_transitions::bestellung_status_transition("OFFEN", "UNTERWEGS").is_ok());
    assert!(workflow_transitions::bestellung_status_transition("GELIEFERT", "OFFEN").is_err());
    assert!(
        workflow_transitions::praxis_ticket_status_transition("OFFEN", "IN_BEARBEITUNG").is_ok()
    );
    assert!(workflow_transitions::praxis_ticket_status_transition("ERLEDIGT", "OFFEN").is_err());
}

#[test]
fn pricing_require_release_maps_to_validation() {
    let err = pricing::require_released_for_billing(None, None, "error.entity.behandlung")
        .expect_err("must fail");
    assert!(matches!(err, AppError::ValidationCode(_)));
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
