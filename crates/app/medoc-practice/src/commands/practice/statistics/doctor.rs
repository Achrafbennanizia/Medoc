//! Doctor dimension of the statistics (T5.6, Cabinet+): which doctors a query covers and the
//! per-doctor comparison. Without the doctor dimension (Essentiel, Cabinet) it adds nothing.

use serde::Serialize;
use sqlx::SqlitePool;

use crate::error::AppError;

/// T5.6 (Group): which doctors' figures a statistics query covers. Without the doctor
/// dimension (Solo, Duo) it adds nothing.
#[derive(Debug, Clone, Default)]
pub(super) struct DoctorScope {
    /// Only this doctor.
    pub(super) only: Option<String>,
    /// Doctors who do not share their statistics with this person (left out of the figures).
    pub(super) hidden: Vec<String>,
}

impl DoctorScope {
    /// ` AND <col> …` with numbered placeholders from `?{first}` on (sqlx counts a bare `?` from 1
    /// even after `?1`, so they must be numbered); pair with [`DoctorScope::binds`].
    pub(super) fn clause(&self, col: &str, first: usize) -> String {
        let mut out = String::new();
        let mut n = first;
        if self.only.is_some() {
            out.push_str(&format!(" AND {col} = ?{n}"));
            n += 1;
        }
        if !self.hidden.is_empty() {
            let marks: Vec<String> = (n..n + self.hidden.len()).map(|i| format!("?{i}")).collect();
            out.push_str(&format!(" AND ({col} IS NULL OR {col} NOT IN ({}))", marks.join(", ")));
        }
        out
    }

    fn binds(&self) -> Vec<String> {
        self.only.iter().cloned().chain(self.hidden.iter().cloned()).collect()
    }
}

/// Bind the scope's values after the query's own.
pub(super) fn scoped<'q, O>(
    mut q: sqlx::query::QueryAs<'q, sqlx::Sqlite, O, sqlx::sqlite::SqliteArguments<'q>>,
    scope: &DoctorScope,
) -> sqlx::query::QueryAs<'q, sqlx::Sqlite, O, sqlx::sqlite::SqliteArguments<'q>> {
    for b in scope.binds() {
        q = q.bind(b);
    }
    q
}

#[cfg(feature = "cap-allowances")]
pub(super) async fn doctor_scope(
    pool: &SqlitePool,
    session: &medoc_core::application::auth_service::Session,
    doctor_id: Option<String>,
) -> Result<DoctorScope, AppError> {
    use medoc_core::application::allowances::{self, ScopeFilter};
    use medoc_core::domain::allowances::ShareArea;
    let viewer = allowances::viewer_of(pool, session).await?;
    let filter = ScopeFilter::load(pool, viewer, ShareArea::Statistics, "statistics").await?;
    let hidden = filter.hidden_owners();
    let only = doctor_id.filter(|d| !d.trim().is_empty());
    if only.as_ref().is_some_and(|d| hidden.contains(d)) {
        return Err(AppError::validation_code("error.access.not_allowed_by_owner"));
    }
    Ok(DoctorScope { only, hidden })
}

#[cfg(not(feature = "cap-allowances"))]
pub(super) async fn doctor_scope(
    _pool: &SqlitePool,
    _session: &medoc_core::application::auth_service::Session,
    _doctor_id: Option<String>,
) -> Result<DoctorScope, AppError> {
    Ok(DoctorScope::default())
}

/// One doctor's last 12 months, for the comparison table (Group).
#[derive(Debug, Serialize, Clone)]
pub struct DoctorFigures {
    pub staff_id: String,
    pub name: String,
    pub appointments: i64,
    pub treatments: i64,
    pub income: Option<f64>,
}

/// Last 12 months per doctor the viewer may see; empty with fewer than two.
pub(super) async fn per_doctor(
    pool: &SqlitePool,
    scope: &DoctorScope,
    allowed: &(dyn Fn(&str) -> bool + Sync),
    earliest_start: &str,
    earliest_utc: &str,
) -> Result<Vec<DoctorFigures>, AppError> {
    let mut out = Vec::new();
    let doctors: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM staff WHERE UPPER(role) = 'PHYSICIAN' ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    let visible: Vec<(String, String)> = doctors
        .into_iter()
        .filter(|(id, _)| !scope.hidden.contains(id))
        .collect();
    if visible.len() >= 2 {
        for (id, name) in visible {
            let appointments = if allowed("appointment.read") {
                sqlx::query_scalar(
                    "SELECT COUNT(*) FROM appointment WHERE physician_id = ?1 AND date >= ?2
                       AND status NOT IN ('CANCELLED', 'NO_SHOW')",
                )
                .bind(&id)
                .bind(&earliest_start)
                .fetch_one(pool)
                .await?
            } else {
                0
            };
            let treatments = if allowed("patient.read_medical") {
                sqlx::query_scalar(
                    "SELECT COUNT(*) FROM treatment WHERE responsible_staff_id = ?1
                       AND COALESCE(treatment_date, created_at) >= ?2",
                )
                .bind(&id)
                .bind(&earliest_start)
                .fetch_one(pool)
                .await?
            } else {
                0
            };
            let income = if allowed("finance.read") {
                Some(
                    sqlx::query_scalar::<_, f64>(
                        "SELECT CAST(COALESCE(SUM(amount), 0) AS REAL) FROM payment
                         WHERE for_staff_id = ?1 AND status IN ('PAID','PARTIALLY_PAID')
                           AND julianday(created_at) >= julianday(?2)",
                    )
                    .bind(&id)
                    .bind(&earliest_utc)
                    .fetch_one(pool)
                    .await?,
                )
            } else {
                None
            };
            out.push(DoctorFigures {
                staff_id: id,
                name,
                appointments,
                treatments,
                income,
            });
        }
    }
    Ok(out)
}
