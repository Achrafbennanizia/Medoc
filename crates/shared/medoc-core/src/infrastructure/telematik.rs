// Telematik-Infrastruktur (TI) integrations (NFA-EU-TI).
//
// Two protocols matter for a dental PVS in Germany:
//
// - **E-Rezept** (electronic prescription) — issued via the gematik FHIR
//   profile, signed with the doctor's HBA card (eHBA), submitted to the
//   gematik Fachdienst.
// - **KIM** (Kommunikation im Medizinwesen) — secure email between
//   medical professionals, S/MIME on top of SMTP, identity bound to SMC-B.
//
// Both require connector hardware + smartcards + accredited certificates
// and cannot ship in the desktop client. We provide:
//
// 1. The canonical request/response types so the UI and accounting code can
//    be wired today.
// 2. A pure-Rust validator for the PZN (Pharmazentralnummer) and the
//    e-prescription token format so as much logic as possible is unit-tested.
// 3. A logged stub that returns `Internal("not implemented")` for the wire
//    calls — replaced by a real connector adapter later.

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::log_system;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct EPrescription {
    pub patient_id: String,
    pub kvnr: String, // Krankenversichertennummer (10 chars)
    pub pzn: String,  // Pharmazentralnummer (8 digits)
    pub medication_name: String,
    pub dosage: String,
    pub quantity: u32,
    pub doctor_lanr: String, // Lebenslange Arztnummer (9 digits)
    pub issued_at: String,   // ISO date
}

#[derive(Debug, Serialize)]
pub struct EPrescriptionToken {
    pub task_id: String,
    pub access_code: String,
    pub redeem_url: String,
}

/// Validate a PZN (8 digits + checksum). Returns `false` for malformed input.
pub fn pzn_is_valid(pzn: &str) -> bool {
    if pzn.len() != 8 || !pzn.chars().all(|c| c.is_ascii_digit()) {
        return false;
    }
    // ASCII-digit guard above guarantees `to_digit(10)` succeeds, but we
    // still avoid `unwrap` in production code by defaulting to 0 — it would
    // simply break the checksum, never panic.
    let digits: Vec<u32> = pzn.chars().map(|c| c.to_digit(10).unwrap_or(0)).collect();
    let sum: u32 = (0..7).map(|i| digits[i] * (i as u32 + 1)).sum();
    let check = sum % 11;
    check < 10 && check == digits[7]
}

/// KVNR sanity check: 1 letter + 9 digits (gematik specifies an internal
/// checksum we don't recompute here as it requires alphabetic position
/// mapping; full validation happens in the connector).
pub fn kvnr_format_ok(kvnr: &str) -> bool {
    kvnr.len() == 10
        && kvnr
            .chars()
            .next()
            .map(|c| c.is_ascii_alphabetic())
            .unwrap_or(false)
        && kvnr.chars().skip(1).all(|c| c.is_ascii_digit())
}

/// LANR (9 digits + Fachgruppen-/Prüfziffer).
pub fn lanr_format_ok(lanr: &str) -> bool {
    lanr.len() == 9 && lanr.chars().all(|c| c.is_ascii_digit())
}

pub fn validate(rx: &EPrescription) -> Result<(), AppError> {
    if !pzn_is_valid(&rx.pzn) {
        return Err(AppError::Validation(format!("Ungültige PZN: {}", rx.pzn)));
    }
    if !kvnr_format_ok(&rx.kvnr) {
        return Err(AppError::Validation(format!(
            "KVNR Format ungültig: {}",
            rx.kvnr
        )));
    }
    if !lanr_format_ok(&rx.doctor_lanr) {
        return Err(AppError::Validation("LANR muss 9 Ziffern enthalten".into()));
    }
    if rx.quantity == 0 || rx.quantity > 99 {
        return Err(AppError::Validation(
            "Menge muss zwischen 1 und 99 liegen".into(),
        ));
    }
    Ok(())
}

/// Stub for the actual connector submission.
pub fn submit_via_ti(rx: &EPrescription) -> Result<EPrescriptionToken, AppError> {
    validate(rx)?;
    log_system!(warn,
        event = "EREZEPT_SUBMIT_NOT_IMPLEMENTED",
        kvnr = %rx.kvnr,
        pzn = %rx.pzn,
    );
    Err(AppError::Internal(
        "E-Rezept-Übermittlung erfordert TI-Konnektor und HBA-Karte".into(),
    ))
}

#[derive(Debug, Deserialize, Serialize)]
pub struct KimMessage {
    pub from: String,
    pub to: String,
    pub subject: String,
    pub body: String,
}

pub fn kim_send(msg: &KimMessage) -> Result<(), AppError> {
    if !msg.from.contains('@') || !msg.to.contains('@') {
        return Err(AppError::Validation("Ungültige KIM-Adresse".into()));
    }
    log_system!(warn,
        event = "KIM_SEND_NOT_IMPLEMENTED",
        from = %msg.from, to = %msg.to,
    );
    Err(AppError::Internal(
        "KIM-Versand erfordert akkreditierten KIM-Provider und SMC-B".into(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pzn_check_digit_ok() {
        // Compute check: sum(d[i]*(i+1) for i in 0..7) % 11
        // "12345678": 1+4+9+16+25+36+49 = 140; 140%11 = 8 ✓
        assert!(pzn_is_valid("12345678"));
        // "00000017": d[6]=1*7 = 7; 7%11 = 7 ✓
        assert!(pzn_is_valid("00000017"));
    }

    #[test]
    fn pzn_check_digit_fails() {
        assert!(!pzn_is_valid("12345670")); // wrong check digit
        assert!(!pzn_is_valid("0000013")); // too short
        assert!(!pzn_is_valid("0000013A")); // non-digit
        assert!(!pzn_is_valid(""));
    }

    #[test]
    fn kvnr_format() {
        assert!(kvnr_format_ok("A123456789"));
        assert!(!kvnr_format_ok("1234567890"));
        assert!(!kvnr_format_ok("A12345678"));
    }

    #[test]
    fn lanr_format() {
        assert!(lanr_format_ok("123456789"));
        assert!(!lanr_format_ok("12345678"));
        assert!(!lanr_format_ok("12345678A"));
    }
}
