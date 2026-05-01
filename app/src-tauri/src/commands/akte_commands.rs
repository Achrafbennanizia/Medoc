use crate::application::rbac::{self, Role};
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::anamnesebogen::SaveAnamnesebogen;
use crate::domain::entities::behandlung::{
    Behandlung, CreateBehandlung, CreateUntersuchung, Untersuchung, UpdateBehandlung,
    UpdateUntersuchung,
};
use crate::domain::entities::zahnbefund::CreateZahnbefund;
use crate::domain::entities::{Anamnesebogen, Patientenakte, Rezept, Zahnbefund, Zahlung};
use crate::error::AppError;
use crate::infrastructure::database::{
    akte_anlage_repo, akte_repo, attest_repo, audit_repo, patient_repo, rezept_repo, zahlung_repo,
};
use crate::infrastructure::pdf::{render_akte_blocks, AktePdfBlock};
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
        let mut lines = vec![
            format!("Name: {}", patient.name),
            format!("Geburtsdatum: {}", patient.geburtsdatum),
            format!("Geschlecht: {}", patient.geschlecht),
            format!("Versicherungsnummer: {}", patient.versicherungsnummer),
            format!("Patienten-Status: {}", patient.status),
        ];
        if let Some(t) = &patient.telefon {
            lines.push(format!("Telefon: {}", t));
        }
        if let Some(e) = &patient.email {
            lines.push(format!("E-Mail: {}", e));
        }
        if let Some(a) = &patient.adresse {
            lines.push(format!("Adresse: {}", a));
        }
        blocks.push(AktePdfBlock {
            title: "Stammdaten".into(),
            body_lines: lines,
        });
    }

    if sec.akte_core {
        let mut lines = vec![
            format!("Akten-ID: {}", akte_display.id),
            format!("Akten-Status: {}", akte_display.status),
        ];
        if medical {
            lines.push(format!(
                "Diagnose: {}",
                akte_display.diagnose.as_deref().unwrap_or("(keine Eintragung)")
            ));
            lines.push(format!(
                "Befunde: {}",
                akte_display.befunde.as_deref().unwrap_or("(keine Eintragung)")
            ));
        } else {
            lines.push("Hinweis: Diagnose/Befunde für diese Rolle nicht enthalten.".into());
        }
        blocks.push(AktePdfBlock {
            title: "Patientenakte (Kern)".into(),
            body_lines: lines,
        });
    }

    if sec.zahnbefunde && medical {
        let rows = akte_repo::find_zahnbefunde(&pool, &akte.id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Zahnbefunde erfasst)".into()]
        } else {
            rows.into_iter()
                .map(|z| {
                    format!(
                        "Zahn {}: {} | Diagnose: {} | Notizen: {}",
                        z.zahn_nummer,
                        z.befund,
                        z.diagnose.as_deref().unwrap_or("—"),
                        z.notizen.as_deref().unwrap_or("—"),
                    )
                })
                .collect()
        };
        blocks.push(AktePdfBlock {
            title: "Zahnbefunde".into(),
            body_lines: body,
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
            });
        } else {
            blocks.push(AktePdfBlock {
                title: "Anamnese / Fragebogen".into(),
                body_lines: vec!["(kein Anamnesebogen erfasst)".into()],
            });
        }
    }

    if sec.untersuchungen && medical {
        let rows = akte_repo::list_untersuchungen(&pool, &akte.id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Untersuchungen)".into()]
        } else {
            rows.into_iter()
                .map(|u| {
                    format!(
                        "{} | Nr. {} | Beschwerden: {} | Ergebnisse: {} | Diagnose: {}",
                        u.created_at.format("%Y-%m-%d"),
                        u.untersuchungsnummer.as_deref().unwrap_or("—"),
                        u.beschwerden.as_deref().unwrap_or("—"),
                        u.ergebnisse.as_deref().unwrap_or("—"),
                        u.diagnose.as_deref().unwrap_or("—"),
                    )
                })
                .collect()
        };
        blocks.push(AktePdfBlock {
            title: "Untersuchungen".into(),
            body_lines: body,
        });
    }

    if sec.behandlungen && medical {
        let rows = akte_repo::list_behandlungen(&pool, &akte.id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Behandlungen)".into()]
        } else {
            rows.into_iter()
                .map(summarize_behandlung_pdf_line)
                .collect()
        };
        blocks.push(AktePdfBlock {
            title: "Behandlungen".into(),
            body_lines: body,
        });
    }

    if sec.rezepte && medical {
        let rows = rezept_repo::find_for_patient(&pool, &patient_id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Rezepte)".into()]
        } else {
            rows.into_iter().map(summarize_rezept_line).collect()
        };
        blocks.push(AktePdfBlock {
            title: "Rezepte".into(),
            body_lines: body,
        });
    }

    if sec.attest && medical {
        let rows = attest_repo::find_for_patient(&pool, &patient_id).await?;
        if rows.is_empty() {
            blocks.push(AktePdfBlock {
                title: "Atteste".into(),
                body_lines: vec!["(keine Atteste)".into()],
            });
        } else {
            let mut body: Vec<String> = Vec::new();
            for a in rows {
                body.push(format!(
                    "——— {} | ausgestellt {} | gültig {} bis {} ———",
                    a.typ, a.ausgestellt_am, a.gueltig_von, a.gueltig_bis
                ));
                for ln in a.inhalt.lines() {
                    body.push(if ln.is_empty() {
                        String::new()
                    } else {
                        format!("  {ln}")
                    });
                }
                body.push(String::new());
            }
            blocks.push(AktePdfBlock {
                title: "Atteste".into(),
                body_lines: body,
            });
        }
    }

    if sec.zahlungen && finanzen {
        let rows = zahlung_repo::find_by_patient_id(&pool, &patient_id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Zahlungsbuchungen)".into()]
        } else {
            rows.into_iter().map(summarize_zahlung_line).collect()
        };
        blocks.push(AktePdfBlock {
            title: "Zahlungen / Buchungen".into(),
            body_lines: body,
        });
    }

    if sec.anlagen {
        let rows = akte_anlage_repo::list_for_akte(&pool, &akte.id).await?;
        let body = if rows.is_empty() {
            vec!["(keine Dateianlagen — Metadaten; Dateiinhalte nicht eingebettet)".into()]
        } else {
            rows.into_iter()
                .map(|r| {
                    format!(
                        "{} | {} | {} | {} Bytes",
                        r.display_name, r.mime_type, r.created_at, r.size_bytes
                    )
                })
                .collect()
        };
        blocks.push(AktePdfBlock {
            title: "Akten-Anlagen (Metadaten)".into(),
            body_lines: body,
        });
    }

    let bytes = render_akte_blocks(
        "Patientenakte — Export",
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

fn summarize_behandlung_pdf_line(b: Behandlung) -> String {
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
        .unwrap_or(b.art.as_str());
    let mut s = format!(
        "{} | {} | Kategorie: {} | Nr. {} | Sitzung {:?}",
        date_part,
        titel,
        b.kategorie.as_deref().unwrap_or("—"),
        b.behandlungsnummer.as_deref().unwrap_or("—"),
        b.sitzung
    );
    if let Some(k) = b.gesamtkosten {
        s.push_str(&format!(" | Kosten: {:.2} EUR", k));
    }
    if let Some(n) = b.notizen.as_deref() {
        if !n.is_empty() {
            s.push_str(" | ");
            s.push_str(n);
        }
    }
    s
}

fn summarize_rezept_line(r: Rezept) -> String {
    format!(
        "{} | {} | {} | Dauer {} | Status {} | Wirkstoff: {}",
        r.ausgestellt_am,
        r.medikament,
        r.dosierung,
        r.dauer,
        r.status,
        r.wirkstoff.as_deref().unwrap_or("—"),
    )
}

fn summarize_zahlung_line(z: Zahlung) -> String {
    format!(
        "{} | {:.2} EUR | {} | {} | {}",
        z.created_at.format("%Y-%m-%d %H:%M"),
        z.betrag,
        z.zahlungsart,
        z.status,
        z.beschreibung.as_deref().unwrap_or("—"),
    )
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
