//! Part E: patients, chart, scheduling (F59, F60, F63, F65, F67, F69, F70, F94, F99).

use chrono::NaiveDate;
use medoc_core::domain::entities::appointment::{AppointmentMove, CreateAppointment, UpdateAppointment};
use medoc_core::domain::entities::patient::{CreatePatient, UpdatePatient};
use medoc_core::domain::entities::practice_task::CreatePracticeTask;
use medoc_core::domain::enums::{AppointmentKind, Sex};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::{appointment_repo, patient_repo};
use sqlx::SqlitePool;

const DOC: &str = "seed-physician-001";

async fn pool() -> SqlitePool {
    let p = test_memory_pool().await.unwrap();
    run_migrations(&p).await.unwrap();
    p
}

async fn patient(pool: &SqlitePool, name: &str) -> String {
    patient_repo::create(
        pool,
        &CreatePatient {
            name: name.into(),
            date_of_birth: NaiveDate::from_ymd_opt(1985, 5, 5).unwrap(),
            sex: Sex::Female,
            insurance_number: format!("INS-{name}"),
            phone: Some("0541 123".into()),
            email: Some(format!("{name}@example.org")),
            address: Some("Street 1".into()),
        },
    )
    .await
    .unwrap()
    .id
}

fn appt(patient_id: &str, date: &str, time: &str, duration: Option<i64>) -> CreateAppointment {
    CreateAppointment {
        date: date.into(),
        time: time.into(),
        kind: AppointmentKind::Checkup,
        patient_id: patient_id.into(),
        physician_id: DOC.into(),
        notes: Some("bring x-ray".into()),
        chief_complaint: None,
        duration_minutes: duration,
        status: None,
    }
}

#[tokio::test]
async fn update_patient_can_clear_phone_and_missing_field_is_kept() {
    let pool = pool().await;
    let id = patient(&pool, "clear").await;
    let dto: UpdatePatient = serde_json::from_str(r#"{"phone": null}"#).unwrap();
    let p = patient_repo::update(&pool, &id, &dto).await.unwrap();
    assert_eq!(p.phone, None);
    assert_eq!(p.email.as_deref(), Some("clear@example.org"), "missing email must be kept");
}

#[tokio::test]
async fn update_appointment_can_clear_notes() {
    let pool = pool().await;
    let pid = patient(&pool, "notes").await;
    let a = appointment_repo::create(&pool, &appt(&pid, "2099-03-02", "09:00", None)).await.unwrap();
    let dto: UpdateAppointment = serde_json::from_str(r#"{"notes": ""}"#).unwrap();
    let u = appointment_repo::update(&pool, &a.id, &dto).await.unwrap();
    assert_eq!(u.notes, None);
    let keep: UpdateAppointment = serde_json::from_str(r#"{"time": "10:00"}"#).unwrap();
    let a2 = appointment_repo::create(&pool, &appt(&pid, "2099-03-03", "09:00", None)).await.unwrap();
    let u2 = appointment_repo::update(&pool, &a2.id, &keep).await.unwrap();
    assert_eq!(u2.notes.as_deref(), Some("bring x-ray"));
}

#[tokio::test]
async fn overlapping_appointments_conflict_and_cancelled_does_not_block() {
    let pool = pool().await;
    let pid = patient(&pool, "overlap").await;
    let first = appointment_repo::create(&pool, &appt(&pid, "2099-04-01", "09:00", Some(60))).await.unwrap();
    assert_eq!(first.duration_minutes, 60);
    // 09:30 starts inside 09:00-10:00.
    let err = appointment_repo::create(&pool, &appt(&pid, "2099-04-01", "09:30", Some(30)))
        .await
        .expect_err("overlap");
    assert!(matches!(err, AppError::Conflict(_)));
    // 10:00 starts exactly when the first ends.
    appointment_repo::create(&pool, &appt(&pid, "2099-04-01", "10:00", Some(30))).await.unwrap();
    // Cancel the first; its slot frees up.
    sqlx::query("UPDATE appointment SET status = 'CANCELLED' WHERE id = ?1")
        .bind(&first.id)
        .execute(&pool)
        .await
        .unwrap();
    appointment_repo::create(&pool, &appt(&pid, "2099-04-01", "09:30", Some(30))).await.unwrap();
}

#[tokio::test]
async fn create_sets_initial_status_and_rejects_others() {
    let pool = pool().await;
    let pid = patient(&pool, "status").await;
    let mut c = appt(&pid, "2099-05-01", "09:00", None);
    c.status = Some(serde_json::from_str("\"CONFIRMED\"").unwrap());
    let a = appointment_repo::create(&pool, &c).await.unwrap();
    assert_eq!(a.status, "CONFIRMED");
    let mut bad = appt(&pid, "2099-05-01", "11:00", None);
    bad.status = Some(serde_json::from_str("\"COMPLETED\"").unwrap());
    assert!(appointment_repo::create(&pool, &bad).await.is_err());
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM appointment WHERE date = '2099-05-01'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 1, "a rejected create leaves no row");
}

#[tokio::test]
async fn calendar_range_returns_all_appointments_in_range() {
    let pool = pool().await;
    let pid = patient(&pool, "range").await;
    for day in 1..=28 {
        for t in ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"] {
            appointment_repo::create(&pool, &appt(&pid, &format!("2099-02-{day:02}"), t, Some(30))).await.unwrap();
        }
    }
    let rows = appointment_repo::find_in_range(&pool, "2099-02-01", "2099-02-28").await.unwrap();
    assert_eq!(rows.len(), 28 * 8);
    let one = appointment_repo::find_in_range(&pool, "2099-02-10", "2099-02-10").await.unwrap();
    assert_eq!(one.len(), 8);
    assert!(appointment_repo::find_in_range(&pool, "2099-02-10", "2099-02-01").await.is_err());
}

#[tokio::test]
async fn calendar_range_allows_practice_year_and_rejects_451_days() {
    let pool = pool().await;
    let from = NaiveDate::from_ymd_opt(2099, 1, 1).unwrap();
    let ok = (from + chrono::Days::new(450)).format("%Y-%m-%d").to_string();
    let over = (from + chrono::Days::new(451)).format("%Y-%m-%d").to_string();
    assert!(appointment_repo::find_in_range(&pool, "2099-01-01", &ok).await.is_ok());
    let err = appointment_repo::find_in_range(&pool, "2099-01-01", &over)
        .await
        .unwrap_err();
    assert!(matches!(err, AppError::Validation(msg) if msg.contains("0-450")));
}

#[tokio::test]
async fn move_appointments_is_all_or_nothing() {
    let pool = pool().await;
    let pid = patient(&pool, "move").await;
    let a = appointment_repo::create(&pool, &appt(&pid, "2099-06-01", "09:00", Some(30))).await.unwrap();
    let b = appointment_repo::create(&pool, &appt(&pid, "2099-06-01", "10:00", Some(30))).await.unwrap();
    let _c = appointment_repo::create(&pool, &appt(&pid, "2099-06-02", "09:00", Some(30))).await.unwrap();
    // Swapping a and b is fine (moved rows leave their old slots).
    let moved = appointment_repo::move_many(
        &pool,
        &[
            AppointmentMove { id: a.id.clone(), date: "2099-06-01".into(), time: "10:00".into() },
            AppointmentMove { id: b.id.clone(), date: "2099-06-01".into(), time: "09:00".into() },
        ],
    )
    .await
    .unwrap();
    assert_eq!(moved.len(), 2);
    // a onto c's slot conflicts: nothing moves, b included.
    let err = appointment_repo::move_many(
        &pool,
        &[
            AppointmentMove { id: b.id.clone(), date: "2099-06-03".into(), time: "09:00".into() },
            AppointmentMove { id: a.id.clone(), date: "2099-06-02".into(), time: "09:15".into() },
        ],
    )
    .await
    .expect_err("conflict");
    assert!(matches!(err, AppError::Conflict(_)));
    let b_now: String = sqlx::query_scalar("SELECT date FROM appointment WHERE id = ?1")
        .bind(&b.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(b_now, "2099-06-01");
}

#[tokio::test]
async fn decline_sets_declined_and_can_be_resubmitted() {
    use medoc_core::infrastructure::database::repos::clinical::chart;
    let pool = pool().await;
    let pid = patient(&pool, "decline").await;
    let declined = chart::decline_patient_chart_status(&pool, &pid).await.unwrap();
    assert_eq!(declined.status, "DECLINED");
    let again = chart::mark_chart_for_physician_review(&pool, &pid).await.unwrap();
    assert_eq!(again.status, "IN_PROGRESS");
}

#[tokio::test]
async fn badge_count_equals_list_total() {
    use medoc_core::infrastructure::database::repos::clinical::chart;
    use medoc_core::infrastructure::database::practice_task_repo as tasks;
    let pool = pool().await;
    patient(&pool, "badge-a").await;
    patient(&pool, "badge-b").await;
    // A chart whose patient row is missing (e.g. half-synced) must not be counted.
    {
        let mut conn = pool.acquire().await.unwrap();
        sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *conn).await.unwrap();
        sqlx::query("INSERT INTO patient_chart (id, patient_id, status) VALUES ('orphan-chart', 'no-such-patient', 'DRAFT')")
            .execute(&mut *conn)
            .await
            .unwrap();
        sqlx::query("PRAGMA foreign_keys = ON").execute(&mut *conn).await.unwrap();
    }
    let list = chart::list_charts_to_validate(&pool).await.unwrap();
    let count = chart::count_charts_to_validate(&pool).await.unwrap();
    assert_eq!(count as usize, list.len());

    let rez = "seed-rez-001";
    let total_lists = tasks::list_inbox_reception(&pool, 1000).await.unwrap().len()
        + tasks::list_outgoing_reception(&pool, rez, 1000).await.unwrap().len()
        + tasks::list_pending_validation(&pool, rez, 1000).await.unwrap().len();
    assert_eq!(tasks::count_open_for_reception(&pool, rez).await.unwrap() as usize, total_lists);
}

#[tokio::test]
async fn task_create_fails_when_notification_fails() {
    let pool = pool().await;
    let data = CreatePracticeTask {
        patient_id: None,
        kind: "GENERAL".into(),
        title: "Call lab".into(),
        body: None,
        assignee_role: None,
        assignee_user_id: Some("no-such-staff".into()),
        treatment_id: None,
        examination_id: None,
        service_name: None,
        total_cost: None,
    };
    let before: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM practice_task").fetch_one(&pool).await.unwrap();
    assert!(medoc_core::application::practice_task_notify::create_task_and_notify(&pool, &data, DOC)
        .await
        .is_err());
    let after: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM practice_task").fetch_one(&pool).await.unwrap();
    assert_eq!(before, after, "no task without its notification");

    let ok = CreatePracticeTask { assignee_user_id: None, assignee_role: Some("RECEPTION".into()), ..data };
    let t = medoc_core::application::practice_task_notify::create_task_and_notify(&pool, &ok, DOC)
        .await
        .unwrap();
    let notes: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM in_app_notification WHERE payload_json LIKE '%' || ?1 || '%'")
        .bind(&t.id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(notes >= 1);
}

#[tokio::test]
async fn legacy_notes_duration_is_backfilled() {
    let pool = pool().await;
    let pid = patient(&pool, "backfill").await;
    // Pre-F65 database: no column, duration only in the notes text.
    sqlx::query("ALTER TABLE appointment DROP COLUMN duration_minutes").execute(&pool).await.unwrap();
    for (id, notes) in [("legacy-45", "Duration: 45 min · bring x-ray"), ("legacy-none", "no length")] {
        sqlx::query(
            "INSERT INTO appointment (id, date, time, kind, status, patient_id, physician_id, notes)
             VALUES (?1, '2099-07-01', '09:00', 'CHECKUP', 'PLANNED', ?2, ?3, ?4)",
        )
        .bind(id)
        .bind(&pid)
        .bind(DOC)
        .bind(notes)
        .execute(&pool)
        .await
        .unwrap();
    }
    run_migrations(&pool).await.unwrap();
    let d45: i64 = sqlx::query_scalar("SELECT duration_minutes FROM appointment WHERE id = 'legacy-45'")
        .fetch_one(&pool).await.unwrap();
    let d30: i64 = sqlx::query_scalar("SELECT duration_minutes FROM appointment WHERE id = 'legacy-none'")
        .fetch_one(&pool).await.unwrap();
    assert_eq!((d45, d30), (45, 30));
}
