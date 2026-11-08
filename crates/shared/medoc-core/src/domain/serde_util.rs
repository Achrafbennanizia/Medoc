//! F59/F69: tell "field missing" (keep) apart from `null` (clear) in update DTOs.

use serde::{Deserialize, Deserializer};

/// Use with `#[serde(default, deserialize_with = "double_option")]` on an
/// `Option<Option<T>>`: missing → `None`, `null` → `Some(None)`, value → `Some(Some(v))`.
pub fn double_option<'de, T, D>(de: D) -> Result<Option<Option<T>>, D::Error>
where
    T: Deserialize<'de>,
    D: Deserializer<'de>,
{
    Option::<T>::deserialize(de).map(Some)
}

/// New value of an optional text column: missing keeps `existing`; `null` or a
/// blank string clears it.
pub fn patch_text(patch: &Option<Option<String>>, existing: Option<&str>) -> Option<String> {
    match patch {
        None => existing.map(str::to_string),
        Some(None) => None,
        Some(Some(v)) if v.trim().is_empty() => None,
        Some(Some(v)) => Some(v.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    struct Dto {
        #[serde(default, deserialize_with = "double_option")]
        phone: Option<Option<String>>,
    }

    #[test]
    fn missing_null_and_value_are_distinct() {
        let missing: Dto = serde_json::from_str("{}").unwrap();
        let null: Dto = serde_json::from_str(r#"{"phone":null}"#).unwrap();
        let val: Dto = serde_json::from_str(r#"{"phone":"123"}"#).unwrap();
        assert_eq!(missing.phone, None);
        assert_eq!(null.phone, Some(None));
        assert_eq!(val.phone, Some(Some("123".into())));
        assert_eq!(patch_text(&missing.phone, Some("old")), Some("old".into()));
        assert_eq!(patch_text(&null.phone, Some("old")), None);
        assert_eq!(patch_text(&Some(Some("  ".into())), Some("old")), None);
    }
}
