-- Auto-extracted baseline schema (TASK 3.1)

CREATE TABLE IF NOT EXISTS personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL CHECK (rolle IN ('ARZT','REZEPTION','STEUERBERATER','PHARMABERATER')),
            taetigkeitsbereich TEXT,
            fachrichtung TEXT,
            telefon TEXT,
            verfuegbar BOOLEAN NOT NULL DEFAULT 1,
            totp_secret TEXT,
            totp_enrolled_at TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS personal_permission_override (
            personal_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            effect TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
            PRIMARY KEY (personal_id, action)
        );

CREATE INDEX IF NOT EXISTS idx_perm_ov_personal ON personal_permission_override(personal_id);

CREATE TABLE IF NOT EXISTS patient (
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
        );

CREATE TABLE IF NOT EXISTS patientenakte (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL UNIQUE REFERENCES patient(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'ENTWURF' CHECK (status IN ('ENTWURF','IN_BEARBEITUNG','VALIDIERT','READONLY')),
            diagnose TEXT,
            befunde TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS akte_anlage (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            rel_storage_path TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'SONSTIGES',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_akte_anlage_akte ON akte_anlage(akte_id);

CREATE TABLE IF NOT EXISTS termin (
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
        );

CREATE TABLE IF NOT EXISTS zahnbefund (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            zahn_nummer INTEGER NOT NULL,
            befund TEXT NOT NULL,
            diagnose TEXT,
            notizen TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS untersuchung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            beschwerden TEXT,
            ergebnisse TEXT,
            diagnose TEXT,
            untersuchungsnummer TEXT,
            kategorie TEXT,
            leistungsname TEXT,
            gesamtkosten REAL,
            freigegeben_von_arzt_id TEXT,
            freigegeben_am TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS behandlung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            art TEXT NOT NULL,
            beschreibung TEXT,
            zaehne TEXT,
            material TEXT,
            notizen TEXT,
            kategorie TEXT,
            leistungsname TEXT,
            behandlungsnummer TEXT,
            sitzung INTEGER,
            behandlung_status TEXT,
            gesamtkosten REAL,
            termin_erforderlich INTEGER,
            behandlung_datum TEXT,
            freigegeben_von_arzt_id TEXT,
            freigegeben_am TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS anamnesebogen (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            antworten TEXT NOT NULL DEFAULT '{}',
            unterschrieben BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS leistung (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            beschreibung TEXT,
            kategorie TEXT NOT NULL,
            preis REAL NOT NULL,
            aktiv BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS zahlung (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            betrag REAL NOT NULL,
            zahlungsart TEXT NOT NULL CHECK (zahlungsart IN ('BAR','KARTE','UEBERWEISUNG','RECHNUNG')),
            status TEXT NOT NULL DEFAULT 'AUSSTEHEND' CHECK (status IN ('AUSSTEHEND','BEZAHLT','TEILBEZAHLT','STORNIERT')),
            leistung_id TEXT REFERENCES leistung(id),
            beschreibung TEXT,
            behandlung_id TEXT,
            untersuchung_id TEXT,
            betrag_erwartet REAL,
            kasse_geprueft INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS produkt (
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
        );

CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            kategorie TEXT NOT NULL CHECK (kategorie IN ('feedback','vigilance','technical')),
            betreff TEXT NOT NULL,
            nachricht TEXT NOT NULL,
            referenz TEXT,
            status TEXT NOT NULL DEFAULT 'OFFEN' CHECK (status IN ('OFFEN','BEARBEITUNG','ERLEDIGT')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS bilanz_snapshot (
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
        );

CREATE TABLE IF NOT EXISTS tagesabschluss_protokoll (
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
        );

CREATE INDEX IF NOT EXISTS idx_tagesabschluss_protokoll_zeit
            ON tagesabschluss_protokoll (protokolliert_at DESC);

CREATE INDEX IF NOT EXISTS idx_tagesabschluss_protokoll_tag
            ON tagesabschluss_protokoll (stichtag);

CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS device_session (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_label TEXT NOT NULL,
            user_agent TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT
        );

CREATE INDEX IF NOT EXISTS idx_device_session_user ON device_session (user_id, ended_at);

CREATE TABLE IF NOT EXISTS bestellung (
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
        );

CREATE INDEX IF NOT EXISTS idx_bestellung_bestellnummer
            ON bestellung (bestellnummer);

CREATE INDEX IF NOT EXISTS idx_bestellung_lieferant
            ON bestellung (lieferant);

CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            prev_hash TEXT,
            hmac TEXT NOT NULL DEFAULT '',
            under_break_glass INTEGER NOT NULL DEFAULT 0,
            break_glass_reason TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS rezept (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            medikament TEXT NOT NULL,
            wirkstoff TEXT,
            dosierung TEXT NOT NULL,
            dauer TEXT NOT NULL,
            hinweise TEXT,
            pzn TEXT,
            darreichungsform TEXT,
            packungsgroesse TEXT,
            menge INTEGER,
            aut_idem BOOLEAN DEFAULT 1,
            rezept_typ TEXT DEFAULT 'PRIVAT',
            icd10_code TEXT,
            verordnender_arzt_id TEXT REFERENCES personal(id),
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            status TEXT NOT NULL DEFAULT 'AUSGESTELLT',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS attest (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            typ TEXT NOT NULL,
            inhalt TEXT NOT NULL,
            gueltig_von DATE NOT NULL,
            gueltig_bis DATE NOT NULL,
            icd10_code TEXT,
            erst_oder_folge TEXT DEFAULT 'ERST',
            arbeitgeber TEXT,
            ausstellender_arzt_id TEXT REFERENCES personal(id),
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS abwesenheit (
            id TEXT PRIMARY KEY,
            typ TEXT NOT NULL,
            kommentar TEXT,
            von_tag TEXT NOT NULL,
            bis_tag TEXT NOT NULL,
            von_uhrzeit TEXT,
            bis_uhrzeit TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS dokument_vorlage (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('REZEPT','ATTEST')),
            titel TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS behandlungs_katalog (
            id TEXT PRIMARY KEY,
            kategorie TEXT NOT NULL,
            name TEXT NOT NULL,
            default_kosten REAL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS lieferant_stamm (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS pharmaberater_stamm (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS lieferant_pharma_vorlage (
            id TEXT PRIMARY KEY,
            lieferant_id TEXT NOT NULL REFERENCES lieferant_stamm(id),
            pharmaberater_id TEXT NOT NULL REFERENCES pharmaberater_stamm(id),
            produkt_id TEXT NOT NULL REFERENCES produkt(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lieferant_id, pharmaberater_id, produkt_id)
        );

CREATE TABLE IF NOT EXISTS akte_validation (
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            section_or_item TEXT NOT NULL,
            validated_at TEXT NOT NULL,
            validated_by TEXT,
            PRIMARY KEY (patient_id, section_or_item)
        );

CREATE INDEX IF NOT EXISTS idx_akte_validation_patient ON akte_validation(patient_id);

CREATE TABLE IF NOT EXISTS akte_next_termin_hint (
            patient_id TEXT PRIMARY KEY REFERENCES patient(id) ON DELETE CASCADE,
            hint_json TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS in_app_notification (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            payload_json TEXT,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_in_app_notification_user ON in_app_notification(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS praxis_ticket (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            from_user_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            to_arzt_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OFFEN' CHECK (status IN ('OFFEN','IN_BEARBEITUNG','ERLEDIGT')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_praxis_ticket_arzt ON praxis_ticket(to_arzt_id, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_praxis_ticket_from ON praxis_ticket(from_user_id, datetime(created_at) DESC);

CREATE TABLE IF NOT EXISTS praxis_aufgabe (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
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
        );

CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_rezeption ON praxis_aufgabe(assignee_role, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_assignee ON praxis_aufgabe(assignee_user_id, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_creator ON praxis_aufgabe(created_by, status, datetime(updated_at) DESC);

CREATE TABLE IF NOT EXISTS dokument_template_user (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

CREATE INDEX IF NOT EXISTS idx_dokument_template_kind ON dokument_template_user(kind);

CREATE TABLE IF NOT EXISTS vertrag (
            id TEXT PRIMARY KEY,
            bezeichnung TEXT NOT NULL,
            partner TEXT NOT NULL,
            betrag REAL NOT NULL,
            intervall TEXT NOT NULL CHECK (intervall IN ('TAG','WOCHE','MONAT','JAHR')),
            unbefristet INTEGER NOT NULL CHECK (unbefristet IN (0,1)),
            periode_von TEXT,
            periode_bis TEXT,
            dokument_pfad TEXT,
            created_at TEXT NOT NULL
        );

CREATE TABLE IF NOT EXISTS rechnung_document (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            document_number TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            total_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL
        );

CREATE INDEX IF NOT EXISTS idx_rechnung_document_patient ON rechnung_document(patient_id);

CREATE INDEX IF NOT EXISTS idx_rechnung_document_created ON rechnung_document(created_at DESC);

CREATE TABLE IF NOT EXISTS rechnung_document_audit (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES rechnung_document(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            user_id TEXT NOT NULL,
            payload_excerpt TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_rechnung_doc_audit_doc ON rechnung_document_audit(document_id);

CREATE TABLE IF NOT EXISTS brute_force_lockout (
    key_hash TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brute_force_locked_until
    ON brute_force_lockout (locked_until);
