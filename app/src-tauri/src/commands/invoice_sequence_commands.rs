//! Fortlaufende Belegnummern (RE-/BR-) in SQLite — eine gemeinsame Quelle für
//! PDF-Rechnungen und Tagesberichte (GoBD-taugliche Tagesfolge, kein reiner Zufall).

use std::collections::HashMap;

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::log_system;

const KV_KEY: &str = "finanzen.document_counters.v1";

#[derive(Debug, Deserialize, Serialize, Default)]
struct CountersV1 {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    days: HashMap<String, DayCounts>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
struct DayCounts {
    #[serde(default)]
    re: u32,
    #[serde(default)]
    br: u32,
}

fn normalize_ymd(ymd: &str) -> Result<String, AppError> {
    let head = ymd.trim().get(..10).ok_or_else(|| {
        AppError::Validation("Datum muss im Format yyyy-MM-dd vorliegen".into())
    })?;
    NaiveDate::parse_from_str(head, "%Y-%m-%d").map_err(|_| {
        AppError::Validation("Datum muss im Format yyyy-MM-dd vorliegen".into())
    })?;
    Ok(head.to_string())
}

fn compact_day(day_yyyy_mm_dd: &str) -> String {
    day_yyyy_mm_dd.replace('-', "")
}

/// Vergibt die nächste RE- bzw. BR-Nummer für den Kalendertag `ymd` (yyyy-MM-dd).
/// Persistiert in `app_kv` unter `finanzen.document_counters.v1` mit `BEGIN IMMEDIATE`.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn allocate_invoice_document_number(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    kind: String,
    ymd: String,
) -> Result<String, AppError> {
    rbac::require_authenticated(&session_state)?;
    rbac::require(&session_state, "finanzen.write")?;

    let day_key = normalize_ymd(&ymd)?;
    let k = kind.to_uppercase();
    if k != "RE" && k != "BR" {
        return Err(AppError::Validation(
            "kind muss „RE“ oder „BR“ sein".into(),
        ));
    }

    let mut conn = pool.acquire().await?;

    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *conn)
        .await?;

    let inner: Result<String, AppError> = async {
        let raw: Option<(String,)> =
            sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
                .bind(KV_KEY)
                .fetch_optional(&mut *conn)
                .await?;

        let mut doc: CountersV1 = raw
            .and_then(|(v,)| serde_json::from_str(&v).ok())
            .unwrap_or_default();
        doc.version = 1;

        let entry = doc.days.entry(day_key.clone()).or_default();
        let seq = if k == "RE" {
            entry.re += 1;
            entry.re
        } else {
            entry.br += 1;
            entry.br
        };

        let json =
            serde_json::to_string(&doc).map_err(|e| AppError::Internal(e.to_string()))?;

        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(KV_KEY)
        .bind(json)
        .execute(&mut *conn)
        .await?;

        let compact = compact_day(&day_key);
        Ok(format!("{k}-{compact}-{seq:06}"))
    }
    .await;

    match inner {
        Ok(ref num) => {
            log_system!(
                info,
                event = "INVOICE_NUMBER_ALLOC",
                kind = %k,
                day = %day_key,
                number = %num
            );
            sqlx::query("COMMIT").execute(&mut *conn).await?;
        }
        Err(_) => {
            let _ = sqlx::query("ROLLBACK").execute(&mut *conn).await;
        }
    }

    inner
}
