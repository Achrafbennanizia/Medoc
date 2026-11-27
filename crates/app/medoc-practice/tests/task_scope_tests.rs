//! T5.4 (Cabinet+): a dentist who keeps "My tasks" to themself drops out of the other
//! dentist's admin list, and that dentist may not filter on them.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_core::infrastructure::database::repos::scheduling::practice_task::list_all_admin;
use medoc_practice::commands::scheduling::task_allowances::scope;

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
async fn tasks_follow_the_owners_sharing_rule() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let dir = std::env::temp_dir().join(format!("medoc-task-scope-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    let pool = support::fresh_pool().await;
    for id in ["tz-a", "tz-b"] {
        sqlx::query("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    let a = session("tz-a");
    assert!(
        scope(&pool, &a, Some("tz-b"))
            .await
            .unwrap()
            .hidden_doctors
            .is_empty(),
        "shared by default"
    );

    set_my_rule(
        &pool,
        &session("tz-b"),
        &RuleChange::View {
            area: ShareArea::Tasks,
            rule: ViewRule::Nobody,
        },
    )
    .await
    .unwrap();
    let s = scope(&pool, &a, None).await.unwrap();
    assert_eq!(s.hidden_doctors, ["tz-b"]);
    let err = scope(&pool, &a, Some("tz-b"))
        .await
        .unwrap_err()
        .to_string();
    assert!(err.contains("error.access.not_allowed_by_owner"), "{err}");
    assert!(
        scope(&pool, &session("tz-b"), Some("tz-b"))
            .await
            .unwrap()
            .hidden_doctors
            .is_empty(),
        "own tasks"
    );

    // Tasks: t1 (tz-a, oldest), t2 (tz-b), t3 (no doctor), t4 (tz-b, newest).
    for (id, doctor, at) in [
        ("t1", Some("tz-a"), "2026-01-01T00:00:00Z"),
        ("t2", Some("tz-b"), "2026-01-02T00:00:00Z"),
        ("t3", None, "2026-01-03T00:00:00Z"),
        ("t4", Some("tz-b"), "2026-01-04T00:00:00Z"),
    ] {
        sqlx::query("INSERT INTO practice_task (id, title, created_by, doctor_id, updated_at) VALUES (?1, ?1, 'tz-a', ?2, ?3)")
            .bind(id)
            .bind(doctor)
            .bind(at)
            .execute(&pool)
            .await
            .unwrap();
    }
    let ids = |v: Vec<medoc_core::domain::entities::practice_task::PracticeTask>| {
        // The test database also holds seeded sample tasks (`seed-…`); look at ours only.
        v.into_iter()
            .map(|t| t.id)
            .filter(|id| ["t1", "t2", "t3", "t4"].contains(&id.as_str()))
            .collect::<Vec<_>>()
    };
    let none: Vec<String> = vec![];
    assert_eq!(
        ids(
            list_all_admin(&pool, 100_000, None, &s.hidden_doctors, &s.hidden_ids)
                .await
                .unwrap()
        ),
        ["t3", "t1"],
        "tz-b's tasks are left out; a task without a doctor stays"
    );
    assert_eq!(
        ids(list_all_admin(&pool, 100_000, Some("tz-a"), &none, &none)
            .await
            .unwrap()),
        ["t1"],
        "doctor filter"
    );
    // Regression: the filter runs before the limit, so tz-a's oldest task is not cut off by
    // newer tasks of other doctors.
    assert_eq!(
        ids(list_all_admin(&pool, 1, Some("tz-a"), &none, &none)
            .await
            .unwrap()),
        ["t1"]
    );
    assert_eq!(
        ids(
            list_all_admin(&pool, 100_000, None, &none, &["t3".to_string()])
                .await
                .unwrap()
        ),
        ["t4", "t2", "t1"],
        "a single hidden task"
    );
}
