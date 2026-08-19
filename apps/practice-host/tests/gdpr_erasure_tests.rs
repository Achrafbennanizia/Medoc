// DSGVO erasure: deletes chart-linked rows, anonymises, redacts backups + logs.

use medoc_lib::infrastructure::backup;
use medoc_lib::infrastructure::database::audit_repo;
use medoc_lib::infrastructure::database::connection::{init_db_headless, run_migrations};
use medoc_lib::infrastructure::database::{db_key, sqlcipher};
use medoc_lib::infrastructure::dsgvo;
use medoc_lib::infrastructure::logging::sanitizer;
use std::path::PathBuf;
use std::sync::{Mutex, Once};
use zeroize::Zeroizing;

const HEX_KEY: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

static INIT: Once = Once::new();
static DSGVO_TEST_LOCK: Mutex<()> = Mutex::new(());

fn init_env(app_dir: &PathBuf, backup_dir: &PathBuf, log_dir: &PathBuf) {
    INIT.call_once(|| {
        std::env::set_var("MEDOC_DB_KEY", HEX_KEY);
        std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    });
    std::env::set_var("MEDOC_BACKUP_DIR", backup_dir);
    std::env::set_var("MEDOC_LOG_DIR", log_dir);
    std::fs::create_dir_all(backup_dir).expect("backup dir");
    std::fs::create_dir_all(log_dir).expect("log dir");
    std::fs::create_dir_all(app_dir).expect("app dir");
    audit_repo::init_audit_hmac_key(app_dir).expect("audit key");
}

#[tokio::test]
async fn erase_removes_treatment_via_chart_and_anonymises_patient() {
    let (base, app_dir, _backup_dir, log_dir) = {
        let _lock = DSGVO_TEST_LOCK.lock().expect("dsgvo test lock");
        let base = std::env::temp_dir().join(format!("medoc-dsgvo-{}", std::process::id()));
        let app_dir = base.join("app");
        let backup_dir = base.join("backups");
        let log_dir = base.join("logs");
        let _ = std::fs::remove_dir_all(&base);
        init_env(&app_dir, &backup_dir, &log_dir);
        (base, app_dir, backup_dir, log_dir)
    };

    let pool = init_db_headless(&app_dir)
        .await
        .expect("file-backed sqlcipher db");
    run_migrations(&pool).await.expect("migrations");

    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p-dsgvo-1', 'Test Patient', '1990-05-05', 'FEMALE', 'VNR-DSGVO-1', 'ACTIVE')",
    )
    .execute(&pool)
    .await
    .expect("insert patient");

    sqlx::query(
        "INSERT INTO patient_chart (id, patient_id, status) VALUES ('chart-dsgvo-1', 'p-dsgvo-1', 'VALIDATED')",
    )
    .execute(&pool)
    .await
    .expect("insert chart");

    sqlx::query(
        "INSERT INTO treatment (id, chart_id, kind) VALUES ('beh-dsgvo-1', 'chart-dsgvo-1', 'Kontrolle')",
    )
    .execute(&pool)
    .await
    .expect("insert treatment");

    sqlx::query(
        "INSERT INTO chart_validation (patient_id, section_or_item, validated_at, validated_by)
         VALUES ('p-dsgvo-1', 'master', datetime('now'), 'u-test')",
    )
    .execute(&pool)
    .await
    .expect("insert chart_validation");

    sqlx::query(
        "INSERT INTO chart_next_appointment_hint (patient_id, hint_json)
         VALUES ('p-dsgvo-1', '{\"freeText\":\"Kontrolle\"}')",
    )
    .execute(&pool)
    .await
    .expect("insert chart_next_appointment_hint");

    sqlx::query(
        "INSERT INTO invoice_document (id, patient_id, document_number, payload_json, total_cents, created_at, created_by)
         VALUES ('rd-dsgvo-1','p-dsgvo-1','RE-TEST','{}',0,datetime('now'),'u-test')",
    )
    .execute(&pool)
    .await
    .expect("insert invoice_document");

    backup::create(&pool).await.expect("snapshot backup");

    std::fs::write(
        log_dir.join("app.log"),
        "event=VIEW patient_id=p-dsgvo-1 name=Test Patient\n",
    )
    .expect("write log");

    let report = dsgvo::erase_patient(&pool, "p-dsgvo-1", &app_dir)
        .await
        .expect("erase");

    assert!(
        report.backups_redacted >= 1,
        "backup snapshot must be redacted"
    );
    assert!(report.log_files_redacted >= 1, "log file must be redacted");

    let n_beh_after: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM treatment WHERE chart_id = 'chart-dsgvo-1'")
            .fetch_one(&pool)
            .await
            .expect("count treatment after");
    assert_eq!(n_beh_after.0, 0);

    let row: (String, String, String, String) = sqlx::query_as(
        "SELECT name, sex, status, insurance_number FROM patient WHERE id = 'p-dsgvo-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("select patient");

    assert!(row.0.starts_with("Anonymisiert"));
    assert_eq!(row.1, "DIVERSE");
    assert_eq!(row.2, "READONLY");
    assert!(row.3.starts_with("ANON-"));

    let backups = backup::list().expect("list backups");
    assert!(!backups.is_empty());
    let key = db_key::env_override_key().expect("MEDOC_DB_KEY");
    let backup_pool = sqlcipher::open_encrypted_pool(&backups[0].path, Zeroizing::new(key), false)
        .await
        .expect("open backup");
    let backup_name: (String,) = sqlx::query_as("SELECT name FROM patient WHERE id = 'p-dsgvo-1'")
        .fetch_one(&backup_pool)
        .await
        .expect("patient in backup");
    assert!(
        backup_name.0.starts_with("Anonymisiert"),
        "backup DB must be anonymised: {:?}",
        backup_name.0
    );
    backup_pool.close().await;

    let log_body = std::fs::read_to_string(log_dir.join("app.log")).expect("read log");
    assert!(!log_body.contains("p-dsgvo-1"));
    assert!(log_body.contains("[REDACTED-patient-"));

    let _ = std::fs::remove_dir_all(&base);
}

#[test]
fn redact_patient_id_in_logs_replaces_needle() {
    let _lock = DSGVO_TEST_LOCK.lock().expect("dsgvo test lock");
    let log_dir = std::env::temp_dir().join(format!("medoc-dsgvo-log-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&log_dir);
    std::fs::create_dir_all(&log_dir).expect("log dir");
    std::fs::write(log_dir.join("security.log"), "patient_id=p-dsgvo-x\n").expect("write");

    // sanitizer scans ~/medoc-data/logs when tracing not init — write there too.
    let home_logs = dirs::home_dir()
        .map(|h| h.join("medoc-data").join("logs"))
        .expect("home");
    std::fs::create_dir_all(&home_logs).ok();
    let probe = home_logs.join(format!("medoc-dsgvo-probe-{}.log", std::process::id()));
    std::fs::write(&probe, "needle p-dsgvo-x tail").expect("probe log");

    let report = sanitizer::redact_patient_id_in_logs("p-dsgvo-x").expect("redact");
    assert!(!report.redacted_files.is_empty());

    let body = std::fs::read_to_string(&probe).expect("read probe");
    assert!(!body.contains("p-dsgvo-x"));
    assert!(body.contains("[REDACTED-patient-"));

    let _ = std::fs::remove_file(&probe);
    let _ = std::fs::remove_dir_all(&log_dir);
}
