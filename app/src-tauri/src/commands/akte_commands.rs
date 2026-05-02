use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung, UpdateBehandlung,
    UpdateUntersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Zahnbefund};
use crate::error::AppError;
use crate::infrastructure::database::{
    akte_anlage_repo, akte_repo, attest_repo, audit_repo, patient_repo, rezept_repo, zahlung_repo,
};
use crate::infrastructure::pdf::{render_akte_blocks, AktePdfBlock, AktePdfTable};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

fn default_true() -> bool {
    true
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

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_akte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Patientenakte, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let mut a = akte_repo::find_akte_by_patient(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Unauthorized)?;
    if !rbac::allowed("patient.read_medical", role) {
        // Rezeption sees administrative shell only — no diagnoses / clinical text.
        a.diagnose = None;
        a.befunde = None;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Patientenakte",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_zahnbefund(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateZahnbefund,
) -> Result<Zahnbefund, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let z = akte_repo::upsert_zahnbefund(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "Zahnbefund",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_zahnbefunde(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Zahnbefund>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let rows = akte_repo::find_zahnbefunde(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Zahnbefund",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_behandlungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Behandlung>, AppError> {
    let session = rbac::require(
        &session_state,
        "patient.behandlungen_list_for_zahlung",
    )?;
    let rows = akte_repo::list_behandlungen(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Behandlung",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_untersuchungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    akte_id: String,
) -> Result<Vec<Untersuchung>, AppError> {
    let session = rbac::require(
        &session_state,
        "patient.behandlungen_list_for_zahlung",
    )?;
    let rows = akte_repo::list_untersuchungen(&pool, &akte_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Untersuchung",
        Some(&akte_id),
        Some(&format!("count={}", rows.len())),
    )
    .await
    .ok();
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn save_anamnesebogen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: SaveAnamnesebogen,
) -> Result<Anamnesebogen, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let a = akte_repo::save_anamnesebogen(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPSERT",
        "Anamnesebogen",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_anamnesebogen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<Anamnesebogen>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let bogen = akte_repo::find_anamnesebogen(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Anamnesebogen",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(bogen)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let u = akte_repo::create_untersuchung(&pool, &data).await?;
    if let Err(e) = zahlung_repo::ensure_placeholder_for_untersuchung(&pool, &u.id).await {
        tracing::warn!(
            error = ?e,
            untersuchung_id = %u.id,
            "open-payment placeholder (Untersuchung) skipped",
        );
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Untersuchung",
        Some(&u.id),
        None,
    )
    .await
    .ok();
    Ok(u)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBehandlung,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let b = akte_repo::create_behandlung(&pool, &data).await?;
    if let Err(e) = zahlung_repo::ensure_placeholder_for_behandlung(&pool, &b.id).await {
        tracing::warn!(
            error = ?e,
            behandlung_id = %b.id,
            "open-payment placeholder (Behandlung) skipped",
        );
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Behandlung",
        Some(&b.id),
        None,
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateBehandlung,
) -> Result<Behandlung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let b = akte_repo::update_behandlung(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Behandlung",
        Some(&b.id),
        None,
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_behandlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    akte_repo::delete_behandlung(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Behandlung", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateUntersuchung,
) -> Result<Untersuchung, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let u = akte_repo::update_untersuchung(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Untersuchung",
        Some(&u.id),
        None,
    )
    .await
    .ok();
    Ok(u)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_untersuchung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    akte_repo::delete_untersuchung(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Untersuchung", Some(&id), None)
        .await
        .ok();
    Ok(())
}

/// FA-AKTE-04 / Erweiterung: Patientenakte als PDF (Abschnitte wählbar).
/// Returns base64-encoded PDF bytes for safe transport across the Tauri bridge.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn export_akte_pdf(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    args: ExportAktePdfArgs,
) -> Result<String, AppError> {
    use base64::Engine;

    let session = rbac::require(&session_state, "patient.read")?;
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

    let patient = patient_repo::find_by_id(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    let akte = akte_repo::find_akte_by_patient(&pool, &patient_id)
        .await?
        .ok_or(AppError::NotFound("Patientenakte".into()))?;

    let mut akte_display = akte.clone();
    if !medical {
        akte_display.diagnose = None;
        akte_display.befunde = None;
    }

    let generated = chrono::Utc::now().format("%Y-%m-%d %H:%M UTC").to_string();
    let mut blocks: Vec<AktePdfBlock> = Vec::new();

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
                    .clone()
                    .unwrap_or_else(|| "(keine Eintragung)".into()),
            ));
            kv.push((
                "Befunde".into(),
                akte_display
                    .befunde
                    .clone()
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
        let rows_db = akte_repo::find_zahnbefunde(&pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Zahn".into(),
                    "Befund".into(),
                    "Diagnose".into(),
                    "Notizen".into(),
                ],
                rows: vec![],
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
        if let Some(am) = akte_repo::find_anamnesebogen(&pool, &patient_id).await? {
            let mut lines = vec![format!("Unterschrieben: {}", am.unterschrieben)];
            for chunk in am.antworten.lines() {
                lines.push(chunk.to_string());
            }
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
        let rows_db = akte_repo::list_untersuchungen(&pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Nr.".into(),
                    "Beschwerden".into(),
                    "Ergebnisse".into(),
                    "Diagnose".into(),
                ],
                rows: vec![],
            }
        } else {
            AktePdfTable {
                headers: vec![
                    "Datum".into(),
                    "Nr.".into(),
                    "Beschwerden".into(),
                    "Ergebnisse".into(),
                    "Diagnose".into(),
                ],
                rows: rows_db
                    .into_iter()
                    .map(|u| {
                        vec![
                            u.created_at.format("%Y-%m-%d").to_string(),
                            u.untersuchungsnummer.as_deref().unwrap_or("-").to_string(),
                            u.beschwerden.as_deref().unwrap_or("-").to_string(),
                            u.ergebnisse.as_deref().unwrap_or("-").to_string(),
                            u.diagnose.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
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
        let rows_db = akte_repo::list_behandlungen(&pool, &akte.id).await?;
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
                            b.sitzung.map(|s| s.to_string()).unwrap_or_else(|| "-".into()),
                            b.behandlungsnummer.as_deref().unwrap_or("-").to_string(),
                            b.behandlung_status.as_deref().unwrap_or("-").to_string(),
                            kosten,
                            b.notizen.as_deref().unwrap_or("-").to_string(),
                        ]
                    })
                    .collect(),
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
        let rows_db = rezept_repo::find_for_patient(&pool, &patient_id).await?;
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
        let rows_db = attest_repo::find_for_patient(&pool, &patient_id).await?;
        if rows_db.is_empty() {
            blocks.push(AktePdfBlock::body("Atteste", vec!["(keine Atteste)".into()]));
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
                blocks.push(AktePdfBlock::body(
                    format!("Attest — {}", a.typ),
                    lines,
                ));
            }
        }
    }

    if sec.zahlungen && finanzen {
        let rows_db = zahlung_repo::find_by_patient_id(&pool, &patient_id).await?;
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
        let rows_db = akte_anlage_repo::list_for_akte(&pool, &akte.id).await?;
        let tbl = if rows_db.is_empty() {
            AktePdfTable {
                headers: vec![
                    "Dateiname".into(),
                    "MIME".into(),
                    "Datum".into(),
                    "Bytes".into(),
                ],
                rows: vec![],
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
        let rows_db = audit_repo::find_for_patient_entity(&pool, &patient_id, 500).await?;
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
            }
        };
        blocks.push(AktePdfBlock {
            title: "Audit-Auszug (Auszug)".into(),
            body_lines: vec![],
            kv_pairs: vec![],
            table: Some(tbl),
        });
    }

    let bytes = render_akte_blocks(
        "Patientenakte - Export",
        &generated,
        &format!("Patientenakte {}", patient.name),
        &blocks,
    )?;

    audit_repo::create(
        &pool,
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

#[cfg(test)]
mod export_akte_pdf_args_tests {
    use super::ExportAktePdfArgs;

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
}
