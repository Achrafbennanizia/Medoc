//! MVP security gate helpers — not ignored; run with `cargo test -p medoc-core mvp_security_gates`.

use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::test_memory_pool;
use medoc_core::infrastructure::database::staff_repo;
use medoc_core::mvp_security::{self, QuotaErrorMessages, StaffQuotaLimits};

#[test]
fn staff_quota_limits_matches_constants() {
    let limits = mvp_security::staff_quota_limits();
    assert_eq!(
        limits,
        StaffQuotaLimits {
            max_physician: mvp_security::MAX_PHYSICIAN,
            max_reception: mvp_security::MAX_RECEPTION,
            max_total: mvp_security::MAX_TOTAL_STAFF,
        }
    );
}

#[test]
fn staff_quota_trigger_ddl_uses_limits() {
    let limits = mvp_security::staff_quota_limits();
    let (insert, update) = mvp_security::staff_quota_trigger_ddl(limits);
    assert!(insert.contains(">= 5"), "insert DDL: {insert}");
    assert!(insert.contains(">= 1"), "insert DDL: {insert}");
    assert!(insert.contains(">= 4"), "insert DDL: {insert}");
    assert!(update.contains(">= 5"), "update DDL: {update}");
    assert!(update.contains(">= 1"), "update DDL: {update}");
    assert!(update.contains(">= 4"), "update DDL: {update}");
    assert!(!insert.contains(">= 99"));
}

#[test]
fn staff_quota_trigger_ddl_custom_limits() {
    let limits = StaffQuotaLimits {
        max_physician: 2,
        max_reception: 8,
        max_total: 10,
    };
    let (insert, update) = mvp_security::staff_quota_trigger_ddl(limits);
    assert!(insert.contains(">= 10"));
    assert!(insert.contains(">= 2"));
    assert!(insert.contains(">= 8"));
    assert!(update.contains(">= 10"));
    assert!(update.contains(">= 2"));
    assert!(update.contains(">= 8"));
    assert!(!insert.contains(">= 5"));
}

#[test]
fn quota_error_messages_match_limits() {
    let limits = StaffQuotaLimits {
        max_physician: 2,
        max_reception: 8,
        max_total: 10,
    };
    let msgs = mvp_security::quota_error_messages(limits);
    assert_eq!(msgs.max_total, "Maximum 10 users allowed");
    assert!(msgs.max_physician.contains('2'));
    assert!(msgs.max_reception.contains('8'));
}

#[test]
fn sql_raise_message_literal_always_escapes_apostrophes() {
    assert_eq!(mvp_security::sql_raise_message_literal("plain"), "'plain'");
    assert_eq!(
        mvp_security::sql_raise_message_literal("Physician's account"),
        "'Physician''s account'"
    );
}

#[test]
fn staff_quota_trigger_ddl_apostrophe_in_raise_message() {
    let limits = StaffQuotaLimits {
        max_physician: 1,
        max_reception: 4,
        max_total: 5,
    };
    let msgs = QuotaErrorMessages {
        max_total: "Maximum 5 users allowed".into(),
        max_physician: "Physician's account is taken".into(),
        max_reception: "Maximum 4 reception accounts allowed".into(),
    };
    let (insert, update) = mvp_security::staff_quota_trigger_ddl_with_messages(limits, msgs);
    let escaped = "RAISE(ABORT, 'Physician''s account is taken')";
    assert!(
        insert.contains(escaped),
        "insert DDL must contain escaped apostrophe: {insert}"
    );
    assert!(
        update.contains(escaped),
        "update DDL must contain escaped apostrophe: {update}"
    );
    assert!(
        !insert.contains("RAISE(ABORT, 'Physician's account"),
        "unescaped apostrophe would break SQL: {insert}"
    );
}

#[test]
fn app_layer_and_trigger_ddl_quota_messages_match() {
    let limits = mvp_security::staff_quota_limits();
    let msgs = mvp_security::quota_error_messages(limits);
    let (insert, update) = mvp_security::staff_quota_trigger_ddl(limits);
    for (label, msg) in [
        ("max_total", &msgs.max_total),
        ("max_physician", &msgs.max_physician),
        ("max_reception", &msgs.max_reception),
    ] {
        let literal = mvp_security::sql_raise_message_literal(msg);
        assert!(
            insert.contains(&literal),
            "insert DDL must RAISE with same text as app layer for {label}"
        );
        assert!(
            update.contains(&literal),
            "update DDL must RAISE with same text as app layer for {label}"
        );
    }
}

#[test]
fn require_break_glass_enabled_rejects_when_off() {
    assert!(!mvp_security::BREAK_GLASS_ENABLED);
    let err = mvp_security::require_break_glass_enabled().expect_err("break-glass off");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("Break-glass")));
}

#[test]
fn require_totp_enabled_rejects_when_off() {
    assert!(!mvp_security::TOTP_2FA_ENABLED);
    let err = mvp_security::require_totp_enabled().expect_err("totp off");
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("Two-factor")));
}

#[tokio::test]
async fn enforce_staff_quota_for_create_rejects_sixth_user() {
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

    let hash = crypto::hash_password("TestPass42").unwrap();
    for (id, role) in [
        ("a1", "PHYSICIAN"),
        ("r1", "RECEPTION"),
        ("r2", "RECEPTION"),
        ("r3", "RECEPTION"),
        ("r4", "RECEPTION"),
    ] {
        sqlx::query(
            "INSERT INTO staff (id, name, email, password_hash, role)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .bind(id)
        .bind(format!("User {id}"))
        .bind(format!("{id}@practice.de"))
        .bind(&hash)
        .bind(role)
        .execute(&pool)
        .await
        .unwrap();
    }

    use medoc_core::domain::entities::staff::CreateStaff;
    use medoc_core::domain::enums::Role;

    let data = CreateStaff {
        name: "Sixth".into(),
        email: "sixth@practice.de".into(),
        password: "SecurePass42".into(),
        role: Role::Reception,
        activity_area: None,
        specialty: None,
        phone: None,
    };
    let err = staff_repo::create_with_quota(&pool, &data, &hash)
        .await
        .expect_err("sixth user via atomic path");
    assert!(matches!(err, AppError::Validation(_)));
}
