//! T5.4 (Cabinet+): a dentist who keeps "Payments for me" to themself drops out of the other
//! dentist's finance list, and that dentist may not filter on them.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_practice::commands::billing::payment_allowances::scope;

fn session(id: &str) -> Session {
    Session {
        user_id: id.into(),
        name: id.into(),
        email: format!("{id}@x"),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

#[tokio::test]
async fn payments_follow_the_owners_sharing_rule() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let dir = std::env::temp_dir().join(format!("medoc-pay-scope-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    let pool = support::fresh_pool().await;
    for id in ["pz-a", "pz-b"] {
        sqlx::query("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let a = session("pz-a");
    assert!(scope(&pool, &a, Some("pz-b")).await.unwrap().hidden_doctors.is_empty(), "shared by default");

    set_my_rule(&pool, &session("pz-b"), &RuleChange::View { area: ShareArea::Payments, rule: ViewRule::Nobody })
        .await
        .unwrap();
    let s = scope(&pool, &a, None).await.unwrap();
    assert_eq!(s.hidden_doctors, ["pz-b"]);
    let err = scope(&pool, &a, Some("pz-b")).await.unwrap_err().to_string();
    assert!(err.contains("error.access.not_allowed_by_owner"), "{err}");
    assert!(scope(&pool, &session("pz-b"), Some("pz-b")).await.unwrap().hidden_doctors.is_empty(), "own payments");
}
