//! Issuing official documents: one code path for numbering, rendering,
//! registry (hash), audit and reprints.
//!
//! Rules enforced here (not in the UI):
//! * RBAC per document kind (issuing certificates and prescriptions stays with
//!   the physician). A document that is already generated and `ISSUED` can be
//!   opened by reception.
//! * Practice identity comes from the database, never from the request.
//! * Every issued document gets a gap-free yearly number from
//!   `document_sequence`, is stored verbatim in `issued_document` with the
//!   SHA-256 of the PDF, and is audited.
//! * A second request for the same source record is a **reprint**: rendered
//!   from the stored payload with a "KOPIE" watermark, never a new number.
//! * Previews carry an "ENTWURF" watermark, get no number and are not stored.
//! * Numbers are only allocated on the MASTER device.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::Datelike;
use serde::de::Deserializer;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;

use super::practice_profile::{
    localized_vat_notice, logo_hidden_on_documents, practice_logo, resolve_document_locale,
    PracticeProfile,
};
use crate::application::auth_service::Session;
use crate::application::rbac::{effective_allowed, Role};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::invoice_document as invoice_document_repo;
use crate::infrastructure::database::repos::billing::issued_document::{
    self as repo, sha256_hex, IssuedDocument,
};
use crate::infrastructure::database::sync_outbox;
use crate::infrastructure::pdf::{
    is_pdf_renderable, render_clinical_layout_with_logo, render_invoice, render_report_pdf,
    unit_fee_cents, validate_invoice, ClinicalPdfLayout, FeeSchedule, Invoice, InvoiceKind,
    InvoiceLine, ReportPdfInput,
};

pub const WATERMARK_PREVIEW: &str = "ENTWURF";
pub const WATERMARK_COPY: &str = "KOPIE";

/// Kinds stored in `issued_document.kind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DocKind {
    Invoice,
    Cancellation,
    Receipt,
    Certificate,
    Prescription,
    ChartExtract,
    DischargeLeaflet,
    DailyReport,
    Report,
}

impl DocKind {
    pub fn as_db(self) -> &'static str {
        match self {
            DocKind::Invoice => "INVOICE",
            DocKind::Cancellation => "CANCELLATION",
            DocKind::Receipt => "RECEIPT",
            DocKind::Certificate => "CERTIFICATE",
            DocKind::Prescription => "PRESCRIPTION",
            DocKind::ChartExtract => "CHART_EXTRACT",
            DocKind::DischargeLeaflet => "DISCHARGE_LEAFLET",
            DocKind::DailyReport => "DAILY_REPORT",
            DocKind::Report => "REPORT",
        }
    }

    pub fn from_db(s: &str) -> Option<Self> {
        Some(match s {
            "INVOICE" => DocKind::Invoice,
            "CANCELLATION" => DocKind::Cancellation,
            "RECEIPT" => DocKind::Receipt,
            "CERTIFICATE" => DocKind::Certificate,
            "PRESCRIPTION" => DocKind::Prescription,
            "CHART_EXTRACT" => DocKind::ChartExtract,
            "DISCHARGE_LEAFLET" => DocKind::DischargeLeaflet,
            "DAILY_REPORT" => DocKind::DailyReport,
            "REPORT" => DocKind::Report,
            _ => return None,
        })
    }

    /// Number prefix in the practice's country (`jurisdiction` from
    /// [`PracticeProfile::jurisdiction`]): French for France and Morocco (`FA-2026-000001`),
    /// English for the rest of the EU (`INV-…`), German otherwise (`RE-…`). Each prefix is its
    /// own gap-free series, so a practice that changes country starts a new series.
    pub fn prefix_for(self, jurisdiction: Option<&str>) -> &'static str {
        match jurisdiction {
            Some("fr") | Some("ma") => match self {
                DocKind::Invoice => "FA",
                DocKind::Cancellation => "AV",
                DocKind::Receipt => "RC",
                DocKind::Certificate => "CM",
                DocKind::Prescription => "OR",
                DocKind::ChartExtract => "ED",
                DocKind::DischargeLeaflet => "FC",
                DocKind::DailyReport => "CJ",
                DocKind::Report => "RA",
            },
            Some("eu") => match self {
                DocKind::Invoice => "INV",
                DocKind::Cancellation => "CN",
                DocKind::Receipt => "RCT",
                DocKind::Certificate => "CRT",
                DocKind::Prescription => "RX",
                DocKind::ChartExtract => "REC",
                DocKind::DischargeLeaflet => "AFT",
                DocKind::DailyReport => "DAY",
                DocKind::Report => "RPT",
            },
            _ => self.prefix(),
        }
    }

    /// German number prefix: `RE-2026-000001`.
    pub fn prefix(self) -> &'static str {
        match self {
            DocKind::Invoice => "RE",
            DocKind::Cancellation => "ST",
            DocKind::Receipt => "QU",
            DocKind::Certificate => "AT",
            DocKind::Prescription => "RZ",
            DocKind::ChartExtract => "AK",
            DocKind::DischargeLeaflet => "NB",
            DocKind::DailyReport => "TB",
            DocKind::Report => "BE",
        }
    }

    /// Permission required to issue / reprint.
    pub fn issue_permission(self) -> &'static str {
        match self {
            DocKind::Certificate | DocKind::Prescription | DocKind::DischargeLeaflet => {
                "patient.write_medical"
            }
            DocKind::ChartExtract => "patient.read",
            DocKind::Invoice => "billing.create",
            // A cancellation voids an issued invoice.
            DocKind::Cancellation => "billing.cancel",
            DocKind::Receipt => "cash.create",
            DocKind::DailyReport => "cash.day_close",
            DocKind::Report => "reports.read",
        }
    }

    /// Permission required for an (unnumbered, watermarked) preview.
    pub fn preview_permission(self) -> &'static str {
        match self {
            // Frontdesk prints AU / Rx / leaflets; medical *issue* stays write_medical.
            DocKind::Certificate | DocKind::Prescription | DocKind::DischargeLeaflet => {
                "patient.read_documents"
            }
            DocKind::ChartExtract => "patient.read",
            DocKind::Invoice | DocKind::Cancellation => "billing.read",
            // Reception takes payments (`finance.write`); `cash.read` alone legacy-maps to
            // physician-only `finance.read` and blocked receipt preview for frontdesk.
            DocKind::Receipt | DocKind::DailyReport => "finance.write",
            DocKind::Report => "reports.read",
        }
    }

    fn clinical(kind: &str) -> Result<Self, AppError> {
        match kind {
            "certificate" => Ok(DocKind::Certificate),
            "prescription" => Ok(DocKind::Prescription),
            "receipt" => Ok(DocKind::Receipt),
            _ => Err(AppError::validation_code("error.documents.unknown_kind")),
        }
    }
}

pub fn require_permission(session: &Session, action: &str) -> Result<(), AppError> {
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if effective_allowed(action, role, &session.permission_overrides) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

/// An issued document is the verified copy. Reception may open it. Issuing a
/// new one still needs the kind's own permission.
fn can_open_issued(session: &Session, kind: DocKind) -> bool {
    let Some(role) = Role::parse(&session.role) else {
        return false;
    };
    let overrides = &session.permission_overrides;
    effective_allowed(kind.issue_permission(), role, overrides)
        || effective_allowed(kind.preview_permission(), role, overrides)
        || effective_allowed("patient.read_documents", role, overrides)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssuedPdf {
    pub document_id: Option<String>,
    pub document_number: Option<String>,
    pub sha256: String,
    pub pdf_base64: String,
    /// True when an existing document was printed again ("KOPIE").
    pub reprint: bool,
}

pub(crate) fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%S%.3fZ")
        .to_string()
}

pub(crate) fn year_now() -> i32 {
    chrono::Local::now().year()
}

/// Rejects any string in the payload that the PDF fonts cannot render.
///
/// The fonts now cover Latin (all of Europe), Greek, Cyrillic and Arabic;
/// emoji, invisible and exotic space characters are normalised instead of
/// rejected. What remains (e.g. CJK) is logged with the exact characters.
fn check_renderable(v: &Value) -> Result<(), AppError> {
    let ok = match v {
        Value::String(s) => {
            let ok = is_pdf_renderable(s);
            if !ok {
                let chars: String = crate::infrastructure::pdf::unrenderable_chars(s)
                    .iter()
                    .map(|c| format!("U+{:04X} ", *c as u32))
                    .collect();
                tracing::warn!(event = "PDF_UNSUPPORTED_CHARACTERS", chars = %chars.trim());
            }
            ok
        }
        Value::Array(a) => return a.iter().try_for_each(check_renderable),
        Value::Object(o) => return o.values().try_for_each(check_renderable),
        _ => true,
    };
    if ok {
        Ok(())
    } else {
        Err(AppError::validation_code(
            "error.documents.unsupported_characters",
        ))
    }
}

/// Run `body` inside `BEGIN IMMEDIATE … COMMIT` on one pooled connection.
macro_rules! immediate_tx {
    ($pool:expr, |$conn:ident| $body:block) => {{
        let mut conn_guard = $pool.acquire().await?;
        sqlx::query("BEGIN IMMEDIATE")
            .execute(&mut *conn_guard)
            .await?;
        let result: Result<_, AppError> = async {
            let $conn: &mut sqlx::SqliteConnection = &mut *conn_guard;
            $body
        }
        .await;
        match result {
            Ok(v) => {
                sqlx::query("COMMIT").execute(&mut *conn_guard).await?;
                Ok::<_, AppError>(v)
            }
            Err(e) => {
                let _ = sqlx::query("ROLLBACK").execute(&mut *conn_guard).await;
                Err(e)
            }
        }
    }};
}

pub(crate) async fn after_insert(
    pool: &SqlitePool,
    session: &Session,
    doc: &IssuedDocument,
    action: &str,
) {
    // Replicate to peers (MASTER → REPLICA) and audit. Failures here must
    // not undo an issued document, so they are logged, not returned.
    let body = serde_json::to_string(doc).unwrap_or_default();
    if let Err(e) =
        sync_outbox::record_or_noop(pool, "issued_document", &doc.id, "INSERT", &body).await
    {
        tracing::warn!(event = "ISSUED_DOCUMENT_OUTBOX_FAILED", error = %e);
    }
    // The first print-log row, so the PDF's hash verifies on every device.
    if let Err(e) = sync_outbox::record_or_noop(
        pool,
        "issued_document_print",
        &repo::original_print_id(&doc.id),
        "INSERT",
        "",
    )
    .await
    {
        tracing::warn!(event = "ISSUED_DOCUMENT_PRINT_OUTBOX_FAILED", error = %e);
    }
    let details = format!(
        "nr={} sha256={} patient={}",
        doc.document_number,
        doc.sha256,
        doc.patient_id.as_deref().unwrap_or("-")
    );
    if let Err(e) = audit_repo::create(
        pool,
        &session.user_id,
        action,
        doc.kind.as_str(),
        doc.source_id.as_deref().or(Some(doc.id.as_str())),
        Some(&details),
    )
    .await
    {
        tracing::error!(event = "ISSUED_DOCUMENT_AUDIT_FAILED", error = %e);
    }
}

// ===========================================================================
// Clinical documents: certificate, prescription, receipt
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueClinicalArgs {
    /// `certificate` | `prescription` | `receipt`
    pub kind: String,
    /// `certificate.id` | `prescription.id` | `payment.id`
    pub source_id: String,
    /// `ClinicalPdfLayout` JSON built by the frontend (content only).
    pub layout_json: String,
    #[serde(default)]
    pub preview: bool,
    /// Certificates: `patient` (default) | `employer` | `insurer`.
    #[serde(default)]
    pub copy_variant: Option<String>,
}

/// Checks the source record and returns its patient id.
async fn load_clinical_source(
    pool: &SqlitePool,
    kind: DocKind,
    source_id: &str,
) -> Result<String, AppError> {
    match kind {
        DocKind::Certificate => {
            let row: Option<(String,)> =
                sqlx::query_as("SELECT patient_id FROM certificate WHERE id = ?1")
                    .bind(source_id)
                    .fetch_optional(pool)
                    .await?;
            row.map(|r| r.0)
                .ok_or(AppError::NotFound("Certificate".into()))
        }
        DocKind::Prescription => {
            // One prescription or a combined sheet (comma-separated ids).
            let mut patient: Option<String> = None;
            for id in source_id.split(',') {
                let row: Option<(String, Option<String>)> = sqlx::query_as(
                    "SELECT patient_id, prescription_type FROM prescription WHERE id = ?1",
                )
                .bind(id)
                .fetch_optional(pool)
                .await?;
                let (patient_id, kind) = row.ok_or(AppError::NotFound("Prescription".into()))?;
                match kind
                    .as_deref()
                    .unwrap_or("PRIVAT")
                    .trim()
                    .to_uppercase()
                    .as_str()
                {
                    // BtM needs the official BtM form (BtMVV), never plain paper.
                    "BTM" => {
                        return Err(AppError::validation_code(
                            "error.documents.btm_requires_official_form",
                        ))
                    }
                    // Statutory patients: prescription-only drugs go via E-Rezept (TI).
                    "KASSE" => {
                        return Err(AppError::validation_code(
                            "error.documents.gkv_requires_erezept",
                        ))
                    }
                    _ => {}
                }
                match &patient {
                    Some(p) if p != &patient_id => {
                        return Err(AppError::validation_code("error.documents.mixed_patients"))
                    }
                    _ => patient = Some(patient_id),
                }
            }
            patient.ok_or(AppError::NotFound("Prescription".into()))
        }
        DocKind::Receipt => {
            let row: Option<(String, String)> =
                sqlx::query_as("SELECT patient_id, status FROM payment WHERE id = ?1")
                    .bind(source_id)
                    .fetch_optional(pool)
                    .await?;
            let (patient_id, status) = row.ok_or(AppError::NotFound("Payment".into()))?;
            if status != "PAID" && status != "PARTIALLY_PAID" {
                return Err(AppError::validation_code(
                    "error.documents.receipt_requires_payment",
                ));
            }
            Ok(patient_id)
        }
        _ => Err(AppError::validation_code("error.documents.unknown_kind")),
    }
}

fn normalize_copy_variant(kind: DocKind, v: Option<&str>) -> Result<&'static str, AppError> {
    if kind != DocKind::Certificate {
        return Ok("ORIGINAL");
    }
    match v.unwrap_or("patient") {
        "patient" => Ok("patient"),
        "employer" => Ok("employer"),
        "insurer" => Ok("insurer"),
        _ => Err(AppError::validation_code(
            "error.documents.unknown_copy_variant",
        )),
    }
}

/// Apply server-side facts to the client layout (as JSON so the exact
/// payload can be stored and re-rendered later).
fn apply_server_fields(
    layout: &mut Value,
    profile: &PracticeProfile,
    locale: &str,
    copy_variant: &str,
    medical: bool,
) -> Result<(), AppError> {
    let obj = layout
        .as_object_mut()
        .ok_or_else(|| AppError::Validation("layout must be a JSON object".into()))?;
    // Medical documents (prescriptions, certificates) carry the practitioner's id and no tax ids
    // or bank details; receipts get the minimal layout (practice name, address, contact).
    let (practice_lines, footer_lines, sig) = if medical {
        (
            profile.clinical_letterhead_lines(),
            profile.clinical_footer_lines(locale),
            profile.signature_lines(),
        )
    } else {
        (
            profile.minimal_letterhead_lines(),
            profile.minimal_footer_lines(locale),
            profile.minimal_signature_lines(),
        )
    };
    obj.insert("practiceLines".into(), serde_json::json!(practice_lines));
    obj.insert("footerLines".into(), serde_json::json!(footer_lines));
    if !sig.is_empty() {
        obj.insert("signatureLines".into(), serde_json::json!(sig));
    }
    obj.insert("locale".into(), Value::String(locale.to_string()));
    obj.insert(
        "rtl".into(),
        Value::Bool(crate::infrastructure::pdf::i18n::is_rtl(locale)),
    );
    obj.remove("logoKvJson");
    obj.remove("watermark");
    obj.remove("documentNumber");
    if copy_variant != "ORIGINAL" {
        obj.insert(
            "copyVariant".into(),
            Value::String(copy_variant.to_string()),
        );
    }
    Ok(())
}

/// Patient identity panel from the database (never from the client):
/// certificates and prescriptions must name the patient exactly as recorded.
#[allow(clippy::type_complexity)]
async fn patient_panel(
    pool: &SqlitePool,
    patient_id: &str,
    locale: &str,
    copy_variant: &str,
    french_prescription: bool,
) -> Result<Value, AppError> {
    type PatientRow = (String, Option<String>, Option<String>, Option<String>);
    let row: Option<PatientRow> = sqlx::query_as(
        "SELECT name, CAST(date_of_birth AS TEXT), insurance_number, address FROM patient WHERE id = ?1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    let (name, dob, ins, addr) = row.ok_or(AppError::NotFound("Patient".into()))?;
    let dob = dob
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d.get(..10)?, "%Y-%m-%d").ok())
        // German documents use 14.06.1990; French and Arabic (Morocco, France) use 14/06/1990.
        .map(|d| {
            d.format(if locale.starts_with("de") {
                "%d.%m.%Y"
            } else {
                "%d/%m/%Y"
            })
            .to_string()
        });
    let mut left = vec![name.trim().to_string()];
    if let Some(d) = dob {
        left.push(format!(
            "{} {d}",
            crate::infrastructure::pdf::i18n::t(
                locale,
                crate::infrastructure::pdf::i18n::Phrase::DateOfBirth,
            )
        ));
    }
    if french_prescription {
        let sex: Option<String> = sqlx::query_scalar("SELECT sex FROM patient WHERE id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?
            .flatten();
        let sex = match sex.as_deref().map(str::to_ascii_uppercase).as_deref() {
            Some("FEMALE") | Some("F") => Some("F"),
            Some("MALE") | Some("M") => Some("M"),
            _ => None,
        };
        if let Some(sx) = sex {
            left.push(format!("Sexe : {sx}"));
        }
    }
    // The employer copy shows who is unfit for work, nothing more.
    if copy_variant != "employer" && !french_prescription {
        if let Some(i) = ins.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            left.push(format!(
                "{} {i}",
                crate::infrastructure::pdf::i18n::t(
                    locale,
                    crate::infrastructure::pdf::i18n::Phrase::InsuranceNo,
                )
            ));
        }
    }
    let right: Vec<String> = addr
        .as_deref()
        .map(|a| {
            let mut lines: Vec<String> = Vec::new();
            for part in a
                .split(['\n', ','])
                .map(str::trim)
                .filter(|l| !l.is_empty())
            {
                // "112, boulevard Zerktouni": a bare house number stays on the street's line.
                match lines.last_mut() {
                    Some(prev) if prev.chars().all(|c| c.is_ascii_digit()) => {
                        prev.push_str(", ");
                        prev.push_str(part);
                    }
                    _ => lines.push(part.to_string()),
                }
            }
            lines
        })
        .unwrap_or_default();
    Ok(serde_json::json!({
        "leftTitle": crate::infrastructure::pdf::i18n::t(locale, crate::infrastructure::pdf::i18n::Phrase::Patient),
        "leftLines": left,
        "rightTitle": crate::infrastructure::pdf::i18n::t(locale, crate::infrastructure::pdf::i18n::Phrase::Address),
        "rightLines": if right.is_empty() { vec!["-".to_string()] } else { right },
    }))
}

fn render_layout_value(
    v: &Value,
    logo: Option<&crate::infrastructure::pdf::PdfLogo>,
) -> Result<Vec<u8>, AppError> {
    let layout: ClinicalPdfLayout = serde_json::from_value(v.clone())
        .map_err(|e| AppError::Validation(format!("PDF-Layout: {e}")))?;
    render_clinical_layout_with_logo(&layout, logo)
}

pub async fn issue_clinical_document(
    pool: &SqlitePool,
    session: &Session,
    args: IssueClinicalArgs,
) -> Result<IssuedPdf, AppError> {
    let kind = DocKind::clinical(args.kind.trim())?;
    let mut args = args;
    if kind == DocKind::Prescription {
        // Canonical key for combined prescriptions: sorted, unique ids.
        let mut ids: Vec<&str> = args
            .source_id
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .collect();
        ids.sort_unstable();
        ids.dedup();
        args.source_id = ids.join(",");
    }
    let copy_variant = normalize_copy_variant(kind, args.copy_variant.as_deref())?;
    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let permitted = if args.preview {
        effective_allowed(
            kind.preview_permission(),
            role,
            &session.permission_overrides,
        )
    } else {
        effective_allowed(kind.issue_permission(), role, &session.permission_overrides)
    };
    if !permitted {
        return open_issued_copy(pool, session, kind, &args.source_id, copy_variant).await;
    }
    let patient_id = load_clinical_source(pool, kind, &args.source_id).await?;
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    let mut layout: Value = serde_json::from_str(&args.layout_json)
        .map_err(|e| AppError::Validation(format!("PDF-Layout: {e}")))?;
    let requested = layout
        .get("locale")
        .and_then(|v| v.as_str())
        .map(str::to_string);
    let locale = resolve_document_locale(pool, requested.as_deref()).await;
    let logo = practice_logo(pool).await;
    let medical = !matches!(kind, DocKind::Receipt);
    apply_server_fields(&mut layout, &profile, locale, copy_variant, medical)?;
    if matches!(kind, DocKind::Certificate | DocKind::Prescription) {
        if let Some(sig) = signing_doctor_lines(pool, kind, &args.source_id, &profile).await? {
            if let Some(obj) = layout.as_object_mut() {
                obj.insert("signatureLines".into(), serde_json::json!(sig));
            }
        }
        // France (R.5132-3 CSP): a prescription names the patient's sex and age, and carries no
        // social-security number (NIR), which French rules keep off documents that do not need it.
        let french_rx =
            matches!(kind, DocKind::Prescription) && profile.jurisdiction() == Some("fr");
        let panel = patient_panel(pool, &patient_id, locale, copy_variant, french_rx).await?;
        if let Some(obj) = layout.as_object_mut() {
            obj.insert("twoColumn".into(), panel);
        }
    }
    // France: the Assurance Maladie and employers only accept sick leave declared online
    // (amelipro) or on the secure CERFA form. A free-form certificate says so on its face.
    if matches!(kind, DocKind::Certificate) && profile.jurisdiction() == Some("fr") {
        let cert_kind: Option<String> =
            sqlx::query_scalar("SELECT kind FROM certificate WHERE id = ?1")
                .bind(&args.source_id)
                .fetch_optional(pool)
                .await?;
        if cert_kind.as_deref() == Some("SICK_LEAVE") {
            let note =
                crate::infrastructure::pdf::i18n::tr(locale, "certificate.fr_sick_leave_notice")
                    .to_string();
            if let Some(obj) = layout.as_object_mut() {
                let closing = obj
                    .entry("closingParagraphs")
                    .or_insert_with(|| Value::Array(Vec::new()));
                if let Some(list) = closing.as_array_mut() {
                    list.push(Value::String(note));
                }
            }
        }
    }
    check_renderable(&layout)?;

    if args.preview {
        layout["watermark"] = Value::String(
            crate::infrastructure::pdf::i18n::t(
                locale,
                crate::infrastructure::pdf::i18n::Phrase::Draft,
            )
            .into(),
        );
        let bytes = render_layout_value(&layout, logo.as_ref())?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: sha256_hex(&bytes),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        });
    }

    repo::ensure_numbering_authority(pool).await?;

    // Same source + copy already issued → reprint the stored version.
    if let Some(existing) =
        repo::find_by_source(pool, kind.as_db(), &args.source_id, copy_variant).await?
    {
        return reprint(pool, session, &existing).await;
    }

    let issued_at = now_iso();
    let doc = immediate_tx!(pool, |conn| {
        let number =
            repo::next_number(conn, kind.prefix_for(profile.jurisdiction()), year_now()).await?;
        layout["documentNumber"] = Value::String(number.clone());
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes = crate::infrastructure::pdf::with_document_uid(&doc_id, || {
            render_layout_value(&layout, logo.as_ref())
        })?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: kind.as_db().into(),
            document_number: number,
            source_table: Some(
                match kind {
                    DocKind::Certificate => "certificate",
                    DocKind::Prescription => "prescription",
                    _ => "payment",
                }
                .into(),
            ),
            source_id: Some(args.source_id.clone()),
            copy_variant: copy_variant.into(),
            patient_id: Some(patient_id.clone()),
            sha256: sha256_hex(&bytes),
            payload_json: layout.to_string(),
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        Ok((doc, bytes))
    })?;
    let (doc, bytes) = doc;
    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: doc.sha256,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

// ===========================================================================
// Invoices (GOZ) and cancellation invoices
// ===========================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueInvoiceArgs {
    pub patient_id: String,
    /// Content from the UI (lines, recipient, note). Practice identity,
    /// patient identity and number are overwritten on the server.
    ///
    /// Nested invoice keys may be snake_case (`amount_cents`) or camelCase
    /// (`amountCents`). A camelCase line used to deserialize as an empty GOZ
    /// fee, which then failed every § 10 check.
    #[serde(deserialize_with = "deserialize_invoice_flex")]
    pub invoice: Invoice,
    #[serde(default)]
    pub preview: bool,
}

mod invoice_json;
mod signing_doctor;
pub use signing_doctor::DOCTOR_SIGNATURES_KV_KEY;
use signing_doctor::signing_doctor_lines;
#[allow(unused_imports)]
pub use invoice_json::*;

async fn complete_invoice_from_db(
    pool: &SqlitePool,
    inv: &mut Invoice,
    patient_id: &str,
) -> Result<(), AppError> {
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    inv.practice_name = profile.name.trim().to_string();
    inv.practice_address = profile.address_lines();
    inv.practice_bsnr = profile.bsnr.clone().filter(|s| !s.trim().is_empty());
    inv.clinician_zanr = profile.zanr.clone().filter(|s| !s.trim().is_empty());
    if inv
        .clinician_name
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        inv.clinician_name = profile.clinician_name.clone();
    }
    inv.tax_number = profile.tax_number.clone().filter(|s| !s.trim().is_empty());
    inv.vat_id = profile.vat_id.clone().filter(|s| !s.trim().is_empty());
    // The language the UI asked for (Settings language when none was sent). Resolved first:
    // header labels and the bank line are written in it.
    let requested = inv.locale.clone();
    let locale = resolve_document_locale(pool, Some(requested.as_str())).await;
    let bank = profile.bank_lines();
    inv.bank_details = if bank.is_empty() { None } else { Some(bank) };
    inv.practice_lines = profile.letterhead_lines();
    inv.locale = locale.into();
    inv.rtl = crate::infrastructure::pdf::i18n::is_rtl(locale);
    inv.footer_lines = profile.footer_lines(locale);
    if profile.is_morocco() {
        // Moroccan format: its own identity block and exemption notice (CGI art. 91);
        // a notice the practice typed itself is kept, the German default is not.
        inv.morocco = Some(profile.morocco_ids());
        inv.vat_notice = profile
            .vat_exemption_notice
            .as_deref()
            .filter(|n| {
                !n.trim().is_empty() && !crate::infrastructure::pdf::i18n::is_default_vat_notice(n)
            })
            .map(|n| n.trim().to_string())
            .or_else(|| {
                Some(
                    crate::infrastructure::pdf::i18n::tr(locale, "invoice_ma.vat_exempt_default")
                        .to_string(),
                )
            });
    } else {
        inv.vat_notice = Some(match inv.vat_notice.as_deref() {
            Some(n) if !n.trim().is_empty() => localized_vat_notice(n, locale),
            _ => profile.vat_notice_for(locale),
        });
    }
    if inv
        .payment_terms_text
        .as_deref()
        .map(str::trim)
        .unwrap_or("")
        .is_empty()
    {
        inv.payment_terms_text = Some(profile.payment_terms_text_for(locale));
    }
    let (name, dob, address): (String, String, Option<String>) = sqlx::query_as(
        "SELECT name, CAST(date_of_birth AS TEXT), address FROM patient WHERE id = ?1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound("Patient".into()))?;
    if inv.recipient_name.trim().is_empty() {
        inv.recipient_name = name.clone();
    }
    if inv
        .recipient_address
        .iter()
        .all(|line| line.trim().is_empty())
    {
        inv.recipient_address = address
            .unwrap_or_default()
            .split(['\n', '\r'])
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect();
    }
    inv.patient_name = name;
    inv.patient_birth_date = Some(dob.chars().take(10).collect());
    inv.logo = practice_logo(pool).await;
    // § 10 Abs. 1 GOZ: due on receipt of a correct invoice; the practice
    // grants the payment term printed on the invoice.
    if inv.date.trim().is_empty() {
        inv.date = chrono::Local::now().format("%Y-%m-%d").to_string();
    }
    inv.due_date = chrono::NaiveDate::parse_from_str(inv.date.trim(), "%Y-%m-%d")
        .ok()
        .map(|d| {
            (d + chrono::Duration::days(i64::from(profile.payment_terms_days.unwrap_or(14).max(1))))
                .format("%Y-%m-%d")
                .to_string()
        });
    Ok(())
}

fn parse_fee_schedule(raw: &str) -> Option<FeeSchedule> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "goz" => Some(FeeSchedule::Goz),
        "goae" | "goa" => Some(FeeSchedule::Goae),
        "material" => Some(FeeSchedule::Material),
        "lab" => Some(FeeSchedule::Lab),
        "other" => Some(FeeSchedule::Other),
        _ => None,
    }
}

fn fill_service_dates_from_invoice(inv: &mut Invoice) {
    let Some(date) = normalize_iso_date(&inv.date) else {
        return;
    };
    inv.date = date.clone();
    for line in &mut inv.lines {
        let current = line.treatment_date.as_deref().unwrap_or("");
        line.treatment_date = Some(normalize_iso_date(current).unwrap_or_else(|| date.clone()));
        if line.description.trim().is_empty() {
            if let Some(nr) = line
                .goz_nr
                .as_ref()
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
            {
                line.description = nr.to_string();
            }
        }
        if line.amount_cents <= 0 && line.fee_schedule.is_fee() {
            if let (Some(pts), Some(fac)) = (
                line.points.filter(|p| *p > 0),
                line.factor.filter(|f| f.is_finite() && *f > 0.0),
            ) {
                let qty = line.quantity.unwrap_or(1).max(1);
                line.amount_cents = unit_fee_cents(line.fee_schedule, pts, fac) * i64::from(qty);
            }
        }
    }
}

fn euros_to_cents(euros: f64) -> Option<i64> {
    if !euros.is_finite() || euros <= 0.0 {
        return None;
    }
    let cents = (euros * 100.0).round();
    if cents > i64::MAX as f64 {
        return None;
    }
    Some(crate::domain::services::pricing::euros_to_cents(euros))
}

fn opt_blank(value: &Option<String>) -> bool {
    value.as_deref().map(str::trim).unwrap_or("").is_empty()
}

#[derive(Debug, sqlx::FromRow)]
struct InvoiceSourceRow {
    label: String,
    service_date: String,
    total_cost: Option<f64>,
    fee_schedule: Option<String>,
    goz_nr: Option<String>,
    points: Option<i64>,
    factor: Option<f64>,
    factor_reason: Option<String>,
    quantity: Option<i64>,
    teeth: Option<String>,
    material: Option<String>,
    analog_of: Option<String>,
    agreement_ref: Option<String>,
}

fn fill_line_from_source(line: &mut InvoiceLine, src: &InvoiceSourceRow, invoice_date: &str) {
    if line.description.trim().is_empty() && !src.label.trim().is_empty() {
        line.description = src.label.trim().to_string();
    }
    if opt_blank(&line.treatment_date) {
        let from_row = src.service_date.chars().take(10).collect::<String>();
        let date = if from_row.len() == 10 && from_row.as_bytes().get(4) == Some(&b'-') {
            from_row
        } else {
            invoice_date.chars().take(10).collect()
        };
        if date.len() == 10 {
            line.treatment_date = Some(date);
        }
    }
    if opt_blank(&line.tooth_nr) {
        if let Some(teeth) = src
            .teeth
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            line.tooth_nr = Some(teeth.to_string());
        }
    }
    if opt_blank(&line.material) {
        if let Some(material) = src
            .material
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            line.material = Some(material.to_string());
        }
    }

    let sched = src.fee_schedule.as_deref().and_then(parse_fee_schedule);
    let goz_nr = src
        .goz_nr
        .as_ref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let points = src
        .points
        .and_then(|p| u32::try_from(p).ok())
        .filter(|p| *p > 0);
    let factor = src.factor.filter(|f| f.is_finite() && *f > 0.0);
    if opt_blank(&line.goz_nr) {
        if let (Some(nr), Some(pts), Some(fac)) = (goz_nr, points, factor) {
            let schedule = sched.filter(|s| s.is_fee()).unwrap_or(FeeSchedule::Goz);
            let qty = i32::try_from(src.quantity.unwrap_or(1).max(1)).unwrap_or(1);
            line.fee_schedule = schedule;
            line.goz_nr = Some(nr);
            line.points = Some(pts);
            line.factor = Some(fac);
            line.quantity = Some(qty);
            if opt_blank(&line.diagnosis_reason) {
                line.diagnosis_reason = src.factor_reason.clone().filter(|s| !s.trim().is_empty());
            }
            if opt_blank(&line.analog_of) {
                line.analog_of = src.analog_of.clone().filter(|s| !s.trim().is_empty());
            }
            if opt_blank(&line.agreement_ref) {
                line.agreement_ref = src.agreement_ref.clone().filter(|s| !s.trim().is_empty());
            }
            line.amount_cents = unit_fee_cents(schedule, pts, fac) * i64::from(qty);
            return;
        }
    }
    if line.amount_cents <= 0 {
        if let Some(cents) = src.total_cost.and_then(euros_to_cents) {
            line.amount_cents = cents;
            if line.fee_schedule.is_fee() && opt_blank(&line.goz_nr) {
                line.fee_schedule = sched.filter(|s| !s.is_fee()).unwrap_or(FeeSchedule::Other);
            }
        }
    }
}

/// A line that only names the chart record (`source_ref`) is filled from that
/// treatment or examination. Amounts the client already sent are left as they
/// are; missing description, date, cost and GOZ fields come from the database.
async fn hydrate_invoice_lines(
    pool: &SqlitePool,
    inv: &mut Invoice,
    patient_id: &str,
) -> Result<(), AppError> {
    let invoice_date = inv.date.clone();
    for line in &mut inv.lines {
        let Some(r) = line
            .source_ref
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        let Some((table, id)) = r.split_once(':') else {
            continue;
        };
        let sql = match table {
            "treatment" => {
                "SELECT COALESCE(NULLIF(TRIM(t.service_name), ''), NULLIF(TRIM(t.description), ''), NULLIF(TRIM(t.kind), ''), 'Behandlung') AS label,
                        substr(COALESCE(NULLIF(t.treatment_date, ''), t.created_at, ''), 1, 10) AS service_date,
                        t.total_cost, t.fee_schedule, t.goz_nr, t.points, t.factor, t.factor_reason, t.quantity,
                        t.teeth, t.material, t.analog_of, t.agreement_ref
                   FROM treatment t
                   JOIN patient_chart c ON c.id = t.chart_id
                  WHERE t.id = ?1 AND c.patient_id = ?2"
            }
            "examination" => {
                "SELECT COALESCE(NULLIF(TRIM(t.service_name), ''), NULLIF(TRIM(t.diagnosis), ''), 'Untersuchung') AS label,
                        substr(COALESCE(t.created_at, ''), 1, 10) AS service_date,
                        t.total_cost,
                        CAST(NULL AS TEXT) AS fee_schedule,
                        CAST(NULL AS TEXT) AS goz_nr,
                        CAST(NULL AS INTEGER) AS points,
                        CAST(NULL AS REAL) AS factor,
                        CAST(NULL AS TEXT) AS factor_reason,
                        CAST(NULL AS INTEGER) AS quantity,
                        CAST(NULL AS TEXT) AS teeth,
                        CAST(NULL AS TEXT) AS material,
                        CAST(NULL AS TEXT) AS analog_of,
                        CAST(NULL AS TEXT) AS agreement_ref
                   FROM examination t
                   JOIN patient_chart c ON c.id = t.chart_id
                  WHERE t.id = ?1 AND c.patient_id = ?2"
            }
            _ => continue,
        };
        let row: Option<InvoiceSourceRow> = sqlx::query_as(sql)
            .bind(id)
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
        if let Some(row) = row {
            fill_line_from_source(line, &row, &invoice_date);
        }
    }
    Ok(())
}

/// Each billed record (`source_ref`) must belong to the patient, be released
/// by a physician, and not be on another open invoice (no double billing).
async fn check_invoice_sources(
    pool: &SqlitePool,
    inv: &Invoice,
    patient_id: &str,
) -> Result<(), AppError> {
    for line in &inv.lines {
        let Some(r) = line
            .source_ref
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
        else {
            continue;
        };
        let (table, id) = r
            .split_once(':')
            .ok_or_else(|| AppError::validation_code("error.invoice.bad_source"))?;
        let table = match table {
            "treatment" => "treatment",
            "examination" => "examination",
            _ => return Err(AppError::validation_code("error.invoice.bad_source")),
        };
        let row: Option<(Option<String>,)> = sqlx::query_as(&format!(
            "SELECT t.released_by_physician_id FROM {table} t
               JOIN patient_chart c ON c.id = t.chart_id
              WHERE t.id = ?1 AND c.patient_id = ?2"
        ))
        .bind(id)
        .bind(patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((released,)) = row else {
            return Err(AppError::validation_code("error.invoice.bad_source"));
        };
        if released.map(|s| s.trim().is_empty()).unwrap_or(true) {
            return Err(AppError::validation_code_params(
                "error.invoice.not_released",
                &[("service", line.description.as_str())],
            ));
        }
        let dup: Option<String> = sqlx::query_scalar(
            "SELECT d.document_number FROM issued_document d, json_each(d.payload_json, '$.lines') l
              WHERE d.kind = 'INVOICE' AND d.status = 'ISSUED'
                AND json_extract(l.value, '$.source_ref') = ?1
              LIMIT 1",
        )
        .bind(r)
        .fetch_optional(pool)
        .await?;
        if let Some(number) = dup {
            return Err(AppError::validation_code_params(
                "error.invoice.already_invoiced",
                &[
                    ("service", line.description.as_str()),
                    ("number", number.as_str()),
                ],
            ));
        }
    }
    Ok(())
}

fn invoice_payload(inv: &Invoice) -> Result<String, AppError> {
    serde_json::to_string(inv).map_err(|e| AppError::Internal(e.to_string()))
}

async fn mirror_into_invoice_documents(
    pool: &SqlitePool,
    session: &Session,
    doc: &IssuedDocument,
    total_cents: i64,
) {
    // Keep the existing finance list (invoice_document) in sync.
    let row = invoice_document_repo::InvoiceDocumentRow {
        id: doc.id.clone(),
        patient_id: doc.patient_id.clone().unwrap_or_default(),
        document_number: doc.document_number.clone(),
        payload_json: doc.payload_json.clone(),
        total_cents,
        created_at: doc.issued_at.clone(),
        created_by: session.user_id.clone(),
    };
    let excerpt = format!("nr={} cents={total_cents}", doc.document_number);
    if let Err(e) = invoice_document_repo::insert_with_audit_trail(pool, &row, &excerpt).await {
        tracing::error!(event = "INVOICE_DOCUMENT_MIRROR_FAILED", error = %e);
    }
}

pub async fn issue_invoice(
    pool: &SqlitePool,
    session: &Session,
    args: IssueInvoiceArgs,
) -> Result<IssuedPdf, AppError> {
    let IssueInvoiceArgs {
        patient_id,
        mut invoice,
        preview,
    } = args;
    require_permission(
        session,
        if preview {
            DocKind::Invoice.preview_permission()
        } else {
            DocKind::Invoice.issue_permission()
        },
    )?;
    complete_invoice_from_db(pool, &mut invoice, &patient_id).await?;
    let jurisdiction = PracticeProfile::load(pool).await?.jurisdiction();
    hydrate_invoice_lines(pool, &mut invoice, &patient_id).await?;
    check_invoice_sources(pool, &invoice, &patient_id).await?;
    invoice.kind = InvoiceKind::Invoice;
    invoice.cancels_number = None;
    invoice.cancels_date = None;
    if invoice.date.trim().is_empty() {
        invoice.date = chrono::Local::now().format("%Y-%m-%d").to_string();
    }
    fill_service_dates_from_invoice(&mut invoice);

    if preview {
        let draft = crate::infrastructure::pdf::i18n::t(
            &invoice.locale,
            crate::infrastructure::pdf::i18n::Phrase::Draft,
        );
        invoice.number = draft.into();
        validate_invoice(&invoice)?;
        invoice.watermark = Some(draft.into());
        let bytes = render_invoice(&invoice)?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: sha256_hex(&bytes),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        });
    }

    repo::ensure_numbering_authority(pool).await?;
    let issued_at = now_iso();
    let (doc, bytes, total) = immediate_tx!(pool, |conn| {
        invoice.number =
            repo::next_number(conn, DocKind::Invoice.prefix_for(jurisdiction), year_now()).await?;
        // Validation failure rolls back → the number is not consumed (gap-free).
        validate_invoice(&invoice)?;
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes =
            crate::infrastructure::pdf::with_document_uid(&doc_id, || render_invoice(&invoice))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: DocKind::Invoice.as_db().into(),
            document_number: invoice.number.clone(),
            source_table: Some("patient".into()),
            source_id: None,
            copy_variant: "ORIGINAL".into(),
            patient_id: Some(patient_id.clone()),
            sha256: sha256_hex(&bytes),
            payload_json: invoice_payload(&invoice)?,
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        Ok((doc, bytes, invoice.total_cents()))
    })?;
    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    mirror_into_invoice_documents(pool, session, &doc, total).await;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: doc.sha256,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

/// Stornorechnung: new document with negative lines that references the
/// original. The original is marked CANCELLED, never changed or deleted.
pub async fn cancel_invoice(
    pool: &SqlitePool,
    session: &Session,
    document_id: &str,
    reason: &str,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, DocKind::Cancellation.issue_permission())?;
    if reason.trim().is_empty() {
        return Err(AppError::validation_code(
            "error.documents.cancel_reason_required",
        ));
    }
    let original = repo::find_by_id(pool, document_id)
        .await?
        .ok_or(AppError::NotFound("Document".into()))?;
    if original.kind != DocKind::Invoice.as_db() || original.status != "ISSUED" {
        return Err(AppError::validation_code("error.documents.not_cancellable"));
    }
    repo::ensure_numbering_authority(pool).await?;

    let mut inv: Invoice = serde_json::from_str(&original.payload_json)
        .map_err(|e| AppError::Internal(format!("stored invoice: {e}")))?;
    inv.kind = InvoiceKind::Cancellation;
    inv.cancels_number = Some(original.document_number.clone());
    inv.cancels_date = Some(inv.date.clone());
    inv.date = chrono::Local::now().format("%Y-%m-%d").to_string();
    // Same language as the invoice it cancels.
    let original_locale = inv.locale.clone();
    let locale = resolve_document_locale(pool, Some(original_locale.as_str())).await;
    inv.locale = locale.into();
    inv.rtl = crate::infrastructure::pdf::i18n::is_rtl(locale);
    inv.note = Some(crate::infrastructure::pdf::i18n::trf(
        locale,
        "invoice.cancellation_reason",
        &[("reason", reason.trim())],
    ));
    inv.due_date = None;
    for l in &mut inv.lines {
        l.amount_cents = -l.amount_cents.abs();
    }
    let profile = PracticeProfile::load(pool).await?;
    inv.footer_lines = profile.footer_lines(locale);
    inv.logo = practice_logo(pool).await;

    let issued_at = now_iso();
    let (doc, bytes, total) = immediate_tx!(pool, |conn| {
        inv.number = repo::next_number(
            conn,
            DocKind::Cancellation.prefix_for(profile.jurisdiction()),
            year_now(),
        )
        .await?;
        validate_invoice(&inv)?;
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes =
            crate::infrastructure::pdf::with_document_uid(&doc_id, || render_invoice(&inv))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: DocKind::Cancellation.as_db().into(),
            document_number: inv.number.clone(),
            source_table: Some("issued_document".into()),
            source_id: Some(original.id.clone()),
            copy_variant: "ORIGINAL".into(),
            patient_id: original.patient_id.clone(),
            sha256: sha256_hex(&bytes),
            payload_json: invoice_payload(&inv)?,
            status: "ISSUED".into(),
            cancels_id: Some(original.id.clone()),
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        repo::mark_cancelled(conn, &original.id).await?;
        Ok((doc, bytes, inv.total_cents()))
    })?;
    after_insert(pool, session, &doc, "CANCEL_DOCUMENT").await;
    // The original invoice is now CANCELLED. Only the cancellation used to be
    // replicated, so other devices kept the original as open and could dun
    // the patient for an invoice that no longer exists.
    if let Err(e) =
        sync_outbox::record_or_noop(pool, "issued_document", &original.id, "UPDATE", "").await
    {
        tracing::warn!(event = "ISSUED_DOCUMENT_OUTBOX_FAILED", error = %e);
    }
    mirror_into_invoice_documents(pool, session, &doc, total).await;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: doc.sha256,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

// ===========================================================================
// Reports (daily report, statistics, balance …)
// ===========================================================================

/// Permission per report kind (`ReportPdfInput.report_kind`).
pub fn report_permission(report_kind: Option<&str>) -> &'static str {
    match report_kind.unwrap_or("finance") {
        "audit" => "audit.read",
        "compliance" => "ops.system",
        "statistics" => "reports.statistics",
        "daily_report" => "cash.day_close",
        _ => "reports.read",
    }
}

/// Daily reports are official (one number per day, reprints are copies);
/// other reports are numbered exports.
pub async fn issue_report(
    pool: &SqlitePool,
    session: &Session,
    mut input: ReportPdfInput,
    source_id: Option<String>,
    preview: bool,
) -> Result<IssuedPdf, AppError> {
    require_permission(session, report_permission(input.report_kind.as_deref()))?;
    if input.report_kind.as_deref() == Some("daily_report") && !preview {
        // The Kassenbericht is issued by `cash_book::close_day` from the
        // journal; a client-built daily report would carry unchecked figures.
        return Err(AppError::validation_code("error.day_close.use_close_day"));
    }
    let kind = if input.report_kind.as_deref() == Some("daily_report") {
        DocKind::DailyReport
    } else {
        DocKind::Report
    };
    let profile = PracticeProfile::load(pool).await?;
    profile.require_complete()?;
    input.practice_name = profile.name.trim().to_string();
    input.practice_address = profile.minimal_address_lines();
    input.logo = practice_logo(pool).await;
    let requested = input.locale.clone();
    let locale = resolve_document_locale(pool, requested.as_deref()).await;
    input.locale = Some(locale.into());
    // Same three footer lines as the invoice: practice and chamber, tax number, bank.
    input.footer_lines = profile.minimal_footer_lines(locale);

    if preview {
        input.watermark = Some(
            crate::infrastructure::pdf::i18n::t(
                locale,
                crate::infrastructure::pdf::i18n::Phrase::Draft,
            )
            .into(),
        );
        input.document_number = None;
        let bytes = render_report_pdf(&input)?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: sha256_hex(&bytes),
            pdf_base64: STANDARD.encode(&bytes),
            reprint: false,
        });
    }
    repo::ensure_numbering_authority(pool).await?;
    if let Some(sid) = source_id.as_deref() {
        if let Some(existing) = repo::find_by_source(pool, kind.as_db(), sid, "ORIGINAL").await? {
            return reprint(pool, session, &existing).await;
        }
    }
    let issued_at = now_iso();
    let (doc, bytes) = immediate_tx!(pool, |conn| {
        let number =
            repo::next_number(conn, kind.prefix_for(profile.jurisdiction()), year_now()).await?;
        input.document_number = Some(number.clone());
        input.watermark = None;
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes =
            crate::infrastructure::pdf::with_document_uid(&doc_id, || render_report_pdf(&input))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: kind.as_db().into(),
            document_number: number,
            source_table: source_id.as_ref().map(|_| "day_close".to_string()),
            source_id: source_id.clone(),
            copy_variant: "ORIGINAL".into(),
            patient_id: None,
            sha256: sha256_hex(&bytes),
            payload_json: serde_json::to_string(&input)
                .map_err(|e| AppError::Internal(e.to_string()))?,
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        Ok((doc, bytes))
    })?;
    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: doc.sha256,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

/// Register a document rendered elsewhere (chart extract, discharge leaflet):
/// allocates the number first, lets `render` build the PDF with it, stores
/// the hash. `payload` is stored for traceability (these documents are not
/// re-rendered — the chart may have changed since).
pub async fn register_rendered<F>(
    pool: &SqlitePool,
    session: &Session,
    kind: DocKind,
    patient_id: &str,
    payload: Value,
    render: F,
) -> Result<IssuedPdf, AppError>
where
    F: FnOnce(&str) -> Result<Vec<u8>, AppError>,
{
    require_permission(session, kind.issue_permission())?;
    repo::ensure_numbering_authority(pool).await?;
    // Number prefix follows the practice country (FA-/INV-/RE-…).
    let jurisdiction = PracticeProfile::load(pool)
        .await
        .ok()
        .and_then(|p| p.jurisdiction());
    let issued_at = now_iso();
    let (doc, bytes) = immediate_tx!(pool, |conn| {
        let number = repo::next_number(conn, kind.prefix_for(jurisdiction), year_now()).await?;
        let doc_id = crate::infrastructure::pdf::new_document_uid();
        let bytes = crate::infrastructure::pdf::with_document_uid(&doc_id, || render(&number))?;
        let doc = IssuedDocument {
            id: doc_id.clone(),
            kind: kind.as_db().into(),
            document_number: number,
            source_table: Some("patient".into()),
            source_id: None,
            copy_variant: "ORIGINAL".into(),
            patient_id: Some(patient_id.to_string()),
            sha256: sha256_hex(&bytes),
            payload_json: payload.to_string(),
            status: "ISSUED".into(),
            cancels_id: None,
            issued_by: session.user_id.clone(),
            issued_at: issued_at.clone(),
            updated_at: issued_at.clone(),
        };
        repo::insert(conn, &doc).await?;
        Ok((doc, bytes))
    })?;
    after_insert(pool, session, &doc, "ISSUE_DOCUMENT").await;
    Ok(IssuedPdf {
        document_id: Some(doc.id),
        document_number: Some(doc.document_number),
        sha256: doc.sha256,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: false,
    })
}

// ===========================================================================
// Reprints / verification
// ===========================================================================

/// Open the stored issued copy. A missing or cancelled document stays closed.
async fn open_issued_copy(
    pool: &SqlitePool,
    session: &Session,
    kind: DocKind,
    source_id: &str,
    copy_variant: &str,
) -> Result<IssuedPdf, AppError> {
    let existing = repo::find_by_source(pool, kind.as_db(), source_id, copy_variant).await?;
    match existing.filter(|doc| doc.status == "ISSUED") {
        Some(doc) => reprint(pool, session, &doc).await,
        None => Err(AppError::Forbidden),
    }
}

/// Render a stored document again with a "KOPIE" watermark.
pub async fn reprint(
    pool: &SqlitePool,
    session: &Session,
    doc: &IssuedDocument,
) -> Result<IssuedPdf, AppError> {
    let kind = DocKind::from_db(&doc.kind)
        .ok_or_else(|| AppError::validation_code("error.documents.unknown_kind"))?;
    if doc.status == "ISSUED" {
        if !can_open_issued(session, kind) {
            return Err(AppError::Forbidden);
        }
    } else {
        require_permission(session, kind.issue_permission())?;
    }
    let hide_logo = logo_hidden_on_documents(pool).await;
    let logo = practice_logo(pool).await;
    // The copy carries the id of the original (`issued_document.id`).
    let bytes = {
        let _uid_scope = crate::infrastructure::pdf::DocumentUidScope::enter(&doc.id);
        match kind {
            DocKind::Invoice | DocKind::Cancellation => {
                let mut inv: Invoice = serde_json::from_str(&doc.payload_json)
                    .map_err(|e| AppError::Internal(format!("stored invoice: {e}")))?;
                inv.watermark = Some(WATERMARK_COPY.into()); // localised by the renderer
                inv.logo = logo;
                render_invoice(&inv)?
            }
            DocKind::Certificate | DocKind::Prescription | DocKind::Receipt => {
                let mut v: Value = serde_json::from_str(&doc.payload_json)
                    .map_err(|e| AppError::Internal(format!("stored layout: {e}")))?;
                v["watermark"] = Value::String(WATERMARK_COPY.into());
                if hide_logo {
                    if let Some(obj) = v.as_object_mut() {
                        obj.remove("logoKvJson");
                    }
                }
                render_layout_value(&v, logo.as_ref())?
            }
            DocKind::DailyReport | DocKind::Report => {
                let mut input: ReportPdfInput = serde_json::from_str(&doc.payload_json)
                    .map_err(|e| AppError::Internal(format!("stored report: {e}")))?;
                let locale = input.locale.clone().unwrap_or_else(|| "de".into());
                input.watermark = Some(
                    crate::infrastructure::pdf::i18n::t(
                        &locale,
                        crate::infrastructure::pdf::i18n::Phrase::Copy,
                    )
                    .into(),
                );
                input.logo = logo.clone();
                render_report_pdf(&input)?
            }
            DocKind::ChartExtract | DocKind::DischargeLeaflet => {
                // Not reproducible from stored data; issue a new extract instead.
                return Err(AppError::validation_code(
                    "error.documents.reprint_not_supported",
                ));
            }
        }
    };
    let sha = sha256_hex(&bytes);
    // The print row is the GoBD record; the audit entry is best-effort like
    // in `after_insert` (logged, never silently dropped).
    repo::record_reprint(pool, &doc.id, &sha, &session.user_id).await?;
    if let Err(e) = audit_repo::create(
        pool,
        &session.user_id,
        "REPRINT_DOCUMENT",
        &doc.kind,
        Some(&doc.id),
        Some(&format!("nr={} sha256={sha}", doc.document_number)),
    )
    .await
    {
        tracing::error!(event = "REPRINT_AUDIT_FAILED", error = %e);
    }
    Ok(IssuedPdf {
        document_id: Some(doc.id.clone()),
        document_number: Some(doc.document_number.clone()),
        sha256: sha,
        pdf_base64: STANDARD.encode(&bytes),
        reprint: true,
    })
}

pub async fn reprint_by_id(
    pool: &SqlitePool,
    session: &Session,
    document_id: &str,
) -> Result<IssuedPdf, AppError> {
    let doc = repo::find_by_id(pool, document_id)
        .await?
        .ok_or(AppError::NotFound("Document".into()))?;
    reprint(pool, session, &doc).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_are_unique() {
        let all = [
            DocKind::Invoice,
            DocKind::Cancellation,
            DocKind::Receipt,
            DocKind::Certificate,
            DocKind::Prescription,
            DocKind::ChartExtract,
            DocKind::DischargeLeaflet,
            DocKind::DailyReport,
            DocKind::Report,
        ];
        // Unique across kinds *and* countries: a practice that changes country must never
        // continue another kind's series.
        let mut p: Vec<_> = [None, Some("fr"), Some("eu")]
            .iter()
            .flat_map(|j| all.iter().map(move |k| k.prefix_for(*j)))
            .chain(crate::application::documents::receivables::REMINDER_PREFIXES)
            .collect();
        p.sort_unstable();
        p.dedup();
        assert_eq!(p.len(), all.len() * 3 + 3);
        assert_eq!(DocKind::Invoice.prefix_for(Some("ma")), "FA");
        assert_eq!(DocKind::Invoice.prefix_for(Some("de")), "RE");
        assert_eq!(DocKind::Invoice.prefix_for(None), "RE");
        for k in all {
            assert_eq!(DocKind::from_db(k.as_db()), Some(k));
        }
    }

    #[test]
    fn non_latin_payload_is_rejected() {
        assert!(check_renderable(&serde_json::json!({ "addressLines": ["محمد"] })).is_ok());
        assert!(check_renderable(&serde_json::json!({ "a": ["Müller"] })).is_ok());
        assert!(check_renderable(&serde_json::json!({ "a": ["中文"] })).is_err());
    }

    #[test]
    fn server_fields_override_client_practice_and_strip_number() {
        let mut v = serde_json::json!({
            "kind": "certificate", "practiceLines": ["Fake Praxis"], "documentNumber": "X",
            "watermark": "", "logoKvJson": "{}", "documentTitle": "T"
        });
        let profile = PracticeProfile {
            name: "Echte Praxis".into(),
            addr: "Hauptstr. 1\n10115 Berlin".into(),
            ..Default::default()
        };
        apply_server_fields(&mut v, &profile, "de", "employer", true).unwrap();
        assert_eq!(v["practiceLines"][0], "Echte Praxis");
        assert!(v.get("documentNumber").is_none());
        assert!(v.get("logoKvJson").is_none());
        assert_eq!(v["copyVariant"], "employer");
    }

    #[test]
    fn invoice_args_accept_camel_case_lines() {
        let raw = r#"{
            "patientId": "p",
            "preview": true,
            "invoice": {
                "recipientName": "Ada",
                "recipientAddress": ["Street 1"],
                "lines": [{
                    "description": "Exam",
                    "amountCents": 1000,
                    "treatmentDate": "2026-01-02",
                    "feeSchedule": "other",
                    "sourceRef": "treatment:t1"
                }]
            }
        }"#;
        let args: IssueInvoiceArgs = serde_json::from_str(raw).unwrap();
        assert_eq!(args.patient_id, "p");
        assert!(args.preview);
        assert_eq!(args.invoice.recipient_name, "Ada");
        assert_eq!(args.invoice.recipient_address, vec!["Street 1".to_string()]);
        assert_eq!(args.invoice.lines[0].amount_cents, 1000);
        assert_eq!(
            args.invoice.lines[0].treatment_date.as_deref(),
            Some("2026-01-02")
        );
        assert_eq!(args.invoice.lines[0].fee_schedule, FeeSchedule::Other);
        assert_eq!(
            args.invoice.lines[0].source_ref.as_deref(),
            Some("treatment:t1")
        );
    }

    #[test]
    fn invoice_line_accepts_service_name_cost_and_german_date() {
        let raw = r#"{
            "patientId": "p",
            "invoice": {
                "date": "02.06.2026",
                "recipientName": "Ada",
                "recipientAddress": ["Street 1"],
                "lines": [{
                    "service_name": "Untersuchung",
                    "total_cost": 12.94,
                    "fee_schedule": "other"
                }]
            }
        }"#;
        let args: IssueInvoiceArgs = serde_json::from_str(raw).unwrap();
        assert_eq!(args.invoice.date, "2026-06-02");
        assert_eq!(args.invoice.lines[0].description, "Untersuchung");
        assert_eq!(args.invoice.lines[0].amount_cents, 1294);
        assert_eq!(
            args.invoice.lines[0].treatment_date.as_deref(),
            Some("2026-06-02")
        );
    }

    #[test]
    fn reception_can_open_an_issued_document() {
        let reception = Session {
            user_id: "r".into(),
            name: "Reception".into(),
            email: "r@example.org".into(),
            role: "RECEPTION".into(),
            permission_overrides: vec![],
            device_session_id: None,
            token_version: 0,
        };
        assert!(can_open_issued(&reception, DocKind::Prescription));
        assert!(can_open_issued(&reception, DocKind::Certificate));
        assert!(can_open_issued(&reception, DocKind::Report));
        let outsider = Session {
            role: "TAX_ADVISOR".into(),
            ..reception
        };
        assert!(!can_open_issued(&outsider, DocKind::Prescription));
    }

    #[test]
    fn reception_may_preview_clinical_and_receipt_pdfs() {
        use crate::application::rbac::{effective_allowed, Role};
        let role = Role::Reception;
        let ov: &[crate::domain::rbac::PermissionOverride] = &[];
        assert!(effective_allowed(
            DocKind::Certificate.preview_permission(),
            role,
            ov
        ));
        assert!(effective_allowed(
            DocKind::Prescription.preview_permission(),
            role,
            ov
        ));
        assert!(effective_allowed(
            DocKind::Receipt.preview_permission(),
            role,
            ov
        ));
        assert!(!effective_allowed(
            DocKind::Certificate.issue_permission(),
            role,
            ov
        ));
    }
}
