//! FA-AUFG-01/06 — `praxis_aufgabe` persistence.
use crate::domain::entities::praxis_aufgabe::{
    CreatePraxisAufgabe, PraxisAufgabe, PraxisAufgabeKommentar, UpdatePraxisAufgabeAdmin,
};
use crate::error::AppError;
use sqlx::SqlitePool;

const ACTIVE_STATUSES: &str = "'OFFEN','IN_BEARBEITUNG','ZURUECK'";

/// Chat-like visibility: creator, named assignee, or (Rezeption only) shared pool rows.
const VISIBILITY_WHERE: &str = "
    assignee_user_id = ?1
    OR (created_by = ?1 AND COALESCE(TRIM(assignee_user_id), '') != '')
    OR (created_by = ?1 AND assignee_role = 'REZEPTION' AND COALESCE(TRIM(assignee_user_id), '') = '')
    OR (?2 = 1 AND assignee_role = 'REZEPTION' AND COALESCE(TRIM(assignee_user_id), '') = '')
";

pub async fn insert(
    pool: &SqlitePool,
    data: &CreatePraxisAufgabe,
    created_by: &str,
) -> Result<PraxisAufgabe, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO praxis_aufgabe (
            id, patient_id, typ, titel, body, assignee_role, assignee_user_id, created_by,
            behandlung_id, untersuchung_id, leistungsname, gesamtkosten, status
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, 'OFFEN')",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(data.typ.trim().to_uppercase())
    .bind(data.titel.trim())
    .bind(&data.body)
    .bind(&data.assignee_role)
    .bind(&data.assignee_user_id)
    .bind(created_by)
    .bind(&data.behandlung_id)
    .bind(&data.untersuchung_id)
    .bind(&data.leistungsname)
    .bind(data.gesamtkosten)
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or_else(|| AppError::Internal("praxis_aufgabe insert".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "praxis_aufgabe",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

/// FA-AUFG-02 — automatische Abrechnungs-Aufgabe nach B/U+Leistung.
pub struct AbrechnungAufgabeParams<'a> {
    pub patient_id: &'a str,
    pub created_by: &'a str,
    pub titel: &'a str,
    pub body: &'a str,
    pub behandlung_id: Option<&'a str>,
    pub untersuchung_id: Option<&'a str>,
    pub leistungsname: Option<&'a str>,
    pub gesamtkosten: Option<f64>,
}

pub async fn insert_abrechnung_for_clinical_line(
    pool: &SqlitePool,
    p: AbrechnungAufgabeParams<'_>,
) -> Result<PraxisAufgabe, AppError> {
    let data = CreatePraxisAufgabe {
        patient_id: Some(p.patient_id.to_string()),
        typ: "ABRECHNUNG".into(),
        titel: p.titel.into(),
        body: Some(p.body.into()),
        assignee_role: Some("REZEPTION".into()),
        assignee_user_id: None,
        behandlung_id: p.behandlung_id.map(str::to_string),
        untersuchung_id: p.untersuchung_id.map(str::to_string),
        leistungsname: p.leistungsname.map(str::to_string),
        gesamtkosten: p.gesamtkosten,
    };
    insert(pool, &data, p.created_by).await
}

/// FA-AUFG-02 / G18 — idempotent auto-task after billable B/U save.
pub async fn ensure_abrechnung_aufgabe_for_clinical_line(
    pool: &SqlitePool,
    patient_id: &str,
    created_by: &str,
    leistungsname: Option<&str>,
    gesamtkosten: Option<f64>,
    behandlung_id: Option<&str>,
    untersuchung_id: Option<&str>,
) -> Result<(), AppError> {
    use crate::domain::services::pricing;
    if !pricing::behandlung_has_billable_leistung(leistungsname, gesamtkosten) {
        return Ok(());
    }
    let open: (i64,) = if let Some(bid) = behandlung_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM praxis_aufgabe
             WHERE typ = 'ABRECHNUNG' AND behandlung_id = ?1
               AND status NOT IN ('VALIDIERT')",
        )
        .bind(bid)
        .fetch_one(pool)
        .await?
    } else if let Some(uid) = untersuchung_id {
        sqlx::query_as(
            "SELECT COUNT(*) FROM praxis_aufgabe
             WHERE typ = 'ABRECHNUNG' AND untersuchung_id = ?1
               AND status NOT IN ('VALIDIERT')",
        )
        .bind(uid)
        .fetch_one(pool)
        .await?
    } else {
        return Ok(());
    };
    if open.0 > 0 {
        return Ok(());
    }
    let ln = leistungsname.unwrap_or("Leistung").trim();
    let titel = if ln.is_empty() {
        "Zahlung erfassen".to_string()
    } else {
        format!("Zahlung erfassen: {ln}")
    };
    let body = match gesamtkosten.filter(|g| g.is_finite() && *g > 0.0) {
        Some(g) => format!("{titel} ({:.2} €)", g),
        None => titel.clone(),
    };
    insert_abrechnung_for_clinical_line(
        pool,
        AbrechnungAufgabeParams {
            patient_id,
            created_by,
            titel: &titel,
            body: &body,
            behandlung_id,
            untersuchung_id,
            leistungsname: leistungsname.filter(|s| !s.trim().is_empty()),
            gesamtkosten,
        },
    )
    .await?;
    Ok(())
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>("SELECT * FROM praxis_aufgabe WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(Into::into)
}

/// Posteingang for the current user — creator/assignee threads + optional REZ pool.
pub async fn list_for_user(
    pool: &SqlitePool,
    user_id: &str,
    include_rezeption_pool: bool,
    limit: i64,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    let pool_flag: i64 = if include_rezeption_pool { 1 } else { 0 };
    let sql = format!(
        "SELECT * FROM praxis_aufgabe
         WHERE (
           status IN ({ACTIVE_STATUSES})
           AND ({VISIBILITY_WHERE})
         ) OR (
           created_by = ?1 AND status != 'VALIDIERT'
         )
         ORDER BY
           CASE status WHEN 'ZURUECK' THEN 0 WHEN 'OFFEN' THEN 1 WHEN 'IN_BEARBEITUNG' THEN 2 WHEN 'ERLEDIGT_REZEPTION' THEN 3 ELSE 4 END,
           datetime(updated_at) DESC
         LIMIT ?3"
    );
    sqlx::query_as::<_, PraxisAufgabe>(&sql)
        .bind(user_id)
        .bind(pool_flag)
        .bind(limit)
        .fetch_all(pool)
        .await
        .map_err(Into::into)
}

pub async fn count_open_for_user(
    pool: &SqlitePool,
    user_id: &str,
    include_rezeption_pool: bool,
) -> Result<i64, AppError> {
    let pool_flag: i64 = if include_rezeption_pool { 1 } else { 0 };
    let count_sql = format!(
        "SELECT COUNT(DISTINCT id) FROM praxis_aufgabe
         WHERE (
           status IN ({ACTIVE_STATUSES}) AND ({VISIBILITY_WHERE})
         ) OR (
           created_by = ?1 AND status != 'VALIDIERT'
         )"
    );
    let row: (i64,) = sqlx::query_as(&count_sql)
        .bind(user_id)
        .bind(pool_flag)
        .fetch_one(pool)
        .await?;
    Ok(row.0)
}

/// Posteingang Rezeption: Pool-Aufgaben (OFFEN, IN_BEARBEITUNG, ZURUECK).
pub async fn list_posteingang_rezeption(
    pool: &SqlitePool,
    limit: i64,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>(
        "SELECT * FROM praxis_aufgabe
         WHERE assignee_role = 'REZEPTION'
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')
         ORDER BY
           CASE status WHEN 'ZURUECK' THEN 0 WHEN 'OFFEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Posteingang Arzt: direkt zugewiesene Aufgaben (REZ → ARZT).
pub async fn list_posteingang_arzt(
    pool: &SqlitePool,
    arzt_id: &str,
    limit: i64,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>(
        "SELECT * FROM praxis_aufgabe
         WHERE assignee_user_id = ?1
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')
         ORDER BY
           CASE status WHEN 'ZURUECK' THEN 0 WHEN 'OFFEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(arzt_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Posteingang Rezeption: von mir an einen Arzt gesendet (noch offen).
pub async fn list_outgoing_rezeption(
    pool: &SqlitePool,
    created_by: &str,
    limit: i64,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>(
        "SELECT * FROM praxis_aufgabe
         WHERE created_by = ?1
           AND assignee_user_id IS NOT NULL
           AND assignee_user_id != ''
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')
         ORDER BY
           CASE status WHEN 'ZURUECK' THEN 0 WHEN 'OFFEN' THEN 1 ELSE 2 END,
           datetime(created_at) DESC
         LIMIT ?2",
    )
    .bind(created_by)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

/// Arzt/Rezeption: erledigte Aufgaben zur Validierung (von mir erstellt).
pub async fn list_pending_validation(
    pool: &SqlitePool,
    created_by: &str,
    limit: i64,
) -> Result<Vec<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>(
        "SELECT * FROM praxis_aufgabe
         WHERE created_by = ?1 AND status = 'ERLEDIGT_REZEPTION'
         ORDER BY datetime(updated_at) DESC
         LIMIT ?2",
    )
    .bind(created_by)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn count_open_for_rezeption(pool: &SqlitePool, user_id: &str) -> Result<i64, AppError> {
    let pool_open: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe
         WHERE assignee_role = 'REZEPTION'
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')",
    )
    .fetch_one(pool)
    .await?;
    let outgoing: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe
         WHERE created_by = ?1
           AND assignee_user_id IS NOT NULL
           AND assignee_user_id != ''
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    let validate: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe
         WHERE created_by = ?1 AND status = 'ERLEDIGT_REZEPTION'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(pool_open.0 + outgoing.0 + validate.0)
}

pub async fn count_open_for_arzt(pool: &SqlitePool, arzt_id: &str) -> Result<i64, AppError> {
    let assigned: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe
         WHERE assignee_user_id = ?1
           AND status IN ('OFFEN','IN_BEARBEITUNG','ZURUECK')",
    )
    .bind(arzt_id)
    .fetch_one(pool)
    .await?;
    let validate: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM praxis_aufgabe
         WHERE created_by = ?1 AND status = 'ERLEDIGT_REZEPTION'",
    )
    .bind(arzt_id)
    .fetch_one(pool)
    .await?;
    Ok(assigned.0 + validate.0)
}

pub async fn update_status(
    pool: &SqlitePool,
    id: &str,
    status: &str,
    erledigt_notiz: Option<&str>,
    zahlung_id: Option<&str>,
    zurueck_begruendung: Option<&str>,
) -> Result<PraxisAufgabe, AppError> {
    let n = sqlx::query(
        "UPDATE praxis_aufgabe SET
            status = ?1,
            erledigt_notiz = COALESCE(?2, erledigt_notiz),
            zahlung_id = COALESCE(?3, zahlung_id),
            zurueck_begruendung = COALESCE(?4, zurueck_begruendung),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
    )
    .bind(status)
    .bind(erledigt_notiz)
    .bind(zahlung_id)
    .bind(zurueck_begruendung)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Aufgabe".into()));
    }
    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "praxis_aufgabe",
        id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}

/// Verwaltung: alle Aufgaben (neueste zuerst).
pub async fn list_all_admin(pool: &SqlitePool, limit: i64) -> Result<Vec<PraxisAufgabe>, AppError> {
    sqlx::query_as::<_, PraxisAufgabe>(
        "SELECT * FROM praxis_aufgabe ORDER BY datetime(updated_at) DESC LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

const AUFGABE_STATUSES: &[&str] = &[
    "OFFEN",
    "IN_BEARBEITUNG",
    "ERLEDIGT_REZEPTION",
    "VALIDIERT",
    "ZURUECK",
];

pub async fn update_admin(
    pool: &SqlitePool,
    patch: &UpdatePraxisAufgabeAdmin,
) -> Result<PraxisAufgabe, AppError> {
    let current = find_by_id(pool, &patch.id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;

    let titel = patch
        .titel
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| current.titel.clone());
    let body = patch.body.clone().or(current.body.clone());
    let typ = patch
        .typ
        .as_deref()
        .map(|t| t.trim().to_uppercase())
        .unwrap_or_else(|| current.typ.clone());
    let assignee_role = patch
        .assignee_role
        .as_ref()
        .map(|v| {
            let t = v.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_uppercase())
            }
        })
        .unwrap_or_else(|| current.assignee_role.clone());
    let assignee_user_id = patch
        .assignee_user_id
        .as_ref()
        .map(|v| {
            let t = v.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        })
        .unwrap_or_else(|| current.assignee_user_id.clone());
    let status = patch
        .status
        .as_deref()
        .map(|s| s.trim().to_uppercase())
        .unwrap_or_else(|| current.status.clone());
    if !AUFGABE_STATUSES.iter().any(|s| *s == status) {
        return Err(AppError::Validation(format!(
            "Unbekannter Status: {status}"
        )));
    }

    let n = sqlx::query(
        "UPDATE praxis_aufgabe SET
            titel = ?1,
            body = ?2,
            typ = ?3,
            assignee_role = ?4,
            assignee_user_id = ?5,
            status = ?6,
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?7",
    )
    .bind(&titel)
    .bind(&body)
    .bind(&typ)
    .bind(&assignee_role)
    .bind(&assignee_user_id)
    .bind(&status)
    .bind(&patch.id)
    .execute(pool)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Aufgabe".into()));
    }
    let updated = find_by_id(pool, &patch.id)
        .await?
        .ok_or(AppError::NotFound("Aufgabe".into()))?;
    let body_json =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", patch.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "praxis_aufgabe",
        &patch.id,
        "UPDATE",
        &body_json,
    )
    .await?;
    Ok(updated)
}

pub async fn list_kommentare(
    pool: &SqlitePool,
    aufgabe_id: &str,
    limit: i64,
) -> Result<Vec<PraxisAufgabeKommentar>, AppError> {
    sqlx::query_as::<_, PraxisAufgabeKommentar>(
        "SELECT * FROM praxis_aufgabe_kommentar
         WHERE aufgabe_id = ?1
         ORDER BY datetime(created_at) ASC
         LIMIT ?2",
    )
    .bind(aufgabe_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(Into::into)
}

pub async fn insert_kommentar(
    pool: &SqlitePool,
    aufgabe_id: &str,
    author_id: &str,
    body: &str,
) -> Result<PraxisAufgabeKommentar, AppError> {
    let text = body.trim();
    if text.is_empty() {
        return Err(AppError::Validation(
            "Kommentar darf nicht leer sein.".into(),
        ));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO praxis_aufgabe_kommentar (id, aufgabe_id, author_id, body)
         VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(&id)
    .bind(aufgabe_id)
    .bind(author_id)
    .bind(text)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, PraxisAufgabeKommentar>(
        "SELECT * FROM praxis_aufgabe_kommentar WHERE id = ?1",
    )
    .bind(&id)
    .fetch_one(pool)
    .await
    .map_err(Into::into)
}
