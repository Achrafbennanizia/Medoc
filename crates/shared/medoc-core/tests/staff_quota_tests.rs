//! Staff quota enforcement (MVP: 1 PHYSICIAN + 4 RECEPTION, 5 total).

use medoc_core::domain::entities::staff::{CreateStaff, UpdateStaff};
use medoc_core::domain::enums::Role;
use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::test_memory_pool;
use medoc_core::infrastructure::database::staff_repo;
use medoc_core::mvp_security;

async fn staff_only_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    sqlx::query(
        "CREATE TABLE staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            activity_area TEXT,
            specialty TEXT,
            phone TEXT,
            available INTEGER NOT NULL DEFAULT 1,
            totp_secret TEXT,
            totp_enrolled_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(&pool)
    .await
    .expect("staff table");
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

async fn insert_staff(pool: &sqlx::SqlitePool, id: &str, role: &str) {
    let hash = crypto::hash_password("TestPass42").unwrap();
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(id)
    .bind(format!("User {id}"))
    .bind(format!("{id}@practice.de"))
    .bind(&hash)
    .bind(role)
    .execute(pool)
    .await
    .unwrap();
}

fn sample_create(email: &str, role: Role) -> CreateStaff {
    CreateStaff {
        name: "New User".into(),
        email: email.into(),
        password: "SecurePass42".into(),
        role,
        activity_area: None,
        specialty: None,
        phone: None,
    }
}

#[tokio::test]
async fn staff_quota_counts_roles() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    insert_staff(&pool, "r1", "RECEPTION").await;

    let q = mvp_security::staff_quota(&pool).await.expect("quota");
    assert_eq!(q.used_physician, 1);
    assert_eq!(q.used_reception, 1);
    assert_eq!(q.max_total, mvp_security::MAX_TOTAL_STAFF);
}

#[tokio::test]
async fn check_staff_quota_rejects_second_physician() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;

    let err = mvp_security::check_staff_quota(&pool, "PHYSICIAN", None)
        .await
        .expect_err("second physician");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn check_staff_quota_rejects_sixth_user() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    for i in 1..=4 {
        insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
    }

    let err = mvp_security::check_staff_quota(&pool, "RECEPTION", None)
        .await
        .expect_err("sixth user");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn check_staff_quota_allows_role_change_when_slot_free() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "r1", "RECEPTION").await;

    mvp_security::check_staff_quota(&pool, "PHYSICIAN", Some("r1"))
        .await
        .expect("reception to physician when physician slot free");
}

#[tokio::test]
async fn update_with_quota_reception_to_physician_when_slot_free() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "r1", "RECEPTION").await;

    let data = UpdateStaff {
        name: None,
        email: None,
        role: Some(Role::Physician),
        activity_area: None,
        specialty: None,
        phone: None,
        available: None,
    };
    let p = staff_repo::update_with_quota(&pool, "r1", &data, "PHYSICIAN")
        .await
        .expect("promote to physician");
    assert_eq!(p.role, "PHYSICIAN");
}

#[tokio::test]
async fn update_with_quota_rejects_reception_to_physician_when_physician_full() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    insert_staff(&pool, "r1", "RECEPTION").await;

    let data = UpdateStaff {
        name: None,
        email: None,
        role: Some(Role::Physician),
        activity_area: None,
        specialty: None,
        phone: None,
        available: None,
    };
    let err = staff_repo::update_with_quota(&pool, "r1", &data, "PHYSICIAN")
        .await
        .expect_err("physician slot taken");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("Physician")));
}

#[tokio::test]
async fn update_with_quota_rejects_physician_to_reception_when_reception_full() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    for i in 1..=4 {
        insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
    }

    let data = UpdateStaff {
        name: None,
        email: None,
        role: Some(Role::Reception),
        activity_area: None,
        specialty: None,
        phone: None,
        available: None,
    };
    let err = staff_repo::update_with_quota(&pool, "a1", &data, "RECEPTION")
        .await
        .expect_err("reception full");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("reception")));
}

#[tokio::test]
async fn update_without_quota_allows_name_change_without_role_change() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;

    let data = UpdateStaff {
        name: Some("Dr. Updated".into()),
        email: None,
        role: None,
        activity_area: None,
        specialty: None,
        phone: None,
        available: None,
    };
    let p = staff_repo::update(&pool, "a1", &data)
        .await
        .expect("name-only update");
    assert_eq!(p.name, "Dr. Updated");
    assert_eq!(p.role, "PHYSICIAN");
}

#[tokio::test]
async fn create_with_quota_concurrent_boundary_allows_only_one() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    for i in 1..=3 {
        insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
    }

    let hash = crypto::hash_password("SecurePass42").unwrap();
    let data_a = sample_create("new-a@practice.de", Role::Reception);
    let data_b = sample_create("new-b@practice.de", Role::Reception);

    let (res_a, res_b) = tokio::join!(
        staff_repo::create_with_quota(&pool, &data_a, &hash),
        staff_repo::create_with_quota(&pool, &data_b, &hash),
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
        let pool = staff_only_pool().await;
        insert_staff(&pool, "a1", "PHYSICIAN").await;
        for i in 1..=3 {
            insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
        }

        let hash = crypto::hash_password("SecurePass42").unwrap();
        let data_a = sample_create(&format!("rep-a-{attempt}@practice.de"), Role::Reception);
        let data_b = sample_create(&format!("rep-b-{attempt}@practice.de"), Role::Reception);

        let (res_a, res_b) = tokio::join!(
            staff_repo::create_with_quota(&pool, &data_a, &hash),
            staff_repo::create_with_quota(&pool, &data_b, &hash),
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
async fn update_with_quota_concurrent_promote_to_physician_allows_only_one() {
    for attempt in 0..25 {
        let pool = staff_only_pool().await;
        insert_staff(&pool, &format!("r1-{attempt}"), "RECEPTION").await;
        insert_staff(&pool, &format!("r2-{attempt}"), "RECEPTION").await;

        let id1 = format!("r1-{attempt}");
        let id2 = format!("r2-{attempt}");
        let data = UpdateStaff {
            name: None,
            email: None,
            role: Some(Role::Physician),
            activity_area: None,
            specialty: None,
            phone: None,
            available: None,
        };

        let (res_a, res_b) = tokio::join!(
            staff_repo::update_with_quota(&pool, &id1, &data, "PHYSICIAN"),
            staff_repo::update_with_quota(&pool, &id2, &data, "PHYSICIAN"),
        );

        let successes = [res_a.is_ok(), res_b.is_ok()]
            .into_iter()
            .filter(|ok| *ok)
            .count();
        assert_eq!(
            successes, 1,
            "attempt {attempt}: exactly one concurrent PHYSICIAN promotion may succeed"
        );

        let physician_count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM staff WHERE UPPER(role) = 'PHYSICIAN'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(physician_count.0, 1);
    }
}

#[tokio::test]
async fn db_trigger_blocks_direct_insert_past_cap() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    for i in 1..=4 {
        insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
    }

    let hash = crypto::hash_password("x").unwrap();
    let err = sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('six', 'Six', 'six@x.de', ?1, 'RECEPTION')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect_err("sixth insert must be blocked by trigger");
    assert!(
        err.to_string().contains("Maximum 5"),
        "trigger message: {}",
        err
    );
}

#[tokio::test]
async fn create_with_quota_rejects_sixth_user_atomically() {
    let pool = staff_only_pool().await;
    insert_staff(&pool, "a1", "PHYSICIAN").await;
    for i in 1..=4 {
        insert_staff(&pool, &format!("r{i}"), "RECEPTION").await;
    }

    let hash = crypto::hash_password("SecurePass42").unwrap();
    let data = sample_create("sixth@practice.de", Role::Reception);
    let err = staff_repo::create_with_quota(&pool, &data, &hash)
        .await
        .expect_err("sixth user");
    assert!(matches!(err, AppError::Validation(_)));
}
