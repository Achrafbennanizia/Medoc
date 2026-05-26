// GDT (Geräte-Daten-Träger) — file-based exchange format used between dental
// devices and PVS systems. Records are line-oriented:
//
//   <length:3><field-id:4><content>\r\n
//
// Reference: VDDS-Spezifikation GDT 3.0.
//
// This implementation handles the most common record types used by image
// capture devices (intra-oral cameras, OPG units) so MeDoc can ingest a
// GDT export file and link it to a patient.

use crate::error::AppError;
use crate::log_device;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Default, Serialize)]
pub struct GdtRecord {
    pub satzart: Option<String>,            // 8000
    pub patient_id: Option<String>,         // 3000
    pub patient_name: Option<String>,       // 3101
    pub patient_first_name: Option<String>, // 3102
    pub geburtsdatum: Option<String>,       // 3103
    pub befund: Option<String>,             // 6220
    pub raw_lines: Vec<(String, String)>,   // (field-id, content)
}

pub fn parse_file(path: &Path) -> Result<GdtRecord, AppError> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AppError::Internal(format!("Cannot read GDT file: {e}")))?;
    let record = parse(&content);
    log_device!(info,
        event = "GDT_PARSE",
        path = %path.display(),
        satzart = ?record.satzart,
        fields = record.raw_lines.len(),
    );
    Ok(record)
}

pub fn parse(content: &str) -> GdtRecord {
    let mut rec = GdtRecord::default();
    for raw in content.split(['\n', '\r']) {
        if raw.len() < 7 {
            continue;
        }
        // Lengths are byte-counted; we trust ASCII-7 inputs as per spec.
        let field = &raw[3..7];
        let value = raw[7..].trim_end().to_string();
        match field {
            "8000" => rec.satzart = Some(value.clone()),
            "3000" => rec.patient_id = Some(value.clone()),
            "3101" => rec.patient_name = Some(value.clone()),
            "3102" => rec.patient_first_name = Some(value.clone()),
            "3103" => rec.geburtsdatum = Some(value.clone()),
            "6220" => rec.befund = Some(value.clone()),
            _ => {}
        }
        rec.raw_lines.push((field.to_string(), value));
    }
    rec
}

/// Build a GDT file body for an outgoing patient/befund record.
pub fn build(satzart: &str, patient_id: &str, patient_name: &str) -> String {
    let mut out = String::new();
    let mut push = |field: &str, value: &str| {
        let len = 7 + value.len() + 2; // 3 length + 4 field + content + CRLF
        out.push_str(&format!("{:03}{}{}\r\n", len, field, value));
    };
    push("8000", satzart);
    push("3000", patient_id);
    push("3101", patient_name);
    out
}
