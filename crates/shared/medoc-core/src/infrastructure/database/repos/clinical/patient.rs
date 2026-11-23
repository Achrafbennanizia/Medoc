use crate::domain::entities::patient::{CreatePatient, UpdatePatient};
use crate::domain::entities::Patient;
use crate::error::AppError;
use chrono::NaiveDate;
use sqlx::{Sqlite, SqlitePool, Transaction};

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Patient>, AppError> {
    let rows = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patient WHERE COALESCE(status,'ACTIVE') != 'ARCHIVED' ORDER BY name, id",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// F57: tab counts of the patients page over ALL patients, not only the rows
/// the list has loaded so far. Same rules as the page's filters; `with_invoices`
/// is false for roles that may not see payment state (counts then ignore it).
#[derive(Debug, Clone, Default, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct PatientFilterCounts {
    pub all: i64,
    pub in_treatment: i64,
    pub new_patient: i64,
    pub invoice_open: i64,
    pub chart_open: i64,
    pub closed: i64,
}

/// Unpaid payment (OUTSTANDING / PARTIALLY_PAID) for this patient.
const INVOICE_OPEN_SQL: &str = "EXISTS (SELECT 1 FROM payment z WHERE z.patient_id = patient.id
         AND TRIM(UPPER(COALESCE(z.status, ''))) IN ('OUTSTANDING', 'PARTIALLY_PAID'))";
/// Record still needs work: draft, in review or declined.
const CHART_OPEN_SQL: &str = "EXISTS (SELECT 1 FROM patient_chart c WHERE c.patient_id = patient.id
         AND UPPER(COALESCE(c.status, '')) IN ('DRAFT', 'IN_PROGRESS', 'DECLINED'))";

/// SQL condition of one patient-list tab, shared by the tab counts and the paged list so both
/// follow the same rules (status guide): lifecycle NEW / ACTIVE / closed, plus the overlapping
/// flags "invoice open" and "record open". `with_invoices` is false for roles that may not see
/// payment state (the invoice tab is then empty). `None` for an unknown tab name.
pub fn tab_condition(tab: &str, with_invoices: bool) -> Option<&'static str> {
    Some(match tab {
        "ALL" => "1=1",
        "NEW_PATIENT" => "patient.status = 'NEW'",
        "IN_TREATMENT" => "patient.status = 'ACTIVE'",
        "CLOSED" => "patient.status IN ('VALIDATED','READONLY')",
        "INVOICE_OPEN" if with_invoices => INVOICE_OPEN_SQL,
        "INVOICE_OPEN" => "0",
        "CHART_OPEN" => CHART_OPEN_SQL,
        _ => return None,
    })
}

pub async fn filter_counts(
    pool: &SqlitePool,
    include_archived: bool,
    with_invoices: bool,
) -> Result<PatientFilterCounts, AppError> {
    let vis = if include_archived {
        "1=1"
    } else {
        "COALESCE(patient.status,'ACTIVE') != 'ARCHIVED'"
    };
    let c = |tab: &str| tab_condition(tab, with_invoices).unwrap_or("0");
    let sql = format!(
        "SELECT
            COUNT(*),
            COALESCE(SUM(CASE WHEN {} THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN {} THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN {} THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN {} THEN 1 ELSE 0 END), 0),
            COALESCE(SUM(CASE WHEN {} THEN 1 ELSE 0 END), 0)
         FROM patient WHERE {vis}",
        c("IN_TREATMENT"),
        c("NEW_PATIENT"),
        c("INVOICE_OPEN"),
        c("CHART_OPEN"),
        c("CLOSED"),
    );
    let r: (i64, i64, i64, i64, i64, i64) = sqlx::query_as(&sql).fetch_one(pool).await?;
    Ok(PatientFilterCounts {
        all: r.0,
        in_treatment: r.1,
        new_patient: r.2,
        invoice_open: r.3,
        chart_open: r.4,
        closed: r.5,
    })
}

/// Which columns a free-text patient search matches (Settings → Search → insurance number).
#[derive(Debug, Clone, Copy)]
pub struct PatientSearchScope {
    pub include_insurance_number: bool,
}

impl Default for PatientSearchScope {
    fn default() -> Self {
        Self {
            include_insurance_number: true,
        }
    }
}

impl PatientSearchScope {
    fn where_clause(self) -> &'static str {
        if self.include_insurance_number {
            "(name LIKE ?1 OR insurance_number LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1)"
        } else {
            "(name LIKE ?1 OR phone LIKE ?1 OR email LIKE ?1)"
        }
    }
}

/// Patient list flag "Record open": patients whose record still needs work (draft, in review, declined).
pub async fn patient_ids_open_chart(pool: &SqlitePool) -> Result<Vec<String>, AppError> {
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT patient_id FROM patient_chart
         WHERE UPPER(COALESCE(status, '')) IN ('DRAFT', 'IN_PROGRESS', 'DECLINED')
         ORDER BY patient_id",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.into_iter().map(|r| r.0).collect())
}

pub async fn find_paginated(
    pool: &SqlitePool,
    limit: u32,
    offset: u32,
    search: Option<&str>,
    include_archived: bool,
    status: Option<&str>,
    tab: Option<&str>,
    with_invoices: bool,
    scope: PatientSearchScope,
) -> Result<(Vec<Patient>, i64), AppError> {
    let q = search.map(str::trim).filter(|s| !s.is_empty());
    let status = status.map(str::trim).filter(|s| !s.is_empty());
    if let Some(st) = status {
        if !st.chars().all(|c| c.is_ascii_uppercase() || c == '_') {
            return Err(AppError::Validation("invalid patient status filter".into()));
        }
    }
    let vis = match (include_archived, status) {
        (true, Some(st)) => format!("status = '{st}'"),
        (false, Some(st)) => {
            format!("COALESCE(status,'ACTIVE') != 'ARCHIVED' AND status = '{st}'")
        }
        (true, None) => "1=1".into(),
        (false, None) => "COALESCE(status,'ACTIVE') != 'ARCHIVED'".into(),
    };
    // A list tab (invoice open, record open, …) is filtered here, not on the client.
    let vis = match tab.map(str::trim).filter(|t| !t.is_empty()) {
        Some(t) => {
            let cond = tab_condition(t, with_invoices)
                .ok_or_else(|| AppError::Validation("invalid patient list tab".into()))?;
            format!("{vis} AND {cond}")
        }
        None => vis,
    };
    let limit = limit.min(50);
    if let Some(q) = q {
        let pattern = format!("%{q}%");
        let matches = scope.where_clause();
        let total_sql = format!("SELECT COUNT(*) FROM patient WHERE {vis} AND {matches}");
        let list_sql = format!(
            "SELECT * FROM patient WHERE {vis} AND {matches}
             ORDER BY name, id LIMIT ?2 OFFSET ?3"
        );
        let total: (i64,) = sqlx::query_as(&total_sql)
            .bind(&pattern)
            .fetch_one(pool)
            .await?;
        let rows = sqlx::query_as::<_, Patient>(&list_sql)
            .bind(&pattern)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(pool)
            .await?;
        Ok((rows, total.0))
    } else {
        let total_sql = format!("SELECT COUNT(*) FROM patient WHERE {vis}");
        let list_sql =
            format!("SELECT * FROM patient WHERE {vis} ORDER BY name, id LIMIT ?1 OFFSET ?2");
        let total: (i64,) = sqlx::query_as(&total_sql).fetch_one(pool).await?;
        let rows = sqlx::query_as::<_, Patient>(&list_sql)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(pool)
            .await?;
        Ok((rows, total.0))
    }
}

pub async fn find_all_matching(
    pool: &SqlitePool,
    search: Option<&str>,
    include_archived: bool,
    status: Option<&str>,
    tab: Option<&str>,
    with_invoices: bool,
    scope: PatientSearchScope,
) -> Result<Vec<Patient>, AppError> {
    let mut offset = 0u32;
    let mut all = Vec::new();
    loop {
        let (page, total) = find_paginated(
            pool,
            50,
            offset,
            search,
            include_archived,
            status,
            tab,
            with_invoices,
            scope,
        )
        .await?;
        let n = page.len() as u32;
        all.extend(page);
        offset += n;
        if n == 0 || offset as i64 >= total {
            break;
        }
    }
    Ok(all)
}

pub async fn name_dob_exists(pool: &SqlitePool, name: &str, dob: &str) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM patient
         WHERE lower(trim(name)) = lower(trim(?1))
           AND date_of_birth = ?2
           AND COALESCE(status,'ACTIVE') != 'ARCHIVED'",
    )
    .bind(name)
    .bind(dob)
    .fetch_one(pool)
    .await?;
    Ok(n > 0)
}

pub async fn find_by_ids(pool: &SqlitePool, ids: &[String]) -> Result<Vec<Patient>, AppError> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }
    // Cap to avoid huge IN lists from a bad client.
    let ids: Vec<&str> = ids.iter().map(String::as_str).take(500).collect();
    let mut out = Vec::with_capacity(ids.len());
    for chunk in ids.chunks(50) {
        let placeholders = (1..=chunk.len())
            .map(|i| format!("?{i}"))
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("SELECT * FROM patient WHERE id IN ({placeholders})");
        let mut q = sqlx::query_as::<_, Patient>(&sql);
        for id in chunk {
            q = q.bind(*id);
        }
        let rows = q.fetch_all(pool).await?;
        out.extend(rows);
    }
    Ok(out)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Patient>, AppError> {
    let row = sqlx::query_as::<_, Patient>("SELECT * FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn search(
    pool: &SqlitePool,
    query: &str,
    include_insurance_number: bool,
) -> Result<Vec<Patient>, AppError> {
    let pattern = format!("%{}%", query);
    let sql = if include_insurance_number {
        "SELECT * FROM patient WHERE COALESCE(status,'ACTIVE') != 'ARCHIVED' AND (name LIKE ?1 OR insurance_number LIKE ?1) ORDER BY name"
    } else {
        "SELECT * FROM patient WHERE COALESCE(status,'ACTIVE') != 'ARCHIVED' AND name LIKE ?1 ORDER BY name"
    };
    let rows = sqlx::query_as::<_, Patient>(sql)
        .bind(&pattern)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

/// Unique stand-in when self-pay / other patients have no insurance number.
/// The column is NOT NULL UNIQUE, so empty strings cannot be reused.
fn insurance_number_for_insert(requested: &str, patient_id: &str) -> String {
    let trimmed = requested.trim();
    if !trimmed.is_empty() {
        return trimmed.to_string();
    }
    let hex: String = patient_id
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .take(8)
        .collect();
    format!("SELF-{hex}")
}

pub async fn create(pool: &SqlitePool, data: &CreatePatient) -> Result<Patient, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let sex = serde_json::to_string(&data.sex)
        .map_err(|e| AppError::Internal(format!("Serialize gender: {e}")))?
        .trim_matches('"')
        .to_uppercase();
    let insurance_number = insurance_number_for_insert(&data.insurance_number, &id);

    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%Y-%m-%dT%H:%M:%fZ','now'))"
    )
    .bind(&id)
    .bind(&data.name)
    .bind(data.date_of_birth.to_string())
    .bind(&sex)
    .bind(&insurance_number)
    .bind(&data.phone)
    .bind(&data.email)
    .bind(&data.address)
    .execute(&mut *tx)
    .await?;

    let chart_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO patient_chart (id, patient_id, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&chart_id)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    let anam_id = uuid::Uuid::new_v4().to_string();
    let empty_anam = r#"{"version":1,"preExisting":{},"medication":{},"allergies":{}}"#;
    sqlx::query(
        "INSERT INTO anamnesis_form (id, patient_id, answers, signed, updated_at)
         VALUES (?1, ?2, ?3, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&anam_id)
    .bind(&id)
    .bind(empty_anam)
    .execute(&mut *tx)
    .await?;

    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "patient", &id, "INSERT",
    )
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "patient_chart",
        &chart_id,
        "INSERT",
    )
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "anamnesis_form",
        &anam_id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;

    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))?;
    Ok(inserted)
}

/// F52: same chart/anamnesis/outbox path as [`create`], status `NEW`, insurance NULL when omitted.
pub async fn create_from_import(
    pool: &SqlitePool,
    name: &str,
    date_of_birth: NaiveDate,
    sex: &str,
    insurance_number: Option<&str>,
    phone: Option<&str>,
    email: Option<&str>,
    address: Option<&str>,
) -> Result<Patient, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, status, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'NEW', strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&id)
    .bind(name)
    .bind(date_of_birth.to_string())
    .bind(sex)
    .bind(insurance_number)
    .bind(phone)
    .bind(email)
    .bind(address)
    .execute(&mut *tx)
    .await?;

    let chart_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO patient_chart (id, patient_id, updated_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&chart_id)
    .bind(&id)
    .execute(&mut *tx)
    .await?;

    let anam_id = uuid::Uuid::new_v4().to_string();
    let empty_anam = r#"{"version":1,"preExisting":{},"medication":{},"allergies":{}}"#;
    sqlx::query(
        "INSERT INTO anamnesis_form (id, patient_id, answers, signed, updated_at)
         VALUES (?1, ?2, ?3, 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&anam_id)
    .bind(&id)
    .bind(empty_anam)
    .execute(&mut *tx)
    .await?;

    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "patient", &id, "INSERT",
    )
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "patient_chart",
        &chart_id,
        "INSERT",
    )
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "anamnesis_form",
        &anam_id,
        "INSERT",
    )
    .await?;
    tx.commit().await?;

    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdatePatient,
) -> Result<Patient, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;

    let name = data.name.as_deref().unwrap_or(&existing.name);
    let status = match data.status.as_ref() {
        Some(s) => serde_json::to_string(s)
            .map_err(|e| AppError::Internal(format!("Serialize status: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.status.clone(),
    };
    // F62: only known statuses and allowed transitions.
    crate::domain::status::PatientStatus::require_transition(&existing.status, &status)?;

    sqlx::query(
        "UPDATE patient SET name = ?1, phone = ?2, email = ?3, address = ?4,
         status = ?5, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?6",
    )
    .bind(name)
    .bind(crate::domain::serde_util::patch_text(
        &data.phone,
        existing.phone.as_deref(),
    ))
    .bind(crate::domain::serde_util::patch_text(
        &data.email,
        existing.email.as_deref(),
    ))
    .bind(crate::domain::serde_util::patch_text(
        &data.address,
        existing.address.as_deref(),
    ))
    .bind(&status)
    .bind(id)
    .execute(pool)
    .await?;

    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "patient", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

/// FA-PAT-03: NEW marks first-time visitors with initial appointment(s).
/// Status expires automatically when their first appointment is completed (`COMPLETED`).
pub async fn expire_new_status_after_completed_appointment(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<bool, AppError> {
    let existing = find_by_id(pool, patient_id).await?;
    let Some(p) = existing else {
        return Ok(false);
    };
    if !p.status.eq_ignore_ascii_case("NEW") {
        return Ok(false);
    }

    let result = sqlx::query(
        "UPDATE patient SET status = 'ACTIVE', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1 AND status = 'NEW'",
    )
    .bind(patient_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false);
    }

    let updated = find_by_id(pool, patient_id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{patient_id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "patient", patient_id, "UPDATE", &body,
    )
    .await?;
    Ok(true)
}

pub async fn archive(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let status: String =
        sqlx::query_scalar("SELECT COALESCE(status,'ACTIVE') FROM patient WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?
            .ok_or_else(|| AppError::NotFound("Patient".into()))?;
    crate::domain::status::PatientStatus::require_transition(&status, "ARCHIVED")?;
    let mut tx = pool.begin().await?;
    let n = sqlx::query(
        "UPDATE patient SET status = 'ARCHIVED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?1",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Patient".into()));
    }
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "patient", id, "UPDATE")
        .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn restore_archived(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    crate::domain::status::PatientStatus::require_transition("ARCHIVED", "ACTIVE")?;
    let mut tx = pool.begin().await?;
    let n = sqlx::query(
        "UPDATE patient SET status = 'ACTIVE', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?1 AND status = 'ARCHIVED'",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::NotFound("Patient".into()));
    }
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "patient", id, "UPDATE")
        .await?;
    tx.commit().await?;
    Ok(())
}

/// Runs `DELETE FROM <table> WHERE <cond>` (one bound parameter) and records a
/// sync DELETE for every removed row, so erasure reaches the other devices
/// (F119: bulk deletes used to be invisible to sync).
async fn exec_bound(
    tx: &mut Transaction<'_, Sqlite>,
    sql: &str,
    patient_id: &str,
    record: bool,
) -> Result<u64, AppError> {
    let re = regex::Regex::new(r"(?is)^\s*DELETE\s+FROM\s+([a-z_][a-z0-9_]*)\s+(WHERE\s+.*)$")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    let Some(caps) = re.captures(sql) else {
        return Err(AppError::Internal(format!(
            "exec_bound expects DELETE … WHERE: {sql}"
        )));
    };
    let table = caps
        .get(1)
        .map(|m| m.as_str())
        .unwrap_or_default()
        .to_string();
    let where_sql = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
    let synced =
        crate::infrastructure::database::sync_registry::synced_tables().any(|t| t == table);
    let ids: Vec<String> = if record && synced {
        let key = crate::infrastructure::database::sync_registry::key_expr(&table);
        sqlx::query_scalar(&format!(
            "SELECT CAST({key} AS TEXT) FROM {table} {where_sql}"
        ))
        .bind(patient_id)
        .fetch_all(&mut **tx)
        .await?
    } else {
        Vec::new()
    };
    let n = sqlx::query(sql)
        .bind(patient_id)
        .execute(&mut **tx)
        .await?
        .rows_affected();
    for id in &ids {
        crate::infrastructure::database::recorded_write::record_in_tx(tx, &table, id, "DELETE")
            .await?;
    }
    Ok(n)
}

/// Delete restrict/cascade children. SQLite may have `foreign_keys` off, so
/// do not rely on `ON DELETE CASCADE` (same class as staff 787).
/// `record = true` for local erasure (rows go to the outbox); `false` on the
/// sync-apply path, which must not echo the remote delete back.
pub async fn delete_dependents(
    tx: &mut Transaction<'_, Sqlite>,
    patient_id: &str,
    record: bool,
) -> Result<u64, AppError> {
    // sync: each removed row is recorded in exec_bound (record_in_tx)
    let mut deleted: u64 = 0;
    deleted += exec_bound(
        tx,
        "DELETE FROM appointment WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM anamnesis_form WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM payment WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM prescription WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM certificate WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_validation WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_next_appointment_hint WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;

    let in_app_needle = format!("%\"patient_id\":\"{patient_id}\"%");
    deleted += exec_bound(
        tx,
        "DELETE FROM in_app_notification WHERE payload_json LIKE ?1",
        &in_app_needle,
        record,
    )
    .await?;

    deleted += exec_bound(
        tx,
        "DELETE FROM invoice_document_audit WHERE document_id IN
         (SELECT id FROM invoice_document WHERE patient_id = ?1)",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM invoice_document WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM practice_ticket WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;

    let task_ids: Vec<String> =
        sqlx::query_scalar("SELECT id FROM practice_task WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(&mut **tx)
            .await?;
    sqlx::query("UPDATE practice_task SET patient_id = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut **tx)
        .await?;
    for task_id in task_ids.iter().filter(|_| record) {
        crate::infrastructure::database::recorded_write::record_in_tx(
            tx,
            "practice_task",
            task_id,
            "UPDATE",
        )
        .await?;
    }

    deleted += exec_bound(
        tx,
        "DELETE FROM treatment WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM examination WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM dental_finding WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM chart_attachment WHERE chart_id IN (SELECT id FROM patient_chart WHERE patient_id = ?1)",
        patient_id, record
    )
    .await?;
    deleted += exec_bound(
        tx,
        "DELETE FROM patient_chart WHERE patient_id = ?1",
        patient_id,
        record,
    )
    .await?;
    Ok(deleted)
}

/// Hard-delete the patient row after dependents. No outbox (sync apply path).
pub async fn delete_row(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // sync: recorded by caller erase_patient
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_BEGIN",
        patient_id = %id
    );
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?;
    if exists.is_none() {
        tx.rollback().await.map_err(AppError::Database)?;
        tracing::info!(
            target: "medoc::patient",
            event = "PATIENT_DELETE_MISSING",
            patient_id = %id
        );
        return Ok(());
    }
    let n = delete_dependents(&mut tx, id, false).await?;
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_DEPENDENTS",
        patient_id = %id,
        deleted_child_rows = n
    );
    sqlx::query("DELETE FROM patient WHERE id = ?1")
        .bind(id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::patient",
        event = "PATIENT_DELETE_OK",
        patient_id = %id
    );
    Ok(())
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    delete_row(pool, id).await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

#[cfg(test)]
mod insurance_number_insert_tests {
    use super::insurance_number_for_insert;

    #[test]
    fn keeps_provided_number() {
        assert_eq!(
            insurance_number_for_insert(" A123456789 ", "unused"),
            "A123456789"
        );
    }

    #[test]
    fn synthesizes_unique_self_pay_placeholder() {
        let vn = insurance_number_for_insert("", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
        assert_eq!(vn, "SELF-a1b2c3d4");
    }
}
