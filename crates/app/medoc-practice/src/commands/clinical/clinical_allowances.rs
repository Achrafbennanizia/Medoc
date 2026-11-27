//! Group sharing rules on clinical acts (T5.1): a dentist may share their examinations and
//! treatments with everyone (default), only the other admin, chosen staff or nobody, and make a
//! single entry private. Other editions have one dentist and no rules: nothing is hidden.

use std::collections::HashSet;

use sqlx::SqlitePool;

use medoc_core::application::auth_service::Session;

use crate::error::AppError;

/// Ids of `table` rows on `chart_id` this person may not see (`table`: examination / treatment).
#[cfg(feature = "cap-allowances")]
pub async fn hidden_ids(
    pool: &SqlitePool,
    session: &Session,
    table: &'static str,
    chart_id: &str,
) -> Result<HashSet<String>, AppError> {
    use medoc_core::application::allowances::{self, ScopeFilter};
    use medoc_core::domain::allowances::{ShareArea, Sight};
    let viewer = allowances::viewer_of(pool, session).await?;
    let filter = ScopeFilter::load(pool, viewer, ShareArea::Clinical, table).await?;
    let rows: Vec<(String, Option<String>)> = sqlx::query_as(&format!(
        "SELECT id, responsible_staff_id FROM {table} WHERE chart_id = ?1"
    ))
    .bind(chart_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows
        .into_iter()
        .filter(|(id, owner)| filter.sight_of(id, owner.as_deref()) == Sight::Hidden)
        .map(|(id, _)| id)
        .collect())
}

#[cfg(not(feature = "cap-allowances"))]
pub async fn hidden_ids(
    _pool: &SqlitePool,
    _session: &Session,
    _table: &'static str,
    _chart_id: &str,
) -> Result<HashSet<String>, AppError> {
    Ok(HashSet::new())
}

/// T5.5: route the validation queue by the owners' sharing rules. A chart belongs to its responsible
/// doctor (else the patient's treating doctor); rows whose owner does not share clinical data with
/// this person are dropped, and `can_validate` follows the owner's clinical change rule.
#[cfg(feature = "cap-allowances")]
pub async fn route_validation_queue(
    pool: &SqlitePool,
    session: &Session,
    rows: Vec<crate::infrastructure::database::repos::clinical::chart::ChartToValidateRow>,
) -> Result<Vec<crate::infrastructure::database::repos::clinical::chart::ChartToValidateRow>, AppError> {
    use medoc_core::application::allowances::{self, ScopeFilter};
    use medoc_core::domain::allowances::{ShareArea, Sight};
    let viewer = allowances::viewer_of(pool, session).await?;
    let filter = ScopeFilter::load(pool, viewer.clone(), ShareArea::Clinical, "patient_chart").await?;
    let mut out = Vec::with_capacity(rows.len());
    for mut row in rows {
        let owner = row.owner_staff_id.as_deref();
        if filter.sight_of(&row.chart_id, owner) != Sight::Full {
            continue;
        }
        row.can_validate = allowances::require_change(pool, &viewer, ShareArea::Clinical, owner)
            .await
            .is_ok();
        out.push(row);
    }
    Ok(out)
}

#[cfg(not(feature = "cap-allowances"))]
pub async fn route_validation_queue(
    _pool: &SqlitePool,
    _session: &Session,
    rows: Vec<crate::infrastructure::database::repos::clinical::chart::ChartToValidateRow>,
) -> Result<Vec<crate::infrastructure::database::repos::clinical::chart::ChartToValidateRow>, AppError> {
    Ok(rows)
}

/// T5.5: validating or declining a chart is a change to its owner's clinical data.
#[cfg(feature = "cap-allowances")]
pub async fn require_validate(pool: &SqlitePool, session: &Session, patient_id: &str) -> Result<(), AppError> {
    use medoc_core::application::allowances;
    use medoc_core::domain::allowances::ShareArea;
    let owner = crate::infrastructure::database::repos::clinical::chart::chart_owner(pool, patient_id).await?;
    let viewer = allowances::viewer_of(pool, session).await?;
    allowances::require_change(pool, &viewer, ShareArea::Clinical, owner.as_deref()).await
}

#[cfg(not(feature = "cap-allowances"))]
pub async fn require_validate(_pool: &SqlitePool, _session: &Session, _patient_id: &str) -> Result<(), AppError> {
    Ok(())
}
