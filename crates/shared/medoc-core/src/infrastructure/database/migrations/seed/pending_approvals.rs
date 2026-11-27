//! Demo charts waiting for approval (split from `seed.rs`).

use super::*;

pub(super) const PENDING_APPROVALS_KV_KEY: &str = "migration.demo_seed.pending_approvals_v1";

/// Demo patients + charts in DRAFT / IN_PROGRESS for the physician validation queue.
/// Does not overwrite charts the operator already validated on a later start.
pub(super) async fn ensure_demo_pending_approval_charts(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO patient (id, name, date_of_birth, sex, insurance_number, phone, email, address, status) VALUES
        ('seed-pat-009','Tom Hughes','1982-08-14','MALE','AOK-1000009','+49 151 2000009','tom.hughes@medoc-demo.de','Ostertorsteinweg 18, 28203 Bremen','ACTIVE'),
        ('seed-pat-010','Nora Ali','1995-02-27','FEMALE','TK-1000010','+49 152 2000010','nora.ali@medoc-demo.de','Findorffstr. 7, 28215 Bremen','NEW'),
        ('seed-pat-011','Paul Richter','1971-11-03','MALE','BKK-1000011','+49 160 2000011','paul.richter@medoc-demo.de','Humboldtstr. 22, 28203 Bremen','ACTIVE'),
        ('seed-pat-012','Yara Hassan','1989-05-19','FEMALE','IKK-1000012','+49 172 2000012','yara.hassan@medoc-demo.de','Utbremner Str. 5, 28217 Bremen','NEW')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "INSERT OR IGNORE INTO patient_chart (id, patient_id, status, diagnosis, findings) VALUES
        ('seed-chart-009','seed-pat-009','DRAFT','Crown prep 16','Prep done, impression pending physician sign-off'),
        ('seed-chart-010','seed-pat-010','IN_PROGRESS','Endodontic treatment 36','Working length confirmed, awaiting fill and validation'),
        ('seed-chart-011','seed-pat-011','DRAFT','Extraction 48','Surgical notes drafted for physician review'),
        ('seed-chart-012','seed-pat-012','IN_PROGRESS','Composite 24/25','Rubber dam, layering complete, polish pending validation')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let already: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(PENDING_APPROVALS_KV_KEY)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    if already.is_none() {
        // One-shot: put the original named demo charts back on the queue when an
        // older demo DB had already marked them VALIDATED / READONLY.
        sqlx::query(
            "UPDATE patient_chart SET status = 'DRAFT', updated_at = CURRENT_TIMESTAMP
             WHERE id IN ('seed-chart-001', 'seed-chart-006')
               AND status NOT IN ('DRAFT', 'IN_PROGRESS')",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "UPDATE patient_chart SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP
             WHERE id IN ('seed-chart-002', 'seed-chart-005', 'seed-chart-007')
               AND status NOT IN ('DRAFT', 'IN_PROGRESS')",
        )
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, '1', CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
        )
        .bind(PENDING_APPROVALS_KV_KEY)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}
