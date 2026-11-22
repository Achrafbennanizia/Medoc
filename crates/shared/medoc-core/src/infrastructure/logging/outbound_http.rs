//! Failed calls this device makes to another device's API (sync push/pull/exchange, peers,
//! reconcile) → `network.log` (target `medoc::http`), WARN and ERROR also in `errors.log`.
//!
//! One line per failure with the call (`kind`), the route path (never host, query or ids beyond
//! the path), the status, the server's `x-request-id` and its error code. The request id is the
//! same value the receiving device wrote in its own `HTTP_REQUEST_FAILED` line, so both sides of
//! a failed call are found with one search. A device that polls an unreachable main device twice
//! a second logs each kind at most once a minute (and counts what it skipped).

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::error::AppError;

const THROTTLE: Duration = Duration::from_secs(60);

/// kind → (last line written, failures skipped since).
static LAST: Mutex<Option<HashMap<String, (Instant, u32)>>> = Mutex::new(None);

/// `Some(skipped)` when this failure should be written now.
fn admit(key: &str) -> Option<u32> {
    let mut guard = LAST.lock().ok()?;
    let map = guard.get_or_insert_with(HashMap::new);
    let now = Instant::now();
    match map.get_mut(key) {
        Some((at, skipped)) if now.duration_since(*at) < THROTTLE => {
            *skipped += 1;
            None
        }
        Some(slot) => {
            let skipped = slot.1;
            *slot = (now, 0);
            Some(skipped)
        }
        None => {
            map.insert(key.to_owned(), (now, 0));
            Some(0)
        }
    }
}

/// The request never got an answer (refused, unreachable, TLS, timeout).
pub fn send_failed(kind: &str, error: &reqwest::Error) -> AppError {
    let route = error.url().map(|u| u.path().to_owned()).unwrap_or_default();
    if let Some(skipped) = admit(&format!("send:{kind}")) {
        tracing::warn!(
            target: "medoc::http",
            event = "OUTBOUND_HTTP_UNREACHABLE",
            kind,
            route = %route,
            timeout = error.is_timeout(),
            connect = error.is_connect(),
            skipped,
            error = %error
        );
    }
    AppError::Internal(format!("{kind} http: {error}"))
}

/// The other device answered with a non-2xx status.
pub async fn status_failed(kind: &str, resp: reqwest::Response) -> AppError {
    let status = resp.status();
    let route = resp.url().path().to_owned();
    let request_id = request_id(&resp);
    let body = resp.text().await.unwrap_or_default();
    rejected(kind, status.as_u16(), &route, &request_id, &body);
    AppError::Internal(format!("{kind} http status {status}: {body}"))
}

/// Log a non-2xx answer the caller has already read (`body` = response text, JSON or not).
pub fn rejected(kind: &str, status: u16, route: &str, request_id: &str, body: &str) {
    let code = error_code(body);
    let Some(skipped) = admit(&format!("status:{kind}:{status}")) else {
        return;
    };
    if status >= 500 {
        tracing::error!(target: "medoc::http", event = "OUTBOUND_HTTP_FAILED", kind, route, status, request_id, code = %code, skipped);
    } else {
        tracing::warn!(target: "medoc::http", event = "OUTBOUND_HTTP_REJECTED", kind, route, status, request_id, code = %code, skipped);
    }
}

/// `x-request-id` the other device sent back (joins its log line to ours).
pub fn request_id(resp: &reqwest::Response) -> String {
    resp.headers()
        .get("x-request-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_owned()
}

/// `error` / `reason` from a JSON error body; never the free text of a non-JSON body.
fn error_code(body: &str) -> String {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(body) else {
        return String::new();
    };
    let pick = |k: &str| v.get(k).and_then(|x| x.as_str()).map(str::to_owned);
    let code = pick("error").unwrap_or_default();
    match pick("reason") {
        Some(reason) if !code.is_empty() => {
            format!("{code}: {}", reason.chars().take(120).collect::<String>())
        }
        Some(reason) => reason.chars().take(120).collect(),
        None => code.split('|').next().unwrap_or("").to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::{admit, error_code};

    #[test]
    fn repeated_failures_of_one_kind_are_throttled() {
        assert_eq!(admit("test-kind"), Some(0));
        assert_eq!(admit("test-kind"), None);
        assert_eq!(admit("test-kind"), None);
        assert_eq!(admit("other-kind"), Some(0));
    }

    #[test]
    fn error_code_reads_json_bodies_only() {
        assert_eq!(
            error_code(r#"{"error":"forbidden","reason":"revoked"}"#),
            "forbidden: revoked"
        );
        assert_eq!(
            error_code(r#"{"error":"error.app.forbidden|ref=AB12"}"#),
            "error.app.forbidden"
        );
        assert_eq!(error_code("<html>patient Müller</html>"), "");
    }
}
