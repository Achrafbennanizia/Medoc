// Zahlung repo: Soll/offen parity with frontend (`roundMoney2`, `ZAHL_EUR_EPS`) and update caps.

use medoc_lib::domain::entities::zahlung::{CreateZahlung, UpdateZahlung};
use medoc_lib::domain::enums::ZahlungsArt;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::zahlung_repo;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

async fn seed_patient_behandlung_100(pool: &sqlx::SqlitePool) -> (String, String) {
    let patient_id = "t-zahl-pat-1".to_string();
    let akte_id = "t-zahl-akte-1".to_string();
    let beh_id = "t-zahl-bh-1".to_string();

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Zahl Test', '1990-01-01', 'MAENNLICH', 'V-ZR-1')",
    )
    .bind(&patient_id)
    .execute(pool)
    .await
    .expect("insert patient");

    sqlx::query("INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, 'ENTWURF')")
        .bind(&akte_id)
        .bind(&patient_id)
        .execute(pool)
        .await
        .expect("insert akte");

    sqlx::query(
        "INSERT INTO behandlung (
            id, akte_id, art, beschreibung, kategorie, leistungsname, behandlungsnummer,
            sitzung, behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum
        ) VALUES (
            ?1, ?2, 'Test', 'Test', 'Test', 'Test', 'T-1',
            1, 'DURCHGEFUEHRT', 100.0, 0, '2026-01-01'
        )",
    )
    .bind(&beh_id)
    .bind(&akte_id)
    .execute(pool)
    .await
    .expect("insert behandlung");

    sqlx::query(
        "UPDATE behandlung SET freigegeben_von_arzt_id = 'seed-arzt-001', freigegeben_am = datetime('now') WHERE id = ?1",
    )
    .bind(&beh_id)
    .execute(pool)
    .await
    .expect("freigabe seed");

    (patient_id, beh_id)
}

fn create_payload(patient_id: &str, behandlung_id: &str, betrag: f64) -> CreateZahlung {
    CreateZahlung {
        patient_id: patient_id.into(),
        betrag,
        zahlungsart: ZahlungsArt::Bar,
        leistung_id: None,
        beschreibung: None,
        behandlung_id: Some(behandlung_id.into()),
        untersuchung_id: None,
        betrag_erwartet: None,
    }
}

#[tokio::test]
async fn create_rejects_over_open_even_with_float_noise() {
    let pool = migrated_pool().await;
    let (patient_id, beh_id) = seed_patient_behandlung_100(&pool).await;

    zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, 33.33))
        .await
        .expect("first payment");

    // open = round_money2(100 - 33.33) = round(66.67) = 66.67
    let open = 66.67_f64;
    let over = open + 0.006;
    let err = zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, over))
        .await
        .expect_err("over open");
    match err {
        AppError::Validation(msg) | AppError::ValidationCode(msg) => assert!(
            msg.contains("übersteigt")
                || msg.contains("offenen")
                || msg.contains("error.zahlung.overpayment_behandlung"),
            "{msg}"
        ),
        e => panic!("expected Validation, got {e:?}"),
    }

    // Within EPS slack vs recomputed open on server
    let ok_amt = open + 0.004;
    zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, ok_amt))
        .await
        .expect("within tolerance");
}

#[tokio::test]
async fn ensure_open_booking_for_billable_behandlung_sets_release_and_ausstehend() {
    let pool = migrated_pool().await;
    let patient_id = "t-leist06-pat".to_string();
    let akte_id = "t-leist06-akte".to_string();
    let beh_id = "t-leist06-bh".to_string();
    let arzt_id = "seed-arzt-001";

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Leist06', '1990-01-01', 'MAENNLICH', 'V-L6')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("patient");

    sqlx::query("INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, 'ENTWURF')")
        .bind(&akte_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("akte");

    sqlx::query(
        "INSERT INTO behandlung (
            id, akte_id, art, beschreibung, kategorie, leistungsname, behandlungsnummer,
            sitzung, behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum
        ) VALUES (
            ?1, ?2, 'Füllung', 'Füllung', 'Konservierend', 'Füllung', 'L6-1',
            1, 'DURCHGEFUEHRT', 80.0, 0, '2026-05-21'
        )",
    )
    .bind(&beh_id)
    .bind(&akte_id)
    .execute(&pool)
    .await
    .expect("behandlung");

    zahlung_repo::ensure_open_booking_for_billable_behandlung(&pool, &beh_id, arzt_id)
        .await
        .expect("open booking");

    let released: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT freigegeben_von_arzt_id, freigegeben_am FROM behandlung WHERE id = ?1",
    )
    .bind(&beh_id)
    .fetch_one(&pool)
    .await
    .expect("read freigabe");
    assert!(released.0.as_deref().is_some_and(|s| !s.is_empty()));
    assert!(released.1.as_deref().is_some_and(|s| !s.is_empty()));

    let z: (String, f64, String) =
        sqlx::query_as("SELECT status, betrag, beschreibung FROM zahlung WHERE behandlung_id = ?1")
            .bind(&beh_id)
            .fetch_one(&pool)
            .await
            .expect("zahlung row");
    assert_eq!(z.0, "AUSSTEHEND");
    assert!(z.1 <= 0.005);
    assert!(z.2.contains("FA-LEIST-06"));
}

#[tokio::test]
async fn ensure_open_booking_for_billable_untersuchung_sets_release_and_ausstehend() {
    let pool = migrated_pool().await;
    let patient_id = "t-leist07-pat".to_string();
    let akte_id = "t-leist07-akte".to_string();
    let unter_id = "t-leist07-u".to_string();
    let arzt_id = "seed-arzt-001";

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Leist07', '1990-01-01', 'MAENNLICH', 'V-L7')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("patient");

    sqlx::query("INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, 'ENTWURF')")
        .bind(&akte_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("akte");

    sqlx::query(
        "INSERT INTO untersuchung (
            id, akte_id, beschwerden, ergebnisse, diagnose, untersuchungsnummer,
            kategorie, leistungsname, gesamtkosten
        ) VALUES (
            ?1, ?2, 'Beschwerde', NULL, 'Diag', 'U-L7-1',
            'Diagnostik', 'Kontrolluntersuchung', 45.0
        )",
    )
    .bind(&unter_id)
    .bind(&akte_id)
    .execute(&pool)
    .await
    .expect("untersuchung");

    zahlung_repo::ensure_open_booking_for_billable_untersuchung(&pool, &unter_id, arzt_id)
        .await
        .expect("open booking");

    let released: (Option<String>, Option<String>) = sqlx::query_as(
        "SELECT freigegeben_von_arzt_id, freigegeben_am FROM untersuchung WHERE id = ?1",
    )
    .bind(&unter_id)
    .fetch_one(&pool)
    .await
    .expect("read freigabe");
    assert!(released.0.as_deref().is_some_and(|s| !s.is_empty()));
    assert!(released.1.as_deref().is_some_and(|s| !s.is_empty()));

    let z: (String, f64, Option<f64>) = sqlx::query_as(
        "SELECT status, betrag, betrag_erwartet FROM zahlung WHERE untersuchung_id = ?1",
    )
    .bind(&unter_id)
    .fetch_one(&pool)
    .await
    .expect("zahlung row");
    assert_eq!(z.0, "AUSSTEHEND");
    assert!(z.1 <= 0.005);
    assert_eq!(z.2, Some(45.0));
}

#[tokio::test]
async fn create_rejects_behandlung_without_physician_release() {
    let pool = migrated_pool().await;
    let patient_id = "t-zahl-pat-norel".to_string();
    let akte_id = "t-zahl-akte-norel".to_string();
    let beh_id = "t-zahl-bh-norel".to_string();

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'No Release', '1990-01-01', 'MAENNLICH', 'V-NR')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query("INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, 'ENTWURF')")
        .bind(&akte_id)
        .bind(&patient_id)
        .execute(&pool)
        .await
        .expect("insert akte");

    sqlx::query(
        "INSERT INTO behandlung (
            id, akte_id, art, beschreibung, kategorie, leistungsname, behandlungsnummer,
            sitzung, behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum
        ) VALUES (
            ?1, ?2, 'Test', 'Test', 'Test', 'Test', 'T-NR',
            1, 'DURCHGEFUEHRT', 50.0, 0, '2026-01-01'
        )",
    )
    .bind(&beh_id)
    .bind(&akte_id)
    .execute(&pool)
    .await
    .expect("insert behandlung without freigabe");

    let err = zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, 10.0))
        .await
        .expect_err("must fail without FA-LEIST-05 release");
    match err {
        AppError::Validation(msg) | AppError::ValidationCode(msg) => assert!(
            msg.contains("FA-LEIST-05")
                || msg.contains("freigegeben")
                || msg.contains("error.billing.not_released")
                || msg.contains("error.entity.behandlung"),
            "{msg}"
        ),
        e => panic!("expected Validation, got {e:?}"),
    }
}

#[tokio::test]
async fn update_fields_caps_replacement_betrag_against_other_rows() {
    let pool = migrated_pool().await;
    let (patient_id, beh_id) = seed_patient_behandlung_100(&pool).await;

    let z1 = zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, 30.0))
        .await
        .expect("z1");
    zahlung_repo::create(&pool, &create_payload(&patient_id, &beh_id, 20.0))
        .await
        .expect("z2");

    assert!(
        z1.status == "TEILBEZAHLT" || z1.status == "BEZAHLT",
        "unexpected status {}",
        z1.status
    );

    // Others sum = 20 → max for row z1 = round(100 - 20) = 80; 85 must fail
    let bad = UpdateZahlung {
        id: z1.id.clone(),
        betrag: 85.0,
        zahlungsart: ZahlungsArt::Bar,
        leistung_id: None,
        beschreibung: None,
    };
    let err = zahlung_repo::update_fields(&pool, &bad)
        .await
        .expect_err("too high");
    match err {
        AppError::Validation(msg) | AppError::ValidationCode(msg) => assert!(
            msg.contains("übersteigt")
                || msg.contains("Rahmen")
                || msg.contains("error.zahlung.overpayment_edit_behandlung"),
            "{msg}"
        ),
        e => panic!("expected Validation, got {e:?}"),
    }

    let ok = UpdateZahlung {
        id: z1.id,
        betrag: 79.0,
        zahlungsart: ZahlungsArt::Bar,
        leistung_id: None,
        beschreibung: None,
    };
    zahlung_repo::update_fields(&pool, &ok)
        .await
        .expect("within cap");
}
