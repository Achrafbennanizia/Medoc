//! Practice-wide rows: absences / working calendar and reusable document templates.
use crate::error::AppError;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Absence {
    pub id: String,
    pub kind: String,
    pub comment: Option<String>,
    pub from_day: String,
    pub to_day: String,
    pub from_time: Option<String>,
    pub to_time: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateAbsence {
    pub kind: String,
    pub comment: Option<String>,
    pub from_day: String,
    pub to_day: String,
    pub from_time: Option<String>,
    pub to_time: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAbsence {
    pub kind: Option<String>,
    pub comment: Option<String>,
    pub from_day: Option<String>,
    pub to_day: Option<String>,
    pub from_time: Option<String>,
    pub to_time: Option<String>,
}

pub async fn list_absences(pool: &SqlitePool) -> Result<Vec<Absence>, AppError> {
    let rows = sqlx::query_as::<_, Absence>(
        "SELECT * FROM absence ORDER BY from_day DESC, created_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_absence(
    pool: &SqlitePool,
    data: &CreateAbsence,
) -> Result<Absence, AppError> {
    if data.kind.trim().is_empty() {
        return Err(AppError::validation_code("error.master.type_required"));
    }
    if data.from_day.trim().is_empty() || data.to_day.trim().is_empty() {
        return Err(AppError::validation_code("error.master.date_range_required"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO absence (id, kind, comment, from_day, to_day, from_time, to_time)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(data.kind.trim())
    .bind(
        data.comment
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty()),
    )
    .bind(data.from_day.trim())
    .bind(data.to_day.trim())
    .bind(
        data.from_time
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty()),
    )
    .bind(
        data.to_time
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty()),
    )
    .execute(pool)
    .await?;
    find_absence_by_id(pool, &id).await
}

pub async fn find_absence_by_id(pool: &SqlitePool, id: &str) -> Result<Absence, AppError> {
    sqlx::query_as::<_, Absence>("SELECT * FROM absence WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("error.entity.absence".into()))
}

pub async fn update_absence(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateAbsence,
) -> Result<Absence, AppError> {
    let existing = find_absence_by_id(pool, id).await?;
    let kind = data
        .kind
        .as_deref()
        .unwrap_or(&existing.kind)
        .trim()
        .to_string();
    if kind.is_empty() {
        return Err(AppError::validation_code("error.master.type_required"));
    }
    let comment = match &data.comment {
        None => existing.comment.clone(),
        Some(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
    };
    let from_day = data
        .from_day
        .as_deref()
        .unwrap_or(&existing.from_day)
        .trim()
        .to_string();
    let to_day = data
        .to_day
        .as_deref()
        .unwrap_or(&existing.to_day)
        .trim()
        .to_string();
    if from_day.is_empty() || to_day.is_empty() {
        return Err(AppError::validation_code("error.master.date_range_required"));
    }
    let from_time = match &data.from_time {
        None => existing.from_time.clone(),
        Some(s) => {
            let t = s.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        }
    };
    let to_time = match &data.to_time {
        None => existing.to_time.clone(),
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
        "UPDATE absence SET kind = ?1, comment = ?2, from_day = ?3, to_day = ?4,
         from_time = ?5, to_time = ?6, updated_at = CURRENT_TIMESTAMP WHERE id = ?7",
    )
    .bind(&kind)
    .bind(&comment)
    .bind(&from_day)
    .bind(&to_day)
    .bind(&from_time)
    .bind(&to_time)
    .bind(id)
    .execute(pool)
    .await?;
    find_absence_by_id(pool, id).await
}

pub async fn delete_absence(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM absence WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Absence".into()));
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DocumentTemplate {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub payload: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateDocumentTemplate {
    pub kind: String,
    pub title: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDocumentTemplate {
    pub title: Option<String>,
    pub payload: Option<serde_json::Value>,
}

pub async fn list_document_templates(pool: &SqlitePool) -> Result<Vec<DocumentTemplate>, AppError> {
    let rows =
        sqlx::query_as::<_, DocumentTemplate>("SELECT * FROM document_template ORDER BY kind, title")
            .fetch_all(pool)
            .await?;
    Ok(rows)
}

fn normalize_document_template_kind(kind: &str) -> Option<&'static str> {
    match kind.trim().to_ascii_uppercase().as_str() {
        "PRESCRIPTION" | "REZEPT" => Some("PRESCRIPTION"),
        "CERTIFICATE" | "ATTEST" => Some("CERTIFICATE"),
        _ => None,
    }
}

pub async fn create_document_template(
    pool: &SqlitePool,
    data: &CreateDocumentTemplate,
) -> Result<DocumentTemplate, AppError> {
    let kind = match normalize_document_template_kind(&data.kind) {
        Some(k) => k.to_string(),
        None => return Err(AppError::validation_code("error.master.template_kind_invalid")),
    };
    if data.title.trim().is_empty() {
        return Err(AppError::validation_code("error.master.title_required"));
    }
    let payload_str =
        serde_json::to_string(&data.payload).map_err(|e| AppError::Internal(e.to_string()))?;
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO document_template (id, kind, title, payload) VALUES (?1, ?2, ?3, ?4)")
        .bind(&id)
        .bind(&kind)
        .bind(data.title.trim())
        .bind(&payload_str)
        .execute(pool)
        .await?;
    find_document_template_by_id(pool, &id).await
}

pub async fn find_document_template_by_id(
    pool: &SqlitePool,
    id: &str,
) -> Result<DocumentTemplate, AppError> {
    sqlx::query_as::<_, DocumentTemplate>("SELECT * FROM document_template WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("DocumentTemplate".into()))
}

pub async fn update_document_template(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateDocumentTemplate,
) -> Result<DocumentTemplate, AppError> {
    let existing = find_document_template_by_id(pool, id).await?;
    let title = data
        .title
        .as_deref()
        .unwrap_or(&existing.title)
        .trim()
        .to_string();
    if title.is_empty() {
        return Err(AppError::validation_code("error.master.title_required"));
    }
    let payload_str = if let Some(p) = &data.payload {
        serde_json::to_string(p).map_err(|e| AppError::Internal(e.to_string()))?
    } else {
        existing.payload.clone()
    };
    sqlx::query(
        "UPDATE document_template SET title = ?1, payload = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
    )
    .bind(&title)
    .bind(&payload_str)
    .bind(id)
    .execute(pool)
    .await?;
    find_document_template_by_id(pool, id).await
}

pub async fn delete_document_template(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("DELETE FROM document_template WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("DocumentTemplate".into()));
    }
    Ok(())
}

// --- Treatment catalog (admin → predefined services) ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TreatmentCatalogItem {
    pub id: String,
    pub category: String,
    pub name: String,
    pub default_cost: Option<f64>,
    pub sort_order: i64,
    pub active: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateTreatmentCatalogItem {
    pub category: String,
    pub name: String,
    pub default_cost: Option<f64>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTreatmentCatalogItem {
    pub category: String,
    pub name: String,
    pub default_cost: Option<f64>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

pub async fn list_treatment_catalog(
    pool: &SqlitePool,
) -> Result<Vec<TreatmentCatalogItem>, AppError> {
    let rows = sqlx::query_as::<_, TreatmentCatalogItem>(
        "SELECT * FROM treatment_catalog WHERE active = 1 ORDER BY category, sort_order, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create_treatment_catalog_item(
    pool: &SqlitePool,
    data: &CreateTreatmentCatalogItem,
) -> Result<TreatmentCatalogItem, AppError> {
    if data.category.trim().is_empty() || data.name.trim().is_empty() {
        return Err(AppError::validation_code("error.master.category_name_required"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO treatment_catalog (id, category, name, default_cost, sort_order, active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
    )
    .bind(&id)
    .bind(data.category.trim())
    .bind(data.name.trim())
    .bind(data.default_cost)
    .bind(sort)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, TreatmentCatalogItem>("SELECT * FROM treatment_catalog WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn update_treatment_catalog_item(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateTreatmentCatalogItem,
) -> Result<TreatmentCatalogItem, AppError> {
    if data.category.trim().is_empty() || data.name.trim().is_empty() {
        return Err(AppError::validation_code("error.master.category_name_required"));
    }
    let sort = data.sort_order.unwrap_or(0);
    let r = sqlx::query(
        "UPDATE treatment_catalog SET category = ?1, name = ?2, default_cost = ?3, sort_order = ?4 WHERE id = ?5 AND active = 1",
    )
    .bind(data.category.trim())
    .bind(data.name.trim())
    .bind(data.default_cost)
    .bind(sort)
    .bind(id)
    .execute(pool)
    .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Katalogeintrag".into()));
    }
    sqlx::query_as::<_, TreatmentCatalogItem>("SELECT * FROM treatment_catalog WHERE id = ?1")
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_treatment_catalog_item(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE treatment_catalog SET active = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Katalogeintrag".into()));
    }
    Ok(())
}

// --- Order master data: supplier / pharma rep (admin) + combo for "New order" ---

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SupplierMasterRow {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub active: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PharmaConsultantMasterRow {
    pub id: String,
    pub name: String,
    pub sort_order: i64,
    pub active: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SupplierPharmaTemplateRow {
    pub id: String,
    pub supplier_id: String,
    pub pharma_consultant_id: String,
    pub product_id: String,
    pub supplier_name: String,
    pub pharma_consultant_name: String,
    pub product_name: String,
    pub product_category: String,
    pub product_price: f64,
    pub product_active: i64,
    pub sort_order: i64,
    pub active: i64,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplierMaster {
    pub name: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePharmaConsultantMaster {
    pub name: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplierPharmaTemplate {
    pub supplier_id: String,
    pub pharma_consultant_id: String,
    pub product_id: String,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

pub async fn list_supplier_master(pool: &SqlitePool) -> Result<Vec<SupplierMasterRow>, AppError> {
    sqlx::query_as::<_, SupplierMasterRow>(
        "SELECT * FROM supplier_master WHERE active = 1 ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_supplier_master(
    pool: &SqlitePool,
    data: &CreateSupplierMaster,
) -> Result<SupplierMasterRow, AppError> {
    let name = data.name.trim();
    if name.is_empty() {
        return Err(AppError::validation_code("error.master.supplier_name_required"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query("INSERT INTO supplier_master (id, name, sort_order, active) VALUES (?1, ?2, ?3, 1)")
        .bind(&id)
        .bind(name)
        .bind(sort)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, SupplierMasterRow>("SELECT * FROM supplier_master WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_supplier_master(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE supplier_master SET active = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Supplier".into()));
    }
    sqlx::query("UPDATE supplier_pharma_template SET active = 0 WHERE supplier_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_pharma_consultant_master(
    pool: &SqlitePool,
) -> Result<Vec<PharmaConsultantMasterRow>, AppError> {
    sqlx::query_as::<_, PharmaConsultantMasterRow>(
        "SELECT * FROM pharma_consultant_master WHERE active = 1 ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_pharma_consultant_master(
    pool: &SqlitePool,
    data: &CreatePharmaConsultantMaster,
) -> Result<PharmaConsultantMasterRow, AppError> {
    let name = data.name.trim();
    if name.is_empty() {
        return Err(AppError::validation_code("error.master.contact_name_required"));
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO pharma_consultant_master (id, name, sort_order, active) VALUES (?1, ?2, ?3, 1)",
    )
    .bind(&id)
    .bind(name)
    .bind(sort)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, PharmaConsultantMasterRow>("SELECT * FROM pharma_consultant_master WHERE id = ?1")
        .bind(&id)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)
}

pub async fn delete_pharma_consultant_master(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE pharma_consultant_master SET active = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Kontakt".into()));
    }
    sqlx::query("UPDATE supplier_pharma_template SET active = 0 WHERE pharma_consultant_id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_supplier_pharma_templates(
    pool: &SqlitePool,
) -> Result<Vec<SupplierPharmaTemplateRow>, AppError> {
    let rows = sqlx::query_as::<_, SupplierPharmaTemplateRow>(
        "SELECT
            version.id,
            version.supplier_id,
            version.pharma_consultant_id,
            version.product_id,
            l.name AS supplier_name,
            p.name AS pharma_consultant_name,
            pr.name AS product_name,
            pr.category AS product_category,
            pr.price AS product_price,
            pr.active AS product_active,
            version.sort_order,
            version.active,
            version.created_at
         FROM supplier_pharma_template version
         JOIN supplier_master l ON l.id = version.supplier_id
         JOIN pharma_consultant_master p ON p.id = version.pharma_consultant_id
         JOIN product pr ON pr.id = version.product_id
         WHERE version.active = 1 AND l.active = 1 AND p.active = 1
         ORDER BY version.sort_order, l.name, p.name, pr.name",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;
    Ok(rows)
}

async fn fetch_template_row(
    pool: &SqlitePool,
    vid: &str,
) -> Result<SupplierPharmaTemplateRow, AppError> {
    sqlx::query_as::<_, SupplierPharmaTemplateRow>(
        "SELECT
            version.id,
            version.supplier_id,
            version.pharma_consultant_id,
            version.product_id,
            l.name AS supplier_name,
            p.name AS pharma_consultant_name,
            pr.name AS product_name,
            pr.category AS product_category,
            pr.price AS product_price,
            pr.active AS product_active,
            version.sort_order,
            version.active,
            version.created_at
         FROM supplier_pharma_template version
         JOIN supplier_master l ON l.id = version.supplier_id
         JOIN pharma_consultant_master p ON p.id = version.pharma_consultant_id
         JOIN product pr ON pr.id = version.product_id
         WHERE version.id = ?1",
    )
    .bind(vid)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

pub async fn create_supplier_pharma_template(
    pool: &SqlitePool,
    data: &CreateSupplierPharmaTemplate,
) -> Result<SupplierPharmaTemplateRow, AppError> {
    let lid = data.supplier_id.trim();
    let pid = data.pharma_consultant_id.trim();
    let prid = data.product_id.trim();
    if lid.is_empty() || pid.is_empty() || prid.is_empty() {
        return Err(AppError::validation_code("error.master.order_fields_required"));
    }
    let l_ok: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM supplier_master WHERE id = ?1 AND active = 1")
            .bind(lid)
            .fetch_one(pool)
            .await
            .map_err(AppError::from)?;
    if l_ok.0 == 0 {
        return Err(AppError::validation_code("error.master.invalid_supplier"));
    }
    let p_ok: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pharma_consultant_master WHERE id = ?1 AND active = 1")
            .bind(pid)
            .fetch_one(pool)
            .await
            .map_err(AppError::from)?;
    if p_ok.0 == 0 {
        return Err(AppError::validation_code("error.master.invalid_contact"));
    }
    let pr_ok: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM product WHERE id = ?1 AND active = 1")
        .bind(prid)
        .fetch_one(pool)
        .await
        .map_err(AppError::from)?;
    if pr_ok.0 == 0 {
        return Err(AppError::validation_code("error.master.invalid_product"));
    }
    // Existing triple (incl. soft-deleted): reactivate or return
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT id, active FROM supplier_pharma_template WHERE supplier_id = ?1 AND pharma_consultant_id = ?2 AND product_id = ?3",
    )
    .bind(lid)
    .bind(pid)
    .bind(prid)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;
    if let Some((eid, active)) = existing {
        if active == 0 {
            sqlx::query(
                "UPDATE supplier_pharma_template SET active = 1, sort_order = ?2 WHERE id = ?1",
            )
            .bind(&eid)
            .bind(data.sort_order.unwrap_or(0))
            .execute(pool)
            .await?;
        }
        return fetch_template_row(pool, &eid).await;
    }
    let id = uuid::Uuid::new_v4().to_string();
    let sort = data.sort_order.unwrap_or(0);
    sqlx::query(
        "INSERT INTO supplier_pharma_template (id, supplier_id, pharma_consultant_id, product_id, sort_order, active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
    )
    .bind(&id)
    .bind(lid)
    .bind(pid)
    .bind(prid)
    .bind(sort)
    .execute(pool)
    .await?;
    fetch_template_row(pool, &id).await
}

pub async fn delete_supplier_pharma_template(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    let r = sqlx::query("UPDATE supplier_pharma_template SET active = 0 WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    if r.rows_affected() == 0 {
        return Err(AppError::NotFound("Template".into()));
    }
    Ok(())
}
