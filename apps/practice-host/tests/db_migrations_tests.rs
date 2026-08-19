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

    let staff: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM staff")
        .fetch_one(&pool)
        .await
        .expect("count staff");
    assert!(
        staff.0 >= 2,
        "seed staff expected when staff was empty: got {}",
        staff.0
    );
}

#[tokio::test]
async fn prescription_and_certificate_forward_migrations_add_columns() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let prescription_cols: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('prescription')")
            .fetch_all(&pool)
            .await
            .expect("pragma prescription");
    for col in [
        "pzn",
        "dosage_form",
        "pack_size",
        "quantity",
        "aut_idem",
        "prescription_type",
        "icd10_code",
        "prescribing_physician_id",
    ] {
        assert!(
            prescription_cols.iter().any(|c| c == col),
            "prescription missing column {col}: {prescription_cols:?}"
        );
    }

    let certificate_cols: Vec<String> =
        sqlx::query_scalar::<_, String>("SELECT name FROM pragma_table_info('certificate')")
            .fetch_all(&pool)
            .await
            .expect("pragma certificate");
    for col in [
        "icd10_code",
        "first_or_follow_up",
        "employer",
        "issuing_physician_id",
    ] {
        assert!(
            certificate_cols.iter().any(|c| c == col),
            "certificate missing column {col}: {certificate_cols:?}"
        );
    }
}

#[tokio::test]
async fn prescription_amvv_fields_round_trip() {
    use medoc_lib::domain::entities::prescription::CreatePrescription;
    use medoc_lib::infrastructure::database::prescription_repo;

    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let patient_id = "t-prescription-pat-1".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Prescription Test', '1990-01-01', 'MALE', 'V-RX-1')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    let created = prescription_repo::create(
        &pool,
        &CreatePrescription {
            patient_id: patient_id.clone(),
            physician_id: "seed-physician-001".into(),
            medication: "Ibuprofen 400".into(),
            active_ingredient: Some("Ibuprofen".into()),
            dosage: "1-0-1".into(),
            duration: "7 Tage".into(),
            instructions: None,
            pzn: Some("12345678".into()),
            dosage_form: Some("Tablette".into()),
            pack_size: Some("N2".into()),
            quantity: Some(1),
            aut_idem: Some(true),
            prescription_type: Some("KASSE".into()),
            icd10_code: Some("K08.1".into()),
            prescribing_physician_id: Some("seed-physician-001".into()),
        },
    )
    .await
    .expect("create prescription");

    assert_eq!(created.pzn.as_deref(), Some("12345678"));
    assert_eq!(created.dosage_form.as_deref(), Some("Tablette"));
    assert_eq!(created.pack_size.as_deref(), Some("N2"));
    assert_eq!(created.quantity, Some(1));
    assert_eq!(created.aut_idem, Some(true));
    assert_eq!(created.prescription_type.as_deref(), Some("KASSE"));
    assert_eq!(created.icd10_code.as_deref(), Some("K08.1"));

    let loaded = prescription_repo::find_by_id(&pool, &created.id)
        .await
        .expect("find")
        .expect("row");
    assert_eq!(loaded.pzn, created.pzn);
    assert_eq!(loaded.icd10_code, created.icd10_code);
}

#[tokio::test]
async fn certificate_extended_fields_round_trip() {
    use chrono::NaiveDate;
    use medoc_lib::domain::entities::certificate::CreateCertificate;
    use medoc_lib::infrastructure::database::certificate_repo;

    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let patient_id = "t-certificate-pat-1".to_string();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number)
         VALUES (?1, 'Certificate Test', '1990-01-01', 'MALE', 'V-AT-1')",
    )
    .bind(&patient_id)
    .execute(&pool)
    .await
    .expect("insert patient");

    let from = NaiveDate::from_ymd_opt(2026, 4, 1).unwrap();
    let until = NaiveDate::from_ymd_opt(2026, 4, 14).unwrap();
    let created = certificate_repo::create(
        &pool,
        &CreateCertificate {
            patient_id: patient_id.clone(),
            physician_id: "seed-physician-001".into(),
            kind: "SICK_LEAVE".into(),
            body_text: "Patient sick_leave.".into(),
            valid_from: from,
            valid_until: until,
            icd10_code: Some("K08.1".into()),
            first_or_follow_up: Some("FIRST".into()),
            employer: Some("Muster GmbH".into()),
            issuing_physician_id: Some("seed-physician-001".into()),
        },
    )
    .await
    .expect("create certificate");

    assert_eq!(created.icd10_code.as_deref(), Some("K08.1"));
    assert_eq!(created.first_or_follow_up.as_deref(), Some("FIRST"));
    assert_eq!(created.employer.as_deref(), Some("Muster GmbH"));

    let loaded = certificate_repo::find_by_id(&pool, &created.id)
        .await
        .expect("find")
        .expect("row");
    assert_eq!(loaded.employer, created.employer);
    assert_eq!(loaded.issuing_physician_id, created.issuing_physician_id);
}

#[tokio::test]
async fn practice_task_comment_table_exists_after_migrations() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");
    run_migrations(&pool).await.expect("migrations");

    let exists: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='practice_task_comment'",
    )
    .fetch_one(&pool)
    .await
    .expect("sqlite_master");
    assert_eq!(
        exists.0, 1,
        "practice_task_comment table must exist after migrations"
    );

    // Existing DB path (legacy + rust_only) must stay idempotent.
    run_migrations(&pool).await.expect("second run");
    let still: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='practice_task_comment'",
    )
    .fetch_one(&pool)
    .await
    .expect("sqlite_master after second run");
    assert_eq!(still.0, 1);
}

#[tokio::test]
async fn english_upgrade_renames_legacy_german_and_camelcase_tables() {
    let pool = test_memory_pool().await.expect("encrypted memory pool");

    sqlx::query(
        "CREATE TABLE personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL CHECK (rolle IN ('ARZT','REZEPTION'))
        )",
    )
    .execute(&pool)
    .await
    .expect("create personal");
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('legacy-arzt-1', 'Dr. Legacy', 'legacy@practice.de', 'x', 'ARZT')",
    )
    .execute(&pool)
    .await
    .expect("insert personal");

    sqlx::query(
        "CREATE TABLE patienten (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            geburtsdatum TEXT NOT NULL,
            geschlecht TEXT NOT NULL CHECK (geschlecht IN ('MAENNLICH','WEIBLICH','DIVERS'))
        )",
    )
    .execute(&pool)
    .await
    .expect("create patienten");
    sqlx::query(
        "INSERT INTO patienten (id, name, geburtsdatum, geschlecht)
         VALUES ('legacy-pat-1', 'Legacy Patient', '1990-01-01', 'MAENNLICH')",
    )
    .execute(&pool)
    .await
    .expect("insert patienten");

    sqlx::query(
        "CREATE TABLE serviceItem (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            active INTEGER NOT NULL DEFAULT 1
        )",
    )
    .execute(&pool)
    .await
    .expect("create serviceItem");
    sqlx::query(
        "INSERT INTO serviceItem (id, name, category, price, active)
         VALUES ('legacy-lei-1', 'PZR', 'Kontrolluntersuchung', 99.0, 1)",
    )
    .execute(&pool)
    .await
    .expect("insert serviceItem");

    sqlx::query(
        "CREATE TABLE purchaseOrder (
            id TEXT PRIMARY KEY,
            supplier TEXT NOT NULL,
            item TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN'
        )",
    )
    .execute(&pool)
    .await
    .expect("create purchaseOrder");
    sqlx::query(
        "INSERT INTO purchaseOrder (id, supplier, item, status)
         VALUES ('legacy-po-1', 'Dental GmbH', 'Gloves', 'OPEN')",
    )
    .execute(&pool)
    .await
    .expect("insert purchaseOrder");

    run_migrations(&pool).await.expect("upgrade + migrations");

    let role: String = sqlx::query_scalar("SELECT role FROM staff WHERE id = 'legacy-arzt-1'")
        .fetch_one(&pool)
        .await
        .expect("staff.role");
    assert_eq!(role, "PHYSICIAN");

    let sex: String = sqlx::query_scalar("SELECT sex FROM patient WHERE id = 'legacy-pat-1'")
        .fetch_one(&pool)
        .await
        .expect("patient.sex");
    assert_eq!(sex, "MALE");

    let category: String =
        sqlx::query_scalar("SELECT category FROM service_item WHERE id = 'legacy-lei-1'")
            .fetch_one(&pool)
            .await
            .expect("service_item.category");
    assert_eq!(category, "Checkup");

    let po: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM purchase_order WHERE id = 'legacy-po-1'")
        .fetch_one(&pool)
        .await
        .expect("purchase_order row");
    assert_eq!(po, 1);

    for gone in ["personal", "patienten", "serviceItem", "purchaseOrder"] {
        let n: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(gone)
        .fetch_one(&pool)
        .await
        .expect("sqlite_master");
        assert_eq!(n, 0, "legacy table {gone} should be renamed away");
    }

    run_migrations(&pool).await.expect("upgrade is idempotent");
}
