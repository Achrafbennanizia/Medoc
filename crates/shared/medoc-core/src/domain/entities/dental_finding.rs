use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DentalFinding {
    pub id: String,
    pub chart_id: String,
    pub tooth_number: i32,
    pub finding: String,
    pub diagnosis: Option<String>,
    pub notes: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateDentalFinding {
    pub chart_id: String,
    pub tooth_number: i32,
    pub finding: String,
    pub diagnosis: Option<String>,
    pub notes: Option<String>,
}

impl CreateDentalFinding {
    /// Validate FDI tooth numbering: quadrant 1-4, tooth 1-8
    pub fn validate_tooth_number(&self) -> Result<(), String> {
        let q = self.tooth_number / 10;
        let z = self.tooth_number % 10;
        if !(1..=4).contains(&q) || !(1..=8).contains(&z) {
            return Err(format!(
                "Invalid tooth number {}. FDI: quadrant 1-4, tooth 1-8.",
                self.tooth_number
            ));
        }
        Ok(())
    }
}
