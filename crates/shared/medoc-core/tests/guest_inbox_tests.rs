//! Solo guest account and inbox (docs/architecture/editions-plan.md §4.2): the guest reads what
//! its profile allows, never writes, proposes instead; the admin turns it on and off.
#![cfg(feature = "cap-guest-inbox")]

use medoc_core::application::auth_service::{authenticate, LoginRequest, Session};
use medoc_core::application::guest::{self, SetGuestAccount, GUEST_EMAIL};
use medoc_core::application::rbac::{effective_allowed, proposal_allowed, Role};
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;
use medoc_core::infrastructure::database::repos::admin::staged_change as staged;

async fn pool() -> sqlx::SqlitePool {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join("medoc-guest-inbox-test-audit");
    let _ = std::fs::create_dir_all(&dir);
    audit_repo::init_audit_hmac_key(&dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    // A Solo practice has the admin only (onboarding replaces the default seed account).
    sqlx::query("DELETE FROM staff")
        .execute(&pool)
        .await
        .expect("clear seed staff");
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, available)
         VALUES ('own-1', 'Owner', 'owner@practice.test', ?1, 'PHYSICIAN', 1)",
    )
    .bind(hash)
    .execute(&pool)
    .await
    .expect("owner");
    pool
}

fn owner() -> Session {
    Session {
        user_id: "own-1".into(),
        name: "Owner".into(),
        email: "owner@practice.test".into(),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

async fn guest_login(pool: &sqlx::SqlitePool) -> Session {
    authenticate(
        pool,
        &LoginRequest {
            email: GUEST_EMAIL.into(),
            password: "GuestPass2026!x".into(),
            totp_code: None,
        },
    )
    .await
    .expect("guest login")
}

fn set(enabled: bool, clinical_read: bool, password: Option<&str>) -> SetGuestAccount {
    SetGuestAccount {
        enabled,
        password: password.map(str::to_string),
        clinical_read,
        documents_read: false,
    }
}

#[tokio::test]
async fn guest_reads_but_only_proposes_writes() {
    let pool = pool().await;
    assert!(
        guest::set_account(&pool, &owner(), &set(true, false, None))
            .await
            .is_err(),
        "a new guest needs a password"
    );
    let account = guest::set_account(&pool, &owner(), &set(true, false, Some("GuestPass2026!x")))
        .await
        .expect("create guest");
    assert!(account.exists && account.enabled && !account.clinical_read);

    let s = guest_login(&pool).await;
    let o = &s.permission_overrides;
    assert!(effective_allowed("patients.read", Role::Reception, o));
    assert!(effective_allowed("calendar.read", Role::Reception, o));
    for write in [
        "patients.create",
        "calendar.create",
        "calendar.update",
        "cash.create",
        "patient.write",
        "appointment.write",
        "finance.write",
    ] {
        assert!(
            !effective_allowed(write, Role::Reception, o),
            "{write} must be refused"
        );
    }
    assert!(proposal_allowed("calendar.create", Role::Reception, o));
    assert!(proposal_allowed("cash.create", Role::Reception, o));
    assert!(
        !proposal_allowed("calendar.delete", Role::Reception, o),
        "no deletes, even as proposal"
    );
    assert!(!effective_allowed("medical.read", Role::Reception, o));
    assert!(!effective_allowed("patient.read_documents", Role::Reception, o));
    assert!(!effective_allowed("patient.read_medical", Role::Reception, o));
    // Delivery confirmations are the one direct write; creating orders stays blocked.
    assert!(effective_allowed(
        "purchase_order.receive",
        Role::Reception,
        o
    ));
    assert!(!effective_allowed(
        "purchase_order.write",
        Role::Reception,
        o
    ));

    // The admin is not affected by the guard.
    assert!(effective_allowed("patient.write", Role::Physician, &[]));
}

#[tokio::test]
async fn clinical_read_switch_and_turning_the_guest_off() {
    let pool = pool().await;
    guest::set_account(&pool, &owner(), &set(true, true, Some("GuestPass2026!x")))
        .await
        .expect("create");
    let s = guest_login(&pool).await;
    assert!(effective_allowed(
        "medical.read",
        Role::Reception,
        &s.permission_overrides
    ));
    assert!(
        !effective_allowed(
            "patient.read_documents",
            Role::Reception,
            &s.permission_overrides
        ),
        "clinical switch does not grant documents"
    );
    assert!(guest::login_allowed(&pool, &s.user_id).await.unwrap());

    let off = guest::set_account(&pool, &owner(), &set(false, true, None))
        .await
        .expect("off");
    assert!(!off.enabled);
    assert!(!guest::login_allowed(&pool, &s.user_id).await.unwrap());
    assert!(
        guest::login_allowed(&pool, "own-1").await.unwrap(),
        "the admin always signs in"
    );
}

#[tokio::test]
async fn documents_read_switch() {
    let pool = pool().await;
    let account = guest::set_account(
        &pool,
        &owner(),
        &SetGuestAccount {
            enabled: true,
            password: Some("GuestPass2026!x".into()),
            clinical_read: false,
            documents_read: true,
        },
    )
    .await
    .expect("create");
    assert!(account.documents_read && !account.clinical_read);
    let s = guest_login(&pool).await;
    assert!(effective_allowed(
        "patient.read_documents",
        Role::Reception,
        &s.permission_overrides
    ));
    assert!(!effective_allowed(
        "patient.read_medical",
        Role::Reception,
        &s.permission_overrides
    ));
}

#[tokio::test]
async fn a_proposal_is_decided_once() {
    let pool = pool().await;
    let row = staged::insert(&pool, "create_patient", r#"{"data":{}}"#, "{}", "guest-1")
        .await
        .expect("insert");
    assert_eq!(row.status, staged::STATUS_PENDING);
    assert_eq!(staged::count_pending(&pool).await.unwrap(), 1);
    assert_eq!(
        staged::list(&pool, None, Some("someone-else"))
            .await
            .unwrap()
            .len(),
        0
    );

    staged::decide(
        &pool,
        &row.id,
        staged::STATUS_DISMISSED,
        "own-1",
        Some("duplicate"),
        None,
    )
    .await
    .expect("dismiss");
    assert!(
        staged::decide(&pool, &row.id, staged::STATUS_ADDED, "own-1", None, None)
            .await
            .is_err(),
        "no add after dismiss"
    );
    let after = staged::get(&pool, &row.id).await.unwrap().unwrap();
    assert_eq!(after.status, staged::STATUS_DISMISSED);
    assert_eq!(after.reason.as_deref(), Some("duplicate"));
    assert_eq!(
        after.args_json, r#"{"data":{}}"#,
        "the guest's original stays as it was"
    );
    assert_eq!(staged::count_pending(&pool).await.unwrap(), 0);
}

#[test]
fn solo_counts_accounts_not_devices() {
    // Solo: the admin and the guest. Devices (1) are a separate limit, enforced at pairing.
    let l = medoc_core::mvp_security::staff_quota_limits();
    assert_eq!((l.max_total, l.max_physician, l.max_reception), (2, 1, 1));
}
