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

    // 3b. Moroccan price level: the demo seed prices in euro. Once per database (guarded).
    let scaled: Option<(String,)> =
        sqlx::query_as("SELECT value FROM app_kv WHERE key = 'migration.showcase.money.v1'")
            .fetch_optional(&mut *tx)
            .await?;
    if scaled.is_none() {
        for sql in [
            "UPDATE payment SET amount = ROUND(amount * 6), amount_expected = ROUND(amount_expected * 6) WHERE id NOT LIKE 'seed-sc-%'",
            "UPDATE examination SET total_cost = ROUND(total_cost * 6)",
            "UPDATE treatment SET total_cost = ROUND(total_cost * 6)",
            "UPDATE service_item SET price = ROUND(price * 6)",
            "UPDATE product SET price = ROUND(price * 6)",
            "UPDATE treatment_catalog SET default_cost = ROUND(default_cost * 6)",
            "UPDATE practice_task SET total_cost = ROUND(total_cost * 6)",
            "UPDATE purchase_order SET total_amount = ROUND(total_amount * 6)",
            "UPDATE contract SET amount = ROUND(amount * 6)",
        ] {
            // A table missing in an older schema is skipped, not fatal.
            let _ = sqlx::query(sql).execute(&mut *tx).await;
        }
        sqlx::query("INSERT INTO app_kv (key, value) VALUES ('migration.showcase.money.v1', 'x6')")
            .execute(&mut *tx)
            .await?;
    }

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

    // 7. Practice: a Moroccan practice in MAD (all identifiers are examples, not a real company).
    let practice = serde_json::json!({
        "name": "Cabinet dentaire Nord",
        "addr": "27 Boulevard Zerktouni\n20250 Casablanca",
        "country": "MA",
        "currency": "MAD",
        "phone": "+212 5 22 00 00 00",
        "email": "contact@cabinet-nord.exemple.ma",
        "web": "cabinet-nord.exemple.ma",
        "opening_hours": "Lun–Ven 08:30–18:00, Sam 09:00–13:00",
        "clinician_name": "Dr. Ahmed Rahman",
        "professional_title": "Chirurgien-dentiste",
        "ma_ice": "001234567000089",
        "ma_if": "12345678",
        "ma_tp": "34567890",
        "ma_rc": "123456",
        "ma_cnss": "1234567",
        "ma_inpe": "123456789",
        "bank_name": "Banque Exemple",
        "bank_iban": "MA64 0001 0000 0000 0000 0000 001",
        "bank_bic": "BEXAMAMC",
        "account_holder": "Cabinet dentaire Nord",
        "payment_terms_days": 30,
        "emergency_phone": "+212 6 00 00 00 00",
    });
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES ('invoice.practice.v1', ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(practice.to_string())
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES ('documents.locale.v1', '\"fr\"', CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .execute(&mut *tx)
    .await?;

    // 8. Payment lines in French (the demo seed writes English labels).
    const ACTS: &[&str] = &[
        "Détartrage et polissage",
        "Composite une face",
        "Consultation et examen",
        "Radiographie panoramique",
        "Traitement endodontique (séance)",
        "Couronne céramique (acompte)",
        "Extraction simple",
        "Blanchiment au fauteuil",
        "Contrôle post-opératoire",
        "Surfaçage radiculaire",
        "Gouttière occlusale",
        "Scellement de sillons",
    ];
    for (i, act) in ACTS.iter().enumerate() {
        sqlx::query("UPDATE payment SET description = ?1 WHERE id NOT LIKE 'seed-sc-%' AND (rowid % ?2) = ?3")
            .bind(act)
            .bind(ACTS.len() as i64)
            .bind(i as i64)
            .execute(&mut *tx)
            .await?;
    }

    // 9. A growing month: this month so far ahead of the same days last month (+12 %).
    let (cur, prev): (f64, f64) = sqlx::query_as(
        "SELECT
           COALESCE(SUM(CASE WHEN date(created_at) >= date('now','start of month') THEN amount END), 0),
           COALESCE(SUM(CASE WHEN date(created_at) >= date('now','start of month','-1 month')
                              AND date(created_at) <= date('now','-1 month') THEN amount END), 0)
         FROM payment WHERE status = 'PAID' AND id NOT LIKE 'seed-sc-boost-%'",
    )
    .fetch_one(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM payment WHERE id LIKE 'seed-sc-boost-%'")
        .execute(&mut *tx)
        .await?;
    let gap = prev * 1.12 - cur;
    let days = today.day().saturating_sub(1).max(1);
    if gap > 0.0 {
        let pats: Vec<(String,)> =
            sqlx::query_as("SELECT id FROM patient ORDER BY id LIMIT 60 OFFSET 20")
                .fetch_all(&mut *tx)
                .await?;
        let n = (days as usize * 2).clamp(4, 40);
        for k in 0..n {
            let Some((pid,)) = pats.get(k % pats.len().max(1)) else {
                break;
            };
            sqlx::query(
                "INSERT INTO payment (id, patient_id, amount, payment_method, status, description, created_at)
                 VALUES (?1, ?2, ?3, ?4, 'PAID', ?5, datetime(date('now','start of month'), ?6, '+10 hours', ?7))",
            )
            .bind(format!("seed-sc-boost-{k:02}"))
            .bind(pid)
            .bind((gap / n as f64).round())
            .bind(if k % 3 == 0 { "CASH" } else { "CARD" })
            .bind(ACTS[k % ACTS.len()])
            .bind(format!("+{} days", k as u32 % days))
            .bind(format!("+{} minutes", (k * 7) % 60))
            .execute(&mut *tx)
            .await?;
        }
    }

    // 10. What else shows on screen in French, with Moroccan names (demo text is English/German).
    const STAFF: &[(&str, &str)] = &[
        ("aya@practice.de", "Aya Benali"),
        ("nora@practice.de", "Nora Lahlou"),
        ("tom@practice.de", "Taha Ouazzani"),
        ("lina@practice.de", "Lina Berrada"),
    ];
    for (email, name) in STAFF {
        sqlx::query("UPDATE staff SET name = ?2 WHERE email = ?1")
            .bind(email)
            .bind(name)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query("UPDATE practice_task SET body = 'Suivi de facturation' WHERE body LIKE 'Demo%'")
        .execute(&mut *tx)
        .await?;
    // Reminders are generated again at start, with today's patient names.
    sqlx::query("DELETE FROM in_app_notification")
        .execute(&mut *tx)
        .await?;
    const ITEMS: &[(&str, &str)] = &[
        ("Rubber dam set", "Kit de digue"),
        ("Diamond bur set 314", "Fraises diamantées 314"),
        ("Mouth mirror rhodium", "Miroirs buccaux rhodiés"),
        ("Anaesthetic Ultracain DS", "Anesthésique Ultracain DS"),
        ("A-silicone impression material", "Silicone d'empreinte (A)"),
        ("Impression material", "Matériau d'empreinte"),
        ("Fluoride varnish 5%", "Vernis fluoré 5 %"),
        ("Suture 4-0", "Fil de suture 4-0"),
        ("Sof-Lex polishing discs", "Disques de polissage Sof-Lex"),
        (
            "Sterilization pouches 90×230",
            "Sachets de stérilisation 90×230",
        ),
        (
            "Glass ionomer cement Fuji IX",
            "Ciment verre ionomère Fuji IX",
        ),
        ("Etch gel 37%", "Gel de mordançage 37 %"),
        ("Cotton rolls", "Rouleaux de coton"),
        (
            "Nitrile gloves M (box of 100)",
            "Gants nitrile M (boîte de 100)",
        ),
        ("Matrix bands", "Matrices"),
    ];
    for (en, fr) in ITEMS {
        sqlx::query("UPDATE purchase_order SET item = ?2 WHERE item = ?1")
            .bind(en)
            .bind(fr)
            .execute(&mut *tx)
            .await?;
    }
    sqlx::query(
        "UPDATE purchase_order SET remark = NULL,
                unit = CASE unit WHEN 'Pkg.' THEN 'Paq.' WHEN 'Set' THEN 'Kit' WHEN 'Syringe' THEN 'Seringue'
                                 WHEN 'Pcs' THEN 'Pièces' ELSE unit END,
                pharma_consultant = CASE rowid % 4 WHEN 0 THEN 'M. Kettani' WHEN 1 THEN 'Mme Alaoui'
                                                   WHEN 2 THEN 'M. Tazi' ELSE 'Mme Chraibi' END",
    )
    .execute(&mut *tx)
    .await?;
    const ANAM: &[(&str, &str)] = &[
        ("None known", "Aucune connue"),
        ("Keine bekannt", "Aucune connue"),
        ("Keine Dauermedikation", "Aucun traitement au long cours"),
        ("\"None\"", "\"Aucune\""),
        ("Penicillin", "Pénicilline"),
        ("Hypertension", "Hypertension artérielle"),
        ("Type 2 diabetes", "Diabète de type 2"),
        ("Hypothyroid", "Hypothyroïdie"),
        ("Nuts", "Fruits à coque"),
        (
            "Anxiety — prefer short visits",
            "Anxiété : préfère des séances courtes",
        ),
        ("Tonsillectomy 2010", "Amygdalectomie 2010"),
    ];
    for (from, to) in ANAM {
        sqlx::query("UPDATE anamnesis_form SET answers = REPLACE(answers, ?1, ?2)")
            .bind(from)
            .bind(to)
            .execute(&mut *tx)
            .await?;
    }

    // 11. Clinical demo text in French (catalogue, diagnoses, prescriptions, today's book).
    // Longest phrases first so "Amoxicillin" does not break "Amoxicillin/Clavulanic acid".
    const FR: &[(&str, &str)] = &[
        (
            "Periodontal status · hygiene instruction",
            "Bilan parodontal · conseils d'hygiène",
        ),
        (
            "Demo prescription — year volume seed.",
            "Selon prescription.",
        ),
        (
            "New patient intake · full anamnesis",
            "Première visite · anamnèse complète",
        ),
        (
            "Emergency walk-in · cracked cusp",
            "Urgence · cuspide fêlée",
        ),
        (
            "Aligner progress / next aligners",
            "Suivi aligneurs / nouvelles gouttières",
        ),
        (
            "Scaling & root planing quadrant",
            "Surfaçage radiculaire (quadrant)",
        ),
        (
            "Post-op review after extraction",
            "Contrôle après extraction",
        ),
        ("Composite filling 16 occlusal", "Composite 16 occlusal"),
        ("Recall + bitewing radiographs", "Contrôle + radiographies"),
        (
            "Amoxicillin/Clavulanic acid",
            "Amoxicilline / acide clavulanique",
        ),
        (
            "Fissure sealant per tooth",
            "Scellement de sillons par dent",
        ),
        (
            "Crown prep 24 + temporary",
            "Préparation couronne 24 + provisoire",
        ),
        ("Cracked tooth after lunch", "Dent fêlée après le repas"),
        ("Oral hygiene instruction", "Enseignement à l'hygiène"),
        ("Pocket depth measurement", "Mesure des poches"),
        (
            "Crown vs implant consult",
            "Consultation couronne ou implant",
        ),
        ("New patient intake exam", "Bilan nouveau patient"),
        ("Desensitizing treatment", "Traitement désensibilisant"),
        ("Three-surface composite", "Composite trois faces"),
        ("Periodontal maintenance", "Maintenance parodontale"),
        ("Local antibiotic pocket", "Antibiotique local en poche"),
        ("Year demo multi-finding", "Plusieurs constats"),
        ("Endodontic follow-up 36", "Suivi endodontique 36"),
        ("Peri-implant mucositis", "Mucosite péri-implantaire"),
        ("Replacement filling 46", "Remplacement d'obturation 46"),
        ("Professional cleaning", "Détartrage professionnel"),
        ("One-surface composite", "Composite une face"),
        ("Two-surface composite", "Composite deux faces"),
        ("Glass ionomer filling", "Obturation verre ionomère"),
        ("Periodontitis stage I", "Parodontite stade I"),
        ("Year demo examination", "Examen de contrôle"),
        (
            "Whitening shade check",
            "Contrôle de teinte après blanchiment",
        ),
        ("Chewing pain tooth 16", "Douleur à la mastication 16"),
        ("Periodontal charting", "Charting parodontal"),
        ("Bitewing radiographs", "Radiographies rétro-coronaires"),
        ("Wisdom tooth removal", "Extraction de dent de sagesse"),
        ("Smile design consult", "Consultation design du sourire"),
        ("Clinical examination", "Examen clinique"),
        ("Hot/cold sensitivity", "Sensibilité chaud/froid"),
        ("Root canal anterior", "Traitement canalaire (antérieure)"),
        ("Root canal premolar", "Traitement canalaire (prémolaire)"),
        ("Surgical extraction", "Extraction chirurgicale"),
        ("In-office bleaching", "Blanchiment au fauteuil"),
        ("Splint therapy hard", "Gouttière occlusale rigide"),
        ("Metronidazole 400mg", "Métronidazole 400 mg"),
        ("Implant uncovering", "Dégagement d'implant"),
        ("Bleaching tray set", "Gouttières de blanchiment"),
        ("Amoxicillin 1000mg", "Amoxicilline 1000 mg"),
        ("Corsodyl mouthwash", "Bain de bouche Corsodyl"),
        ("Occlusal analysis", "Analyse occlusale"),
        ("Composite buildup", "Reconstitution composite"),
        ("Temporary filling", "Obturation provisoire"),
        ("Simple extraction", "Extraction simple"),
        ("Crown preparation", "Préparation de couronne"),
        ("Splint adjustment", "Ajustement de gouttière"),
        ("Impression / scan", "Empreinte / scan"),
        ("Paracetamol 500mg", "Paracétamol 500 mg"),
        ("Chlorhexidin 0.2%", "Chlorhexidine 0,2 %"),
        ("Gingival bleeding", "Saignement gingival"),
        ("Throbbing pain 36", "Douleur pulsatile 36"),
        ("Aligner tightness", "Aligneur trop serré"),
        ("Recall / checkup", "Contrôle / rappel"),
        ("Emergency triage", "Tri d'urgence"),
        ("Fluoride varnish", "Vernis fluoré"),
        ("Root canal molar", "Traitement canalaire (molaire)"),
        ("Endo retreatment", "Retraitement endodontique"),
        ("Abscess incision", "Incision d'abcès"),
        ("Composite veneer", "Facette composite"),
        ("Space maintainer", "Mainteneur d'espace"),
        ("Secondary caries", "Carie secondaire"),
        ("Missing tooth 24", "Dent manquante 24"),
        ("Panoramic X-ray", "Radiographie panoramique"),
        ("Partial denture", "Prothèse partielle"),
        ("Temporary crown", "Couronne provisoire"),
        ("Bruxism consult", "Consultation bruxisme"),
        ("Aligner consult", "Consultation aligneurs"),
        ("Ibuprofen 600mg", "Ibuprofène 600 mg"),
        ("Diclofenac 50mg", "Diclofénac 50 mg"),
        ("Post-op checkup", "Contrôle post-opératoire"),
        ("Shade too light", "Teinte trop claire"),
        ("Airflow polish", "Polissage airflow"),
        ("Zirconia crown", "Couronne zircone"),
        ("Denture reline", "Rebasage de prothèse"),
        ("Shade matching", "Prise de teinte"),
        ("Initial caries", "Carie initiale"),
        ("Tooth fracture", "Fracture dentaire"),
        ("Healthy recall", "Contrôle sans particularité"),
        ("Routine recall", "Contrôle de routine"),
        ("Vitality test", "Test de vitalité"),
        ("TMJ screening", "Dépistage ATM"),
        ("Fracture risk", "Risque de fracture"),
        ("Pericoronitis", "Péricoronarite"),
        ("Metronidazole", "Métronidazole"),
        ("Child recall", "Contrôle enfant"),
        ("Gingivectomy", "Gingivectomie"),
        ("Pulp capping", "Coiffage pulpaire"),
        ("Broken crown", "Couronne cassée"),
        ("Lost filling", "Obturation perdue"),
        ("Apicoectomy", "Résection apicale"),
        ("Bridge unit", "Élément de bridge"),
        ("Amoxicillin", "Amoxicilline"),
        ("Paracetamol", "Paracétamol"),
        ("As directed", "Selon prescription"),
        ("Sensitivity", "Sensibilité"),
        ("Gingivitis", "Gingivite"),
        ("Retainers", "Contentions"),
        ("Ibuprofen", "Ibuprofène"),
        ("Duration:", "Durée :"),
        ("Follow-up", "Suivi"),
        ("Bleeding", "Saignement"),
        ("Swelling", "Gonflement"),
        ("Checkup", "Contrôle"),
        ("Recall", "Rappel"),
        ("Trauma", "Traumatisme"),
        (" days", " jours"),
        (" day", " jour"),
        ("Pain", "Douleur"),
    ];
    const TEXT_COLUMNS: &[(&str, &str)] = &[
        ("treatment", "service_name"),
        ("treatment", "description"),
        ("treatment", "notes"),
        ("examination", "service_name"),
        ("examination", "diagnosis"),
        ("examination", "chief_complaint"),
        ("examination", "results"),
        ("treatment_catalog", "name"),
        ("service_item", "name"),
        ("prescription", "medication"),
        ("prescription", "active_ingredient"),
        ("prescription", "duration"),
        ("prescription", "instructions"),
        ("appointment", "notes"),
        ("appointment", "chief_complaint"),
        ("practice_task", "title"),
        ("practice_task", "service_name"),
    ];
    for (table, col) in TEXT_COLUMNS {
        for (en, fr) in FR {
            // Duration words only in the duration column ("7 days"), not inside other text.
            if en.starts_with(' ') && *col != "duration" {
                continue;
            }
            let _ = sqlx::query(&format!(
                "UPDATE {table} SET {col} = REPLACE({col}, ?1, ?2) WHERE {col} LIKE '%' || ?1 || '%'"
            ))
            .bind(en)
            .bind(fr)
            .execute(&mut *tx)
            .await;
        }
    }

    // 12. Stock above minimum (no "low stock" alerts) and a morning of work time already logged.
    sqlx::query("UPDATE product SET stock = MAX(stock, min_stock * 3 + 5)")
        .execute(&mut *tx)
        .await?;
    let at = |h: u32, m: u32| {
        today
            .and_hms_opt(h, m, 0)
            .and_then(|t| t.and_local_timezone(Local).single())
            .map(|t| t.with_timezone(&chrono::Utc).to_rfc3339())
    };
    if let (Some(start), Some(end)) = (at(8, 10), at(12, 35)) {
        let _ = sqlx::query(
            "INSERT OR REPLACE INTO work_time_session (id, staff_id, started_at, ended_at, status, auto_recorded, pause_minutes)
             VALUES ('seed-sc-wt-am', 'seed-physician-001', ?1, ?2, 'ENDED', 0, 0)",
        )
        .bind(start)
        .bind(end)
        .execute(&mut *tx)
        .await;
    }

    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(target: "medoc::system", event = "DEMO_SHOWCASE_APPLIED", patients = ids.len());
    Ok(())
}
