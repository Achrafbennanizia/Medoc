//! Heuristics for suspicious device sessions (Settings → Device sessions).
use chrono::{NaiveDateTime, Utc};
use serde::Serialize;

/// Row shape used for risk assessment (matches repo + IPC).
#[derive(Debug, Clone, Serialize)]
pub struct DeviceSessionRiskInput {
    pub id: String,
    pub user_id: String,
    pub device_label: String,
    pub user_agent: Option<String>,
    pub created_at: String,
    pub last_seen_at: String,
    pub is_current: bool,
    pub is_trusted: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct DeviceSessionRiskAssessment {
    pub is_suspected: bool,
    pub suspected_reasons: Vec<String>,
}

/// Non-current session inactive longer than this is flagged as stale.
pub const STALE_INACTIVE_HOURS: i64 = 24;
/// Total active sessions above this threshold triggers a bulk-risk reason.
pub const HIGH_ACTIVE_SESSION_COUNT: usize = 5;

fn parse_sqlite_datetime(raw: &str) -> Option<NaiveDateTime> {
    NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S")
        .ok()
        .or_else(|| NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M").ok())
}

fn hours_since_last_seen(last_seen_at: &str, now: NaiveDateTime) -> Option<i64> {
    let seen = parse_sqlite_datetime(last_seen_at)?;
    Some((now - seen).num_hours())
}

/// Assess whether a single session looks suspicious relative to sibling sessions.
pub fn assess_session(
    row: &DeviceSessionRiskInput,
    peers: &[DeviceSessionRiskInput],
    now: NaiveDateTime,
) -> DeviceSessionRiskAssessment {
    if row.is_current || row.is_trusted {
        return DeviceSessionRiskAssessment::default();
    }

    let mut reasons = Vec::new();

    if let Some(hours) = hours_since_last_seen(&row.last_seen_at, now) {
        if hours >= STALE_INACTIVE_HOURS {
            reasons.push(format!(
                "No activity for {hours} hours (threshold: {STALE_INACTIVE_HOURS} h)"
            ));
        }
    }

    let label = row.device_label.trim();
    if !label.is_empty() {
        let same_label = peers
            .iter()
            .filter(|p| p.device_label.trim() == label)
            .count();
        if same_label > 1 {
            reasons.push(format!(
                "{same_label} active sessions with the same device name \"{label}\""
            ));
        }
    }

    let ua = row.user_agent.as_deref().unwrap_or("").trim();
    if ua.is_empty() {
        reasons.push("No user-agent — origin unclear".into());
    }

    if peers.len() > HIGH_ACTIVE_SESSION_COUNT {
        reasons.push(format!(
            "Unusually many active sessions ({})",
            peers.len()
        ));
    }

    DeviceSessionRiskAssessment {
        is_suspected: !reasons.is_empty(),
        suspected_reasons: reasons,
    }
}

/// Apply risk flags to every row (mutates assessments in parallel vectors).
pub fn enrich_sessions<T>(rows: &mut [T], map: impl Fn(&T) -> DeviceSessionRiskInput)
where
    T: DeviceSessionRiskMut,
{
    let inputs: Vec<DeviceSessionRiskInput> = rows.iter().map(map).collect();
    let now = Utc::now().naive_utc();
    for (row, input) in rows.iter_mut().zip(inputs.iter()) {
        let assessment = assess_session(input, &inputs, now);
        row.set_risk(assessment);
    }
}

/// Trait for repo rows / DTOs that receive risk enrichment.
pub trait DeviceSessionRiskMut {
    fn set_risk(&mut self, assessment: DeviceSessionRiskAssessment);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(
        id: &str,
        label: &str,
        last_seen: &str,
        is_current: bool,
        is_trusted: bool,
    ) -> DeviceSessionRiskInput {
        DeviceSessionRiskInput {
            id: id.into(),
            user_id: "u1".into(),
            device_label: label.into(),
            user_agent: Some("Mozilla/5.0".into()),
            created_at: "2026-01-01 10:00:00".into(),
            last_seen_at: last_seen.into(),
            is_current,
            is_trusted,
        }
    }

    #[test]
    fn current_session_never_suspected() {
        let now =
            NaiveDateTime::parse_from_str("2026-06-10 15:00:00", "%Y-%m-%d %H:%M:%S").unwrap();
        let r = row("a", "MeDoc", "2026-06-10 14:00:00", true, false);
        let a = assess_session(&r, std::slice::from_ref(&r), now);
        assert!(!a.is_suspected);
        assert!(a.suspected_reasons.is_empty());
    }

    #[test]
    fn stale_other_session_is_suspected() {
        let now =
            NaiveDateTime::parse_from_str("2026-06-10 15:00:00", "%Y-%m-%d %H:%M:%S").unwrap();
        let current = row("cur", "MeDoc", "2026-06-10 14:55:00", true, false);
        let other = row("old", "MeDoc", "2026-06-07 10:00:00", false, false);
        let peers = vec![current.clone(), other.clone()];
        let a = assess_session(&other, &peers, now);
        assert!(a.is_suspected);
        assert!(a.suspected_reasons.iter().any(|s| s.contains("hours")));
    }

    #[test]
    fn trusted_session_is_not_suspected() {
        let now =
            NaiveDateTime::parse_from_str("2026-06-10 15:00:00", "%Y-%m-%d %H:%M:%S").unwrap();
        let trusted = row("t1", "MeDoc", "2026-06-01 10:00:00", false, true);
        let a = assess_session(&trusted, std::slice::from_ref(&trusted), now);
        assert!(!a.is_suspected);
    }
}
