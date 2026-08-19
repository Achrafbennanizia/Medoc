//! Incremental schema upgrades for databases created before sqlx file migrations.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

use super::seed;

pub async fn run_legacy_embedded_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('PHYSICIAN','RECEPTION','TAX_ADVISOR','PHARMA_CONSULTANT')),
            activity_area TEXT,
            specialty TEXT,
            phone TEXT,
            available BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS staff_permission_override (
            staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            effect TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
            PRIMARY KEY (staff_id, action)
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_perm_ov_staff ON staff_permission_override(staff_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patient (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            date_of_birth DATE NOT NULL,
            sex TEXT NOT NULL CHECK (sex IN ('MALE','FEMALE','DIVERSE')),
            insurance_number TEXT NOT NULL UNIQUE,
            phone TEXT,
            email TEXT,
            address TEXT,
            status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','ACTIVE','VALIDATED','READONLY')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patient_chart (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL UNIQUE REFERENCES patient(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_PROGRESS','VALIDATED','READONLY')),
            diagnosis TEXT,
            findings TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS chart_attachment (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            rel_storage_path TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'OTHER',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_chart_attachment_chart ON chart_attachment(chart_id)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS appointment (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            kind TEXT NOT NULL CHECK (kind IN ('FIRST_VISIT','EXAMINATION','TREATMENT','CHECKUP','CONSULTATION')),
            status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','CONFIRMED','COMPLETED','NO_SHOW','CANCELLED')),
            notes TEXT,
            chief_complaint TEXT,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            physician_id TEXT NOT NULL REFERENCES staff(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS dental_finding (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            tooth_number INTEGER NOT NULL,
            finding TEXT NOT NULL,
            diagnosis TEXT,
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS examination (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            chief_complaint TEXT,
            results TEXT,
            diagnosis TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS treatment (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            description TEXT,
            teeth TEXT,
            material TEXT,
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS anamnesis_form (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            answers TEXT NOT NULL DEFAULT '{}',
            signed BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS service_item (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS payment (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','CARD','BANK_TRANSFER','INVOICE')),
            status TEXT NOT NULL DEFAULT 'OUTSTANDING' CHECK (status IN ('OUTSTANDING','PAID','PARTIALLY_PAID','CANCELLED')),
            service_item_id TEXT REFERENCES service_item(id),
            description TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS product (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            min_stock INTEGER NOT NULL DEFAULT 0,
            active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('feedback','vigilance','technical')),
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            reference TEXT,
            status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS balance_sheet_snapshot (
            id TEXT PRIMARY KEY,
            created_by TEXT NOT NULL,
            period TEXT NOT NULL,
            kind TEXT NOT NULL,
            label TEXT NOT NULL,
            income_cents INTEGER NOT NULL DEFAULT 0,
            expenses_cents INTEGER NOT NULL DEFAULT 0,
            balance_cents INTEGER NOT NULL DEFAULT 0,
            payload TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS day_close_protocol (
            id TEXT PRIMARY KEY,
            as_of_date TEXT NOT NULL,
            counted_eur REAL,
            system_cash_eur REAL NOT NULL,
            system_income_eur REAL NOT NULL,
            variance_eur REAL,
            cash_matches INTEGER NOT NULL DEFAULT 0,
            day_payment_count INTEGER NOT NULL DEFAULT 0,
            cash_verified_count INTEGER NOT NULL DEFAULT 0,
            all_payments_verified INTEGER NOT NULL DEFAULT 0,
            note TEXT,
            recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_day_close_protocol_time
            ON day_close_protocol (recorded_at DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_day_close_protocol_as_of_date
            ON day_close_protocol (as_of_date)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS device_session (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_label TEXT NOT NULL,
            user_agent TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT,
            trusted_at TEXT
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_device_session_user ON device_session (user_id, ended_at)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS purchase_order (
            id TEXT PRIMARY KEY,
            order_number TEXT,
            supplier TEXT NOT NULL,
            pharma_consultant TEXT,
            item TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','IN_TRANSIT','DELIVERED','CANCELLED')),
            expected_on DATE,
            delivered_on DATE,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit TEXT,
            remark TEXT,
            total_amount REAL,
            created_by TEXT NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    // Forward migration for older installs that pre-date order_number/pharma_consultant.
    for (sql, col) in [
        (
            "ALTER TABLE purchase_order ADD COLUMN order_number TEXT",
            "order_number",
        ),
        (
            "ALTER TABLE purchase_order ADD COLUMN pharma_consultant TEXT",
            "pharma_consultant",
        ),
        (
            "ALTER TABLE purchase_order ADD COLUMN total_amount REAL",
            "total_amount",
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
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_purchase_order_order_number
            ON purchase_order (order_number)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier
            ON purchase_order (supplier)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            prev_hash TEXT,
            hmac TEXT NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS prescription (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            physician_id TEXT NOT NULL REFERENCES staff(id),
            medication TEXT NOT NULL,
            active_ingredient TEXT,
            dosage TEXT NOT NULL,
            duration TEXT NOT NULL,
            instructions TEXT,
            issued_at DATE NOT NULL DEFAULT (date('now')),
            status TEXT NOT NULL DEFAULT 'ISSUED',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [
        ("ALTER TABLE prescription ADD COLUMN pzn TEXT", "pzn"),
        (
            "ALTER TABLE prescription ADD COLUMN dosage_form TEXT",
            "dosage_form",
        ),
        (
            "ALTER TABLE prescription ADD COLUMN pack_size TEXT",
            "pack_size",
        ),
        ("ALTER TABLE prescription ADD COLUMN quantity INTEGER", "quantity"),
        (
            "ALTER TABLE prescription ADD COLUMN aut_idem BOOLEAN DEFAULT 1",
            "aut_idem",
        ),
        (
            "ALTER TABLE prescription ADD COLUMN prescription_type TEXT DEFAULT 'PRIVAT'",
            "prescription_type",
        ),
        (
            "ALTER TABLE prescription ADD COLUMN icd10_code TEXT",
            "icd10_code",
        ),
        (
            "ALTER TABLE prescription ADD COLUMN prescribing_physician_id TEXT REFERENCES staff(id)",
            "prescribing_physician_id",
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

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS certificate (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            physician_id TEXT NOT NULL REFERENCES staff(id),
            kind TEXT NOT NULL,
            body_text TEXT NOT NULL,
            valid_from DATE NOT NULL,
            valid_until DATE NOT NULL,
            issued_at DATE NOT NULL DEFAULT (date('now')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [
        (
            "ALTER TABLE certificate ADD COLUMN icd10_code TEXT",
            "icd10_code",
        ),
        (
            "ALTER TABLE certificate ADD COLUMN first_or_follow_up TEXT DEFAULT 'FIRST'",
            "first_or_follow_up",
        ),
        (
            "ALTER TABLE certificate ADD COLUMN employer TEXT",
            "employer",
        ),
        (
            "ALTER TABLE certificate ADD COLUMN issuing_physician_id TEXT REFERENCES staff(id)",
            "issuing_physician_id",
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

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS absence (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            comment TEXT,
            from_day TEXT NOT NULL,
            to_day TEXT NOT NULL,
            from_time TEXT,
            to_time TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS document_template (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('REZEPT','ATTEST')),
            title TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS treatment_catalog (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            default_cost REAL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS supplier_master (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pharma_consultant_master (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS supplier_pharma_template (
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
    .await?;

    // Upgrades: older DBs had UNIQUE(supplier, pharma_consultant) only; rebuild when product_id is missing
    // (Quick-pick combinations without product mapping are not portable; table may be empty).
    let product_id_col: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pragma_table_info('supplier_pharma_template') WHERE name = 'product_id'",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if product_id_col == 0 {
        sqlx::query("PRAGMA foreign_keys = OFF")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DROP TABLE IF EXISTS supplier_pharma_template")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
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

    for (sql, col) in [
        (
            "ALTER TABLE treatment ADD COLUMN category TEXT",
            "category",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN service_name TEXT",
            "service_name",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN treatment_number TEXT",
            "treatment_number",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN session_number INTEGER",
            "session_number",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN treatment_status TEXT",
            "treatment_status",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN total_cost REAL",
            "total_cost",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN appointment_required INTEGER",
            "appointment_required",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN treatment_date TEXT",
            "treatment_date",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN released_by_physician_id TEXT",
            "freigegeben_from_physician_id_beh",
        ),
        (
            "ALTER TABLE treatment ADD COLUMN released_at TEXT",
            "freigegeben_am_beh",
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

    for (sql, col) in [
        (
            "ALTER TABLE examination ADD COLUMN examination_number TEXT",
            "examination_number",
        ),
        (
            "ALTER TABLE examination ADD COLUMN released_by_physician_id TEXT",
            "freigegeben_from_physician_id_u",
        ),
        (
            "ALTER TABLE examination ADD COLUMN released_at TEXT",
            "freigegeben_am_u",
        ),
        (
            "ALTER TABLE examination ADD COLUMN category TEXT",
            "category_u",
        ),
        (
            "ALTER TABLE examination ADD COLUMN service_name TEXT",
            "service_name_u",
        ),
        (
            "ALTER TABLE examination ADD COLUMN total_cost REAL",
            "total_cost_u",
        ),
        (
            "ALTER TABLE payment ADD COLUMN treatment_id TEXT",
            "treatment_id",
        ),
        (
            "ALTER TABLE payment ADD COLUMN examination_id TEXT",
            "examination_id",
        ),
        (
            "ALTER TABLE payment ADD COLUMN amount_expected REAL",
            "amount_expected",
        ),
        (
            "ALTER TABLE payment ADD COLUMN cash_verified INTEGER NOT NULL DEFAULT 0",
            "cash_verified",
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

    for (sql, col) in [
        (
            "ALTER TABLE audit_log ADD COLUMN under_break_glass INTEGER NOT NULL DEFAULT 0",
            "under_break_glass",
        ),
        (
            "ALTER TABLE audit_log ADD COLUMN break_glass_reason TEXT",
            "break_glass_reason",
        ),
        (
            "ALTER TABLE staff ADD COLUMN totp_secret TEXT",
            "totp_secret",
        ),
        (
            "ALTER TABLE staff ADD COLUMN totp_enrolled_at TEXT",
            "totp_enrolled_at",
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

    // Forward migration for installs that pre-date the HMAC chain.
    for (sql, col) in [
        (
            "ALTER TABLE audit_log ADD COLUMN prev_hash TEXT",
            "prev_hash",
        ),
        (
            "ALTER TABLE audit_log ADD COLUMN hmac TEXT NOT NULL DEFAULT ''",
            "hmac",
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

    for (sql, col) in [(
        "ALTER TABLE chart_attachment ADD COLUMN document_kind TEXT NOT NULL DEFAULT 'OTHER'",
        "document_kind",
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

    // Seed default admin user if no staff exists
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM staff")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        let hash = bcrypt::hash("password123", 12)
            .map_err(|e| AppError::Internal(format!("Seed password (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT OR IGNORE INTO staff (id, name, email, password_hash, role, specialty)
             VALUES ('seed-physician-001', 'Dr. Ahmed R.', 'ahmed@practice.de', ?1, 'PHYSICIAN', 'Dentistry')"
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
    }

    // FA-LEIST-05: one-time legacy billing release for existing stock (`app_kv` key prevents overwriting newer rows).
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

    // Patient-scoped clinical / workflow state (replaces browser localStorage; DSGVO-erased with patient).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS chart_validation (
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            section_or_item TEXT NOT NULL,
            validated_at TEXT NOT NULL,
            validated_by TEXT,
            PRIMARY KEY (patient_id, section_or_item)
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_chart_validation_patient ON chart_validation(patient_id)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS chart_next_appointment_hint (
            patient_id TEXT PRIMARY KEY REFERENCES patient(id) ON DELETE CASCADE,
            hint_json TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS in_app_notification (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            payload_json TEXT,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_in_app_notification_user ON in_app_notification(user_id, created_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS practice_ticket (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            from_user_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            to_physician_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_ticket_physician ON practice_ticket(to_physician_id, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_ticket_from ON practice_ticket(from_user_id, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS practice_task (
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
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_task_reception ON practice_task(assignee_role, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_task_assignee ON practice_task(assignee_user_id, status, datetime(created_at) DESC)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_task_creator ON practice_task(created_by, status, datetime(updated_at) DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS practice_task_comment (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES practice_task(id) ON DELETE CASCADE,
            author_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_practice_task_comment_task
         ON practice_task_comment(task_id, datetime(created_at) ASC)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS document_template_user (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_document_template_kind ON document_template_user(kind)",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS contract (
            id TEXT PRIMARY KEY,
            designation TEXT NOT NULL,
            partner TEXT NOT NULL,
            amount REAL NOT NULL,
            interval TEXT NOT NULL CHECK (interval IN ('DAY','WEEK','MONTH','YEAR')),
            unlimited INTEGER NOT NULL CHECK (unlimited IN (0,1)),
            period_from TEXT,
            period_until TEXT,
            created_at TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    for (sql, col) in [(
        "ALTER TABLE contract ADD COLUMN document_path TEXT",
        "document_path",
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

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS invoice_document (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            document_number TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            total_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_invoice_document_patient ON invoice_document(patient_id)",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_invoice_document_created ON invoice_document(created_at DESC)",
    )
    .execute(pool)
    .await?;

    // GoBD-oriented append-only trail for issued invoice documents (in addition to audit_log).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS invoice_document_audit (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES invoice_document(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            user_id TEXT NOT NULL,
            payload_excerpt TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_invoice_doc_audit_doc ON invoice_document_audit(document_id)",
    )
    .execute(pool)
    .await?;

    seed::run_post_migration_seed(pool).await?;

    Ok(())
}
