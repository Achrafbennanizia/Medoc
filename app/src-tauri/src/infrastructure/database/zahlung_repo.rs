use crate::domain::entities::zahlung::{Bilanz, CreateZahlung, UpdateZahlung};
use crate::domain::entities::Zahlung;
use crate::error::AppError;
use sqlx::SqlitePool;

fn compute_payment_status(betrag: f64, erwartet: Option<f64>) -> &'static str {
    match erwartet {
        Some(exp) if exp > 0.000_1 => {
            if betrag + 1e-6 >= exp {
                "BEZAHLT"
            } else {
                "TEILBEZAHLT"
            }
        }
        _ => "BEZAHLT",
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

pub async fn create(pool: &SqlitePool, data: &CreateZahlung) -> Result<Zahlung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let zahlungsart = serde_json::to_string(&data.zahlungsart)
        .map_err(|e| AppError::Internal(format!("Zahlungsart serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    if data.behandlung_id.is_some() && data.untersuchung_id.is_some() {
        return Err(AppError::Validation(
            "Bitte nur eine Verknüpfung: Behandlung oder Untersuchung.".into(),
        ));
    }

    let mut betrag_erwartet = data.betrag_erwartet;
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
        if row.is_none() {
            return Err(AppError::Validation(
                "Behandlung nicht gefunden oder gehört nicht zu diesem Patienten.".into(),
            ));
        }
    }
    if let Some(ref uid) = data.untersuchung_id {
        let ok: Option<(String,)> = sqlx::query_as(
            "SELECT u.id FROM untersuchung u
             JOIN patientenakte a ON u.akte_id = a.id
             WHERE u.id = ?1 AND a.patient_id = ?2",
        )
        .bind(uid)
        .bind(&data.patient_id)
        .fetch_optional(pool)
        .await?;
        if ok.is_none() {
            return Err(AppError::Validation(
                "Untersuchung nicht gefunden oder gehört nicht zu diesem Patienten.".into(),
            ));
        }
    }

    // If leistung_id is provided, auto-fill betrag from leistung price
    let betrag = if data.betrag <= 0.0 {
        if let Some(ref lid) = data.leistung_id {
            let row: Option<(f64,)> = sqlx::query_as("SELECT preis FROM leistung WHERE id = ?1")
                .bind(lid)
                .fetch_optional(pool)
                .await?;
            row.map(|r| r.0).unwrap_or(data.betrag)
        } else {
            return Err(AppError::Validation("Betrag muss größer als 0 sein".into()));
        }
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
                let open = (g - sum_paid).max(0.0);
                if betrag > open + 0.01 {
                    return Err(AppError::Validation(format!(
                        "Zahlbetrag übersteigt den offenen Betrag für diese Behandlung (max. {:.2} €, Summe bisher {:.2} €, Soll {:.2} €).",
                        open, sum_paid, g
                    )));
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

    Ok(
        sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn update_fields(pool: &SqlitePool, data: &UpdateZahlung) -> Result<Zahlung, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT status FROM zahlung WHERE id = ?1")
            .bind(&data.id)
            .fetch_optional(pool)
            .await?;
    let st = row.ok_or(AppError::NotFound("Zahlung".into()))?.0;
    if st != "AUSSTEHEND" && st != "TEILBEZAHLT" {
        return Err(AppError::Validation(
            "Nur ausstehende oder teilbezahlte Zahlungen können bearbeitet werden.".into(),
        ));
    }
    let zahlungsart = serde_json::to_string(&data.zahlungsart)
        .map_err(|e| AppError::Internal(format!("Zahlungsart serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();
    if data.betrag <= 0.0 {
        return Err(AppError::Validation("Betrag muss größer als 0 sein".into()));
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

    sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(&data.id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Zahlung".into()))
}

pub async fn delete_if_pending(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT status FROM zahlung WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?;
    let st = row.ok_or(AppError::NotFound("Zahlung".into()))?.0;
    if st != "AUSSTEHEND" && st != "TEILBEZAHLT" {
        return Err(AppError::Validation(
            "Nur ausstehende oder teilbezahlte Zahlungen können gelöscht werden.".into(),
        ));
    }
    sqlx::query("DELETE FROM zahlung WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_status(pool: &SqlitePool, id: &str, status: &str) -> Result<Zahlung, AppError> {
    sqlx::query("UPDATE zahlung SET status = ?1 WHERE id = ?2")
        .bind(status)
        .bind(id)
        .execute(pool)
        .await?;

    sqlx::query_as::<_, Zahlung>("SELECT * FROM zahlung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Zahlung".into()))
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
