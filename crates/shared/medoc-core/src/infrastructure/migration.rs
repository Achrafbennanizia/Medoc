// CSV-based patient import (FA-MIG-01 / F52).
//
// Format (header row mandatory, semicolon delimiter, quoting on).
// English headers only:
//
//   name;date_of_birth;sex;insurance_number;phone;email;address
//
// `date_of_birth` is `YYYY-MM-DD` or `DD.MM.YYYY`.
// `sex` accepts M/F/W/D (case-insensitive) and is normalised to MALE/FEMALE/DIVERSE.

use chrono::NaiveDate;
use serde::Serialize;
use sqlx::SqlitePool;
use std::path::Path;

use crate::error::AppError;
use crate::infrastructure::database::patient_repo;
use crate::log_migration;

#[derive(Debug, Serialize, Clone)]
pub struct ImportLineError {
    pub line: u64,
    pub message: String,
}

#[derive(Debug, Serialize, Default)]
pub struct ImportReport {
    pub source: String,
    pub total_rows: u64,
    pub imported: u64,
    pub skipped_duplicates: u64,
    pub skipped: u64,
    pub failed: u64,
    pub errors: Vec<ImportLineError>,
}

pub async fn import_patients(
    pool: &SqlitePool,
    csv_path: &Path,
    dry_run: bool,
) -> Result<ImportReport, AppError> {
    let bytes = std::fs::read(csv_path)
        .map_err(|e| AppError::Internal(format!("Cannot read CSV: {e}")))?;
    let content = decode_csv_bytes(&bytes);

    let mut report = ImportReport {
        source: csv_path.display().to_string(),
        ..Default::default()
    };

    log_migration!(info, event = "IMPORT_START", source = %report.source, dry_run);

    let mut reader = csv::ReaderBuilder::new()
        .delimiter(b';')
        .has_headers(true)
        .flexible(true)
        .from_reader(content.as_bytes());

    let headers = reader
        .headers()
        .map_err(|e| AppError::Validation(format!("CSV header: {e}")))?
        .clone();
    let col = |english: &str| {
        headers
            .iter()
            .position(|c| c.trim() == english)
    };
    if col("name").is_none() || col("date_of_birth").is_none() {
        return Err(AppError::Validation(
            "CSV header must contain at least 'name' and 'date_of_birth'".into(),
        ));
    }

    for (idx, rec) in reader.records().enumerate() {
        let lineno = (idx + 2) as u64;
        let rec = match rec {
            Ok(r) => r,
            Err(e) => {
                report.failed += 1;
                report.total_rows += 1;
                report.errors.push(ImportLineError {
                    line: lineno,
                    message: e.to_string(),
                });
                continue;
            }
        };
        if rec.iter().all(|s| s.trim().is_empty()) {
            continue;
        }
        report.total_rows += 1;
        let get = |english: &str| -> Option<String> {
            col(english)
                .and_then(|i| rec.get(i))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
        };

        let name = match get("name") {
            Some(n) => n,
            None => {
                report.failed += 1;
                report.errors.push(ImportLineError {
                    line: lineno,
                    message: "name missing".into(),
                });
                continue;
            }
        };
        let dob_raw = match get("date_of_birth") {
            Some(g) => g,
            None => {
                report.failed += 1;
                report.errors.push(ImportLineError {
                    line: lineno,
                    message: "date_of_birth missing".into(),
                });
                continue;
            }
        };
        let dob = match parse_date(&dob_raw) {
            Some(d) => d,
            None => {
                report.failed += 1;
                report.errors.push(ImportLineError {
                    line: lineno,
                    message: format!("invalid date '{dob_raw}'"),
                });
                continue;
            }
        };
        let sex = normalise_sex(get("sex").as_deref().unwrap_or("D"));
        let vnr = get("insurance_number");
        let phone = get("phone");
        let email = get("email");
        let address = get("address");

        let exists = patient_repo::name_dob_exists(pool, &name, &dob.to_string()).await?;
        if exists {
            report.skipped_duplicates += 1;
            report.skipped += 1;
            continue;
        }

        if dry_run {
            report.imported += 1;
            continue;
        }

        match patient_repo::create_from_import(
            pool,
            &name,
            dob,
            sex,
            vnr.as_deref(),
            phone.as_deref(),
            email.as_deref(),
            address.as_deref(),
        )
        .await
        {
            Ok(_) => report.imported += 1,
            Err(e) => {
                report.failed += 1;
                report.errors.push(ImportLineError {
                    line: lineno,
                    message: e.to_string(),
                });
            }
        }
    }

    log_migration!(info,
        event = "IMPORT_COMPLETE",
        source = %report.source,
        imported = report.imported,
        skipped = report.skipped_duplicates,
        failed = report.failed,
    );

    Ok(report)
}

fn decode_csv_bytes(bytes: &[u8]) -> String {
    if let Ok(s) = std::str::from_utf8(bytes) {
        return s.to_string();
    }
    encoding_rs::WINDOWS_1252.decode(bytes).0.into_owned()
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
