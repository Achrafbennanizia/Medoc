//! Access profiles end to end: assignment rules and enforcement through
//! `authorize()` (desktop + LAN) and the login session.

use std::collections::BTreeMap;

use medoc_core::application::access_control::{self, SetStaffAccess};
use medoc_core::application::auth_service::{authenticate, LoginRequest, Session};
use medoc_core::application::authorize::{authorize, Caller};
use medoc_core::application::first_run;
use medoc_core::application::rbac::{effective_allowed, Role};
use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;
use medoc_core::infrastructure::database::repos::admin::staff_permission;

async fn pool() -> sqlx::SqlitePool {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join("medoc-access-control-test-audit");
    let _ = std::fs::create_dir_all(&dir);
    audit_repo::init_audit_hmac_key(&dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    insert_staff(&pool, "own-1", "PHYSICIAN").await;
    insert_staff(&pool, "doc-2", "PHYSICIAN").await;
    insert_staff(&pool, "rec-1", "RECEPTION").await;
    insert_staff(&pool, "rec-2", "RECEPTION").await;
    pool
}

async fn insert_staff(pool: &sqlx::SqlitePool, id: &str, role: &str) {
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, available)
         VALUES (?1, ?1, ?2, ?3, ?4, 1)",
    )
    .bind(id)
    .bind(format!("{id}@practice.test"))
    .bind(hash)
    .bind(role)
    .execute(pool)
    .await
    .expect("staff");
}

fn session(id: &str, role: &str) -> Session {
    Session {
        user_id: id.into(),
        name: id.into(),
        email: format!("{id}@practice.test"),
        role: role.into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

fn req(template: &str, grants: &[(&str, &str)]) -> SetStaffAccess {
    SetStaffAccess {
        template: Some(template.into()),
        grants: grants
            .iter()
            .map(|(a, l)| (a.to_string(), l.to_string()))
            .collect::<BTreeMap<_, _>>(),
    }
}

async fn can(pool: &sqlx::SqlitePool, id: &str, action: &str) -> bool {
    let caller = Caller {
        user_id: id.into(),
        idle_for: None,
        device_session_id: None,
    };
    match authorize(pool, &caller, action, None).await {
        Ok(_) => true,
        Err(AppError::Forbidden) => false,
        Err(e) => panic!("{action}: unexpected {e:?}"),
    }
}

#[tokio::test]
async fn calendar_full_cash_edit_patient_half_is_enforced() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.calendar_cash", &[]))
        .await
        .expect("assign");

    // Calendar: full.
    assert!(can(&pool, "rec-1", "calendar.delete").await);
    assert!(can(&pool, "rec-1", "appointment.write").await);
    // Cash desk: read and update only.
    assert!(can(&pool, "rec-1", "cash.read").await);
    assert!(can(&pool, "rec-1", "cash.update").await);
    assert!(!can(&pool, "rec-1", "cash.create").await);
    assert!(!can(&pool, "rec-1", "cash.day_close").await);
    // Patients: half access (read + update, no create/delete, no clinical data).
    assert!(can(&pool, "rec-1", "patients.update").await);
    assert!(!can(&pool, "rec-1", "patients.create").await);
    assert!(!can(&pool, "rec-1", "patients.delete").await);
    assert!(!can(&pool, "rec-1", "patient.read_medical").await);
    // Nothing outside the profile, legacy names included.
    assert!(!can(&pool, "rec-1", "finance.read").await);
    assert!(!can(&pool, "rec-1", "billing.read").await);
    assert!(!can(&pool, "rec-1", "ops.system").await);
}

#[tokio::test]
async fn one_area_can_be_raised_on_top_of_a_template() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(
        &pool,
        &owner,
        "rec-1",
        &req("reception.scheduler", &[("cash_desk", "full")]),
    )
    .await
    .expect("assign");
    assert!(can(&pool, "rec-1", "cash.day_close").await);
    assert!(can(&pool, "rec-1", "calendar.create").await);
    assert!(!can(&pool, "rec-1", "billing.create").await);

    let dto = access_control::get_staff_access(&pool, &owner, "rec-1")
        .await
        .expect("dto");
    let cash = dto.areas.iter().find(|a| a.area == "cash_desk").unwrap();
    assert_eq!(cash.level, "full");
    assert!(cash.customised);
}

#[tokio::test]
async fn reception_cannot_receive_clinical_write_or_a_physician_profile() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    let err = access_control::set_staff_access(
        &pool,
        &owner,
        "rec-1",
        &req("reception.front_desk", &[("medical_record", "edit")]),
    )
    .await
    .expect_err("ceiling");
    assert!(matches!(err, AppError::Validation(_)));

    let err =
        access_control::set_staff_access(&pool, &owner, "rec-1", &req("physician.owner", &[]))
            .await
            .expect_err("wrong role");
    assert!(matches!(err, AppError::Validation(_)));

    let err = staff_permission::upsert(&pool, "rec-1", "staff.write", "ALLOW")
        .await
        .expect_err("override above ceiling");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn only_access_managers_change_rights_and_never_their_own() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(
        &pool,
        &owner,
        "rec-1",
        &req("reception.office_manager", &[]),
    )
    .await
    .expect("assign");

    let manager = session("rec-1", "RECEPTION");
    let err =
        access_control::set_staff_access(&pool, &manager, "rec-2", &req("reception.cashier", &[]))
            .await
            .expect_err("office manager is not an access admin");
    assert!(matches!(err, AppError::Forbidden));

    let err =
        access_control::set_staff_access(&pool, &owner, "own-1", &req("physician.associate", &[]))
            .await
            .expect_err("self");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn an_admin_cannot_grant_more_than_they_hold() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(
        &pool,
        &owner,
        "doc-2",
        &req("physician.owner", &[("finance_reports", "view")]),
    )
    .await
    .expect("limited admin");
    let limited = session("doc-2", "PHYSICIAN");
    let err = access_control::set_staff_access(
        &pool,
        &limited,
        "rec-2",
        &req("reception.billing", &[("finance_reports", "full")]),
    )
    .await
    .expect_err("escalation by proxy");
    assert!(matches!(err, AppError::Validation(_)));
    access_control::set_staff_access(&pool, &limited, "rec-2", &req("reception.billing", &[]))
        .await
        .expect("within own rights");
}

#[tokio::test]
async fn the_login_session_carries_the_profile_and_old_tokens_end() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    let before: i64 = sqlx::query_scalar("SELECT token_version FROM staff WHERE id = 'rec-1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.read_only", &[]))
        .await
        .expect("assign");
    let after: i64 = sqlx::query_scalar("SELECT token_version FROM staff WHERE id = 'rec-1'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(after > before, "LAN tokens must be invalidated");

    let s = authenticate(
        &pool,
        &LoginRequest {
            email: "rec-1@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect("login");
    let ov = &s.permission_overrides;
    assert!(effective_allowed("cash.read", Role::Reception, ov));
    assert!(!effective_allowed("cash.create", Role::Reception, ov));
    assert!(!effective_allowed("finance.write", Role::Reception, ov));

    let audited: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE action = 'ACCESS_PROFILE_SET' AND entity_id = 'rec-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audited, 1);
}

#[tokio::test]
async fn reset_returns_to_the_role_matrix() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.read_only", &[]))
        .await
        .expect("assign");
    let dto = access_control::reset_staff_access(&pool, &owner, "rec-1")
        .await
        .expect("reset");
    assert!(dto.uses_role_default);
    assert_eq!(
        can(&pool, "rec-1", "finance.write").await,
        medoc_core::application::rbac::allowed("finance.write", Role::Reception)
    );
}

#[tokio::test]
async fn a_replica_refuses_access_changes() {
    let pool = pool().await;
    medoc_core::infrastructure::database::repos::admin::app_kv::set(
        &pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"R"}"#,
    )
    .await
    .unwrap();
    let owner = session("own-1", "PHYSICIAN");
    let err =
        access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.cashier", &[]))
            .await
            .expect_err("replica");
    assert!(matches!(err, AppError::Validation(_)));
}

#[tokio::test]
async fn my_access_lists_what_the_ui_may_show() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.cashier", &[]))
        .await
        .expect("assign");
    let me = access_control::my_access(&pool, "rec-1").await.expect("me");
    assert_eq!(me.template.as_deref(), Some("reception.cashier"));
    assert_eq!(me.areas.get("cash_desk"), Some(&"full"));
    assert!(me.allowed_actions.iter().any(|a| a == "cash.day_close"));
    assert!(!me.allowed_actions.iter().any(|a| a == "calendar.create"));
    assert!(me.allowed_actions.iter().any(|a| a == "dashboard.read"));
}

#[tokio::test]
async fn a_hand_set_deny_beats_the_profile_and_reaches_the_replicated_row() {
    let pool = pool().await;
    let owner = session("own-1", "PHYSICIAN");
    access_control::set_staff_access(&pool, &owner, "rec-1", &req("reception.cashier", &[]))
        .await
        .expect("assign");
    assert!(can(&pool, "rec-1", "cash.delete").await);
    staff_permission::upsert(&pool, "rec-1", "cash.delete", "DENY")
        .await
        .expect("deny");
    assert!(!can(&pool, "rec-1", "cash.delete").await);
    assert!(can(&pool, "rec-1", "cash.create").await);
    let mirrored: String = sqlx::query_scalar(
        "SELECT action_overrides_json FROM staff_access_profile WHERE id = 'rec-1'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert!(mirrored.contains("cash.delete") && mirrored.contains("DENY"));
    staff_permission::delete_override(&pool, "rec-1", "cash.delete")
        .await
        .expect("remove");
    assert!(can(&pool, "rec-1", "cash.delete").await);
}

#[tokio::test]
async fn the_first_owner_can_be_created_only_once() {
    let pool = pool().await;
    // Seed rows may reference staff; this test only needs an empty staff table.
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("DELETE FROM staff")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .unwrap();
    assert!(first_run::needs_first_run_setup(&pool).await.unwrap());
    let input = first_run::FirstOwner {
        name: "Dr. Owner".into(),
        email: "owner@practice.test".into(),
        password: "correct horse battery".into(),
        specialty: None,
    };
    let owner = first_run::create_first_owner(&pool, &input)
        .await
        .expect("owner");
    assert!(can(&pool, &owner.id, "access.manage").await);
    let again = first_run::create_first_owner(&pool, &input)
        .await
        .expect_err("second");
    assert!(matches!(again, AppError::Conflict(_)));
    let short = first_run::FirstOwner {
        password: "short".into(),
        ..input
    };
    assert!(first_run::create_first_owner(&pool, &short).await.is_err());
}
