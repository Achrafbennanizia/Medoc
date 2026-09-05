//! FA-AKTE-04 / FA-DOK-08 — PDF export use cases for the patient chart (`patient_chart`).
//! User-facing PDF labels are English (default UI locale `en`).

use crate::application::auth_service::Session;
use crate::application::rbac::{self, Role};
use crate::error::AppError;
use crate::infrastructure::database::{
    chart_attachment_repo, chart_repo, app_kv_repo, certificate_repo, audit_repo, patient_repo, prescription_repo,
    appointment_repo, payment_repo,
};
use crate::infrastructure::pdf::{
    render_chart_blocks, ChartHeaderContext, ChartPdfBlock, ChartPdfTable,
};
use crate::infrastructure::pdf_core::truncate_cell;
use serde::Deserialize;
use sqlx::SqlitePool;

fn default_true() -> bool {
    true
}

fn fmt_treatment_status(raw: &str) -> String {
    match raw.trim().to_uppercase().as_str() {
        "COMPLETED" => "Completed".into(),
        "PLANNED" => "Planned".into(),
        "ABGEBROCHEN" => "Discontinued".into(),
        "CANCELLED" => "Cancelled".into(),
        other if other.is_empty() || other == "-" => "-".into(),
        other => truncate_cell(other, 12),
    }
}

async fn practice_kv_pairs_from_app_kv(pool: &SqlitePool) -> Vec<(String, String)> {
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
        kv.push(("Practice".into(), version));
    }
    if let Some(version) = get("clinician_name") {
        kv.push(("Clinician".into(), version));
    }
    if let Some(version) = get("bsnr") {
        kv.push(("BSNR".into(), version));
    }
    if let Some(version) = get("zanr") {
        kv.push(("ZANR".into(), version));
    }
    if let Some(version) = get("emergency_phone").or_else(|| get("notfall_phone")) {
        kv.push(("Emergency".into(), version));
    }
    kv
}

async fn chart_header_from_app_kv(
    pool: &SqlitePool,
    created_by: &str,
    document_id: &str,
) -> Option<ChartHeaderContext> {
    let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.practice.v1").await else {
        return None;
    };
    let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return None;
    };
    let get = |k: &str| {
        j.get(k)
            .and_then(|version| version.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let name = get("name")?;
    let mut practice_lines = vec![name];
    if let Some(addr) = get("addr") {
        for ln in addr.lines() {
            let t = ln.trim();
            if !t.is_empty() {
                practice_lines.push(t.to_string());
            }
        }
    }
    if let Some(t) = get("phone") {
        practice_lines.push(format!("Tel. {t}"));
    }
    if let Some(e) = get("email") {
        practice_lines.push(e);
    }
    Some(ChartHeaderContext {
        practice_lines,
        clinician_name: get("clinician_name"),
        professional_title: get("professional_title"),
        bsnr: get("bsnr"),
        zanr: get("zanr"),
        created_by: Some(created_by.to_string()),
        document_id: Some(document_id.to_string()),
        logo: app_kv_repo::get(pool, "practice.logo.v1")
            .await
            .ok()
            .flatten()
            .and_then(|raw| crate::infrastructure::pdf::PdfLogo::from_kv_json(&raw)),
        locale: "en".into(),
        rtl: false,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartExportSections {
    #[serde(default = "default_true")]
    pub patient: bool,
    #[serde(default = "default_true")]
    pub chart_core: bool,
    #[serde(default = "default_true")]
    pub dentalFindings: bool,
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
            dentalFindings: true,
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
}

/// FA-AKTE-04: PatientChart als PDF (Abschnitte wählbar). Base64-encoded PDF bytes.
pub async fn export_chart_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportChartPdfArgs,
) -> Result<String, AppError> {
    use base64::Engine;

    let role = Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    let ov = &session.permission_overrides;
    let medical = rbac::effective_allowed("patient.read_medical", role, ov);
    let finance = rbac::effective_allowed("finance.read", role, ov);

    let patient_id = args.patient_id.clone();
    let mut sec = args.sections;
    if !medical {
        sec.dentalFindings = false;
        sec.anamnesis = false;
        sec.examinations = false;
        sec.treatments = false;
        sec.prescriptions = false;
        sec.certificate = false;
    }
    if !finance {
        sec.payments = false;
    }

    let audit_ok = rbac::effective_allowed("audit.read", role, ov);
    if !audit_ok {
        sec.audit = false;
    }

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

    let generated = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let mut blocks: Vec<ChartPdfBlock> = Vec::new();

    let practice_kv = practice_kv_pairs_from_app_kv(pool).await;
    if !practice_kv.is_empty() {
        blocks.insert(
            0,
            ChartPdfBlock {
                title: "Practice".into(),
                body_lines: vec![],
                kv_pairs: practice_kv,
                table: None,
            },
        );
    }

    if sec.patient {
        let mut kv = vec![
            ("Name".into(), patient.name.clone()),
            ("Date of birth".into(), patient.date_of_birth.to_string()),
            ("Sex".into(), patient.sex.clone()),
            (
                "Insurance number".into(),
                patient.insurance_number.clone(),
            ),
            ("Patient status".into(), patient.status.clone()),
        ];
        if let Some(t) = &patient.phone {
            kv.push(("Phone".into(), t.clone()));
        }
        if let Some(e) = &patient.email {
            kv.push(("Email".into(), e.clone()));
        }
        if let Some(a) = &patient.address {
            kv.push(("Address".into(), a.clone()));
        }
        blocks.push(ChartPdfBlock {
            title: "Master data".into(),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.chart_core {
        let mut kv = vec![
            ("Chart ID".into(), chart_display.id.clone()),
            ("Chart status".into(), chart_display.status.clone()),
        ];
        if medical {
            kv.push((
                "Diagnosis".into(),
                chart_display
                    .diagnosis
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "(none recorded)".into()),
            ));
            kv.push((
                "Findings".into(),
                chart_display
                    .findings
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "(none recorded)".into()),
            ));
        } else {
            kv.push((
                "Note".into(),
                "Diagnosis/findings not included for this role.".into(),
            ));
        }
        blocks.push(ChartPdfBlock {
            title: "Patient chart (core)".into(),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.dentalFindings && medical {
        let rows_db = chart_repo::find_dental_findings(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    "Tooth".into(),
                    "Finding".into(),
                    "Diagnosis".into(),
                    "Notes".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Tooth".into(),
                    "Finding".into(),
                    "Diagnosis".into(),
                    "Notes".into(),
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
            title: "DentalFindings".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.anamnesis && medical {
        if let Some(am) = chart_repo::find_anamnesis_form(pool, &patient_id).await? {
            let signed = if am.signed { "Yes" } else { "No" };
            let mut lines = crate::infrastructure::clinical_text_format::format_anamnesis_answers(
                &am.answers,
            );
            lines.insert(0, format!("Signed: {signed}"));
            blocks.push(ChartPdfBlock {
                title: "Anamnesis / questionnaire".into(),
                body_lines: lines,
                kv_pairs: vec![],
                table: None,
            });
        } else {
            blocks.push(ChartPdfBlock::body(
                "Anamnesis / questionnaire",
                vec!["(no anamnesis form recorded)".into()],
            ));
        }
    }

    if sec.examinations && medical {
        let rows_db = chart_repo::list_examinations(pool, &chart.id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    "Date".into(),
                    "Nr.".into(),
                    "Examination findings (full)".into(),
                ],
                rows: vec![],
                column_weights: Some(vec![2, 1, 12]),
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Date".into(),
                    "Nr.".into(),
                    "Examination findings (full)".into(),
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
            title: "Examinations".into(),
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
                    "Date".into(),
                    "ServiceItem".into(),
                    "Cat.".into(),
                    "Sess.".into(),
                    "B-Nr.".into(),
                    "Status".into(),
                    "EUR".into(),
                    "Notes".into(),
                ],
                rows: vec![],
                column_weights: Some(vec![2, 4, 2, 1, 1, 2, 1, 3]),
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Date".into(),
                    "ServiceItem".into(),
                    "Cat.".into(),
                    "Sess.".into(),
                    "B-Nr.".into(),
                    "Status".into(),
                    "EUR".into(),
                    "Notes".into(),
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
                        let cost = b
                            .total_cost
                            .map(|k| format!("{:.2}", k))
                            .unwrap_or_else(|| "-".into());
                        vec![
                            date_part,
                            title,
                            b.category.as_deref().unwrap_or("-").to_string(),
                            b.session_number
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| "-".into()),
                            b.treatment_number.as_deref().unwrap_or("-").to_string(),
                            fmt_treatment_status(b.treatment_status.as_deref().unwrap_or("-")),
                            cost,
                            b.notes.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                column_weights: Some(vec![2, 4, 2, 1, 1, 2, 1, 3]),
            }
        };
        blocks.push(ChartPdfBlock {
            title: "Treatments".into(),
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
                    "Issued".into(),
                    "Medication".into(),
                    "Dosage".into(),
                    "Duration".into(),
                    "Status".into(),
                    "Active ingredient".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Issued".into(),
                    "Medication".into(),
                    "Dosage".into(),
                    "Duration".into(),
                    "Status".into(),
                    "Active ingredient".into(),
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
            title: "Prescriptions".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.certificate && medical {
        let rows_db = certificate_repo::find_for_patient(pool, &patient_id).await?;
        if rows_db.is_empty() {
            blocks.push(ChartPdfBlock::body(
                "Certificates",
                vec!["(no certificates)".into()],
            ));
        } else {
            let certificate_rows: Vec<Vec<String>> = rows_db
                .iter()
                .map(|a| {
                    vec![
                        a.kind.clone(),
                        a.valid_from.to_string(),
                        a.valid_until.to_string(),
                        a.issued_at.to_string(),
                    ]
                })
                .collect();
            blocks.push(ChartPdfBlock {
                title: "Certificates (overview)".into(),
                body_lines: vec![],
                kv_pairs: vec![],
                table: Some(ChartPdfTable {
                    headers: vec![
                        "Type".into(),
                        "Valid from".into(),
                        "Valid until".into(),
                        "Issued".into(),
                    ],
                    rows: certificate_rows,
                    ..Default::default()
                }),
            });
            for a in rows_db {
                let mut lines: Vec<String> = Vec::new();
                if a.body_text.trim().is_empty() {
                    lines.push("(no free text)".into());
                } else {
                    for ln in a.body_text.lines() {
                        lines.push(if ln.is_empty() {
                            " ".into()
                        } else {
                            ln.to_string()
                        });
                    }
                }
                blocks.push(ChartPdfBlock::body(format!("Certificate — {}", a.kind), lines));
            }
        }
    }

    if sec.payments && finance {
        let rows_db = payment_repo::find_by_patient_id(pool, &patient_id).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    "Time".into(),
                    "EUR".into(),
                    "Kind".into(),
                    "Status".into(),
                    "Beschreibung".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Time".into(),
                    "EUR".into(),
                    "Kind".into(),
                    "Status".into(),
                    "Beschreibung".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|z| {
                        vec![
                            z.created_at.format("%Y-%m-%d %H:%M").to_string(),
                            format!("{:.2}", z.amount),
                            format!("{}", z.payment_method),
                            format!("{}", z.status),
                            z.description.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(ChartPdfBlock {
            title: "Payments / Buchungen".into(),
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
                    "Dateiname".into(),
                    "MIME".into(),
                    "Date".into(),
                    "Bytes".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Dateiname".into(),
                    "MIME".into(),
                    "Date".into(),
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
            title: "Chart attachments (metadata)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.audit && audit_ok {
        let rows_db = audit_repo::find_for_patient_entity(pool, &patient_id, 500).await?;
        let tbl = if rows_db.is_empty() {
            ChartPdfTable {
                headers: vec![
                    "Time".into(),
                    "Aktion".into(),
                    "Entity".into(),
                    "ID".into(),
                    "Details".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            ChartPdfTable {
                headers: vec![
                    "Time".into(),
                    "Aktion".into(),
                    "Entity".into(),
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
            title: "Audit extract".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    let document_id = uuid::Uuid::new_v4().to_string();
    let created_by = format!("{} ({})", session.name, session.role);
    let header = chart_header_from_app_kv(pool, &created_by, &document_id).await;

    blocks.push(ChartPdfBlock::body(
        "Notes",
        vec![
            format!("Created by: {created_by}"),
            format!("Document-ID: {document_id}"),
            "This document contains confidential patient data (§ 630f BGB).".into(),
            "Disclosure only with the patient's explicit consent.".into(),
        ],
    ));

    let bytes = render_chart_blocks(
        "Patient chart — export",
        &generated,
        &format!("Patient chart {}", patient.name),
        &blocks,
        header.as_ref(),
    )?;

    audit_repo::create(
        pool,
        &session.user_id,
        "EXPORT_PDF",
        "PatientChart",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// FA-DOK-08: Discharge leaflet / aftercare as PDF.
pub async fn export_discharge_leaflet_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportDischargeLeafletPdfArgs,
) -> Result<String, AppError> {
    use base64::Engine;

    let patient_id = args.patient_id.clone();
    let patient = patient_repo::find_by_id(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let chart = chart_repo::find_chart_by_patient(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("PatientChart".into()))?;

    let generated = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let mut blocks: Vec<ChartPdfBlock> = Vec::new();

    let practice_kv = practice_kv_pairs_from_app_kv(pool).await;
    if !practice_kv.is_empty() {
        blocks.insert(
            0,
            ChartPdfBlock {
                title: "Practice".into(),
                body_lines: vec![],
                kv_pairs: practice_kv,
                table: None,
            },
        );
    }

    let mut master_kv = vec![
        ("Name".into(), patient.name.clone()),
        ("Date of birth".into(), patient.date_of_birth.to_string()),
    ];
    if let Some(t) = &patient.phone {
        master_kv.push(("Phone".into(), t.clone()));
    }
    if let Some(e) = &patient.email {
        master_kv.push(("Email".into(), e.clone()));
    }
    blocks.push(ChartPdfBlock {
        title: "Patient — master data".into(),
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
            "Date: {}",
            b.treatment_date
                .clone()
                .unwrap_or_else(|| "(no date)".into())
        ));
        lines.push(format!("Kind: {}", b.kind));
        if let Some(k) = &b.category {
            if !k.trim().is_empty() {
                lines.push(format!("Category: {}", k));
            }
        }
        if let Some(desc) = &b.description {
            if !desc.trim().is_empty() {
                lines.push("Description:".into());
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
                lines.push("Notes:".into());
                for ln in n.lines() {
                    lines.push(if ln.is_empty() {
                        " ".into()
                    } else {
                        ln.to_string()
                    });
                }
            }
        }
        blocks.push(ChartPdfBlock::body("Last documented treatment", lines));
    } else {
        blocks.push(ChartPdfBlock::body(
            "Last documented treatment",
            vec!["(no treatment entries)".into()],
        ));
    }

    let prescriptions = prescription_repo::find_for_patient(pool, &patient_id).await?;
    let rz_take: Vec<_> = prescriptions.into_iter().take(12).collect();
    if rz_take.is_empty() {
        blocks.push(ChartPdfBlock::body(
            "Medication (prescriptions)",
            vec!["(no prescriptions recorded)".into()],
        ));
    } else {
        let tbl = ChartPdfTable {
            headers: vec![
                "Issued".into(),
                "Medication".into(),
                "Dosage".into(),
                "Duration".into(),
                "Notes".into(),
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
            title: "Medication (prescriptions, extract)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    match appointment_repo::find_next_for_patient(pool, &patient_id).await? {
        Some(t) => {
            blocks.push(ChartPdfBlock::body(
                "Next appointment",
                vec![
                    format!("Date: {} {}", t.date, t.time),
                    format!("Kind: {}", t.kind),
                    format!("Status: {}", t.status),
                    t.notes
                        .filter(|s| !s.trim().is_empty())
                        .map(|s| format!("Notes: {}", s))
                        .unwrap_or_else(|| "(no appointment notes)".into()),
                ],
            ));
        }
        None => {
            blocks.push(ChartPdfBlock::body(
                "Next appointment",
                vec!["(no upcoming appointment booked)".into()],
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
            "Referral / onward care",
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
            "Additional notes / aftercare",
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
                let zanr = j.get("zanr").and_then(|version| version.as_str()).unwrap_or("").trim();
                let bsnr = j.get("bsnr").and_then(|version| version.as_str()).unwrap_or("").trim();
                if !zanr.is_empty() || !bsnr.is_empty() {
                    sig.push(format!("ZANR: {zanr} · BSNR: {bsnr}"));
                }
                sig.push("(Stempel)".into());
                blocks.push(ChartPdfBlock::body("Clinician / Unterschrift", sig));
            }
        }
    }

    let document_id = uuid::Uuid::new_v4().to_string();
    let created_by = format!("{} ({})", session.name, session.role);
    let header = chart_header_from_app_kv(pool, &created_by, &document_id).await;

    blocks.push(ChartPdfBlock::body(
        "Note",
        vec![
            format!("Created by: {created_by}"),
            format!("Document-ID: {document_id}"),
            "This leaflet summarises data from the practice software and does not replace medical advice.".into(),
            "Please bring this sheet to follow-up appointments if it was given to you.".into(),
        ],
    ));

    let bytes = render_chart_blocks(
        "Discharge leaflet / aftercare",
        &generated,
        &format!("Discharge leaflet — {}", patient.name),
        &blocks,
        header.as_ref(),
    )?;

    audit_repo::create(
        pool,
        &session.user_id,
        "EXPORT_PDF",
        "DischargeLeaflet",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
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
