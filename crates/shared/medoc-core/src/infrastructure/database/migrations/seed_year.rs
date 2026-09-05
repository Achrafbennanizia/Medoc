//! Large demo/dev volume seed — fills Analytics, calendar, billing, and charts.
//!
//! Targets (full scale, `MEDOC_DEV_SEED=1` / `--dev-seed` only):
//! - 1000 patients with varied profiles
//! - 10_000 treatments + examinations combined
//! - ≥ 5_000 prescriptions + ≥ 7_000 certificates
//! - ≥ €300_000 cash flow (payments + purchase orders)
//! - ≥ 50 treatment catalog entries
//! - 5 staff (1 PHYSICIAN + 4 RECEPTION — MVP quota)
//! - Dense appointments using every kind/status
//!
//! Skipped under `cfg!(test)` via [`run_demo_year_volume_if_needed`]. Idempotent: `year_v3`.

use chrono::{Datelike, Duration, Local, Weekday};
use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

const YEAR_SEED_KV_KEY: &str = "migration.demo_seed.year_v3";

const PHYSICIAN_ID: &str = "seed-physician-001";
const RECEPTION_IDS: &[&str] = &[
    "seed-rez-001",
    "seed-yr-rez-002",
    "seed-yr-rez-003",
    "seed-yr-rez-004",
];

#[derive(Clone, Copy)]
struct Scale {
    patients: u32,
    treatments: u32,
    examinations: u32,
    appointments: u32,
    prescriptions: u32,
    certificates: u32,
    min_cash_eur: f64,
    catalog_items: u32,
    purchase_orders: u32,
    work_time_days: u32,
}

impl Scale {
    /// Production/dev demo volume requested by product.
    const fn full() -> Self {
        Self {
            patients: 1000,
            treatments: 6000,
            examinations: 4000,
            appointments: 8000,
            prescriptions: 5200,
            certificates: 7200,
            min_cash_eur: 300_000.0,
            catalog_items: 56,
            purchase_orders: 120,
            work_time_days: 180,
        }
    }

    /// Tiny scale for unit tests.
    const fn smoke() -> Self {
        Self {
            patients: 12,
            treatments: 20,
            examinations: 15,
            appointments: 40,
            prescriptions: 8,
            certificates: 10,
            min_cash_eur: 5_000.0,
            catalog_items: 56,
            purchase_orders: 8,
            work_time_days: 10,
        }
    }
}

fn should_run() -> bool {
    !cfg!(test)
        && (std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
            || std::env::args().any(|a| a == "--dev-seed"))
}

async fn already_applied(pool: &SqlitePool) -> Result<bool, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(YEAR_SEED_KV_KEY)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(row.is_some())
}

async fn mark_applied(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, '1', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
    )
    .bind(YEAR_SEED_KV_KEY)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

fn mix(n: u64) -> u64 {
    n.wrapping_mul(0x9E37_79B9_7F4A_7C15).wrapping_add(0xA5A5_A5A5_5A5A_5A5A)
}

fn pick<'a, T>(n: u64, items: &'a [T]) -> &'a T {
    &items[(mix(n) as usize) % items.len()]
}

pub async fn run_demo_year_volume_if_needed(pool: &SqlitePool) -> Result<(), AppError> {
    if !should_run() {
        return Ok(());
    }
    if already_applied(pool).await? {
        return Ok(());
    }
    tracing::info!("demo year seed v2: generating full practice volume");
    seed_year_volume(pool, Scale::full()).await?;
    mark_applied(pool).await?;
    tracing::info!("demo year seed v2: done");
    Ok(())
}

async fn seed_year_volume(pool: &SqlitePool, scale: Scale) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;

    let physician: Option<(String,)> = sqlx::query_as("SELECT id FROM staff WHERE id = ?1")
        .bind(PHYSICIAN_ID)
        .fetch_optional(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    if physician.is_none() {
        tracing::warn!("demo year seed: physician missing — skip");
        tx.commit().await.map_err(AppError::Database)?;
        return Ok(());
    }

    let hash = bcrypt::hash("password123", 8)
        .map_err(|e| AppError::Internal(format!("year seed bcrypt: {e}")))?;

    // 5 personnel total: existing physician + 4 reception (MVP max).
    for (i, rid) in RECEPTION_IDS.iter().enumerate() {
        let name = match i {
            0 => "Aya M.",
            1 => "Nora S.",
            2 => "Tom K.",
            _ => "Lina B.",
        };
        let email = match i {
            0 => "aya@practice.de",
            1 => "nora@practice.de",
            2 => "tom@practice.de",
            _ => "lina@practice.de",
        };
        sqlx::query(
            "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, specialty)
             VALUES (?1, ?2, ?3, ?4, 'RECEPTION', NULL)",
        )
        .bind(rid)
        .bind(name)
        .bind(email)
        .bind(&hash)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    let today = Local::now().date_naive();
    let start = today - Duration::days(364);

    // --- 50+ treatment catalog entries (all major categories) ---
    const CATALOG: &[(&str, &str, f64)] = &[
        ("Checkup", "Recall / checkup", 49.0),
        ("Checkup", "New patient intake exam", 79.0),
        ("Checkup", "Child recall", 39.0),
        ("Checkup", "Emergency triage", 59.0),
        ("Diagnostics", "Periodontal charting", 89.0),
        ("Diagnostics", "Bitewing radiographs", 45.0),
        ("Diagnostics", "Panoramic X-ray", 65.0),
        ("Diagnostics", "Vitality test", 25.0),
        ("Diagnostics", "Occlusal analysis", 95.0),
        ("Diagnostics", "TMJ screening", 75.0),
        ("Prevention", "Professional cleaning", 99.0),
        ("Prevention", "Airflow polish", 69.0),
        ("Prevention", "Fluoride varnish", 35.0),
        ("Prevention", "Fissure sealant per tooth", 55.0),
        ("Prevention", "Oral hygiene instruction", 29.0),
        ("Prevention", "Desensitizing treatment", 49.0),
        ("FillingTherapy", "One-surface composite", 119.0),
        ("FillingTherapy", "Two-surface composite", 149.0),
        ("FillingTherapy", "Three-surface composite", 179.0),
        ("FillingTherapy", "Composite buildup", 199.0),
        ("FillingTherapy", "Glass ionomer filling", 89.0),
        ("FillingTherapy", "Temporary filling", 45.0),
        ("Periodontology", "Pocket depth measurement", 65.0),
        ("Periodontology", "Scaling & root planing quadrant", 189.0),
        ("Periodontology", "Periodontal maintenance", 129.0),
        ("Periodontology", "Local antibiotic pocket", 85.0),
        ("Periodontology", "Gingivectomy", 220.0),
        ("Endodontics", "Root canal anterior", 380.0),
        ("Endodontics", "Root canal premolar", 450.0),
        ("Endodontics", "Root canal molar", 520.0),
        ("Endodontics", "Endo retreatment", 580.0),
        ("Endodontics", "Pulp capping", 95.0),
        ("Surgery", "Simple extraction", 95.0),
        ("Surgery", "Surgical extraction", 180.0),
        ("Surgery", "Wisdom tooth removal", 280.0),
        ("Surgery", "Apicoectomy", 420.0),
        ("Surgery", "Implant uncovering", 150.0),
        ("Surgery", "Abscess incision", 110.0),
        ("Prosthodontics", "Crown preparation", 320.0),
        ("Prosthodontics", "Zirconia crown", 890.0),
        ("Prosthodontics", "Bridge unit", 750.0),
        ("Prosthodontics", "Partial denture", 680.0),
        ("Prosthodontics", "Denture reline", 190.0),
        ("Prosthodontics", "Temporary crown", 95.0),
        ("Aesthetics", "Bleaching tray set", 350.0),
        ("Aesthetics", "In-office bleaching", 420.0),
        ("Aesthetics", "Composite veneer", 280.0),
        ("Aesthetics", "Smile design consult", 79.0),
        ("Functional", "Splint therapy hard", 390.0),
        ("Functional", "Splint adjustment", 55.0),
        ("Functional", "Bruxism consult", 69.0),
        ("Orthodontics", "Aligner consult", 89.0),
        ("Orthodontics", "Retainers", 180.0),
        ("Orthodontics", "Space maintainer", 210.0),
        ("Lab", "Impression / scan", 75.0),
        ("Lab", "Shade matching", 40.0),
    ];
    debug_assert!(CATALOG.len() >= 50);
    let catalog_n = scale.catalog_items.min(CATALOG.len() as u32) as usize;
    for (i, (cat, name, price)) in CATALOG.iter().take(catalog_n).enumerate() {
        sqlx::query(
            "INSERT OR IGNORE INTO treatment_catalog
             (id, category, name, default_cost, sort_order, active)
             VALUES (?1,?2,?3,?4,?5,1)",
        )
        .bind(format!("seed-yr-kat-{i:03}"))
        .bind(cat)
        .bind(name)
        .bind(price)
        .bind((i as i64 + 1) * 10)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        sqlx::query(
            "INSERT OR IGNORE INTO service_item
             (id, name, description, category, price, active)
             VALUES (?1,?2,?3,?4,?5,1)",
        )
        .bind(format!("seed-yr-lei-{i:03}"))
        .bind(name)
        .bind(format!("Demo service — {cat}"))
        .bind(cat)
        .bind(price)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Patients (rich / multi profiles) ---
    const FIRST: &[&str] = &[
        "Anna", "Ben", "Clara", "David", "Emma", "Felix", "Greta", "Hans", "Iris", "Jan",
        "Kara", "Leo", "Mila", "Noah", "Olga", "Paul", "Quinn", "Rosa", "Sam", "Tina",
        "Uwe", "Vera", "Will", "Xena", "Yara", "Zoe", "Amir", "Basma", "Chantal", "Diego",
        "Elena", "Farid", "Giulia", "Hugo", "Ines", "Jamal", "Kira", "Luca", "Maya", "Nils",
    ];
    const LAST: &[&str] = &[
        "Meyer", "Schmidt", "Weber", "Wagner", "Becker", "Schulz", "Hoffmann", "Koch",
        "Richter", "Klein", "Wolf", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krueger",
        "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Lehmann",
        "Alvarez", "Yilmaz", "Nguyen", "Kowalski", "Silva", "Andersen", "Petrov", "Dubois",
    ];
    const SEXES: &[&str] = &["FEMALE", "MALE", "DIVERSE", "FEMALE", "MALE"];
    const STATUSES: &[&str] = &["NEW", "ACTIVE", "ACTIVE", "VALIDATED", "READONLY", "ACTIVE"];
    const INSURERS: &[&str] = &["AOK", "TK", "BKK", "DAK", "IKK", "Barmer", "KKH", "HEK"];
    const CITIES: &[&str] = &[
        "Bremen", "Hamburg", "Oldenburg", "Delmenhorst", "Bremerhaven", "Verden",
    ];
    const ANAMS: &[&str] = &[
        r#"{"version":1,"allergies":{"medications":"Penicillin"},"medication":{"regular":"Ramipril 5mg"},"preExisting":{"chronic":"Hypertension"}}"#,
        r#"{"version":1,"allergies":{"medications":"None"},"medication":{"regular":""},"preExisting":{"chronic":""}}"#,
        r#"{"version":1,"allergies":{"material":"Latex"},"medication":{"regular":"L-Thyroxin"},"preExisting":{"chronic":"Hypothyroid"}}"#,
        r#"{"version":1,"allergies":{"medications":"NSAID"},"medication":{"regular":"Metformin"},"preExisting":{"chronic":"Type 2 diabetes"}}"#,
        r#"{"version":1,"allergies":{"foods":"Nuts"},"medication":{"regular":"Vitamin D"},"preExisting":{"mental":"Anxiety — prefer short visits"}}"#,
        r#"{"version":1,"allergies":{"medications":"None known"},"medication":{"regular":"ASS 100"},"preExisting":{"surgeries":"Tonsillectomy 2010"}}"#,
    ];

    let mut patient_ids = Vec::with_capacity(scale.patients as usize);
    let mut chart_ids = Vec::with_capacity(scale.patients as usize);

    for i in 0..scale.patients as u64 {
        let pid = format!("seed-yr-pat-{i:04}");
        let cid = format!("seed-yr-chart-{i:04}");
        let day_offset = ((i as i64) * 364) / scale.patients.max(1) as i64;
        let created = start + Duration::days(day_offset);
        let dob_year = 1948 + (mix(i + 7) % 55) as i32;
        let name = format!("{} {}", pick(i, FIRST), pick(i + 3, LAST));
        let sex = *pick(i + 5, SEXES);
        let status = *pick(i + 9, STATUSES);
        let insurer = *pick(i + 17, INSURERS);
        let city = *pick(i + 19, CITIES);
        let insurance = format!("{insurer}-YR{i:05}");
        let phone = format!(
            "+49 17{} {:07}",
            mix(i) % 10,
            1_000_000 + (mix(i + 1) % 8_000_000)
        );
        let email = format!("yr.patient.{i:04}@medoc-demo.de");
        let address = format!(
            "{} {}, {} {}",
            pick(i + 2, LAST),
            1 + mix(i) % 120,
            27_000 + mix(i + 4) % 900,
            city
        );

        sqlx::query(
            "INSERT OR IGNORE INTO patient
             (id, name, date_of_birth, sex, insurance_number, phone, email, address, status, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        )
        .bind(&pid)
        .bind(&name)
        .bind(format!(
            "{dob_year:04}-{:02}-{:02}",
            1 + mix(i + 11) % 12,
            1 + mix(i + 13) % 28
        ))
        .bind(sex)
        .bind(&insurance)
        .bind(&phone)
        .bind(&email)
        .bind(&address)
        .bind(status)
        .bind(format!("{created} 09:00:00"))
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        let chart_status = match status {
            "READONLY" => "READONLY",
            "VALIDATED" => "VALIDATED",
            "NEW" => "DRAFT",
            _ => "IN_PROGRESS",
        };
        sqlx::query(
            "INSERT OR IGNORE INTO patient_chart
             (id, patient_id, status, diagnosis, findings, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?6)",
        )
        .bind(&cid)
        .bind(&pid)
        .bind(chart_status)
        .bind(*pick(i + 21, &[
            "Caries risk elevated",
            "Periodontal maintenance",
            "Recall patient",
            "Endodontic follow-up",
            "Prosthetic planning",
            "Orthodontic consult",
            "Acute pain pathway",
            "Implant aftercare",
        ]))
        .bind(*pick(i + 23, &[
            "Stable findings",
            "Bleeding on probing localized",
            "Occlusal wear noted",
            "Good oral hygiene",
            "Sensitivity reported",
            "Multiple restorations present",
            "Partial edentulism",
        ]))
        .bind(format!("{created} 09:15:00"))
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        // Multi profile: anamnesis for most patients
        if mix(i + 31) % 5 != 0 {
            sqlx::query(
                "INSERT OR IGNORE INTO anamnesis_form
                 (id, patient_id, answers, signed, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?5)",
            )
            .bind(format!("seed-yr-anam-{i:04}"))
            .bind(&pid)
            .bind(*pick(i + 33, ANAMS))
            .bind(i32::from(mix(i) % 3 != 0))
            .bind(format!("{created} 09:20:00"))
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }

        // Multiple dental findings for a dense tooth-status look
        let finding_count = 1 + (mix(i + 40) % 4) as u64;
        for f in 0..finding_count {
            let n = mix(i * 17 + f);
            sqlx::query(
                "INSERT OR IGNORE INTO dental_finding
                 (id, chart_id, tooth_number, finding, diagnosis, notes, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?7)",
            )
            .bind(format!("seed-yr-zb-{i:04}-{f}"))
            .bind(&cid)
            .bind(11 + (n % 37) as i64)
            .bind(*pick(n, &[
                "Caries", "Filling intact", "Pocket 4mm", "Crack", "Abrasion",
                "Missing", "Crown", "Implant", "Sealant", "Watch",
            ]))
            .bind(*pick(n + 2, &[
                "Initial caries", "Secondary caries", "Gingivitis", "Periodontitis stage I",
                "Healthy", "Fracture risk", "Peri-implant mucositis",
            ]))
            .bind("Year demo multi-finding")
            .bind(format!("{created} 09:3{f}:00"))
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }

        patient_ids.push(pid);
        chart_ids.push(cid);
    }

    const APT_KINDS: &[&str] = &[
        "FIRST_VISIT", "EXAMINATION", "TREATMENT", "CHECKUP", "CONSULTATION",
    ];
    const APT_STATUSES: &[&str] = &[
        "PLANNED", "CONFIRMED", "COMPLETED", "COMPLETED", "COMPLETED",
        "NO_SHOW", "CANCELLED", "CONFIRMED",
    ];
    const APT_TIMES: &[&str] = &[
        "08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:20",
        "10:40", "11:00", "11:20", "11:40", "13:00", "13:20", "13:40", "14:00",
        "14:20", "14:40", "15:00", "15:20", "15:40", "16:00", "16:20", "16:40",
    ];
    const PAY_METHODS: &[&str] = &["CASH", "CARD", "BANK_TRANSFER", "INVOICE"];
    const PAY_STATUSES: &[&str] = &[
        "PAID", "PAID", "PAID", "PAID", "PARTIALLY_PAID", "OUTSTANDING", "CANCELLED",
    ];
    const DIAGNOSES: &[&str] = &[
        "Initial occlusal caries", "Gingivitis", "Periodontitis stage I",
        "Dentine hypersensitivity", "Reversible pulpitis", "Cracked tooth syndrome",
        "Pericoronitis", "Abrasion / attrition", "Secondary caries", "Healthy recall",
        "Irreversible pulpitis", "Apical periodontitis", "Tooth fracture",
    ];

    let mut cash_flow = 0.0_f64;

    // --- Dense appointments (every kind/status) ---
    let weekdays: Vec<_> = {
        let mut d = start;
        let mut days = Vec::new();
        while d <= today {
            if d.weekday() != Weekday::Sat && d.weekday() != Weekday::Sun {
                days.push(d);
            }
            d += Duration::days(1);
        }
        days
    };
    let weekday_n = weekdays.len().max(1);

    for a in 0..scale.appointments as u64 {
        let day = weekdays[(a as usize) % weekday_n];
        let n = mix(a.wrapping_mul(31) + 9);
        let pat_idx = (n as usize) % patient_ids.len();
        let kind = *pick(n + 1, APT_KINDS);
        let time = *pick(n + 2, APT_TIMES);
        let status = if day > today {
            if n % 2 == 0 { "PLANNED" } else { "CONFIRMED" }
        } else {
            *pick(n + 3, APT_STATUSES)
        };
        let created = format!("{day} {time}:00");
        sqlx::query(
            "INSERT OR IGNORE INTO appointment
             (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id, created_at, updated_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        )
        .bind(format!("seed-yr-apt-{a:05}"))
        .bind(day.to_string())
        .bind(time)
        .bind(kind)
        .bind(status)
        .bind(*pick(n + 4, &[
            "Routine", "Follow-up", "Acute", "Recall", "Lab try-in", "Post-op", "",
        ]))
        .bind(*pick(n + 5, &[
            "Tooth sensitivity", "Gum bleeding", "Chewing pain", "Checkup",
            "Crown check", "None", "Swelling", "Broken filling",
        ]))
        .bind(&patient_ids[pat_idx])
        .bind(PHYSICIAN_ID)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Treatments (6000) ---
    for t in 0..scale.treatments as u64 {
        let n = mix(t.wrapping_mul(17) + 3);
        let pat_idx = (n as usize) % patient_ids.len();
        let day = weekdays[(n as usize) % weekday_n];
        let (cat, svc, cost) = CATALOG[(n as usize) % catalog_n];
        let created = format!(
            "{day} {:02}:{:02}:00",
            8 + (n % 9),
            (n % 6) * 10
        );
        let tid = format!("seed-yr-bh-{t:05}");
        let tooth = 11 + (mix(n + 9) % 37) as i64;
        sqlx::query(
            "INSERT OR IGNORE INTO treatment (
                id, chart_id, kind, description, teeth, material, notes,
                category, service_name, treatment_number, session_number,
                treatment_status, total_cost, appointment_required, treatment_date,
                released_by_physician_id, released_at, created_at
             ) VALUES (
                ?1,?2,?3,?4,?5,?6,?7,
                ?8,?9,?10,1,
                'COMPLETED',?11,0,?12,
                ?13,?14,?14
             )",
        )
        .bind(&tid)
        .bind(&chart_ids[pat_idx])
        .bind(cat)
        .bind(svc)
        .bind(tooth.to_string())
        .bind(*pick(n + 10, &["Composite A2", "Amalgam", "-", "Zirconia", "None", "Gold"]))
        .bind("Year demo treatment")
        .bind(cat)
        .bind(svc)
        .bind(format!("{}", 1000 + t))
        .bind(cost)
        .bind(day.to_string())
        .bind(PHYSICIAN_ID)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        let pay_status = *pick(n + 12, PAY_STATUSES);
        let amount = match pay_status {
            "PARTIALLY_PAID" => (cost * 0.5).round(),
            "OUTSTANDING" | "CANCELLED" => {
                if pay_status == "OUTSTANDING" {
                    0.0
                } else {
                    cost
                }
            }
            _ => cost,
        };
        if pay_status == "PAID" || pay_status == "PARTIALLY_PAID" {
            cash_flow += amount;
        }
        let lei = format!("seed-yr-lei-{:03}", (n as usize) % catalog_n);
        let pay_id = format!("seed-yr-pay-t-{t:05}");
        sqlx::query(
            "INSERT OR IGNORE INTO payment
             (id, patient_id, amount, payment_method, status, service_item_id, description,
              treatment_id, amount_expected, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        )
        .bind(&pay_id)
        .bind(&patient_ids[pat_idx])
        .bind(amount)
        .bind(*pick(n + 13, PAY_METHODS))
        .bind(pay_status)
        .bind(&lei)
        .bind(format!("{svc} — {day}"))
        .bind(&tid)
        .bind(cost)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        if pay_status == "OUTSTANDING" || pay_status == "PARTIALLY_PAID" {
            let assignee = *pick(n + 14, RECEPTION_IDS);
            sqlx::query(
                "INSERT OR IGNORE INTO practice_task
                 (id, patient_id, kind, title, body, assignee_role, assignee_user_id,
                  created_by, treatment_id, service_name, total_cost, payment_id, status, created_at, updated_at)
                 VALUES (?1,?2,'BILLING',?3,?4,'RECEPTION',?5,?6,?7,?8,?9,?10,'OPEN',?11,?11)",
            )
            .bind(format!("seed-yr-task-t-{t:05}"))
            .bind(&patient_ids[pat_idx])
            .bind(format!("Collect payment — {svc}"))
            .bind("Demo billing follow-up")
            .bind(assignee)
            .bind(PHYSICIAN_ID)
            .bind(&tid)
            .bind(svc)
            .bind(cost)
            .bind(&pay_id)
            .bind(&created)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
        }
    }

    // --- Prescriptions (≥5000 full) ---
    const RX_MEDS: &[(&str, &str)] = &[
        ("Ibuprofen 600mg", "Ibuprofen"),
        ("Amoxicillin 1000mg", "Amoxicillin"),
        ("Chlorhexidin 0.2%", "Chlorhexidin"),
        ("Paracetamol 500mg", "Paracetamol"),
        ("Metronidazole 400mg", "Metronidazole"),
        ("Diclofenac 50mg", "Diclofenac"),
        ("Augmentin 875/125", "Amoxicillin/Clavulanic acid"),
        ("Corsodyl mouthwash", "Chlorhexidine"),
    ];
    const RX_STATUSES: &[&str] = &["ISSUED", "ISSUED", "ISSUED", "DRAFT", "CANCELLED"];
    for r in 0..scale.prescriptions as u64 {
        let n = mix(r.wrapping_mul(31) + 11);
        let pat_idx = (n as usize) % patient_ids.len();
        let day = weekdays[(n as usize) % weekday_n];
        let created = format!(
            "{day} {:02}:{:02}:00",
            9 + (n % 8),
            (n % 6) * 10
        );
        let (med, ingredient) = RX_MEDS[(n as usize) % RX_MEDS.len()];
        sqlx::query(
            "INSERT OR IGNORE INTO prescription
             (id, patient_id, physician_id, medication, active_ingredient, dosage, duration,
              instructions, status, prescribing_physician_id, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?3,?10)",
        )
        .bind(format!("seed-yr-rx-{r:05}"))
        .bind(&patient_ids[pat_idx])
        .bind(PHYSICIAN_ID)
        .bind(med)
        .bind(ingredient)
        .bind(*pick(n + 2, &["1-0-1", "1-1-1", "As directed", "2× daily"]))
        .bind(*pick(n + 3, &["3 days", "5 days", "7 days", "10 days", "14 days"]))
        .bind("Demo prescription — year volume seed.")
        .bind(*pick(n + 4, RX_STATUSES))
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Certificates (≥7000 full) ---
    const CERT_KINDS: &[&str] = &[
        "SICK_LEAVE",
        "TREATMENT_CONFIRMATION",
        "SPORTS_EXEMPTION",
        "SCHOOL_EXEMPTION",
        "OTHER",
    ];
    for c in 0..scale.certificates as u64 {
        let n = mix(c.wrapping_mul(37) + 17);
        let pat_idx = (n as usize) % patient_ids.len();
        let day = weekdays[(n as usize) % weekday_n];
        let until = day + Duration::days(2 + (n % 14) as i64);
        let created = format!(
            "{day} {:02}:{:02}:00",
            10 + (n % 7),
            (n % 5) * 12
        );
        let kind = *pick(n + 5, CERT_KINDS);
        sqlx::query(
            "INSERT OR IGNORE INTO certificate
             (id, patient_id, physician_id, kind, body_text, valid_from, valid_until,
              issuing_physician_id, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?3,?8)",
        )
        .bind(format!("seed-yr-att-{c:05}"))
        .bind(&patient_ids[pat_idx])
        .bind(PHYSICIAN_ID)
        .bind(kind)
        .bind(format!("Demo certificate ({kind}) — year volume seed."))
        .bind(day.to_string())
        .bind(until.to_string())
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Examinations (4000) ---
    for e in 0..scale.examinations as u64 {
        let n = mix(e.wrapping_mul(19) + 5);
        let pat_idx = (n as usize) % patient_ids.len();
        let day = weekdays[(n as usize) % weekday_n];
        let created = format!(
            "{day} {:02}:{:02}:00",
            8 + (n % 9),
            (n % 6) * 10
        );
        let diagnosis = *pick(n + 14, DIAGNOSES);
        let exam_cost = 49.0 + (n % 8) as f64 * 12.0;
        let eid = format!("seed-yr-un-{e:05}");
        sqlx::query(
            "INSERT OR IGNORE INTO examination
             (id, chart_id, chief_complaint, results, diagnosis, examination_number,
              category, service_name, total_cost, released_by_physician_id, released_at, created_at)
             VALUES (?1,?2,?3,?4,?5,?6,'Diagnostics','Clinical examination',?7,?8,?9,?9)",
        )
        .bind(&eid)
        .bind(&chart_ids[pat_idx])
        .bind(*pick(n + 15, &[
            "Pain", "Bleeding", "Sensitivity", "Checkup", "Swelling", "Trauma", "Follow-up",
        ]))
        .bind(format!(
            r#"{{"version":1,"diagnosis":"{diagnosis}","findings":"Year demo examination"}}"#
        ))
        .bind(diagnosis)
        .bind(format!("U-{}", 5000 + e))
        .bind(exam_cost)
        .bind(PHYSICIAN_ID)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

        let pay_status = *pick(n + 16, PAY_STATUSES);
        let amount = match pay_status {
            "PARTIALLY_PAID" => (exam_cost * 0.5).round(),
            "OUTSTANDING" => 0.0,
            "CANCELLED" => exam_cost,
            _ => exam_cost,
        };
        if pay_status == "PAID" || pay_status == "PARTIALLY_PAID" {
            cash_flow += amount;
        }
        sqlx::query(
            "INSERT OR IGNORE INTO payment
             (id, patient_id, amount, payment_method, status, service_item_id, description,
              examination_id, amount_expected, created_at)
             VALUES (?1,?2,?3,?4,?5,'seed-yr-lei-000',?6,?7,?8,?9)",
        )
        .bind(format!("seed-yr-pay-e-{e:05}"))
        .bind(&patient_ids[pat_idx])
        .bind(amount)
        .bind(*pick(n + 18, PAY_METHODS))
        .bind(pay_status)
        .bind(format!("Examination — {diagnosis}"))
        .bind(&eid)
        .bind(exam_cost)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Purchase orders (cash outflow / procurement volume) ---
    const SUPPLIERS: &[&str] = &[
        "Henry Schein Dental", "Pluradent", "Speiko", "Komet", "Septodont", "Voco", "Bisico",
    ];
    const ITEMS: &[&str] = &[
        "Composite capsules", "Nitrile gloves M", "Etch gel", "Anaesthetic cartridges",
        "Suture 4-0", "Fluoride varnish", "Sterilization pouches", "Impression material",
        "Diamond burs", "Matrix bands", "Cotton rolls", "Alginate",
    ];
    const ORDER_STATUSES: &[&str] = &["OPEN", "IN_TRANSIT", "DELIVERED", "DELIVERED", "CANCELLED"];

    for o in 0..scale.purchase_orders as u64 {
        let order_day = start + Duration::days(((o * 364) / scale.purchase_orders.max(1) as u64) as i64);
        if order_day > today {
            continue;
        }
        let status = *pick(o + 1, ORDER_STATUSES);
        let qty = 2 + (mix(o) % 40) as i64;
        let unit_price = 15.0 + (mix(o + 2) % 200) as f64;
        let total = (qty as f64) * unit_price;
        if status == "DELIVERED" || status == "IN_TRANSIT" || status == "OPEN" {
            cash_flow += total; // procurement volume counts toward demo cash-flow surface
        }
        let created = format!("{order_day} 10:00:00");
        sqlx::query(
            "INSERT OR IGNORE INTO purchase_order (
                id, order_number, supplier, pharma_consultant, item, status,
                expected_on, delivered_on, quantity, unit, remark, total_amount, created_by, created_at
             ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,'Pkg.',?10,?11,?12,?13)",
        )
        .bind(format!("seed-yr-po-{o:04}"))
        .bind(format!("B-YR-{:05}", 2000 + o))
        .bind(*pick(o + 1, SUPPLIERS))
        .bind(*pick(o + 2, &["Ms Berger", "Mr Klose", "Ms Vogel", "Mr Brand"]))
        .bind(*pick(o + 3, ITEMS))
        .bind(status)
        .bind((order_day + Duration::days(5)).to_string())
        .bind(if status == "DELIVERED" {
            Some((order_day + Duration::days(4)).to_string())
        } else {
            None
        })
        .bind(qty)
        .bind("Year demo order")
        .bind(total)
        .bind(PHYSICIAN_ID)
        .bind(&created)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }

    // Top-up PAID payments if cash flow still under target (guarantees ≥ min_cash_eur).
    if cash_flow < scale.min_cash_eur {
        let need = scale.min_cash_eur - cash_flow;
        let chunks = 20u64;
        let each = (need / chunks as f64).ceil();
        for i in 0..chunks {
            let pat_idx = (i as usize) % patient_ids.len();
            let day = weekdays[(i as usize) % weekday_n];
            let created = format!("{day} 12:00:00");
            sqlx::query(
                "INSERT OR IGNORE INTO payment
                 (id, patient_id, amount, payment_method, status, service_item_id, description, created_at)
                 VALUES (?1,?2,?3,'BANK_TRANSFER','PAID','seed-yr-lei-000',?4,?5)",
            )
            .bind(format!("seed-yr-pay-top-{i:02}"))
            .bind(&patient_ids[pat_idx])
            .bind(each)
            .bind("Year demo cash-flow top-up")
            .bind(&created)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
            cash_flow += each;
        }
    }

    // --- Work time for all 5 staff ---
    let wt_start = today - Duration::days(scale.work_time_days as i64);
    let mut wt_n: u64 = 0;
    let mut wt_day = wt_start;
    while wt_day < today {
        if wt_day.weekday() != Weekday::Sat && wt_day.weekday() != Weekday::Sun {
            let staff_day: &[(&str, u32, u32)] = &[
                (PHYSICIAN_ID, 8, 17),
                (RECEPTION_IDS[0], 7, 16),
                (RECEPTION_IDS[1], 8, 15),
                (RECEPTION_IDS[2], 9, 17),
                (RECEPTION_IDS[3], 7, 14),
            ];
            for (staff, start_h, end_h) in staff_day {
                let sid = format!("seed-yr-wt-{wt_n:05}");
                wt_n += 1;
                sqlx::query(
                    "INSERT OR IGNORE INTO work_time_session
                     (id, staff_id, started_at, ended_at, status, auto_recorded, pause_minutes)
                     VALUES (?1,?2,?3,?4,'ENDED',1,?5)",
                )
                .bind(&sid)
                .bind(staff)
                .bind(format!("{wt_day} {start_h:02}:{:02}:00", mix(wt_n) % 20))
                .bind(format!("{wt_day} {end_h:02}:{:02}:00", mix(wt_n + 3) % 40))
                .bind(20i64 + (mix(wt_n) % 40) as i64)
                .execute(&mut *tx)
                .await
                .map_err(AppError::Database)?;
            }
        }
        wt_day += Duration::days(1);
    }

    tx.commit().await.map_err(AppError::Database)?;

    tracing::info!(
        patients = scale.patients,
        treatments = scale.treatments,
        examinations = scale.examinations,
        appointments = scale.appointments,
        prescriptions = scale.prescriptions,
        certificates = scale.certificates,
        cash_flow_eur = cash_flow,
        catalog = catalog_n,
        "demo year seed v3 counts"
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection;

    #[tokio::test]
    async fn year_volume_smoke_scale_fills_tables() {
        let pool = connection::test_memory_pool().await.expect("memory pool");
        connection::run_migrations(&pool)
            .await
            .expect("migrations + base demo seed");

        seed_year_volume(&pool, Scale::smoke())
            .await
            .expect("year volume smoke");

        let patients: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM patient WHERE id LIKE 'seed-yr-pat-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let treatments: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM treatment WHERE id LIKE 'seed-yr-bh-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let examinations: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM examination WHERE id LIKE 'seed-yr-un-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let catalog: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM treatment_catalog WHERE id LIKE 'seed-yr-kat-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let prescriptions: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM prescription WHERE id LIKE 'seed-yr-rx-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let certificates: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM certificate WHERE id LIKE 'seed-yr-att-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        let staff: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM staff WHERE id IN ('seed-physician-001','seed-rez-001','seed-yr-rez-002','seed-yr-rez-003','seed-yr-rez-004')",
        )
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(patients.0, 12);
        assert_eq!(treatments.0, 20);
        assert_eq!(examinations.0, 15);
        assert_eq!(prescriptions.0, 8);
        assert_eq!(certificates.0, 10);
        assert!(catalog.0 >= 50, "catalog={}", catalog.0);
        assert_eq!(staff.0, 5);
    }
}
