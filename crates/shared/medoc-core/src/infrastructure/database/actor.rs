//! Who makes a change (T5.8 phase 1). Every local change written to the sync outbox carries its
//! author as `syncActor` inside the payload, so the author is covered by the entry signature
//! (payload hash) and older merges ignore it like other `sync*` keys (only table columns apply).
//!
//! Source, first match wins:
//! 1. a scoped actor ([`with_actor`]): a LAN request's user, or [`SYSTEM`] for background jobs;
//! 2. the person signed in on this device ([`set_device_actor`] at sign-in / sign-out): the
//!    desktop app has one session per device;
//! 3. [`SYSTEM`].

use std::future::Future;
use std::sync::RwLock;

/// Payload key of the author. Not a column; never merged as a field.
pub const PAYLOAD_KEY: &str = "syncActor";
/// Author of writes nobody started (start-up repairs, timers, sync bookkeeping).
pub const SYSTEM: &str = "system";

static DEVICE_ACTOR: RwLock<Option<String>> = RwLock::new(None);

tokio::task_local! {
    static SCOPED_ACTOR: String;
}

/// Set on sign-in, cleared (`None`) on sign-out.
pub fn set_device_actor(staff_id: Option<&str>) {
    let value = staff_id
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    match DEVICE_ACTOR.write() {
        Ok(mut g) => *g = value,
        Err(poisoned) => *poisoned.into_inner() = value,
    }
}

/// Run `fut` with `actor` as the author of every change it writes.
pub async fn with_actor<F: Future>(actor: &str, fut: F) -> F::Output {
    SCOPED_ACTOR.scope(actor.to_string(), fut).await
}

/// The author of a change written now.
pub fn current() -> String {
    if let Ok(a) = SCOPED_ACTOR.try_with(Clone::clone) {
        return a;
    }
    let device = match DEVICE_ACTOR.read() {
        Ok(g) => g.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    };
    device.unwrap_or_else(|| SYSTEM.to_string())
}

/// Add the current author to a JSON object payload, unless it already names one.
pub fn stamp(payload_json: &str) -> String {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return payload_json.to_string();
    };
    let Some(obj) = value.as_object_mut() else {
        return payload_json.to_string();
    };
    if obj.contains_key(PAYLOAD_KEY) {
        return payload_json.to_string();
    }
    obj.insert(
        PAYLOAD_KEY.to_string(),
        serde_json::Value::String(current()),
    );
    value.to_string()
}

/// The author named in a payload, if any (older devices send none).
pub fn of_payload(payload: &serde_json::Map<String, serde_json::Value>) -> Option<&str> {
    payload
        .get(PAYLOAD_KEY)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stamp_keeps_an_existing_author_and_ignores_non_objects() {
        assert_eq!(
            stamp(r#"{"id":"x","syncActor":"dr-a"}"#),
            r#"{"id":"x","syncActor":"dr-a"}"#
        );
        assert_eq!(stamp("[1]"), "[1]");
        assert_eq!(stamp("not json"), "not json");
    }
}
