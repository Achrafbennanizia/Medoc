// DSGVO erasure: deletes akte-linked rows and anonymises within schema CHECK constraints.

use medoc_lib::infrastructure::database::connection::run_migrations;
use medoc_lib::infrastructure::dsgvo;
use sqlx::sqlite::SqlitePoolOptions;

async fn memory_pool() -> sqlx::SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(2)
        .connect("sqlite::memory:")
        .await
        .expect("sqlite memory pool")
}

#[tokio::test]
async fn erase_removes_behandlung_via_akte_and_anonymises_patient() {
    let pool = memory_pool().await;
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, status)
         VALUES ('p-dsgvo-1', 'Test Patient', '1990-05-05', 'WEIBLICH', 'VNR-DSGVO-1', 'AKTIV')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query(
        "INSERT INTO patientenakte (id, patient_id, status) VALUES ('akte-dsgvo-1', 'p-dsgvo-1', 'VALIDIERT')",
    )
    .execute(&pool)
    .await
    .expect("insert akte");

    sqlx::query(
        "INSERT INTO behandlung (id, akte_id, art) VALUES ('beh-dsgvo-1', 'akte-dsgvo-1', 'Kontrolle')",
    )
    .execute(&pool)
    .await
    .expect("insert behandlung");

    let n_beh: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM behandlung WHERE akte_id = 'akte-dsgvo-1'")
            .fetch_one(&pool)
            .await
            .expect("count behandlung");
    assert_eq!(n_beh.0, 1);

    dsgvo::erase_patient(&pool, "p-dsgvo-1", std::path::Path::new("/tmp"))
        .await
        .expect("erase");

    // Scope the assertion to the test akte: `seed_demo_data` populates other
    // behandlung rows tied to seed-Akten that intentionally survive erasure of
    // `p-dsgvo-1`. The DSGVO contract requires all behandlung of the deleted
    // patient to disappear, not the entire table.
    let n_beh_after: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM behandlung WHERE akte_id = 'akte-dsgvo-1'")
            .fetch_one(&pool)
            .await
            .expect("count behandlung after");
    assert_eq!(
        n_beh_after.0, 0,
        "behandlung must be cascade-deleted with patientenakte"
    );

    let row: (String, String, String, String) = sqlx::query_as(
        "SELECT name, geschlecht, status, versicherungsnummer FROM patient WHERE id = 'p-dsgvo-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("select patient");

    assert!(row.0.starts_with("Anonymisiert"), "name stub: {:?}", row.0);
    assert_eq!(row.1, "DIVERS");
    assert_eq!(row.2, "READONLY");
    assert!(row.3.starts_with("ANON-"), "pseudo vnr: {:?}", row.3);
}
