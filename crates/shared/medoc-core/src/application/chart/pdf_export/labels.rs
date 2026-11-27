//! Localised labels of the chart PDF (split from `pdf_export.rs`).

use super::*;

/// Localised certificate kind (never the raw enum such as `SICK_LEAVE`).
pub(super) fn certificate_kind_label(locale: &str, kind: &str) -> String {
    use crate::infrastructure::pdf::i18n::pick;
    let (de, en, fr, ar) = match kind {
        "SICK_LEAVE" => (
            "Arbeitsunfähigkeitsbescheinigung",
            "Sick-leave certificate",
            "Certificat d'incapacité de travail",
            "شهادة عجز عن العمل",
        ),
        "SPORTS_EXEMPTION" => (
            "Sportbefreiung",
            "Sports exemption",
            "Dispense sportive",
            "إعفاء رياضي",
        ),
        "SCHOOL_EXEMPTION" => (
            "Schulbefreiung",
            "School exemption",
            "Dispense scolaire",
            "إعفاء مدرسي",
        ),
        "TREATMENT_CONFIRMATION" => (
            "Behandlungsbestätigung",
            "Treatment confirmation",
            "Confirmation de traitement",
            "تأكيد العلاج",
        ),
        _ => ("Bescheinigung", "Certificate", "Certificat", "شهادة"),
    };
    pick(locale, de, en, fr, ar).to_string()
}

/// Turns off chart sections the caller's role is not allowed to see.
pub(super) fn gate_chart_sections(
    sec: &mut ChartExportSections,
    role: Role,
    overrides: &[crate::domain::rbac::PermissionOverride],
) {
    let medical = rbac::effective_allowed("patient.read_medical", role, overrides);
    // The patient's invoices and payments: billing read access.
    let finance = rbac::effective_allowed("billing.read", role, overrides);
    let documents = rbac::effective_allowed("patient.read_documents", role, overrides);
    let audit_ok = rbac::effective_allowed("audit.read", role, overrides);
    if !medical {
        sec.dental_findings = false;
        sec.anamnesis = false;
        sec.examinations = false;
        sec.treatments = false;
        sec.prescriptions = false;
        sec.certificate = false;
    }
    if !finance {
        sec.payments = false;
    }
    if !documents {
        sec.attachments = false;
    }
    if !audit_ok {
        sec.audit = false;
    }
}

/// Treatment cost and payment amount on the patient-chart PDF.
pub(super) fn chart_money(amount: f64) -> String {
    format!(
        "{amount:.2} {}",
        crate::infrastructure::pdf::document_currency()
    )
}

pub(super) fn fmt_treatment_status(locale: &str, raw: &str) -> String {
    match raw.trim().to_uppercase().as_str() {
        "COMPLETED" => l(locale, "Completed"),
        "PLANNED" => l(locale, "Planned"),
        "IN_PROGRESS" => l(locale, "In progress"),
        "ABGEBROCHEN" | "DISCONTINUED" => l(locale, "Discontinued"),
        "CANCELLED" => l(locale, "Cancelled"),
        other if other.is_empty() || other == "-" => "-".into(),
        other => truncate_cell(other, 12),
    }
}

/// Stored sex code → word in the document language (raw codes such as `FEMALE` are not for print).
pub(super) fn sex_label(locale: &str, raw: &str) -> String {
    use crate::infrastructure::pdf::i18n::pick;
    match raw.trim().to_ascii_uppercase().as_str() {
        "FEMALE" | "F" | "WEIBLICH" => pick(locale, "Weiblich", "Female", "Féminin", "أنثى").into(),
        "MALE" | "M" | "MAENNLICH" | "MÄNNLICH" => {
            pick(locale, "Männlich", "Male", "Masculin", "ذكر").into()
        }
        "DIVERSE" | "DIVERS" | "OTHER" | "D" => {
            pick(locale, "Divers", "Other", "Autre", "آخر").into()
        }
        _ => raw.to_string(),
    }
}

/// Stored patient status code → word in the document language.
pub(super) fn status_label(locale: &str, raw: &str) -> String {
    use crate::infrastructure::pdf::i18n::pick;
    match raw.trim().to_ascii_uppercase().as_str() {
        // Codes from config/enums.yaml (PatientStatus).
        "NEW" => pick(locale, "Neu", "New", "Nouveau", "جديد").into(),
        "ACTIVE" => pick(locale, "Aktiv", "Active", "Actif", "نشط").into(),
        "VALIDATED" => pick(locale, "Bestätigt", "Validated", "Validé", "مُصادق عليه").into(),
        "READONLY" => pick(
            locale,
            "Schreibgeschützt",
            "Read-only",
            "Lecture seule",
            "للقراءة فقط",
        )
        .into(),
        "ARCHIVED" => pick(locale, "Archiviert", "Archived", "Archivé", "مؤرشف").into(),
        "DRAFT" => pick(locale, "Entwurf", "Draft", "Brouillon", "مسودة").into(),
        _ => raw.to_string(),
    }
}
