//! Demo seed data and post-migration bootstrap (brute-force schema, optional dev seed).

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

fn should_run_demo_seed() -> bool {
    cfg!(test)
        || std::env::var("MEDOC_DEV_SEED").ok().as_deref() == Some("1")
        || std::env::args().any(|a| a == "--dev-seed")
}

pub async fn run_post_migration_seed(pool: &SqlitePool) -> Result<(), AppError> {
    crate::infrastructure::database::brute_force_repo::ensure_schema(pool).await?;
    if should_run_demo_seed() {
        seed_demo_data(pool).await?;
    }
    Ok(())
}

async fn seed_demo_data(pool: &SqlitePool) -> Result<(), AppError> {
    let patient_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patient")
        .fetch_one(pool)
        .await?;
    if patient_count.0 == 0 {
        sqlx::query(
            "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, telefon, email, adresse, status) VALUES
            ('seed-pat-001','Lena Hoffmann','1990-04-12','WEIBLICH','AOK-1000001','+49 151 1234567','lena.hoffmann@medoc-demo.de','Rosenweg 4, 28195 Bremen','NEU'),
            ('seed-pat-002','Mert Yilmaz','1984-09-03','MAENNLICH','TK-1000002','+49 152 4567890','mert.yilmaz@medoc-demo.de','Wiesenstr. 8, 28197 Bremen','AKTIV'),
            ('seed-pat-003','Sofia Kruger','2001-01-18','WEIBLICH','BKK-1000003','+49 160 7788990','sofia.kruger@medoc-demo.de','Neustadtwall 12, 28199 Bremen','VALIDIERT'),
            ('seed-pat-004','Noah Becker','1976-11-27','MAENNLICH','DAK-1000004','+49 170 1002003',NULL,'Parkallee 2, 28209 Bremen','READONLY'),
            ('seed-pat-005','Aylin Demir','1996-07-09','DIVERS','IKK-1000005','+49 172 8899001','aylin.demir@medoc-demo.de','Am Markt 15, 28195 Bremen','AKTIV')",
        )
        .execute(pool)
        .await?;
    }
    // Ensure FK-referenced demo patients exist even on non-empty databases.
    // Inserted before dependents (anamnesebogen, akten, etc.) to avoid FK
    // violations when SQLite has `PRAGMA foreign_keys = ON` (e.g. tests).
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, telefon, email, adresse, status) VALUES
        ('seed-pat-001','Lena Hoffmann','1990-04-12','WEIBLICH','AOK-1000001','+49 151 1234567','lena.hoffmann@medoc-demo.de','Rosenweg 4, 28195 Bremen','NEU'),
        ('seed-pat-002','Mert Yilmaz','1984-09-03','MAENNLICH','TK-1000002','+49 152 4567890','mert.yilmaz@medoc-demo.de','Wiesenstr. 8, 28197 Bremen','AKTIV'),
        ('seed-pat-003','Sofia Kruger','2001-01-18','WEIBLICH','BKK-1000003','+49 160 7788990','sofia.kruger@medoc-demo.de','Neustadtwall 12, 28199 Bremen','VALIDIERT'),
        ('seed-pat-004','Noah Becker','1976-11-27','MAENNLICH','DAK-1000004','+49 170 1002003',NULL,'Parkallee 2, 28209 Bremen','READONLY'),
        ('seed-pat-005','Aylin Demir','1996-07-09','DIVERS','IKK-1000005','+49 172 8899001','aylin.demir@medoc-demo.de','Am Markt 15, 28195 Bremen','AKTIV'),
        ('seed-pat-006','Mia Schneider','1993-03-21','WEIBLICH','AOK-1000006','+49 171 1112223','mia.schneider@medoc-demo.de','Am Wall 3, 28195 Bremen','NEU'),
        ('seed-pat-007','Jonas Braun','1988-12-02','MAENNLICH','TK-1000007','+49 171 4445556','jonas.braun@medoc-demo.de','Langenstr. 44, 28195 Bremen','AKTIV'),
        ('seed-pat-008','Elif Kaya','1979-06-15','WEIBLICH','BKK-1000008','+49 171 7778889','elif.kaya@medoc-demo.de','Sielwall 9, 28203 Bremen','VALIDIERT')",
    )
    .execute(pool)
    .await?;

    let hash = bcrypt::hash("passwort123", 12)
        .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
    // TODO(deferred-security): seed-arzt-001 exceeds MVP 1-ARZT quota — re-enable with todos-deferred-security-features.md
    // sqlx::query(
    //     "INSERT OR IGNORE INTO personal (id, name, email, passwort_hash, rolle, taetigkeitsbereich, fachrichtung, telefon) VALUES
    //     ('seed-arzt-001', 'Dr. Sarah Klein', 'sarah@praxis.de', ?1, 'ARZT', 'Oralchirurgie', 'Oralchirurgie', '+49 421 900100')",
    // )
    // .bind(&hash)
    // .execute(pool)
    // .await?;
    // TODO(deferred-roles): seed-ctl-001 (STEUERBERATER), seed-pharma-001 (PHARMABERATER) — todos-deferred-roles.md
    // Ensure FK-referenced demo staff exists even when personal already had rows.
    sqlx::query(
        "INSERT OR IGNORE INTO personal (id, name, email, passwort_hash, rolle, fachrichtung) VALUES
        ('seed-arzt-001', 'Dr. Ahmed R.', 'ahmed@praxis.de', ?1, 'ARZT', 'Zahnmedizin'),
        ('seed-rez-001', 'Aya M.', 'aya@praxis.de', ?1, 'REZEPTION', NULL)",
    )
    .bind(&hash)
    .execute(pool)
    .await?;

    let akte_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM patientenakte")
        .fetch_one(pool)
        .await?;
    if akte_count.0 == 0 {
        sqlx::query(
            "INSERT INTO patientenakte (id, patient_id, status, diagnose, befunde) VALUES
            ('seed-akte-001','seed-pat-001','ENTWURF','Initiale Kariesdiagnostik','Leichte Gingivitis, Kontrollbedarf'),
            ('seed-akte-002','seed-pat-002','IN_BEARBEITUNG','Parodontitis Stadium I','Taschenmessung dokumentiert'),
            ('seed-akte-003','seed-pat-003','VALIDIERT','Post-OP Verlaufskontrolle','Wundheilung unauffaellig'),
            ('seed-akte-004','seed-pat-004','READONLY','Abgeschlossene Prothetik','Langzeitdokument archiviert'),
            ('seed-akte-005','seed-pat-005','IN_BEARBEITUNG','CMD Abklaerung','Knackgeraeusche rechts')",
        )
        .execute(pool)
        .await?;
    }
    // Keep demo records referenced by downstream seeds (`zahnbefund`, `untersuchung`, `behandlung`).
    // Includes 006-008 so subsequent FK-bearing inserts succeed under `foreign_keys = ON`.
    sqlx::query(
        "INSERT OR IGNORE INTO patientenakte (id, patient_id, status, diagnose, befunde) VALUES
        ('seed-akte-001','seed-pat-001','ENTWURF','Initiale Kariesdiagnostik','Leichte Gingivitis, Kontrollbedarf'),
        ('seed-akte-002','seed-pat-002','IN_BEARBEITUNG','Parodontitis Stadium I','Taschenmessung dokumentiert'),
        ('seed-akte-003','seed-pat-003','VALIDIERT','Post-OP Verlaufskontrolle','Wundheilung unauffaellig'),
        ('seed-akte-004','seed-pat-004','READONLY','Abgeschlossene Prothetik','Langzeitdokument archiviert'),
        ('seed-akte-005','seed-pat-005','IN_BEARBEITUNG','CMD Abklaerung','Knackgeraeusche rechts'),
        ('seed-akte-006','seed-pat-006','ENTWURF','Okklusale Karies 26','Initialbefund aufgenommen'),
        ('seed-akte-007','seed-pat-007','IN_BEARBEITUNG','Hypersensibilitaet','Desensibilisierung geplant'),
        ('seed-akte-008','seed-pat-008','VALIDIERT','Parodontale Nachsorge','Recallprogramm aktiv')",
    )
    .execute(pool)
    .await?;

    // Demo-density patients + Akten must exist BEFORE downstream seeds reference
    // them via FK (anamnesebogen, zahnbefund, untersuchung, behandlung, …).
    // Older seed order inserted these blocks at the end of `seed_demo_data` which
    // tripped FOREIGN KEY constraints on a fresh in-memory database (regression
    // visible via `tests/db_migrations_tests.rs`).
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, telefon, email, adresse, status) VALUES
        ('seed-pat-006','Mia Schneider','1993-03-21','WEIBLICH','AOK-1000006','+49 171 1112223','mia.schneider@medoc-demo.de','Am Wall 3, 28195 Bremen','NEU'),
        ('seed-pat-007','Jonas Braun','1988-12-02','MAENNLICH','TK-1000007','+49 171 4445556','jonas.braun@medoc-demo.de','Langenstr. 44, 28195 Bremen','AKTIV'),
        ('seed-pat-008','Elif Kaya','1979-06-15','WEIBLICH','BKK-1000008','+49 171 7778889','elif.kaya@medoc-demo.de','Sielwall 9, 28203 Bremen','VALIDIERT')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO patientenakte (id, patient_id, status, diagnose, befunde) VALUES
        ('seed-akte-006','seed-pat-006','ENTWURF','Okklusale Karies 26','Initialbefund aufgenommen'),
        ('seed-akte-007','seed-pat-007','IN_BEARBEITUNG','Hypersensibilitaet','Desensibilisierung geplant'),
        ('seed-akte-008','seed-pat-008','VALIDIERT','Parodontale Nachsorge','Recallprogramm aktiv')",
    )
    .execute(pool)
    .await?;

    let anam_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM anamnesebogen")
        .fetch_one(pool)
        .await?;
    if anam_count.0 == 0 {
        sqlx::query(
            "INSERT INTO anamnesebogen (id, patient_id, antworten, unterschrieben) VALUES
            ('seed-anam-001','seed-pat-001','{\"allergien\":\"Keine\",\"medikation\":\"Keine\"}',1),
            ('seed-anam-002','seed-pat-002','{\"allergien\":\"Penicillin\",\"medikation\":\"Ibuprofen bei Bedarf\"}',1),
            ('seed-anam-003','seed-pat-003','{\"allergien\":\"Latex\",\"medikation\":\"L-Thyroxin\"}',0)",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO anamnesebogen (id, patient_id, antworten, unterschrieben) VALUES
        ('seed-anam-004','seed-pat-006','{\"allergien\":\"Keine bekannt\",\"medikation\":\"Vitamin D\"}',1),
        ('seed-anam-005','seed-pat-007','{\"allergien\":\"Nickel\",\"medikation\":\"Keine Dauermedikation\"}',0),
        ('seed-anam-006','seed-pat-008','{\"allergien\":\"Hausstaub\",\"medikation\":\"Ramipril 5mg\"}',1)",
    )
    .execute(pool)
    .await?;

    let befund_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM zahnbefund")
        .fetch_one(pool)
        .await?;
    if befund_count.0 == 0 {
        sqlx::query(
            "INSERT INTO zahnbefund (id, akte_id, zahn_nummer, befund, diagnose, notizen) VALUES
            ('seed-zb-001','seed-akte-001',16,'Karies mesial','Sekundaerkaries Verdacht','Roentgenkontrolle empfohlen'),
            ('seed-zb-002','seed-akte-002',26,'Parodontal auffaellig','Parodontitis lokalisiert','Recall in 3 Monaten'),
            ('seed-zb-003','seed-akte-003',36,'Fuellung intakt',NULL,'Keine Intervention noetig'),
            ('seed-zb-004','seed-akte-005',47,'Abrasion','Bruxismusverdacht','Schienentherapie pruefen')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO zahnbefund (id, akte_id, zahn_nummer, befund, diagnose, notizen) VALUES
        ('seed-zb-005','seed-akte-006',26,'Karies okklusal','Initialkaries','Minimalinvasive Therapie empfohlen'),
        ('seed-zb-006','seed-akte-007',14,'Schmelzriss','Infractionsverdacht','Kontrolle in 6 Monaten'),
        ('seed-zb-007','seed-akte-008',37,'Parodontal stabil',NULL,'Recall eingehalten')",
    )
    .execute(pool)
    .await?;

    let untersuchung_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM untersuchung")
        .fetch_one(pool)
        .await?;
    if untersuchung_count.0 == 0 {
        sqlx::query(
            "INSERT INTO untersuchung (id, akte_id, beschwerden, ergebnisse, diagnose) VALUES
            ('seed-un-001','seed-akte-001','Empfindlichkeit bei kalt','Vitalitaet positiv, keine apikale Auffaelligkeit','Reversible Pulpitis'),
            ('seed-un-002','seed-akte-002','Zahnfleischbluten','Sondierungstiefen bis 4mm','Parodontitis Stadium I'),
            ('seed-un-003','seed-akte-005','Kiefergelenkknacken','Palpation schmerzhaft rechts','CMD Verdacht')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO untersuchung (id, akte_id, beschwerden, ergebnisse, diagnose) VALUES
        ('seed-un-004','seed-akte-006','Empfindlich auf Suesses','Perkussion unauffaellig','Okklusale Initialkaries'),
        ('seed-un-005','seed-akte-007','Kaubeschwerden links','Klinischer Befund ohne Frakturzeichen','Dentinhypersensibilitaet'),
        ('seed-un-006','seed-akte-008','Keine akuten Beschwerden','Sondierungswerte stabil','Parodontale Nachsorge stabil')",
    )
    .execute(pool)
    .await?;

    let behandlung_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM behandlung")
        .fetch_one(pool)
        .await?;
    if behandlung_count.0 == 0 {
        sqlx::query(
            "INSERT INTO behandlung (id, akte_id, art, beschreibung, zaehne, material, notizen) VALUES
            ('seed-bh-001','seed-akte-001','BEMA 13a','Kompositfuellung gelegt','16','Komposit A2','Politur abgeschlossen'),
            ('seed-bh-002','seed-akte-002','PZR','Professionelle Zahnreinigung','11,12,13,21,22,23','Airflow + Fluorid','Recall auf 6 Monate gesetzt'),
            ('seed-bh-003','seed-akte-003','Kontrolle','Postoperative Sichtkontrolle','36','-', 'Wundheilung regelrecht')",
        )
        .execute(pool)
        .await?;
    }
    sqlx::query(
        "INSERT OR IGNORE INTO behandlung (id, akte_id, art, beschreibung, zaehne, material, notizen) VALUES
        ('seed-bh-004','seed-akte-006','Fissurenversiegelung','Versiegelung nach Trockenlegung','26','Versiegler transparent','Kontrolle in 12 Monaten'),
        ('seed-bh-005','seed-akte-007','Desensibilisierung','Fluoridlack appliziert','14,15','Fluoridlack','Haushygienehinweise gegeben'),
        ('seed-bh-006','seed-akte-008','Recall','Parodontale Nachsorge und Motivation','37,36','Handinstrumente','Blutungsindex verbessert')",
    )
    .execute(pool)
    .await?;

    let leistung_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM leistung")
        .fetch_one(pool)
        .await?;
    if leistung_count.0 == 0 {
        sqlx::query(
            "INSERT INTO leistung (id, name, beschreibung, kategorie, preis, aktiv) VALUES
            ('seed-lei-001','Professionelle Zahnreinigung','Standard PZR inkl. Fluoridierung','Prophylaxe',99.0,1),
            ('seed-lei-002','Parodontalstatus','Vollstaendige PA-Befunderhebung','Diagnostik',129.0,1),
            ('seed-lei-003','Kompositfuellung 1-flaechig','Adhaesive Fuellung im Seitenzahnbereich','Fuellungstherapie',119.0,1),
            ('seed-lei-004','Kontrolluntersuchung','Regelmaessige Verlaufskontrolle','Kontrolle',49.0,1),
            ('seed-lei-005','Bleaching-Beratung','Aufklaerung und Planung','Aesthetik',39.0,0)",
        )
        .execute(pool)
        .await?;
    }
    // Keep referenced service rows available for payment seeds.
    sqlx::query(
        "INSERT OR IGNORE INTO leistung (id, name, beschreibung, kategorie, preis, aktiv) VALUES
        ('seed-lei-001','Professionelle Zahnreinigung','Standard PZR inkl. Fluoridierung','Prophylaxe',99.0,1),
        ('seed-lei-002','Parodontalstatus','Vollstaendige PA-Befunderhebung','Diagnostik',129.0,1),
        ('seed-lei-003','Kompositfuellung 1-flaechig','Adhaesive Fuellung im Seitenzahnbereich','Fuellungstherapie',119.0,1),
        ('seed-lei-004','Kontrolluntersuchung','Regelmaessige Verlaufskontrolle','Kontrolle',49.0,1)",
    )
    .execute(pool)
    .await?;

    let produkt_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM produkt")
        .fetch_one(pool)
        .await?;
    if produkt_count.0 == 0 {
        sqlx::query(
            "INSERT INTO produkt (id, name, beschreibung, kategorie, preis, bestand, mindestbestand, aktiv) VALUES
            ('seed-prod-001','Filtek Supreme XTE','Nanokomposit fuer Front- und Seitenzahnbereich','Fuellungsmaterial',54.9,12,6,1),
            ('seed-prod-002','Nitril-Handschuhe M','Puderfrei, 100 Stk.','Verbrauchsmaterial',9.5,4,10,1),
            ('seed-prod-003','Aetzgel 37%','Phosphorsaeure-Gel 2ml','Adhaesivsystem',14.9,18,5,1),
            ('seed-prod-004','Mundspiegel Rhodium','Sterilisierbar, Standardgroesse','Instrumente',7.9,2,4,1),
            ('seed-prod-005','Interdentalbuersten Set','Patientenabgabe 6er Set','Prophylaxe',6.5,25,8,0)",
        )
        .execute(pool)
        .await?;
    }

    let termin_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM termin")
        .fetch_one(pool)
        .await?;
    if termin_count.0 == 0 {
        sqlx::query(
            "INSERT INTO termin (id, datum, uhrzeit, art, status, notizen, beschwerden, patient_id, arzt_id) VALUES
            ('seed-ter-001', date('now','localtime'), '08:30', 'ERSTBESUCH', 'BESTAETIGT', 'Anamnese aufnehmen', 'Kalt-/Warmempfindlichkeit', 'seed-pat-001', 'seed-arzt-001'),
            ('seed-ter-002', date('now','localtime'), '10:00', 'UNTERSUCHUNG', 'GEPLANT', 'PA-Status erfassen', 'Zahnfleischbluten', 'seed-pat-002', 'seed-arzt-001'),
            ('seed-ter-003', date('now','localtime','+1 day'), '09:15', 'BEHANDLUNG', 'GEPLANT', 'Kompositfuellung geplant', 'Druckschmerz Zahn 16', 'seed-pat-001', 'seed-arzt-001'),
            ('seed-ter-004', date('now','localtime','+2 day'), '14:00', 'KONTROLLE', 'DURCHGEFUEHRT', 'Post-OP Kontrolle', NULL, 'seed-pat-003', 'seed-arzt-001'),
            ('seed-ter-005', date('now','localtime','-1 day'), '11:30', 'BERATUNG', 'ABGESAGT', 'Aesthetik-Beratung', NULL, 'seed-pat-005', 'seed-arzt-001')",
        )
        .execute(pool)
        .await?;
    }

    let zahlung_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM zahlung")
        .fetch_one(pool)
        .await?;
    if zahlung_count.0 == 0 {
        sqlx::query(
            "INSERT INTO zahlung (id, patient_id, betrag, zahlungsart, status, leistung_id, beschreibung) VALUES
            ('seed-zahl-001','seed-pat-001',99.0,'BAR','BEZAHLT','seed-lei-001','PZR direkt bezahlt'),
            ('seed-zahl-002','seed-pat-002',129.0,'RECHNUNG','AUSSTEHEND','seed-lei-002','PA-Befund noch offen'),
            ('seed-zahl-003','seed-pat-003',119.0,'KARTE','TEILBEZAHLT','seed-lei-003','Anzahlung geleistet'),
            ('seed-zahl-004','seed-pat-004',49.0,'UEBERWEISUNG','STORNIERT','seed-lei-004','Termin storniert')",
        )
        .execute(pool)
        .await?;
    }

    let rezept_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM rezept")
        .fetch_one(pool)
        .await?;
    if rezept_count.0 == 0 {
        sqlx::query(
            "INSERT INTO rezept (id, patient_id, arzt_id, medikament, wirkstoff, dosierung, dauer, hinweise, status) VALUES
            ('seed-rez-001','seed-pat-002','seed-arzt-001','Amoxicillin 1000mg','Amoxicillin','1-0-1','7 Tage','Nach den Mahlzeiten einnehmen','AUSGESTELLT'),
            ('seed-rez-002','seed-pat-003','seed-arzt-001','Ibuprofen 600mg','Ibuprofen','1-1-1 bei Bedarf','5 Tage','Max. 3 Tabletten/Tag','AUSGESTELLT')",
        )
        .execute(pool)
        .await?;
    }

    let attest_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM attest")
        .fetch_one(pool)
        .await?;
    if attest_count.0 == 0 {
        sqlx::query(
            "INSERT INTO attest (id, patient_id, arzt_id, typ, inhalt, gueltig_von, gueltig_bis) VALUES
            ('seed-att-001','seed-pat-001','seed-arzt-001','Arbeitsunfaehigkeit','Patientin ist nach oralchirurgischem Eingriff arbeitsunfaehig.',date('now','localtime'),date('now','localtime','+3 day')),
            ('seed-att-002','seed-pat-005','seed-arzt-001','Sportbefreiung','Voruebergehende Sportbefreiung nach Kiefergelenkbeschwerden.',date('now','localtime','-1 day'),date('now','localtime','+14 day'))",
        )
        .execute(pool)
        .await?;
    }

    // Audit trail rows are created at runtime via `audit_repo::create` (HMAC chain).
    // Do not seed `audit_log` — placeholder rows with empty `hmac` break startup verification.

    // Additional demo density for UI/UX testing even on existing databases.
    sqlx::query(
        "INSERT OR IGNORE INTO leistung (id, name, beschreibung, kategorie, preis, aktiv) VALUES
        ('seed-lei-006','Fissurenversiegelung','Versiegelung bleibender Molaren','Prophylaxe',69.0,1),
        ('seed-lei-007','Schienentherapie Beratung','Funktionsanalyse und Schienenplanung','Funktionsdiagnostik',89.0,1),
        ('seed-lei-008','Endo-Voruntersuchung','Klinik und Roentgen zur Endo-Planung','Endodontie',79.0,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO produkt (id, name, beschreibung, kategorie, preis, bestand, mindestbestand, aktiv) VALUES
        ('seed-prod-006','Fluoridlack','5% NaF Lack fuer Desensibilisierung','Prophylaxe',19.9,14,6,1),
        ('seed-prod-007','Kofferdam Set','Latexfrei, sortierte Groessen','Endodontie',29.9,9,4,1),
        ('seed-prod-008','Nahtmaterial 4-0','Resorbierbares Nahtmaterial','Chirurgie',12.9,3,5,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO termin (id, datum, uhrzeit, art, status, notizen, beschwerden, patient_id, arzt_id) VALUES
        ('seed-ter-006', date('now','localtime','+3 day'), '08:45', 'KONTROLLE', 'BESTAETIGT', 'Recall-Termin', NULL, 'seed-pat-006', 'seed-arzt-001'),
        ('seed-ter-007', date('now','localtime','+3 day'), '11:00', 'BEHANDLUNG', 'GEPLANT', 'Fissurenversiegelung', 'Empfindlichkeit beim Kauen', 'seed-pat-007', 'seed-arzt-001'),
        ('seed-ter-008', date('now','localtime','+4 day'), '09:30', 'BERATUNG', 'GEPLANT', 'Schienentherapie Aufklaerung', 'Morgendliche Kieferschmerzen', 'seed-pat-008', 'seed-arzt-001'),
        ('seed-ter-009', date('now','localtime','-2 day'), '15:10', 'UNTERSUCHUNG', 'NICHT_ERSCHIENEN', 'Telefonische Nachverfolgung', NULL, 'seed-pat-006', 'seed-arzt-001'),
        ('seed-ter-010', date('now','localtime','+5 day'), '13:40', 'ERSTBESUCH', 'GEPLANT', 'Neupatientenaufnahme', 'Druckschmerz rechts unten', 'seed-pat-008', 'seed-arzt-001')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO zahlung (id, patient_id, betrag, zahlungsart, status, leistung_id, beschreibung) VALUES
        ('seed-zahl-005','seed-pat-006',69.0,'KARTE','BEZAHLT','seed-lei-006','Fissurenversiegelung abgeschlossen'),
        ('seed-zahl-006','seed-pat-007',89.0,'RECHNUNG','AUSSTEHEND','seed-lei-007','Beratung noch offen'),
        ('seed-zahl-007','seed-pat-008',79.0,'UEBERWEISUNG','TEILBEZAHLT','seed-lei-008','Teilzahlung eingegangen')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO rezept (id, patient_id, arzt_id, medikament, wirkstoff, dosierung, dauer, hinweise, status) VALUES
        ('seed-rez-003','seed-pat-006','seed-arzt-001','Chlorhexidin 0.2%','Chlorhexidin','2x taeglich spuelen','10 Tage','Nicht schlucken','AUSGESTELLT')",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO attest (id, patient_id, arzt_id, typ, inhalt, gueltig_von, gueltig_bis) VALUES
        ('seed-att-003','seed-pat-007','seed-arzt-001','Behandlungsbestaetigung','Bestaetigung ueber erfolgte zahnmedizinische Beratung.',date('now','localtime'),date('now','localtime','+30 day'))",
    )
    .execute(pool)
    .await?;

    // Demo-Termine an lokalem Kalender ausrichten (ältere Seeds nutzten date('now') = UTC → Tag-Ansicht wirkte „leer“).
    sqlx::query(
        "UPDATE termin SET datum = CASE id
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
            ELSE datum
        END
        WHERE id IN (
            'seed-ter-001','seed-ter-002','seed-ter-003','seed-ter-004','seed-ter-005',
            'seed-ter-006','seed-ter-007','seed-ter-008','seed-ter-009','seed-ter-010'
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO behandlungs_katalog (id, kategorie, name, default_kosten, sort_order, aktiv) VALUES
        ('seed-kat-001','Kontrolluntersuchung','Recall / Kontrolle',49.0,10,1),
        ('seed-kat-002','Kontrolluntersuchung','Parodontalstatus',79.0,20,1),
        ('seed-kat-003','Fuellungstherapie','Komposit 1-flaechig',119.0,30,1),
        ('seed-kat-004','Fuellungstherapie','Komposit 2-flaechig',149.0,40,1),
        ('seed-kat-005','Parodontologie','PZR professionell',99.0,50,1),
        ('seed-kat-006','Parodontologie','Taschentiefenmessung',65.0,60,1),
        ('seed-kat-007','Chirurgie','Zahnextraktion',120.0,70,1),
        ('seed-kat-008','Chirurgie','Weisheitszahnentfernung',280.0,80,1),
        ('seed-kat-009','Chirurgie','Implantatfreilegung',95.0,90,1),
        ('seed-kat-010','Prothetik','Krone zirkon',890.0,100,1),
        ('seed-kat-011','Prothetik','Teilprothese beraten',55.0,110,1)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "INSERT OR IGNORE INTO behandlung (id, akte_id, art, beschreibung, zaehne, material, notizen, kategorie, leistungsname, behandlungsnummer, sitzung, behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum) VALUES
        ('seed-bh-wf-001','seed-akte-001','Chirurgie','Weisheitszahnentfernung','18',NULL,NULL,'Chirurgie','Weisheitszahnentfernung','155',4,'DURCHGEFUEHRT',280.0,1,'2026-01-20'),
        ('seed-bh-wf-002','seed-akte-001','Chirurgie','Weisheitszahnentfernung','18',NULL,NULL,'Chirurgie','Weisheitszahnentfernung','155',3,'DURCHGEFUEHRT',280.0,1,'2026-01-18'),
        ('seed-bh-wf-003','seed-akte-001','Chirurgie','Weisheitszahnentfernung','18',NULL,NULL,'Chirurgie','Weisheitszahnentfernung','155',2,'DURCHGEFUEHRT',280.0,1,'2026-01-15'),
        ('seed-bh-wf-004','seed-akte-001','Chirurgie','Weisheitszahnentfernung','18',NULL,NULL,'Chirurgie','Weisheitszahnentfernung','155',1,'DURCHGEFUEHRT',280.0,1,'2026-01-10'),
        ('seed-bh-wf-005','seed-akte-001','Fuellungstherapie','Komposit 1-flaechig','16',NULL,NULL,'Fuellungstherapie','Komposit 1-flaechig','143',3,'DURCHGEFUEHRT',119.0,0,'2026-02-01'),
        ('seed-bh-wf-006','seed-akte-001','Fuellungstherapie','Komposit 1-flaechig','16',NULL,NULL,'Fuellungstherapie','Komposit 1-flaechig','143',2,'DURCHGEFUEHRT',119.0,0,'2026-01-28'),
        ('seed-bh-wf-007','seed-akte-001','Fuellungstherapie','Komposit 1-flaechig','16',NULL,NULL,'Fuellungstherapie','Komposit 1-flaechig','143',1,'DURCHGEFUEHRT',119.0,0,'2026-01-25'),
        ('seed-bh-wf-008','seed-akte-001','Kontrolluntersuchung','Recall / Kontrolle','11',NULL,NULL,'Kontrolluntersuchung','Recall / Kontrolle','123',1,'DURCHGEFUEHRT',49.0,0,'2026-01-05')",
    )
    .execute(pool)
    .await?;

    let anam_demo = r#"{"version":1,"versicherungsstatus":"GKV","krankenkasse":"AOK Bremen / Plus","vorerkrankungen":{"chronisch":"Asthma leicht","frueherDiagnosen":"Karies Jugendalter","operationen":"","krankenhaus":"","psychisch":""},"medikation":{"regelmaessig":"Vitamin D 1000 IE","einnahme":"täglich morgens","selbst":"","vergessen":"","nebenwirkungen":""},"allergien":{"medikamente":"Penicillin","lebensmittel":"Nüsse","sonstige":"","material":"","impfreaktionen":""}}"#;
    let _ =
        sqlx::query("UPDATE anamnesebogen SET antworten = ?1 WHERE patient_id = 'seed-pat-001'")
            .bind(anam_demo)
            .execute(pool)
            .await;

    // ---------------------------------------------------------------
    // Bestellungen: dummy demo data so the page is populated and the
    // Statistik page has bestellung trends to chart.
    // ---------------------------------------------------------------
    sqlx::query(
        "INSERT OR IGNORE INTO bestellung (
            id, bestellnummer, lieferant, pharmaberater, artikel, status,
            erwartet_am, geliefert_am, menge, einheit, bemerkung, created_by, created_at
         ) VALUES
        ('seed-best-001','B-2026-04-0001','Henry Schein Dental','Frau Berger','Filtek Supreme XTE A2','GELIEFERT',
            date('now','localtime','-12 day'), date('now','localtime','-10 day'), 6, 'Spritze',
            'Standardnachschub Composite','seed-arzt-001', datetime('now','localtime','-15 day')),
        ('seed-best-002','B-2026-04-0002','Pluradent','Herr Klose','Nitril-Handschuhe M (100er)','GELIEFERT',
            date('now','localtime','-8 day'), date('now','localtime','-6 day'), 20, 'Pkg.',
            'Routine Hygieneverbrauch','seed-arzt-001', datetime('now','localtime','-12 day')),
        ('seed-best-003','B-2026-04-0003','Speiko','Frau Vogel','Aetzgel 37%','UNTERWEGS',
            date('now','localtime','+2 day'), NULL, 5, 'Spritze',
            'Express-Versand bestellt','seed-arzt-001', datetime('now','localtime','-3 day')),
        ('seed-best-004','B-2026-04-0004','Komet','Herr Brand','Diamantbohrer Set 314','OFFEN',
            date('now','localtime','+7 day'), NULL, 2, 'Set',
            'Ersatz für Kassette OP 2','seed-arzt-001', datetime('now','localtime','-2 day')),
        ('seed-best-005','B-2026-04-0005','Henry Schein Dental','Frau Berger','Mundspiegel Rhodium','OFFEN',
            date('now','localtime','-3 day'), NULL, 8, 'Stück',
            'Lieferung erwartet, Anruf nötig','seed-arzt-001', datetime('now','localtime','-10 day')),
        ('seed-best-006','B-2026-04-0006','Septodont','Frau Kuhn','Anaesthesie Ultracain DS','GELIEFERT',
            date('now','localtime','-25 day'), date('now','localtime','-22 day'), 50, 'Ampulle',
            'Quartalsbestellung','seed-arzt-001', datetime('now','localtime','-30 day')),
        ('seed-best-007','B-2026-04-0007','Pluradent','Herr Klose','Kofferdam Set','OFFEN',
            date('now','localtime','+5 day'), NULL, 3, 'Set',
            'Endo-Bedarf','seed-arzt-001', datetime('now','localtime','-1 day')),
        ('seed-best-008','B-2026-03-0011','Bisico','Frau Albers','Abformmaterial A-Silikon','STORNIERT',
            NULL, NULL, 4, 'Pkg.',
            'Storniert wegen Lieferverzögerung','seed-arzt-001', datetime('now','localtime','-45 day')),
        ('seed-best-009','B-2026-03-0010','Voco','Herr Schramm','Fluoridlack 5%','GELIEFERT',
            date('now','localtime','-50 day'), date('now','localtime','-47 day'), 10, 'Tube',
            'Prophylaxe Q1','seed-arzt-001', datetime('now','localtime','-55 day')),
        ('seed-best-010','B-2026-02-0007','Henry Schein Dental','Frau Berger','Nahtmaterial 4-0','GELIEFERT',
            date('now','localtime','-78 day'), date('now','localtime','-76 day'), 6, 'Pkg.',
            'OP-Vorrat','seed-arzt-001', datetime('now','localtime','-82 day')),
        ('seed-best-011','B-2026-02-0004','Speiko','Frau Vogel','Polierscheiben Sof-Lex','GELIEFERT',
            date('now','localtime','-90 day'), date('now','localtime','-88 day'), 3, 'Set',
            NULL,'seed-arzt-001', datetime('now','localtime','-95 day')),
        ('seed-best-012','B-2026-01-0009','Pluradent','Herr Klose','Sterilisationsbeutel 90×230','GELIEFERT',
            date('now','localtime','-115 day'), date('now','localtime','-112 day'), 4, 'Pkg.',
            'Sterilgut Auffüllung','seed-arzt-001', datetime('now','localtime','-120 day')),
        ('seed-best-013','B-2025-12-0006','Henry Schein Dental','Frau Berger','Composite Filtek Z250 A3','GELIEFERT',
            date('now','localtime','-150 day'), date('now','localtime','-148 day'), 4, 'Spritze',
            NULL,'seed-arzt-001', datetime('now','localtime','-155 day')),
        ('seed-best-014','B-2025-11-0003','Voco','Herr Schramm','Glasionomerzement Fuji IX','GELIEFERT',
            date('now','localtime','-180 day'), date('now','localtime','-178 day'), 2, 'Pkg.',
            NULL,'seed-arzt-001', datetime('now','localtime','-185 day'))",
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

    // Spread demo zahlungen so finance chart has months
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-60 day') WHERE id = 'seed-zahl-001'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-95 day') WHERE id = 'seed-zahl-002'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-130 day') WHERE id = 'seed-zahl-003'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-165 day') WHERE id = 'seed-zahl-004'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-25 day') WHERE id = 'seed-zahl-005'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-15 day') WHERE id = 'seed-zahl-006'",
    ).execute(pool).await;
    let _ = sqlx::query(
        "UPDATE zahlung SET created_at = datetime('now','localtime','-5 day') WHERE id = 'seed-zahl-007'",
    ).execute(pool).await;

    // Add a few extra paid zahlungen across past months so bar chart is denser
    sqlx::query(
        "INSERT OR IGNORE INTO zahlung (id, patient_id, betrag, zahlungsart, status, leistung_id, beschreibung, created_at) VALUES
        ('seed-zahl-h01','seed-pat-001',180.0,'KARTE','BEZAHLT','seed-lei-003','Composite Fuellung',datetime('now','localtime','-40 day')),
        ('seed-zahl-h02','seed-pat-002',299.0,'UEBERWEISUNG','BEZAHLT','seed-lei-007','Schienentherapie Beratung+Schiene',datetime('now','localtime','-72 day')),
        ('seed-zahl-h03','seed-pat-003',450.0,'KARTE','BEZAHLT','seed-lei-008','Endo-Voruntersuchung+Behandlung',datetime('now','localtime','-105 day')),
        ('seed-zahl-h04','seed-pat-004',120.0,'BAR','BEZAHLT','seed-lei-001','PZR',datetime('now','localtime','-140 day')),
        ('seed-zahl-h05','seed-pat-005',79.0,'KARTE','BEZAHLT','seed-lei-008','Endo Konsil',datetime('now','localtime','-175 day')),
        ('seed-zahl-h06','seed-pat-006',49.0,'BAR','BEZAHLT','seed-lei-004','Kontrolle',datetime('now','localtime','-200 day')),
        ('seed-zahl-h07','seed-pat-007',230.0,'UEBERWEISUNG','BEZAHLT','seed-lei-003','Komposit + Polieren',datetime('now','localtime','-32 day')),
        ('seed-zahl-h08','seed-pat-008',99.0,'KARTE','BEZAHLT','seed-lei-001','PZR Recall',datetime('now','localtime','-12 day'))",
    ).execute(pool).await?;

    // Spread some demo termine across past months so termine_pro_monat is non-empty
    sqlx::query(
        "INSERT OR IGNORE INTO termin (id, datum, uhrzeit, art, status, notizen, beschwerden, patient_id, arzt_id, created_at) VALUES
        ('seed-ter-h01', date('now','localtime','-40 day'),  '09:00','UNTERSUCHUNG','DURCHGEFUEHRT','Routine','—','seed-pat-001','seed-arzt-001', datetime('now','localtime','-40 day')),
        ('seed-ter-h02', date('now','localtime','-70 day'),  '11:00','BEHANDLUNG','DURCHGEFUEHRT','Komposit',NULL,'seed-pat-002','seed-arzt-001', datetime('now','localtime','-70 day')),
        ('seed-ter-h03', date('now','localtime','-100 day'), '14:00','KONTROLLE','DURCHGEFUEHRT','Recall',NULL,'seed-pat-003','seed-arzt-001', datetime('now','localtime','-100 day')),
        ('seed-ter-h04', date('now','localtime','-130 day'), '08:30','BERATUNG','DURCHGEFUEHRT','Schiene',NULL,'seed-pat-004','seed-arzt-001', datetime('now','localtime','-130 day')),
        ('seed-ter-h05', date('now','localtime','-160 day'), '15:30','UNTERSUCHUNG','DURCHGEFUEHRT','PA-Status',NULL,'seed-pat-005','seed-arzt-001', datetime('now','localtime','-160 day')),
        ('seed-ter-h06', date('now','localtime','-25 day'),  '10:00','KONTROLLE','DURCHGEFUEHRT','Recall',NULL,'seed-pat-006','seed-arzt-001', datetime('now','localtime','-25 day')),
        ('seed-ter-h07', date('now','localtime','-90 day'),  '13:00','BEHANDLUNG','DURCHGEFUEHRT','Endo',NULL,'seed-pat-007','seed-arzt-001', datetime('now','localtime','-90 day')),
        ('seed-ter-h08', date('now','localtime','-180 day'), '16:00','BERATUNG','DURCHGEFUEHRT','Erst-Konsil',NULL,'seed-pat-008','seed-arzt-001', datetime('now','localtime','-180 day'))",
    ).execute(pool).await?;

    // Add behandlungen across months for behandlung-chart
    sqlx::query(
        "INSERT OR IGNORE INTO behandlung (
            id, akte_id, art, beschreibung, zaehne, material, notizen,
            kategorie, leistungsname, behandlungsnummer, sitzung,
            behandlung_status, gesamtkosten, termin_erforderlich, behandlung_datum
        ) VALUES
        ('seed-bh-h01','seed-akte-001','Kontrolluntersuchung','Recall','11',NULL,NULL,'Kontrolluntersuchung','Recall','201',1,'DURCHGEFUEHRT',49.0,0, date('now','localtime','-30 day')),
        ('seed-bh-h02','seed-akte-002','Parodontologie','PZR','—',NULL,NULL,'Parodontologie','PZR professionell','202',1,'DURCHGEFUEHRT',99.0,0, date('now','localtime','-65 day')),
        ('seed-bh-h03','seed-akte-003','Fuellungstherapie','Komposit 1-flaechig','16',NULL,NULL,'Fuellungstherapie','Komposit 1-flaechig','203',1,'DURCHGEFUEHRT',119.0,0, date('now','localtime','-95 day')),
        ('seed-bh-h04','seed-akte-004','Prothetik','Krone Zirkon','21',NULL,NULL,'Prothetik','Krone zirkon','204',2,'DURCHGEFUEHRT',890.0,0, date('now','localtime','-130 day')),
        ('seed-bh-h05','seed-akte-005','Chirurgie','Extraktion 38','38',NULL,NULL,'Chirurgie','Zahnextraktion','205',1,'DURCHGEFUEHRT',120.0,0, date('now','localtime','-160 day')),
        ('seed-bh-h06','seed-akte-006','Kontrolluntersuchung','Recall','11',NULL,NULL,'Kontrolluntersuchung','Recall','206',1,'DURCHGEFUEHRT',49.0,0, date('now','localtime','-15 day')),
        ('seed-bh-h07','seed-akte-007','Parodontologie','Taschentiefenmessung','—',NULL,NULL,'Parodontologie','Taschentiefenmessung','207',1,'DURCHGEFUEHRT',65.0,0, date('now','localtime','-50 day')),
        ('seed-bh-h08','seed-akte-008','Fuellungstherapie','Komposit 2-flaechig','17',NULL,NULL,'Fuellungstherapie','Komposit 2-flaechig','208',1,'DURCHGEFUEHRT',149.0,0, date('now','localtime','-110 day'))",
    ).execute(pool).await?;

    Ok(())
}
