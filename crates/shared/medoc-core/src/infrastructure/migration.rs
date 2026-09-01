// CSV-based patient import (FA-MIG-01).
//
// Format expected (header row mandatory, semicolon delimiter).
// English headers only:
//
//   name;date_of_birth;sex;insurance_number;phone;email;address
//
// `date_of_birth` is parsed as `YYYY-MM-DD` or `DD.MM.YYYY`.
// `sex` accepts M/F/W/D (case-insensitive) and is normalised to MALE/FEMALE/DIVERSE.

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
    let col = |english: &str| cols.iter().position(|c| *c == english);
    if col("name").is_none() || col("date_of_birth").is_none() {
        return Err(AppError::Validation(
            "CSV header must contain at least 'name' and 'date_of_birth'".into(),
        ));
    }

    for (lineno, raw) in lines.enumerate() {
        let lineno = lineno + 2; // +1 for header, +1 for 1-based
        if raw.trim().is_empty() {
            continue;
        }
        report.total_rows += 1;
        let fields: Vec<&str> = raw.split(';').collect();
        let get = |english: &str| -> Option<String> {
            col(english)
                .and_then(|i| fields.get(i))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let name = match get("name") {
            Some(n) => n,
            None => {
                report.failed += 1;
                report.errors.push(format!("Row {lineno}: name missing"));
                continue;
            }
        };
        let dob_raw = match get("date_of_birth") {
            Some(g) => g,
            None => {
                report.failed += 1;
                report
                    .errors
                    .push(format!("Row {lineno}: date_of_birth missing"));
                continue;
            }
        };
        let dob = parse_date(&dob_raw);
        let dob = match dob {
            Some(d) => d,
            None => {
                report.failed += 1;
                report
                    .errors
                    .push(format!("Row {lineno}: invalid date '{dob_raw}'"));
                continue;
            }
        };
        let sex = normalise_sex(get("sex").as_deref().unwrap_or("D"));
        let vnr = get("insurance_number").unwrap_or_else(|| format!("UNKNOWN-{lineno}"));
        let phone = get("phone");
        let email = get("email");
        let address = get("address");

        if dry_run {
            report.imported += 1;
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let res = sqlx::query(
            "INSERT INTO patient (id, name, date_of_birth, sex,
                insurance_number, phone, email, address, status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'ACTIVE')",
        )
        .bind(&id)
        .bind(&name)
        .bind(dob)
        .bind(sex)
        .bind(&vnr)
        .bind(&phone)
        .bind(&email)
        .bind(&address)
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
                    .push(format!("Row {lineno}: DB error: {e}"));
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

fn normalise_sex(s: &str) -> &'static str {
    match s.trim().to_uppercase().as_str() {
        "M" | "MALE" => "MALE",
        "W" | "F" | "FEMALE" => "FEMALE",
        _ => "DIVERSE",
    }
}
