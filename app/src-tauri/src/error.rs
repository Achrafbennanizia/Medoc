use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Nicht autorisiert")]
    Unauthorized,

    #[error("Zu viele Fehlversuche — bitte {0} Sekunden warten")]
    RateLimited(u64),

    #[error("Zugriff verweigert")]
    Forbidden,

    #[error("{0} nicht gefunden")]
    NotFound(String),

    #[error("Konflikt: {0}")]
    Conflict(String),

    #[error("Validierungsfehler: {0}")]
    Validation(String),

    #[error("Datenbankfehler: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Interner Fehler: {0}")]
    Internal(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
