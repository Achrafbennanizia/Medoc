use crate::domain::entities::zahlung::{Bilanz, CreateZahlung, UpdateZahlung};
use crate::domain::entities::Zahlung;
use crate::domain::enums::ZahlungsArt;
use crate::domain::services::pricing;
use crate::error::AppError;
use crate::infrastructure::database::akte_repo;
use sqlx::SqlitePool;

/// Erlaubte Abweichung bei Soll/Offen-Prüfung (EUR) — Frontend `ZAHL_EUR_EPS` entspricht diesem Wert.
const OPEN_BOOKING_TOLERANCE_EUR: f64 = 0.005;

/// Cent-Rundung wie Frontend `roundMoney2` (`zahlung-buchung.ts`).
#[inline]
fn round_money2(n: f64) -> f64 {
    if !n.is_finite() {
        return n;
    }
    (n * 100.0).round() / 100.0
}

fn compute_payment_status(betrag: f64, erwartet: Option<f64>) -> &'static str {
    const EPS: f64 = 1e-6;
    // Positive erwartete Rest-/Sollsumme (> 0); Werte ≤ 0 werden ignoriert.
    let exp_positive = erwartet.filter(|e| e.is_finite() && *e > EPS);

    if betrag <= EPS {
        // Offene Platzhalterbuchung oder noch kein Zahlbetrag verbucht.
        match exp_positive {
            Some(_) => return "AUSSTEHEND",
            None => {
                if matches!(erwartet, Some(e) if e.is_finite() && (-EPS..=EPS).contains(&e)) {
                    return "BEZAHLT";
                }
                return "AUSSTEHEND";
            }
        }
    }
    match exp_positive {
        Some(exp) => {
            if betrag + EPS >= exp {
                "BEZAHLT"
            } else {
                "TEILBEZAHLT"
            }
        }
        None => "BEZAHLT",
    }
}

async fn refresh_payment_status(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(Option<f64>, f64)> =
        sqlx::query_as("SELECT betrag_erwartet, betrag FROM zahlung WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let Some((erw, b)) = row else {
        return Ok(());
    };
    let st = compute_payment_status(b, erw);
    sqlx::query("UPDATE zahlung SET status = ?1 WHERE id = ?2")
        .bind(st)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Zahlung>, AppError> {
    let rows = sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung ORDER BY created_at DESC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_patient_id(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Zahlung>, AppError> {
    let rows = sqlx::query_as::<_, Zahlung>(
        "SELECT * FROM zahlung WHERE patient_id = ?1 ORDER BY created_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Patientenliste: Kennzeichnung „Rechnung offen“ ohne alle Buchungen zu laden.
pub async fn patient_ids_open_invoice(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT patient_id FROM zahlung
         WHERE TRIM(UPPER(COALESCE(status, ''))) IN ('AUSSTEHEND', 'TEILBEZAHLT')
         ORDER BY patient_id",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn create(pool: &SqlitePool, data: &CreateZahlung) -> Result<Zahlung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let zahlungsart = serde_json::to_string(&data.zahlungsart)
        .map_err(|e| AppError::Internal(format!("Zahlungsart serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    if data.behandlung_id.is_some() && data.untersuchung_id.is_some() {
        return Err(AppError::validation_code("error.zahlung.dual_link"));
    }

    let mut betrag_erwartet = data.betrag_erwartet;
    if let Some(ref bid) = data.behandlung_id {
        let row: Option<(Option<f64>, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT b.gesamtkosten, b.freigegeben_von_arzt_id, b.freigegeben_am FROM behandlung b
             JOIN patientenakte a ON b.akte_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = row else {
            return Err(AppError::validation_code("error.zahlung.behandlung_not_found"));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.behandlung",
        )?;
    }
    if let Some(ref uid) = data.untersuchung_id {
        let ok: Option<(String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT u.id, u.freigegeben_von_arzt_id, u.freigegeben_am FROM untersuchung u
             JOIN patientenakte a ON u.akte_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        let Some((_, vid, vam)) = ok else {
            return Err(AppError::validation_code("error.zahlung.untersuchung_not_found"));
        };
        crate::domain::services::pricing::require_released_for_billing(
            vid.as_deref(),
            vam.as_deref(),
            "error.entity.untersuchung",
        )?;
    }

    const EPS: f64 = 1e-6;
    let is_placeholder = data.betrag <= EPS;
    if data.betrag < -EPS {
        return Err(AppError::validation_code("error.zahlung.amount_invalid"));
    }
    if is_placeholder && data.leistung_id.is_some() {
        return Err(AppError::validation_code("error.zahlung.leistung_positive_required"));
    }

    // Wenn positiver Betrag: optional Preis aus `leistung` übernehmen.
    let betrag = if is_placeholder {
        0.0
    } else if data.betrag <= EPS {
        return Err(AppError::validation_code("error.zahlung.amount_must_be_positive"));
    } else if let Some(ref lid) = data.leistung_id {
        let row: Option<(f64,)> = sqlx::query_as("SELECT preis FROM leistung WHERE id = ?1")
            .bind(lid)
            .fetch_optional(pool)
            .await?;
        row.map(|r| r.0).unwrap_or(data.betrag)
    } else {
        data.betrag
    };

    if let Some(ref bid) = data.behandlung_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.gesamtkosten FROM behandlung b
             JOIN patientenakte a ON b.akte_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(betrag), 0) FROM zahlung
                     WHERE behandlung_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
                )
                .bind(bid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                // Parität zum UI: `Math.max(0, roundMoney2(gesamt - paidSoFar))`
                let open = round_money2(g - sum_paid).max(0.0);
                if betrag > open + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.zahlung.overpayment_behandlung",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                betrag_erwartet = Some(open);
            }
        }
    }

    if let Some(ref uid) = data.untersuchung_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.gesamtkosten FROM untersuchung u
             JOIN patientenakte a ON u.akte_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_paid: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(betrag), 0) FROM zahlung
                     WHERE untersuchung_id = ?1 AND patient_id = ?2
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
                )
                .bind(uid)
                .bind(&data.patient_id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let open = round_money2(g - sum_paid).max(0.0);
                if betrag > open + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.zahlung.overpayment_untersuchung",
                        &[
                            ("max", &format!("{open:.2}")),
                            ("paid", &format!("{sum_paid:.2}")),
                            ("target", &format!("{g:.2}")),
                        ],
                    ));
                }
                betrag_erwartet = Some(open);
            }
        }
    }

    let status = compute_payment_status(betrag, betrag_erwartet);

    sqlx::query(
        "INSERT INTO zahlung (id, patient_id, betrag, zahlungsart, status, leistung_id, beschreibung, behandlung_id, untersuchung_id, betrag_erwartet, kasse_geprueft)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(betrag)
    .bind(&zahlungsart)
    .bind(status)
    .bind(&data.leistung_id)
    .bind(&data.beschreibung)
    .bind(&data.behandlung_id)
    .bind(&data.untersuchung_id)
    .bind(betrag_erwartet)
    .execute(pool)
    .await?;

    let inserted = sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "zahlung", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

/// FA-LEIST-06: implizite Freigabe + offene Buchung (`AUSSTEHEND`, 0 €) für abrechnungsrelevante Behandlung.
pub async fn ensure_open_booking_for_billable_behandlung(
    pool: &SqlitePool,
    behandlung_id: &str,
    arzt_personal_id: &str,
) -> Result<(), AppError> {
    let b = akte_repo::find_behandlung_by_id(pool, behandlung_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Behandlung".into()))?;
    if !pricing::behandlung_has_billable_leistung(b.leistungsname.as_deref(), b.gesamtkosten) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        b.freigegeben_von_arzt_id.as_deref(),
        b.freigegeben_am.as_deref(),
    ) {
        akte_repo::release_behandlung_for_billing(pool, behandlung_id, arzt_personal_id).await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM behandlung b
         INNER JOIN patientenakte a ON b.akte_id = a.id
         WHERE b.id = ?1",
    )
    .bind(behandlung_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM zahlung
         WHERE patient_id = ?1 AND behandlung_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
    )
    .bind(&patient_id)
    .bind(behandlung_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let betrag_erwartet = b
        .gesamtkosten
        .filter(|g| g.is_finite() && *g > OPEN_BOOKING_TOLERANCE_EUR);
    create(
        pool,
        &CreateZahlung {
            patient_id,
            betrag: 0.0,
            zahlungsart: ZahlungsArt::Rechnung,
            leistung_id: None,
            beschreibung: Some(
                "Automatisch nach Leistungseingabe: offene Abrechnung (FA-LEIST-06).".into(),
            ),
            behandlung_id: Some(behandlung_id.to_string()),
            untersuchung_id: None,
            betrag_erwartet,
        },
    )
    .await?;
    Ok(())
}

/// FA-LEIST-06/07: implizite Freigabe + offene Buchung für abrechnungsrelevante Untersuchung.
pub async fn ensure_open_booking_for_billable_untersuchung(
    pool: &SqlitePool,
    untersuchung_id: &str,
    arzt_personal_id: &str,
) -> Result<(), AppError> {
    let u = akte_repo::find_untersuchung_by_id(pool, untersuchung_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Untersuchung".into()))?;
    if !pricing::behandlung_has_billable_leistung(u.leistungsname.as_deref(), u.gesamtkosten) {
        return Ok(());
    }
    if !pricing::is_released_for_billing(
        u.freigegeben_von_arzt_id.as_deref(),
        u.freigegeben_am.as_deref(),
    ) {
        akte_repo::release_untersuchung_for_billing(pool, untersuchung_id, arzt_personal_id)
            .await?;
    }
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM untersuchung u
         INNER JOIN patientenakte a ON u.akte_id = a.id
         WHERE u.id = ?1",
    )
    .bind(untersuchung_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM zahlung
         WHERE patient_id = ?1 AND untersuchung_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
    )
    .bind(&patient_id)
    .bind(untersuchung_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    let betrag_erwartet = u
        .gesamtkosten
        .filter(|g| g.is_finite() && *g > OPEN_BOOKING_TOLERANCE_EUR);
    create(
        pool,
        &CreateZahlung {
            patient_id,
            betrag: 0.0,
            zahlungsart: ZahlungsArt::Rechnung,
            leistung_id: None,
            beschreibung: Some(
                "Automatisch nach Leistungseingabe: offene Abrechnung (FA-LEIST-06/07).".into(),
            ),
            behandlung_id: None,
            untersuchung_id: Some(untersuchung_id.to_string()),
            betrag_erwartet,
        },
    )
    .await?;
    Ok(())
}

/// Erste offene Buchung (0 €), falls noch keine Zahlungen zu dieser Untersuchung existieren.
pub async fn ensure_placeholder_for_untersuchung(
    pool: &SqlitePool,
    untersuchung_id: &str,
) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as(
        "SELECT a.patient_id FROM untersuchung u
         INNER JOIN patientenakte a ON u.akte_id = a.id
         WHERE u.id = ?1",
    )
    .bind(untersuchung_id)
    .fetch_optional(pool)
    .await?;
    let Some((patient_id,)) = row else {
        return Ok(());
    };
    let n: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM zahlung
         WHERE patient_id = ?1 AND untersuchung_id = ?2
           AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
    )
    .bind(&patient_id)
    .bind(untersuchung_id)
    .fetch_one(pool)
    .await?;
    if n.0 > 0 {
        return Ok(());
    }
    create(
        pool,
        &CreateZahlung {
            patient_id,
            betrag: 0.0,
            zahlungsart: ZahlungsArt::Rechnung,
            leistung_id: None,
            beschreibung: Some(
                "Automatisch beim Anlegen: offene Abrechnung (Untersuchung).".into(),
            ),
            behandlung_id: None,
            untersuchung_id: Some(untersuchung_id.to_string()),
            betrag_erwartet: None,
        },
    )
    .await?;
    Ok(())
}

pub async fn update_fields(pool: &SqlitePool, data: &UpdateZahlung) -> Result<Zahlung, AppError> {
    let row: Option<(String, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT status, behandlung_id, untersuchung_id, patient_id FROM zahlung WHERE id = ?1",
    )
    .bind(&data.id)
    .fetch_optional(pool)
    .await?;
    let Some((st, behandlung_id, untersuchung_id, patient_id)) = row else {
        return Err(AppError::NotFound("Zahlung".into()));
    };
    if st != "AUSSTEHEND" && st != "TEILBEZAHLT" {
        return Err(AppError::validation_code("error.zahlung.edit_locked_status"));
    }
    let zahlungsart = serde_json::to_string(&data.zahlungsart)
        .map_err(|e| AppError::Internal(format!("Zahlungsart serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();
    if data.betrag <= 0.0 {
        return Err(AppError::validation_code("error.zahlung.amount_must_be_positive"));
    }

    if let Some(ref bid) = behandlung_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT b.gesamtkosten FROM behandlung b
             JOIN patientenakte a ON b.akte_id = a.id
             WHERE b.id = ?1 AND a.patient_id = ?2",
        )
        .bind(bid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(betrag), 0) FROM zahlung
                     WHERE behandlung_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
                )
                .bind(bid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = round_money2(g - sum_others).max(0.0);
                if data.betrag > max_for_row + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.zahlung.overpayment_edit_behandlung",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    if let Some(ref uid) = untersuchung_id {
        let row: Option<(Option<f64>,)> = sqlx::query_as(
            "SELECT u.gesamtkosten FROM untersuchung u
             JOIN patientenakte a ON u.akte_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&patient_id)
        .fetch_optional(pool)
        .await?;
        if let Some((g_opt,)) = row {
            if let Some(g) = g_opt.filter(|g| g.is_finite() && *g > 0.0) {
                let sum_others: f64 = sqlx::query_scalar(
                    "SELECT COALESCE(SUM(betrag), 0) FROM zahlung
                     WHERE untersuchung_id = ?1 AND patient_id = ?2 AND id != ?3
                     AND (status IS NULL OR TRIM(UPPER(status)) != 'STORNIERT')",
                )
                .bind(uid)
                .bind(&patient_id)
                .bind(&data.id)
                .fetch_one(pool)
                .await
                .unwrap_or(0.0);
                let max_for_row = round_money2(g - sum_others).max(0.0);
                if data.betrag > max_for_row + OPEN_BOOKING_TOLERANCE_EUR {
                    return Err(AppError::validation_code_params(
                        "error.zahlung.overpayment_edit_untersuchung",
                        &[("max", &format!("{max_for_row:.2}"))],
                    ));
                }
            }
        }
    }

    sqlx::query(
        "UPDATE zahlung SET betrag = ?1, zahlungsart = ?2, leistung_id = ?3, beschreibung = ?4 WHERE id = ?5",
    )
    .bind(data.betrag)
    .bind(&zahlungsart)
    .bind(&data.leistung_id)
    .bind(&data.beschreibung)
    .bind(&data.id)
    .execute(pool)
    .await?;

    refresh_payment_status(pool, &data.id).await?;

    let updated = sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(&data.id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Zahlung".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", data.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "zahlung", &data.id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete_if_pending(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT status FROM zahlung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    let st = row.ok_or(AppError::NotFound("Zahlung".into()))?.0;
    if st != "AUSSTEHEND" && st != "TEILBEZAHLT" {
        return Err(AppError::validation_code("error.zahlung.delete_locked_status"));
    }
    sqlx::query("DELETE FROM zahlung WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "zahlung",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<Zahlung, AppError> {
    sqlx::query("UPDATE zahlung SET status = ?1 WHERE id = ?2")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;

    let updated = sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Zahlung".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "zahlung", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn get_bilanz(pool: &SqlitePool) -> Result<Bilanz, AppError> {
    let einnahmen: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status = 'BEZAHLT'")
            .fetch_one(pool)
            .await?;

    let ausstehend: (f64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status IN ('AUSSTEHEND', 'TEILBEZAHLT')",
    )
    .fetch_one(pool)
    .await?;

    let storniert: (f64,) =
        sqlx::query_as("SELECT COALESCE(SUM(betrag), 0.0) FROM zahlung WHERE status = 'STORNIERT'")
            .fetch_one(pool)
            .await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM zahlung")
        .fetch_one(pool)
        .await?;

    Ok(Bilanz {
        einnahmen: einnahmen.0,
        ausstehend: ausstehend.0,
        storniert: storniert.0,
        anzahl_zahlungen: count.0,
    })
}

/// Tagesabschluss: Kassenprüfung pro Zahlung (0/1).
pub async fn set_kasse_geprueft_for_ids(
    pool: &SqlitePool,
    ids: &[String],
    kasse_geprueft: i64,
) -> Result<u64, AppError> {
    let mut n = 0u64;
    for id in ids {
        let r = sqlx::query("UPDATE zahlung SET kasse_geprueft = ?1 WHERE id = ?2")
            .bind(kasse_geprueft)
            .bind(id)
            .execute(pool)
            .await?;
        n = n.saturating_add(r.rows_affected());
    }
    Ok(n)
}
