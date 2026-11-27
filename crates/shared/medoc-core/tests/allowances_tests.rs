//! Group sharing rules (T5.1) and owner-only rows (T4.2): the allowances test matrix.

use medoc_core::application::allowances::{
    self, is_owner_signed, require_change, set_my_rule, set_record_rule, RuleChange, ScopeFilter,
};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ChangeRule, RecordRule, ShareArea, Sight, ViewRule, Viewer};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;

async fn pool() -> sqlx::SqlitePool {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join("medoc-allowances-test-audit");
    let _ = std::fs::create_dir_all(&dir);
    audit_repo::init_audit_hmac_key(&dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    pool
}

fn session(id: &str) -> Session {
    Session {
        user_id: id.into(),
        name: id.into(),
        email: format!("{id}@example.test"),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

fn viewer(id: &str, admin: bool, reception: bool) -> Viewer {
    Viewer {
        staff_id: id.into(),
        is_admin: admin,
        is_reception: reception,
    }
}

#[tokio::test]
async fn by_default_everything_is_shared() {
    let pool = pool().await;
    let f = ScopeFilter::load(
        &pool,
        viewer("desk", false, true),
        ShareArea::Clinical,
        "treatment",
    )
    .await
    .unwrap();
    assert_eq!(f.sight_of("t1", Some("dr-a")), Sight::Full);
    assert_eq!(
        f.sql("t.id", "t.responsible_staff_id"),
        ("1 = 1".into(), vec![])
    );
}

#[tokio::test]
async fn an_owner_narrows_their_area_and_one_record() {
    let pool = pool().await;
    set_my_rule(
        &pool,
        &session("dr-a"),
        &RuleChange::View {
            area: ShareArea::Clinical,
            rule: ViewRule::OtherAdmin,
        },
    )
    .await
    .unwrap();
    set_my_rule(
        &pool,
        &session("dr-a"),
        &RuleChange::View {
            area: ShareArea::Calendar,
            rule: ViewRule::Nobody,
        },
    )
    .await
    .unwrap();
    set_record_rule(
        &pool,
        &session("dr-b"),
        "treatment",
        "t-b",
        "dr-b",
        Some(&RecordRule::Private),
    )
    .await
    .unwrap();

    let desk = ScopeFilter::load(
        &pool,
        viewer("desk", false, true),
        ShareArea::Clinical,
        "treatment",
    )
    .await
    .unwrap();
    assert_eq!(desk.sight_of("t-a", Some("dr-a")), Sight::Hidden);
    assert_eq!(
        desk.sight_of("t-b", Some("dr-b")),
        Sight::Hidden,
        "private record"
    );
    assert_eq!(desk.sight_of("t-c", Some("dr-b")), Sight::Full);
    let (sql, binds) = desk.sql("t.id", "t.responsible_staff_id");
    assert_eq!(
        sql,
        "(t.responsible_staff_id IS NULL OR t.responsible_staff_id NOT IN (?)) AND t.id NOT IN (?)"
    );
    assert_eq!(binds, ["dr-a", "t-b"]);

    let dr_b = ScopeFilter::load(
        &pool,
        viewer("dr-b", true, false),
        ShareArea::Clinical,
        "treatment",
    )
    .await
    .unwrap();
    assert_eq!(
        dr_b.sight_of("t-a", Some("dr-a")),
        Sight::Full,
        "the other admin sees it"
    );
    assert_eq!(
        dr_b.sight_of("t-b", Some("dr-b")),
        Sight::Full,
        "owner sees own private record"
    );

    let cal = ScopeFilter::load(
        &pool,
        viewer("dr-b", true, false),
        ShareArea::Calendar,
        "appointment",
    )
    .await
    .unwrap();
    assert_eq!(cal.sight_of("ap1", Some("dr-a")), Sight::Hidden);
}

#[tokio::test]
async fn records_belong_to_their_owner() {
    let pool = pool().await;
    let err = set_record_rule(
        &pool,
        &session("dr-b"),
        "treatment",
        "t-a",
        "dr-a",
        Some(&RecordRule::Private),
    )
    .await;
    assert!(err.is_err(), "only the owner hides a record");
}

#[tokio::test]
async fn change_rules_protect_clinical_entries_until_the_owner_allows() {
    let pool = pool().await;
    let dr_b = viewer("dr-b", true, false);
    assert!(
        require_change(&pool, &dr_b, ShareArea::Clinical, Some("dr-a"))
            .await
            .is_err()
    );
    set_my_rule(
        &pool,
        &session("dr-a"),
        &RuleChange::Change {
            area: ShareArea::Clinical,
            rule: ChangeRule::MeAndOtherAdmin,
        },
    )
    .await
    .unwrap();
    assert!(
        require_change(&pool, &dr_b, ShareArea::Clinical, Some("dr-a"))
            .await
            .is_ok()
    );
    let desk = viewer("desk", false, true);
    assert!(
        require_change(&pool, &desk, ShareArea::Calendar, Some("dr-a"))
            .await
            .is_ok()
    );
    assert!(
        require_change(&pool, &desk, ShareArea::Payments, Some("dr-a"))
            .await
            .is_err()
    );
    let rules = allowances::rules_of(&pool, "dr-a").await.unwrap();
    assert_eq!(
        rules.change[&ShareArea::Clinical],
        ChangeRule::MeAndOtherAdmin
    );
}

#[test]
fn owner_only_rows_need_the_owner_as_writer() {
    let row = |owner: &str, by: &str| {
        serde_json::json!({ "owner_staff_id": owner, "updated_by_staff_id": by })
            .as_object()
            .unwrap()
            .clone()
    };
    assert!(is_owner_signed(
        "allowance_rule",
        "dr-a|clinical|view",
        &row("dr-a", "dr-a")
    ));
    assert!(!is_owner_signed(
        "allowance_rule",
        "dr-a|clinical|view",
        &row("dr-a", "dr-b")
    ));
    assert!(
        !is_owner_signed("allowance_rule", "dr-a|clinical|view", &row("dr-b", "dr-b")),
        "filed under someone else's id"
    );
    assert!(is_owner_signed(
        "record_visibility",
        "treatment|t1",
        &row("dr-b", "dr-b")
    ));
    assert!(
        is_owner_signed("patient", "p1", &row("", "")),
        "other tables are not owner-only"
    );
}
