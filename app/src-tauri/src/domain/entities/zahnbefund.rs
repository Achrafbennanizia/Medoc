use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Zahnbefund {
    pub id: String,
    pub akte_id: String,
    pub zahn_nummer: i32,
    pub befund: String,
    pub diagnose: Option<String>,
    pub notizen: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Deserialize)]
pub struct CreateZahnbefund {
    pub akte_id: String,
    pub zahn_nummer: i32,
    pub befund: String,
    pub diagnose: Option<String>,
    pub notizen: Option<String>,
}

impl CreateZahnbefund {
    /// Validate FDI tooth numbering: quadrant 1-4, tooth 1-8
    pub fn validate_zahn_nummer(&self) -> Result<(), String> {
        let q = self.zahn_nummer / 10;
        let z = self.zahn_nummer % 10;
        if !(1..=4).contains(&q) || !(1..=8).contains(&z) {
            return Err(format!(
                "Ungültige Zahnnummer {}. FDI: Quadrant 1-4, Zahn 1-8.",
                self.zahn_nummer
            ));
        }
        Ok(())
    }
}
