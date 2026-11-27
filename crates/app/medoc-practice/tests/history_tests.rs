//! T5.8 phase 2: who may read History. Reception never sees the history of clinical tables;
//! Cabinet+: a dentist who keeps "History of my records" to themself drops out of the other's view.

mod support;

use medoc_core::application::allowances::{set_my_rule, RuleChange};
use medoc_core::application::auth_service::Session;
use medoc_core::application::history;
use medoc_core::domain::allowances::{ShareArea, ViewRule};
use medoc_core::infrastructure::database::actor;
use medoc_core::infrastructure::database::sync_outbox::record_or_noop;
use medoc_practice::commands::admin::history::{apply_sharing, may_read};

fn session(id: &str, role: &str) -> Session {
    Session {
        user_id: id.into(),
        name: id.into(),
        email: format!("{id}@x"),
        role: role.into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

#[test]
fn reception_reads_calendar_and_money_history_but_not_clinical() {
    let desk = session("desk", "RECEPTION");
    let dr = session("dr", "PHYSICIAN");
    for t in ["patient", "appointment", "payment", "practice_task"] {
        assert!(may_read(&desk, t), "{t}");
    }
    for t in [
        "examination",
        "treatment",
        "prescription",
        "anamnesis_form",
        "dental_finding",
    ] {
        assert!(!may_read(&desk, t), "{t}");
        assert!(may_read(&dr, t), "{t}");
    }
    assert!(!may_read(&dr, "product"), "untracked table");
}

#[tokio::test]
async fn history_follows_the_owners_sharing_rule() {
    if !medoc_core::edition::CORE_CAPS.allowances {
        return;
    }
    let dir = std::env::temp_dir().join(format!("medoc-history-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir).unwrap();
    let pool = support::fresh_pool().await;
    for id in ["hz-a", "hz-b"] {
        sqlx::query("INSERT INTO staff (id, name, email, password_hash, role, available) VALUES (?1, ?1, ?1 || '@x', 'x', 'PHYSICIAN', 1)")
            .bind(id)
            .execute(&pool)
            .await
            .unwrap();
    }
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, created_at, updated_at)
         VALUES ('hp', 'Nadia', '1990-01-01', 'FEMALE', 'V-hp', 'ACTIVE', 'now', 'now')",
    )
    .execute(&pool)
    .await
    .unwrap();
    for (id, doctor) in [("ap-a", "hz-a"), ("ap-b", "hz-b")] {
        sqlx::query(
            "INSERT INTO appointment (id, patient_id, physician_id, date, time, kind, status, created_at, updated_at)
             VALUES (?1, 'hp', ?2, '2026-12-01', '10:00', 'CHECKUP', 'PLANNED', 'now', 'now')",
        )
        .bind(id)
        .bind(doctor)
        .execute(&pool)
        .await
        .unwrap();
        actor::with_actor(doctor, async {
            record_or_noop(&pool, "appointment", id, "INSERT", "")
                .await
                .unwrap();
        })
        .await;
    }
    let a = session("hz-a", "PHYSICIAN");
    let all = history::for_patient(&pool, "hp", &["appointment"])
        .await
        .unwrap();
    assert_eq!(
        apply_sharing(&pool, &a, all.clone())
            .await
            .unwrap()
            .items
            .len(),
        2
    );

    set_my_rule(
        &pool,
        &session("hz-b", "PHYSICIAN"),
        &RuleChange::View {
            area: ShareArea::History,
            rule: ViewRule::Nobody,
        },
    )
    .await
    .unwrap();
    let seen = apply_sharing(&pool, &a, all).await.unwrap();
    assert_eq!(
        seen.items
            .iter()
            .map(|e| e.entity_id.as_str())
            .collect::<Vec<_>>(),
        ["ap-a"]
    );
    assert_eq!(seen.hidden_doctors, ["hz-b"]);
}
