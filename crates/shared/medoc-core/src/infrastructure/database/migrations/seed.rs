//! Demo seed data and post-migration bootstrap (brute-force schema, optional dev seed).

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

fn should_run_demo_seed() -> bool {
    cfg!(test)
        || std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
        || std::env::args().any(|a| a == "--dev-seed")
}

const DEMO_SEED_KV_KEY: &str = "migration.demo_seed.v1";

async fn demo_seed_already_applied(pool: &SqlitePool) -> Result<bool, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
            .bind(DEMO_SEED_KV_KEY)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(row.is_some())
}

async fn mark_demo_seed_applied(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, '1', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
    )
    .bind(DEMO_SEED_KV_KEY)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn run_post_migration_seed(pool: &SqlitePool) -> Result<(), AppError> {
    crate::infrastructure::database::brute_force_repo::ensure_schema(pool).await?;
    if should_run_demo_seed() {
        if !demo_seed_already_applied(pool).await? {
            seed_demo_data(pool).await?;
            mark_demo_seed_applied(pool).await?;
        }
        // Year-long volume is separate / idempotent so existing demo DBs still receive it.
        super::seed_year::run_demo_year_volume_if_needed(pool).await?;
        // Practice master data (Settings, admin hubs, planning, finance tools).
        super::seed_practice::run_demo_practice_seed_if_needed(pool).await?;
    }
    Ok(())
}

async fn seed_demo_data(pool: &SqlitePool) -> Result<(), AppError> {
    let patient_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
        .fetch_one(pool)
        .await?;
    if patient_count.0 == 0 {
        sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, status) VALUES
            ('seed-pat-001','Lena Hoffmann','1990-04-12','FEMALE','AOK-1000001','+49 151 1234567','lena.hoffmann@medoc-demo.de','Rosenweg 4, 28195 Bremen','NEW'),
            ('seed-pat-002','Mert Yilmaz','1984-09-03','MALE','TK-1000002','+49 152 4567890','mert.yilmaz@medoc-demo.de','Wiesenstr. 8, 28197 Bremen','ACTIVE'),
            ('seed-pat-003','Sofia Kruger','2001-01-18','FEMALE','BKK-1000003','+49 160 7788990','sofia.kruger@medoc-demo.de','Neustadtwall 12, 28199 Bremen','VALIDATED'),
            ('seed-pat-004','Noah Becker','1976-11-27','MALE','DAK-1000004','+49 170 1002003',NULL,'Parkallee 2, 28209 Bremen','READONLY'),
            ('seed-pat-005','Aylin Demir','1996-07-09','DIVERSE','IKK-1000005','+49 172 8899001','aylin.demir@medoc-demo.de','Am Markt 15, 28195 Bremen','ACTIVE')",
        )
        .execute(pool)
        .await?;
    }
    // Ensure FK-referenced demo patients exist even on non-empty databases.
    // Inserted before dependents (anamnesis_form, charts, etc.) to avoid FK
    // violations when SQLite has `PRAGMA foreign_keys = ON` (e.g. tests).
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, status) VALUES
        ('seed-pat-001','Lena Hoffmann','1990-04-12','FEMALE','AOK-1000001','+49 151 1234567','lena.hoffmann@medoc-demo.de','Rosenweg 4, 28195 Bremen','NEW'),
        ('seed-pat-002','Mert Yilmaz','1984-09-03','MALE','TK-1000002','+49 152 4567890','mert.yilmaz@medoc-demo.de','Wiesenstr. 8, 28197 Bremen','ACTIVE'),
        ('seed-pat-003','Sofia Kruger','2001-01-18','FEMALE','BKK-1000003','+49 160 7788990','sofia.kruger@medoc-demo.de','Neustadtwall 12, 28199 Bremen','VALIDATED'),
        ('seed-pat-004','Noah Becker','1976-11-27','MALE','DAK-1000004','+49 170 1002003',NULL,'Parkallee 2, 28209 Bremen','READONLY'),
        ('seed-pat-005','Aylin Demir','1996-07-09','DIVERSE','IKK-1000005','+49 172 8899001','aylin.demir@medoc-demo.de','Am Markt 15, 28195 Bremen','ACTIVE'),
        ('seed-pat-006','Mia Schneider','1993-03-21','FEMALE','AOK-1000006','+49 171 1112223','mia.schneider@medoc-demo.de','Am Wall 3, 28195 Bremen','NEW'),
        ('seed-pat-007','Jonas Braun','1988-12-02','MALE','TK-1000007','+49 171 4445556','jonas.braun@medoc-demo.de','Langenstr. 44, 28195 Bremen','ACTIVE'),
        ('seed-pat-008','Elif Kaya','1979-06-15','FEMALE','BKK-1000008','+49 171 7778889','elif.kaya@medoc-demo.de','Sielwall 9, 28203 Bremen','VALIDATED')",
    )
    .execute(pool)
    .await?;

    let hash = bcrypt::hash("password123", 12)
        .map_err(|e| AppError::Internal(format!("Seed password (bcrypt): {e}")))?;
    // TODO(deferred-security): seed-physician-001 exceeds MVP 1-PHYSICIAN quota — re-enable with todos-deferred-security-features.md
    // sqlx::query(
    //     "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, activity_area, specialty, phone) VALUES
    //     ('seed-physician-001', 'Dr. Sarah Klein', 'sarah@practice.de', ?1, 'PHYSICIAN', 'Oral surgery', 'Oral surgery', '+49 421 900100')",
    // )
    // .bind(&hash)
    // .execute(pool)
    // .await?;
    // TODO(deferred-roles): seed-ctl-001 (TAX_ADVISOR), seed-pharma-001 (PHARMA_CONSULTANT) — todos-deferred-roles.md
    // Ensure FK-referenced demo staff exists even when staff already had rows.
    sqlx::query(
        "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, specialty) VALUES
        ('seed-physician-001', 'Dr. Ahmed R.', 'ahmed@practice.de', ?1, 'PHYSICIAN', 'Dentistry'),
        ('seed-rez-001', 'Aya M.', 'aya@practice.de', ?1, 'RECEPTION', NULL)",
    )
    .bind(&hash)
    .execute(pool)
    .await?;

    let chart_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient_chart")
        .fetch_one(pool)
        .await?;
    if chart_count.0 == 0 {
        sqlx::query(
            "INSERT INTO patient_chart (id, patient_id, status, diagnosis, findings) VALUES
            ('seed-chart-001','seed-pat-001','DRAFT','Initial caries diagnosis','Mild gingivitis, follow-up needed'),
            ('seed-chart-002','seed-pat-002','IN_PROGRESS','Periodontitis stage I','Pocket depths documented'),
            ('seed-chart-003','seed-pat-003','VALIDATED','Post-op follow-up','Healing unremarkable'),
            ('seed-chart-004','seed-pat-004','READONLY','Completed prosthodontics','Long-term record archived'),
            ('seed-chart-005','seed-pat-005','IN_PROGRESS','TMD workup','Clicking on the right')",
        )
        .execute(pool)
        .await?;
    }
    // Keep demo records referenced by downstream seeds (`dental_finding`, `examination`, `treatment`).
    // Includes 006-008 so subsequent FK-bearing inserts succeed under `foreign_keys = ON`.
    sqlx::query(
        "INSERT OR IGNORE INTO patient_chart (id, patient_id, status, diagnosis, findings) VALUES
        ('seed-chart-001','seed-pat-001','DRAFT','Initial caries diagnosis','Mild gingivitis, follow-up needed'),
        ('seed-chart-002','seed-pat-002','IN_PROGRESS','Periodontitis stage I','Pocket depths documented'),
        ('seed-chart-003','seed-pat-003','VALIDATED','Post-op follow-up','Healing unremarkable'),
        ('seed-chart-004','seed-pat-004','READONLY','Completed prosthodontics','Long-term record archived'),
        ('seed-chart-005','seed-pat-005','IN_PROGRESS','TMD workup','Clicking on the right'),
        ('seed-chart-006','seed-pat-006','DRAFT','Occlusal caries 26','Initial findings recorded'),
        ('seed-chart-007','seed-pat-007','IN_PROGRESS','Hypersensitivity','Desensitization planned'),
        ('seed-chart-008','seed-pat-008','VALIDATED','Periodontal maintenance','Recall program active')",
    )
    .execute(pool)
    .await?;

    // Demo-density patients + Akten must exist BEFORE downstream seeds reference
    // them via FK (anamnesis_form, dental_finding, examination, treatment, …).
    // Older seed order inserted these blocks at the end of `seed_demo_data` which
    // tripped FOREIGN KEY constraints on a fresh in-memory database (regression
    // visible via `tests/db_migrations_tests.rs`).
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, status) VALUES
        ('seed-pat-006','Mia Schneider','1993-03-21','FEMALE','AOK-1000006','+49 171 1112223','mia.schneider@medoc-demo.de','Am Wall 3, 28195 Bremen','NEW'),
        ('seed-pat-007','Jonas Braun','1988-12-02','MALE','TK-1000007','+49 171 4445556','jonas.braun@medoc-demo.de','Langenstr. 44, 28195 Bremen','ACTIVE'),
        ('seed-pat-008','Elif Kaya','1979-06-15','FEMALE','BKK-1000008','+49 171 7778889','elif.kaya@medoc-demo.de','Sielwall 9, 28203 Bremen','VALIDATED')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO patient_chart (id, patient_id, status, diagnosis, findings) VALUES
        ('seed-chart-006','seed-pat-006','DRAFT','Occlusal caries 26','Initial findings recorded'),
        ('seed-chart-007','seed-pat-007','IN_PROGRESS','Hypersensitivity','Desensitization planned'),
        ('seed-chart-008','seed-pat-008','VALIDATED','Periodontal maintenance','Recall program active')",
    )
    .execute(pool)
    .await?;

    let anam_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM anamnesis_form")
        .fetch_one(pool)
        .await?;
    if anam_count.0 == 0 {
        sqlx::query(
            "INSERT INTO anamnesis_form (id, patient_id, answers, signed) VALUES
            ('seed-anam-001','seed-pat-001','{\"allergies\":\"Keine\",\"medication\":\"Keine\"}',1),
            ('seed-anam-002','seed-pat-002','{\"allergies\":\"Penicillin\",\"medication\":\"Ibuprofen bei Bedarf\"}',1),
            ('seed-anam-003','seed-pat-003','{\"allergies\":\"Latex\",\"medication\":\"L-Thyroxin\"}',0)",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO anamnesis_form (id, patient_id, answers, signed) VALUES
        ('seed-anam-004','seed-pat-006','{\"allergies\":\"Keine bekannt\",\"medication\":\"Vitamin D\"}',1),
        ('seed-anam-005','seed-pat-007','{\"allergies\":\"Nickel\",\"medication\":\"Keine Dauermedikation\"}',0),
        ('seed-anam-006','seed-pat-008','{\"allergies\":\"Hausstaub\",\"medication\":\"Ramipril 5mg\"}',1)",
    )
    .execute(pool)
    .await?;

    let finding_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM dental_finding")
        .fetch_one(pool)
        .await?;
    if finding_count.0 == 0 {
        sqlx::query(
            "INSERT INTO dental_finding (id, chart_id, tooth_number, finding, diagnosis, notes) VALUES
            ('seed-zb-001','seed-chart-001',16,'Mesial caries','Suspected secondary caries','Radiograph recommended'),
            ('seed-zb-002','seed-chart-002',26,'Periodontal findings','Localized periodontitis','Recall in 3 months'),
            ('seed-zb-003','seed-chart-003',36,'Filling intact',NULL,'No intervention needed'),
            ('seed-zb-004','seed-chart-005',47,'Abrasion','Suspected bruxism','Consider splint therapy')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO dental_finding (id, chart_id, tooth_number, finding, diagnosis, notes) VALUES
        ('seed-zb-005','seed-chart-006',26,'Occlusal caries','Initial caries','Minimally invasive treatment recommended'),
        ('seed-zb-006','seed-chart-007',14,'Enamel crack','Suspected infraction','Review in 6 months'),
        ('seed-zb-007','seed-chart-008',37,'Periodontally stable',NULL,'Recall attended')",
    )
    .execute(pool)
    .await?;

    let examination_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM examination")
        .fetch_one(pool)
        .await?;
    if examination_count.0 == 0 {
        sqlx::query(
            "INSERT INTO examination (id, chart_id, chief_complaint, results, diagnosis) VALUES
            ('seed-un-001','seed-chart-001','Sensitivity to cold','Vitality positive, no apical findings','Reversible pulpitis'),
            ('seed-un-002','seed-chart-002','Gingival bleeding','Probing depths up to 4mm','Periodontitis stage I'),
            ('seed-un-003','seed-chart-005','TMJ clicking','Painful palpation on the right','Suspected TMD')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO examination (id, chart_id, chief_complaint, results, diagnosis) VALUES
        ('seed-un-004','seed-chart-006','Sensitive to sweets','Percussion unremarkable','Occlusal initial caries'),
        ('seed-un-005','seed-chart-007','Chewing discomfort on the left','Clinical findings without fracture signs','Dentine hypersensitivity'),
        ('seed-un-006','seed-chart-008','No acute complaints','Probing values stable','Periodontal maintenance stable')",
    )
    .execute(pool)
    .await?;

    let treatment_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM treatment")
        .fetch_one(pool)
        .await?;
    if treatment_count.0 == 0 {
        sqlx::query(
            "INSERT INTO treatment (id, chart_id, kind, description, teeth, material, notes) VALUES
            ('seed-bh-001','seed-chart-001','BEMA 13a','Composite filling placed','16','Composite A2','Polishing completed'),
            ('seed-bh-002','seed-chart-002','PZR','Professional cleaning','11,12,13,21,22,23','Airflow + Fluorid','Recall set to 6 months'),
            ('seed-bh-003','seed-chart-003','Checkup','Postoperative visual check','36','-', 'Healing as expected')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO treatment (id, chart_id, kind, description, teeth, material, notes) VALUES
        ('seed-bh-004','seed-chart-006','Fissure sealant','Sealed after isolation','26','Transparent sealant','Review in 12 months'),
        ('seed-bh-005','seed-chart-007','Desensitization','Fluoride varnish applied','14,15','Fluoride varnish','Home-care advice given'),
        ('seed-bh-006','seed-chart-008','Recall','Periodontal maintenance and motivation','37,36','Hand instruments','Bleeding index improved')",
    )
    .execute(pool)
    .await?;

    let service_item_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM service_item")
        .fetch_one(pool)
        .await?;
    if service_item_count.0 == 0 {
        sqlx::query(
            "INSERT INTO service_item (id, name, description, category, price, active) VALUES
            ('seed-lei-001','Professional cleaning','Standard cleaning including fluoride','Prevention',99.0,1),
            ('seed-lei-002','Periodontal charting','Full periodontal exam','Diagnostics',129.0,1),
            ('seed-lei-003','One-surface composite filling','Adhesive filling in posterior teeth','FillingTherapy',119.0,1),
            ('seed-lei-004','Checkup','Regular follow-up','Checkup',49.0,1),
            ('seed-lei-005','Bleaching consultation','Information and planning','Aesthetics',39.0,0)",
        )
        .execute(pool)
        .await?;
    }
    // Keep referenced service rows available for payment seeds.
    sqlx::query(
        "INSERT OR IGNORE INTO service_item (id, name, description, category, price, active) VALUES
        ('seed-lei-001','Professional cleaning','Standard cleaning including fluoride','Prevention',99.0,1),
        ('seed-lei-002','Periodontal charting','Full periodontal exam','Diagnostics',129.0,1),
        ('seed-lei-003','One-surface composite filling','Adhesive filling in posterior teeth','FillingTherapy',119.0,1),
        ('seed-lei-004','Checkup','Regular follow-up','Checkup',49.0,1)",
    )
    .execute(pool)
    .await?;

    let product_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM product")
        .fetch_one(pool)
        .await?;
    if product_count.0 == 0 {
        sqlx::query(
            "INSERT INTO product (id, name, description, category, price, stock, min_stock, active) VALUES
            ('seed-prod-001','Filtek Supreme XTE','Nanocomposite for anterior and posterior teeth','Filling material',54.9,12,6,1),
            ('seed-prod-002','Nitrile gloves M','Powder-free, 100 pcs','Consumables',9.5,4,10,1),
            ('seed-prod-003','Etch gel 37%','Phosphoric acid gel 2ml','Adhesive system',14.9,18,5,1),
            ('seed-prod-004','Mouth mirror rhodium','Sterilizable, standard size','Instruments',7.9,2,4,1),
            ('seed-prod-005','Interdental brush set','Patient pack of 6','Prevention',6.5,25,8,0)",
        )
        .execute(pool)
        .await?;
    }

    let appointment_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM appointment")
        .fetch_one(pool)
        .await?;
    if appointment_count.0 == 0 {
        sqlx::query(
            "INSERT INTO appointment (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id) VALUES
            ('seed-ter-001', date('now','localtime'), '08:30', 'FIRST_VISIT', 'CONFIRMED', 'Take anamnesis', 'Hot/cold sensitivity', 'seed-pat-001', 'seed-physician-001'),
            ('seed-ter-002', date('now','localtime'), '10:00', 'EXAMINATION', 'PLANNED', 'Record periodontal status', 'Gingival bleeding', 'seed-pat-002', 'seed-physician-001'),
            ('seed-ter-003', date('now','localtime','+1 day'), '09:15', 'TREATMENT', 'PLANNED', 'Composite filling planned', 'Pressure pain tooth 16', 'seed-pat-001', 'seed-physician-001'),
            ('seed-ter-004', date('now','localtime','+2 day'), '14:00', 'CHECKUP', 'COMPLETED', 'Post-op checkup', NULL, 'seed-pat-003', 'seed-physician-001'),
            ('seed-ter-005', date('now','localtime','-1 day'), '11:30', 'CONSULTATION', 'CANCELLED', 'Aesthetic consultation', NULL, 'seed-pat-005', 'seed-physician-001')",
        )
        .execute(pool)
        .await?;
    }

    let payment_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM payment")
        .fetch_one(pool)
        .await?;
    if payment_count.0 == 0 {
        sqlx::query(
            "INSERT INTO payment (id, patient_id, amount, payment_method, status, service_item_id, description) VALUES
            ('seed-payment-001','seed-pat-001',99.0,'CASH','PAID','seed-lei-001','Cleaning paid on the day'),
            ('seed-payment-002','seed-pat-002',129.0,'INVOICE','OUTSTANDING','seed-lei-002','Periodontal exam still outstanding'),
            ('seed-payment-003','seed-pat-003',119.0,'CARD','PARTIALLY_PAID','seed-lei-003','Deposit paid'),
            ('seed-payment-004','seed-pat-004',49.0,'BANK_TRANSFER','CANCELLED','seed-lei-004','Appointment cancelled')",
        )
        .execute(pool)
        .await?;
    }

    let prescription_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM prescription")
        .fetch_one(pool)
        .await?;
    if prescription_count.0 == 0 {
        sqlx::query(
            "INSERT INTO prescription (id, patient_id, physician_id, medication, active_ingredient, dosage, duration, instructions, status) VALUES
            ('seed-rez-001','seed-pat-002','seed-physician-001','Amoxicillin 1000mg','Amoxicillin','1-0-1','7 days','Take after meals','ISSUED'),
            ('seed-rez-002','seed-pat-003','seed-physician-001','Ibuprofen 600mg','Ibuprofen','1-1-1 as needed','5 days','Max. 3 tablets/day','ISSUED')",
        )
        .execute(pool)
        .await?;
    }

    let certificate_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM certificate")
        .fetch_one(pool)
        .await?;
    if certificate_count.0 == 0 {
        sqlx::query(
            "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until) VALUES
            ('seed-att-001','seed-pat-001','seed-physician-001','SICK_LEAVE','Patient is unfit for work after oral surgery.',date('now','localtime'),date('now','localtime','+3 day')),
            ('seed-att-002','seed-pat-005','seed-physician-001','SPORTS_EXEMPTION','Temporary sports exemption after TMJ complaints.',date('now','localtime','-1 day'),date('now','localtime','+14 day'))",
        )
        .execute(pool)
        .await?;
    }

    // Audit trail rows are created at runtime via `audit_repo::create` (HMAC chain).
    // Do not seed `audit_log` — placeholder rows with empty `hmac` break startup verification.

    // Additional demo density for UI/UX testing even on existing databases.
    sqlx::query(
        "INSERT OR IGNORE INTO service_item (id, name, description, category, price, active) VALUES
        ('seed-lei-006','Fissure sealant','Sealant on permanent molars','Prevention',69.0,1),
        ('seed-lei-007','Splint therapy consultation','Functional analysis and splint planning','Functional diagnostics',89.0,1),
        ('seed-lei-008','Endo pre-exam','Clinical exam and X-ray for endo planning','Endodontics',79.0,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO product (id, name, description, category, price, stock, min_stock, active) VALUES
        ('seed-prod-006','Fluoride varnish','5% NaF varnish for desensitization','Prevention',19.9,14,6,1),
        ('seed-prod-007','Rubber dam set','Latex-free, assorted sizes','Endodontics',29.9,9,4,1),
        ('seed-prod-008','Suture 4-0','Absorbable suture','Surgery',12.9,3,5,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO appointment (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id) VALUES
        ('seed-ter-006', date('now','localtime','+3 day'), '08:45', 'CHECKUP', 'CONFIRMED', 'Recall appointment', NULL, 'seed-pat-006', 'seed-physician-001'),
        ('seed-ter-007', date('now','localtime','+3 day'), '11:00', 'TREATMENT', 'PLANNED', 'Fissure sealant', 'Sensitivity when chewing', 'seed-pat-007', 'seed-physician-001'),
        ('seed-ter-008', date('now','localtime','+4 day'), '09:30', 'CONSULTATION', 'PLANNED', 'Splint therapy briefing', 'Morning jaw pain', 'seed-pat-008', 'seed-physician-001'),
        ('seed-ter-009', date('now','localtime','-2 day'), '15:10', 'EXAMINATION', 'NO_SHOW', 'Phone follow-up', NULL, 'seed-pat-006', 'seed-physician-001'),
        ('seed-ter-010', date('now','localtime','+5 day'), '13:40', 'FIRST_VISIT', 'PLANNED', 'New patient intake', 'Pressure pain lower right', 'seed-pat-008', 'seed-physician-001')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO payment (id, patient_id, amount, payment_method, status, service_item_id, description) VALUES
        ('seed-payment-005','seed-pat-006',69.0,'CARD','PAID','seed-lei-006','Fissure sealant completed'),
        ('seed-payment-006','seed-pat-007',89.0,'INVOICE','OUTSTANDING','seed-lei-007','Consultation still outstanding'),
        ('seed-payment-007','seed-pat-008',79.0,'BANK_TRANSFER','PARTIALLY_PAID','seed-lei-008','Partial payment received')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO prescription (id, patient_id, physician_id, medication, active_ingredient, dosage, duration, instructions, status) VALUES
        ('seed-rez-003','seed-pat-006','seed-physician-001','Chlorhexidin 0.2%','Chlorhexidin','Rinse twice daily','10 days','Do not swallow','ISSUED')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until) VALUES
        ('seed-att-003','seed-pat-007','seed-physician-001','TREATMENT_CONFIRMATION','Confirmation of dental consultation provided.',date('now','localtime'),date('now','localtime','+30 day'))",
    )
    .execute(pool)
    .await?;

    // Align demo appointments to the local calendar (older seeds used date('now') = UTC → day view looked "empty").
    sqlx::query(
        "UPDATE appointment SET date = CASE id
            WHEN 'seed-ter-001' THEN date('now','localtime')
            WHEN 'seed-ter-002' THEN date('now','localtime')
            WHEN 'seed-ter-003' THEN date('now','localtime','+1 day')
            WHEN 'seed-ter-004' THEN date('now','localtime','+2 day')
            WHEN 'seed-ter-005' THEN date('now','localtime','-1 day')
            WHEN 'seed-ter-006' THEN date('now','localtime','+3 day')
            WHEN 'seed-ter-007' THEN date('now','localtime','+3 day')
            WHEN 'seed-ter-008' THEN date('now','localtime','+4 day')
            WHEN 'seed-ter-009' THEN date('now','localtime','-2 day')
            WHEN 'seed-ter-010' THEN date('now','localtime','+5 day')
            ELSE date
        END
        WHERE id IN (
            'seed-ter-001','seed-ter-002','seed-ter-003','seed-ter-004','seed-ter-005',
            'seed-ter-006','seed-ter-007','seed-ter-008','seed-ter-009','seed-ter-010'
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO treatment_catalog (id, category, name, default_cost, sort_order, active) VALUES
        ('seed-kat-001','Checkup','Recall / checkup',49.0,10,1),
        ('seed-kat-002','Checkup','Periodontal charting',79.0,20,1),
        ('seed-kat-003','FillingTherapy','One-surface composite',119.0,30,1),
        ('seed-kat-004','FillingTherapy','Two-surface composite',149.0,40,1),
        ('seed-kat-005','Periodontology','Professional cleaning',99.0,50,1),
        ('seed-kat-006','Periodontology','Pocket depth measurement',65.0,60,1),
        ('seed-kat-007','Surgery','Tooth extraction',120.0,70,1),
        ('seed-kat-008','Surgery','Wisdom tooth removal',280.0,80,1),
        ('seed-kat-009','Surgery','Implant uncovering',95.0,90,1),
        ('seed-kat-010','Prosthodontics','Zirconia crown',890.0,100,1),
        ('seed-kat-011','Prosthodontics','Partial denture consult',55.0,110,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO treatment (id, chart_id, kind, description, teeth, material, notes, category, service_name, treatment_number, session_number, treatment_status, total_cost, appointment_required, treatment_date) VALUES
        ('seed-bh-wf-001','seed-chart-001','Surgery','Wisdom tooth removal','18',NULL,NULL,'Surgery','Wisdom tooth removal','155',4,'COMPLETED',280.0,1,'2026-01-20'),
        ('seed-bh-wf-002','seed-chart-001','Surgery','Wisdom tooth removal','18',NULL,NULL,'Surgery','Wisdom tooth removal','155',3,'COMPLETED',280.0,1,'2026-01-18'),
        ('seed-bh-wf-003','seed-chart-001','Surgery','Wisdom tooth removal','18',NULL,NULL,'Surgery','Wisdom tooth removal','155',2,'COMPLETED',280.0,1,'2026-01-15'),
        ('seed-bh-wf-004','seed-chart-001','Surgery','Wisdom tooth removal','18',NULL,NULL,'Surgery','Wisdom tooth removal','155',1,'COMPLETED',280.0,1,'2026-01-10'),
        ('seed-bh-wf-005','seed-chart-001','FillingTherapy','One-surface composite','16',NULL,NULL,'FillingTherapy','One-surface composite','143',3,'COMPLETED',119.0,0,'2026-02-01'),
        ('seed-bh-wf-006','seed-chart-001','FillingTherapy','One-surface composite','16',NULL,NULL,'FillingTherapy','One-surface composite','143',2,'COMPLETED',119.0,0,'2026-01-28'),
        ('seed-bh-wf-007','seed-chart-001','FillingTherapy','One-surface composite','16',NULL,NULL,'FillingTherapy','One-surface composite','143',1,'COMPLETED',119.0,0,'2026-01-25'),
        ('seed-bh-wf-008','seed-chart-001','Checkup','Recall / checkup','11',NULL,NULL,'Checkup','Recall / checkup','123',1,'COMPLETED',49.0,0,'2026-01-05')",
    )
    .execute(pool)
    .await?;

    let anam_demo = r#"{"version":1,"insuranceStatus":"GKV","health_insurance":"AOK Bremen / Plus","preExisting":{"chronic":"Mild asthma","previousDiagnoses":"Caries in adolescence","surgeries":"","hospital":"","mental":""},"medication":{"regular":"Vitamin D 1000 IE","dosing":"täglich morgens","self":"","missed":"","sideEffects":""},"allergies":{"medications":"Penicillin","foods":"Nuts","other":"","material":"","vaccineReactions":""}}"#;
    let _ =
        sqlx::query("UPDATE anamnesis_form SET answers = ?1 WHERE patient_id = 'seed-pat-001'")
            .bind(anam_demo)
            .execute(pool)
            .await;

    // ---------------------------------------------------------------
    // PurchaseOrders: dummy demo data so the page is populated and the
    // Statistics page has purchase_order trends to chart.
    // ---------------------------------------------------------------
    sqlx::query(
        "INSERT OR IGNORE INTO purchase_order (
            id, order_number, supplier, pharma_consultant, item, status,
            expected_on, delivered_on, quantity, unit, remark, created_by, created_at
         ) VALUES
        ('seed-best-001','B-2026-04-0001','Henry Schein Dental','Frau Berger','Filtek Supreme XTE A2','DELIVERED',
            date('now','localtime','-12 day'), date('now','localtime','-10 day'), 6, 'Syringe',
            'Standard composite restock','seed-physician-001', datetime('now','localtime','-15 day')),
        ('seed-best-002','B-2026-04-0002','Pluradent','Herr Klose','Nitrile gloves M (box of 100)','DELIVERED',
            date('now','localtime','-8 day'), date('now','localtime','-6 day'), 20, 'Pkg.',
            'Routine hygiene supplies','seed-physician-001', datetime('now','localtime','-12 day')),
        ('seed-best-003','B-2026-04-0003','Speiko','Frau Vogel','Etch gel 37%','IN_TRANSIT',
            date('now','localtime','+2 day'), NULL, 5, 'Syringe',
            'Express shipping ordered','seed-physician-001', datetime('now','localtime','-3 day')),
        ('seed-best-004','B-2026-04-0004','Komet','Herr Brand','Diamond bur set 314','OPEN',
            date('now','localtime','+7 day'), NULL, 2, 'Set',
            'Replacement for cassette OR 2','seed-physician-001', datetime('now','localtime','-2 day')),
        ('seed-best-005','B-2026-04-0005','Henry Schein Dental','Frau Berger','Mouth mirror rhodium','OPEN',
            date('now','localtime','-3 day'), NULL, 8, 'Pcs',
            'Delivery expected, call needed','seed-physician-001', datetime('now','localtime','-10 day')),
        ('seed-best-006','B-2026-04-0006','Septodont','Frau Kuhn','Anaesthetic Ultracain DS','DELIVERED',
            date('now','localtime','-25 day'), date('now','localtime','-22 day'), 50, 'Ampoule',
            'Quarterly order','seed-physician-001', datetime('now','localtime','-30 day')),
        ('seed-best-007','B-2026-04-0007','Pluradent','Herr Klose','Rubber dam set','OPEN',
            date('now','localtime','+5 day'), NULL, 3, 'Set',
            'Endo supplies','seed-physician-001', datetime('now','localtime','-1 day')),
        ('seed-best-008','B-2026-03-0011','Bisico','Frau Albers','A-silicone impression material','CANCELLED',
            NULL, NULL, 4, 'Pkg.',
            'Cancelled due to delivery delay','seed-physician-001', datetime('now','localtime','-45 day')),
        ('seed-best-009','B-2026-03-0010','Voco','Herr Schramm','Fluoride varnish 5%','DELIVERED',
            date('now','localtime','-50 day'), date('now','localtime','-47 day'), 10, 'Tube',
            'Prevention Q1','seed-physician-001', datetime('now','localtime','-55 day')),
        ('seed-best-010','B-2026-02-0007','Henry Schein Dental','Frau Berger','Suture 4-0','DELIVERED',
            date('now','localtime','-78 day'), date('now','localtime','-76 day'), 6, 'Pkg.',
            'Surgery stock','seed-physician-001', datetime('now','localtime','-82 day')),
        ('seed-best-011','B-2026-02-0004','Speiko','Frau Vogel','Sof-Lex polishing discs','DELIVERED',
            date('now','localtime','-90 day'), date('now','localtime','-88 day'), 3, 'Set',
            NULL,'seed-physician-001', datetime('now','localtime','-95 day')),
        ('seed-best-012','B-2026-01-0009','Pluradent','Herr Klose','Sterilization pouches 90×230','DELIVERED',
            date('now','localtime','-115 day'), date('now','localtime','-112 day'), 4, 'Pkg.',
            'Sterile goods restock','seed-physician-001', datetime('now','localtime','-120 day')),
        ('seed-best-013','B-2025-12-0006','Henry Schein Dental','Frau Berger','Composite Filtek Z250 A3','DELIVERED',
            date('now','localtime','-150 day'), date('now','localtime','-148 day'), 4, 'Syringe',
            NULL,'seed-physician-001', datetime('now','localtime','-155 day')),
        ('seed-best-014','B-2025-11-0003','Voco','Herr Schramm','Glass ionomer cement Fuji IX','DELIVERED',
            date('now','localtime','-180 day'), date('now','localtime','-178 day'), 2, 'Pkg.',
            NULL,'seed-physician-001', datetime('now','localtime','-185 day'))",
    )
    .execute(pool)
    .await?;

    // ---------------------------------------------------------------
    // Backdate selected demo records so monthly charts are not empty.
    // We only touch our own seed rows to avoid disturbing real data.
    // ---------------------------------------------------------------
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-200 day')
         WHERE id IN ('seed-pat-001','seed-pat-002')",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-150 day')
         WHERE id IN ('seed-pat-003')",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-110 day')
         WHERE id IN ('seed-pat-004')",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-80 day')
         WHERE id IN ('seed-pat-005')",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-50 day')
         WHERE id IN ('seed-pat-006')",
    )
    .execute(pool)
    .await;
    let _ = sqlx::query(
        "UPDATE patient SET created_at = datetime('now','localtime','-20 day')
         WHERE id IN ('seed-pat-007')",
    )
    .execute(pool)
    .await;

    // Spread demo payments so finance chart has months
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-60 day') WHERE id = 'seed-payment-001'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-95 day') WHERE id = 'seed-payment-002'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-130 day') WHERE id = 'seed-payment-003'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-165 day') WHERE id = 'seed-payment-004'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-25 day') WHERE id = 'seed-payment-005'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-15 day') WHERE id = 'seed-payment-006'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE payment SET created_at = datetime('now','localtime','-5 day') WHERE id = 'seed-payment-007'",
    ).execute(pool).await;

    // Add a few extra paid payments across past months so bar chart is denser
    sqlx::query(
        "INSERT OR IGNORE INTO payment (id, patient_id, amount, payment_method, status, service_item_id, description, created_at) VALUES
        ('seed-payment-h01','seed-pat-001',180.0,'CARD','PAID','seed-lei-003','Composite filling',datetime('now','localtime','-40 day')),
        ('seed-payment-h02','seed-pat-002',299.0,'BANK_TRANSFER','PAID','seed-lei-007','Splint consult + splint',datetime('now','localtime','-72 day')),
        ('seed-payment-h03','seed-pat-003',450.0,'CARD','PAID','seed-lei-008','Endo pre-exam + treatment',datetime('now','localtime','-105 day')),
        ('seed-payment-h04','seed-pat-004',120.0,'CASH','PAID','seed-lei-001','PZR',datetime('now','localtime','-140 day')),
        ('seed-payment-h05','seed-pat-005',79.0,'CARD','PAID','seed-lei-008','Endo consult',datetime('now','localtime','-175 day')),
        ('seed-payment-h06','seed-pat-006',49.0,'CASH','PAID','seed-lei-004','Checkup',datetime('now','localtime','-200 day')),
        ('seed-payment-h07','seed-pat-007',230.0,'BANK_TRANSFER','PAID','seed-lei-003','Composite + polish',datetime('now','localtime','-32 day')),
        ('seed-payment-h08','seed-pat-008',99.0,'CARD','PAID','seed-lei-001','Cleaning recall',datetime('now','localtime','-12 day'))",
    ).execute(pool).await?;

    // Spread some demo appointments across past months so appointments_per_month is non-empty
    sqlx::query(
        "INSERT OR IGNORE INTO appointment (id, date, time, kind, status, notes, chief_complaint, patient_id, physician_id, created_at) VALUES
        ('seed-ter-h01', date('now','localtime','-40 day'),  '09:00','EXAMINATION','COMPLETED','Routine','—','seed-pat-001','seed-physician-001', datetime('now','localtime','-40 day')),
        ('seed-ter-h02', date('now','localtime','-70 day'),  '11:00','TREATMENT','COMPLETED','Composite',NULL,'seed-pat-002','seed-physician-001', datetime('now','localtime','-70 day')),
        ('seed-ter-h03', date('now','localtime','-100 day'), '14:00','CHECKUP','COMPLETED','Recall',NULL,'seed-pat-003','seed-physician-001', datetime('now','localtime','-100 day')),
        ('seed-ter-h04', date('now','localtime','-130 day'), '08:30','CONSULTATION','COMPLETED','Schiene',NULL,'seed-pat-004','seed-physician-001', datetime('now','localtime','-130 day')),
        ('seed-ter-h05', date('now','localtime','-160 day'), '15:30','EXAMINATION','COMPLETED','PA-Status',NULL,'seed-pat-005','seed-physician-001', datetime('now','localtime','-160 day')),
        ('seed-ter-h06', date('now','localtime','-25 day'),  '10:00','CHECKUP','COMPLETED','Recall',NULL,'seed-pat-006','seed-physician-001', datetime('now','localtime','-25 day')),
        ('seed-ter-h07', date('now','localtime','-90 day'),  '13:00','TREATMENT','COMPLETED','Endo',NULL,'seed-pat-007','seed-physician-001', datetime('now','localtime','-90 day')),
        ('seed-ter-h08', date('now','localtime','-180 day'), '16:00','CONSULTATION','COMPLETED','Initial consult',NULL,'seed-pat-008','seed-physician-001', datetime('now','localtime','-180 day'))",
    ).execute(pool).await?;

    // Add treatments across months for treatment-chart
    sqlx::query(
        "INSERT OR IGNORE INTO treatment (
            id, chart_id, kind, description, teeth, material, notes,
            category, service_name, treatment_number, session_number,
            treatment_status, total_cost, appointment_required, treatment_date
        ) VALUES
        ('seed-bh-h01','seed-chart-001','Checkup','Recall','11',NULL,NULL,'Checkup','Recall','201',1,'COMPLETED',49.0,0, date('now','localtime','-30 day')),
        ('seed-bh-h02','seed-chart-002','Periodontology','PZR','—',NULL,NULL,'Periodontology','Professional cleaning','202',1,'COMPLETED',99.0,0, date('now','localtime','-65 day')),
        ('seed-bh-h03','seed-chart-003','FillingTherapy','One-surface composite','16',NULL,NULL,'FillingTherapy','One-surface composite','203',1,'COMPLETED',119.0,0, date('now','localtime','-95 day')),
        ('seed-bh-h04','seed-chart-004','Prosthodontics','Zirconia crown','21',NULL,NULL,'Prosthodontics','Zirconia crown','204',2,'COMPLETED',890.0,0, date('now','localtime','-130 day')),
        ('seed-bh-h05','seed-chart-005','Surgery','Extraction 38','38',NULL,NULL,'Surgery','Tooth extraction','205',1,'COMPLETED',120.0,0, date('now','localtime','-160 day')),
        ('seed-bh-h06','seed-chart-006','Checkup','Recall','11',NULL,NULL,'Checkup','Recall','206',1,'COMPLETED',49.0,0, date('now','localtime','-15 day')),
        ('seed-bh-h07','seed-chart-007','Periodontology','Pocket depth measurement','—',NULL,NULL,'Periodontology','Pocket depth measurement','207',1,'COMPLETED',65.0,0, date('now','localtime','-50 day')),
        ('seed-bh-h08','seed-chart-008','FillingTherapy','Two-surface composite','17',NULL,NULL,'FillingTherapy','Two-surface composite','208',1,'COMPLETED',149.0,0, date('now','localtime','-110 day'))",
    ).execute(pool).await?;

    Ok(())
}
