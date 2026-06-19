//! Staff quota enforcement (MVP: 1 ARZT + 4 REZEPTION, 5 total).

use medoc_core::domain::entities::personal::{CreatePersonal, UpdatePersonal};
use medoc_core::domain::enums::Rolle;
use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::test_memory_pool;
use medoc_core::infrastructure::database::personal_repo;
use medoc_core::mvp_security;

async fn personal_only_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    sqlx::query(
        "CREATE TABLE personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL,
            taetigkeitsbereich TEXT,
            fachrichtung TEXT,
            telefon TEXT,
            verfuegbar INTEGER NOT NULL DEFAULT 1,
            totp_secret TEXT,
            totp_enrolled_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&pool)
    .await
    .expect("personal table");
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&pool)
    .await
    .expect("app_kv");
    mvp_security::ensure_staff_quota_db_triggers(&pool)
        .await
        .expect("staff quota triggers");
    pool
}

async fn insert_personal(pool: &sqlx::SqlitePool, id: &str, rolle: &str) {
    let hash = crypto::hash_password("TestPass42").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(id)
    .bind(format!("User {id}"))
    .bind(format!("{id}@praxis.de"))
    .bind(&hash)
    .bind(rolle)
    .execute(pool)
    .await
    .unwrap();
}

fn sample_create(email: &str, rolle: Rolle) -> CreatePersonal {
    CreatePersonal {
        name: "New User".into(),
        email: email.into(),
        passwort: "SecurePass42".into(),
        rolle,
        taetigkeitsbereich: None,
        fachrichtung: None,
        telefon: None,
    }
}

#[tokio::test]
async fn staff_quota_counts_roles() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    insert_personal(&pool, "r1", "REZEPTION").await;

    let q = mvp_security::staff_quota(&pool).await.expect("quota");
    assert_eq!(q.used_arzt, 1);
    assert_eq!(q.used_rezeption, 1);
    assert_eq!(q.max_total, mvp_security::MAX_TOTAL_PERSONAL);
}

#[tokio::test]
async fn check_staff_quota_rejects_second_arzt() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;

    let err = mvp_security::check_staff_quota(&pool, "ARZT", None)
        .await
        .expect_err("second arzt");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn check_staff_quota_rejects_sixth_user() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    for i in 1..=4 {
        insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
    }

    let err = mvp_security::check_staff_quota(&pool, "REZEPTION", None)
        .await
        .expect_err("sixth user");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn check_staff_quota_allows_role_change_when_slot_free() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "r1", "REZEPTION").await;

    mvp_security::check_staff_quota(&pool, "ARZT", Some("r1"))
        .await
        .expect("rezeption to arzt when arzt slot free");
}

#[tokio::test]
async fn update_with_quota_rezeption_to_arzt_when_slot_free() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "r1", "REZEPTION").await;

    let data = UpdatePersonal {
        name: None,
        email: None,
        rolle: Some(Rolle::Arzt),
        taetigkeitsbereich: None,
        fachrichtung: None,
        telefon: None,
        verfuegbar: None,
    };
    let p = personal_repo::update_with_quota(&pool, "r1", &data, "ARZT")
        .await
        .expect("promote to arzt");
    assert_eq!(p.rolle, "ARZT");
}

#[tokio::test]
async fn update_with_quota_rejects_rezeption_to_arzt_when_arzt_full() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    insert_personal(&pool, "r1", "REZEPTION").await;

    let data = UpdatePersonal {
        name: None,
        email: None,
        rolle: Some(Rolle::Arzt),
        taetigkeitsbereich: None,
        fachrichtung: None,
        telefon: None,
        verfuegbar: None,
    };
    let err = personal_repo::update_with_quota(&pool, "r1", &data, "ARZT")
        .await
        .expect_err("arzt slot taken");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("Arzt")));
}

#[tokio::test]
async fn update_with_quota_rejects_arzt_to_rezeption_when_rezeption_full() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    for i in 1..=4 {
        insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
    }

    let data = UpdatePersonal {
        name: None,
        email: None,
        rolle: Some(Rolle::Rezeption),
        taetigkeitsbereich: None,
        fachrichtung: None,
        telefon: None,
        verfuegbar: None,
    };
    let err = personal_repo::update_with_quota(&pool, "a1", &data, "REZEPTION")
        .await
        .expect_err("rezeption full");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("Rezeptions")));
}

#[tokio::test]
async fn update_without_quota_allows_name_change_without_role_change() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;

    let data = UpdatePersonal {
        name: Some("Dr. Updated".into()),
        email: None,
        rolle: None,
        taetigkeitsbereich: None,
        fachrichtung: None,
        telefon: None,
        verfuegbar: None,
    };
    let p = personal_repo::update(&pool, "a1", &data)
        .await
        .expect("name-only update");
    assert_eq!(p.name, "Dr. Updated");
    assert_eq!(p.rolle, "ARZT");
}

#[tokio::test]
async fn create_with_quota_concurrent_boundary_allows_only_one() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    for i in 1..=3 {
        insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
    }

    let hash = crypto::hash_password("SecurePass42").unwrap();
    let data_a = sample_create("new-a@praxis.de", Rolle::Rezeption);
    let data_b = sample_create("new-b@praxis.de", Rolle::Rezeption);

    let (res_a, res_b) = tokio::join!(
        personal_repo::create_with_quota(&pool, &data_a, &hash),
        personal_repo::create_with_quota(&pool, &data_b, &hash),
    );

    let successes = [res_a.is_ok(), res_b.is_ok()]
        .into_iter()
        .filter(|ok| *ok)
        .count();
    assert_eq!(successes, 1, "exactly one concurrent create may succeed");

    let failures = [res_a.err(), res_b.err()].into_iter().flatten().count();
    assert_eq!(failures, 1, "exactly one concurrent create must fail");
}

#[tokio::test]
async fn create_with_quota_concurrent_boundary_stable_under_repetition() {
    for attempt in 0..30 {
        let pool = personal_only_pool().await;
        insert_personal(&pool, "a1", "ARZT").await;
        for i in 1..=3 {
            insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
        }

        let hash = crypto::hash_password("SecurePass42").unwrap();
        let data_a = sample_create(&format!("rep-a-{attempt}@praxis.de"), Rolle::Rezeption);
        let data_b = sample_create(&format!("rep-b-{attempt}@praxis.de"), Rolle::Rezeption);

        let (res_a, res_b) = tokio::join!(
            personal_repo::create_with_quota(&pool, &data_a, &hash),
            personal_repo::create_with_quota(&pool, &data_b, &hash),
        );

        let successes = [res_a.is_ok(), res_b.is_ok()]
            .into_iter()
            .filter(|ok| *ok)
            .count();
        assert_eq!(
            successes, 1,
            "attempt {attempt}: exactly one concurrent create may succeed"
        );
    }
}

#[tokio::test]
async fn update_with_quota_concurrent_promote_to_arzt_allows_only_one() {
    for attempt in 0..25 {
        let pool = personal_only_pool().await;
        insert_personal(&pool, &format!("r1-{attempt}"), "REZEPTION").await;
        insert_personal(&pool, &format!("r2-{attempt}"), "REZEPTION").await;

        let id1 = format!("r1-{attempt}");
        let id2 = format!("r2-{attempt}");
        let data = UpdatePersonal {
            name: None,
            email: None,
            rolle: Some(Rolle::Arzt),
            taetigkeitsbereich: None,
            fachrichtung: None,
            telefon: None,
            verfuegbar: None,
        };

        let (res_a, res_b) = tokio::join!(
            personal_repo::update_with_quota(&pool, &id1, &data, "ARZT"),
            personal_repo::update_with_quota(&pool, &id2, &data, "ARZT"),
        );

        let successes = [res_a.is_ok(), res_b.is_ok()]
            .into_iter()
            .filter(|ok| *ok)
            .count();
        assert_eq!(
            successes, 1,
            "attempt {attempt}: exactly one concurrent ARZT promotion may succeed"
        );

        let arzt_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM personal WHERE UPPER(rolle) = 'ARZT'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(arzt_count.0, 1);
    }
}

#[tokio::test]
async fn db_trigger_blocks_direct_insert_past_cap() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    for i in 1..=4 {
        insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
    }

    let hash = crypto::hash_password("x").unwrap();
    let err = sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('six', 'Six', 'six@x.de', ?1, 'REZEPTION')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect_err("sixth insert must be blocked by trigger");
    assert!(
        err.to_string().contains("Maximal 5"),
        "trigger message: {}",
        err
    );
}

#[tokio::test]
async fn create_with_quota_rejects_sixth_user_atomically() {
    let pool = personal_only_pool().await;
    insert_personal(&pool, "a1", "ARZT").await;
    for i in 1..=4 {
        insert_personal(&pool, &format!("r{i}"), "REZEPTION").await;
    }

    let hash = crypto::hash_password("SecurePass42").unwrap();
    let data = sample_create("sixth@praxis.de", Rolle::Rezeption);
    let err = personal_repo::create_with_quota(&pool, &data, &hash)
        .await
        .expect_err("sixth user");
    assert!(matches!(err, AppError::Validation(_)));
}
