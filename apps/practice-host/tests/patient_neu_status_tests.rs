//! FA-PAT-03: NEU patient status expires when the first appointment is completed.

use medoc_lib::domain::entities::termin::{CreateTermin, UpdateTermin};
use medoc_lib::domain::enums::{TerminArt, TerminStatus};
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::{patient_repo, termin_repo};

#[tokio::test]
async fn neu_patient_stays_neu_after_create_termin() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, status)
         VALUES ('p-neu-1', 'Neu Test', '1990-01-01', 'MAENNLICH', 'V-NEU-1', 'NEU')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    termin_repo::create(
        &pool,
        &CreateTermin {
            datum: "2030-07-01".into(),
            uhrzeit: "10:00".into(),
            art: TerminArt::Untersuchung,
            patient_id: "p-neu-1".into(),
            arzt_id: "seed-arzt-001".into(),
            notizen: None,
            beschwerden: None,
        },
    )
    .await
    .expect("create termin");

    let p = patient_repo::find_by_id(&pool, "p-neu-1")
        .await
        .expect("load")
        .expect("patient");
    assert_eq!(p.status, "NEU");
}

#[tokio::test]
async fn neu_patient_becomes_aktiv_when_first_termin_completed() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, status)
         VALUES ('p-neu-2', 'Neu Test 2', '1990-01-01', 'MAENNLICH', 'V-NEU-2', 'NEU')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    let t = termin_repo::create(
        &pool,
        &CreateTermin {
            datum: "2030-07-02".into(),
            uhrzeit: "11:00".into(),
            art: TerminArt::Untersuchung,
            patient_id: "p-neu-2".into(),
            arzt_id: "seed-arzt-001".into(),
            notizen: None,
            beschwerden: None,
        },
    )
    .await
    .expect("create termin");

    termin_repo::update(
        &pool,
        &t.id,
        &UpdateTermin {
            datum: None,
            uhrzeit: None,
            art: None,
            status: Some(TerminStatus::Durchgefuehrt),
            notizen: None,
            beschwerden: None,
            arzt_id: None,
        },
    )
    .await
    .expect("complete termin");

    let promoted = patient_repo::expire_neu_status_after_completed_termin(&pool, "p-neu-2")
        .await
        .expect("promote");
    assert!(promoted);

    let p = patient_repo::find_by_id(&pool, "p-neu-2")
        .await
        .expect("load")
        .expect("patient");
    assert_eq!(p.status, "AKTIV");
}
