//! T5.6 (Group): statistics per doctor. A doctor filter narrows appointments, treatments and
//! income; the comparison lists each doctor you may see; a doctor who does not share statistics
//! drops out of both and is named in `hidden_doctors`.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_practice::commands::practice::statistics::statistics_overview;

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

async fn exec(pool: &sqlx::SqlitePool, sql: &str) {
    sqlx::query(sql).execute(pool).await.unwrap_or_else(|e| panic!("{sql}: {e}"));
}

#[tokio::test]
async fn figures_follow_the_doctor_filter_and_sharing() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let dir = std::env::temp_dir().join(format!("medoc-stats-doctor-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    let pool = support::fresh_pool().await;
    // Demo data is seeded into the test pool: count only what these rows add.
    for id in ["zz-a", "zz-b"] {
        exec(&pool, &format!("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES ('{id}', '{id}', '{id}@x', 'x', 'PHYSICIAN', 1)")).await;
    }
    exec(&pool, "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at) VALUES ('zp', 'P', '1990-01-01', 'FEMALE', 'V-9', 'ACTIVE', 'now', 'now')").await;
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    for (id, doc) in [("za1", "zz-a"), ("za2", "zz-a"), ("zb1", "zz-b")] {
        exec(&pool, &format!("INSERT INTO appointment (id, patient_id, physician_id, date, time, kind, status, created_at, updated_at) VALUES ('{id}', 'zp', '{doc}', '{today}', '10:00', 'CHECKUP', 'PLANNED', 'now', 'now')")).await;
    }
    exec(&pool, "INSERT INTO payment (id, patient_id, amount, payment_method, status, created_at, for_staff_id) VALUES ('zpay', 'zp', 300, 'CASH', 'PAID', strftime('%Y-%m-%d %H:%M:%S','now'), 'zz-b')").await;

    let a = session("zz-a");
    let all = statistics_overview(&pool, &a, None).await.unwrap();
    let row = |id: &str| all.per_doctor.iter().find(|d| d.staff_id == id).cloned();
    assert_eq!(row("zz-a").unwrap().appointments, 2);
    assert_eq!(row("zz-b").unwrap().appointments, 1);
    assert_eq!(row("zz-b").unwrap().income, Some(300.0));

    let total = |o: &medoc_practice::commands::practice::statistics::StatisticsOverview| {
        o.appointments_per_month.iter().map(|m| m.value).sum::<f64>()
    };
    let only_b = statistics_overview(&pool, &a, Some("zz-b".into())).await.unwrap();
    assert_eq!(total(&only_b), 1.0);
    assert!(only_b.per_doctor.is_empty(), "no comparison inside a doctor filter");

    // Dr B stops sharing statistics: Dr A no longer sees B's figures or may filter on B.
    set_my_rule(&pool, &session("zz-b"), &RuleChange::View { area: ShareArea::Statistics, rule: ViewRule::Nobody })
        .await
        .unwrap();
    let after = statistics_overview(&pool, &a, None).await.unwrap();
    assert!(after.hidden_doctors.contains(&"zz-b".to_string()));
    assert!(after.per_doctor.iter().all(|d| d.staff_id != "zz-b"));
    assert_eq!(total(&after), total(&all) - 1.0);
    let err = statistics_overview(&pool, &a, Some("zz-b".into())).await.unwrap_err().to_string();
    assert!(err.contains("error.access.not_allowed_by_owner"), "{err}");
    // Dr B still sees their own figures.
    let own = statistics_overview(&pool, &session("zz-b"), Some("zz-b".into())).await.unwrap();
    assert_eq!(total(&own), 1.0);
}
