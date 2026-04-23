// CSV patient import (FA-MIG-01): validation, dates, duplicates, dry-run.

use medoc_lib::error::AppError;
use medoc_lib::infrastructure::database::connection::run_migrations;
use medoc_lib::infrastructure::migration::import_patients;
use sqlx::sqlite::SqlitePoolOptions;
use std::path::PathBuf;

fn temp_csv(contents: &str) -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "medoc-migration-import-{}-{}.csv",
        std::process::id(),
        uuid::Uuid::new_v4()
    ));
    std::fs::write(&path, contents).expect("write csv");
    path
}

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(2)
        .connect("sqlite::memory:")
        .await
        .expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

#[tokio::test]
async fn rejects_csv_without_required_headers() {
    let pool = migrated_pool().await;
    let path = temp_csv("foo;bar\nx;y\n");
    let err = import_patients(&pool, &path, false)
        .await
        .expect_err("should reject bad header");
    match err {
        AppError::Validation(msg) => {
            assert!(
                msg.contains("name") || msg.contains("geburtsdatum"),
                "{msg}"
            );
        }
        other => panic!("expected Validation, got {other:?}"),
    }
}

#[tokio::test]
async fn dry_run_does_not_insert_patients() {
    let pool = migrated_pool().await;
    let path = temp_csv(
        "name;geburtsdatum;geschlecht;versicherungsnummer\n\
         Test User;1990-01-15;M;V-DRY-1\n",
    );
    let report = import_patients(&pool, &path, true).await.expect("dry run");
    assert_eq!(report.total_rows, 1);
    assert_eq!(report.imported, 1);

    let n: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM patient WHERE versicherungsnummer = 'V-DRY-1'")
            .fetch_one(&pool)
            .await
            .expect("count");
    assert_eq!(n.0, 0, "dry_run must not insert");
}

#[tokio::test]
async fn imports_semicolon_csv_iso_and_de_dates() {
    let pool = migrated_pool().await;
    let path = temp_csv(
        "name;geburtsdatum;geschlecht;versicherungsnummer\n\
         Iso Pat;1990-03-20;M;V-ISO-1\n\
         De Pat;15.06.1985;W;V-DE-1\n",
    );
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.total_rows, 2);
    assert_eq!(report.imported, 2);
    assert_eq!(report.failed, 0);
    assert_eq!(report.skipped, 0);

    let n1: (String,) =
        sqlx::query_as("SELECT name FROM patient WHERE versicherungsnummer = 'V-ISO-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(n1.0, "Iso Pat");

    let geb: (String,) =
        sqlx::query_as("SELECT geburtsdatum FROM patient WHERE versicherungsnummer = 'V-DE-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(geb.0, "1985-06-15");
}

#[tokio::test]
async fn duplicate_versicherungsnummer_is_skipped() {
    let pool = migrated_pool().await;
    let path = temp_csv(
        "name;geburtsdatum;geschlecht;versicherungsnummer\n\
         First;1991-01-01;M;V-DUP-1\n\
         Second;1992-02-02;W;V-DUP-1\n",
    );
    let report = import_patients(&pool, &path, false).await.expect("import");
    assert_eq!(report.imported, 1);
    assert_eq!(report.skipped, 1);
    assert_eq!(report.failed, 0);

    let name: (String,) =
        sqlx::query_as("SELECT name FROM patient WHERE versicherungsnummer = 'V-DUP-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(name.0, "First");
}

#[tokio::test]
async fn invalid_date_row_is_failed_not_imported() {
    let pool = migrated_pool().await;
    let path = temp_csv(
        "name;geburtsdatum;geschlecht;versicherungsnummer\n\
         Bad Date;not-a-date;M;V-BAD-1\n",
    );
    let report = import_patients(&pool, &path, false).await.expect("report");
    assert_eq!(report.failed, 1);
    assert_eq!(report.imported, 0);
    assert!(!report.errors.is_empty());

    let n: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM patient WHERE versicherungsnummer = 'V-BAD-1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(n.0, 0);
}
