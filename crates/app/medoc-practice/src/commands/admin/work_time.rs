//! Staff work-time sessions (Arbeitszeit) — distinct from practice Sprechzeiten.

use chrono::{Datelike, NaiveDate, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::application::rbac::{self, effective_allowed, Role};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use tauri::State;

const AUTO_RECORD_KV: &str = "work_time.auto_record_on_login.v1";

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeSession {
    pub id: String,
    pub personal_id: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub pause_started_at: Option<String>,
    pub status: String,
    pub auto_recorded: bool,
    pub end_reason: Option<String>,
    #[sqlx(default)]
    pub pause_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeWeekOverview {
    pub week_start: String,
    pub sessions: Vec<WorkTimeSession>,
    pub total_minutes: i64,
    pub days: Vec<WorkTimeDaySummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeDaySummary {
    pub date: String,
    pub worked_minutes: i64,
    pub pause_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeActiveSession {
    pub session: WorkTimeSession,
    pub elapsed_minutes: i64,
    pub open_pause_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeTeamMemberRow {
    pub personal_id: String,
    pub name: String,
    pub status: String,
    pub today_minutes: i64,
    pub week_minutes: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeTeamOverview {
    pub week_start: String,
    pub members: Vec<WorkTimeTeamMemberRow>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeStatistics {
    pub week_minutes: i64,
    pub month_minutes: i64,
    pub pause_minutes_week: i64,
    pub by_day: Vec<WorkTimeDaySummary>,
    pub by_person: Vec<WorkTimeTeamMemberRow>,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimePreference {
    pub focus_mode: bool,
    pub auto_record_on_login: bool,
    pub auto_record_on_logout: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimePreferencePatch {
    pub focus_mode: Option<bool>,
    pub auto_record_on_login: Option<bool>,
    pub auto_record_on_logout: Option<bool>,
    pub personal_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeReconcileReport {
    pub closed_stale_count: u32,
}

async fn open_session(pool: &SqlitePool, personal_id: &str) -> Result<Option<WorkTimeSession>, AppError> {
    let row = sqlx::query_as::<_, WorkTimeSession>(
        "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                COALESCE(pause_minutes, 0) AS pause_minutes
         FROM work_time_session
         WHERE personal_id = ?1 AND status IN ('RUNNING', 'PAUSED')
         ORDER BY started_at DESC LIMIT 1",
    )
    .bind(personal_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row)
}

fn parse_rfc3339(s: &str) -> Option<chrono::DateTime<Utc>> {
    chrono::DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|dt| dt.with_timezone(&Utc))
}

fn session_work_minutes(s: &WorkTimeSession, now: chrono::DateTime<Utc>) -> (i64, i64) {
    let start = parse_rfc3339(&s.started_at).unwrap_or(now);
    let end = s
        .ended_at
        .as_deref()
        .and_then(parse_rfc3339)
        .unwrap_or(now);
    let gross = (end - start).num_minutes().max(0);
    let mut pause = s.pause_minutes.max(0);
    if s.status == "PAUSED" {
        if let Some(ps) = s.pause_started_at.as_deref().and_then(parse_rfc3339) {
            pause += (now - ps).num_minutes().max(0);
        }
    }
    let worked = (gross - pause).max(0);
    (worked, pause)
}

async fn close_open_pause_segment(pool: &SqlitePool, session_id: &str) -> Result<i64, AppError> {
    let now = Utc::now().to_rfc3339();
    let open: Option<(String, String)> = sqlx::query_as(
        "SELECT id, started_at FROM work_time_pause_segment
         WHERE session_id = ?1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    let Some((seg_id, started_at)) = open else {
        return Ok(0);
    };
    sqlx::query("UPDATE work_time_pause_segment SET ended_at = ?1 WHERE id = ?2")
        .bind(&now)
        .bind(&seg_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    let mins = parse_rfc3339(&started_at)
        .and_then(|st| parse_rfc3339(&now).map(|en| (en - st).num_minutes()))
        .unwrap_or(0)
        .max(0);
    sqlx::query(
        "UPDATE work_time_session SET pause_minutes = COALESCE(pause_minutes, 0) + ?1 WHERE id = ?2",
    )
    .bind(mins)
    .bind(session_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(mins)
}

pub async fn get_or_create_preference(
    pool: &SqlitePool,
    personal_id: &str,
) -> Result<WorkTimePreference, AppError> {
    let row: Option<(i64, i64, i64)> = sqlx::query_as(
        "SELECT focus_mode, auto_record_on_login, auto_record_on_logout
         FROM work_time_preference WHERE personal_id = ?1",
    )
    .bind(personal_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;

    if let Some((f, l, o)) = row {
        return Ok(WorkTimePreference {
            focus_mode: f != 0,
            auto_record_on_login: l != 0,
            auto_record_on_logout: o != 0,
        });
    }

    let kv_login = app_kv_repo::get(pool, AUTO_RECORD_KV).await?;
    let auto_login = kv_login.as_deref() == Some("1");
    sqlx::query(
        "INSERT INTO work_time_preference (personal_id, focus_mode, auto_record_on_login, auto_record_on_logout)
         VALUES (?1, 0, ?2, 0)",
    )
    .bind(personal_id)
    .bind(auto_login as i32)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(WorkTimePreference {
        focus_mode: false,
        auto_record_on_login: auto_login,
        auto_record_on_logout: false,
    })
}

pub async fn end_open_session_for_user(
    pool: &SqlitePool,
    personal_id: &str,
    reason: &str,
) -> Result<(), AppError> {
    let Some(row) = open_session(pool, personal_id).await? else {
        return Ok(());
    };
    close_open_pause_segment(pool, &row.id).await?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE work_time_session SET status = 'ENDED', ended_at = ?1, pause_started_at = NULL, end_reason = ?2
         WHERE id = ?3",
    )
    .bind(&now)
    .bind(reason)
    .bind(&row.id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

fn started_date(started_at: &str) -> Option<NaiveDate> {
    parse_rfc3339(started_at)
        .map(|dt| dt.date_naive())
        .or_else(|| {
            NaiveDate::parse_from_str(&started_at[..10.min(started_at.len())], "%Y-%m-%d").ok()
        })
}

fn stale_close_ended_at(started_at: &str) -> String {
    let Some(day) = started_date(started_at) else {
        return Utc::now().to_rfc3339();
    };
    let end_naive = day
        .and_hms_opt(18, 0, 0)
        .unwrap_or_else(|| day.and_hms_opt(23, 59, 59).unwrap());
    Utc.from_utc_datetime(&end_naive).to_rfc3339()
}

async fn reconcile_stale_sessions(pool: &SqlitePool, personal_id: &str) -> Result<u32, AppError> {
    let today = Utc::now().date_naive();
    let rows = sqlx::query_as::<_, WorkTimeSession>(
        "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                COALESCE(pause_minutes, 0) AS pause_minutes
         FROM work_time_session
         WHERE personal_id = ?1 AND status IN ('RUNNING', 'PAUSED')",
    )
    .bind(personal_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    let mut closed = 0u32;
    for row in rows {
        let Some(start_day) = started_date(&row.started_at) else {
            continue;
        };
        if start_day >= today {
            continue;
        }
        close_open_pause_segment(pool, &row.id).await?;
        let ended_at = stale_close_ended_at(&row.started_at);
        sqlx::query(
            "UPDATE work_time_session
             SET status = 'ENDED', ended_at = ?1, pause_started_at = NULL, end_reason = 'unbeendet'
             WHERE id = ?2",
        )
        .bind(&ended_at)
        .bind(&row.id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        closed += 1;
    }
    Ok(closed)
}

fn week_start_from(query: Option<&str>) -> Result<NaiveDate, AppError> {
    if let Some(ws) = query {
        NaiveDate::parse_from_str(ws, "%Y-%m-%d")
            .map_err(|_| AppError::validation_code("error.work_time.week_start_format"))
    } else {
        let today = Utc::now().date_naive();
        Ok(today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64))
    }
}

fn summarize_days(sessions: &[WorkTimeSession]) -> Vec<WorkTimeDaySummary> {
    let now = Utc::now();
    let mut map: std::collections::BTreeMap<String, (i64, i64)> = std::collections::BTreeMap::new();
    for s in sessions {
        let day = started_date(&s.started_at)
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        let (worked, pause) = session_work_minutes(s, now);
        let e = map.entry(day).or_insert((0, 0));
        e.0 += worked;
        e.1 += pause;
    }
    map.into_iter()
        .map(|(date, (worked_minutes, pause_minutes))| WorkTimeDaySummary {
            date,
            worked_minutes,
            pause_minutes,
        })
        .collect()
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_reconcile_on_login(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<WorkTimeReconcileReport, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let closed_stale_count = reconcile_stale_sessions(&pool, &session.user_id).await?;
    Ok(WorkTimeReconcileReport { closed_stale_count })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_active_session(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Option<WorkTimeActiveSession>, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    let Some(row) = open_session(&pool, &session.user_id).await? else {
        return Ok(None);
    };
    let now = Utc::now();
    let (elapsed_minutes, open_pause_minutes) = session_work_minutes(&row, now);
    Ok(Some(WorkTimeActiveSession {
        session: row,
        elapsed_minutes,
        open_pause_minutes,
    }))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_start(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    auto_recorded: Option<bool>,
) -> Result<WorkTimeSession, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    reconcile_stale_sessions(&pool, &session.user_id).await?;
    if open_session(&pool, &session.user_id).await?.is_some() {
        return Err(AppError::validation_code("error.work_time.session_already_running"));
    }
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let auto = auto_recorded.unwrap_or(false);
    sqlx::query(
        "INSERT INTO work_time_session (id, personal_id, started_at, status, auto_recorded, pause_minutes)
         VALUES (?1, ?2, ?3, 'RUNNING', ?4, 0)",
    )
    .bind(&id)
    .bind(&session.user_id)
    .bind(&now)
    .bind(auto)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    open_session(&pool, &session.user_id)
        .await?
        .ok_or_else(|| AppError::Internal("work_time_start".into()))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_pause(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<WorkTimeSession, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    let row = open_session(&pool, &session.user_id)
        .await?
        .ok_or(AppError::validation_code("error.work_time.no_running_session"))?;
    if row.status != "RUNNING" {
        return Err(AppError::validation_code("error.work_time.session_not_running"));
    }
    let now = Utc::now().to_rfc3339();
    let seg_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO work_time_pause_segment (id, session_id, started_at) VALUES (?1, ?2, ?3)",
    )
    .bind(&seg_id)
    .bind(&row.id)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "UPDATE work_time_session SET status = 'PAUSED', pause_started_at = ?1 WHERE id = ?2",
    )
    .bind(&now)
    .bind(&row.id)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    open_session(&pool, &session.user_id)
        .await?
        .ok_or_else(|| AppError::Internal("work_time_pause".into()))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_resume(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<WorkTimeSession, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    let row = open_session(&pool, &session.user_id)
        .await?
        .ok_or(AppError::validation_code("error.work_time.no_paused_session"))?;
    if row.status != "PAUSED" {
        return Err(AppError::validation_code("error.work_time.session_not_paused"));
    }
    close_open_pause_segment(&pool, &row.id).await?;
    sqlx::query(
        "UPDATE work_time_session SET status = 'RUNNING', pause_started_at = NULL WHERE id = ?1",
    )
    .bind(&row.id)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    open_session(&pool, &session.user_id)
        .await?
        .ok_or_else(|| AppError::Internal("work_time_resume".into()))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_end(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<WorkTimeSession, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    let row = open_session(&pool, &session.user_id)
        .await?
        .ok_or(AppError::validation_code("error.work_time.no_open_session"))?;
    close_open_pause_segment(&pool, &row.id).await?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE work_time_session SET status = 'ENDED', ended_at = ?1, pause_started_at = NULL, end_reason = 'manual'
         WHERE id = ?2",
    )
    .bind(&now)
    .bind(&row.id)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    sqlx::query_as::<_, WorkTimeSession>(
        "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                COALESCE(pause_minutes, 0) AS pause_minutes
         FROM work_time_session WHERE id = ?1",
    )
    .bind(&row.id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::Database)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkTimeWeekQuery {
    pub week_start: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_week_overview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    query: WorkTimeWeekQuery,
) -> Result<WorkTimeWeekOverview, AppError> {
    let session = rbac::require(&session_state, "work_time.self")?;
    let week_start = week_start_from(query.week_start.as_deref())?;
    let week_end = week_start + chrono::Duration::days(7);
    let sessions = sqlx::query_as::<_, WorkTimeSession>(
        "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                COALESCE(pause_minutes, 0) AS pause_minutes
         FROM work_time_session
         WHERE personal_id = ?1 AND started_at >= ?2 AND started_at < ?3
         ORDER BY started_at ASC",
    )
    .bind(&session.user_id)
    .bind(week_start.format("%Y-%m-%d").to_string())
    .bind(week_end.format("%Y-%m-%d").to_string())
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::Database)?;

    let now = Utc::now();
    let total_minutes: i64 = sessions.iter().map(|s| session_work_minutes(s, now).0).sum();
    let days = summarize_days(&sessions);

    Ok(WorkTimeWeekOverview {
        week_start: week_start.format("%Y-%m-%d").to_string(),
        sessions,
        total_minutes,
        days,
    })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_team_overview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    query: WorkTimeWeekQuery,
) -> Result<WorkTimeTeamOverview, AppError> {
    rbac::require(&session_state, "work_time.team.read")?;
    let week_start = week_start_from(query.week_start.as_deref())?;
    let week_end = week_start + chrono::Duration::days(7);
    let today = Utc::now().date_naive().format("%Y-%m-%d").to_string();

    let staff: Vec<(String, String)> = sqlx::query_as(
        "SELECT id, name FROM personal WHERE UPPER(rolle) IN ('ARZT', 'REZEPTION') ORDER BY name",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::Database)?;

    let sessions = sqlx::query_as::<_, WorkTimeSession>(
        "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                COALESCE(pause_minutes, 0) AS pause_minutes
         FROM work_time_session
         WHERE started_at >= ?1 AND started_at < ?2",
    )
    .bind(week_start.format("%Y-%m-%d").to_string())
    .bind(week_end.format("%Y-%m-%d").to_string())
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::Database)?;

    let now = Utc::now();
    let mut members = Vec::new();
    for (pid, name) in staff {
        let mine: Vec<_> = sessions.iter().filter(|s| s.personal_id == pid).collect();
        let week_minutes: i64 = mine.iter().map(|s| session_work_minutes(s, now).0).sum();
        let today_minutes: i64 = mine
            .iter()
            .filter(|s| s.started_at.starts_with(&today))
            .map(|s| session_work_minutes(s, now).0)
            .sum();
        let status = mine
            .iter()
            .find(|s| s.status == "RUNNING" || s.status == "PAUSED")
            .map(|s| s.status.clone())
            .unwrap_or_else(|| "AUS".into());
        members.push(WorkTimeTeamMemberRow {
            personal_id: pid,
            name,
            status,
            today_minutes,
            week_minutes,
        });
    }

    Ok(WorkTimeTeamOverview {
        week_start: week_start.format("%Y-%m-%d").to_string(),
        members,
    })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_statistics(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<WorkTimeStatistics, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;
    let team = effective_allowed("work_time.team.read", role, &session.permission_overrides);
    let today = Utc::now().date_naive();
    let week_start = today - chrono::Duration::days(today.weekday().num_days_from_monday() as i64);
    let month_start = NaiveDate::from_ymd_opt(today.year(), today.month(), 1).unwrap_or(today);

    let sessions = if team {
        sqlx::query_as::<_, WorkTimeSession>(
            "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                    COALESCE(pause_minutes, 0) AS pause_minutes
             FROM work_time_session
             WHERE started_at >= ?1
             ORDER BY started_at ASC",
        )
        .bind(month_start.format("%Y-%m-%d").to_string())
        .fetch_all(pool.inner())
        .await
        .map_err(AppError::Database)?
    } else {
        sqlx::query_as::<_, WorkTimeSession>(
            "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                    COALESCE(pause_minutes, 0) AS pause_minutes
             FROM work_time_session
             WHERE personal_id = ?1 AND started_at >= ?2
             ORDER BY started_at ASC",
        )
        .bind(&session.user_id)
        .bind(month_start.format("%Y-%m-%d").to_string())
        .fetch_all(pool.inner())
        .await
        .map_err(AppError::Database)?
    };

    let now = Utc::now();
    let week_minutes: i64 = sessions
        .iter()
        .filter(|s| started_date(&s.started_at).is_some_and(|d| d >= week_start))
        .map(|s| session_work_minutes(s, now).0)
        .sum();
    let month_minutes: i64 = sessions.iter().map(|s| session_work_minutes(s, now).0).sum();
    let pause_minutes_week: i64 = sessions
        .iter()
        .filter(|s| started_date(&s.started_at).is_some_and(|d| d >= week_start))
        .map(|s| session_work_minutes(s, now).1)
        .sum();

    let by_day = summarize_days(
        &sessions
            .iter()
            .filter(|s| started_date(&s.started_at).is_some_and(|d| d >= week_start))
            .cloned()
            .collect::<Vec<_>>(),
    );

    let by_person = if team {
        let staff: Vec<(String, String)> = sqlx::query_as(
            "SELECT id, name FROM personal WHERE UPPER(rolle) IN ('ARZT', 'REZEPTION') ORDER BY name",
        )
        .fetch_all(pool.inner())
        .await
        .map_err(AppError::Database)?;
        let today_str = Utc::now().date_naive().format("%Y-%m-%d").to_string();
        staff
            .into_iter()
            .map(|(pid, name)| {
                let mine: Vec<_> = sessions.iter().filter(|s| s.personal_id == pid).collect();
                let week_minutes: i64 = mine
                    .iter()
                    .filter(|s| {
                        started_date(&s.started_at).is_some_and(|d| d >= week_start)
                    })
                    .map(|s| session_work_minutes(s, now).0)
                    .sum();
                let today_minutes: i64 = mine
                    .iter()
                    .filter(|s| s.started_at.starts_with(&today_str))
                    .map(|s| session_work_minutes(s, now).0)
                    .sum();
                let status = mine
                    .iter()
                    .find(|s| s.status == "RUNNING" || s.status == "PAUSED")
                    .map(|s| s.status.clone())
                    .unwrap_or_else(|| "AUS".into());
                WorkTimeTeamMemberRow {
                    personal_id: pid,
                    name,
                    status,
                    today_minutes,
                    week_minutes,
                }
            })
            .collect()
    } else {
        vec![WorkTimeTeamMemberRow {
            personal_id: session.user_id.clone(),
            name: session.name.clone(),
            status: "SELF".into(),
            today_minutes: week_minutes,
            week_minutes,
        }]
    };

    Ok(WorkTimeStatistics {
        week_minutes,
        month_minutes,
        pause_minutes_week,
        by_day,
        by_person,
    })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_preference(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    personal_id: Option<String>,
) -> Result<WorkTimePreference, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let pid = if let Some(id) = personal_id {
        rbac::require(&session_state, "work_time.admin")?;
        id
    } else {
        session.user_id.clone()
    };
    get_or_create_preference(&pool, &pid).await
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_set_preference(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patch: WorkTimePreferencePatch,
) -> Result<WorkTimePreference, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let pid = if let Some(id) = patch.personal_id {
        rbac::require(&session_state, "work_time.admin")?;
        id
    } else {
        session.user_id.clone()
    };
    let _ = get_or_create_preference(&pool, &pid).await?;
    if let Some(f) = patch.focus_mode {
        sqlx::query("UPDATE work_time_preference SET focus_mode = ?1 WHERE personal_id = ?2")
            .bind(f as i32)
            .bind(&pid)
            .execute(pool.inner())
            .await
            .map_err(AppError::Database)?;
    }
    if let Some(l) = patch.auto_record_on_login {
        sqlx::query("UPDATE work_time_preference SET auto_record_on_login = ?1 WHERE personal_id = ?2")
            .bind(l as i32)
            .bind(&pid)
            .execute(pool.inner())
            .await
            .map_err(AppError::Database)?;
    }
    if let Some(o) = patch.auto_record_on_logout {
        sqlx::query("UPDATE work_time_preference SET auto_record_on_logout = ?1 WHERE personal_id = ?2")
            .bind(o as i32)
            .bind(&pid)
            .execute(pool.inner())
            .await
            .map_err(AppError::Database)?;
    }
    get_or_create_preference(&pool, &pid).await
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_set_auto_record_on_login(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    enabled: bool,
) -> Result<(), AppError> {
    rbac::require(&session_state, "personal.write")?;
    app_kv_repo::set(&pool, AUTO_RECORD_KV, if enabled { "1" } else { "0" }).await?;
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM personal WHERE UPPER(rolle) IN ('ARZT', 'REZEPTION')",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::Database)?;
    for (pid,) in rows {
        let _ = get_or_create_preference(&pool, &pid).await?;
        sqlx::query(
            "UPDATE work_time_preference SET auto_record_on_login = ?1 WHERE personal_id = ?2",
        )
        .bind(enabled as i32)
        .bind(&pid)
        .execute(pool.inner())
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn work_time_get_auto_record_on_login(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<bool, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let pref = get_or_create_preference(&pool, &session.user_id).await?;
    Ok(pref.auto_record_on_login)
}

#[macro_export]
macro_rules! register_work_time_commands {
    () => {
        $crate::commands::work_time_commands::work_time_start,
        $crate::commands::work_time_commands::work_time_pause,
        $crate::commands::work_time_commands::work_time_resume,
        $crate::commands::work_time_commands::work_time_end,
        $crate::commands::work_time_commands::work_time_reconcile_on_login,
        $crate::commands::work_time_commands::work_time_get_active_session,
        $crate::commands::work_time_commands::work_time_get_week_overview,
        $crate::commands::work_time_commands::work_time_get_team_overview,
        $crate::commands::work_time_commands::work_time_get_statistics,
        $crate::commands::work_time_commands::work_time_get_preference,
        $crate::commands::work_time_commands::work_time_set_preference,
        $crate::commands::work_time_commands::work_time_set_auto_record_on_login,
        $crate::commands::work_time_commands::work_time_get_auto_record_on_login,
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

    async fn seed_personal(pool: &SqlitePool, id: &str) {
        sqlx::query(
            "INSERT INTO personal (id, name, email, rolle, passwort_hash, verfuegbar, created_at, updated_at)
             VALUES (?1, 'Test', 't@example.com', 'REZEPTION', 'x', 1, datetime('now'), datetime('now'))",
        )
        .bind(id)
        .execute(pool)
        .await
        .expect("seed personal");
    }

    #[tokio::test]
    async fn reconcile_closes_prior_day_open_session() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        let pid = "p-work-time-1";
        seed_personal(&pool, pid).await;
        let yesterday = (Utc::now().date_naive() - chrono::Duration::days(1))
            .format("%Y-%m-%d")
            .to_string();
        sqlx::query(
            "INSERT INTO work_time_session (id, personal_id, started_at, status, auto_recorded, pause_minutes)
             VALUES ('s1', ?1, ?2, 'RUNNING', 1, 0)",
        )
        .bind(pid)
        .bind(format!("{yesterday}T08:00:00Z"))
        .execute(&pool)
        .await
        .expect("insert session");

        let n = reconcile_stale_sessions(&pool, pid).await.expect("reconcile");
        assert_eq!(n, 1);

        let status: String = sqlx::query_scalar(
            "SELECT status FROM work_time_session WHERE id = 's1'",
        )
        .fetch_one(&pool)
        .await
        .expect("status");
        assert_eq!(status, "ENDED");
    }

    #[tokio::test]
    async fn pause_segments_reduce_worked_minutes() {
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        let pid = "p-wt-2";
        seed_personal(&pool, pid).await;
        let start = (Utc::now() - chrono::Duration::minutes(120)).to_rfc3339();
        sqlx::query(
            "INSERT INTO work_time_session (id, personal_id, started_at, ended_at, status, auto_recorded, pause_minutes)
             VALUES ('s2', ?1, ?2, ?3, 'ENDED', 0, 30)",
        )
        .bind(pid)
        .bind(&start)
        .bind(Utc::now().to_rfc3339())
        .execute(&pool)
        .await
        .unwrap();
        let row: WorkTimeSession = sqlx::query_as(
            "SELECT id, personal_id, started_at, ended_at, pause_started_at, status, auto_recorded, end_reason,
                    COALESCE(pause_minutes, 0) AS pause_minutes
             FROM work_time_session WHERE id = 's2'",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        let (worked, _) = session_work_minutes(&row, Utc::now());
        assert!(worked <= 90, "worked should subtract pause_minutes");
    }
}
