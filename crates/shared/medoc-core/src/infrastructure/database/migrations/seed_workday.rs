//! Shape **today** into a packed weekday book for screenshots / demo.
//!
//! Runs with `MEDOC_DEV_SEED=1`. Re-applies when the local calendar date changes
//! so “today” stays a full work day after midnight. Times follow practice hours
//! (lunch 12:30–13:30, Friday close 15:00). Weekends are not booked.

use chrono::{Datelike, Local, NaiveDate, Timelike, Weekday};
use sqlx::sqlite::SqlitePool;

use super::seed_year::office_window;
use crate::error::AppError;

const WORKDAY_KV: &str = "migration.demo_workday.v1";
const PHYSICIAN_ID: &str = "seed-physician-001";
/// Bumped when chair times change so a same-day restart repacks the book.
const WORKDAY_PACK: &str = "v2";

/// Chair visits packed into the open day (5 min gap, lunch skipped).
const ACTS: &[(&str, u32, &str)] = &[
    ("FIRST_VISIT", 45, "New patient intake · full anamnesis"),
    (
        "EXAMINATION",
        30,
        "Periodontal status · hygiene instruction",
    ),
    ("TREATMENT", 45, "Composite filling 16 occlusal"),
    ("CHECKUP", 20, "Post-op review after extraction"),
    ("CONSULTATION", 30, "Crown vs implant consult"),
    ("TREATMENT", 40, "Endodontic follow-up 36"),
    ("EXAMINATION", 30, "Recall + bitewing radiographs"),
    ("TREATMENT", 50, "Crown prep 24 + temporary"),
    ("CHECKUP", 20, "Whitening shade check"),
    ("FIRST_VISIT", 45, "Emergency walk-in · cracked cusp"),
    ("TREATMENT", 40, "Replacement filling 46"),
    ("CONSULTATION", 25, "Aligner progress / next aligners"),
];

fn pack_workday(day: NaiveDate) -> Vec<(String, &'static str, u32, &'static str)> {
    let Some((open, lunch_from, lunch_to, close)) = office_window(day) else {
        return Vec::new();
    };
    const GAP: u32 = 5;
    let mut cursor = open;
    let mut out = Vec::new();
    for (kind, dur, act) in ACTS {
        if cursor < lunch_to && cursor + dur > lunch_from {
            cursor = lunch_to;
        }
        if cursor + dur > close {
            break;
        }
        out.push((
            format!("{:02}:{:02}", cursor / 60, cursor % 60),
            *kind,
            *dur,
            *act,
        ));
        cursor += dur + GAP;
    }
    out
}

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
    // A previous pack pinned the book to "today", including Sunday. Drop those rows.
    sqlx::query(
        "DELETE FROM appointment
         WHERE id LIKE 'seed-wd-%' AND strftime('%w', date) IN ('0', '6')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let today = Local::now().date_naive();
    if matches!(today.weekday(), Weekday::Sat | Weekday::Sun) {
        return Ok(());
    }
    let marker = format!("{WORKDAY_PACK}:{}", today);
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(WORKDAY_KV)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    if row.as_ref().map(|(v,)| v.as_str()) == Some(marker.as_str()) {
        return Ok(());
    }
    let slots = seed_today_book(pool, today).await?;
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(WORKDAY_KV)
    .bind(&marker)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    tracing::info!(day = %today, slots, "demo workday book applied");
    Ok(())
}

async fn seed_today_book(pool: &SqlitePool, today: NaiveDate) -> Result<usize, AppError> {
    let hour = Local::now().time().hour();
    let day = today.to_string();
    let slots = pack_workday(today);

    sqlx::query(
        "DELETE FROM appointment
         WHERE date = ?1 AND (id LIKE 'seed-wd-%' OR id LIKE 'seed-yr-apt-%')",
    )
    .bind(&day)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let patients: Vec<(String,)> = sqlx::query_as("SELECT id FROM patient ORDER BY id LIMIT 40")
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    if patients.is_empty() {
        tracing::warn!("demo workday: no patients — skip");
        return Ok(0);
    }

    for (i, (time, kind, dur, act)) in slots.iter().enumerate() {
        let slot_hour: u32 = time[..2].parse().unwrap_or(8);
        let status = if time == "10:15" && hour >= 11 {
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
        let created = format!("{day} {time}:00");
        sqlx::query(
            "INSERT OR IGNORE INTO appointment
             (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id, duration_minutes, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?11)",
        )
        .bind(format!("seed-wd-{i:02}"))
        .bind(&day)
        .bind(time)
        .bind(kind)
        .bind(status)
        .bind(&notes)
        .bind(COMPLAINTS[i % COMPLAINTS.len()])
        .bind(pat)
        .bind(PHYSICIAN_ID)
        .bind(i64::from(*dur))
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

    Ok(slots.len())
}

#[cfg(test)]
mod tests {
    use super::super::seed_year::{
        OFFICE_FRIDAY_CLOSE_MIN, OFFICE_LUNCH_END_MIN, OFFICE_LUNCH_START_MIN,
    };
    use super::pack_workday;
    use chrono::{Datelike, NaiveDate, Weekday};

    fn hm(hm: &str) -> u32 {
        let (h, m) = hm.split_once(':').unwrap();
        h.parse::<u32>().unwrap() * 60 + m.parse::<u32>().unwrap()
    }

    #[test]
    fn workday_book_skips_lunch_and_weekend() {
        let sunday = NaiveDate::from_ymd_opt(2026, 11, 15).unwrap();
        assert!(pack_workday(sunday).is_empty());
        let monday = NaiveDate::from_ymd_opt(2026, 11, 16).unwrap();
        let friday = NaiveDate::from_ymd_opt(2026, 11, 20).unwrap();
        for day in [monday, friday] {
            let slots = pack_workday(day);
            assert!(!slots.is_empty());
            let close = if day.weekday() == Weekday::Fri {
                OFFICE_FRIDAY_CLOSE_MIN
            } else {
                17 * 60
            };
            for (time, _, dur, _) in &slots {
                let start = hm(time);
                let end = start + dur;
                assert!(end <= close, "{day} {time}");
                assert!(
                    end <= OFFICE_LUNCH_START_MIN || start >= OFFICE_LUNCH_END_MIN,
                    "{day} {time} overlaps lunch"
                );
            }
        }
    }
}
