//! Incremental schema upgrades for databases created before sqlx file migrations.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

use super::seed;

pub async fn run_legacy_embedded_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL CHECK (rolle IN ('ARZT','REZEPTION','STEUERBERATER','PHARMABERATER')),
            taetigkeitsbereich TEXT,
            fachrichtung TEXT,
            telefon TEXT,
            verfuegbar BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS personal_permission_override (
            personal_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            effect TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
            PRIMARY KEY (personal_id, action)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_perm_ov_personal ON personal_permission_override(personal_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patient (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            geburtsdatum DATE NOT NULL,
            geschlecht TEXT NOT NULL CHECK (geschlecht IN ('MAENNLICH','WEIBLICH','DIVERS')),
            versicherungsnummer TEXT NOT NULL UNIQUE,
            telefon TEXT,
            email TEXT,
            adresse TEXT,
            status TEXT NOT NULL DEFAULT 'NEU' CHECK (status IN ('NEU','AKTIV','VALIDIERT','READONLY')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patientenakte (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL UNIQUE REFERENCES patient(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'ENTWURF' CHECK (status IN ('ENTWURF','IN_BEARBEITUNG','VALIDIERT','READONLY')),
            diagnose TEXT,
            befunde TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS akte_anlage (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            rel_storage_path TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'SONSTIGES',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_akte_anlage_akte ON akte_anlage(akte_id)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS termin (
            id TEXT PRIMARY KEY,
            datum TEXT NOT NULL,
            uhrzeit TEXT NOT NULL,
            art TEXT NOT NULL CHECK (art IN ('ERSTBESUCH','UNTERSUCHUNG','BEHANDLUNG','KONTROLLE','BERATUNG')),
            status TEXT NOT NULL DEFAULT 'GEPLANT' CHECK (status IN ('GEPLANT','BESTAETIGT','DURCHGEFUEHRT','NICHT_ERSCHIENEN','ABGESAGT')),
            notizen TEXT,
            beschwerden TEXT,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS zahnbefund (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            zahn_nummer INTEGER NOT NULL,
            befund TEXT NOT NULL,
            diagnose TEXT,
            notizen TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS untersuchung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            beschwerden TEXT,
            ergebnisse TEXT,
            diagnose TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS behandlung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            art TEXT NOT NULL,
            beschreibung TEXT,
            zaehne TEXT,
            material TEXT,
            notizen TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS anamnesebogen (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            antworten TEXT NOT NULL DEFAULT '{}',
            unterschrieben BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS leistung (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            beschreibung TEXT,
            kategorie TEXT NOT NULL,
            preis REAL NOT NULL,
            aktiv BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS zahlung (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            betrag REAL NOT NULL,
            zahlungsart TEXT NOT NULL CHECK (zahlungsart IN ('BAR','KARTE','UEBERWEISUNG','RECHNUNG')),
            status TEXT NOT NULL DEFAULT 'AUSSTEHEND' CHECK (status IN ('AUSSTEHEND','BEZAHLT','TEILBEZAHLT','STORNIERT')),
            leistung_id TEXT REFERENCES leistung(id),
            beschreibung TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS produkt (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            beschreibung TEXT,
            kategorie TEXT NOT NULL,
            preis REAL NOT NULL,
            bestand INTEGER NOT NULL DEFAULT 0,
            mindestbestand INTEGER NOT NULL DEFAULT 0,
            aktiv BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kategorie TEXT NOT NULL CHECK (kategorie IN ('feedback','vigilance','technical')),
            betreff TEXT NOT NULL,
            nachricht TEXT NOT NULL,
            referenz TEXT,
            status TEXT NOT NULL DEFAULT 'OFFEN' CHECK (status IN ('OFFEN','BEARBEITUNG','ERLEDIGT')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS bilanz_snapshot (
            id TEXT PRIMARY KEY,
            created_by TEXT NOT NULL,
            zeitraum TEXT NOT NULL,
            typ TEXT NOT NULL,
            label TEXT NOT NULL,
            einnahmen_cents INTEGER NOT NULL DEFAULT 0,
            ausgaben_cents INTEGER NOT NULL DEFAULT 0,
            saldo_cents INTEGER NOT NULL DEFAULT 0,
            payload TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS tagesabschluss_protokoll (
            id TEXT PRIMARY KEY,
            stichtag TEXT NOT NULL,
            gezaehlt_eur REAL,
            bar_laut_system_eur REAL NOT NULL,
            einnahmen_laut_system_eur REAL NOT NULL,
            abweichung_eur REAL,
            bar_stimmt INTEGER NOT NULL DEFAULT 0,
            anzahl_zahlungen_tag INTEGER NOT NULL DEFAULT 0,
            anzahl_kasse_geprueft INTEGER NOT NULL DEFAULT 0,
            alle_zahlungen_geprueft INTEGER NOT NULL DEFAULT 0,
            notiz TEXT,
            protokolliert_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_tagesabschluss_protokoll_zeit
            ON tagesabschluss_protokoll (protokolliert_at DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_tagesabschluss_protokoll_tag
            ON tagesabschluss_protokoll (stichtag)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS device_session (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_label TEXT NOT NULL,
            user_agent TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT,
            trusted_at TEXT
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_device_session_user ON device_session (user_id, ended_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS bestellung (
            id TEXT PRIMARY KEY,
            bestellnummer TEXT,
            lieferant TEXT NOT NULL,
            pharmaberater TEXT,
            artikel TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OFFEN'
                CHECK (status IN ('OFFEN','UNTERWEGS','GELIEFERT','STORNIERT')),
            erwartet_am DATE,
            geliefert_am DATE,
            menge INTEGER NOT NULL DEFAULT 1,
            einheit TEXT,
            bemerkung TEXT,
            gesamtbetrag REAL,
            created_by TEXT NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    // Forward migration for older installs that pre-date bestellnummer/pharmaberater.
    for (sql, col) in [
        (
            "ALTER TABLE bestellung ADD COLUMN bestellnummer TEXT",
            "bestellnummer",
        ),
        (
            "ALTER TABLE bestellung ADD COLUMN pharmaberater TEXT",
            "pharmaberater",
        ),
        (
            "ALTER TABLE bestellung ADD COLUMN gesamtbetrag REAL",
            "gesamtbetrag",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bestellung_bestellnummer
            ON bestellung (bestellnummer)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_bestellung_lieferant
            ON bestellung (lieferant)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            prev_hash TEXT,
            hmac TEXT NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rezept (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            medikament TEXT NOT NULL,
            wirkstoff TEXT,
            dosierung TEXT NOT NULL,
            dauer TEXT NOT NULL,
            hinweise TEXT,
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            status TEXT NOT NULL DEFAULT 'AUSGESTELLT',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [
        ("ALTER TABLE rezept ADD COLUMN pzn TEXT", "pzn"),
        (
            "ALTER TABLE rezept ADD COLUMN darreichungsform TEXT",
            "darreichungsform",
        ),
        (
            "ALTER TABLE rezept ADD COLUMN packungsgroesse TEXT",
            "packungsgroesse",
        ),
        ("ALTER TABLE rezept ADD COLUMN menge INTEGER", "menge"),
        (
            "ALTER TABLE rezept ADD COLUMN aut_idem BOOLEAN DEFAULT 1",
            "aut_idem",
        ),
        (
            "ALTER TABLE rezept ADD COLUMN rezept_typ TEXT DEFAULT 'PRIVAT'",
            "rezept_typ",
        ),
        (
            "ALTER TABLE rezept ADD COLUMN icd10_code TEXT",
            "icd10_code",
        ),
        (
            "ALTER TABLE rezept ADD COLUMN verordnender_arzt_id TEXT REFERENCES personal(id)",
            "verordnender_arzt_id",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS attest (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            typ TEXT NOT NULL,
            inhalt TEXT NOT NULL,
            gueltig_von DATE NOT NULL,
            gueltig_bis DATE NOT NULL,
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [
        (
            "ALTER TABLE attest ADD COLUMN icd10_code TEXT",
            "icd10_code",
        ),
        (
            "ALTER TABLE attest ADD COLUMN erst_oder_folge TEXT DEFAULT 'ERST'",
            "erst_oder_folge",
        ),
        (
            "ALTER TABLE attest ADD COLUMN arbeitgeber TEXT",
            "arbeitgeber",
        ),
        (
            "ALTER TABLE attest ADD COLUMN ausstellender_arzt_id TEXT REFERENCES personal(id)",
            "ausstellender_arzt_id",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS abwesenheit (
            id TEXT PRIMARY KEY,
            typ TEXT NOT NULL,
            kommentar TEXT,
            von_tag TEXT NOT NULL,
            bis_tag TEXT NOT NULL,
            von_uhrzeit TEXT,
            bis_uhrzeit TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS dokument_vorlage (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('REZEPT','ATTEST')),
            titel TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS behandlungs_katalog (
            id TEXT PRIMARY KEY,
            kategorie TEXT NOT NULL,
            name TEXT NOT NULL,
            default_kosten REAL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS lieferant_stamm (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pharmaberater_stamm (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS lieferant_pharma_vorlage (
            id TEXT PRIMARY KEY,
            lieferant_id TEXT NOT NULL REFERENCES lieferant_stamm(id),
            pharmaberater_id TEXT NOT NULL REFERENCES pharmaberater_stamm(id),
            produkt_id TEXT NOT NULL REFERENCES produkt(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lieferant_id, pharmaberater_id, produkt_id)
        )",
    )
    .execute(pool)
    .await?;

    // Upgrades: older DBs had UNIQUE(lieferant, pharmaberater) only; rebuild when produkt_id is missing
    // (Schnellwahl-Kombinationen ohne Produkt mapping sind nicht portierbar; Tabelle ggf. leer).
    let produkt_id_col: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('lieferant_pharma_vorlage') WHERE name = 'produkt_id'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if produkt_id_col == 0 {
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE IF EXISTS lieferant_pharma_vorlage")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE TABLE lieferant_pharma_vorlage (
            id TEXT PRIMARY KEY,
            lieferant_id TEXT NOT NULL REFERENCES lieferant_stamm(id),
            pharmaberater_id TEXT NOT NULL REFERENCES pharmaberater_stamm(id),
            produkt_id TEXT NOT NULL REFERENCES produkt(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lieferant_id, pharmaberater_id, produkt_id)
        )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    for (sql, col) in [
        (
            "ALTER TABLE behandlung ADD COLUMN kategorie TEXT",
            "kategorie",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN leistungsname TEXT",
            "leistungsname",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN behandlungsnummer TEXT",
            "behandlungsnummer",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN sitzung INTEGER",
            "sitzung",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN behandlung_status TEXT",
            "behandlung_status",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN gesamtkosten REAL",
            "gesamtkosten",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN termin_erforderlich INTEGER",
            "termin_erforderlich",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN behandlung_datum TEXT",
            "behandlung_datum",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN freigegeben_von_arzt_id TEXT",
            "freigegeben_von_arzt_id_beh",
        ),
        (
            "ALTER TABLE behandlung ADD COLUMN freigegeben_am TEXT",
            "freigegeben_am_beh",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    for (sql, col) in [
        (
            "ALTER TABLE untersuchung ADD COLUMN untersuchungsnummer TEXT",
            "untersuchungsnummer",
        ),
        (
            "ALTER TABLE untersuchung ADD COLUMN freigegeben_von_arzt_id TEXT",
            "freigegeben_von_arzt_id_u",
        ),
        (
            "ALTER TABLE untersuchung ADD COLUMN freigegeben_am TEXT",
            "freigegeben_am_u",
        ),
        (
            "ALTER TABLE untersuchung ADD COLUMN kategorie TEXT",
            "kategorie_u",
        ),
        (
            "ALTER TABLE untersuchung ADD COLUMN leistungsname TEXT",
            "leistungsname_u",
        ),
        (
            "ALTER TABLE untersuchung ADD COLUMN gesamtkosten REAL",
            "gesamtkosten_u",
        ),
        (
            "ALTER TABLE zahlung ADD COLUMN behandlung_id TEXT",
            "behandlung_id",
        ),
        (
            "ALTER TABLE zahlung ADD COLUMN untersuchung_id TEXT",
            "untersuchung_id",
        ),
        (
            "ALTER TABLE zahlung ADD COLUMN betrag_erwartet REAL",
            "betrag_erwartet",
        ),
        (
            "ALTER TABLE zahlung ADD COLUMN kasse_geprueft INTEGER NOT NULL DEFAULT 0",
            "kasse_geprueft",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    for (sql, col) in [
        (
            "ALTER TABLE audit_log ADD COLUMN under_break_glass INTEGER NOT NULL DEFAULT 0",
            "under_break_glass",
        ),
        (
            "ALTER TABLE audit_log ADD COLUMN break_glass_reason TEXT",
            "break_glass_reason",
        ),
        (
            "ALTER TABLE personal ADD COLUMN totp_secret TEXT",
            "totp_secret",
        ),
        (
            "ALTER TABLE personal ADD COLUMN totp_enrolled_at TEXT",
            "totp_enrolled_at",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    // Forward migration for installs that pre-date the HMAC chain.
    for (sql, col) in [
        (
            "ALTER TABLE audit_log ADD COLUMN prev_hash TEXT",
            "prev_hash",
        ),
        (
            "ALTER TABLE audit_log ADD COLUMN hmac TEXT NOT NULL DEFAULT ''",
            "hmac",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    for (sql, col) in [(
        "ALTER TABLE akte_anlage ADD COLUMN document_kind TEXT NOT NULL DEFAULT 'SONSTIGES'",
        "document_kind",
    )] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    // Seed default admin user if no personal exists
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM personal")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        let hash = bcrypt::hash("passwort123", 12)
            .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle, fachrichtung)
             VALUES ('seed-arzt-001', 'Dr. Ahmed R.', 'ahmed@praxis.de', ?1, 'ARZT', 'Zahnmedizin')"
        )
        .bind(&hash)
        .execute(pool)
        .await?;

        let hash2 = bcrypt::hash("passwort123", 12)
            .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle)
             VALUES ('seed-rez-001', 'Aya M.', 'aya@praxis.de', ?1, 'REZEPTION')",
        )
        .bind(&hash2)
        .execute(pool)
        .await?;
    }

    // FA-LEIST-05: einmalige Legacy-Freigabe für Altbestände (`app_kv`-Schlüssel verhindert Überschreiben neuer Zeilen).
    let ins = sqlx::query(
        "INSERT OR IGNORE INTO app_kv (key, value) VALUES ('migration.billing_freigabe_legacy_v1', '1')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if ins.rows_affected() > 0 {
        let _ = sqlx::query(
            r#"UPDATE behandlung SET
                 freigegeben_von_arzt_id = COALESCE(
                   freigegeben_von_arzt_id,
                   (SELECT id FROM personal WHERE rolle = 'ARZT' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 freigegeben_am = COALESCE(
                   freigegeben_am,
                   COALESCE(NULLIF(TRIM(behandlung_datum), ''), datetime(created_at))
                 )
               WHERE freigegeben_von_arzt_id IS NULL OR freigegeben_am IS NULL"#,
        )
        .execute(pool)
        .await;

        let _ = sqlx::query(
            r#"UPDATE untersuchung SET
                 freigegeben_von_arzt_id = COALESCE(
                   freigegeben_von_arzt_id,
                   (SELECT id FROM personal WHERE rolle = 'ARZT' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 freigegeben_am = COALESCE(freigegeben_am, datetime(created_at))
               WHERE freigegeben_von_arzt_id IS NULL OR freigegeben_am IS NULL"#,
        )
        .execute(pool)
        .await;
    }

    // Patient-scoped clinical / workflow state (replaces browser localStorage; DSGVO-erased with patient).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS akte_validation (
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            section_or_item TEXT NOT NULL,
            validated_at TEXT NOT NULL,
            validated_by TEXT,
            PRIMARY KEY (patient_id, section_or_item)
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_akte_validation_patient ON akte_validation(patient_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS akte_next_termin_hint (
            patient_id TEXT PRIMARY KEY REFERENCES patient(id) ON DELETE CASCADE,
            hint_json TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS in_app_notification (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            payload_json TEXT,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_in_app_notification_user ON in_app_notification(user_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS praxis_ticket (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            from_user_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            to_arzt_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OFFEN' CHECK (status IN ('OFFEN','IN_BEARBEITUNG','ERLEDIGT')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_ticket_arzt ON praxis_ticket(to_arzt_id, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_ticket_from ON praxis_ticket(from_user_id, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS praxis_aufgabe (
            id TEXT PRIMARY KEY,
            patient_id TEXT REFERENCES patient(id) ON DELETE SET NULL,
            typ TEXT NOT NULL DEFAULT 'SONSTIGES',
            titel TEXT NOT NULL,
            body TEXT,
            assignee_role TEXT,
            assignee_user_id TEXT REFERENCES personal(id) ON DELETE SET NULL,
            created_by TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            behandlung_id TEXT,
            untersuchung_id TEXT,
            leistungsname TEXT,
            gesamtkosten REAL,
            zahlung_id TEXT,
            erledigt_notiz TEXT,
            zurueck_begruendung TEXT,
            status TEXT NOT NULL DEFAULT 'OFFEN',
            legacy_ticket_id TEXT UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_rezeption ON praxis_aufgabe(assignee_role, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_assignee ON praxis_aufgabe(assignee_user_id, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_creator ON praxis_aufgabe(created_by, status, datetime(updated_at) DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS praxis_aufgabe_kommentar (
            id TEXT PRIMARY KEY,
            aufgabe_id TEXT NOT NULL REFERENCES praxis_aufgabe(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_kommentar_aufgabe
         ON praxis_aufgabe_kommentar(aufgabe_id, datetime(created_at) ASC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS dokument_template_user (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_dokument_template_kind ON dokument_template_user(kind)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS vertrag (
            id TEXT PRIMARY KEY,
            bezeichnung TEXT NOT NULL,
            partner TEXT NOT NULL,
            betrag REAL NOT NULL,
            intervall TEXT NOT NULL CHECK (intervall IN ('TAG','WOCHE','MONAT','JAHR')),
            unbefristet INTEGER NOT NULL CHECK (unbefristet IN (0,1)),
            periode_von TEXT,
            periode_bis TEXT,
            created_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [(
        "ALTER TABLE vertrag ADD COLUMN dokument_pfad TEXT",
        "dokument_pfad",
    )] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rechnung_document (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            document_number TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            total_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_rechnung_document_patient ON rechnung_document(patient_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_rechnung_document_created ON rechnung_document(created_at DESC)",
    )
    .execute(pool)
    .await?;

    // GoBD-oriented append-only trail for issued invoice documents (in addition to audit_log).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS rechnung_document_audit (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES rechnung_document(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            user_id TEXT NOT NULL,
            payload_excerpt TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_rechnung_doc_audit_doc ON rechnung_document_audit(document_id)",
    )
    .execute(pool)
    .await?;

    seed::run_post_migration_seed(pool).await?;

    Ok(())
}
