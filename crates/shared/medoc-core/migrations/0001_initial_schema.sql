-- Auto-extracted baseline schema (TASK 3.1)

CREATE TABLE IF NOT EXISTS staff (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('PHYSICIAN','RECEPTION','TAX_ADVISOR','PHARMA_CONSULTANT')),
            activity_area TEXT,
            specialty TEXT,
            phone TEXT,
            available BOOLEAN NOT NULL DEFAULT 1,
            totp_secret TEXT,
            totp_enrolled_at TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS staff_permission_override (
            staff_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            action TEXT NOT NULL,
            effect TEXT NOT NULL CHECK (effect IN ('ALLOW','DENY')),
            PRIMARY KEY (staff_id, action)
        );

CREATE INDEX IF NOT EXISTS idx_perm_ov_staff ON staff_permission_override(staff_id);

CREATE TABLE IF NOT EXISTS patient (
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
        );

CREATE TABLE IF NOT EXISTS patient_chart (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL UNIQUE REFERENCES patient(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_PROGRESS','VALIDATED','READONLY')),
            diagnosis TEXT,
            findings TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS chart_attachment (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            display_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            rel_storage_path TEXT NOT NULL,
            document_kind TEXT NOT NULL DEFAULT 'OTHER',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_chart_attachment_chart ON chart_attachment(chart_id);

CREATE TABLE IF NOT EXISTS appointment (
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
        );

CREATE TABLE IF NOT EXISTS dental_finding (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            tooth_number INTEGER NOT NULL,
            finding TEXT NOT NULL,
            diagnosis TEXT,
            notes TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS examination (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            chief_complaint TEXT,
            results TEXT,
            diagnosis TEXT,
            examination_number TEXT,
            category TEXT,
            service_name TEXT,
            total_cost REAL,
            released_by_physician_id TEXT,
            released_at TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS treatment (
            id TEXT PRIMARY KEY,
            chart_id TEXT NOT NULL REFERENCES patient_chart(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            description TEXT,
            teeth TEXT,
            material TEXT,
            notes TEXT,
            category TEXT,
            service_name TEXT,
            treatment_number TEXT,
            session_number INTEGER,
            treatment_status TEXT,
            total_cost REAL,
            appointment_required INTEGER,
            treatment_date TEXT,
            released_by_physician_id TEXT,
            released_at TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS anamnesis_form (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            answers TEXT NOT NULL DEFAULT '{}',
            signed BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS service_item (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS payment (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH','CARD','BANK_TRANSFER','INVOICE')),
            status TEXT NOT NULL DEFAULT 'OUTSTANDING' CHECK (status IN ('OUTSTANDING','PAID','PARTIALLY_PAID','CANCELLED')),
            service_item_id TEXT REFERENCES service_item(id),
            description TEXT,
            treatment_id TEXT,
            examination_id TEXT,
            amount_expected REAL,
            cash_verified INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS product (
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
        );

CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('feedback','vigilance','technical')),
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            reference TEXT,
            status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS balance_sheet_snapshot (
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
        );

CREATE TABLE IF NOT EXISTS day_close_protocol (
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
        );

CREATE INDEX IF NOT EXISTS idx_day_close_protocol_time
            ON day_close_protocol (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_day_close_protocol_as_of_date
            ON day_close_protocol (as_of_date);

CREATE TABLE IF NOT EXISTS app_kv (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS device_session (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            device_label TEXT NOT NULL,
            user_agent TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
            ended_at TEXT,
            trusted_at TEXT
        );

CREATE INDEX IF NOT EXISTS idx_device_session_user ON device_session (user_id, ended_at);

CREATE TABLE IF NOT EXISTS purchase_order (
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
        );

CREATE INDEX IF NOT EXISTS idx_purchase_order_order_number
            ON purchase_order (order_number);

CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier
            ON purchase_order (supplier);

CREATE TABLE IF NOT EXISTS audit_log (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            details TEXT,
            prev_hash TEXT,
            hmac TEXT NOT NULL DEFAULT '',
            under_break_glass INTEGER NOT NULL DEFAULT 0,
            break_glass_reason TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS prescription (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            physician_id TEXT NOT NULL REFERENCES staff(id),
            medication TEXT NOT NULL,
            active_ingredient TEXT,
            dosage TEXT NOT NULL,
            duration TEXT NOT NULL,
            instructions TEXT,
            pzn TEXT,
            dosage_form TEXT,
            pack_size TEXT,
            quantity INTEGER,
            aut_idem BOOLEAN DEFAULT 1,
            prescription_type TEXT DEFAULT 'PRIVAT',
            icd10_code TEXT,
            prescribing_physician_id TEXT REFERENCES staff(id),
            issued_at DATE NOT NULL DEFAULT (date('now')),
            status TEXT NOT NULL DEFAULT 'ISSUED',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS certificate (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            physician_id TEXT NOT NULL REFERENCES staff(id),
            kind TEXT NOT NULL,
            body_text TEXT NOT NULL,
            valid_from DATE NOT NULL,
            valid_until DATE NOT NULL,
            icd10_code TEXT,
            first_or_follow_up TEXT DEFAULT 'FIRST',
            employer TEXT,
            issuing_physician_id TEXT REFERENCES staff(id),
            issued_at DATE NOT NULL DEFAULT (date('now')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS absence (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            comment TEXT,
            from_day TEXT NOT NULL,
            to_day TEXT NOT NULL,
            from_time TEXT,
            to_time TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS document_template (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('PRESCRIPTION','CERTIFICATE')),
            title TEXT NOT NULL,
            payload TEXT NOT NULL DEFAULT '{}',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS treatment_catalog (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            name TEXT NOT NULL,
            default_cost REAL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS supplier_master (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS pharma_consultant_master (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS supplier_pharma_template (
            id TEXT PRIMARY KEY,
            supplier_id TEXT NOT NULL REFERENCES supplier_master(id),
            pharma_consultant_id TEXT NOT NULL REFERENCES pharma_consultant_master(id),
            product_id TEXT NOT NULL REFERENCES product(id),
            sort_order INTEGER NOT NULL DEFAULT 0,
            active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(supplier_id, pharma_consultant_id, product_id)
        );

CREATE TABLE IF NOT EXISTS chart_validation (
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            section_or_item TEXT NOT NULL,
            validated_at TEXT NOT NULL,
            validated_by TEXT,
            PRIMARY KEY (patient_id, section_or_item)
        );

CREATE INDEX IF NOT EXISTS idx_chart_validation_patient ON chart_validation(patient_id);

CREATE TABLE IF NOT EXISTS chart_next_appointment_hint (
            patient_id TEXT PRIMARY KEY REFERENCES patient(id) ON DELETE CASCADE,
            hint_json TEXT NOT NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE TABLE IF NOT EXISTS in_app_notification (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            payload_json TEXT,
            read_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_in_app_notification_user ON in_app_notification(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS practice_ticket (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            from_user_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            to_physician_id TEXT NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
            body TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','DONE')),
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_practice_ticket_physician ON practice_ticket(to_physician_id, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_practice_ticket_from ON practice_ticket(from_user_id, datetime(created_at) DESC);

CREATE TABLE IF NOT EXISTS practice_task (
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
        );

CREATE INDEX IF NOT EXISTS idx_practice_task_reception ON practice_task(assignee_role, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_practice_task_assignee ON practice_task(assignee_user_id, status, datetime(created_at) DESC);

CREATE INDEX IF NOT EXISTS idx_practice_task_creator ON practice_task(created_by, status, datetime(updated_at) DESC);

CREATE TABLE IF NOT EXISTS document_template_user (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            name TEXT NOT NULL,
            payload TEXT NOT NULL,
            is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
            created_by TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

CREATE INDEX IF NOT EXISTS idx_document_template_kind ON document_template_user(kind);

CREATE TABLE IF NOT EXISTS contract (
            id TEXT PRIMARY KEY,
            designation TEXT NOT NULL,
            partner TEXT NOT NULL,
            amount REAL NOT NULL,
            interval TEXT NOT NULL CHECK (interval IN ('DAY','WEEK','MONTH','YEAR')),
            unlimited INTEGER NOT NULL CHECK (unlimited IN (0,1)),
            period_from TEXT,
            period_until TEXT,
            document_path TEXT,
            created_at TEXT NOT NULL
        );

CREATE TABLE IF NOT EXISTS invoice_document (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            document_number TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            total_cents INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            created_by TEXT NOT NULL
        );

CREATE INDEX IF NOT EXISTS idx_invoice_document_patient ON invoice_document(patient_id);

CREATE INDEX IF NOT EXISTS idx_invoice_document_created ON invoice_document(created_at DESC);

CREATE TABLE IF NOT EXISTS invoice_document_audit (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES invoice_document(id) ON DELETE CASCADE,
            event TEXT NOT NULL,
            user_id TEXT NOT NULL,
            payload_excerpt TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

CREATE INDEX IF NOT EXISTS idx_invoice_doc_audit_doc ON invoice_document_audit(document_id);

CREATE TABLE IF NOT EXISTS brute_force_lockout (
    key_hash TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_brute_force_locked_until
    ON brute_force_lockout (locked_until);
