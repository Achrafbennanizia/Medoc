//! T5.5 (Group): the validation queue follows the owners' sharing rules. A chart belongs to its
//! responsible doctor, else the patient's treating doctor. By default (Q-E) only the owner validates
//! it; a doctor who does not share clinical data drops out of the other doctor's queue.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_practice::commands::clinical::clinical_allowances::{require_validate, route_validation_queue};
use medoc_practice::infrastructure::database::repos::clinical::chart as chart_repo;

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
async fn queue_is_routed_to_the_owner() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let pool = support::fresh_pool().await;
    let dir = std::env::temp_dir().join(format!("medoc-validation-routing-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    for id in ["dr-a", "dr-b"] {
        sqlx::query(
            "INSERT INTO staff (id, name, email, password_hash, role, available)
             VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)",
        )
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    }
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at, treating_staff_id)
         VALUES ('p1', 'Salma', '1990-01-01', 'FEMALE', 'V-1', 'ACTIVE', 'now', 'now', 'dr-a')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES ('c1', 'p1', 'IN_PROGRESS')")
        .execute(&pool)
        .await
        .unwrap();
    let (a, b) = (session("dr-a"), session("dr-b"));

    let rows = |s: Session| {
        let pool = pool.clone();
        async move {
            let all = chart_repo::list_charts_to_validate(&pool).await.unwrap();
            // The test pool carries demo data: look at our chart only.
            let all = all.into_iter().filter(|r| r.chart_id == "c1").collect();
            route_validation_queue(&pool, &s, all).await.unwrap()
        }
    };
    let mine = rows(a.clone()).await;
    assert_eq!(mine.len(), 1);
    assert_eq!(mine[0].owner_staff_id.as_deref(), Some("dr-a"));
    assert!(mine[0].can_validate);
    let theirs = rows(b.clone()).await;
    assert_eq!(theirs.len(), 1, "shared by default");
    assert!(!theirs[0].can_validate, "only the owner validates by default");
    assert!(require_validate(&pool, &a, "p1").await.is_ok());
    let err = require_validate(&pool, &b, "p1").await.unwrap_err().to_string();
    assert!(err.contains("error.access.not_allowed_by_owner"), "{err}");

    // Dr A stops sharing clinical data: the chart leaves Dr B's queue.
    set_my_rule(&pool, &a, &RuleChange::View { area: ShareArea::Clinical, rule: ViewRule::Nobody })
        .await
        .unwrap();
    assert!(rows(b).await.is_empty());
}
