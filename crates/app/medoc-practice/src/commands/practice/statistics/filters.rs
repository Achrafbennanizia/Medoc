//! Optional treatment-kind and payment-method filters for the statistics overview.

#[derive(Debug, Clone, Default)]
pub struct StatsFilters {
    pub treatment_kind: Option<String>,
    pub payment_method: Option<String>,
}

impl StatsFilters {
    pub fn from_opts(treatment_kind: Option<String>, payment_method: Option<String>) -> Self {
        Self {
            treatment_kind: treatment_kind.filter(|s| !s.trim().is_empty()),
            payment_method: payment_method.filter(|s| !s.trim().is_empty()),
        }
    }

    pub fn treatment_clause(&self, placeholder: usize) -> String {
        self.treatment_kind
            .as_ref()
            .map(|_| format!(" AND COALESCE(NULLIF(category,''), kind) = ?{placeholder}"))
            .unwrap_or_default()
    }

    pub fn payment_clause(&self, placeholder: usize) -> String {
        self.payment_method
            .as_ref()
            .map(|_| format!(" AND payment_method = ?{placeholder}"))
            .unwrap_or_default()
    }

}