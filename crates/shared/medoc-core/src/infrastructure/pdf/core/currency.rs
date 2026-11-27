//! Document currency and money formatting in PDFs (split from `core.rs`).

pub(super) static DOCUMENT_CURRENCY: std::sync::Mutex<String> =
    std::sync::Mutex::new(String::new());

pub(super) const DOCUMENT_CURRENCIES: &[&str] = &[
    "EUR", "USD", "GBP", "CHF", "MAD", "CAD", "AUD", "SEK", "NOK", "DKK", "PLN", "CZK", "TND",
    "AED", "SAR",
];

pub fn is_known_currency(code: &str) -> bool {
    let next = code.trim().to_ascii_uppercase();
    DOCUMENT_CURRENCIES.contains(&next.as_str())
}

/// Practice currency for money on screen and on documents. Unknown codes stay EUR.
pub fn set_document_currency(code: &str) {
    let next = code.trim().to_ascii_uppercase();
    let next = if DOCUMENT_CURRENCIES.contains(&next.as_str()) {
        next
    } else {
        "EUR".to_string()
    };
    if let Ok(mut guard) = DOCUMENT_CURRENCY.lock() {
        *guard = next;
    }
}

pub fn document_currency() -> String {
    DOCUMENT_CURRENCY
        .lock()
        .ok()
        .map(|g| {
            if g.is_empty() {
                "EUR".to_string()
            } else {
                g.clone()
            }
        })
        .unwrap_or_else(|| "EUR".to_string())
}

/// Cent value → "1.234,56 EUR" (DIN-style, ASCII — Helvetica has no reliable € glyph).
/// The suffix is the practice currency from [`document_currency`].
pub fn format_eur(cents: i64) -> String {
    let neg = cents < 0;
    let version = cents.abs();
    let euros = version / 100;
    let frac = version % 100;
    let mut grouped = String::new();
    let s = euros.to_string();
    for (i, ch) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            grouped.push('.');
        }
        grouped.push(ch);
    }
    let euros_de: String = grouped.chars().rev().collect();
    format!(
        "{}{},{:02} {}",
        if neg { "-" } else { "" },
        euros_de,
        frac,
        document_currency()
    )
}

/// Money for a payment, invoice, or chart PDF: keep the number, end with the
/// practice currency. "120,00", "120,00 USD", and "120,00 €" all become
/// "120,00 MAD" when MAD is selected. Dates and other text are left as written.
pub fn ensure_money_currency(raw: &str) -> String {
    let sanitized = sanitize_pdf_money(raw);
    let trimmed = sanitized.trim();
    if trimmed.is_empty() || trimmed == "-" || trimmed == "—" {
        return trimmed.to_string();
    }
    let mut core = trimmed.to_string();
    if let Some(rest) = strip_known_currency_suffix(&core) {
        core = rest;
    } else if let Some(rest) = strip_known_currency_prefix(&core) {
        core = rest;
    }
    let core = core.trim();
    if !looks_like_money_number(core) {
        return trimmed.to_string();
    }
    format!("{core} {}", document_currency())
}

pub(super) fn strip_known_currency_suffix(value: &str) -> Option<String> {
    let value = value.trim_end();
    for code in DOCUMENT_CURRENCIES {
        let Some(rest) = value.strip_suffix(code) else {
            continue;
        };
        if rest
            .chars()
            .last()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        {
            continue;
        }
        return Some(rest.trim_end().to_string());
    }
    None
}

pub(super) fn strip_known_currency_prefix(value: &str) -> Option<String> {
    let value = value.trim_start();
    for code in DOCUMENT_CURRENCIES {
        let Some(rest) = value.strip_prefix(code) else {
            continue;
        };
        if rest
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_alphanumeric())
        {
            continue;
        }
        return Some(rest.trim_start().to_string());
    }
    None
}

/// "1.234,56", "1,234.56", "70.00", "-12,94". Not a date ("02.11.2026").
pub(super) fn looks_like_money_number(core: &str) -> bool {
    let t = core
        .trim()
        .trim_start_matches('+')
        .trim_start_matches('-')
        .trim();
    let (head, frac) = if let Some(pair) = t.rsplit_once(',') {
        pair
    } else if let Some(pair) = t.rsplit_once('.') {
        pair
    } else {
        return false;
    };
    frac.len() == 2
        && frac.chars().all(|c| c.is_ascii_digit())
        && !head.is_empty()
        && head.chars().any(|c| c.is_ascii_digit())
        && head
            .chars()
            .all(|c| c.is_ascii_digit() || matches!(c, '.' | ',' | ' ' | '\u{a0}'))
}

/// Make money / label text safe for Helvetica WinAnsi (no zero-width €, no NBSP).
pub fn sanitize_pdf_money(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        match c {
            '€' => {
                let code = document_currency();
                let prev = out.chars().last();
                if prev.map(|p| p.is_ascii_digit()).unwrap_or(false) {
                    if prev != Some(' ') {
                        out.push(' ');
                    }
                    out.push_str(&code);
                } else {
                    out.push_str(&code);
                    let next = chars.get(i + 1).copied();
                    if next.map(|n| n.is_ascii_digit()).unwrap_or(false) {
                        out.push(' ');
                    }
                }
            }
            '\u{00A0}' | '\u{202F}' | '\u{2007}' | '\u{2009}' => out.push(' '),
            '\u{2212}' => out.push('-'),
            other => out.push(other),
        }
        i += 1;
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}
