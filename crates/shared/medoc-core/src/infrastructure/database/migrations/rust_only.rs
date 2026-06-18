//! Rust-only migration steps awkward to express in plain SQL.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

use super::sync_tables;

pub async fn run_rust_only_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    let produkt_id_col: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('lieferant_pharma_vorlage') WHERE name = 'produkt_id'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if produkt_id_col == 0 {
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE IF EXISTS lieferant_pharma_vorlage")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE TABLE lieferant_pharma_vorlage (
            id TEXT PRIMARY KEY,
            lieferant_id TEXT NOT NULL REFERENCES lieferant_stamm(id),
            pharmaberater_id TEXT NOT NULL REFERENCES pharmaberater_stamm(id),
            produkt_id TEXT NOT NULL REFERENCES produkt(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            aktiv INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(lieferant_id, pharmaberater_id, produkt_id)
        )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM personal")
        .fetch_one(pool)
        .await?;
    if count.0 == 0 {
        let hash = bcrypt::hash("passwort123", 12)
            .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle, fachrichtung)
             VALUES ('seed-arzt-001', 'Dr. Ahmed R.', 'ahmed@praxis.de', ?1, 'ARZT', 'Zahnmedizin')",
        )
        .bind(&hash)
        .execute(pool)
        .await?;
        let hash2 = bcrypt::hash("passwort123", 12)
            .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle)
             VALUES ('seed-rez-001', 'Aya M.', 'aya@praxis.de', ?1, 'REZEPTION')",
        )
        .bind(&hash2)
        .execute(pool)
        .await?;
    }

    let ins = sqlx::query(
        "INSERT OR IGNORE INTO app_kv (key, value) VALUES ('migration.billing_freigabe_legacy_v1', '1')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if ins.rows_affected() > 0 {
        let _ = sqlx::query(
            r#"UPDATE behandlung SET
                 freigegeben_von_arzt_id = COALESCE(
                   freigegeben_von_arzt_id,
                   (SELECT id FROM personal WHERE rolle = 'ARZT' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 freigegeben_am = COALESCE(
                   freigegeben_am,
                   COALESCE(NULLIF(TRIM(behandlung_datum), ''), datetime(created_at))
                 )
               WHERE freigegeben_von_arzt_id IS NULL OR freigegeben_am IS NULL"#,
        )
        .execute(pool)
        .await;
        let _ = sqlx::query(
            r#"UPDATE untersuchung SET
                 freigegeben_von_arzt_id = COALESCE(
                   freigegeben_von_arzt_id,
                   (SELECT id FROM personal WHERE rolle = 'ARZT' ORDER BY datetime(created_at) ASC LIMIT 1)
                 ),
                 freigegeben_am = COALESCE(freigegeben_am, datetime(created_at))
               WHERE freigegeben_von_arzt_id IS NULL OR freigegeben_am IS NULL"#,
        )
        .execute(pool)
        .await;
    }

    let ins_aufg = sqlx::query(
        "INSERT OR IGNORE INTO app_kv (key, value) VALUES ('migration.praxis_ticket_to_aufgabe_v1', '1')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if ins_aufg.rows_affected() > 0 {
        let _ = sqlx::query(
            r#"INSERT INTO praxis_aufgabe (
                id, patient_id, typ, titel, body, assignee_user_id, created_by, status,
                legacy_ticket_id, created_at, updated_at
            )
            SELECT
                t.id,
                t.patient_id,
                'SONSTIGES',
                CASE WHEN length(t.body) > 80 THEN substr(t.body, 1, 80) || '…' ELSE t.body END,
                t.body,
                t.to_arzt_id,
                t.from_user_id,
                CASE t.status
                    WHEN 'ERLEDIGT' THEN 'VALIDIERT'
                    WHEN 'IN_BEARBEITUNG' THEN 'IN_BEARBEITUNG'
                    ELSE 'OFFEN'
                END,
                t.id,
                t.created_at,
                t.updated_at
            FROM praxis_ticket t
            WHERE NOT EXISTS (
                SELECT 1 FROM praxis_aufgabe a WHERE a.legacy_ticket_id = t.id
            )"#,
        )
        .execute(pool)
        .await;
    }
    let aufgabe_patient_notnull: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('praxis_aufgabe') WHERE name = 'patient_id' AND \"notnull\" = 1",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if aufgabe_patient_notnull > 0 {
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE TABLE praxis_aufgabe_patient_optional (
                id TEXT PRIMARY KEY,
                patient_id TEXT REFERENCES patient(id) ON DELETE SET NULL,
                typ TEXT NOT NULL DEFAULT 'SONSTIGES',
                titel TEXT NOT NULL,
                body TEXT,
                assignee_role TEXT,
                assignee_user_id TEXT REFERENCES personal(id) ON DELETE SET NULL,
                created_by TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
                behandlung_id TEXT,
                untersuchung_id TEXT,
                leistungsname TEXT,
                gesamtkosten REAL,
                zahlung_id TEXT,
                erledigt_notiz TEXT,
                zurueck_begruendung TEXT,
                status TEXT NOT NULL DEFAULT 'OFFEN',
                legacy_ticket_id TEXT UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query("INSERT INTO praxis_aufgabe_patient_optional SELECT * FROM praxis_aufgabe")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE praxis_aufgabe")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("ALTER TABLE praxis_aufgabe_patient_optional RENAME TO praxis_aufgabe")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_rezeption ON praxis_aufgabe(assignee_role, status, datetime(created_at) DESC)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_assignee ON praxis_aufgabe(assignee_user_id, status, datetime(created_at) DESC)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_creator ON praxis_aufgabe(created_by, status, datetime(updated_at) DESC)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }

    let kommentar_table: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'praxis_aufgabe_kommentar'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if kommentar_table == 0 {
        sqlx::query(
            "CREATE TABLE praxis_aufgabe_kommentar (
                id TEXT PRIMARY KEY,
                aufgabe_id TEXT NOT NULL REFERENCES praxis_aufgabe(id) ON DELETE CASCADE,
                author_id TEXT NOT NULL REFERENCES personal(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_praxis_aufgabe_kommentar_aufgabe
             ON praxis_aufgabe_kommentar(aufgabe_id, datetime(created_at) ASC)",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    for (sql, col) in [(
        "ALTER TABLE device_session ADD COLUMN trusted_at TEXT",
        "trusted_at",
    )] {
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
            personal_id TEXT NOT NULL REFERENCES personal(id),
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
            personal_id TEXT PRIMARY KEY REFERENCES personal(id) ON DELETE CASCADE,
            focus_mode INTEGER NOT NULL DEFAULT 0 CHECK (focus_mode IN (0, 1)),
            auto_record_on_login INTEGER NOT NULL DEFAULT 0 CHECK (auto_record_on_login IN (0, 1)),
            auto_record_on_logout INTEGER NOT NULL DEFAULT 0 CHECK (auto_record_on_logout IN (0, 1))
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS krankenbescheinigung (
            id TEXT PRIMARY KEY,
            personal_id TEXT NOT NULL REFERENCES personal(id),
            note TEXT,
            document_ref TEXT NOT NULL,
            date_from TEXT NOT NULL,
            date_to TEXT,
            start_min INTEGER,
            end_min INTEGER,
            status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED')),
            created_by TEXT NOT NULL REFERENCES personal(id),
            created_at TEXT NOT NULL,
            ended_at TEXT,
            ended_by TEXT REFERENCES personal(id)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    for col in [
        "ALTER TABLE krankenbescheinigung ADD COLUMN start_min INTEGER",
        "ALTER TABLE krankenbescheinigung ADD COLUMN end_min INTEGER",
        "ALTER TABLE krankenbescheinigung ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE'",
        "ALTER TABLE krankenbescheinigung ADD COLUMN created_by TEXT",
        "ALTER TABLE krankenbescheinigung ADD COLUMN ended_at TEXT",
        "ALTER TABLE krankenbescheinigung ADD COLUMN ended_by TEXT",
    ] {
        let _ = sqlx::query(col).execute(pool).await;
    }
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS arbeitsplan_adjustment (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL CHECK (source IN ('krankenbescheinigung', 'manual')),
            source_id TEXT,
            personal_id TEXT NOT NULL REFERENCES personal(id),
            payload_json TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
            created_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    super::verbund_tables::ensure_verbund_tables(pool).await?;

    Ok(())
}
