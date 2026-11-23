//! Showcase polish for website screenshots (`MEDOC_DEV_SEED=1` + `MEDOC_SHOWCASE=1`).
//!
//! The demo seed is built for load (a year of volume, every status, backlogs). Screenshots for
//! the website need a believable, healthy practice instead: a Moroccan practice, patients with
//! consistent names, sex and contact data, a full and well-run day, small queues, nothing
//! overdue, and tooth findings that follow the chart rules (one status set per tooth).
//! Runs after the other demo seeds on every start (idempotent). Use it on a separate data
//! folder (another app identifier): it rewrites demo rows.

use chrono::{Datelike, Local, Timelike, Weekday};
use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

pub fn should_run() -> bool {
    !cfg!(test)
        && std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
        && std::env::var("MEDOC_SHOWCASE").ok().as_deref() == Some("1")
}

const FEMALE: &[&str] = &[
    "Salma",
    "Khadija",
    "Fatima Zahra",
    "Imane",
    "Nadia",
    "Meryem",
    "Houda",
    "Sanaa",
    "Laila",
    "Yasmine",
    "Amina",
    "Hajar",
    "Zineb",
    "Ghita",
    "Rim",
    "Soukaina",
    "Nisrine",
    "Kenza",
    "Asmae",
    "Hind",
    "Ilham",
    "Loubna",
    "Siham",
    "Wiam",
    "Chaimae",
    "Oumaima",
    "Hanane",
    "Najat",
    "Rajae",
    "Samira",
];
const MALE: &[&str] = &[
    "Youssef", "Mehdi", "Omar", "Karim", "Hamza", "Anas", "Reda", "Ayoub", "Amine", "Adil",
    "Hicham", "Rachid", "Nabil", "Said", "Tarik", "Yassine", "Ismail", "Zakaria", "Othmane",
    "Ilyas", "Mourad", "Driss", "Khalid", "Badr", "Soufiane", "Hassan", "Mustapha", "Jamal",
    "Walid", "Ali",
];
const LAST: &[&str] = &[
    "Bennani",
    "Alaoui",
    "El Idrissi",
    "Tazi",
    "Berrada",
    "Chraibi",
    "Fassi Fihri",
    "Benjelloun",
    "Lahlou",
    "Sqalli",
    "Ouazzani",
    "El Amrani",
    "Benkirane",
    "Kettani",
    "Lamrani",
    "Bouzidi",
    "El Mansouri",
    "Naciri",
    "Skalli",
    "Belkadi",
    "Cherkaoui",
    "Rami",
    "Ziani",
    "Haddad",
    "Moussaoui",
    "Bakkali",
    "El Fassi",
    "Amrani",
    "Sabri",
    "Tahiri",
    "Mernissi",
    "Benali",
    "Filali",
    "Saidi",
    "Kadiri",
    "Zemmouri",
    "Hajji",
    "Laraki",
    "Guessous",
    "Jettou",
];
const STREETS: &[&str] = &[
    "Boulevard Zerktouni",
    "Rue Ibnou Mounir",
    "Boulevard d'Anfa",
    "Rue Al Massira",
    "Avenue Hassan II",
    "Rue Abou Bakr Seddik",
    "Boulevard Ghandi",
    "Rue Taha Hussein",
    "Avenue Mohammed V",
    "Rue de Fès",
];
const CITIES: &[(&str, &str)] = &[
    ("20250", "Casablanca"),
    ("20330", "Casablanca"),
    ("20100", "Casablanca"),
    ("20000", "Casablanca"),
    ("10090", "Rabat"),
    ("20800", "Mohammédia"),
];
const INSURERS: &[&str] = &["CNOPS", "CNSS", "CNSS", "AMO", "CNOPS", "Privée"];

fn ascii(s: &str) -> String {
    s.to_lowercase()
        .replace(' ', "")
        .replace(['é', 'è'], "e")
        .replace('\'', "")
}

pub async fn run_showcase_polish(pool: &SqlitePool) -> Result<(), AppError> {
    if !should_run() {
        return Ok(());
    }
    let mut tx = pool.begin().await.map_err(AppError::Database)?;

    // 1. Patients: one name pool per sex, no repeats, Moroccan contact data.
    let ids: Vec<(String,)> = sqlx::query_as("SELECT id FROM patient ORDER BY id")
        .fetch_all(&mut *tx)
        .await?;
    for (i, (id,)) in ids.iter().enumerate() {
        let female = i % 2 == 0;
        let k = i / 2;
        let pool_first = if female { FEMALE } else { MALE };
        let first = pool_first[k % pool_first.len()];
        let last = LAST[(k / pool_first.len() + k * 7) % LAST.len()];
        let (zip, city) = CITIES[i % CITIES.len()];
        let street = STREETS[(i * 3) % STREETS.len()];
        let insurer = INSURERS[i % INSURERS.len()];
        let n = 100_000 + (i * 7919) % 900_000;
        sqlx::query(
            "UPDATE patient SET name = ?2, sex = ?3, phone = ?4, email = ?5, address = ?6,
                    insurance_number = ?7, updated_at = updated_at
              WHERE id = ?1",
        )
        .bind(id)
        .bind(format!("{first} {last}"))
        .bind(if female { "FEMALE" } else { "MALE" })
        .bind(format!(
            "+212 6{} {:02} {:02} {:02} {:02}",
            1 + i % 9,
            (i * 13) % 100,
            (i * 29) % 100,
            (i * 41) % 100,
            (i * 53) % 100
        ))
        .bind(format!(
            "{}.{}{}@exemple.ma",
            ascii(first),
            ascii(last),
            i % 97
        ))
        .bind(format!("{} {street}, {zip} {city}", 3 + (i * 17) % 180))
        .bind(format!("{insurer}-{n}-{i:04}"))
        .execute(&mut *tx)
        .await?;
    }

    // 2. Small, healthy queues: a few records to validate, a few tasks, a few unread notes.
    sqlx::query(
        "UPDATE patient_chart SET status = 'VALIDATED'
          WHERE status IN ('DRAFT','IN_PROGRESS','DECLINED')
            AND id NOT IN (SELECT id FROM patient_chart
                            WHERE status IN ('DRAFT','IN_PROGRESS')
                            ORDER BY updated_at DESC LIMIT 4)",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE practice_task SET status = 'VALIDATED', updated_at = updated_at
          WHERE status NOT IN ('VALIDATED','DONE')
            AND id NOT IN (SELECT id FROM practice_task
                            WHERE status NOT IN ('VALIDATED','DONE','BACK')
                            ORDER BY created_at DESC LIMIT 5)",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE in_app_notification SET read_at = COALESCE(read_at, created_at)
          WHERE id NOT IN (SELECT id FROM in_app_notification ORDER BY created_at DESC LIMIT 4)",
    )
    .execute(&mut *tx)
    .await?;

    // 3. Money: almost everything paid; a handful still open, none overdue.
    sqlx::query(
        "UPDATE payment SET status = 'PAID'
          WHERE status IN ('OUTSTANDING','PARTIALLY_PAID')
            AND (abs(random()) % 12) <> 0",
    )
    .execute(&mut *tx)
    .await?;

    // 4. Orders: delivered on time, two on their way.
    let today = Local::now().date_naive();
    sqlx::query(
        "UPDATE purchase_order SET status = 'DELIVERED', delivered_on = COALESCE(expected_on, date(created_at)),
                updated_at = updated_at
          WHERE status IN ('OPEN','IN_TRANSIT')",
    )
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "UPDATE purchase_order SET status = 'IN_TRANSIT', delivered_on = NULL,
                expected_on = date(?1, '+' || (2 + (rowid % 3)) || ' days')
          WHERE id IN (SELECT id FROM purchase_order ORDER BY created_at DESC LIMIT 2)",
    )
    .bind(today.to_string())
    .execute(&mut *tx)
    .await?;

    // 5. Tooth findings: one row per tooth (the chart rules allow one status set per tooth).
    sqlx::query(
        "DELETE FROM dental_finding
          WHERE rowid NOT IN (SELECT MAX(rowid) FROM dental_finding GROUP BY chart_id, tooth_number)",
    )
    .execute(&mut *tx)
    .await?;

    // 6. Today: the morning is done and paid, the afternoon is confirmed.
    if !matches!(today.weekday(), Weekday::Sat | Weekday::Sun) {
        let now = Local::now().time();
        let now_min = now.hour() * 60 + now.minute();
        let rows: Vec<(String, String, i64)> = sqlx::query_as(
            "SELECT id, time, COALESCE(duration_minutes, 30) FROM appointment WHERE date = ?1 ORDER BY time",
        )
        .bind(today.to_string())
        .fetch_all(&mut *tx)
        .await?;
        for (id, time, dur) in rows {
            let (h, m) = time.split_once(':').unwrap_or(("8", "0"));
            let start = h.parse::<u32>().unwrap_or(8) * 60 + m.parse::<u32>().unwrap_or(0);
            let end = start + dur as u32;
            let status = if end <= now_min {
                "COMPLETED"
            } else if start <= now_min {
                "IN_PROGRESS"
            } else {
                "CONFIRMED"
            };
            sqlx::query("UPDATE appointment SET status = ?2 WHERE id = ?1")
                .bind(&id)
                .bind(status)
                .execute(&mut *tx)
                .await?;
        }
        let pats: Vec<(String,)> = sqlx::query_as("SELECT id FROM patient ORDER BY id LIMIT 8")
            .fetch_all(&mut *tx)
            .await?;
        const TODAY_PAY: &[(f64, &str, &str)] = &[
            (450.0, "CASH", "Détartrage et polissage"),
            (1200.0, "CARD", "Composite 16 occlusal"),
            (300.0, "CASH", "Consultation et radiographie"),
            (2800.0, "CARD", "Couronne céramique 24 (acompte)"),
            (
                650.0,
                "BANK_TRANSFER",
                "Traitement endodontique 36 (séance 2)",
            ),
            (400.0, "CASH", "Contrôle post-opératoire et soins"),
        ];
        for (i, (amount, method, desc)) in TODAY_PAY.iter().enumerate() {
            let Some((pid,)) = pats.get(i) else { break };
            sqlx::query(
                "INSERT OR REPLACE INTO payment (id, patient_id, amount, payment_method, status, description, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'PAID', ?5, datetime('now', ?6))",
            )
            .bind(format!("seed-sc-pay-{i:02}"))
            .bind(pid)
            .bind(amount)
            .bind(method)
            .bind(desc)
            .bind(format!("-{} minutes", 30 + i * 35))
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(target: "medoc::system", event = "DEMO_SHOWCASE_APPLIED", patients = ids.len());
    Ok(())
}
