//! When an update installs (T7.6, docs/architecture/editions-plan.md §11.6).
//!
//! Feature updates wait for the admin: *Install now* or *Schedule after hours*. Security updates
//! schedule themselves for the next after-hours moment and the admin is told before and after.
//! "After hours" comes from the practice's opening hours (`practice.work_hours.v1`): a day is busy
//! from an hour before its first segment to an hour after its last one; closed days are free.
//! A backup is taken right before installing (practice layer). An update never changes the edition
//! (each manifest names its own), so pending guest changes in Solo are kept as they are.

use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, NaiveTime, TimeZone};
use serde::{Deserialize, Serialize};

use crate::infrastructure::update_manifest::Kind;

/// Margin around opening hours (people arrive early and leave late).
const MARGIN_MIN: i64 = 60;

/// Busy span of each weekday (Monday first), `None` when the practice is closed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BusyWeek([Option<(NaiveTime, NaiveTime)>; 7]);

impl Default for BusyWeek {
    /// No hours configured: Monday to Saturday 07:00–20:00 count as busy.
    fn default() -> Self {
        let day = Some((t(7, 0), t(20, 0)));
        BusyWeek([day, day, day, day, day, day, None])
    }
}

fn t(h: u32, m: u32) -> NaiveTime {
    NaiveTime::from_hms_opt(h, m, 0).expect("valid time")
}

impl BusyWeek {
    /// Reads `practice.work_hours.v1` (`plan.mo … plan.so`, each `{active, segments:[{from,to}]}`).
    pub fn from_work_hours(raw: &str) -> BusyWeek {
        let Ok(v) = serde_json::from_str::<serde_json::Value>(raw) else {
            return BusyWeek::default();
        };
        let Some(plan) = v.get("plan").and_then(|p| p.as_object()) else {
            return BusyWeek::default();
        };
        let mut week = [None; 7];
        for (i, key) in ["mo", "di", "mi", "do", "fr", "sa", "so"]
            .iter()
            .enumerate()
        {
            let Some(day) = plan.get(*key) else { continue };
            if !day.get("active").and_then(|a| a.as_bool()).unwrap_or(false) {
                continue;
            }
            let parse = |s: Option<&serde_json::Value>| {
                s.and_then(|x| x.as_str())
                    .and_then(|x| NaiveTime::parse_from_str(x, "%H:%M").ok())
            };
            let segs = day.get("segments").and_then(|s| s.as_array());
            let open = segs
                .into_iter()
                .flatten()
                .filter_map(|s| Some((parse(s.get("from"))?, parse(s.get("to"))?)));
            let (mut first, mut last) = (None::<NaiveTime>, None::<NaiveTime>);
            for (from, to) in open {
                first = Some(first.map_or(from, |f| f.min(from)));
                last = Some(last.map_or(to, |l| l.max(to)));
            }
            if let (Some(f), Some(l)) = (first, last) {
                let m = Duration::minutes(MARGIN_MIN);
                let start = if f - NaiveTime::MIN > m {
                    f - m
                } else {
                    NaiveTime::MIN
                };
                let end = l.overflowing_add_signed(m).0.max(l);
                week[i] = Some((start, end));
            }
        }
        BusyWeek(week)
    }

    fn span(&self, day: NaiveDate) -> Option<(NaiveTime, NaiveTime)> {
        self.0[day.weekday().num_days_from_monday() as usize]
    }

    pub fn is_busy(&self, at: DateTime<Local>) -> bool {
        self.span(at.date_naive())
            .is_some_and(|(s, e)| at.time() >= s && at.time() < e)
    }

    /// `now` if it is after hours, else the end of today's busy span.
    pub fn next_after_hours(&self, now: DateTime<Local>) -> DateTime<Local> {
        match self.span(now.date_naive()) {
            Some((s, e)) if now.time() >= s && now.time() < e => Local
                .from_local_datetime(&now.date_naive().and_time(e))
                .earliest()
                .unwrap_or(now),
            _ => now,
        }
    }
}

/// The admin's choice for a feature update.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Choice {
    Now,
    AfterHours,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Plan {
    InstallNow,
    InstallAt(DateTime<Local>),
    WaitForAdmin,
}

pub fn plan(kind: Kind, choice: Option<Choice>, week: &BusyWeek, now: DateTime<Local>) -> Plan {
    match (choice, kind) {
        (Some(Choice::Now), _) => Plan::InstallNow,
        (Some(Choice::AfterHours), _) | (None, Kind::Security) => {
            Plan::InstallAt(week.next_after_hours(now))
        }
        (None, Kind::Feature) => Plan::WaitForAdmin,
    }
}

/// A scheduled install, kept in `app_kv` until it ran.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scheduled {
    pub version: String,
    pub kind: Kind,
    pub at: DateTime<Local>,
}

pub fn due(s: &Scheduled, week: &BusyWeek, now: DateTime<Local>) -> bool {
    now >= s.at && !week.is_busy(now)
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOURS: &str = r#"{"plan":{
        "mo":{"active":true,"segments":[{"from":"08:00","to":"12:30"},{"from":"13:30","to":"17:00"}]},
        "fr":{"active":true,"segments":[{"from":"08:00","to":"15:00"}]},
        "sa":{"active":false,"segments":[{"from":"09:00","to":"13:00"}]}}}"#;

    fn at(s: &str) -> DateTime<Local> {
        Local
            .from_local_datetime(
                &chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap(),
            )
            .unwrap()
    }

    #[test]
    fn opening_hours_with_a_margin_make_the_busy_span() {
        let w = BusyWeek::from_work_hours(HOURS);
        // 2026-11-23 is a Monday, 2026-11-27 a Friday, 2026-11-28 a Saturday.
        assert!(w.is_busy(at("2026-11-23 07:30")));
        assert!(w.is_busy(at("2026-11-23 17:30")));
        assert!(!w.is_busy(at("2026-11-23 18:00")));
        assert!(!w.is_busy(at("2026-11-23 06:30")));
        assert!(!w.is_busy(at("2026-11-28 10:00")), "closed on Saturday");
        assert_eq!(
            w.next_after_hours(at("2026-11-27 10:00")),
            at("2026-11-27 16:00")
        );
        assert_eq!(
            w.next_after_hours(at("2026-11-27 21:00")),
            at("2026-11-27 21:00")
        );
    }

    #[test]
    fn security_updates_schedule_themselves_feature_updates_wait() {
        let w = BusyWeek::from_work_hours(HOURS);
        let now = at("2026-11-23 10:00");
        assert_eq!(
            plan(Kind::Security, None, &w, now),
            Plan::InstallAt(at("2026-11-23 18:00"))
        );
        assert_eq!(plan(Kind::Feature, None, &w, now), Plan::WaitForAdmin);
        assert_eq!(
            plan(Kind::Feature, Some(Choice::Now), &w, now),
            Plan::InstallNow
        );
        assert_eq!(
            plan(Kind::Feature, Some(Choice::AfterHours), &w, now),
            Plan::InstallAt(at("2026-11-23 18:00"))
        );
    }

    #[test]
    fn a_scheduled_install_runs_once_due_and_outside_opening_hours() {
        let w = BusyWeek::from_work_hours(HOURS);
        let s = Scheduled {
            version: "1.2.0".into(),
            kind: Kind::Security,
            at: at("2026-11-23 18:00"),
        };
        assert!(!due(&s, &w, at("2026-11-23 17:59")));
        assert!(due(&s, &w, at("2026-11-23 18:05")));
        assert!(
            due(&s, &w, at("2026-11-24 10:00")),
            "Tuesday is not an opening day here"
        );
    }

    #[test]
    fn unreadable_hours_fall_back_to_a_busy_working_week() {
        let w = BusyWeek::from_work_hours("not json");
        assert!(w.is_busy(at("2026-11-23 12:00")));
        assert!(!w.is_busy(at("2026-11-23 21:00")));
        assert!(!w.is_busy(at("2026-11-29 12:00")), "Sunday");
    }
}
