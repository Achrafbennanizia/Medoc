//! Rust-only migration steps awkward to express in plain SQL.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

use super::sync_tables;

pub async fn run_rust_only_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    crate::infrastructure::database::repos::admin::staff_access::ensure_table(pool).await?;
    super::issued_documents::ensure_issued_document_tables(pool).await?;
    super::goz_billing_columns::ensure_goz_billing_columns(pool).await?;
    super::edition_columns::ensure_edition_columns(pool).await?;
    // Group: sharing rules (T5.1) and the second hub's number blocks (T4.3).
    crate::application::allowances::ensure_tables(pool).await?;
    crate::infrastructure::database::number_sequence::blocks::ensure_table(pool).await?;
    super::contract_activation_columns::ensure_contract_activation_columns(pool).await?;
    let product_id_col: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('supplier_pharma_template') WHERE name = 'product_id'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if product_id_col == 0 {
        let mut fk = pool.acquire().await.map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE IF EXISTS supplier_pharma_template")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        let fk_bad: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        if fk_bad > 0 {
            return Err(AppError::Internal(format!(
                "foreign_key_check reported {fk_bad} violations after supplier template rebuild"
            )));
        }
        sqlx::query(
            "CREATE TABLE supplier_pharma_template (
            id TEXT PRIMARY KEY,
            supplier_id TEXT NOT NULL REFERENCES supplier_master(id),
            pharma_consultant_id TEXT NOT NULL REFERENCES pharma_consultant_master(id),
            product_id TEXT NOT NULL REFERENCES product(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(supplier_id, pharma_consultant_id, product_id)
        )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM staff")
        .fetch_one(pool)
        .await?;
    if count.0 == 0 && super::seed::may_seed_default_staff(pool).await {
        let hash = bcrypt::hash("password123", 12)
            .map_err(|e| AppError::Internal(format!("Seed password (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, specialty)
             VALUES ('seed-physician-001', 'Dr. Ahmed R.', 'ahmed@practice.de', ?1, 'PHYSICIAN', 'Dentistry')",
        )
        .bind(&hash)
        .execute(pool)
        .await?;
        let hash2 = bcrypt::hash("password123", 12)
            .map_err(|e| AppError::Internal(format!("Seed password (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role)
             VALUES ('seed-rez-001', 'Aya M.', 'aya@practice.de', ?1, 'RECEPTION')",
        )
        .bind(&hash2)
        .execute(pool)
        .await?;
        if crate::mvp_security::TOTP_2FA_ENABLED {
            let (secret, _) =
                crate::infrastructure::totp::generate_enrollment("ahmed@practice.de")?;
            sqlx::query(
                "UPDATE staff SET totp_secret = ?1, totp_enrolled_at = CURRENT_TIMESTAMP
                 WHERE id = 'seed-physician-001'",
            )
            .bind(&secret)
            .execute(pool)
            .await?;
        }
    }

    let ins = sqlx::query(
        "INSERT OR IGNORE INTO app_kv (key, value) VALUES ('migration.billing_freigabe_legacy_v1', '1')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if ins.rows_affected() > 0 {
        let _ = sqlx::query(
            r#"UPDATE treatment SET
                 released_by_physician_id = COALESCE(
                   released_by_physician_id,
                   (SELECT id FROM staff WHERE role = 'PHYSICIAN' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 released_at = COALESCE(
                   released_at,
                   COALESCE(NULLIF(TRIM(treatment_date), ''), datetime(created_at))
                 )
               WHERE released_by_physician_id IS NULL OR released_at IS NULL"#,
        )
        .execute(pool)
        .await;
        let _ = sqlx::query(
            r#"UPDATE examination SET
                 released_by_physician_id = COALESCE(
                   released_by_physician_id,
                   (SELECT id FROM staff WHERE role = 'PHYSICIAN' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 released_at = COALESCE(released_at, datetime(created_at))
               WHERE released_by_physician_id IS NULL OR released_at IS NULL"#,
        )
        .execute(pool)
        .await;
    }

    let ins_aufg = sqlx::query(
        "INSERT OR IGNORE INTO app_kv (key, value) VALUES ('migration.practice_ticket_to_task_v_1', '1')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if ins_aufg.rows_affected() > 0 {
        let _ = sqlx::query(
            r#"INSERT INTO practice_task (
                id, patient_id, kind, title, body, assignee_user_id, created_by, status,
                legacy_ticket_id, created_at, updated_at
            )
            SELECT
                t.id,
                t.patient_id,
                'OTHER',
                CASE WHEN length(t.body) > 80 THEN substr(t.body, 1, 80) || '…' ELSE t.body END,
                t.body,
                t.to_physician_id,
                t.from_user_id,
                CASE t.status
                    WHEN 'DONE' THEN 'VALIDATED'
                    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'
                    ELSE 'OPEN'
                END,
                t.id,
                t.created_at,
                t.updated_at
            FROM practice_ticket t
            WHERE NOT EXISTS (
                SELECT 1 FROM practice_task a WHERE a.legacy_ticket_id = t.id
            )"#,
        )
        .execute(pool)
        .await;
    }
    let task_patient_notnull: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('practice_task') WHERE name = 'patient_id' AND \"notnull\" = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if task_patient_notnull > 0 {
        let mut fk = pool.acquire().await.map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE TABLE practice_task_patient_optional (
                id TEXT PRIMARY KEY,
                patient_id TEXT REFERENCES patient(id) ON DELETE SET NULL,
                kind TEXT NOT NULL DEFAULT 'OTHER',
                title TEXT NOT NULL,
                body TEXT,
                assignee_role TEXT,
                assignee_user_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
                created_by TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                treatment_id TEXT,
                examination_id TEXT,
                service_name TEXT,
                total_cost REAL,
                payment_id TEXT,
                done_note TEXT,
                return_reason TEXT,
                status TEXT NOT NULL DEFAULT 'OPEN',
                legacy_ticket_id TEXT UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&mut *fk)
        .await
        .map_err(AppError::Database)?;
        sqlx::query("INSERT INTO practice_task_patient_optional SELECT * FROM practice_task")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE practice_task")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("ALTER TABLE practice_task_patient_optional RENAME TO practice_task")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_practice_task_reception ON practice_task(assignee_role, status, datetime(created_at) DESC)",
        )
        .execute(&mut *fk)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_practice_task_assignee ON practice_task(assignee_user_id, status, datetime(created_at) DESC)",
        )
        .execute(&mut *fk)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_practice_task_creator ON practice_task(created_by, status, datetime(updated_at) DESC)",
        )
        .execute(&mut *fk)
        .await
        .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        let fk_bad: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&mut *fk)
            .await
            .map_err(AppError::Database)?;
        if fk_bad > 0 {
            return Err(AppError::Internal(format!(
                "foreign_key_check reported {fk_bad} violations after practice_task rebuild"
            )));
        }
    }

    let comment_table: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'practice_task_comment'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if comment_table == 0 {
        sqlx::query(
            "CREATE TABLE practice_task_comment (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL REFERENCES practice_task(id) ON DELETE CASCADE,
                author_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_practice_task_comment_task
             ON practice_task_comment(task_id, datetime(created_at) ASC)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    for (sql, col) in [
        (
            "ALTER TABLE device_session ADD COLUMN trusted_at TEXT",
            "trusted_at",
        ),
        (
            "ALTER TABLE device_session ADD COLUMN peer_ip TEXT",
            "peer_ip",
        ),
    ] {
        match sqlx::query(sql).execute(pool).await {
            Ok(_) => {}
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("duplicate column") {
                    tracing::debug!(
                        target: "medoc::system",
                        event = "MIGRATION_COLUMN_EXISTS",
                        column = col
                    );
                } else {
                    return Err(AppError::Database(e));
                }
            }
        }
    }

    sync_tables::ensure_sync_replication_tables(pool).await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS work_time_session (
            id TEXT PRIMARY KEY,
            staff_id TEXT NOT NULL REFERENCES staff(id),
            started_at TEXT NOT NULL,
            ended_at TEXT,
            pause_started_at TEXT,
            status TEXT NOT NULL CHECK (status IN ('RUNNING','PAUSED','ENDED')),
            auto_recorded INTEGER NOT NULL DEFAULT 0 CHECK (auto_recorded IN (0, 1)),
            end_reason TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    let _ = sqlx::query("ALTER TABLE work_time_session ADD COLUMN end_reason TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query(
        "ALTER TABLE work_time_session ADD COLUMN pause_minutes INTEGER NOT NULL DEFAULT 0",
    )
    .execute(pool)
    .await;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS work_time_pause_segment (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES work_time_session(id) ON DELETE CASCADE,
            started_at TEXT NOT NULL,
            ended_at TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS work_time_preference (
            staff_id TEXT PRIMARY KEY REFERENCES staff(id) ON DELETE CASCADE,
            focus_mode INTEGER NOT NULL DEFAULT 0 CHECK (focus_mode IN (0, 1)),
            auto_record_on_login INTEGER NOT NULL DEFAULT 0 CHECK (auto_record_on_login IN (0, 1)),
            auto_record_on_logout INTEGER NOT NULL DEFAULT 0 CHECK (auto_record_on_logout IN (0, 1))
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sick_leave_certificate (
            id TEXT PRIMARY KEY,
            staff_id TEXT NOT NULL REFERENCES staff(id),
            note TEXT,
            document_ref TEXT NOT NULL,
            date_from TEXT NOT NULL,
            date_to TEXT,
            start_min INTEGER,
            end_min INTEGER,
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
            created_by TEXT NOT NULL REFERENCES staff(id),
            created_at TEXT NOT NULL,
            ended_at TEXT,
            ended_by TEXT REFERENCES staff(id)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    for col in [
        "ALTER TABLE sick_leave_certificate ADD COLUMN start_min INTEGER",
        "ALTER TABLE sick_leave_certificate ADD COLUMN end_min INTEGER",
        "ALTER TABLE sick_leave_certificate ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'",
        "ALTER TABLE sick_leave_certificate ADD COLUMN created_by TEXT",
        "ALTER TABLE sick_leave_certificate ADD COLUMN ended_at TEXT",
        "ALTER TABLE sick_leave_certificate ADD COLUMN ended_by TEXT",
    ] {
        let _ = sqlx::query(col).execute(pool).await;
    }
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS work_plan_adjustment (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL CHECK (source IN ('sick_leave_certificate', 'manual')),
            source_id TEXT,
            staff_id TEXT NOT NULL REFERENCES staff(id),
            payload_json TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
            created_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    ensure_appointment_duration(pool).await?;
    // F86: correction chain for issued prescriptions.
    let _ = sqlx::query("ALTER TABLE prescription ADD COLUMN replaces_id TEXT")
        .execute(pool)
        .await;
    super::cluster_tables::ensure_cluster_tables(pool).await?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_tombstone (
  entity_table TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  deleted_at   TEXT NOT NULL,
  device_id    TEXT NOT NULL,
  PRIMARY KEY (entity_table, entity_id)
)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    let _ = crate::infrastructure::database::recorded_write::purge_old_tombstones(pool).await?;
    crate::infrastructure::database::number_sequence::ensure_table(pool).await?;
    // Guest proposals (Solo guest inbox). Every edition has the table: same schema everywhere.
    crate::infrastructure::database::repos::admin::staged_change::ensure_table(pool).await?;
    crate::infrastructure::database::number_sequence::ensure_unique_number_indexes(pool).await?;
    ensure_updated_at_on_synced_tables(pool).await?;
    // F144: existing installs keep the old status CHECK lists; widen them.
    super::status_checks::widen_status_checks(pool).await?;
    ensure_chart_attachment_sha256(pool).await?;
    allow_null_patient_insurance(pool).await?;
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_patient_name ON patient(name)")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_blob (
            sha256 TEXT PRIMARY KEY,
            bytes BLOB NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}

/// F65: appointment length. Backfills from a leading "<n> min" in notes.
async fn ensure_appointment_duration(pool: &SqlitePool) -> Result<(), AppError> {
    let has: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('appointment') WHERE name = 'duration_minutes'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if has > 0 {
        return Ok(());
    }
    sqlx::query("ALTER TABLE appointment ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 30")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, notes FROM appointment WHERE notes IS NOT NULL AND notes LIKE '%min%'",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    let re =
        regex::Regex::new(r"(?i)(?:^\s*|duration:\s*)(\d{1,3})\s*min").expect("duration regex");
    for (id, notes) in rows {
        if let Some(m) = re
            .captures(&notes)
            .and_then(|c| c.get(1))
            .and_then(|m| m.as_str().parse::<i64>().ok())
            .filter(|m| (5..=720).contains(m))
        {
            // Local schema backfill on every device: not a user write, no outbox entry.
            sqlx::query("UPDATE appointment SET duration_minutes = ?1 WHERE id = ?2")
                .bind(m)
                .bind(&id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
    }
    Ok(())
}

async fn ensure_updated_at_on_synced_tables(pool: &SqlitePool) -> Result<(), AppError> {
    use crate::infrastructure::database::sync_registry::synced_tables;
    // Unconditional BEFORE UPDATE … RAISE(ABORT, 'error.documents.immutable').
    // ADD COLUMN is fine; a backfill UPDATE of existing rows is not.
    const SKIP_UPDATED_AT_BACKFILL: &[&str] = &["balance_sheet_snapshot", "payment_reminder"];
    for table in synced_tables() {
        let exists: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
        )
        .bind(table)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if exists == 0 {
            continue;
        }
        let n: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = 'updated_at'"
        ))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if n == 0 {
            sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN updated_at TEXT"))
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
        if SKIP_UPDATED_AT_BACKFILL.contains(&table) {
            continue;
        }
        let has_created: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = 'created_at'"
        ))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if has_created > 0 {
            sqlx::query(&format!(
                "UPDATE {table} SET updated_at = COALESCE(updated_at, CAST(created_at AS TEXT), strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE updated_at IS NULL"
            ))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        } else {
            sqlx::query(&format!(
                "UPDATE {table} SET updated_at = COALESCE(updated_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) WHERE updated_at IS NULL"
            ))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        }
    }
    Ok(())
}

async fn ensure_chart_attachment_sha256(pool: &SqlitePool) -> Result<(), AppError> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'chart_attachment'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if exists == 0 {
        return Ok(());
    }
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('chart_attachment') WHERE name = 'sha256'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if n == 0 {
        sqlx::query("ALTER TABLE chart_attachment ADD COLUMN sha256 TEXT")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// F52: missing insurance number is NULL (UNIQUE still holds for present values).
async fn allow_null_patient_insurance(pool: &SqlitePool) -> Result<(), AppError> {
    let notnull: Option<i64> = sqlx::query_scalar(
        "SELECT \"notnull\" FROM pragma_table_info('patient') WHERE name = 'insurance_number'",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    if notnull.unwrap_or(0) == 0 {
        return Ok(());
    }
    let create_sql: Option<String> = sqlx::query_scalar(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'patient'",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    let Some(create_sql) = create_sql else {
        return Ok(());
    };
    let re = regex::Regex::new(r"(?i)(insurance_number\s+TEXT)\s+NOT NULL")
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !re.is_match(&create_sql) {
        return Ok(());
    }
    let new_sql = re.replace(&create_sql, "$1").into_owned();
    super::status_checks::rebuild_table_from_sql(pool, "patient", &new_sql).await
}
