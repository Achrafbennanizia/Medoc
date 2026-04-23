// PII / secret sanitiser (NFA-LOG-08)
//
// Used to scrub strings before they enter a log record. Frees the rest of
// the codebase from having to remember which fields are sensitive.

use regex::Regex;
use std::sync::OnceLock;

fn token_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| {
        Regex::new(r"(?i)(password|passwort|token|secret|api[_-]?key|license|lizenz)\s*[:=]\s*\S+")
            .unwrap()
    })
}

fn jwt_re() -> &'static Regex {
    static R: OnceLock<Regex> = OnceLock::new();
    R.get_or_init(|| Regex::new(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+").unwrap())
}

/// Mask any obvious secret patterns inside a free-form string.
pub fn sanitize(input: &str) -> String {
    let masked = token_re().replace_all(input, "$1=***");
    let masked = jwt_re().replace_all(&masked, "eyJ***");
    masked.into_owned()
}

/// Mask a token-like value so only the prefix remains.
pub fn mask_token(value: &str) -> String {
    if value.len() <= 4 {
        "***".to_string()
    } else {
        format!("{}***", &value[..4])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_passwords() {
        let s = sanitize("user=alice password=hunter2 ok");
        assert!(s.contains("password=***"));
        assert!(!s.contains("hunter2"));
    }

    #[test]
    fn masks_jwt() {
        let s = sanitize("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
        assert!(s.contains("eyJ***"));
    }
}
