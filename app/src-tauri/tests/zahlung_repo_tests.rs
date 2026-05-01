// Zahlung repo: Soll/offen parity with frontend (`roundMoney2`, `ZAHL_EUR_EPS`) and update caps.

use medoc_lib::domain::entities::zahlung::{CreateZahlung, UpdateZahlung};
use medoc_lib::domain::enums::ZahlungsArt;
use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::run_migrations;
use medoc_lib::infrastructure::database::zahlung_repo;
use sqlx::sqlite::SqlitePoolOptions;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .connect("sqlite::memory:")
        .await
        .expect("pool");
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

    sqlx::query(
        "INSERT INTO patientenakte (id, patient_id, status) VALUES (?1, ?2, 'ENTWURF')",
    )
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
        AppError::Validation(msg) => assert!(
            msg.contains("übersteigt") || msg.contains("offenen"),
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
    let err = zahlung_repo::update_fields(&pool, &bad).await.expect_err("too high");
    match err {
        AppError::Validation(msg) => assert!(
            msg.contains("übersteigt") || msg.contains("Rahmen"),
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
    zahlung_repo::update_fields(&pool, &ok).await.expect("within cap");
}
