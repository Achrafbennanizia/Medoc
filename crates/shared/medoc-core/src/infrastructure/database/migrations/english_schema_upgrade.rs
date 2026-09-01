//! Idempotent English schema upgrade for databases created before the
//! identifier conversion (German table/column/enum wires, or camelCase
//! `serviceItem` / `purchaseOrder`).
//!
//! Also remaps leftover German keys inside stored JSON (`app_kv`,
//! `document_template.payload`) and Englishifies appointment note markers
//! (`Dauer:` → `Duration:`, toothache fragments) so English-only readers
//! load existing installs after dual-read removal.
//!
//! Fresh databases created from `0001_initial_schema.sql` already use English
//! snake_case names; this step is a no-op for them.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

const TABLE_RENAMES: &[(&str, &str)] = &[
    ("personal_permission_override", "staff_permission_override"),
    ("tagesabschluss_protokoll", "day_close_protocol"),
    ("lieferant_pharma_vorlage", "supplier_pharma_template"),
    ("behandlungs_katalog", "treatment_catalog"),
    ("dokument_vorlage", "document_template"),
    ("dokument_template_user", "document_template_user"),
    ("praxis_aufgabe_kommentar", "practice_task_comment"),
    ("praxis_aufgabe", "practice_task"),
    ("praxis_ticket", "practice_ticket"),
    ("patientenakte", "patient_chart"),
    ("akte_anlage", "chart_attachment"),
    ("akte_validation", "chart_validation"),
    ("akte_next_termin_hint", "chart_next_appointment_hint"),
    ("zahnbefund", "dental_finding"),
    ("untersuchung", "examination"),
    ("behandlung", "treatment"),
    ("bestellung", "purchase_order"),
    ("purchaseOrder", "purchase_order"),
    ("bilanz_snapshot", "balance_sheet_snapshot"),
    ("anamnesebogen", "anamnesis_form"),
    ("krankenbescheinigung", "sick_leave_certificate"),
    ("personal", "staff"),
    ("zahlung", "payment"),
    ("leistung", "service_item"),
    ("serviceItem", "service_item"),
    ("rezept", "prescription"),
    ("attest", "certificate"),
    ("produkt", "product"),
    ("termin", "appointment"),
    ("vertrag", "contract"),
    ("rechnung_document_audit", "invoice_document_audit"),
    ("rechnung_document", "invoice_document"),
    ("patienten", "patient"),
    ("lizenz", "license"),
    ("geraet_blocklist", "device_blocklist"),
];

/// `(table, old_column, new_column)` — applied after table renames.
const COLUMN_RENAMES: &[(&str, &str, &str)] = &[
    ("staff", "passwort_hash", "password_hash"),
    ("staff", "rolle", "role"),
    ("staff", "taetigkeitsbereich", "activity_area"),
    ("staff", "fachrichtung", "specialty"),
    ("staff", "verfuegbar", "available"),
    ("staff", "telefon", "phone"),
    ("patient", "geburtsdatum", "date_of_birth"),
    ("patient", "geschlecht", "sex"),
    ("patient", "versicherungsnummer", "insurance_number"),
    ("patient", "telefon", "phone"),
    ("patient", "adresse", "address"),
    ("appointment", "datum", "date"),
    ("appointment", "uhrzeit", "time"),
    ("appointment", "art", "kind"),
    ("appointment", "arzt_id", "physician_id"),
    ("appointment", "notizen", "notes"),
    ("appointment", "beschwerden", "chief_complaint"),
    ("payment", "betrag", "amount"),
    ("payment", "zahlungsart", "payment_method"),
    ("payment", "leistung_id", "service_item_id"),
    ("payment", "beschreibung", "description"),
    ("payment", "betrag_erwartet", "amount_expected"),
    ("payment", "kasse_geprueft", "cash_verified"),
    ("service_item", "bezeichnung", "name"),
    ("service_item", "kategorie", "category"),
    ("service_item", "preis", "price"),
    ("service_item", "aktiv", "active"),
    ("service_item", "beschreibung", "description"),
    ("purchase_order", "lieferant", "supplier"),
    ("purchase_order", "artikel", "item"),
    ("purchase_order", "menge", "quantity"),
    ("purchase_order", "einheit", "unit"),
    ("purchase_order", "bemerkung", "remark"),
    ("purchase_order", "gesamtbetrag", "total_amount"),
    ("purchase_order", "erwartet_am", "expected_on"),
    ("certificate", "art", "kind"),
    ("certificate", "inhalt", "body_text"),
    ("certificate", "gueltig_von", "valid_from"),
    ("certificate", "gueltig_bis", "valid_until"),
    ("certificate", "arzt_id", "physician_id"),
    ("certificate", "ausstellender_arzt_id", "issuing_physician_id"),
    ("certificate", "arbeitgeber", "employer"),
    ("prescription", "arzt_id", "physician_id"),
    ("prescription", "medikament", "medication"),
    ("prescription", "wirkstoff", "active_ingredient"),
    ("prescription", "dosierung", "dosage"),
    ("prescription", "dauer", "duration"),
    ("prescription", "hinweise", "instructions"),
    ("prescription", "verordnender_arzt_id", "prescribing_physician_id"),
    ("chart_attachment", "dokument_art", "document_kind"),
    ("treatment", "art", "kind"),
    ("treatment", "beschreibung", "description"),
    ("treatment", "zaehne", "teeth"),
    ("treatment", "notizen", "notes"),
    ("treatment", "kategorie", "category"),
    ("treatment", "freigegeben_von_arzt_id", "released_by_physician_id"),
    ("treatment", "freigegeben_am", "released_at"),
    ("examination", "beschwerden", "chief_complaint"),
    ("examination", "freigegeben_von_arzt_id", "released_by_physician_id"),
    ("examination", "freigegeben_am", "released_at"),
    ("patient_chart", "befunde", "findings"),
    ("patient_chart", "diagnose", "diagnosis"),
    ("anamnesis_form", "antworten", "answers"),
    ("anamnesis_form", "unterschrieben", "signed"),
    ("dental_finding", "zahn_nummer", "tooth_number"),
    ("dental_finding", "befund", "finding"),
    ("dental_finding", "diagnose", "diagnosis"),
    ("sync_device", "geraet_status", "device_status"),
    ("pairing_request", "kopplung_state", "pairing_state"),
    ("practice_task", "done_notiz", "done_note"),
    ("day_close_protocol", "stichtag", "as_of_date"),
    ("day_close_protocol", "gezaehlt_eur", "counted_eur"),
    ("day_close_protocol", "bar_laut_system_eur", "system_cash_eur"),
    ("day_close_protocol", "einnahmen_laut_system_eur", "system_income_eur"),
    ("day_close_protocol", "income_laut_system_eur", "system_income_eur"),
    ("day_close_protocol", "abweichung_eur", "variance_eur"),
    ("day_close_protocol", "bar_stimmt", "cash_matches"),
    ("day_close_protocol", "anzahl_zahlungen_tag", "day_payment_count"),
    ("day_close_protocol", "anzahl_payments_tag", "day_payment_count"),
    ("day_close_protocol", "anzahl_kasse_geprueft", "cash_verified_count"),
    ("day_close_protocol", "anzahl_cash_geprueft", "cash_verified_count"),
    ("day_close_protocol", "alle_zahlungen_geprueft", "all_payments_verified"),
    ("day_close_protocol", "alle_payments_geprueft", "all_payments_verified"),
    ("day_close_protocol", "notiz", "note"),
    ("day_close_protocol", "protokolliert_at", "recorded_at"),
];

const ENUM_UPDATES: &[(&str, &str, &[(&str, &str)])] = &[
    (
        "staff",
        "role",
        &[
            ("ARZT", "PHYSICIAN"),
            ("REZEPTION", "RECEPTION"),
            ("STEUERBERATER", "TAX_ADVISOR"),
            ("PHARMABERATER", "PHARMA_CONSULTANT"),
        ],
    ),
    (
        "patient",
        "sex",
        &[
            ("MAENNLICH", "MALE"),
            ("WEIBLICH", "FEMALE"),
            ("DIVERS", "DIVERSE"),
        ],
    ),
    (
        "patient",
        "status",
        &[
            ("NEU", "NEW"),
            ("AKTIV", "ACTIVE"),
            ("VALIDIERT", "VALIDATED"),
        ],
    ),
    (
        "patient_chart",
        "status",
        &[
            ("ENTWURF", "DRAFT"),
            ("IN_BEARBEITUNG", "IN_PROGRESS"),
            ("VALIDIERT", "VALIDATED"),
        ],
    ),
    (
        "appointment",
        "kind",
        &[
            ("ERSTBESUCH", "FIRST_VISIT"),
            ("UNTERSUCHUNG", "EXAMINATION"),
            ("BEHANDLUNG", "TREATMENT"),
            ("KONTROLLE", "CHECKUP"),
            ("BERATUNG", "CONSULTATION"),
        ],
    ),
    (
        "appointment",
        "status",
        &[
            ("GEPLANT", "PLANNED"),
            ("BESTAETIGT", "CONFIRMED"),
            ("DURCHGEFUEHRT", "COMPLETED"),
            ("NICHT_ERSCHIENEN", "NO_SHOW"),
            ("ABGESAGT", "CANCELLED"),
            ("STORNIERT", "CANCELLED"),
        ],
    ),
    (
        "payment",
        "payment_method",
        &[
            ("BAR", "CASH"),
            ("KARTE", "CARD"),
            ("UEBERWEISUNG", "BANK_TRANSFER"),
            ("RECHNUNG", "INVOICE"),
        ],
    ),
    (
        "payment",
        "status",
        &[
            ("AUSSTEHEND", "OUTSTANDING"),
            ("BEZAHLT", "PAID"),
            ("TEILBEZAHLT", "PARTIALLY_PAID"),
            ("STORNIERT", "CANCELLED"),
        ],
    ),
    (
        "prescription",
        "status",
        &[("AUSGESTELLT", "ISSUED"), ("STORNIERT", "CANCELLED")],
    ),
    (
        "certificate",
        "kind",
        &[
            ("ARBEITSUNFAEHIGKEIT", "SICK_LEAVE"),
            ("SPORTBEFREIUNG", "SPORTS_EXEMPTION"),
            ("SCHULBEFREIUNG", "SCHOOL_EXEMPTION"),
            ("BEHANDLUNGSBESTAETIGUNG", "TREATMENT_CONFIRMATION"),
            ("SONSTIGES", "OTHER"),
        ],
    ),
    (
        "certificate",
        "first_or_follow_up",
        &[("ERST", "FIRST"), ("FOLGE", "FOLLOW_UP")],
    ),
    (
        "chart_attachment",
        "document_kind",
        &[
            ("UEBERWEISUNG", "REFERRAL"),
            ("BANK_TRANSFER", "REFERRAL"),
        ],
    ),
    (
        "practice_task",
        "kind",
        &[
            ("TERMIN", "APPOINTMENT"),
            ("DRUCK", "PRINT"),
            ("ABRECHNUNG", "BILLING"),
            ("STAMMDATEN", "MASTER_DATA"),
            ("SONSTIGES", "OTHER"),
        ],
    ),
    (
        "document_template",
        "kind",
        &[("REZEPT", "PRESCRIPTION"), ("ATTEST", "CERTIFICATE")],
    ),
];

const GERMAN_CHECK_TOKENS: &[&str] = &[
    "'ARZT'",
    "'REZEPTION'",
    "'STEUERBERATER'",
    "'PHARMABERATER'",
    "'GEPLANT'",
    "'MAENNLICH'",
    "'WEIBLICH'",
    "'AUSSTEHEND'",
    "'ERSTBESUCH'",
    "'NICHT_ERSCHIENEN'",
    "'AUSGESTELLT'",
    "'ENTWURF'",
    "'IN_BEARBEITUNG'",
    "'BESTAETIGT'",
    "'DURCHGEFUEHRT'",
    "'ABGESAGT'",
    "'STORNIERT'",
    "'BAR'",
    "'KARTE'",
    "'UEBERWEISUNG'",
    "'ERST'",
    "'FOLGE'",
    "'AKTIV'",
    "'NEU'",
    "'VALIDIERT'",
    "'BEZAHLT'",
    "'TEILBEZAHLT'",
    "'RECHNUNG'",
    "'DIVERS'",
    "'KONTROLLE'",
    "'BERATUNG'",
    "'UNTERSUCHUNG'",
    "'BEHANDLUNG'",
    "'REZEPT'",
    "'ATTEST'",
];

const OUTBOX_TABLE_RENAMES: &[(&str, &str)] = &[
    ("personal", "staff"),
    ("termin", "appointment"),
    ("patientenakte", "patient_chart"),
    ("zahlung", "payment"),
    ("leistung", "service_item"),
    ("serviceItem", "service_item"),
    ("rezept", "prescription"),
    ("attest", "certificate"),
    ("untersuchung", "examination"),
    ("behandlung", "treatment"),
    ("anamnesebogen", "anamnesis_form"),
    ("zahnbefund", "dental_finding"),
    ("praxis_aufgabe", "practice_task"),
    ("praxis_ticket", "practice_ticket"),
];

/// Detect any pre-English or already-English core table so we do not re-apply
/// sqlx `0001` on top of a populated (possibly German) database.
pub async fn schema_already_present(pool: &SqlitePool) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master
         WHERE type = 'table'
           AND name IN (
             'patient', 'patienten',
             'staff', 'personal',
             'appointment', 'termin'
           )",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n > 0)
}

pub async fn run_english_schema_upgrade(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query("PRAGMA foreign_keys = OFF")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

    for (old, new) in TABLE_RENAMES {
        rename_table_if_needed(pool, old, new).await?;
    }
    for (table, old, new) in COLUMN_RENAMES {
        rename_column_if_needed(pool, table, old, new).await?;
    }

    let tables: Vec<String> =
        sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    for table in tables {
        if table_ddl_has_german_check(pool, &table).await? {
            rebuild_table_without_checks(pool, &table).await?;
        }
    }

    apply_enum_updates(pool).await?;
    apply_category_and_copy_updates(pool).await?;
    apply_outbox_table_renames(pool).await?;
    apply_stored_json_english_upgrade(pool).await?;
    apply_appointment_text_english_upgrade(pool).await?;

    if table_exists(pool, "day_close_protocol").await? {
        sqlx::query("DROP INDEX IF EXISTS idx_day_close_protocol_tag")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_day_close_protocol_as_of_date ON day_close_protocol (as_of_date)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn table_exists(pool: &SqlitePool, name: &str) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
    )
    .bind(name)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n > 0)
}

async fn column_exists(pool: &SqlitePool, table: &str, column: &str) -> Result<bool, AppError> {
    if !table_exists(pool, table).await? {
        return Ok(false);
    }
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
    )
    .bind(table)
    .bind(column)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n > 0)
}

async fn rename_table_if_needed(pool: &SqlitePool, old: &str, new: &str) -> Result<(), AppError> {
    if old == new || !table_exists(pool, old).await? {
        return Ok(());
    }
    if !table_exists(pool, new).await? {
        let sql = format!("ALTER TABLE \"{old}\" RENAME TO \"{new}\"");
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        tracing::info!(
            target: "medoc::system",
            event = "SCHEMA_TABLE_RENAMED",
            old,
            new
        );
        return Ok(());
    }

    let new_count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{new}\""))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if new_count == 0 {
        sqlx::query(&format!("DROP TABLE \"{new}\""))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(&format!("ALTER TABLE \"{old}\" RENAME TO \"{new}\""))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        tracing::info!(
            target: "medoc::system",
            event = "SCHEMA_TABLE_RENAMED_REPLACED_EMPTY",
            old,
            new
        );
        return Ok(());
    }

    let old_cols = column_names(pool, old).await?;
    let new_cols = column_names(pool, new).await?;
    let common: Vec<String> = old_cols
        .into_iter()
        .filter(|c| new_cols.iter().any(|n| n == c))
        .collect();
    if !common.is_empty() {
        let list = common
            .iter()
            .map(|c| format!("\"{c}\""))
            .collect::<Vec<_>>()
            .join(", ");
        let sql = format!("INSERT OR IGNORE INTO \"{new}\" ({list}) SELECT {list} FROM \"{old}\"");
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    sqlx::query(&format!("DROP TABLE \"{old}\""))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::system",
        event = "SCHEMA_TABLE_MERGED_AND_DROPPED",
        old,
        new
    );
    Ok(())
}

async fn rename_column_if_needed(
    pool: &SqlitePool,
    table: &str,
    old: &str,
    new: &str,
) -> Result<(), AppError> {
    if old == new || !column_exists(pool, table, old).await? {
        return Ok(());
    }
    if column_exists(pool, table, new).await? {
        return Ok(());
    }
    let sql = format!("ALTER TABLE \"{table}\" RENAME COLUMN \"{old}\" TO \"{new}\"");
    sqlx::query(&sql)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::system",
        event = "SCHEMA_COLUMN_RENAMED",
        table,
        old,
        new
    );
    Ok(())
}

async fn column_names(pool: &SqlitePool, table: &str) -> Result<Vec<String>, AppError> {
    sqlx::query_scalar("SELECT name FROM pragma_table_info(?1)")
        .bind(table)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
}

async fn table_ddl_has_german_check(pool: &SqlitePool, table: &str) -> Result<bool, AppError> {
    let sql: Option<String> =
        sqlx::query_scalar("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .bind(table)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(sql
        .as_deref()
        .is_some_and(|s| GERMAN_CHECK_TOKENS.iter().any(|tok| s.contains(tok))))
}

async fn rebuild_table_without_checks(pool: &SqlitePool, table: &str) -> Result<(), AppError> {
    // pragma_table_info: name, notnull, dflt_value, pk (affinity is not required;
    // SQLite will coerce on insert from the copied rows).
    let cols: Vec<(String, i64, Option<String>, i64)> = sqlx::query_as(
        "SELECT name, \"notnull\", dflt_value, pk FROM pragma_table_info(?1)",
    )
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(());
    }

    let index_sqls: Vec<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?1 AND sql IS NOT NULL",
    )
    .bind(table)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    let tmp = format!("{table}__en_upgrade");
    let pk_cols: Vec<&str> = cols
        .iter()
        .filter(|c| c.3 > 0)
        .map(|c| c.0.as_str())
        .collect();
    let mut defs: Vec<String> = Vec::new();
    for c in &cols {
        let name = &c.0;
        let notnull = c.1;
        let dflt_value = &c.2;
        let pk = c.3;
        let mut def = format!("\"{name}\" TEXT");
        if pk_cols.len() == 1 && pk > 0 {
            def.push_str(" PRIMARY KEY");
        } else if notnull != 0 && pk == 0 {
            def.push_str(" NOT NULL");
        }
        if let Some(dflt) = dflt_value {
            def.push_str(" DEFAULT ");
            def.push_str(dflt);
        }
        defs.push(def);
    }
    if pk_cols.len() > 1 {
        let pk = pk_cols
            .iter()
            .map(|n| format!("\"{n}\""))
            .collect::<Vec<_>>()
            .join(", ");
        defs.push(format!("PRIMARY KEY ({pk})"));
    }

    sqlx::query(&format!("DROP TABLE IF EXISTS \"{tmp}\""))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(&format!(
        "CREATE TABLE \"{tmp}\" ({})",
        defs.join(", ")
    ))
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let col_list = cols
        .iter()
        .map(|c| format!("\"{}\"", c.0))
        .collect::<Vec<_>>()
        .join(", ");
    sqlx::query(&format!(
        "INSERT INTO \"{tmp}\" ({col_list}) SELECT {col_list} FROM \"{table}\""
    ))
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(&format!("DROP TABLE \"{table}\""))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(&format!("ALTER TABLE \"{tmp}\" RENAME TO \"{table}\""))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

    for idx in index_sqls {
        if let Err(e) = sqlx::query(&idx).execute(pool).await {
            tracing::debug!(
                target: "medoc::system",
                event = "SCHEMA_INDEX_RECREATE_SKIP",
                table,
                error = %e
            );
        }
    }
    tracing::info!(
        target: "medoc::system",
        event = "SCHEMA_TABLE_REBUILT_DROP_GERMAN_CHECKS",
        table
    );
    Ok(())
}

async fn apply_enum_updates(pool: &SqlitePool) -> Result<(), AppError> {
    for (table, column, pairs) in ENUM_UPDATES {
        if !column_exists(pool, table, column).await? {
            continue;
        }
        let mut cases = String::new();
        for (from, to) in *pairs {
            cases.push_str(&format!(" WHEN '{from}' THEN '{to}'"));
        }
        let sql = format!(
            "UPDATE \"{table}\" SET \"{column}\" = CASE \"{column}\"{cases} ELSE \"{column}\" END"
        );
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

async fn apply_category_and_copy_updates(pool: &SqlitePool) -> Result<(), AppError> {
    let category_maps: &[(&str, &[(&str, &str)])] = &[
        (
            "service_item",
            &[
                ("Kontrolluntersuchung", "Checkup"),
                ("Fuellungstherapie", "FillingTherapy"),
                ("Füllungstherapie", "FillingTherapy"),
                ("Parodontologie", "Periodontology"),
                ("Chirurgie", "Surgery"),
                ("Prothetik", "Prosthodontics"),
            ],
        ),
        (
            "treatment_catalog",
            &[
                ("Kontrolluntersuchung", "Checkup"),
                ("Fuellungstherapie", "FillingTherapy"),
                ("Füllungstherapie", "FillingTherapy"),
                ("Parodontologie", "Periodontology"),
                ("Chirurgie", "Surgery"),
                ("Prothetik", "Prosthodontics"),
            ],
        ),
    ];
    for (table, pairs) in category_maps {
        if !column_exists(pool, table, "category").await? {
            continue;
        }
        let mut cases = String::new();
        for (from, to) in *pairs {
            cases.push_str(&format!(" WHEN '{from}' THEN '{to}'"));
        }
        let sql = format!(
            "UPDATE \"{table}\" SET category = CASE category{cases} ELSE category END"
        );
        sqlx::query(&sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }

    if column_exists(pool, "staff", "specialty").await? {
        sqlx::query("UPDATE staff SET specialty = 'Dentistry' WHERE specialty = 'Zahnmedizin'")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

async fn apply_outbox_table_renames(pool: &SqlitePool) -> Result<(), AppError> {
    if !table_exists(pool, "sync_outbox").await? {
        return Ok(());
    }
    for (old, new) in OUTBOX_TABLE_RENAMES {
        sqlx::query("UPDATE sync_outbox SET entity_table = ?1 WHERE entity_table = ?2")
            .bind(new)
            .bind(old)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// Leftover German / mixed JSON object keys → English (practice KV, templates, drafts).
const JSON_OBJECT_KEY_RENAMES: &[(&str, &str)] = &[
    // invoice.practice.v1
    ("kv_nummer", "kv_number"),
    ("ust_id", "vat_id"),
    ("kammer", "chamber"),
    ("bankverbindung_iban", "bank_iban"),
    ("bankverbindung_bic", "bank_bic"),
    ("bankverbindung_bank", "bank_name"),
    ("bankverbindung_inhaber", "account_holder"),
    ("ust_befreiung_hinweis", "vat_exemption_notice"),
    ("notfall_phone", "emergency_phone"),
    ("payment_terms_tage", "payment_terms_days"),
    // practice preferences
    ("pufferMin", "bufferMin"),
    ("notfallPuffer", "emergencyBuffer"),
    ("kalenderDragDropEnabled", "calendarDragDropEnabled"),
    // privacy (if ever stored in KV)
    ("steuer", "tax"),
    ("oz", "hours"),
    ("ust", "vat"),
    // document template payload
    ("kopf", "header"),
    ("empfaenger", "recipient"),
    ("fusszeile", "footer"),
    ("signatur", "signature"),
    ("schriftart", "font"),
    ("dichte", "density"),
    ("datumsformat", "dateFormat"),
    // certificate template payload
    ("krankheiten", "illnesses"),
    ("tage_anzahl", "day_count"),
    ("einschraenkung", "activity_restriction"),
    // anamnesis medication nested keys
    ("selbst", "self"),
    ("vergessen", "missed"),
    // appointment draft leftover camelCase
    ("zahnschmerzenTeeth", "toothacheTeeth"),
    ("zahnschmerzenTooth", "toothacheTooth"),
    ("statusWunsch", "statusPreference"),
    // discharge / misc leftover keys
    ("zusatz_hinweise", "additionalNotes"),
    ("zusatzHinweise", "additionalNotes"),
    ("ueberweisung_hinweise", "referralNotes"),
    ("ueberweisungHinweise", "referralNotes"),
];

/// Exact string values (template field/column ids, density, signature kinds).
const JSON_STRING_VALUE_RENAMES: &[(&str, &str)] = &[
    ("stempel", "stamp"),
    ("kompakt", "compact"),
    ("weit", "spacious"),
    ("ust_hinweis", "vat_notice"),
    ("notfall_tel", "emergency_phone"),
    ("einzelpreis", "unit_price"),
    ("gesamt", "total"),
    ("steuer", "tax"),
    ("oz", "hours"),
    ("kammer", "chamber"),
    ("leistung", "service_item"),
    ("anzahl", "quantity"),
    ("mwst", "vat"),
];

const APP_KV_KEY_RENAMES: &[(&str, &str)] = &[
    ("praxis.preferences.v1", "practice.preferences.v1"),
    ("praxis.preferences-appointment.v1", "practice.preferences-appointment.v1"),
];

fn rename_json_keys_prefer_english(value: &mut serde_json::Value, renames: &[(&str, &str)]) {
    match value {
        serde_json::Value::Object(map) => {
            let keys: Vec<String> = map.keys().cloned().collect();
            for key in keys {
                if let Some((_, english)) = renames.iter().find(|(old, _)| *old == key) {
                    if let Some(v) = map.remove(&key) {
                        if !map.contains_key(*english) {
                            map.insert((*english).to_string(), v);
                        }
                        // else drop leftover when English already present
                    }
                }
            }
            for child in map.values_mut() {
                rename_json_keys_prefer_english(child, renames);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                rename_json_keys_prefer_english(child, renames);
            }
        }
        _ => {}
    }
}

fn rename_json_string_values(value: &mut serde_json::Value, renames: &[(&str, &str)]) {
    match value {
        serde_json::Value::Object(map) => {
            for child in map.values_mut() {
                rename_json_string_values(child, renames);
            }
        }
        serde_json::Value::Array(items) => {
            for child in items {
                rename_json_string_values(child, renames);
            }
        }
        serde_json::Value::String(s) => {
            for (from, to) in renames {
                if s == from {
                    *s = (*to).to_string();
                    break;
                }
            }
        }
        _ => {}
    }
}

fn upgrade_stored_json_blob(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut value: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    let before = value.clone();
    rename_json_keys_prefer_english(&mut value, JSON_OBJECT_KEY_RENAMES);
    rename_json_string_values(&mut value, JSON_STRING_VALUE_RENAMES);
    if value == before {
        return None;
    }
    Some(value.to_string())
}

fn upgrade_appointment_text(raw: &str) -> Option<String> {
    let mut out = raw.to_string();
    let mut changed = false;
    let replacements = [
        ("Dauer:", "Duration:"),
        ("Zahnschmerzen", "Toothache"),
        ("Zähne ", "teeth "),
        ("Zahn ", "tooth "),
    ];
    for (from, to) in replacements {
        if out.contains(from) {
            out = out.replace(from, to);
            changed = true;
        }
    }
    changed.then_some(out)
}

async fn apply_stored_json_english_upgrade(pool: &SqlitePool) -> Result<(), AppError> {
    if table_exists(pool, "app_kv").await? {
        for (old_key, new_key) in APP_KV_KEY_RENAMES {
            // Prefer existing English key; otherwise rename leftover key.
            let english_exists: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM app_kv WHERE key = ?1",
            )
            .bind(new_key)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
            if english_exists == 0 {
                sqlx::query("UPDATE app_kv SET key = ?1 WHERE key = ?2")
                    .bind(new_key)
                    .bind(old_key)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
            } else {
                sqlx::query("DELETE FROM app_kv WHERE key = ?1")
                    .bind(old_key)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
            }
        }

        let rows: Vec<(String, String)> =
            sqlx::query_as("SELECT key, value FROM app_kv WHERE value IS NOT NULL AND value != ''")
                .fetch_all(pool)
                .await
                .map_err(AppError::Database)?;
        for (key, value) in rows {
            if let Some(next) = upgrade_stored_json_blob(&value) {
                sqlx::query("UPDATE app_kv SET value = ?1 WHERE key = ?2")
                    .bind(&next)
                    .bind(&key)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
                tracing::info!(
                    target: "medoc::system",
                    event = "SCHEMA_APP_KV_JSON_ENGLISHIFIED",
                    key = %key
                );
            }
        }
    }

    if table_exists(pool, "document_template").await?
        && column_exists(pool, "document_template", "payload").await?
    {
        let rows: Vec<(String, String)> =
            sqlx::query_as("SELECT id, payload FROM document_template WHERE payload IS NOT NULL AND payload != ''")
                .fetch_all(pool)
                .await
                .map_err(AppError::Database)?;
        for (id, payload) in rows {
            if let Some(next) = upgrade_stored_json_blob(&payload) {
                sqlx::query("UPDATE document_template SET payload = ?1 WHERE id = ?2")
                    .bind(&next)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
                tracing::info!(
                    target: "medoc::system",
                    event = "SCHEMA_DOCUMENT_TEMPLATE_PAYLOAD_ENGLISHIFIED",
                    id = %id
                );
            }
        }
    }

    if table_exists(pool, "document_template_user").await?
        && column_exists(pool, "document_template_user", "payload").await?
    {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, payload FROM document_template_user WHERE payload IS NOT NULL AND payload != ''",
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        for (id, payload) in rows {
            if let Some(next) = upgrade_stored_json_blob(&payload) {
                sqlx::query("UPDATE document_template_user SET payload = ?1 WHERE id = ?2")
                    .bind(&next)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
                tracing::info!(
                    target: "medoc::system",
                    event = "SCHEMA_DOCUMENT_TEMPLATE_USER_PAYLOAD_ENGLISHIFIED",
                    id = %id
                );
            }
        }
    }

    if table_exists(pool, "chart_next_appointment_hint").await?
        && column_exists(pool, "chart_next_appointment_hint", "hint_json").await?
    {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT patient_id, hint_json FROM chart_next_appointment_hint WHERE hint_json IS NOT NULL AND hint_json != ''",
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        for (patient_id, hint_json) in rows {
            if let Some(next) = upgrade_stored_json_blob(&hint_json) {
                sqlx::query(
                    "UPDATE chart_next_appointment_hint SET hint_json = ?1 WHERE patient_id = ?2",
                )
                .bind(&next)
                .bind(&patient_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
            }
        }
    }

    if table_exists(pool, "anamnesis_form").await?
        && column_exists(pool, "anamnesis_form", "answers").await?
    {
        let rows: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, answers FROM anamnesis_form WHERE answers IS NOT NULL AND answers != ''",
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        for (id, answers) in rows {
            if let Some(next) = upgrade_stored_json_blob(&answers) {
                sqlx::query("UPDATE anamnesis_form SET answers = ?1 WHERE id = ?2")
                    .bind(&next)
                    .bind(&id)
                    .execute(pool)
                    .await
                    .map_err(AppError::Database)?;
                tracing::info!(
                    target: "medoc::system",
                    event = "SCHEMA_ANAMNESIS_ANSWERS_ENGLISHIFIED",
                    id = %id
                );
            }
        }
    }

    Ok(())
}

async fn apply_appointment_text_english_upgrade(pool: &SqlitePool) -> Result<(), AppError> {
    if !table_exists(pool, "appointment").await? {
        return Ok(());
    }
    if column_exists(pool, "appointment", "notes").await? {
        let rows: Vec<(String, Option<String>)> =
            sqlx::query_as("SELECT id, notes FROM appointment WHERE notes IS NOT NULL AND notes != ''")
                .fetch_all(pool)
                .await
                .map_err(AppError::Database)?;
        for (id, notes) in rows {
            if let Some(raw) = notes {
                if let Some(next) = upgrade_appointment_text(&raw) {
                    sqlx::query("UPDATE appointment SET notes = ?1 WHERE id = ?2")
                        .bind(&next)
                        .bind(&id)
                        .execute(pool)
                        .await
                        .map_err(AppError::Database)?;
                }
            }
        }
    }
    if column_exists(pool, "appointment", "chief_complaint").await? {
        let rows: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT id, chief_complaint FROM appointment WHERE chief_complaint IS NOT NULL AND chief_complaint != ''",
        )
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        for (id, complaint) in rows {
            if let Some(raw) = complaint {
                if let Some(next) = upgrade_appointment_text(&raw) {
                    sqlx::query("UPDATE appointment SET chief_complaint = ?1 WHERE id = ?2")
                        .bind(&next)
                        .bind(&id)
                        .execute(pool)
                        .await
                        .map_err(AppError::Database)?;
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod json_upgrade_tests {
    use super::{
        rename_json_keys_prefer_english, upgrade_appointment_text, upgrade_stored_json_blob,
        JSON_OBJECT_KEY_RENAMES,
    };
    use serde_json::json;

    #[test]
    fn remaps_invoice_practice_leftover_keys() {
        let upgraded = upgrade_stored_json_blob(
            r#"{"name":"Clinic","kv_nummer":"KV-1","kammer":"Berlin","ust_id":"DE1","bankverbindung_iban":"DE00"}"#,
        )
        .expect("changed");
        let v: serde_json::Value = serde_json::from_str(&upgraded).unwrap();
        assert_eq!(v["kv_number"], "KV-1");
        assert_eq!(v["chamber"], "Berlin");
        assert_eq!(v["vat_id"], "DE1");
        assert_eq!(v["bank_iban"], "DE00");
        assert!(v.get("kv_nummer").is_none());
        assert!(v.get("kammer").is_none());
    }

    #[test]
    fn prefers_existing_english_over_leftover() {
        let mut v = json!({"chamber":"Berlin","kammer":"Hamburg"});
        rename_json_keys_prefer_english(&mut v, JSON_OBJECT_KEY_RENAMES);
        assert_eq!(v["chamber"], "Berlin");
        assert!(v.get("kammer").is_none());
    }

    #[test]
    fn remaps_template_and_certificate_payload() {
        let upgraded = upgrade_stored_json_blob(
            r#"{"version":1,"kopf":{"fieldsToShow":["ust_hinweis","kammer"],"showLogo":false},"empfaenger":{"visible":true},"dichte":"kompakt","signatur":{"show":true,"labelKind":"stempel"},"krankheiten":"Cold","tage_anzahl":2}"#,
        )
        .expect("changed");
        let v: serde_json::Value = serde_json::from_str(&upgraded).unwrap();
        assert!(v.get("header").is_some());
        assert!(v.get("recipient").is_some());
        assert_eq!(v["density"], "compact");
        assert_eq!(v["header"]["fieldsToShow"][0], "vat_notice");
        assert_eq!(v["header"]["fieldsToShow"][1], "chamber");
        assert_eq!(v["signature"]["labelKind"], "stamp");
        assert_eq!(v["illnesses"], "Cold");
        assert_eq!(v["day_count"], 2);
        assert!(v.get("kopf").is_none());
    }

    #[test]
    fn remaps_appointment_text_markers() {
        let next = upgrade_appointment_text("Dauer: 30 min · Zahnschmerzen (Zahn 16)").unwrap();
        assert_eq!(next, "Duration: 30 min · Toothache (tooth 16)");
    }

    #[test]
    fn remaps_anamnesis_medication_attribute_keys() {
        let upgraded = upgrade_stored_json_blob(
            r#"{"version":1,"medication":{"dosing":"täglich morgens","selbst":"Vit D","vergessen":"rarely"}}"#,
        )
        .expect("changed");
        let v: serde_json::Value = serde_json::from_str(&upgraded).unwrap();
        assert_eq!(v["medication"]["self"], "Vit D");
        assert_eq!(v["medication"]["missed"], "rarely");
        assert_eq!(v["medication"]["dosing"], "täglich morgens");
        assert!(v["medication"].get("selbst").is_none());
        assert!(v["medication"].get("vergessen").is_none());
    }

    #[test]
    fn unchanged_english_blob_returns_none() {
        assert!(upgrade_stored_json_blob(r#"{"name":"Clinic","kv_number":"KV-1"}"#).is_none());
    }
}
