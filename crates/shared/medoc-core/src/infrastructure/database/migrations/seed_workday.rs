//! Shape **today** into a packed weekday book for screenshots / demo.
//!
//! Runs with `MEDOC_DEV_SEED=1`. Re-applies when the local calendar date changes
//! so “today” stays a full work day after midnight.

use chrono::{Local, Timelike};
use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

const WORKDAY_KV: &str = "migration.demo_workday.v1";
const PHYSICIAN_ID: &str = "seed-physician-001";

/// Non-overlapping chair times (5 min buffer; lunch 12:00–13:00).
const SLOTS: &[(&str, &str, u32, &str)] = &[
    (
        "08:00",
        "FIRST_VISIT",
        45,
        "New patient intake · full anamnesis",
    ),
    (
        "08:50",
        "EXAMINATION",
        30,
        "Periodontal status · hygiene instruction",
    ),
    ("09:25", "TREATMENT", 45, "Composite filling 16 occlusal"),
    ("10:15", "CHECKUP", 20, "Post-op review after extraction"),
    ("10:40", "CONSULTATION", 30, "Crown vs implant consult"),
    ("11:15", "TREATMENT", 40, "Endodontic follow-up 36"),
    ("13:00", "EXAMINATION", 30, "Recall + bitewing radiographs"),
    ("13:35", "TREATMENT", 50, "Crown prep 24 + temporary"),
    ("14:30", "CHECKUP", 20, "Whitening shade check"),
    (
        "14:55",
        "FIRST_VISIT",
        45,
        "Emergency walk-in · cracked cusp",
    ),
    ("15:45", "TREATMENT", 40, "Replacement filling 46"),
    (
        "16:30",
        "CONSULTATION",
        25,
        "Aligner progress / next aligners",
    ),
];

const COMPLAINTS: &[&str] = &[
    "Hot/cold sensitivity",
    "Gingival bleeding",
    "Chewing pain tooth 16",
    "Post-op checkup",
    "Missing tooth 24",
    "Throbbing pain 36",
    "Routine recall",
    "Broken crown",
    "Shade too light",
    "Cracked tooth after lunch",
    "Lost filling",
    "Aligner tightness",
];

fn should_run() -> bool {
    !cfg!(test)
        && (std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
            || std::env::args().any(|a| a == "--dev-seed"))
}

pub async fn run_demo_workday_if_needed(pool: &SqlitePool) -> Result<(), AppError> {
    if !should_run() {
        return Ok(());
    }
    let today = Local::now().date_naive().to_string();
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(WORKDAY_KV)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    if row.as_ref().map(|(v,)| v.as_str()) == Some(today.as_str()) {
        return Ok(());
    }
    seed_today_book(pool, &today).await?;
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(WORKDAY_KV)
    .bind(&today)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    tracing::info!(day = %today, slots = SLOTS.len(), "demo workday book applied");
    Ok(())
}

async fn seed_today_book(pool: &SqlitePool, today: &str) -> Result<(), AppError> {
    let hour = Local::now().time().hour();

    sqlx::query(
        "DELETE FROM appointment
         WHERE date = ?1 AND (id LIKE 'seed-wd-%' OR id LIKE 'seed-yr-apt-%')",
    )
    .bind(today)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let patients: Vec<(String,)> = sqlx::query_as("SELECT id FROM patient ORDER BY id LIMIT 40")
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    if patients.is_empty() {
        tracing::warn!("demo workday: no patients — skip");
        return Ok(());
    }

    for (i, (time, kind, dur, act)) in SLOTS.iter().enumerate() {
        let slot_hour: u32 = time[..2].parse().unwrap_or(8);
        let status = if *time == "10:15" && hour >= 11 {
            "NO_SHOW"
        } else if slot_hour + 1 < hour {
            "COMPLETED"
        } else if slot_hour <= hour {
            "CONFIRMED"
        } else {
            "PLANNED"
        };
        let pat = &patients[i % patients.len()].0;
        let notes = format!("Duration: {dur} min · {act}");
        let created = format!("{today} {time}:00");
        sqlx::query(
            "INSERT OR IGNORE INTO appointment
             (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        )
        .bind(format!("seed-wd-{i:02}"))
        .bind(today)
        .bind(time)
        .bind(kind)
        .bind(status)
        .bind(&notes)
        .bind(COMPLAINTS[i % COMPLAINTS.len()])
        .bind(pat)
        .bind(PHYSICIAN_ID)
        .bind(&created)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    sqlx::query(
        "INSERT OR IGNORE INTO payment (id, patient_id, amount, payment_method, status, description) VALUES
         ('seed-wd-pay-01', ?1, 89.0, 'CASH', 'PAID', 'Morning hygiene — paid at desk'),
         ('seed-wd-pay-02', ?2, 42.0, 'CARD', 'PAID', 'Emergency co-pay walk-in'),
         ('seed-wd-pay-03', ?3, 210.0, 'INVOICE', 'OUTSTANDING', 'Crown prep — invoice after lab')",
    )
    .bind(&patients[0].0)
    .bind(&patients[1 % patients.len()].0)
    .bind(&patients[2 % patients.len()].0)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}
