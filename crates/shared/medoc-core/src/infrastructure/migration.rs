// CSV-based patient import (FA-MIG-01).
//
// Format expected (header row mandatory, semicolon delimiter — matches the
// german convention used by most legacy PVS exports):
//
//   name;geburtsdatum;geschlecht;versicherungsnummer;telefon;email;adresse
//
// `geburtsdatum` is parsed as `YYYY-MM-DD` or `DD.MM.YYYY`.
// `geschlecht` accepts M/W/D (case-insensitive) and is normalised to MAENNLICH/WEIBLICH/DIVERS.

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::Path;

use crate::error::AppError;
use crate::log_migration;

#[derive(Debug, Serialize, Default)]
pub struct ImportReport {
    pub source: String,
    pub total_rows: u64,
    pub imported: u64,
    pub skipped: u64,
    pub failed: u64,
    pub errors: Vec<String>,
}

pub async fn import_patients(
    pool: &SqlitePool,
    csv_path: &Path,
    dry_run: bool,
) -> Result<ImportReport, AppError> {
    let content = std::fs::read_to_string(csv_path)
        .map_err(|e| AppError::Internal(format!("Cannot read CSV: {e}")))?;

    let mut report = ImportReport {
        source: csv_path.display().to_string(),
        ..Default::default()
    };

    log_migration!(info, event = "IMPORT_START", source = %report.source, dry_run);

    let mut lines = content.lines();
    let header = lines.next().unwrap_or("");
    let cols: Vec<&str> = header.split(';').map(|s| s.trim()).collect();
    if !cols.contains(&"name") || !cols.contains(&"geburtsdatum") {
        return Err(AppError::Validation(
            "CSV-Header muss mindestens 'name' und 'geburtsdatum' enthalten".into(),
        ));
    }
    let idx = |key: &str| cols.iter().position(|c| *c == key);

    for (lineno, raw) in lines.enumerate() {
        let lineno = lineno + 2; // +1 for header, +1 for 1-based
        if raw.trim().is_empty() {
            continue;
        }
        report.total_rows += 1;
        let fields: Vec<&str> = raw.split(';').collect();
        let get = |key: &str| -> Option<String> {
            idx(key)
                .and_then(|i| fields.get(i))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let name = match get("name") {
            Some(n) => n,
            None => {
                report.failed += 1;
                report.errors.push(format!("Zeile {lineno}: name fehlt"));
                continue;
            }
        };
        let gebstr = match get("geburtsdatum") {
            Some(g) => g,
            None => {
                report.failed += 1;
                report
                    .errors
                    .push(format!("Zeile {lineno}: geburtsdatum fehlt"));
                continue;
            }
        };
        let geb = parse_date(&gebstr);
        let geb = match geb {
            Some(d) => d,
            None => {
                report.failed += 1;
                report
                    .errors
                    .push(format!("Zeile {lineno}: ungültiges Datum '{gebstr}'"));
                continue;
            }
        };
        let geschlecht = normalise_geschlecht(get("geschlecht").as_deref().unwrap_or("D"));
        let vnr = get("versicherungsnummer").unwrap_or_else(|| format!("UNBEKANNT-{lineno}"));
        let telefon = get("telefon");
        let email = get("email");
        let adresse = get("adresse");

        if dry_run {
            report.imported += 1;
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let res = sqlx::query(
            "INSERT INTO patient (id, name, geburtsdatum, geschlecht,
                versicherungsnummer, telefon, email, adresse, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'AKTIV')",
        )
        .bind(&id)
        .bind(&name)
        .bind(geb)
        .bind(geschlecht)
        .bind(&vnr)
        .bind(&telefon)
        .bind(&email)
        .bind(&adresse)
        .execute(pool)
        .await;

        match res {
            Ok(_) => report.imported += 1,
            Err(sqlx::Error::Database(db)) if db.is_unique_violation() => {
                report.skipped += 1;
                log_migration!(warn, event = "IMPORT_DUPLICATE", line = lineno, name = %name);
            }
            Err(e) => {
                report.failed += 1;
                report
                    .errors
                    .push(format!("Zeile {lineno}: DB-Fehler: {e}"));
            }
        }
    }

    log_migration!(info,
        event = "IMPORT_COMPLETE",
        source = %report.source,
        imported = report.imported,
        skipped = report.skipped,
        failed = report.failed,
    );

    Ok(report)
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .or_else(|_| NaiveDate::parse_from_str(s, "%d.%m.%Y"))
        .ok()
}

fn normalise_geschlecht(s: &str) -> &'static str {
    match s.trim().to_uppercase().as_str() {
        "M" | "MAENNLICH" | "MÄNNLICH" => "MAENNLICH",
        "W" | "F" | "WEIBLICH" => "WEIBLICH",
        _ => "DIVERS",
    }
}
