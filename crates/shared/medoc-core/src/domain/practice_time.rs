//! Practice-local calendar day, using the IANA zone in app_kv.

use chrono::{DateTime, NaiveDate, TimeZone, Utc};
pub use chrono_tz::Tz;
use sqlx::SqlitePool;

use crate::infrastructure::database::app_kv_repo;

const KEY: &str = "practice.timezone.v1";
pub const DEFAULT: Tz = chrono_tz::Europe::Berlin;

pub async fn practice_tz(pool: &SqlitePool) -> Tz {
    let Ok(Some(raw)) = app_kv_repo::get(pool, KEY).await else {
        return DEFAULT;
    };
    raw.trim().parse::<Tz>().unwrap_or(DEFAULT)
}

pub fn local_date(utc: DateTime<Utc>, tz: Tz) -> NaiveDate {
    utc.with_timezone(&tz).date_naive()
}

pub fn local_day_bounds_utc(day: NaiveDate, tz: Tz) -> (DateTime<Utc>, DateTime<Utc>) {
    let start = tz
        .from_local_datetime(&day.and_hms_opt(0, 0, 0).unwrap())
        .earliest()
        .or_else(|| {
            tz.from_local_datetime(&day.and_hms_opt(0, 0, 0).unwrap())
                .latest()
        })
        .unwrap_or_else(|| tz.from_utc_datetime(&day.and_hms_opt(0, 0, 0).unwrap()));
    let next = day.succ_opt().unwrap_or(day);
    let end = tz
        .from_local_datetime(&next.and_hms_opt(0, 0, 0).unwrap())
        .earliest()
        .or_else(|| {
            tz.from_local_datetime(&next.and_hms_opt(0, 0, 0).unwrap())
                .latest()
        })
        .unwrap_or_else(|| tz.from_utc_datetime(&next.and_hms_opt(0, 0, 0).unwrap()));
    (start.with_timezone(&Utc), end.with_timezone(&Utc))
}

pub fn local_month_bounds_utc(year: i32, month: u32, tz: Tz) -> (DateTime<Utc>, DateTime<Utc>) {
    let start = NaiveDate::from_ymd_opt(year, month, 1).unwrap_or(NaiveDate::MIN);
    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };
    let end = NaiveDate::from_ymd_opt(ny, nm, 1).unwrap_or(NaiveDate::MAX);
    let (a, _) = local_day_bounds_utc(start, tz);
    let (b, _) = local_day_bounds_utc(end, tz);
    (a, b)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    #[test]
    fn local_day_bounds_cover_dst_change() {
        let tz = chrono_tz::Europe::Berlin;
        let spring = NaiveDate::from_ymd_opt(2026, 3, 29).unwrap();
        let autumn = NaiveDate::from_ymd_opt(2026, 10, 25).unwrap();
        let (s0, s1) = local_day_bounds_utc(spring, tz);
        let (a0, a1) = local_day_bounds_utc(autumn, tz);
        assert_eq!((s1 - s0).num_hours(), 23);
        assert_eq!((a1 - a0).num_hours(), 25);
    }

    #[test]
    fn payment_at_0030_local_is_in_that_local_day() {
        let tz = chrono_tz::Europe::Berlin;
        let day = NaiveDate::from_ymd_opt(2026, 6, 15).unwrap();
        let local = tz
            .with_ymd_and_hms(2026, 6, 15, 0, 30, 0)
            .single()
            .expect("local");
        let utc = local.with_timezone(&Utc);
        assert_eq!(local_date(utc, tz), day);
        let (start, end) = local_day_bounds_utc(day, tz);
        assert!(utc >= start && utc < end);
        assert_eq!(utc.hour(), 22); // 00:30 CEST is 22:30 previous UTC
        let _ = utc.minute();
    }
}
