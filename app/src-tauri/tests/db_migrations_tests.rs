// SQLite schema migrations: idempotency and baseline tables (FA-DB baseline).

use medoc_lib::infrastructure::database::connection::run_migrations;
use sqlx::sqlite::SqlitePoolOptions;

async fn memory_pool() -> sqlx::SqlitePool {
    SqlitePoolOptions::new()
        .max_connections(2)
        .connect("sqlite::memory:")
        .await
        .expect("sqlite memory pool")
}

#[tokio::test]
async fn run_migrations_twice_is_idempotent() {
    let pool = memory_pool().await;
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
    let pool = memory_pool().await;
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
