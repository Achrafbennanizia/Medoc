use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: String,
    pub user_id: String,
    pub action: String,
    pub entity: String,
    pub entity_id: Option<String>,
    pub details: Option<String>,
    pub prev_hash: Option<String>,
    pub hmac: String,
    pub under_break_glass: bool,
    pub break_glass_reason: Option<String>,
    pub created_at: NaiveDateTime,
}
