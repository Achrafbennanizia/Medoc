//! Stripe live secret. Loaded from the environment only — never from source.

/// Environment variable for the Stripe live secret key.
pub const STRIPE_SECRET_KEY_ENV: &str = "STRIPE_SECRET_KEY";

/// Read `STRIPE_SECRET_KEY`. Missing or blank is an error. There is no built-in key.
pub fn require_stripe_secret_key() -> Result<String, String> {
    match std::env::var(STRIPE_SECRET_KEY_ENV) {
        Ok(value) => require_stripe_secret_from(Some(value.as_str())),
        Err(_) => require_stripe_secret_from(None),
    }
}

pub fn require_stripe_secret_from(value: Option<&str>) -> Result<String, String> {
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(value) => Ok(value.to_string()),
        None => Err(
            "STRIPE_SECRET_KEY is not set. Set it in the environment; there is no built-in Stripe key."
                .into(),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::{require_stripe_secret_from, require_stripe_secret_key, STRIPE_SECRET_KEY_ENV};
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn missing_or_blank_stripe_secret_is_an_error() {
        let err = require_stripe_secret_from(None).unwrap_err();
        assert!(err.contains(STRIPE_SECRET_KEY_ENV));
        assert!(require_stripe_secret_from(Some("")).is_err());
        assert!(require_stripe_secret_from(Some("   ")).is_err());
    }

    #[test]
    fn stripe_secret_is_taken_from_the_provided_value() {
        assert_eq!(
            require_stripe_secret_from(Some("  configured  ")).unwrap(),
            "configured"
        );
    }

    #[test]
    fn stripe_secret_key_reads_the_environment() {
        let _guard = ENV_LOCK.lock().expect("env lock");
        let previous = std::env::var(STRIPE_SECRET_KEY_ENV).ok();
        std::env::remove_var(STRIPE_SECRET_KEY_ENV);
        assert!(require_stripe_secret_key().is_err());
        std::env::set_var(STRIPE_SECRET_KEY_ENV, "configured");
        assert_eq!(require_stripe_secret_key().unwrap(), "configured");
        match previous {
            Some(value) => std::env::set_var(STRIPE_SECRET_KEY_ENV, value),
            None => std::env::remove_var(STRIPE_SECRET_KEY_ENV),
        }
    }
}
