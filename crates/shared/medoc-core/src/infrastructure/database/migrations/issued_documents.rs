//! Registry of issued (official) documents + gap-free yearly number sequences.
//!
//! Runs on every start (idempotent) because existing installs skip the SQLx
//! file migrations (`schema_already_present` path in `connection.rs`).
//!
//! GoBD: an issued document is never changed or deleted. Corrections are new
//! documents (cancellation invoice, new certificate). The triggers below
//! enforce that at the database level; only `status` / `updated_at` may change
//! (ISSUED → CANCELLED when a cancellation invoice references it).

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

pub(super) async fn ensure_issued_document_tables(pool: &SqlitePool) -> Result<(), AppError> {
    for ddl in [
        "CREATE TABLE IF NOT EXISTS issued_document (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN (
                'INVOICE','CANCELLATION','RECEIPT','CERTIFICATE','PRESCRIPTION',
                'CHART_EXTRACT','DISCHARGE_LEAFLET','DAILY_REPORT','REPORT')),
            document_number TEXT NOT NULL,
            source_table TEXT,
            source_id TEXT,
            copy_variant TEXT NOT NULL DEFAULT 'ORIGINAL',
            patient_id TEXT,
            sha256 TEXT NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED','CANCELLED')),
            cancels_id TEXT REFERENCES issued_document(id),
            issued_by TEXT NOT NULL,
            issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
            UNIQUE (kind, document_number, copy_variant)
        )",
        // One official number per source record and copy (reprints reuse it).
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_issued_document_source
            ON issued_document(kind, source_id, copy_variant)
            WHERE source_id IS NOT NULL",
        "CREATE INDEX IF NOT EXISTS ix_issued_document_patient
            ON issued_document(patient_id, issued_at)",
        "CREATE TABLE IF NOT EXISTS issued_document_print (
            id TEXT PRIMARY KEY,
            document_id TEXT NOT NULL REFERENCES issued_document(id),
            sha256 TEXT NOT NULL,
            is_reprint INTEGER NOT NULL DEFAULT 0,
            printed_by TEXT NOT NULL,
            printed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        )",
        "CREATE TABLE IF NOT EXISTS document_sequence (
            prefix TEXT NOT NULL,
            year INTEGER NOT NULL,
            last_value INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (prefix, year)
        )",
        // Immutable content. `IS NOT` so that idempotent sync UPDATEs that
        // rewrite identical values still pass.
        "CREATE TRIGGER IF NOT EXISTS trg_issued_document_immutable
            BEFORE UPDATE ON issued_document
            WHEN OLD.document_number IS NOT NEW.document_number
              OR OLD.sha256 IS NOT NEW.sha256
              OR OLD.payload_json IS NOT NEW.payload_json
              OR OLD.kind IS NOT NEW.kind
              OR OLD.copy_variant IS NOT NEW.copy_variant
              OR OLD.issued_at IS NOT NEW.issued_at
              OR (OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED')
            BEGIN
              SELECT RAISE(ABORT, 'issued_document is immutable (GoBD)');
            END",
        // Deletion only after the 10-year retention period (counted from the
        // end of the issue year, § 147 AO / § 630f BGB).
        "CREATE TRIGGER IF NOT EXISTS trg_issued_document_no_delete
            BEFORE DELETE ON issued_document
            WHEN OLD.issued_at >= strftime('%Y-01-01', 'now', '-10 years')
            BEGIN
              SELECT RAISE(ABORT, 'issued_document cannot be deleted (GoBD)');
            END",
        "CREATE TRIGGER IF NOT EXISTS trg_issued_document_print_no_delete
            BEFORE DELETE ON issued_document_print
            BEGIN
              SELECT RAISE(ABORT, 'issued_document_print cannot be deleted');
            END",
    ] {
        sqlx::query(ddl)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}
