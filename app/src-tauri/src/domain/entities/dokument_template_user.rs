use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DokumentTemplateUser {
    pub id: String,
    pub kind: String,
    pub name: String,
    pub payload: String,
    pub is_default: i64,
    pub created_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
