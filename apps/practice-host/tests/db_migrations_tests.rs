// SQLite schema migrations: idempotency and baseline tables (FA-DB baseline).

use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn fresh_db_records_sqlx_migration() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let applied: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM _sqlx_migrations")
        .fetch_one(&pool)
        .await
        .expect("_sqlx_migrations table");
    assert!(
        applied.0 >= 1,
        "fresh DB should run sqlx migrate! at least once, got {}",
        applied.0
    );
}

#[tokio::test]
async fn run_migrations_twice_is_idempotent() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("first run");
    run_migrations(&pool).await.expect("second run");

    let tables: Vec<(String,)> =
        sqlx::query_as("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .fetch_all(&pool)
            .await
            .expect("sqlite_master");

    let names: Vec<&str> = tables.iter().map(|t| t.0.as_str()).collect();
    assert!(
        names.contains(&"patient"),
        "patient table missing: {names:?}"
    );
    assert!(names.contains(&"audit_log"), "audit_log table missing");

    let audit_cols: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('audit_log')")
            .fetch_all(&pool)
            .await
            .expect("pragma audit_log");
    let col_names: Vec<&str> = audit_cols.iter().map(|s| s.as_str()).collect();
    assert!(
        col_names.contains(&"prev_hash"),
        "forward migration must add prev_hash: {col_names:?}"
    );
    assert!(
        col_names.contains(&"hmac"),
        "forward migration must add hmac: {col_names:?}"
    );

    let staff: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM personal")
        .fetch_one(&pool)
        .await
        .expect("count personal");
    assert!(
        staff.0 >= 2,
        "seed staff expected when personal was empty: got {}",
        staff.0
    );
}

#[tokio::test]
async fn rezept_and_attest_forward_migrations_add_columns() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let rezept_cols: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('rezept')")
            .fetch_all(&pool)
            .await
            .expect("pragma rezept");
    for col in [
        "pzn",
        "darreichungsform",
        "packungsgroesse",
        "menge",
        "aut_idem",
        "rezept_typ",
        "icd10_code",
        "verordnender_arzt_id",
    ] {
        assert!(
            rezept_cols.iter().any(|c| c == col),
            "rezept missing column {col}: {rezept_cols:?}"
        );
    }

    let attest_cols: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('attest')")
            .fetch_all(&pool)
            .await
            .expect("pragma attest");
    for col in [
        "icd10_code",
        "erst_oder_folge",
        "arbeitgeber",
        "ausstellender_arzt_id",
    ] {
        assert!(
            attest_cols.iter().any(|c| c == col),
            "attest missing column {col}: {attest_cols:?}"
        );
    }
}

#[tokio::test]
async fn rezept_amvv_fields_round_trip() {
    use medoc_lib::domain::entities::rezept::CreateRezept;
    use medoc_lib::infrastructure::database::rezept_repo;

    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let patient_id = "t-rezept-pat-1".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Rezept Test', '1990-01-01', 'MAENNLICH', 'V-RX-1')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    let created = rezept_repo::create(
        &pool,
        &CreateRezept {
            patient_id: patient_id.clone(),
            arzt_id: "seed-arzt-001".into(),
            medikament: "Ibuprofen 400".into(),
            wirkstoff: Some("Ibuprofen".into()),
            dosierung: "1-0-1".into(),
            dauer: "7 Tage".into(),
            hinweise: None,
            pzn: Some("12345678".into()),
            darreichungsform: Some("Tablette".into()),
            packungsgroesse: Some("N2".into()),
            menge: Some(1),
            aut_idem: Some(true),
            rezept_typ: Some("KASSE".into()),
            icd10_code: Some("K08.1".into()),
            verordnender_arzt_id: Some("seed-arzt-001".into()),
        },
    )
    .await
    .expect("create rezept");

    assert_eq!(created.pzn.as_deref(), Some("12345678"));
    assert_eq!(created.darreichungsform.as_deref(), Some("Tablette"));
    assert_eq!(created.packungsgroesse.as_deref(), Some("N2"));
    assert_eq!(created.menge, Some(1));
    assert_eq!(created.aut_idem, Some(true));
    assert_eq!(created.rezept_typ.as_deref(), Some("KASSE"));
    assert_eq!(created.icd10_code.as_deref(), Some("K08.1"));

    let loaded = rezept_repo::find_by_id(&pool, &created.id)
        .await
        .expect("find")
        .expect("row");
    assert_eq!(loaded.pzn, created.pzn);
    assert_eq!(loaded.icd10_code, created.icd10_code);
}

#[tokio::test]
async fn attest_extended_fields_round_trip() {
    use chrono::NaiveDate;
    use medoc_lib::domain::entities::attest::CreateAttest;
    use medoc_lib::infrastructure::database::attest_repo;

    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let patient_id = "t-attest-pat-1".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer)
         VALUES (?1, 'Attest Test', '1990-01-01', 'MAENNLICH', 'V-AT-1')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    let von = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap();
    let bis = NaiveDate::from_ymd_opt(2026, 4, 14).unwrap();
    let created = attest_repo::create(
        &pool,
        &CreateAttest {
            patient_id: patient_id.clone(),
            arzt_id: "seed-arzt-001".into(),
            typ: "ARBEITSUNFAEHIGKEIT".into(),
            inhalt: "Patient arbeitsunfähig.".into(),
            gueltig_von: von,
            gueltig_bis: bis,
            icd10_code: Some("K08.1".into()),
            erst_oder_folge: Some("ERST".into()),
            arbeitgeber: Some("Muster GmbH".into()),
            ausstellender_arzt_id: Some("seed-arzt-001".into()),
        },
    )
    .await
    .expect("create attest");

    assert_eq!(created.icd10_code.as_deref(), Some("K08.1"));
    assert_eq!(created.erst_oder_folge.as_deref(), Some("ERST"));
    assert_eq!(created.arbeitgeber.as_deref(), Some("Muster GmbH"));

    let loaded = attest_repo::find_by_id(&pool, &created.id)
        .await
        .expect("find")
        .expect("row");
    assert_eq!(loaded.arbeitgeber, created.arbeitgeber);
    assert_eq!(loaded.ausstellender_arzt_id, created.ausstellender_arzt_id);
}

#[tokio::test]
async fn praxis_aufgabe_kommentar_table_exists_after_migrations() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='praxis_aufgabe_kommentar'",
    )
    .fetch_one(&pool)
    .await
    .expect("sqlite_master");
    assert_eq!(
        exists.0, 1,
        "praxis_aufgabe_kommentar table must exist after migrations"
    );

    // Existing DB path (legacy + rust_only) must stay idempotent.
    run_migrations(&pool).await.expect("second run");
    let still: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='praxis_aufgabe_kommentar'",
    )
    .fetch_one(&pool)
    .await
    .expect("sqlite_master after second run");
    assert_eq!(still.0, 1);
}
