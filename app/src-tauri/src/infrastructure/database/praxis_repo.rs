//! Practice-wide rows: absences / working calendar and reusable document templates.
use crate::error::AppError;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Abwesenheit {
    pub id: String,
    pub typ: String,
    pub kommentar: Option<String>,
    pub von_tag: String,
    pub bis_tag: String,
    pub von_uhrzeit: Option<String>,
    pub bis_uhrzeit: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateAbwesenheit {
    pub typ: String,
    pub kommentar: Option<String>,
    pub von_tag: String,
    pub bis_tag: String,
    pub von_uhrzeit: Option<String>,
    pub bis_uhrzeit: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAbwesenheit {
    pub typ: Option<String>,
    pub kommentar: Option<String>,
    pub von_tag: Option<String>,
    pub bis_tag: Option<String>,
    pub von_uhrzeit: Option<String>,
    pub bis_uhrzeit: Option<String>,
}

pub async fn list_abwesenheiten(pool: &SqlitePool) -> Result<Vec<Abwesenheit>, AppError> {
    let rows = sqlx::query_as::<_, Abwesenheit>("SELECT * FROM abwesenheit ORDER BY von_tag DESC, created_at DESC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create_abwesenheit(pool: &SqlitePool, data: &CreateAbwesenheit) -> Result<Abwesenheit, AppError> {
    if data.typ.trim().is_empty() {
        return Err(AppError::Validation("Typ darf nicht leer sein".into()));
    }
    if data.von_tag.trim().is_empty() || data.bis_tag.trim().is_empty() {
        return Err(AppError::Validation("Von- und Bis-Datum erforderlich".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO abwesenheit (id, typ, kommentar, von_tag, bis_tag, von_uhrzeit, bis_uhrzeit)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(data.typ.trim())
    .bind(data.kommentar.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(data.von_tag.trim())
    .bind(data.bis_tag.trim())
    .bind(data.von_uhrzeit.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .bind(data.bis_uhrzeit.as_ref().map(|s| s.trim()).filter(|s| !s.is_empty()))
    .execute(pool)
    .await?;
    find_abwesenheit_by_id(pool, &id).await
}

pub async fn find_abwesenheit_by_id(pool: &SqlitePool, id: &str) -> Result<Abwesenheit, AppError> {
    sqlx::query_as::<_, Abwesenheit>("SELECT * FROM abwesenheit WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Abwesenheit".into()))
}

pub async fn update_abwesenheit(pool: &SqlitePool, id: &str, data: &UpdateAbwesenheit) -> Result<Abwesenheit, AppError> {
    let existing = find_abwesenheit_by_id(pool, id).await?;
    let typ = data.typ.as_deref().unwrap_or(&existing.typ).trim().to_string();
    if typ.is_empty() {
        return Err(AppError::Validation("Typ darf nicht leer sein".into()));
    }
    let kommentar = match &data.kommentar {
        None => existing.kommentar.clone(),
        Some(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
    };
    let von_tag = data.von_tag.as_deref().unwrap_or(&existing.von_tag).trim().to_string();
    let bis_tag = data.bis_tag.as_deref().unwrap_or(&existing.bis_tag).trim().to_string();
    if von_tag.is_empty() || bis_tag.is_empty() {
        return Err(AppError::Validation("Von- und Bis-Datum erforderlich".into()));
    }
    let von_uhrzeit = match &data.von_uhrzeit {
        None => existing.von_uhrzeit.clone(),
        Some(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
    };
    let bis_uhrzeit = match &data.bis_uhrzeit {
        None => existing.bis_uhrzeit.clone(),
        Some(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
    };

    sqlx::query(
        "UPDATE abwesenheit SET typ = ?1, kommentar = ?2, von_tag = ?3, bis_tag = ?4,
         von_uhrzeit = ?5, bis_uhrzeit = ?6, updated_at = CURRENT_TIMESTAMP WHERE id = ?7",
    )
    .bind(&typ)
    .bind(&kommentar)
    .bind(&von_tag)
    .bind(&bis_tag)
    .bind(&von_uhrzeit)
    .bind(&bis_uhrzeit)
    .bind(id)
    .execute(pool)
    .await?;
    find_abwesenheit_by_id(pool, id).await
}

pub async fn delete_abwesenheit(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM abwesenheit WHERE id = ?1").bind(id).execute(pool).await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Abwesenheit".into()));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DokumentVorlage {
    pub id: String,
    pub kind: String,
    pub titel: String,
    pub payload: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateDokumentVorlage {
    pub kind: String,
    pub titel: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDokumentVorlage {
    pub titel: Option<String>,
    pub payload: Option<serde_json::Value>,
}

pub async fn list_dokument_vorlagen(pool: &SqlitePool) -> Result<Vec<DokumentVorlage>, AppError> {
    let rows = sqlx::query_as::<_, DokumentVorlage>("SELECT * FROM dokument_vorlage ORDER BY kind, titel")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create_dokument_vorlage(pool: &SqlitePool, data: &CreateDokumentVorlage) -> Result<DokumentVorlage, AppError> {
    let kind = data.kind.trim().to_uppercase();
    if kind != "REZEPT" && kind != "ATTEST" {
        return Err(AppError::Validation("kind muss REZEPT oder ATTEST sein".into()));
    }
    if data.titel.trim().is_empty() {
        return Err(AppError::Validation("Titel erforderlich".into()));
    }
    let payload_str = serde_json::to_string(&data.payload).map_err(|e| AppError::Internal(e.to_string()))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO dokument_vorlage (id, kind, titel, payload) VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(&id)
    .bind(&kind)
    .bind(data.titel.trim())
    .bind(&payload_str)
    .execute(pool)
    .await?;
    find_dokument_vorlage_by_id(pool, &id).await
}

pub async fn find_dokument_vorlage_by_id(pool: &SqlitePool, id: &str) -> Result<DokumentVorlage, AppError> {
    sqlx::query_as::<_, DokumentVorlage>("SELECT * FROM dokument_vorlage WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("DokumentVorlage".into()))
}

pub async fn update_dokument_vorlage(pool: &SqlitePool, id: &str, data: &UpdateDokumentVorlage) -> Result<DokumentVorlage, AppError> {
    let existing = find_dokument_vorlage_by_id(pool, id).await?;
    let titel = data.titel.as_deref().unwrap_or(&existing.titel).trim().to_string();
    if titel.is_empty() {
        return Err(AppError::Validation("Titel erforderlich".into()));
    }
    let payload_str = if let Some(p) = &data.payload {
        serde_json::to_string(p).map_err(|e| AppError::Internal(e.to_string()))?
    } else {
        existing.payload.clone()
    };
    sqlx::query(
        "UPDATE dokument_vorlage SET titel = ?1, payload = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
    )
    .bind(&titel)
    .bind(&payload_str)
    .bind(id)
    .execute(pool)
    .await?;
    find_dokument_vorlage_by_id(pool, id).await
}

pub async fn delete_dokument_vorlage(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM dokument_vorlage WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("DokumentVorlage".into()));
    }
    Ok(())
}

// --- Behandlungs-Katalog (Verwaltung → vordefinierte Leistungen) ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct BehandlungsKatalogItem {
    pub id: String,
    pub kategorie: String,
    pub name: String,
    pub default_kosten: Option<f64>,
    pub sort_order: i64,
    pub aktiv: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateBehandlungsKatalogItem {
    pub kategorie: String,
    pub name: String,
    pub default_kosten: Option<f64>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBehandlungsKatalogItem {
    pub kategorie: String,
    pub name: String,
    pub default_kosten: Option<f64>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

pub async fn list_behandlungs_katalog(pool: &SqlitePool) -> Result<Vec<BehandlungsKatalogItem>, AppError> {
    let rows = sqlx::query_as::<_, BehandlungsKatalogItem>(
        "SELECT * FROM behandlungs_katalog WHERE aktiv = 1 ORDER BY kategorie, sort_order, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_behandlungs_katalog_item(
    pool: &SqlitePool,
    data: &CreateBehandlungsKatalogItem,
) -> Result<BehandlungsKatalogItem, AppError> {
    if data.kategorie.trim().is_empty() || data.name.trim().is_empty() {
        return Err(AppError::Validation("Kategorie und Name erforderlich".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO behandlungs_katalog (id, kategorie, name, default_kosten, sort_order, aktiv)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
    )
    .bind(&id)
    .bind(data.kategorie.trim())
    .bind(data.name.trim())
    .bind(data.default_kosten)
    .bind(sort)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, BehandlungsKatalogItem>("SELECT * FROM behandlungs_katalog WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn update_behandlungs_katalog_item(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateBehandlungsKatalogItem,
) -> Result<BehandlungsKatalogItem, AppError> {
    if data.kategorie.trim().is_empty() || data.name.trim().is_empty() {
        return Err(AppError::Validation("Kategorie und Name erforderlich".into()));
    }
    let sort = data.sort_order.unwrap_or(0);
    let r = sqlx::query(
        "UPDATE behandlungs_katalog SET kategorie = ?1, name = ?2, default_kosten = ?3, sort_order = ?4 WHERE id = ?5 AND aktiv = 1",
    )
    .bind(data.kategorie.trim())
    .bind(data.name.trim())
    .bind(data.default_kosten)
    .bind(sort)
    .bind(id)
    .execute(pool)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Katalogeintrag".into()));
    }
    sqlx::query_as::<_, BehandlungsKatalogItem>("SELECT * FROM behandlungs_katalog WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_behandlungs_katalog_item(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE behandlungs_katalog SET aktiv = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Katalogeintrag".into()));
    }
    Ok(())
}

// --- Bestellstamm: Lieferant / Pharmaberater (Verwaltung) + Kombi für „Neue Bestellung“ ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LieferantStammRow {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub aktiv: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmaberaterStammRow {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub aktiv: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LieferantPharmaVorlageRow {
    pub id: String,
    pub lieferant_id: String,
    pub pharmaberater_id: String,
    pub produkt_id: String,
    pub lieferant_name: String,
    pub pharmaberater_name: String,
    pub produkt_name: String,
    pub produkt_kategorie: String,
    pub produkt_preis: f64,
    pub produkt_aktiv: i64,
    pub sort_order: i64,
    pub aktiv: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateLieferantStamm {
    pub name: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePharmaberaterStamm {
    pub name: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLieferantPharmaVorlage {
    pub lieferant_id: String,
    pub pharmaberater_id: String,
    pub produkt_id: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

pub async fn list_lieferant_stamm(pool: &SqlitePool) -> Result<Vec<LieferantStammRow>, AppError> {
    sqlx::query_as::<_, LieferantStammRow>(
        "SELECT * FROM lieferant_stamm WHERE aktiv = 1 ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_lieferant_stamm(
    pool: &SqlitePool,
    data: &CreateLieferantStamm,
) -> Result<LieferantStammRow, AppError> {
    let name = data.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Lieferant: Name erforderlich".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO lieferant_stamm (id, name, sort_order, aktiv) VALUES (?1, ?2, ?3, 1)",
    )
    .bind(&id)
    .bind(name)
    .bind(sort)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, LieferantStammRow>("SELECT * FROM lieferant_stamm WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_lieferant_stamm(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE lieferant_stamm SET aktiv = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Lieferant".into()));
    }
    sqlx::query("UPDATE lieferant_pharma_vorlage SET aktiv = 0 WHERE lieferant_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_pharmaberater_stamm(pool: &SqlitePool) -> Result<Vec<PharmaberaterStammRow>, AppError> {
    sqlx::query_as::<_, PharmaberaterStammRow>(
        "SELECT * FROM pharmaberater_stamm WHERE aktiv = 1 ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_pharmaberater_stamm(
    pool: &SqlitePool,
    data: &CreatePharmaberaterStamm,
) -> Result<PharmaberaterStammRow, AppError> {
    let name = data.name.trim();
    if name.is_empty() {
        return Err(AppError::Validation("Kontakt: Name erforderlich".into()));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO pharmaberater_stamm (id, name, sort_order, aktiv) VALUES (?1, ?2, ?3, 1)",
    )
    .bind(&id)
    .bind(name)
    .bind(sort)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, PharmaberaterStammRow>("SELECT * FROM pharmaberater_stamm WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_pharmaberater_stamm(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE pharmaberater_stamm SET aktiv = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Kontakt".into()));
    }
    sqlx::query("UPDATE lieferant_pharma_vorlage SET aktiv = 0 WHERE pharmaberater_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_lieferant_pharma_vorlagen(
    pool: &SqlitePool,
) -> Result<Vec<LieferantPharmaVorlageRow>, AppError> {
    let rows = sqlx::query_as::<_, LieferantPharmaVorlageRow>(
        "SELECT
            v.id,
            v.lieferant_id,
            v.pharmaberater_id,
            v.produkt_id,
            l.name AS lieferant_name,
            p.name AS pharmaberater_name,
            pr.name AS produkt_name,
            pr.kategorie AS produkt_kategorie,
            pr.preis AS produkt_preis,
            pr.aktiv AS produkt_aktiv,
            v.sort_order,
            v.aktiv,
            v.created_at
         FROM lieferant_pharma_vorlage v
         JOIN lieferant_stamm l ON l.id = v.lieferant_id
         JOIN pharmaberater_stamm p ON p.id = v.pharmaberater_id
         JOIN produkt pr ON pr.id = v.produkt_id
         WHERE v.aktiv = 1 AND l.aktiv = 1 AND p.aktiv = 1
         ORDER BY v.sort_order, l.name, p.name, pr.name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;
    Ok(rows)
}

async fn fetch_vorlage_row(
    pool: &SqlitePool,
    vid: &str,
) -> Result<LieferantPharmaVorlageRow, AppError> {
    sqlx::query_as::<_, LieferantPharmaVorlageRow>(
        "SELECT
            v.id,
            v.lieferant_id,
            v.pharmaberater_id,
            v.produkt_id,
            l.name AS lieferant_name,
            p.name AS pharmaberater_name,
            pr.name AS produkt_name,
            pr.kategorie AS produkt_kategorie,
            pr.preis AS produkt_preis,
            pr.aktiv AS produkt_aktiv,
            v.sort_order,
            v.aktiv,
            v.created_at
         FROM lieferant_pharma_vorlage v
         JOIN lieferant_stamm l ON l.id = v.lieferant_id
         JOIN pharmaberater_stamm p ON p.id = v.pharmaberater_id
         JOIN produkt pr ON pr.id = v.produkt_id
         WHERE v.id = ?1",
    )
    .bind(vid)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_lieferant_pharma_vorlage(
    pool: &SqlitePool,
    data: &CreateLieferantPharmaVorlage,
) -> Result<LieferantPharmaVorlageRow, AppError> {
    let lid = data.lieferant_id.trim();
    let pid = data.pharmaberater_id.trim();
    let prid = data.produkt_id.trim();
    if lid.is_empty() || pid.is_empty() || prid.is_empty() {
        return Err(AppError::Validation("Lieferant, Kontakt und Produkt wählen".into()));
    }
    let l_ok: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM lieferant_stamm WHERE id = ?1 AND aktiv = 1")
        .bind(lid)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?;
    if l_ok.0 == 0 {
        return Err(AppError::Validation("Ungültiger Lieferant".into()));
    }
    let p_ok: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM pharmaberater_stamm WHERE id = ?1 AND aktiv = 1")
        .bind(pid)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?;
    if p_ok.0 == 0 {
        return Err(AppError::Validation("Ungültiger Kontakt".into()));
    }
    let pr_ok: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM produkt WHERE id = ?1 AND aktiv = 1")
        .bind(prid)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?;
    if pr_ok.0 == 0 {
        return Err(AppError::Validation("Ungültiges oder inaktives Produkt".into()));
    }
    // Existing triple (incl. soft-deleted): reactivate or return
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT id, aktiv FROM lieferant_pharma_vorlage WHERE lieferant_id = ?1 AND pharmaberater_id = ?2 AND produkt_id = ?3",
    )
    .bind(lid)
    .bind(pid)
    .bind(prid)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;
    if let Some((eid, aktiv)) = existing {
        if aktiv == 0 {
            sqlx::query("UPDATE lieferant_pharma_vorlage SET aktiv = 1, sort_order = ?2 WHERE id = ?1")
                .bind(&eid)
                .bind(data.sort_order.unwrap_or(0))
                .execute(pool)
                .await?;
        }
        return fetch_vorlage_row(pool, &eid).await;
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO lieferant_pharma_vorlage (id, lieferant_id, pharmaberater_id, produkt_id, sort_order, aktiv)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
    )
    .bind(&id)
    .bind(lid)
    .bind(pid)
    .bind(prid)
    .bind(sort)
    .execute(pool)
    .await?;
    fetch_vorlage_row(pool, &id).await
}

pub async fn delete_lieferant_pharma_vorlage(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE lieferant_pharma_vorlage SET aktiv = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Vorlage".into()));
    }
    Ok(())
}
