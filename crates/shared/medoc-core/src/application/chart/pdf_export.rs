//! FA-AKTE-04 / FA-DOK-08 — PDF export use cases for the patient chart (`patient_chart`).
//! Labels follow the document language from Settings (`documents.locale.v1`,
//! default German). Non-preview exports are numbered and registered in
//! `issued_document` (hash + audit) via [`crate::application::documents::issue`].

use crate::application::auth_service::Session;
use crate::application::documents::issue::{
    register_rendered, DocKind, IssuedPdf, WATERMARK_PREVIEW,
};
use crate::application::documents::practice_profile::{resolve_document_locale, PracticeProfile};
use crate::application::rbac::{self, Role};
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::billing::payment as payment_repo;
use crate::infrastructure::database::repos::clinical::certificate as certificate_repo;
use crate::infrastructure::database::repos::clinical::chart as chart_repo;
use crate::infrastructure::database::repos::clinical::chart_attachment as chart_attachment_repo;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use crate::infrastructure::database::repos::clinical::prescription as prescription_repo;
use crate::infrastructure::database::repos::scheduling::appointment as appointment_repo;
use crate::infrastructure::pdf::core::truncate_cell;
use crate::infrastructure::pdf::{
    render_chart_blocks, stamp_label, ChartHeaderContext, ChartPdfBlock, ChartPdfTable,
};
use serde::Deserialize;
use sqlx::SqlitePool;

fn default_true() -> bool {
    true
}

/// Fixed labels in the document language (`de`|`en`|`fr`|`ar`).
fn l(locale: &str, en: &'static str) -> String {
    use crate::infrastructure::pdf::i18n::pick;
    let (de, en_s, fr, ar) = match en {
        "(no anamnesis form recorded)" => ("(kein Anamnesebogen erfasst)", "(no anamnesis form recorded)", "(aucun formulaire d'anamnèse)", "(لا يوجد استبيان سوابق)"),
        "(no appointment notes)" => ("(keine Terminnotizen)", "(no appointment notes)", "(aucune note de rendez-vous)", "(لا ملاحظات للموعد)"),
        "(no certificates)" => ("(keine Bescheinigungen)", "(no certificates)", "(aucun certificat)", "(لا توجد شهادات)"),
        "(no date)" => ("(ohne Datum)", "(no date)", "(sans date)", "(بدون تاريخ)"),
        "(no free text)" => ("(kein Freitext)", "(no free text)", "(aucun texte libre)", "(لا يوجد نص حر)"),
        "(no prescriptions recorded)" => ("(keine Verordnungen)", "(no prescriptions recorded)", "(aucune ordonnance)", "(لا توجد وصفات)"),
        "(no treatment entries)" => ("(keine Behandlungen)", "(no treatment entries)", "(aucun traitement)", "(لا توجد علاجات)"),
        "(no upcoming appointment booked)" => ("(kein Folgetermin vereinbart)", "(no upcoming appointment booked)", "(aucun prochain rendez-vous)", "(لا موعد قادم)"),
        "(none recorded)" => ("(nicht dokumentiert)", "(none recorded)", "(non renseigné)", "(غير مسجّل)"),
        "Active ingredient" => ("Wirkstoff", "Active ingredient", "Principe actif", "المادة الفعالة"),
        "Additional notes / aftercare" => ("Weitere Hinweise / Nachsorge", "Additional notes / aftercare", "Notes / suivi", "ملاحظات / متابعة"),
        "Address" => ("Anschrift", "Address", "Adresse", "العنوان"),
        "Aktion" => ("Aktion", "Action", "Action", "الإجراء"),
        "Amount" => ("Betrag", "Amount", "Montant", "المبلغ"),
        "Anamnesis / questionnaire" => ("Anamnesebogen", "Anamnesis / questionnaire", "Anamnèse / questionnaire", "الاستبيان / السوابق"),
        "Audit extract" => ("Protokollauszug", "Audit extract", "Extrait d'audit", "مقتطف التدقيق"),
        "Beschreibung" => ("Beschreibung", "Description", "Description", "الوصف"),
        "Cancelled" => ("Storniert", "Cancelled", "Annulé", "ملغى"),
        "Cat." => ("Kat.", "Cat.", "Cat.", "فئة"),
        "Certificates" => ("Bescheinigungen", "Certificates", "Certificats", "الشهادات"),
        "Certificates (overview)" => ("Bescheinigungen (Übersicht)", "Certificates (overview)", "Certificats (aperçu)", "الشهادات (نظرة عامة)"),
        "Chart ID" => ("Akten-ID", "Chart ID", "ID du dossier", "معرّف الملف"),
        "Chart attachments (metadata)" => ("Anhänge (Metadaten)", "Chart attachments (metadata)", "Pièces jointes (métadonnées)", "المرفقات (بيانات وصفية)"),
        "Chart status" => ("Aktenstatus", "Chart status", "Statut du dossier", "حالة الملف"),
        "Clinician" => ("Behandler/in", "Clinician", "Praticien", "الطبيب المعالج"),
        "Completed" => ("Abgeschlossen", "Completed", "Terminé", "مكتمل"),
        "Date" => ("Datum", "Date", "Date", "التاريخ"),
        "Date of birth" => ("Geburtsdatum", "Date of birth", "Date de naissance", "تاريخ الميلاد"),
        "Dateiname" => ("Dateiname", "File name", "Nom de fichier", "اسم الملف"),
        "DentalFindings" => ("Zahnbefunde", "Dental findings", "Bilans dentaires", "نتائج الأسنان"),
        "Description:" => ("Beschreibung:", "Description:", "Description :", "الوصف:"),
        "Diagnosis" => ("Diagnose", "Diagnosis", "Diagnostic", "التشخيص"),
        "Diagnosis/findings not included for this role." => ("Diagnose/Befunde für diese Rolle nicht enthalten.", "Diagnosis/findings not included for this role.", "Diagnostic/constatations non inclus pour ce rôle.", "التشخيص/النتائج غير مدرجة لهذا الدور."),
        "Disclosure only with the patient's explicit consent." => ("Weitergabe nur mit ausdrücklicher Einwilligung der Patientin bzw. des Patienten.", "Disclosure only with the patient's explicit consent.", "Divulgation uniquement avec le consentement explicite du patient.", "لا يُفصح إلا بموافقة صريحة من المريض."),
        "Discontinued" => ("Abgebrochen", "Discontinued", "Interrompu", "متوقف"),
        "Dosage" => ("Dosierung", "Dosage", "Posologie", "الجرعة"),
        "Duration" => ("Dauer", "Duration", "Durée", "المدة"),
        "Email" => ("E-Mail", "Email", "E-mail", "البريد الإلكتروني"),
        "Emergency" => ("Notfall", "Emergency", "Urgence", "طوارئ"),
        "Entity" => ("Objekt", "Entity", "Entité", "الكيان"),
        "Examination findings (full)" => ("Untersuchungsbefund (vollständig)", "Examination findings (full)", "Constatations d'examen (complet)", "نتائج الفحص (كاملة)"),
        "Examinations" => ("Untersuchungen", "Examinations", "Examens", "الفحوصات"),
        "Finding" => ("Befund", "Finding", "Constatation", "النتيجة"),
        "Findings" => ("Befunde", "Findings", "Constatations", "النتائج"),
        "Insurance number" => ("Versichertennummer", "Insurance number", "N° d'assuré", "رقم التأمين"),
        "Issued" => ("Ausgestellt", "Issued", "Émis", "تاريخ الإصدار"),
        "Kind" => ("Art", "Kind", "Type", "النوع"),
        "Last documented treatment" => ("Zuletzt dokumentierte Behandlung", "Last documented treatment", "Dernier traitement documenté", "آخر علاج موثّق"),
        "MIME" => ("Dateityp", "MIME", "Type MIME", "نوع الملف"),
        "Master data" => ("Stammdaten", "Master data", "Données de base", "البيانات الأساسية"),
        "Medication" => ("Arzneimittel", "Medication", "Médicament", "الدواء"),
        "Medication (prescriptions)" => ("Medikation (Verordnungen)", "Medication (prescriptions)", "Médication (ordonnances)", "الأدوية (الوصفات)"),
        "Medication (prescriptions, extract)" => ("Medikation (Verordnungen, Auszug)", "Medication (prescriptions, extract)", "Médication (ordonnances, extrait)", "الأدوية (الوصفات، مقتطف)"),
        "Next appointment" => ("Nächster Termin", "Next appointment", "Prochain rendez-vous", "الموعد التالي"),
        "Note" => ("Hinweis", "Note", "Remarque", "ملاحظة"),
        "Notes" => ("Notizen", "Notes", "Notes", "ملاحظات"),
        "Notes:" => ("Notizen:", "Notes:", "Notes :", "ملاحظات:"),
        "Patient" => ("Patient/in", "Patient", "Patient", "المريض"),
        "Patient chart (core)" => ("Patientenakte (Kern)", "Patient chart (core)", "Dossier patient (noyau)", "ملف المريض (الأساسي)"),
        "Patient status" => ("Patientenstatus", "Patient status", "Statut du patient", "حالة المريض"),
        "Patient — master data" => ("Patient/in – Stammdaten", "Patient — master data", "Patient — données de base", "المريض — البيانات الأساسية"),
        "Payments / Buchungen" => ("Zahlungen", "Payments", "Paiements", "المدفوعات"),
        "Phone" => ("Telefon", "Phone", "Téléphone", "الهاتف"),
        "Planned" => ("Geplant", "Planned", "Planifié", "مخطط"),
        "In progress" => ("In Behandlung", "In progress", "En cours", "قيد التنفيذ"),
        "Please bring this sheet to follow-up appointments if it was given to you." => ("Bitte bringen Sie dieses Blatt zu Folgeterminen mit.", "Please bring this sheet to follow-up appointments if it was given to you.", "Veuillez apporter cette feuille aux rendez-vous de suivi.", "يُرجى إحضار هذه الورقة إلى مواعيد المتابعة."),
        "Practice" => ("Praxis", "Practice", "Cabinet", "العيادة"),
        "Prescriptions" => ("Verordnungen", "Prescriptions", "Ordonnances", "الوصفات"),
        "Referral / onward care" => ("Überweisung / Weiterbehandlung", "Referral / onward care", "Orientation / suite des soins", "إحالة / متابعة العلاج"),
        "ServiceItem" => ("Leistung", "Service", "Prestation", "الخدمة"),
        "Sess." => ("Sitz.", "Sess.", "Séance", "جلسة"),
        "Sex" => ("Geschlecht", "Sex", "Sexe", "الجنس"),
        "This document contains confidential patient data (§ 630f BGB)." => ("Dieses Dokument enthält vertrauliche Patientendaten (§ 630f BGB, Art. 9 DSGVO).", "This document contains confidential patient data (§ 630f BGB).", "Ce document contient des données patient confidentielles (§ 630f BGB).", "يحتوي هذا المستند على بيانات مريض سرية (§ 630f BGB)."),
        "This leaflet summarises data from the practice software and does not replace medical advice." => ("Dieses Merkblatt fasst Daten aus der Praxissoftware zusammen und ersetzt keine ärztliche Beratung.", "This leaflet summarises data from the practice software and does not replace medical advice.", "Cette fiche résume des données du logiciel et ne remplace pas un avis médical.", "تلخّص هذه الورقة بيانات من البرنامج ولا تغني عن الاستشارة الطبية."),
        "Time" => ("Zeit", "Time", "Heure", "الوقت"),
        "Tooth" => ("Zahn", "Tooth", "Dent", "السن"),
        "Treatments" => ("Behandlungen", "Treatments", "Traitements", "العلاجات"),
        "Type" => ("Art", "Type", "Type", "النوع"),
        "Valid from" => ("Gültig ab", "Valid from", "Valable du", "صالح من"),
        "Valid until" => ("Gültig bis", "Valid until", "Valable jusqu'au", "صالح حتى"),
        other => (other, other, other, other),
    };
    pick(locale, de, en_s, fr, ar).to_string()
}

/// Localised certificate kind (never the raw enum such as `SICK_LEAVE`).
fn certificate_kind_label(locale: &str, kind: &str) -> String {
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
fn gate_chart_sections(
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
fn chart_money(amount: f64) -> String {
    format!(
        "{amount:.2} {}",
        crate::infrastructure::pdf::document_currency()
    )
}

fn fmt_treatment_status(locale: &str, raw: &str) -> String {
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

async fn practice_kv_pairs_from_app_kv(pool: &SqlitePool, locale: &str) -> Vec<(String, String)> {
    let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.practice.v1").await else {
        return Vec::new();
    };
    let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Vec::new();
    };
    let get = |k: &str| {
        j.get(k)
            .and_then(|version| version.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let mut kv = Vec::new();
    if let Some(version) = get("name") {
        kv.push((l(locale, "Practice"), version));
    }
    if let Some(version) = get("clinician_name") {
        kv.push((l(locale, "Clinician"), version));
    }
    let german = crate::application::documents::practice_profile::uses_german_ids(
        get("country").as_deref(),
        get("currency").as_deref(),
    );
    if german {
        if let Some(version) = get("bsnr") {
            kv.push(("BSNR".into(), version));
        }
        if let Some(version) = get("zanr") {
            kv.push(("ZANR".into(), version));
        }
    }
    if let Some(version) = get("emergency_phone").or_else(|| get("notfall_phone")) {
        kv.push((l(locale, "Emergency"), version));
    }
    kv
}

async fn chart_header_from_app_kv(
    pool: &SqlitePool,
    created_by: &str,
    document_id: &str,
    locale: &str,
) -> Option<ChartHeaderContext> {
    let Ok(profile) = PracticeProfile::load(pool).await else {
        return None;
    };
    if profile.name.trim().is_empty() {
        return None;
    }
    let trimmed = |value: &Option<String>| {
        value
            .as_ref()
            .map(|text| text.trim().to_string())
            .filter(|text| !text.is_empty())
    };
    Some(ChartHeaderContext {
        practice_lines: profile.letterhead_lines(),
        clinician_name: trimmed(&profile.clinician_name),
        professional_title: trimmed(&profile.professional_title),
        bsnr: trimmed(&profile.bsnr),
        zanr: trimmed(&profile.zanr),
        created_by: Some(created_by.to_string()),
        document_id: Some(document_id.to_string()),
        logo: crate::application::documents::practice_profile::practice_logo(pool).await,
        locale: locale.into(),
        rtl: locale == "ar",
        watermark: None,
        footer_lines: profile.footer_lines(locale),
    })
}

#[derive(Debug, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartExportSections {
    #[serde(default = "default_true")]
    pub patient: bool,
    #[serde(default = "default_true")]
    pub chart_core: bool,
    #[serde(default = "default_true")]
    pub dental_findings: bool,
    #[serde(default = "default_true")]
    pub anamnesis: bool,
    #[serde(default = "default_true")]
    pub examinations: bool,
    #[serde(default = "default_true")]
    pub treatments: bool,
    #[serde(default = "default_true")]
    pub prescriptions: bool,
    #[serde(default = "default_true")]
    pub certificate: bool,
    #[serde(default = "default_true")]
    pub payments: bool,
    #[serde(default = "default_true")]
    pub attachments: bool,
    /// Audit-Log-Auszug für diesen Patients (`entity_id`); nur mit `audit.read`.
    #[serde(default)]
    pub audit: bool,
}

impl Default for ChartExportSections {
    fn default() -> Self {
        Self {
            patient: true,
            chart_core: true,
            dental_findings: true,
            anamnesis: true,
            examinations: true,
            treatments: true,
            prescriptions: true,
            certificate: true,
            payments: true,
            attachments: true,
            audit: false,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportChartPdfArgs {
    /// Akzeptiert `patientId` (Tauri/JS) und Legacy `patient_id`.
    #[serde(alias = "patient_id")]
    pub patient_id: String,
    #[serde(default)]
    pub sections: ChartExportSections,
    /// Watermarked preview: no number, no registry entry, no export audit.
    #[serde(default)]
    pub preview: bool,
    /// Document language requested by the client; None → Settings language.
    #[serde(default)]
    pub locale: Option<String>,
}

/// FA-DOK-08: Discharge leaflet / aftercare as PDF (compact summary).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDischargeLeafletPdfArgs {
    #[serde(alias = "patient_id")]
    pub patient_id: String,
    /// Additional notes / aftercare.
    #[serde(default, alias = "additionalNotes")]
    pub additional_notes: Option<String>,
    /// Referral / onward care.
    #[serde(default, alias = "referralNotes")]
    pub referral_notes: Option<String>,
    #[serde(default)]
    pub preview: bool,
    #[serde(default)]
    pub locale: Option<String>,
}

/// FA-AKTE-04: patient chart extract as PDF (selectable sections).
/// `preview = true` → watermarked, unnumbered, not registered.
pub async fn export_chart_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportChartPdfArgs,
) -> Result<IssuedPdf, AppError> {
    use base64::Engine;
    let preview = args.preview;

    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let ov = &session.permission_overrides;
    let patient_id = args.patient_id.clone();
    let mut sec = args.sections;
    gate_chart_sections(&mut sec, role, ov);
    let sections_json = serde_json::to_value(&sec).unwrap_or_default();
    let medical = rbac::effective_allowed("patient.read_medical", role, ov);

    let patient = patient_repo::find_by_id(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let chart = chart_repo::find_chart_by_patient(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;

    let mut chart_display = chart.clone();
    if !medical {
        chart_display.diagnosis = None;
        chart_display.findings = None;
    }

    let _ = PracticeProfile::load(pool).await;
    let locale = resolve_document_locale(pool, args.locale.as_deref()).await;
    // Local time: the document is read by people in the practice's time zone.
    let generated = chrono::Local::now().format("%d.%m.%Y %H:%M").to_string();
    let mut blocks: Vec<ChartPdfBlock> = Vec::new();

    let practice_kv = practice_kv_pairs_from_app_kv(pool, locale).await;
    if !practice_kv.is_empty() {
        blocks.insert(
            0,
            ChartPdfBlock {
                title: l(locale, "Practice"),
                body_lines: vec![],
                kv_pairs: practice_kv,
                table: None,
            },
        );
    }

    if sec.patient {
        let mut kv = vec![
            ("Name".into(), patient.name.clone()),
            (
                l(locale, "Date of birth"),
                patient.date_of_birth.to_string(),
            ),
            (l(locale, "Sex"), patient.sex.clone()),
            (
                l(locale, "Insurance number"),
                patient.insurance_number.clone().unwrap_or_default(),
            ),
            (l(locale, "Patient status"), patient.status.clone()),
        ];
        if let Some(t) = &patient.phone {
            kv.push((l(locale, "Phone"), t.clone()));
        }
        if let Some(e) = &patient.email {
            kv.push((l(locale, "Email"), e.clone()));
        }
        if let Some(a) = &patient.address {
            kv.push((l(locale, "Address"), a.clone()));
        }
        blocks.push(ChartPdfBlock {
            title: l(locale, "Master data"),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.chart_core {
        let mut kv = vec![
            (l(locale, "Chart ID"), chart_display.id.clone()),
            (l(locale, "Chart status"), chart_display.status.clone()),
        ];
        if medical {
            kv.push((
                l(locale, "Diagnosis"),
                chart_display
                    .diagnosis
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| l(locale, "(none recorded)")),
            ));
            kv.push((
                l(locale, "Findings"),
                chart_display
                    .findings
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| l(locale, "(none recorded)")),
            ));
        } else {
            kv.push((
                l(locale, "Note"),
                l(locale, "Diagnosis/findings not included for this role."),
            ));
        }
        blocks.push(ChartPdfBlock {
            title: l(locale, "Patient chart (core)"),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.dental_findings && medical {
        let rows_db = chart_repo::find_dental_findings(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Tooth"),
                    l(locale, "Finding"),
                    l(locale, "Diagnosis"),
                    l(locale, "Notes"),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Tooth"),
                    l(locale, "Finding"),
                    l(locale, "Diagnosis"),
                    l(locale, "Notes"),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|z| {
                        vec![
                            z.tooth_number.to_string(),
                            z.finding.clone(),
                            z.diagnosis.as_deref().unwrap_or("-").to_string(),
                            z.notes.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "DentalFindings"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.anamnesis && medical {
        if let Some(am) = chart_repo::find_anamnesis_form(pool, &patient_id).await? {
            let signed = match am.signed {
                true => crate::infrastructure::pdf::i18n::pick(
                    locale,
                    "Unterschrieben: ja",
                    "Signed: yes",
                    "Signé : oui",
                    "موقّع: نعم",
                ),
                false => crate::infrastructure::pdf::i18n::pick(
                    locale,
                    "Unterschrieben: nein",
                    "Signed: no",
                    "Signé : non",
                    "موقّع: لا",
                ),
            };
            let mut lines =
                crate::infrastructure::clinical_text_format::format_anamnesis_answers(&am.answers);
            lines.insert(0, signed.to_string());
            blocks.push(ChartPdfBlock {
                title: l(locale, "Anamnesis / questionnaire"),
                body_lines: lines,
                kv_pairs: vec![],
                table: None,
            });
        } else {
            blocks.push(ChartPdfBlock::body(
                l(locale, "Anamnesis / questionnaire"),
                vec![l(locale, "(no anamnesis form recorded)")],
            ));
        }
    }

    if sec.examinations && medical {
        let rows_db = chart_repo::list_examinations(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Date"),
                    "Nr.".into(),
                    l(locale, "Examination findings (full)"),
                ],
                rows: vec![],
                column_weights: Some(vec![2, 1, 12]),
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Date"),
                    "Nr.".into(),
                    l(locale, "Examination findings (full)"),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|u| {
                        let finding =
                            crate::infrastructure::clinical_text_format::format_examination_for_chart_table(
                                u.chief_complaint.as_deref(),
                                u.results.as_deref(),
                                u.diagnosis.as_deref(),
                            );
                        vec![
                            u.created_at.format("%Y-%m-%d").to_string(),
                            u.examination_number.as_deref().unwrap_or("-").to_string(),
                            finding,
                        ]
                    })
                    .collect(),
                column_weights: Some(vec![2, 1, 12]),
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Examinations"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.treatments && medical {
        let rows_db = chart_repo::list_treatments(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Date"),
                    l(locale, "ServiceItem"),
                    l(locale, "Cat."),
                    l(locale, "Sess."),
                    "B-Nr.".into(),
                    "Status".into(),
                    l(locale, "Amount"),
                    l(locale, "Notes"),
                ],
                rows: vec![],
                column_weights: Some(vec![2, 4, 2, 1, 1, 2, 1, 3]),
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Date"),
                    l(locale, "ServiceItem"),
                    l(locale, "Cat."),
                    l(locale, "Sess."),
                    "B-Nr.".into(),
                    "Status".into(),
                    l(locale, "Amount"),
                    l(locale, "Notes"),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|b| {
                        let d = b.treatment_date.as_deref().unwrap_or("");
                        let date_part = if d.is_empty() {
                            b.created_at.format("%Y-%m-%d").to_string()
                        } else {
                            d.to_string()
                        };
                        let title = b
                            .service_name
                            .as_deref()
                            .or(b.description.as_deref())
                            .unwrap_or(b.kind.as_str())
                            .to_string();
                        let cost = b.total_cost.map(chart_money).unwrap_or_else(|| "-".into());
                        vec![
                            date_part,
                            title,
                            b.category.as_deref().unwrap_or("-").to_string(),
                            b.session_number
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| "-".into()),
                            b.treatment_number.as_deref().unwrap_or("-").to_string(),
                            fmt_treatment_status(
                                locale,
                                b.treatment_status.as_deref().unwrap_or("-"),
                            ),
                            cost,
                            b.notes.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                column_weights: Some(vec![2, 4, 2, 1, 1, 2, 1, 3]),
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Treatments"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.prescriptions && medical {
        let rows_db = prescription_repo::find_for_patient(pool, &patient_id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Issued"),
                    l(locale, "Medication"),
                    l(locale, "Dosage"),
                    l(locale, "Duration"),
                    "Status".into(),
                    l(locale, "Active ingredient"),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Issued"),
                    l(locale, "Medication"),
                    l(locale, "Dosage"),
                    l(locale, "Duration"),
                    "Status".into(),
                    l(locale, "Active ingredient"),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|r| {
                        vec![
                            r.issued_at.to_string(),
                            r.medication.clone(),
                            r.dosage.clone(),
                            r.duration.clone(),
                            r.status.clone(),
                            r.active_ingredient.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Prescriptions"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.certificate && medical {
        let rows_db = certificate_repo::find_for_patient(pool, &patient_id).await?;
        if rows_db.is_empty() {
            blocks.push(ChartPdfBlock::body(
                l(locale, "Certificates"),
                vec![l(locale, "(no certificates)")],
            ));
        } else {
            let certificate_rows: Vec<Vec<String>> = rows_db
                .iter()
                .map(|a| {
                    vec![
                        certificate_kind_label(locale, &a.kind),
                        a.valid_from.to_string(),
                        a.valid_until.to_string(),
                        a.issued_at.to_string(),
                    ]
                })
                .collect();
            blocks.push(ChartPdfBlock {
                title: l(locale, "Certificates (overview)"),
                body_lines: vec![],
                kv_pairs: vec![],
                table: Some(ChartPdfTable {
                    headers: vec![
                        l(locale, "Type"),
                        l(locale, "Valid from"),
                        l(locale, "Valid until"),
                        l(locale, "Issued"),
                    ],
                    rows: certificate_rows,
                    ..Default::default()
                }),
            });
            for a in rows_db {
                let mut lines: Vec<String> = Vec::new();
                if a.body_text.trim().is_empty() {
                    lines.push(l(locale, "(no free text)"));
                } else {
                    for ln in a.body_text.lines() {
                        lines.push(if ln.is_empty() {
                            " ".into()
                        } else {
                            ln.to_string()
                        });
                    }
                }
                blocks.push(ChartPdfBlock::body(
                    certificate_kind_label(locale, &a.kind),
                    lines,
                ));
            }
        }
    }

    if sec.payments {
        let rows_db = payment_repo::find_by_patient_id(pool, &patient_id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Time"),
                    l(locale, "Amount"),
                    l(locale, "Kind"),
                    "Status".into(),
                    l(locale, "Beschreibung"),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Time"),
                    l(locale, "Amount"),
                    l(locale, "Kind"),
                    "Status".into(),
                    l(locale, "Beschreibung"),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|z| {
                        vec![
                            z.created_at.format("%Y-%m-%d %H:%M").to_string(),
                            chart_money(z.amount),
                            z.payment_method.to_string(),
                            z.status.to_string(),
                            z.description.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Payments / Buchungen"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.attachments {
        let rows_db = chart_attachment_repo::list_for_chart(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Dateiname"),
                    l(locale, "MIME"),
                    l(locale, "Date"),
                    "Bytes".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Dateiname"),
                    l(locale, "MIME"),
                    l(locale, "Date"),
                    "Bytes".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|r| {
                        vec![
                            r.display_name.clone(),
                            r.mime_type.clone(),
                            r.created_at.to_string(),
                            r.size_bytes.to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Chart attachments (metadata)"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.audit {
        let rows_db = audit_repo::find_for_patient_entity(pool, &patient_id, 500).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Time"),
                    l(locale, "Aktion"),
                    l(locale, "Entity"),
                    "ID".into(),
                    "Details".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    l(locale, "Time"),
                    l(locale, "Aktion"),
                    l(locale, "Entity"),
                    "ID".into(),
                    "Details".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|r| {
                        vec![
                            r.created_at.format("%Y-%m-%d %H:%M").to_string(),
                            r.action.clone(),
                            r.entity.clone(),
                            r.entity_id.as_deref().unwrap_or("-").to_string(),
                            r.details.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Audit extract"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    let created_by = format!("{} ({})", session.name, session.role);
    let title = crate::infrastructure::pdf::i18n::pick(
        locale,
        "Patientenakte – Auszug",
        "Patient chart – extract",
        "Dossier patient – extrait",
        "ملف المريض – مقتطف",
    );
    let pdf_title = format!("{title} {}", patient.name);
    let header_base = chart_header_from_app_kv(pool, &created_by, "", locale).await;
    let render = |number: &str, watermark: Option<String>| -> Result<Vec<u8>, AppError> {
        let mut blocks = blocks.clone();
        let mut header = header_base.clone();
        if let Some(h) = header.as_mut() {
            h.document_id = Some(number.to_string());
            h.watermark = watermark;
        }
        blocks.push(ChartPdfBlock::body(
            l(locale, "Notes"),
            vec![
                format!(
                    "{}: {created_by}",
                    crate::infrastructure::pdf::i18n::t(
                        locale,
                        crate::infrastructure::pdf::i18n::Phrase::CreatedBy
                    )
                ),
                format!(
                    "{}: {number}",
                    crate::infrastructure::pdf::i18n::t(
                        locale,
                        crate::infrastructure::pdf::i18n::Phrase::DocumentNo
                    )
                ),
                // Legal basis follows the practice's jurisdiction (§ 630f BGB only in Germany).
                crate::infrastructure::pdf::i18n::t(
                    locale,
                    crate::infrastructure::pdf::i18n::Phrase::ChartPrivacy,
                )
                .to_string(),
                l(
                    locale,
                    "Disclosure only with the patient's explicit consent.",
                ),
            ],
        ));
        render_chart_blocks(title, &generated, &pdf_title, &blocks, header.as_ref())
    };

    if preview {
        let bytes = render(WATERMARK_PREVIEW, Some(WATERMARK_PREVIEW.into()))?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: crate::infrastructure::database::repos::billing::issued_document::sha256_hex(
                &bytes,
            ),
            pdf_base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
            reprint: false,
        });
    }
    let payload = serde_json::json!({ "sections": sections_json, "generatedAt": generated });
    register_rendered(
        pool,
        session,
        DocKind::ChartExtract,
        &patient_id,
        payload,
        |number| render(number, None),
    )
    .await
}

/// FA-DOK-08: Discharge leaflet / aftercare as PDF.
pub async fn export_discharge_leaflet_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportDischargeLeafletPdfArgs,
) -> Result<IssuedPdf, AppError> {
    use base64::Engine;
    let preview = args.preview;

    let patient_id = args.patient_id.clone();
    let patient = patient_repo::find_by_id(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let chart = chart_repo::find_chart_by_patient(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;

    let locale = resolve_document_locale(pool, args.locale.as_deref()).await;
    // Local time: the document is read by people in the practice's time zone.
    let generated = chrono::Local::now().format("%d.%m.%Y %H:%M").to_string();
    let mut blocks: Vec<ChartPdfBlock> = Vec::new();

    let practice_kv = practice_kv_pairs_from_app_kv(pool, locale).await;
    if !practice_kv.is_empty() {
        blocks.insert(
            0,
            ChartPdfBlock {
                title: l(locale, "Practice"),
                body_lines: vec![],
                kv_pairs: practice_kv,
                table: None,
            },
        );
    }

    let mut master_kv = vec![
        ("Name".into(), patient.name.clone()),
        (
            l(locale, "Date of birth"),
            patient.date_of_birth.to_string(),
        ),
    ];
    if let Some(t) = &patient.phone {
        master_kv.push((l(locale, "Phone"), t.clone()));
    }
    if let Some(e) = &patient.email {
        master_kv.push((l(locale, "Email"), e.clone()));
    }
    blocks.push(ChartPdfBlock {
        title: l(locale, "Patient — master data"),
        body_lines: vec![],
        kv_pairs: master_kv,
        table: None,
    });

    let mut bh_list = chart_repo::list_treatments(pool, &chart.id).await?;
    bh_list.sort_by(|a, b| {
        let da = a.treatment_date.as_deref().unwrap_or("0000-01-01");
        let db = b.treatment_date.as_deref().unwrap_or("0000-01-01");
        db.cmp(da).then_with(|| b.created_at.cmp(&a.created_at))
    });
    let latest_bh = bh_list.into_iter().next();

    if let Some(b) = latest_bh {
        let mut lines: Vec<String> = Vec::new();
        lines.push(format!(
            "{}: {}",
            l(locale, "Date"),
            b.treatment_date
                .clone()
                .unwrap_or_else(|| l(locale, "(no date)"))
        ));
        lines.push(format!("{}: {}", l(locale, "Kind"), b.kind));
        if let Some(k) = &b.category {
            if !k.trim().is_empty() {
                lines.push(format!(
                    "{}: {}",
                    crate::infrastructure::pdf::i18n::pick(
                        locale,
                        "Kategorie",
                        "Category",
                        "Catégorie",
                        "الفئة",
                    ),
                    k
                ));
            }
        }
        if let Some(desc) = &b.description {
            if !desc.trim().is_empty() {
                lines.push(l(locale, "Description:"));
                for ln in desc.lines() {
                    lines.push(if ln.is_empty() {
                        " ".into()
                    } else {
                        ln.to_string()
                    });
                }
            }
        }
        if let Some(n) = &b.notes {
            if !n.trim().is_empty() {
                lines.push(l(locale, "Notes:"));
                for ln in n.lines() {
                    lines.push(if ln.is_empty() {
                        " ".into()
                    } else {
                        ln.to_string()
                    });
                }
            }
        }
        blocks.push(ChartPdfBlock::body(
            l(locale, "Last documented treatment"),
            lines,
        ));
    } else {
        blocks.push(ChartPdfBlock::body(
            l(locale, "Last documented treatment"),
            vec![l(locale, "(no treatment entries)")],
        ));
    }

    let prescriptions = prescription_repo::find_for_patient(pool, &patient_id).await?;
    let rz_take: Vec<_> = prescriptions.into_iter().take(12).collect();
    if rz_take.is_empty() {
        blocks.push(ChartPdfBlock::body(
            l(locale, "Medication (prescriptions)"),
            vec![l(locale, "(no prescriptions recorded)")],
        ));
    } else {
        let tbl = ChartPdfTable {
            headers: vec![
                l(locale, "Issued"),
                l(locale, "Medication"),
                l(locale, "Dosage"),
                l(locale, "Duration"),
                l(locale, "Notes"),
            ],
            rows: rz_take
                .iter()
                .map(|r| {
                    vec![
                        r.issued_at.to_string(),
                        r.medication.clone(),
                        r.dosage.clone(),
                        r.duration.clone(),
                        r.instructions.as_deref().unwrap_or("-").to_string(),
                    ]
                })
                .collect(),
            ..Default::default()
        };
        blocks.push(ChartPdfBlock {
            title: l(locale, "Medication (prescriptions, extract)"),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    match appointment_repo::find_next_for_patient(pool, &patient_id).await? {
        Some(t) => {
            blocks.push(ChartPdfBlock::body(
                l(locale, "Next appointment"),
                vec![
                    format!("{}: {} {}", l(locale, "Date"), t.date, t.time),
                    format!("{}: {}", l(locale, "Kind"), t.kind),
                    format!("Status: {}", t.status),
                    t.notes
                        .filter(|s| !s.trim().is_empty())
                        .map(|s| format!("{} {}", l(locale, "Notes:"), s))
                        .unwrap_or_else(|| l(locale, "(no appointment notes)")),
                ],
            ));
        }
        None => {
            blocks.push(ChartPdfBlock::body(
                l(locale, "Next appointment"),
                vec![l(locale, "(no upcoming appointment booked)")],
            ));
        }
    }

    if let Some(txt) = args
        .referral_notes
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        let mut lines: Vec<String> = Vec::new();
        for ln in txt.lines() {
            lines.push(if ln.is_empty() {
                " ".into()
            } else {
                ln.to_string()
            });
        }
        blocks.push(ChartPdfBlock::body(
            l(locale, "Referral / onward care"),
            lines,
        ));
    }

    if let Some(txt) = args
        .additional_notes
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        let mut lines: Vec<String> = Vec::new();
        for ln in txt.lines() {
            lines.push(if ln.is_empty() {
                " ".into()
            } else {
                ln.to_string()
            });
        }
        blocks.push(ChartPdfBlock::body(
            l(locale, "Additional notes / aftercare"),
            lines,
        ));
    }

    if let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.practice.v1").await {
        if let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) {
            let bh = j
                .get("clinician_name")
                .and_then(|version| version.as_str())
                .unwrap_or("")
                .trim();
            let professional_title = j
                .get("professional_title")
                .and_then(|version| version.as_str())
                .unwrap_or("")
                .trim();
            if !bh.is_empty() {
                let mut sig = vec![
                    String::new(),
                    "____________________________".into(),
                    bh.to_string(),
                ];
                if !professional_title.is_empty() {
                    sig.push(professional_title.to_string());
                }
                let zanr = j
                    .get("zanr")
                    .and_then(|version| version.as_str())
                    .unwrap_or("")
                    .trim();
                let bsnr = j
                    .get("bsnr")
                    .and_then(|version| version.as_str())
                    .unwrap_or("")
                    .trim();
                let german = crate::application::documents::practice_profile::uses_german_ids(
                    j.get("country").and_then(|v| v.as_str()),
                    j.get("currency").and_then(|v| v.as_str()),
                );
                if german && (!zanr.is_empty() || !bsnr.is_empty()) {
                    sig.push(format!("ZANR: {zanr} · BSNR: {bsnr}"));
                }
                sig.push(stamp_label(locale).into());
                blocks.push(ChartPdfBlock::body(
                    crate::infrastructure::pdf::i18n::pick(
                        locale,
                        "Behandler/in / Unterschrift",
                        "Clinician / signature",
                        "Praticien / signature",
                        "الطبيب المعالج / التوقيع",
                    ),
                    sig,
                ));
            }
        }
    }

    let created_by = format!("{} ({})", session.name, session.role);
    let title = crate::infrastructure::pdf::i18n::pick(
        locale,
        "Nachsorge-Merkblatt",
        "Discharge leaflet / aftercare",
        "Fiche de sortie / suivi",
        "ملخص الخروج / المتابعة",
    );
    let pdf_title = format!("{title} – {}", patient.name);
    let header_base = chart_header_from_app_kv(pool, &created_by, "", locale).await;
    let render = |number: &str, watermark: Option<String>| -> Result<Vec<u8>, AppError> {
        let mut blocks = blocks.clone();
        let mut header = header_base.clone();
        if let Some(h) = header.as_mut() {
            h.document_id = Some(number.to_string());
            h.watermark = watermark;
        }
        blocks.push(ChartPdfBlock::body(
            l(locale, "Note"),
            vec![
                format!(
                    "{}: {created_by}",
                    crate::infrastructure::pdf::i18n::t(
                        locale,
                        crate::infrastructure::pdf::i18n::Phrase::CreatedBy
                    )
                ),
                format!(
                    "{}: {number}",
                    crate::infrastructure::pdf::i18n::t(
                        locale,
                        crate::infrastructure::pdf::i18n::Phrase::DocumentNo
                    )
                ),
                l(locale, "This leaflet summarises data from the practice software and does not replace medical advice."),
                l(locale, "Please bring this sheet to follow-up appointments if it was given to you."),
            ],
        ));
        render_chart_blocks(title, &generated, &pdf_title, &blocks, header.as_ref())
    };

    if preview {
        let bytes = render(WATERMARK_PREVIEW, Some(WATERMARK_PREVIEW.into()))?;
        return Ok(IssuedPdf {
            document_id: None,
            document_number: None,
            sha256: crate::infrastructure::database::repos::billing::issued_document::sha256_hex(
                &bytes,
            ),
            pdf_base64: base64::engine::general_purpose::STANDARD.encode(&bytes),
            reprint: false,
        });
    }
    let payload = serde_json::json!({
        "generatedAt": generated,
        "additionalNotes": args.additional_notes,
        "referralNotes": args.referral_notes,
    });
    register_rendered(
        pool,
        session,
        DocKind::DischargeLeaflet,
        &patient_id,
        payload,
        |number| render(number, None),
    )
    .await
}

#[cfg(test)]
mod chart_money_tests {
    use super::chart_money;

    #[test]
    fn chart_money_appends_practice_currency() {
        assert_eq!(chart_money(80.0), "80.00 EUR");
        assert_eq!(chart_money(12.5), "12.50 EUR");
    }
}

#[cfg(test)]
mod chart_section_gate_tests {
    use super::{gate_chart_sections, ChartExportSections};
    use crate::application::rbac::Role;
    use crate::domain::rbac::PermissionOverride;

    #[test]
    fn denied_document_permission_hides_attachment_names() {
        let mut sections = ChartExportSections::default();
        gate_chart_sections(
            &mut sections,
            Role::Physician,
            &[PermissionOverride {
                action: "patient.read_documents".into(),
                effect: "DENY".into(),
            }],
        );
        assert!(!sections.attachments);
        assert!(sections.patient);
    }
}

#[cfg(test)]
mod export_chart_pdf_args_tests {
    use super::{ExportChartPdfArgs, ExportDischargeLeafletPdfArgs};

    #[test]
    fn deserializes_patient_id_camel_case() {
        let j = serde_json::json!({ "patientId": "p1" });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert!(a.sections.patient);
    }

    #[test]
    fn deserializes_patient_id_snake_case() {
        let j = serde_json::json!({ "patient_id": "p2" });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p2");
    }

    #[test]
    fn deserializes_sections_partial() {
        let j = serde_json::json!({
            "patientId": "p3",
            "sections": { "patient": true, "payments": false }
        });
        let a: ExportChartPdfArgs = serde_json::from_value(j).unwrap();
        assert!(a.sections.patient);
        assert!(!a.sections.payments);
        assert!(a.sections.chart_core);
    }

    #[test]
    fn discharge_args_deserializes_camel_case() {
        let j = serde_json::json!({
            "patientId": "p1",
            "additionalNotes": "Aftercare",
            "referralNotes": "CAD"
        });
        let a: ExportDischargeLeafletPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert_eq!(a.additional_notes.as_deref(), Some("Aftercare"));
        assert_eq!(a.referral_notes.as_deref(), Some("CAD"));
    }
}

#[cfg(test)]
mod chart_label_locale_tests {
    use super::{certificate_kind_label, l};

    #[test]
    fn fixed_labels_cover_all_document_locales() {
        let cases = [
            (
                "de",
                "Patientenakte (Kern)",
                "Stammdaten",
                "Arbeitsunfähigkeitsbescheinigung",
            ),
            (
                "en",
                "Patient chart (core)",
                "Master data",
                "Sick-leave certificate",
            ),
            (
                "fr",
                "Dossier patient (noyau)",
                "Données de base",
                "Certificat d'incapacité de travail",
            ),
            (
                "ar",
                "ملف المريض (الأساسي)",
                "البيانات الأساسية",
                "شهادة عجز عن العمل",
            ),
        ];
        for (locale, chart_core, master, sick) in cases {
            assert_eq!(l(locale, "Patient chart (core)"), chart_core);
            assert_eq!(l(locale, "Master data"), master);
            assert_eq!(certificate_kind_label(locale, "SICK_LEAVE"), sick);
        }
    }
}
