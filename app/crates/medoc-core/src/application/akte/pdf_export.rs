//! FA-AKTE-04 / FA-DOK-08 — PDF export use cases for patientenakte.

use crate::application::auth_service::Session;
use crate::application::rbac::{self, Role};
use crate::error::AppError;
use crate::infrastructure::database::{
    akte_anlage_repo, akte_repo, app_kv_repo, attest_repo, audit_repo, patient_repo, rezept_repo,
    termin_repo, zahlung_repo,
};
use crate::infrastructure::pdf::{
    render_akte_blocks, AkteHeaderContext, AktePdfBlock, AktePdfTable,
};
use serde::Deserialize;
use sqlx::SqlitePool;

fn default_true() -> bool {
    true
}

async fn praxis_kv_pairs_from_app_kv(pool: &SqlitePool) -> Vec<(String, String)> {
    let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.praxis.v1").await else {
        return Vec::new();
    };
    let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return Vec::new();
    };
    let get = |k: &str| {
        j.get(k)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let mut kv = Vec::new();
    if let Some(v) = get("name") {
        kv.push(("Praxis".into(), v));
    }
    if let Some(v) = get("behandler_name") {
        kv.push(("Behandler".into(), v));
    }
    if let Some(v) = get("bsnr") {
        kv.push(("BSNR".into(), v));
    }
    if let Some(v) = get("zanr") {
        kv.push(("ZANR".into(), v));
    }
    if let Some(v) = get("notfall_telefon") {
        kv.push(("Notfall".into(), v));
    }
    kv
}

async fn akte_header_from_app_kv(
    pool: &SqlitePool,
    erstellt_von: &str,
    dokument_id: &str,
) -> Option<AkteHeaderContext> {
    let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.praxis.v1").await else {
        return None;
    };
    let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return None;
    };
    let get = |k: &str| {
        j.get(k)
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    };
    let name = get("name")?;
    let mut praxis_lines = vec![name];
    if let Some(addr) = get("addr") {
        for ln in addr.lines() {
            let t = ln.trim();
            if !t.is_empty() {
                praxis_lines.push(t.to_string());
            }
        }
    }
    if let Some(t) = get("telefon") {
        praxis_lines.push(format!("Tel. {t}"));
    }
    if let Some(e) = get("email") {
        praxis_lines.push(e);
    }
    Some(AkteHeaderContext {
        praxis_lines,
        behandler_name: get("behandler_name"),
        berufsbezeichnung: get("berufsbezeichnung"),
        bsnr: get("bsnr"),
        zanr: get("zanr"),
        erstellt_von: Some(erstellt_von.to_string()),
        dokument_id: Some(dokument_id.to_string()),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AkteExportSections {
    #[serde(default = "default_true")]
    pub patient: bool,
    #[serde(default = "default_true")]
    pub akte_core: bool,
    #[serde(default = "default_true")]
    pub zahnbefunde: bool,
    #[serde(default = "default_true")]
    pub anamnese: bool,
    #[serde(default = "default_true")]
    pub untersuchungen: bool,
    #[serde(default = "default_true")]
    pub behandlungen: bool,
    #[serde(default = "default_true")]
    pub rezepte: bool,
    #[serde(default = "default_true")]
    pub attest: bool,
    #[serde(default = "default_true")]
    pub zahlungen: bool,
    #[serde(default = "default_true")]
    pub anlagen: bool,
    /// Audit-Log-Auszug für diesen Patienten (`entity_id`); nur mit `audit.read`.
    #[serde(default)]
    pub audit: bool,
}

impl Default for AkteExportSections {
    fn default() -> Self {
        Self {
            patient: true,
            akte_core: true,
            zahnbefunde: true,
            anamnese: true,
            untersuchungen: true,
            behandlungen: true,
            rezepte: true,
            attest: true,
            zahlungen: true,
            anlagen: true,
            audit: false,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAktePdfArgs {
    /// Akzeptiert `patientId` (Tauri/JS) und Legacy `patient_id`.
    #[serde(alias = "patient_id")]
    pub patient_id: String,
    #[serde(default)]
    pub sections: AkteExportSections,
}

/// FA-DOK-08: Entlassungs-Merkblatt / Nachsorge als PDF (kompakte Zusammenfassung).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportDischargeMerkblattPdfArgs {
    #[serde(alias = "patient_id")]
    pub patient_id: String,
    #[serde(default)]
    pub zusatz_hinweise: Option<String>,
    #[serde(default)]
    pub ueberweisung_hinweise: Option<String>,
}

/// FA-AKTE-04: Patientenakte als PDF (Abschnitte wählbar). Base64-encoded PDF bytes.
pub async fn export_akte_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportAktePdfArgs,
) -> Result<String, AppError> {
    use base64::Engine;

    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    let medical = rbac::allowed("patient.read_medical", role);
    let finanzen = rbac::allowed("finanzen.read", role);

    let patient_id = args.patient_id.clone();
    let mut sec = args.sections;
    if !medical {
        sec.zahnbefunde = false;
        sec.anamnese = false;
        sec.untersuchungen = false;
        sec.behandlungen = false;
        sec.rezepte = false;
        sec.attest = false;
    }
    if !finanzen {
        sec.zahlungen = false;
    }

    let audit_ok = rbac::allowed("audit.read", role);
    if !audit_ok {
        sec.audit = false;
    }

    let patient = patient_repo::find_by_id(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let akte = akte_repo::find_akte_by_patient(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;

    let mut akte_display = akte.clone();
    if !medical {
        akte_display.diagnose = None;
        akte_display.befunde = None;
    }

    let generated = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let mut blocks: Vec<AktePdfBlock> = Vec::new();

    let praxis_kv = praxis_kv_pairs_from_app_kv(pool).await;
    if !praxis_kv.is_empty() {
        blocks.insert(
            0,
            AktePdfBlock {
                title: "Praxis".into(),
                body_lines: vec![],
                kv_pairs: praxis_kv,
                table: None,
            },
        );
    }

    if sec.patient {
        let mut kv = vec![
            ("Name".into(), patient.name.clone()),
            ("Geburtsdatum".into(), patient.geburtsdatum.to_string()),
            ("Geschlecht".into(), patient.geschlecht.clone()),
            (
                "Versicherungsnummer".into(),
                patient.versicherungsnummer.clone(),
            ),
            ("Patienten-Status".into(), patient.status.clone()),
        ];
        if let Some(t) = &patient.telefon {
            kv.push(("Telefon".into(), t.clone()));
        }
        if let Some(e) = &patient.email {
            kv.push(("E-Mail".into(), e.clone()));
        }
        if let Some(a) = &patient.adresse {
            kv.push(("Adresse".into(), a.clone()));
        }
        blocks.push(AktePdfBlock {
            title: "Stammdaten".into(),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.akte_core {
        let mut kv = vec![
            ("Akten-ID".into(), akte_display.id.clone()),
            ("Akten-Status".into(), akte_display.status.clone()),
        ];
        if medical {
            kv.push((
                "Diagnose".into(),
                akte_display
                    .diagnose
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "(keine Eintragung)".into()),
            ));
            kv.push((
                "Befunde".into(),
                akte_display
                    .befunde
                    .as_deref()
                    .map(crate::infrastructure::clinical_text_format::plain_text_for_pdf)
                    .filter(|s| !s.trim().is_empty())
                    .unwrap_or_else(|| "(keine Eintragung)".into()),
            ));
        } else {
            kv.push((
                "Hinweis".into(),
                "Diagnose/Befunde für diese Rolle nicht enthalten.".into(),
            ));
        }
        blocks.push(AktePdfBlock {
            title: "Patientenakte (Kern)".into(),
            body_lines: vec![],
            kv_pairs: kv,
            table: None,
        });
    }

    if sec.zahnbefunde && medical {
        let rows_db = akte_repo::find_zahnbefunde(pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Zahn".into(),
                    "Befund".into(),
                    "Diagnose".into(),
                    "Notizen".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Zahn".into(),
                    "Befund".into(),
                    "Diagnose".into(),
                    "Notizen".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|z| {
                        vec![
                            z.zahn_nummer.to_string(),
                            z.befund.clone(),
                            z.diagnose.as_deref().unwrap_or("-").to_string(),
                            z.notizen.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(AktePdfBlock {
            title: "Zahnbefunde".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.anamnese && medical {
        if let Some(am) = akte_repo::find_anamnesebogen(pool, &patient_id).await? {
            let signed = if am.unterschrieben { "Ja" } else { "Nein" };
            let mut lines = crate::infrastructure::clinical_text_format::format_anamnese_antworten(
                &am.antworten,
            );
            lines.insert(0, format!("Unterschrieben: {signed}"));
            blocks.push(AktePdfBlock {
                title: "Anamnese / Fragebogen".into(),
                body_lines: lines,
                kv_pairs: vec![],
                table: None,
            });
        } else {
            blocks.push(AktePdfBlock::body(
                "Anamnese / Fragebogen",
                vec!["(kein Anamnesebogen erfasst)".into()],
            ));
        }
    }

    if sec.untersuchungen && medical {
        let rows_db = akte_repo::list_untersuchungen(pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Nr.".into(),
                    "Untersuchungsbefund (vollständig)".into(),
                ],
                rows: vec![],
                column_weights: Some(vec![2, 1, 12]),
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Nr.".into(),
                    "Untersuchungsbefund (vollständig)".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|u| {
                        let befund =
                            crate::infrastructure::clinical_text_format::format_untersuchung_for_akte_table(
                                u.beschwerden.as_deref(),
                                u.ergebnisse.as_deref(),
                                u.diagnose.as_deref(),
                            );
                        vec![
                            u.created_at.format("%Y-%m-%d").to_string(),
                            u.untersuchungsnummer.as_deref().unwrap_or("-").to_string(),
                            befund,
                        ]
                    })
                    .collect(),
                column_weights: Some(vec![2, 1, 12]),
            }
        };
        blocks.push(AktePdfBlock {
            title: "Untersuchungen".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.behandlungen && medical {
        let rows_db = akte_repo::list_behandlungen(pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Leistung".into(),
                    "Kat.".into(),
                    "Sitz.".into(),
                    "B-Nr.".into(),
                    "Status".into(),
                    "EUR".into(),
                    "Notizen".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Leistung".into(),
                    "Kat.".into(),
                    "Sitz.".into(),
                    "B-Nr.".into(),
                    "Status".into(),
                    "EUR".into(),
                    "Notizen".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|b| {
                        let d = b.behandlung_datum.as_deref().unwrap_or("");
                        let date_part = if d.is_empty() {
                            b.created_at.format("%Y-%m-%d").to_string()
                        } else {
                            d.to_string()
                        };
                        let titel = b
                            .leistungsname
                            .as_deref()
                            .or(b.beschreibung.as_deref())
                            .unwrap_or(b.art.as_str())
                            .to_string();
                        let kosten = b
                            .gesamtkosten
                            .map(|k| format!("{:.2}", k))
                            .unwrap_or_else(|| "-".into());
                        vec![
                            date_part,
                            titel,
                            b.kategorie.as_deref().unwrap_or("-").to_string(),
                            b.sitzung
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| "-".into()),
                            b.behandlungsnummer.as_deref().unwrap_or("-").to_string(),
                            b.behandlung_status.as_deref().unwrap_or("-").to_string(),
                            kosten,
                            b.notizen.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(AktePdfBlock {
            title: "Behandlungen".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.rezepte && medical {
        let rows_db = rezept_repo::find_for_patient(pool, &patient_id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Ausgestellt".into(),
                    "Medikament".into(),
                    "Dosierung".into(),
                    "Dauer".into(),
                    "Status".into(),
                    "Wirkstoff".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Ausgestellt".into(),
                    "Medikament".into(),
                    "Dosierung".into(),
                    "Dauer".into(),
                    "Status".into(),
                    "Wirkstoff".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|r| {
                        vec![
                            r.ausgestellt_am.to_string(),
                            r.medikament.clone(),
                            r.dosierung.clone(),
                            r.dauer.clone(),
                            r.status.clone(),
                            r.wirkstoff.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(AktePdfBlock {
            title: "Rezepte".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.attest && medical {
        let rows_db = attest_repo::find_for_patient(pool, &patient_id).await?;
        if rows_db.is_empty() {
            blocks.push(AktePdfBlock::body(
                "Atteste",
                vec!["(keine Atteste)".into()],
            ));
        } else {
            let attest_rows: Vec<Vec<String>> = rows_db
                .iter()
                .map(|a| {
                    vec![
                        a.typ.clone(),
                        a.gueltig_von.to_string(),
                        a.gueltig_bis.to_string(),
                        a.ausgestellt_am.to_string(),
                    ]
                })
                .collect();
            blocks.push(AktePdfBlock {
                title: "Atteste (Uebersicht)".into(),
                body_lines: vec![],
                kv_pairs: vec![],
                table: Some(AktePdfTable {
                    headers: vec![
                        "Typ".into(),
                        "Gueltig von".into(),
                        "Gueltig bis".into(),
                        "Ausgestellt".into(),
                    ],
                    rows: attest_rows,
                    ..Default::default()
                }),
            });
            for a in rows_db {
                let mut lines: Vec<String> = Vec::new();
                if a.inhalt.trim().is_empty() {
                    lines.push("(kein Freitext)".into());
                } else {
                    for ln in a.inhalt.lines() {
                        lines.push(if ln.is_empty() {
                            " ".into()
                        } else {
                            ln.to_string()
                        });
                    }
                }
                blocks.push(AktePdfBlock::body(format!("Attest — {}", a.typ), lines));
            }
        }
    }

    if sec.zahlungen && finanzen {
        let rows_db = zahlung_repo::find_by_patient_id(pool, &patient_id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Zeit".into(),
                    "EUR".into(),
                    "Art".into(),
                    "Status".into(),
                    "Beschreibung".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Zeit".into(),
                    "EUR".into(),
                    "Art".into(),
                    "Status".into(),
                    "Beschreibung".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|z| {
                        vec![
                            z.created_at.format("%Y-%m-%d %H:%M").to_string(),
                            format!("{:.2}", z.betrag),
                            format!("{}", z.zahlungsart),
                            format!("{}", z.status),
                            z.beschreibung.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
                ..Default::default()
            }
        };
        blocks.push(AktePdfBlock {
            title: "Zahlungen / Buchungen".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.anlagen {
        let rows_db = akte_anlage_repo::list_for_akte(pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Dateiname".into(),
                    "MIME".into(),
                    "Datum".into(),
                    "Bytes".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Dateiname".into(),
                    "MIME".into(),
                    "Datum".into(),
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
        blocks.push(AktePdfBlock {
            title: "Akten-Anlagen (Metadaten)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    if sec.audit && audit_ok {
        let rows_db = audit_repo::find_for_patient_entity(pool, &patient_id, 500).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Zeit".into(),
                    "Aktion".into(),
                    "Entity".into(),
                    "ID".into(),
                    "Details".into(),
                ],
                rows: vec![],
                ..Default::default()
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Zeit".into(),
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
        blocks.push(AktePdfBlock {
            title: "Audit-Auszug (Auszug)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    let dokument_id = uuid::Uuid::new_v4().to_string();
    let erstellt_von = format!("{} ({})", session.name, session.rolle);
    let header = akte_header_from_app_kv(pool, &erstellt_von, &dokument_id).await;

    blocks.push(AktePdfBlock::body(
        "Hinweise",
        vec![
            format!("Erstellt von: {erstellt_von}"),
            format!("Dokument-ID: {dokument_id}"),
            "Dieses Dokument enthält vertrauliche Patientendaten (§ 630f BGB).".into(),
            "Weitergabe nur mit ausdrücklicher Einwilligung des Patienten.".into(),
        ],
    ));

    let bytes = render_akte_blocks(
        "Patientenakte - Export",
        &generated,
        &format!("Patientenakte {}", patient.name),
        &blocks,
        header.as_ref(),
    )?;

    audit_repo::create(
        pool,
        &session.user_id,
        "EXPORT_PDF",
        "Patientenakte",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

/// FA-DOK-08: Entlassungs-Merkblatt / Nachsorge als PDF.
pub async fn export_discharge_merkblatt_pdf(
    pool: &SqlitePool,
    session: &Session,
    args: ExportDischargeMerkblattPdfArgs,
) -> Result<String, AppError> {
    use base64::Engine;

    let patient_id = args.patient_id.clone();
    let patient = patient_repo::find_by_id(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let akte = akte_repo::find_akte_by_patient(pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;

    let generated = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let mut blocks: Vec<AktePdfBlock> = Vec::new();

    let praxis_kv = praxis_kv_pairs_from_app_kv(pool).await;
    if !praxis_kv.is_empty() {
        blocks.insert(
            0,
            AktePdfBlock {
                title: "Praxis".into(),
                body_lines: vec![],
                kv_pairs: praxis_kv,
                table: None,
            },
        );
    }

    let mut stamm_kv = vec![
        ("Name".into(), patient.name.clone()),
        ("Geburtsdatum".into(), patient.geburtsdatum.to_string()),
    ];
    if let Some(t) = &patient.telefon {
        stamm_kv.push(("Telefon".into(), t.clone()));
    }
    if let Some(e) = &patient.email {
        stamm_kv.push(("E-Mail".into(), e.clone()));
    }
    blocks.push(AktePdfBlock {
        title: "Patient — Stammdaten".into(),
        body_lines: vec![],
        kv_pairs: stamm_kv,
        table: None,
    });

    let mut bh_list = akte_repo::list_behandlungen(pool, &akte.id).await?;
    bh_list.sort_by(|a, b| {
        let da = a.behandlung_datum.as_deref().unwrap_or("0000-01-01");
        let db = b.behandlung_datum.as_deref().unwrap_or("0000-01-01");
        db.cmp(da).then_with(|| b.created_at.cmp(&a.created_at))
    });
    let latest_bh = bh_list.into_iter().next();

    if let Some(b) = latest_bh {
        let mut lines: Vec<String> = Vec::new();
        lines.push(format!(
            "Datum: {}",
            b.behandlung_datum
                .clone()
                .unwrap_or_else(|| "(ohne Datum)".into())
        ));
        lines.push(format!("Art: {}", b.art));
        if let Some(k) = &b.kategorie {
            if !k.trim().is_empty() {
                lines.push(format!("Kategorie: {}", k));
            }
        }
        if let Some(desc) = &b.beschreibung {
            if !desc.trim().is_empty() {
                lines.push("Beschreibung:".into());
                for ln in desc.lines() {
                    lines.push(if ln.is_empty() {
                        " ".into()
                    } else {
                        ln.to_string()
                    });
                }
            }
        }
        if let Some(n) = &b.notizen {
            if !n.trim().is_empty() {
                lines.push("Notizen:".into());
                for ln in n.lines() {
                    lines.push(if ln.is_empty() {
                        " ".into()
                    } else {
                        ln.to_string()
                    });
                }
            }
        }
        blocks.push(AktePdfBlock::body("Letzte dokumentierte Behandlung", lines));
    } else {
        blocks.push(AktePdfBlock::body(
            "Letzte dokumentierte Behandlung",
            vec!["(keine Behandlungseinträge)".into()],
        ));
    }

    let rezepte = rezept_repo::find_for_patient(pool, &patient_id).await?;
    let rz_take: Vec<_> = rezepte.into_iter().take(12).collect();
    if rz_take.is_empty() {
        blocks.push(AktePdfBlock::body(
            "Medikation (Rezepte)",
            vec!["(keine Rezepte erfasst)".into()],
        ));
    } else {
        let tbl = AktePdfTable {
            headers: vec![
                "Ausgestellt".into(),
                "Medikament".into(),
                "Dosierung".into(),
                "Dauer".into(),
                "Hinweise".into(),
            ],
            rows: rz_take
                .iter()
                .map(|r| {
                    vec![
                        r.ausgestellt_am.to_string(),
                        r.medikament.clone(),
                        r.dosierung.clone(),
                        r.dauer.clone(),
                        r.hinweise.as_deref().unwrap_or("-").to_string(),
                    ]
                })
                .collect(),
            ..Default::default()
        };
        blocks.push(AktePdfBlock {
            title: "Medikation (Rezepte, Auszug)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    match termin_repo::find_next_for_patient(pool, &patient_id).await? {
        Some(t) => {
            blocks.push(AktePdfBlock::body(
                "Nächster Termin",
                vec![
                    format!("Datum: {} {}", t.datum, t.uhrzeit),
                    format!("Art: {}", t.art),
                    format!("Status: {}", t.status),
                    t.notizen
                        .filter(|s| !s.trim().is_empty())
                        .map(|s| format!("Notizen: {}", s))
                        .unwrap_or_else(|| "(keine Terminnotizen)".into()),
                ],
            ));
        }
        None => {
            blocks.push(AktePdfBlock::body(
                "Nächster Termin",
                vec!["(kein zukünftiger Termin gebucht)".into()],
            ));
        }
    }

    if let Some(txt) = args
        .ueberweisung_hinweise
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
        blocks.push(AktePdfBlock::body(
            "Überweisung / weiterführende Versorgung",
            lines,
        ));
    }

    if let Some(txt) = args
        .zusatz_hinweise
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
        blocks.push(AktePdfBlock::body(
            "Zusätzliche Hinweise / Nachsorge",
            lines,
        ));
    }

    if let Ok(Some(raw)) = app_kv_repo::get(pool, "invoice.praxis.v1").await {
        if let Ok(j) = serde_json::from_str::<serde_json::Value>(&raw) {
            let bh = j
                .get("behandler_name")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            let beruf = j
                .get("berufsbezeichnung")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim();
            if !bh.is_empty() {
                let mut sig = vec![
                    String::new(),
                    "____________________________".into(),
                    bh.to_string(),
                ];
                if !beruf.is_empty() {
                    sig.push(beruf.to_string());
                }
                let zanr = j.get("zanr").and_then(|v| v.as_str()).unwrap_or("").trim();
                let bsnr = j.get("bsnr").and_then(|v| v.as_str()).unwrap_or("").trim();
                if !zanr.is_empty() || !bsnr.is_empty() {
                    sig.push(format!("ZANR: {zanr} · BSNR: {bsnr}"));
                }
                sig.push("(Stempel)".into());
                blocks.push(AktePdfBlock::body("Behandler / Unterschrift", sig));
            }
        }
    }

    let dokument_id = uuid::Uuid::new_v4().to_string();
    let erstellt_von = format!("{} ({})", session.name, session.rolle);
    let header = akte_header_from_app_kv(pool, &erstellt_von, &dokument_id).await;

    blocks.push(AktePdfBlock::body(
        "Hinweis",
        vec![
            format!("Erstellt von: {erstellt_von}"),
            format!("Dokument-ID: {dokument_id}"),
            "Dieses Merkblatt fasst Daten aus der Praxissoftware zusammen und ersetzt keine ärztliche Beratung.".into(),
            "Bitte bringen Sie dieses Blatt zu Folgeterminen mit, wenn es Ihnen ausgehändigt wurde.".into(),
        ],
    ));

    let bytes = render_akte_blocks(
        "Entlassungs-Merkblatt / Nachsorge",
        &generated,
        &format!("Entlassungs-Merkblatt — {}", patient.name),
        &blocks,
        header.as_ref(),
    )?;

    audit_repo::create(
        pool,
        &session.user_id,
        "EXPORT_PDF",
        "EntlassungsMerkblatt",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[cfg(test)]
mod export_akte_pdf_args_tests {
    use super::{ExportAktePdfArgs, ExportDischargeMerkblattPdfArgs};

    #[test]
    fn deserializes_patient_id_camel_case() {
        let j = serde_json::json!({ "patientId": "p1" });
        let a: ExportAktePdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert!(a.sections.patient);
    }

    #[test]
    fn deserializes_patient_id_snake_case() {
        let j = serde_json::json!({ "patient_id": "p2" });
        let a: ExportAktePdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p2");
    }

    #[test]
    fn deserializes_sections_partial() {
        let j = serde_json::json!({
            "patientId": "p3",
            "sections": { "patient": true, "zahlungen": false }
        });
        let a: ExportAktePdfArgs = serde_json::from_value(j).unwrap();
        assert!(a.sections.patient);
        assert!(!a.sections.zahlungen);
        assert!(a.sections.akte_core);
    }

    #[test]
    fn discharge_args_deserializes_camel_case() {
        let j = serde_json::json!({
            "patientId": "p1",
            "zusatzHinweise": "Nachsorge",
            "ueberweisungHinweise": "KHK"
        });
        let a: ExportDischargeMerkblattPdfArgs = serde_json::from_value(j).unwrap();
        assert_eq!(a.patient_id, "p1");
        assert_eq!(a.zusatz_hinweise.as_deref(), Some("Nachsorge"));
        assert_eq!(a.ueberweisung_hinweise.as_deref(), Some("KHK"));
    }
}
