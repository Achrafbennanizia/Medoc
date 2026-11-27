//! Folds the invoice JSON the UI sends (camelCase keys, euro amounts, loose dates) into the server shape (split from `issue.rs`).

use super::*;

pub(super) fn camel_to_snake(key: &str) -> String {
    let mut out = String::with_capacity(key.len() + 4);
    for (i, c) in key.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                out.push('_');
            }
            out.extend(c.to_lowercase());
        } else {
            out.push(c);
        }
    }
    out
}

/// Rewrite object keys to snake_case. An existing snake_case key wins when
/// both spellings are present.
pub(super) fn fold_camel_keys(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, v) in map {
                let nk = camel_to_snake(&k);
                let v = fold_camel_keys(v);
                if k != nk && out.contains_key(&nk) {
                    continue;
                }
                out.insert(nk, v);
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(fold_camel_keys).collect()),
        other => other,
    }
}

pub(super) fn json_text(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => {
            let t = s.trim();
            (!t.is_empty()).then(|| t.to_string())
        }
        Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

pub(super) fn first_text(map: &serde_json::Map<String, Value>, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|k| map.get(*k).and_then(json_text))
}

/// `YYYY-MM-DD`, a datetime starting with that, or `D.M.YYYY`.
pub(super) fn normalize_iso_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    let head: String = s.chars().take(10).collect();
    if chrono::NaiveDate::parse_from_str(&head, "%Y-%m-%d").is_ok() {
        return Some(head);
    }
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() >= 3 {
        let day: u32 = parts[0].trim().parse().ok()?;
        let month: u32 = parts[1].trim().parse().ok()?;
        let year_txt: String = parts[2].chars().take(4).collect();
        let year: i32 = year_txt.parse().ok()?;
        let date = chrono::NaiveDate::from_ymd_opt(year, month, day)?;
        return Some(date.format("%Y-%m-%d").to_string());
    }
    None
}

pub(super) fn euros_number_to_cents(value: &Value) -> Option<i64> {
    let n = match value {
        Value::Number(n) => n.as_f64()?,
        Value::String(s) => s.trim().replace(',', ".").parse().ok()?,
        _ => return None,
    };
    euros_to_cents(n)
}

/// A line may name the service as `service_name` / `label` and the price as
/// `total_cost` (euros). Map those onto the invoice fields before serde.
pub(super) fn normalize_line_object(line: &mut Value) {
    let Value::Object(map) = line else {
        return;
    };
    let description = first_text(
        map,
        &[
            "description",
            "label",
            "text",
            "service",
            "service_name",
            "kind",
        ],
    );
    if let Some(text) = description {
        let empty = map
            .get("description")
            .and_then(json_text)
            .map(|s| s.is_empty())
            .unwrap_or(true);
        if empty {
            map.insert("description".into(), Value::String(text));
        }
    }
    let raw_date = first_text(
        map,
        &["treatment_date", "date", "service_date", "created_at"],
    );
    if let Some(date) = raw_date.as_deref().and_then(normalize_iso_date) {
        map.insert("treatment_date".into(), Value::String(date));
    }
    let cents_missing = map
        .get("amount_cents")
        .and_then(|v| match v {
            Value::Number(n) => n.as_i64(),
            Value::String(s) => s.trim().parse().ok(),
            _ => None,
        })
        .unwrap_or(0)
        <= 0;
    if cents_missing {
        for key in ["total_cost", "amount", "price"] {
            if let Some(cents) = map.get(key).and_then(euros_number_to_cents) {
                map.insert("amount_cents".into(), Value::from(cents));
                break;
            }
        }
    }
}

pub(super) fn normalize_invoice_value(value: Value) -> Value {
    let mut value = fold_camel_keys(value);
    if let Value::Object(map) = &mut value {
        if let Some(date) = map
            .get("date")
            .and_then(json_text)
            .as_deref()
            .and_then(normalize_iso_date)
        {
            map.insert("date".into(), Value::String(date.clone()));
            if let Some(Value::Array(lines)) = map.get_mut("lines") {
                for line in lines.iter_mut() {
                    normalize_line_object(line);
                    if let Value::Object(row) = line {
                        let missing = row
                            .get("treatment_date")
                            .and_then(json_text)
                            .as_deref()
                            .and_then(normalize_iso_date)
                            .is_none();
                        if missing {
                            row.insert("treatment_date".into(), Value::String(date.clone()));
                        }
                    }
                }
            }
        } else if let Some(Value::Array(lines)) = map.get_mut("lines") {
            for line in lines {
                normalize_line_object(line);
            }
        }
    }
    value
}

pub(super) fn deserialize_invoice_flex<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<Invoice, D::Error> {
    let value = Value::deserialize(deserializer)?;
    serde_json::from_value(normalize_invoice_value(value)).map_err(serde::de::Error::custom)
}
