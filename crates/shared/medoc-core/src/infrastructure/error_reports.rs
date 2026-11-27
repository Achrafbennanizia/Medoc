//! Error reports (T7.3, docs/architecture/editions-plan.md §11.4): built, sent nowhere yet.
//!
//! Every error the UI shows with a catalogue code is counted here, grouped per code, area and day, in
//! an encrypted crash-safe cache file (`durable_cache`). Allow-list only: a code (`MD-…` or `error.…`)
//! and an area (first route segment). No message text, no names, no ids of patients or staff.
//!
//! Where reports go is a [`ReportSink`]: today the events travel inside a support file the admin sends
//! by e-mail ([`EmailSink`]); [`ServerSink`] is the later company-server channel, present but off.

use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::infrastructure::durable_cache;

const CACHE: &str = "error-events";
/// Kept this long, then dropped.
const KEEP_DAYS: i64 = 30;
const MAX_EVENTS: usize = 500;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
    pub code: String,
    pub area: String,
    /// `YYYY-MM-DD` (UTC).
    pub day: String,
    pub count: u32,
}

/// `MD-APP-003` or `error.guest.disabled`; anything else becomes `other`.
pub fn allowed_code(raw: &str) -> String {
    let c = raw.trim();
    let md = c.starts_with("MD-")
        && c.len() <= 16
        && c[3..]
            .chars()
            .all(|ch| ch.is_ascii_uppercase() || ch.is_ascii_digit() || ch == '-');
    let key = c.starts_with("error.")
        && c.len() <= 80
        && c.chars()
            .all(|ch| ch.is_ascii_lowercase() || ch.is_ascii_digit() || ch == '.' || ch == '_');
    if md || key {
        c.to_string()
    } else {
        "other".into()
    }
}

/// First route segment (`/patients/abc` → `patients`): never an id.
pub fn area_of(route: &str) -> String {
    let seg = route
        .trim_start_matches('/')
        .split(['/', '?'])
        .next()
        .unwrap_or("");
    if seg.is_empty() {
        return "home".into();
    }
    if seg.len() <= 32 && seg.chars().all(|c| c.is_ascii_lowercase() || c == '-') {
        seg.to_string()
    } else {
        "other".into()
    }
}

fn add(
    mut events: Vec<ErrorEvent>,
    code: &str,
    area: &str,
    today: chrono::NaiveDate,
) -> Vec<ErrorEvent> {
    let day = today.format("%Y-%m-%d").to_string();
    let cutoff = (today - chrono::Duration::days(KEEP_DAYS))
        .format("%Y-%m-%d")
        .to_string();
    events.retain(|e| e.day > cutoff);
    if let Some(e) = events
        .iter_mut()
        .find(|e| e.code == code && e.area == area && e.day == day)
    {
        e.count = e.count.saturating_add(1);
    } else if events.len() < MAX_EVENTS {
        events.push(ErrorEvent {
            code: code.into(),
            area: area.into(),
            day,
            count: 1,
        });
    }
    events
}

/// Counts one error. Best effort: reporting must never break the app.
pub fn record(raw_code: &str, route: &str) {
    if !durable_cache::enabled() {
        return;
    }
    let events: Vec<ErrorEvent> = durable_cache::read(CACHE)
        .ok()
        .flatten()
        .unwrap_or_default();
    let next = add(
        events,
        &allowed_code(raw_code),
        &area_of(route),
        chrono::Utc::now().date_naive(),
    );
    let _ = durable_cache::write(CACHE, &next);
}

/// The last 30 days, newest first.
pub fn recent() -> Vec<ErrorEvent> {
    let mut events: Vec<ErrorEvent> = durable_cache::read(CACHE)
        .ok()
        .flatten()
        .unwrap_or_default();
    events.sort_by(|a, b| b.day.cmp(&a.day).then(b.count.cmp(&a.count)));
    events
}

/// Error count per area over the last `days` days (health summary, §11.5), largest first.
pub fn counts_by_area(
    events: &[ErrorEvent],
    today: chrono::NaiveDate,
    days: i64,
) -> Vec<(String, u32)> {
    let cutoff = (today - chrono::Duration::days(days))
        .format("%Y-%m-%d")
        .to_string();
    let mut by: std::collections::BTreeMap<String, u32> = std::collections::BTreeMap::new();
    for e in events.iter().filter(|e| e.day > cutoff) {
        *by.entry(e.area.clone()).or_default() += e.count;
    }
    let mut out: Vec<(String, u32)> = by.into_iter().collect();
    out.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    out
}

/// Where a sealed report goes.
pub trait ReportSink {
    fn name(&self) -> &'static str;
    /// Off until the channel exists and the practice opted in.
    fn enabled(&self) -> bool;
    fn send(&self, sealed: &[u8]) -> Result<(), AppError>;
}

/// Today: reports ride inside the support file the admin e-mails (`support_bundle`), so this sink has
/// nothing to send on its own.
pub struct EmailSink;

impl ReportSink for EmailSink {
    fn name(&self) -> &'static str {
        "email"
    }
    fn enabled(&self) -> bool {
        true
    }
    fn send(&self, _sealed: &[u8]) -> Result<(), AppError> {
        Ok(())
    }
}

/// Later: HTTPS to the company server, daily, after the practice opts in (Settings → Privacy).
pub struct ServerSink;

impl ReportSink for ServerSink {
    fn name(&self) -> &'static str {
        "server"
    }
    fn enabled(&self) -> bool {
        false
    }
    fn send(&self, _sealed: &[u8]) -> Result<(), AppError> {
        Err(AppError::Conflict(
            "error reports to the MeDoc server are not available yet".into(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_codes_and_route_names_are_kept() {
        assert_eq!(allowed_code("MD-APP-003"), "MD-APP-003");
        assert_eq!(allowed_code("error.guest.disabled"), "error.guest.disabled");
        assert_eq!(allowed_code("Patient Anna Müller not found"), "other");
        assert_eq!(area_of("/patients/3f9a21c0/chart"), "patients");
        assert_eq!(area_of("/"), "home");
        assert_eq!(area_of("/3f9a21c0-1b2c"), "other");
    }

    #[test]
    fn events_are_counted_per_code_area_and_day_and_expire() {
        let d = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        let mut ev = add(Vec::new(), "MD-APP-003", "patients", d("2026-11-01"));
        ev = add(ev, "MD-APP-003", "patients", d("2026-11-01"));
        ev = add(ev, "MD-APP-003", "patients", d("2026-11-02"));
        assert_eq!(ev.len(), 2);
        assert_eq!(ev[0].count, 2);
        let later = add(ev, "MD-PAY-004", "finance", d("2026-12-05"));
        assert_eq!(later.len(), 1, "events older than 30 days are dropped");
    }

    #[test]
    fn counts_per_area_cover_the_last_seven_days() {
        let d = |s: &str| chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();
        let mut ev = add(Vec::new(), "MD-APP-003", "patients", d("2026-11-10"));
        ev = add(ev, "MD-APP-004", "patients", d("2026-11-20"));
        ev = add(ev, "MD-APP-004", "patients", d("2026-11-21"));
        ev = add(ev, "MD-PAY-001", "finance", d("2026-11-21"));
        let counts = counts_by_area(&ev, d("2026-11-21"), 7);
        assert_eq!(counts, vec![("patients".into(), 2), ("finance".into(), 1)]);
    }

    #[test]
    fn the_server_sink_is_off() {
        assert!(!ServerSink.enabled());
        assert!(ServerSink.send(b"x").is_err());
        assert!(EmailSink.enabled());
    }
}
