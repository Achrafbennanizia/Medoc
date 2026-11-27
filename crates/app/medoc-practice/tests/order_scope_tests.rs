//! T5.4 (Cabinet+): a dentist who keeps "Orders" to themself drops out of the other dentist's list.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_practice::commands::practice::order_allowances::{apply, scope, OrderScope};

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
async fn orders_follow_the_owners_sharing_rule() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let dir = std::env::temp_dir().join(format!("medoc-order-scope-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    let pool = support::fresh_pool().await;
    for id in ["oz-a", "oz-b"] {
        sqlx::query("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let a = session("oz-a");
    assert!(scope(&pool, &a, Some("oz-b"))
        .await
        .unwrap()
        .hidden_doctors
        .is_empty());

    set_my_rule(
        &pool,
        &session("oz-b"),
        &RuleChange::View {
            area: ShareArea::Orders,
            rule: ViewRule::Nobody,
        },
    )
    .await
    .unwrap();
    let s = scope(&pool, &a, None).await.unwrap();
    assert_eq!(s.hidden_doctors, ["oz-b"]);
    let err = scope(&pool, &a, Some("oz-b"))
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("error.access.not_allowed_by_owner"), "{err}");
}

fn order(
    id: &str,
    for_doctor: Option<&str>,
) -> medoc_core::domain::entities::purchase_order::PurchaseOrder {
    let t = chrono::NaiveDateTime::default();
    medoc_core::domain::entities::purchase_order::PurchaseOrder {
        id: id.into(),
        order_number: None,
        supplier: "S".into(),
        pharma_consultant: None,
        item: "gloves".into(),
        status: "OPEN".into(),
        expected_on: None,
        delivered_on: None,
        quantity: 1,
        unit: None,
        remark: None,
        total_amount: None,
        created_by: "x".into(),
        ordered_for_staff_id: for_doctor.map(str::to_string),
        paid_by_staff_id: None,
        approved_by: None,
        created_at: t,
        updated_at: t,
    }
}

#[test]
fn order_list_narrows_to_one_doctor_and_drops_hidden_ones() {
    let apply_doctor_scope = |items, doctor, hidden_doctors: &[String], hidden_ids: &[String]| {
        let scope = OrderScope {
            hidden_doctors: hidden_doctors.to_vec(),
            hidden_ids: hidden_ids.to_vec(),
        };
        apply(&scope, doctor, items)
    };
    let ids = |v: Vec<medoc_core::domain::entities::purchase_order::PurchaseOrder>| {
        v.into_iter().map(|o| o.id).collect::<Vec<_>>()
    };
    let all = || {
        vec![
            order("o1", Some("dr-a")),
            order("o2", Some("dr-b")),
            order("o3", None),
            order("o4", Some("")),
        ]
    };
    assert_eq!(
        ids(apply_doctor_scope(all(), None, &[], &[])),
        ["o1", "o2", "o3", "o4"]
    );
    assert_eq!(
        ids(apply_doctor_scope(all(), Some("dr-a"), &[], &[])),
        ["o1"]
    );
    assert_eq!(
        ids(apply_doctor_scope(all(), None, &["dr-b".into()], &[])),
        ["o1", "o3", "o4"],
        "no-doctor orders stay"
    );
    assert_eq!(
        ids(apply_doctor_scope(all(), None, &[], &["o3".into()])),
        ["o1", "o2", "o4"]
    );
}
