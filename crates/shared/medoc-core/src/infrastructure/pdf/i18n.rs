//! Fixed wording for patient PDFs (certificate, prescription, receipt, chart).
//!
//! One catalog for every supported UI language: `de`, `en`, `fr`, `ar`.
//! The layout text the app already translated stays as sent. This module
//! covers the lines the server adds itself (footer, patient panel, privacy
//! notice, copy line, page number, draft watermark).

#[derive(Clone, Copy)]
pub enum Phrase {
    Chamber,
    TaxNo,
    VatId,
    Patient,
    Address,
    DateOfBirth,
    InsuranceNo,
    InvoiceNo,
    ReceiptNo,
    Privacy,
    Stamp,
    Continued,
    CopyEmployer,
    CopyInsurer,
    CopyPatient,
    BankDetails,
    DetailType,
    DetailPeriod,
    DetailDetails,
    Draft,
    Copy,
    NoTableRows,
}

pub fn t(locale: &str, phrase: Phrase) -> &'static str {
    let locale = super::core::pdf_locale(locale);
    match (locale, phrase) {
        ("en", Phrase::Chamber) => "Chamber",
        ("fr", Phrase::Chamber) => "Chambre",
        ("ar", Phrase::Chamber) => "الغرفة",
        (_, Phrase::Chamber) => "Kammer",

        ("en", Phrase::TaxNo) => "Tax no.",
        ("fr", Phrase::TaxNo) => "N° fiscal",
        ("ar", Phrase::TaxNo) => "الرقم الضريبي",
        (_, Phrase::TaxNo) => "Steuer-Nr.",

        ("en", Phrase::VatId) => "VAT ID",
        ("fr", Phrase::VatId) => "N° TVA",
        ("ar", Phrase::VatId) => "الرقم الضريبي للقيمة المضافة",
        (_, Phrase::VatId) => "USt-IdNr.",

        ("en", Phrase::Patient) => "Patient",
        ("fr", Phrase::Patient) => "Patient",
        ("ar", Phrase::Patient) => "المريض",
        (_, Phrase::Patient) => "Patient/in",

        ("en", Phrase::Address) => "Address",
        ("fr", Phrase::Address) => "Adresse",
        ("ar", Phrase::Address) => "العنوان",
        (_, Phrase::Address) => "Anschrift",

        ("en", Phrase::DateOfBirth) => "Date of birth:",
        ("fr", Phrase::DateOfBirth) => "Date de naissance :",
        ("ar", Phrase::DateOfBirth) => "تاريخ الميلاد:",
        (_, Phrase::DateOfBirth) => "Geb.-Datum:",

        ("en", Phrase::InsuranceNo) => "Insurance no.:",
        ("fr", Phrase::InsuranceNo) => "N° d'assuré :",
        ("ar", Phrase::InsuranceNo) => "رقم التأمين:",
        (_, Phrase::InsuranceNo) => "Vers.-Nr.:",

        ("en", Phrase::InvoiceNo) => "Invoice no.",
        ("fr", Phrase::InvoiceNo) => "N° de facture",
        ("ar", Phrase::InvoiceNo) => "رقم الفاتورة",
        (_, Phrase::InvoiceNo) => "Rechnungs-Nr.",

        ("en", Phrase::ReceiptNo) => "Receipt no.",
        ("fr", Phrase::ReceiptNo) => "No de quittance",
        ("ar", Phrase::ReceiptNo) => "رقم الإيصال",
        (_, Phrase::ReceiptNo) => "Quittungs-Nr.",

        ("en", Phrase::Privacy) => {
            "Confidential patient data pursuant to § 630f BGB / Art. 9 GDPR. Disclosure only to authorized parties."
        }
        ("fr", Phrase::Privacy) => {
            "Données patient confidentielles (art. 9 RGPD). Divulgation uniquement aux personnes autorisées."
        }
        ("ar", Phrase::Privacy) => {
            "بيانات مريض سرية وفق § 630f BGB / المادة 9 من اللائحة العامة لحماية البيانات. لا تُسلَّم إلا للأشخاص المخوّلين."
        }
        (_, Phrase::Privacy) => {
            "Vertrauliche Patientendaten gem. § 630f BGB / Art. 9 DSGVO. Weitergabe nur an berechtigte Personen."
        }

        ("en", Phrase::Stamp) => "(Practice stamp)",
        ("fr", Phrase::Stamp) => "(Cachet du cabinet)",
        ("ar", Phrase::Stamp) => "(ختم العيادة)",
        (_, Phrase::Stamp) => "(Praxisstempel)",

        ("en", Phrase::Continued) => "continued",
        ("fr", Phrase::Continued) => "suite",
        ("ar", Phrase::Continued) => "تابع",
        (_, Phrase::Continued) => "Fortsetzung",

        ("en", Phrase::CopyEmployer) => "Copy for the employer",
        ("fr", Phrase::CopyEmployer) => "Exemplaire à remettre à l'employeur",
        ("ar", Phrase::CopyEmployer) => "نسخة لتقديمها إلى صاحب العمل",
        (_, Phrase::CopyEmployer) => "Ausfertigung zur Vorlage beim Arbeitgeber",

        ("en", Phrase::CopyInsurer) => "Copy for the health insurer",
        ("fr", Phrase::CopyInsurer) => "Exemplaire à remettre à l'assurance maladie",
        ("ar", Phrase::CopyInsurer) => "نسخة لتقديمها إلى صندوق التأمين",
        (_, Phrase::CopyInsurer) => "Ausfertigung zur Vorlage bei der Krankenkasse",

        ("en", Phrase::CopyPatient) => "Copy for the patient",
        ("fr", Phrase::CopyPatient) => "Exemplaire pour la personne assurée",
        ("ar", Phrase::CopyPatient) => "نسخة للمريض",
        (_, Phrase::CopyPatient) => "Ausfertigung für die versicherte Person",

        ("en", Phrase::BankDetails) => "Bank details:",
        ("fr", Phrase::BankDetails) => "Coordonnées bancaires :",
        ("ar", Phrase::BankDetails) => "بيانات البنك:",
        (_, Phrase::BankDetails) => "Bankverbindung:",

        ("en", Phrase::DetailType) => "Type",
        ("fr", Phrase::DetailType) => "Type",
        ("ar", Phrase::DetailType) => "النوع",
        (_, Phrase::DetailType) => "Art",

        ("en", Phrase::DetailPeriod) => "Period",
        ("fr", Phrase::DetailPeriod) => "Période",
        ("ar", Phrase::DetailPeriod) => "الفترة",
        (_, Phrase::DetailPeriod) => "Zeitraum",

        ("en", Phrase::DetailDetails) => "Details",
        ("fr", Phrase::DetailDetails) => "Indications",
        ("ar", Phrase::DetailDetails) => "البيانات",
        (_, Phrase::DetailDetails) => "Angaben",

        ("en", Phrase::Draft) => "DRAFT",
        ("fr", Phrase::Draft) => "BROUILLON",
        ("ar", Phrase::Draft) => "مسودة",
        (_, Phrase::Draft) => "ENTWURF",

        ("en", Phrase::Copy) => "COPY",
        ("fr", Phrase::Copy) => "COPIE",
        ("ar", Phrase::Copy) => "نسخة",
        (_, Phrase::Copy) => "KOPIE",

        ("en", Phrase::NoTableRows) => "(no table rows)",
        ("fr", Phrase::NoTableRows) => "(aucune ligne)",
        ("ar", Phrase::NoTableRows) => "(لا توجد صفوف)",
        (_, Phrase::NoTableRows) => "(keine Tabelleneinträge)",
    }
}

pub fn page_label(locale: &str, page: usize, total: usize) -> String {
    match super::core::pdf_locale(locale) {
        "en" => format!("Page {page} of {total}"),
        "fr" => format!("Page {page} sur {total}"),
        "ar" => format!("صفحة {page} من {total}"),
        _ => format!("Seite {page} von {total}"),
    }
}
