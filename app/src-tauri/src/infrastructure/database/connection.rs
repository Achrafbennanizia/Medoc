//! Local SQLite (`medoc.db`, WAL). **SQLCipher / PRAGMA key is not wired** — NFA-SEC-08
//! (encryption at rest for the DB file) remains backlog; rely on OS full-disk encryption
//! in production environments until implemented.
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool, SqlitePoolOptions};
use std::str::FromStr;
use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::infrastructure::database::audit_repo;

pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis nicht verfügbar: {e}")))?;
    std::fs::create_dir_all(&app_dir).map_err(|e| {
        AppError::Internal(format!(
            "App-Datenverzeichnis konnte nicht angelegt werden: {e}"
        ))
    })?;

    audit_repo::init_audit_hmac_key(&app_dir).map_err(|e| {
        AppError::Internal(format!(
            "Audit-HMAC-Schlüssel konnte nicht initialisiert werden: {e}"
        ))
    })?;

    let db_path = app_dir.join("medoc.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    let options = SqliteConnectOptions::from_str(&db_url)
        .map_err(AppError::Database)?
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(AppError::Database)?;

    run_migrations(&pool).await?;
    Ok(pool)
}

/// Applies full schema DDL, forward `ALTER`s, and default seed staff when `personal` is empty.
/// Public for integration tests (`cargo test`) and tooling; production callers use [`init_db`].
pub async fn run_migrations(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL CHECK (rolle IN ('ARZT','REZEPTION','STEUERBERATER','PHARMABERATER')),
            taetigkeitsbereich TEXT,
            fachrichtung TEXT,
            telefon TEXT,
            verfuegbar BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patient (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            geburtsdatum DATE NOT NULL,
            geschlecht TEXT NOT NULL CHECK (geschlecht IN ('MAENNLICH','WEIBLICH','DIVERS')),
            versicherungsnummer TEXT NOT NULL UNIQUE,
            telefon TEXT,
            email TEXT,
            adresse TEXT,
            status TEXT NOT NULL DEFAULT 'NEU' CHECK (status IN ('NEU','AKTIV','VALIDIERT','READONLY')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS patientenakte (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL UNIQUE REFERENCES patient(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'ENTWURF' CHECK (status IN ('ENTWURF','IN_BEARBEITUNG','VALIDIERT','READONLY')),
            diagnose TEXT,
            befunde TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS termin (
            id TEXT PRIMARY KEY,
            datum TEXT NOT NULL,
            uhrzeit TEXT NOT NULL,
            art TEXT NOT NULL CHECK (art IN ('ERSTBESUCH','UNTERSUCHUNG','BEHANDLUNG','KONTROLLE','BERATUNG')),
            status TEXT NOT NULL DEFAULT 'GEPLANT' CHECK (status IN ('GEPLANT','BESTAETIGT','DURCHGEFUEHRT','NICHT_ERSCHIENEN','ABGESAGT')),
            notizen TEXT,
            beschwerden TEXT,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS zahnbefund (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            zahn_nummer INTEGER NOT NULL,
            befund TEXT NOT NULL,
            diagnose TEXT,
            notizen TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS untersuchung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            beschwerden TEXT,
            ergebnisse TEXT,
            diagnose TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS behandlung (
            id TEXT PRIMARY KEY,
            akte_id TEXT NOT NULL REFERENCES patientenakte(id) ON DELETE CASCADE,
            art TEXT NOT NULL,
            beschreibung TEXT,
            zaehne TEXT,
            material TEXT,
            notizen TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS anamnesebogen (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            antworten TEXT NOT NULL DEFAULT '{}',
            unterschrieben BOOLEAN NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS leistung (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            beschreibung TEXT,
            kategorie TEXT NOT NULL,
            preis REAL NOT NULL,
            aktiv BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS zahlung (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id),
            betrag REAL NOT NULL,
            zahlungsart TEXT NOT NULL CHECK (zahlungsart IN ('BAR','KARTE','UEBERWEISUNG','RECHNUNG')),
            status TEXT NOT NULL DEFAULT 'AUSSTEHEND' CHECK (status IN ('AUSSTEHEND','BEZAHLT','TEILBEZAHLT','STORNIERT')),
            leistung_id TEXT REFERENCES leistung(id),
            beschreibung TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )"
    ).execute(pool).await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS produkt (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            beschreibung TEXT,
            kategorie TEXT NOT NULL,
            preis REAL NOT NULL,
            bestand INTEGER NOT NULL DEFAULT 0,
            mindestbestand INTEGER NOT NULL DEFAULT 0,
            aktiv BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
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
        "CREATE TABLE IF NOT EXISTS rezept (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            medikament TEXT NOT NULL,
            wirkstoff TEXT,
            dosierung TEXT NOT NULL,
            dauer TEXT NOT NULL,
            hinweise TEXT,
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            status TEXT NOT NULL DEFAULT 'AUSGESTELLT',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS attest (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patient(id) ON DELETE CASCADE,
            arzt_id TEXT NOT NULL REFERENCES personal(id),
            typ TEXT NOT NULL,
            inhalt TEXT NOT NULL,
            gueltig_von DATE NOT NULL,
            gueltig_bis DATE NOT NULL,
            ausgestellt_am DATE NOT NULL DEFAULT (date('now')),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await?;

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

    // Seed default admin user if no personal exists
    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM personal")
        .fetch_one(pool)
        .await?;

    if count.0 == 0 {
        let hash = bcrypt::hash("passwort123", 12)
            .map_err(|e| AppError::Internal(format!("Seed-Passwort (bcrypt): {e}")))?;
        sqlx::query(
            "INSERT INTO personal (id, name, email, passwort_hash, rolle, fachrichtung)
             VALUES ('seed-arzt-001', 'Dr. Ahmed R.', 'ahmed@praxis.de', ?1, 'ARZT', 'Zahnmedizin')"
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

    Ok(())
}
