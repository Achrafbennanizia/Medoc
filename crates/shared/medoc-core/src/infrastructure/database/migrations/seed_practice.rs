//! Practice master-data demo seed — Settings, Administration hubs, planning, finance tools.
//!
//! Runs with `MEDOC_DEV_SEED=1` / `--dev-seed` only (never under `cfg!(test)` via the
//! public entry). Idempotent: `migration.demo_seed.practice_v1`.

use chrono::{Datelike, Duration, Local};
use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

const PRACTICE_SEED_KV_KEY: &str = "migration.demo_seed.practice_v1";
const PHYSICIAN_ID: &str = "seed-physician-001";
const RECEPTION_ID: &str = "seed-rez-001";

fn should_run() -> bool {
    !cfg!(test)
        && (std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
            || std::env::args().any(|a| a == "--dev-seed"))
}

async fn already_applied(pool: &SqlitePool) -> Result<bool, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(PRACTICE_SEED_KV_KEY)
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
    .bind(PRACTICE_SEED_KV_KEY)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn upsert_kv(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn run_demo_practice_seed_if_needed(pool: &SqlitePool) -> Result<(), AppError> {
    if !should_run() {
        return Ok(());
    }
    if already_applied(pool).await? {
        return Ok(());
    }
    tracing::info!("demo practice seed: filling practice master data");
    seed_practice_master(pool).await?;
    mark_applied(pool).await?;
    tracing::info!("demo practice seed: done");
    Ok(())
}

/// Direct entry for tests (bypasses env / idempotency gate).
#[cfg(test)]
pub(crate) async fn seed_practice_master_for_test(pool: &SqlitePool) -> Result<(), AppError> {
    seed_practice_master(pool).await
}

async fn seed_practice_master(pool: &SqlitePool) -> Result<(), AppError> {
    let today = Local::now().date_naive();

    // --- Practice profile (Settings → Practice / invoice letterhead) ---
    let practice_json = r#"{
  "name": "MeDoc Demo Dental Practice",
  "addr": "Am Markt 12\n28195 Bremen",
  "kv_number": "01-234567",
  "opening_hours": "Mon–Thu 08:00–17:00, Fri 08:00–15:00",
  "phone": "+49 421 555 0100",
  "fax": "+49 421 555 0101",
  "email": "info@medoc-demo-practice.de",
  "web": "www.medoc-demo-practice.de",
  "tax_number": "60/123/45678",
  "vat_id": "DE123456789",
  "clinician_name": "Dr. Ahmed R.",
  "professional_title": "Dentist",
  "zanr": "123456789",
  "bsnr": "987654321",
  "lanr": "123456789",
  "bank_iban": "DE89 3704 0044 0532 0130 00",
  "bank_bic": "COBADEFFXXX",
  "bank_name": "Commerzbank Bremen",
  "account_holder": "MeDoc Demo Dental Practice",
  "chamber": "Zahnärztekammer Bremen",
  "kzv": "KZV Bremen",
  "payment_terms_days": 14,
  "vat_exemption_notice": "VAT-exempt under § 4 No. 14 UStG",
  "emergency_phone": "+49 421 555 0199"
}"#;
    upsert_kv(pool, "invoice.practice.v1", practice_json).await?;

    // Tiny 1×1 PNG (transparent) so logo slot is non-empty.
    let logo_json = r#"{"mime":"image/png","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}"#;
    upsert_kv(pool, "practice.logo.v1", logo_json).await?;

    let closures = format!(
        r#"[
    {{"id":"seed-closure-01","date":"{}","mode":"FULL_DAY","reason":"Practice holiday"}},
    {{"id":"seed-closure-02","date":"{}","mode":"CUSTOM","periods":[{{"from":"08:00","to":"12:00"}}],"reason":"Staff training (morning)"}},
    {{"id":"seed-closure-03","date":"{}","mode":"FULL_DAY","reason":"Bridge day"}}
  ]"#,
        (today + Duration::days(21)).format("%Y-%m-%d"),
        (today + Duration::days(35)).format("%Y-%m-%d"),
        (today + Duration::days(60)).format("%Y-%m-%d"),
    );

    let work_hours = format!(
        r#"{{
  "plan": {{
    "mo": {{"active": true, "segments": [{{"from": "08:00", "to": "12:30"}}, {{"from": "13:30", "to": "17:00"}}]}},
    "di": {{"active": true, "segments": [{{"from": "08:00", "to": "12:30"}}, {{"from": "13:30", "to": "17:00"}}]}},
    "mi": {{"active": true, "segments": [{{"from": "08:00", "to": "12:30"}}, {{"from": "13:30", "to": "17:00"}}]}},
    "do": {{"active": true, "segments": [{{"from": "08:00", "to": "12:30"}}, {{"from": "13:30", "to": "17:00"}}]}},
    "fr": {{"active": true, "segments": [{{"from": "08:00", "to": "15:00"}}]}},
    "sa": {{"active": false, "segments": [{{"from": "09:00", "to": "13:00"}}]}},
    "so": {{"active": false, "segments": [{{"from": "09:00", "to": "13:00"}}]}}
  }},
  "breakFrom": "12:30",
  "breakUntil": "13:30",
  "slotMin": "20",
  "closures": {closures},
  "defaultPhysicianId": "{PHYSICIAN_ID}",
  "physicianSchedules": {{
    "{PHYSICIAN_ID}": {{
      "plan": {{
        "mo": {{"active": true, "segments": [{{"from": "08:00", "to": "17:00"}}]}},
        "di": {{"active": true, "segments": [{{"from": "08:00", "to": "17:00"}}]}},
        "mi": {{"active": true, "segments": [{{"from": "08:00", "to": "17:00"}}]}},
        "do": {{"active": true, "segments": [{{"from": "08:00", "to": "17:00"}}]}},
        "fr": {{"active": true, "segments": [{{"from": "08:00", "to": "15:00"}}]}},
        "sa": {{"active": false, "segments": [{{"from": "09:00", "to": "13:00"}}]}},
        "so": {{"active": false, "segments": [{{"from": "09:00", "to": "13:00"}}]}}
      }},
      "breakFrom": "12:30",
      "breakUntil": "13:30",
      "slotMin": "20"
    }}
  }}
}}"#
    );
    upsert_kv(pool, "practice.work_hours.v1", &work_hours).await?;
    upsert_kv(pool, "practice.blockedTimes.v1", &closures).await?;

    let prefs = r#"{
  "defaultMode": "modal",
  "areas": {
    "patient_chart_patient_delete": "modal",
    "patient_chart_payment_edit": "inline"
  }
}"#;
    upsert_kv(pool, "practice.preferences.v1", prefs).await?;

    let appt_prefs = r##"{
  "bufferMinutes": 10,
  "reminderHours": 24,
  "noShowFollowUpDays": 2,
  "monthCalendarPatientLoad": {
    "fewMax": 4,
    "mediumMax": 10,
    "colorFew": "#22C55E",
    "colorMedium": "#EAB308",
    "colorHigh": "#EF4444"
  }
}"##;
    upsert_kv(pool, "practice.preferences-appointment.v1", appt_prefs).await?;

    // --- Absences (work-days / vacation) ---
    let absences = [
        (
            "seed-abs-01",
            "Vacation",
            "Summer leave",
            (today + Duration::days(40)).to_string(),
            (today + Duration::days(54)).to_string(),
            None,
            None,
        ),
        (
            "seed-abs-02",
            "Training",
            "Continuing education",
            (today + Duration::days(12)).to_string(),
            (today + Duration::days(12)).to_string(),
            Some("08:00"),
            Some("16:00"),
        ),
        (
            "seed-abs-03",
            "Sick leave",
            "Staff coverage",
            (today - Duration::days(5)).to_string(),
            (today - Duration::days(3)).to_string(),
            None,
            None,
        ),
        (
            "seed-abs-04",
            "Public holiday",
            "Regional holiday",
            (today + Duration::days(90)).to_string(),
            (today + Duration::days(90)).to_string(),
            None,
            None,
        ),
    ];
    for (id, kind, comment, from, to, ft, tt) in absences {
        sqlx::query(
            "INSERT OR IGNORE INTO absence
             (id, kind, comment, from_day, to_day, from_time, to_time)
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
        )
        .bind(id)
        .bind(kind)
        .bind(comment)
        .bind(from)
        .bind(to)
        .bind(ft)
        .bind(tt)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Richer product inventory (incl. low stock) ---
    sqlx::query(
        "INSERT OR IGNORE INTO product (id, name, description, category, price, stock, min_stock, active) VALUES
         ('seed-prac-prod-01','Composite Filtek A2','Capsule A2','Filling material',48.5,18,6,1),
         ('seed-prac-prod-02','Composite Filtek A3','Capsule A3','Filling material',48.5,3,6,1),
         ('seed-prac-prod-03','Nitrile gloves S','Box 100','Consumables',9.9,2,10,1),
         ('seed-prac-prod-04','Nitrile gloves L','Box 100','Consumables',9.9,22,10,1),
         ('seed-prac-prod-05','Ultracain DS forte','Ampoules','Anaesthesia',1.8,40,15,1),
         ('seed-prac-prod-06','Gutta-percha points','Assorted','Endodontics',22.0,8,5,1),
         ('seed-prac-prod-07','Temporary cement','Temp-Bond','Prosthodontics',16.5,1,4,1),
         ('seed-prac-prod-08','Alginate bags','Impression','Lab',12.0,14,5,1),
         ('seed-prac-prod-09','Sterile gauze','Pack 100','Surgery',7.5,0,8,1),
         ('seed-prac-prod-10','Mask FFP2','Box 20','Hygiene',14.0,6,12,1),
         ('seed-prac-prod-11','Mouthwash CHX','Bottle','Prevention',8.9,25,5,1),
         ('seed-prac-prod-12','Matrix rings','Set','Filling material',35.0,4,3,1)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // --- Order masters ---
    sqlx::query(
        "INSERT OR IGNORE INTO supplier_master (id, name, sort_order, active) VALUES
         ('seed-sup-01','Henry Schein Dental',10,1),
         ('seed-sup-02','Pluradent',20,1),
         ('seed-sup-03','Speiko',30,1),
         ('seed-sup-04','Septodont',40,1),
         ('seed-sup-05','Voco',50,1)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "INSERT OR IGNORE INTO pharma_consultant_master (id, name, sort_order, active) VALUES
         ('seed-pc-01','Ms Berger',10,1),
         ('seed-pc-02','Mr Klose',20,1),
         ('seed-pc-03','Ms Vogel',30,1),
         ('seed-pc-04','Mr Brand',40,1)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "INSERT OR IGNORE INTO supplier_pharma_template
         (id, supplier_id, pharma_consultant_id, product_id, sort_order, active) VALUES
         ('seed-spt-01','seed-sup-01','seed-pc-01','seed-prac-prod-01',10,1),
         ('seed-spt-02','seed-sup-01','seed-pc-01','seed-prac-prod-02',20,1),
         ('seed-spt-03','seed-sup-02','seed-pc-02','seed-prac-prod-03',10,1),
         ('seed-spt-04','seed-sup-02','seed-pc-02','seed-prac-prod-04',20,1),
         ('seed-spt-05','seed-sup-04','seed-pc-03','seed-prac-prod-05',10,1),
         ('seed-spt-06','seed-sup-03','seed-pc-04','seed-prac-prod-06',10,1),
         ('seed-spt-07','seed-sup-05','seed-pc-01','seed-prac-prod-11',10,1)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // --- Contracts (ongoing costs) ---
    let c_from = (today - Duration::days(200)).to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO contract
         (id, designation, partner, amount, interval, unlimited, period_from, period_until, created_at, document_path)
         VALUES
         ('seed-ctr-01','Practice rent','Immobilien Bremen GmbH',2850.0,'MONTH',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-02','Equipment lease — CBCT','Siemens Healthineers',890.0,'MONTH',0,?1,?2,datetime('now','localtime'),NULL),
         ('seed-ctr-03','Liability insurance','HDI Versicherung',210.0,'MONTH',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-04','IT / MeDoc support','MeDoc Support',149.0,'MONTH',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-05','Waste disposal (medical)','Remondis',65.0,'MONTH',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-06','Sterilizer maintenance','MELAG Service',480.0,'YEAR',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-07','Phone / internet','Telekom',79.0,'MONTH',1,?1,NULL,datetime('now','localtime'),NULL),
         ('seed-ctr-08','Cleaning service','CleanPro GmbH',620.0,'MONTH',0,?1,?3,datetime('now','localtime'),NULL)",
    )
    .bind(&c_from)
    .bind((today + Duration::days(500)).to_string())
    .bind((today + Duration::days(90)).to_string())
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // --- Document templates (Rx / certificate masters) ---
    // Prefer English kinds; fall back to legacy CHECK values if needed.
    let tpl_ok = sqlx::query(
        "INSERT OR IGNORE INTO document_template (id, kind, title, payload) VALUES
         ('seed-tpl-rx-01','PRESCRIPTION','Standard antibiotics',
          '{\"version\":1,\"items\":[{\"medication\":\"Amoxicillin 1000mg\",\"dosage\":\"1-0-1\",\"duration\":\"7 days\",\"instructions\":\"After meals\"}]}'),
         ('seed-tpl-rx-02','PRESCRIPTION','Pain relief pack',
          '{\"version\":1,\"items\":[{\"medication\":\"Ibuprofen 600mg\",\"dosage\":\"1-1-1 as needed\",\"duration\":\"5 days\",\"instructions\":\"Max 3/day\"}]}'),
         ('seed-tpl-att-01','CERTIFICATE','Sick leave 3 days',
          '{\"version\":1,\"kind\":\"SICK_LEAVE\",\"body\":\"Patient is unfit for work after dental surgery.\"}'),
         ('seed-tpl-att-02','CERTIFICATE','Treatment confirmation',
          '{\"version\":1,\"kind\":\"TREATMENT_CONFIRMATION\",\"body\":\"Confirmation of dental treatment provided.\"}')",
    )
    .execute(pool)
    .await;
    if tpl_ok.is_err() {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO document_template (id, kind, title, payload) VALUES
             ('seed-tpl-rx-01','REZEPT','Standard antibiotics','{\"version\":1}'),
             ('seed-tpl-rx-02','REZEPT','Pain relief pack','{\"version\":1}'),
             ('seed-tpl-att-01','ATTEST','Sick leave 3 days','{\"version\":1}'),
             ('seed-tpl-att-02','ATTEST','Treatment confirmation','{\"version\":1}')",
        )
        .execute(pool)
        .await;
    }

    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    sqlx::query(
        "INSERT OR IGNORE INTO document_template_user
         (id, kind, name, payload, is_default, created_by, created_at, updated_at)
         VALUES
         ('seed-dtu-inv-01','invoice','Default invoice layout','{\"version\":1,\"margins\":\"standard\"}',1,?1,?2,?2),
         ('seed-dtu-rx-01','prescription','Default prescription layout','{\"version\":1}',1,?1,?2,?2),
         ('seed-dtu-att-01','certificate','Default certificate layout','{\"version\":1}',1,?1,?2,?2),
         ('seed-dtu-rcp-01','receipt','Default receipt layout','{\"version\":1}',1,?1,?2,?2)",
    )
    .bind(PHYSICIAN_ID)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // --- Day-close protocols (recent weekdays) ---
    for i in 0..12i64 {
        let d = today - Duration::days(i * 2 + 1);
        if d.weekday().number_from_monday() > 5 {
            continue;
        }
        let cash = 180.0 + (i as f64) * 37.5;
        let income = 920.0 + (i as f64) * 110.0;
        let counted = cash + if i % 3 == 0 { 0.0 } else { -2.5 };
        sqlx::query(
            "INSERT OR IGNORE INTO day_close_protocol
             (id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
              cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note, recorded_at)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,datetime(?2||' 18:05:00'))",
        )
        .bind(format!("seed-dc-{i:02}"))
        .bind(d.to_string())
        .bind(counted)
        .bind(cash)
        .bind(income)
        .bind(counted - cash)
        .bind(i32::from((counted - cash).abs() < 0.01))
        .bind(8i64 + i)
        .bind(6i64 + (i % 3))
        .bind(i32::from(i % 4 != 0))
        .bind(if i % 3 == 0 {
            "Balanced day close"
        } else {
            "Minor cash variance noted"
        })
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Balance sheet snapshots ---
    for (i, (period, label, income, expense)) in [
        ("2025-Q4", "Q4 2025", 128_500_00i64, 74_200_00i64),
        ("2026-Q1", "Q1 2026", 141_200_00, 81_050_00),
        ("2026-YTD", "Year to date", 265_000_00, 152_400_00),
        ("2026-04", "April snapshot", 48_900_00, 27_300_00),
    ]
    .into_iter()
    .enumerate()
    {
        let bal = income - expense;
        let payload = format!(
            r#"{{"period":"{period}","income_eur":{},"expenses_eur":{},"note":"Demo balance sheet"}}"#,
            income as f64 / 100.0,
            expense as f64 / 100.0
        );
        sqlx::query(
            "INSERT OR IGNORE INTO balance_sheet_snapshot
             (id, created_by, period, kind, label, income_cents, expenses_cents, balance_cents, payload, created_at)
             VALUES (?1,?2,?3,'MONTHLY',?4,?5,?6,?7,?8,datetime('now','localtime',?9))",
        )
        .bind(format!("seed-bs-{i:02}"))
        .bind(PHYSICIAN_ID)
        .bind(period)
        .bind(label)
        .bind(income)
        .bind(expense)
        .bind(bal)
        .bind(&payload)
        .bind(format!("-{} day", (3 - i as i64) * 25))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Feedback ---
    sqlx::query(
        "INSERT OR IGNORE INTO feedback
         (id, user_id, category, subject, message, reference, status) VALUES
         ('seed-fb-01',?1,'feedback','Waiting room chairs','Patients mentioned the chairs feel worn.','front-desk','OPEN'),
         ('seed-fb-02',?1,'technical','Printer jam room 2','Label printer jammed twice this week.','IT','IN_PROGRESS'),
         ('seed-fb-03',?2,'vigilance','Allergy flag missed','Please double-check latex allergy banners.','clinical','DONE'),
         ('seed-fb-04',?2,'feedback','Online booking wish','Patients ask for online appointment booking.','product','OPEN')",
    )
    .bind(PHYSICIAN_ID)
    .bind(RECEPTION_ID)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // --- Practice tickets + notifications ---
    // Prefer an existing seeded patient if present.
    let patient_id: Option<(String,)> =
        sqlx::query_as("SELECT id FROM patient WHERE id LIKE 'seed-pat-%' OR id LIKE 'seed-yr-pat-%' ORDER BY id LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    if let Some((pid,)) = patient_id {
        for (i, (body, status)) in [
            ("Please call patient about outstanding invoice.", "OPEN"),
            ("Chart ready for physician validation.", "IN_PROGRESS"),
            ("Recall reminder sent — waiting confirmation.", "DONE"),
            ("Insurance form needs signature at front desk.", "OPEN"),
            ("Post-op check scheduled — confirm material stock.", "DONE"),
        ]
        .into_iter()
        .enumerate()
        {
            sqlx::query(
                "INSERT OR IGNORE INTO practice_ticket
                 (id, patient_id, from_user_id, to_physician_id, body, status, created_at, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6,datetime('now','localtime',?7),datetime('now','localtime',?7))",
            )
            .bind(format!("seed-ptkt-{i:02}"))
            .bind(&pid)
            .bind(RECEPTION_ID)
            .bind(PHYSICIAN_ID)
            .bind(body)
            .bind(status)
            .bind(format!("-{} hour", i * 6 + 1))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        }

        sqlx::query(
            "INSERT OR IGNORE INTO invoice_document
             (id, patient_id, document_number, payload_json, total_cents, created_at, created_by)
             VALUES
             ('seed-invdoc-01',?1,'INV-DEMO-1001',?2,12900,datetime('now','localtime','-10 day'),?3),
             ('seed-invdoc-02',?1,'INV-DEMO-1002',?4,9900,datetime('now','localtime','-3 day'),?3)",
        )
        .bind(&pid)
        .bind(r#"{"lines":[{"desc":"Composite filling","cents":12900}],"currency":"EUR"}"#)
        .bind(PHYSICIAN_ID)
        .bind(r#"{"lines":[{"desc":"Professional cleaning","cents":9900}],"currency":"EUR"}"#)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

        sqlx::query(
            "INSERT OR IGNORE INTO invoice_document_audit
             (id, document_id, event, user_id, payload_excerpt)
             VALUES
             ('seed-inv-aud-01','seed-invdoc-01','ISSUED',?1,'Demo invoice issued'),
             ('seed-inv-aud-02','seed-invdoc-02','ISSUED',?1,'Demo invoice issued')",
        )
        .bind(PHYSICIAN_ID)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    for (i, (uid, kind, title, body, read)) in [
        (
            PHYSICIAN_ID,
            "PRACTICE_TASK",
            "Billing follow-up",
            "Open payments awaiting collection.",
            false,
        ),
        (
            PHYSICIAN_ID,
            "TICKET",
            "New practice ticket",
            "Reception sent a chart validation request.",
            false,
        ),
        (
            RECEPTION_ID,
            "APPOINTMENT",
            "Tomorrow’s schedule",
            "12 appointments confirmed for tomorrow.",
            true,
        ),
        (
            RECEPTION_ID,
            "STOCK",
            "Low stock alert",
            "Nitrile gloves S and sterile gauze below minimum.",
            false,
        ),
        (
            PHYSICIAN_ID,
            "SYSTEM",
            "Day close reminder",
            "Please complete yesterday’s cash reconciliation.",
            true,
        ),
    ]
    .into_iter()
    .enumerate()
    {
        sqlx::query(
            "INSERT OR IGNORE INTO in_app_notification
             (id, user_id, kind, title, body, payload_json, read_at, created_at)
             VALUES (?1,?2,?3,?4,?5,'{}',?6,datetime('now','localtime',?7))",
        )
        .bind(format!("seed-notif-{i:02}"))
        .bind(uid)
        .bind(kind)
        .bind(title)
        .bind(body)
        .bind(if read {
            Some(Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
        } else {
            None
        })
        .bind(format!("-{} hour", i * 3 + 2))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    // --- Work-time preferences + sample sick-leave certificate ---
    for sid in [
        PHYSICIAN_ID,
        RECEPTION_ID,
        "seed-yr-rez-002",
        "seed-yr-rez-003",
        "seed-yr-rez-004",
    ] {
        let _ = sqlx::query(
            "INSERT OR IGNORE INTO work_time_preference
             (staff_id, focus_mode, auto_record_on_login, auto_record_on_logout)
             VALUES (?1,?2,?3,?4)",
        )
        .bind(sid)
        .bind(i32::from(sid == PHYSICIAN_ID))
        .bind(1i32)
        .bind(1i32)
        .execute(pool)
        .await;
    }

    let sl_from = (today - Duration::days(14)).to_string();
    let sl_to = (today - Duration::days(12)).to_string();
    let _ = sqlx::query(
        "INSERT OR IGNORE INTO sick_leave_certificate
         (id, staff_id, note, document_ref, date_from, date_to, start_min, end_min, status, created_by, created_at)
         VALUES ('seed-slc-01',?1,'Short illness','demo-sl-ref-01',?2,?3,0,1440,'ENDED',?4,datetime('now','localtime','-12 day'))",
    )
    .bind(RECEPTION_ID)
    .bind(&sl_from)
    .bind(&sl_to)
    .bind(PHYSICIAN_ID)
    .execute(pool)
    .await;

    let _ = sqlx::query(
        "INSERT OR IGNORE INTO work_plan_adjustment
         (id, source, source_id, staff_id, payload_json, active, created_at)
         VALUES ('seed-wpa-01','sick_leave_certificate','seed-slc-01',?1,
                 '{\"blocked\":true,\"note\":\"Demo sick-leave adjustment\"}',0,datetime('now','localtime','-12 day'))",
    )
    .bind(RECEPTION_ID)
    .execute(pool)
    .await;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::infrastructure::database::connection;

    #[tokio::test]
    async fn practice_seed_fills_profile_and_admin_tables() {
        let pool = connection::test_memory_pool().await.expect("memory pool");
        connection::run_migrations(&pool).await.expect("migrations");

        seed_practice_master_for_test(&pool)
            .await
            .expect("practice seed");

        let practice: (String,) =
            sqlx::query_as("SELECT value FROM app_kv WHERE key = 'invoice.practice.v1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(practice.0.contains("MeDoc Demo Dental Practice"));
        assert!(practice.0.contains("zanr"));

        let hours: (String,) =
            sqlx::query_as("SELECT value FROM app_kv WHERE key = 'practice.work_hours.v1'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(hours.0.contains("closures"));

        let products: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM product WHERE id LIKE 'seed-prac-prod-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(products.0 >= 10);

        let contracts: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM contract WHERE id LIKE 'seed-ctr-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(contracts.0 >= 6);

        let day_closes: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM day_close_protocol WHERE id LIKE 'seed-dc-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert!(day_closes.0 >= 5);

        let suppliers: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM supplier_master WHERE id LIKE 'seed-sup-%'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(suppliers.0, 5);
    }
}
