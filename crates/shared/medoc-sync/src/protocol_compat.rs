//! Sync protocol check between two devices (T7.6, editions-plan §11.6 "Compatibility").
//!
//! Every sync call carries [`HEADER`] = `"<protocol>;min=<oldest supported>"`. A device that
//! receives a call from a peer it cannot talk to answers 426 with `reason: "sync_protocol_mismatch"`.
//! The caller then pauses: [`update_needed`] reports the peer's protocol until a call succeeds again.
//! Nothing is dropped: outbox entries stay pending and local work goes on.
//! A call without the header comes from a build older than the check, which speaks protocol 1.

use std::sync::atomic::{AtomicU32, Ordering};

use medoc_core::infrastructure::update_manifest::{MIN_SYNC_PROTOCOL, SYNC_PROTOCOL};

pub const HEADER: &str = "x-medoc-sync-protocol";
pub const MISMATCH_REASON: &str = "sync_protocol_mismatch";

pub fn header_value() -> String {
    format!("{SYNC_PROTOCOL};min={MIN_SYNC_PROTOCOL}")
}

/// `(protocol, oldest supported)`; a missing header means protocol 1.
pub fn parse(raw: Option<&str>) -> Option<(u32, u32)> {
    let Some(raw) = raw else { return Some((1, 1)) };
    let (cur, rest) = raw.trim().split_once(";min=").unwrap_or((raw.trim(), ""));
    let cur: u32 = cur.trim().parse().ok()?;
    let min: u32 = if rest.is_empty() { cur } else { rest.trim().parse().ok()? };
    Some((cur, min.min(cur)))
}

/// Both sides must accept the other's protocol.
pub fn compatible(peer: (u32, u32)) -> bool {
    compatible_with(peer, (SYNC_PROTOCOL, MIN_SYNC_PROTOCOL))
}

pub fn compatible_with(peer: (u32, u32), local: (u32, u32)) -> bool {
    peer.0 >= local.1 && local.0 >= peer.1
}

static PEER_PROTOCOL_MISMATCH: AtomicU32 = AtomicU32::new(0);

/// A peer refused us for the protocol (426): pause until a call succeeds.
pub fn note_refused(peer_protocol: Option<u32>) {
    PEER_PROTOCOL_MISMATCH.store(peer_protocol.unwrap_or(u32::MAX).max(1), Ordering::Relaxed);
}

pub fn note_ok() {
    PEER_PROTOCOL_MISMATCH.store(0, Ordering::Relaxed);
}

/// `Some(peer protocol)` while sync is paused for "update needed" (`u32::MAX` = unknown).
pub fn update_needed() -> Option<u32> {
    match PEER_PROTOCOL_MISMATCH.load(Ordering::Relaxed) {
        0 => None,
        n => Some(n),
    }
}

/// Response header the refusing side sends so the caller knows which side is behind.
pub const PEER_HEADER: &str = "x-medoc-sync-protocol-peer";

/// Inspect a sync response: 426 pauses, success resumes. Returns `true` when paused.
pub fn observe(status: u16, peer_header: Option<&str>) -> bool {
    if status == 426 {
        note_refused(peer_header.and_then(|h| parse(Some(h))).map(|p| p.0));
        true
    } else {
        if (200..300).contains(&status) {
            note_ok();
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_header_is_protocol_one() {
        assert_eq!(parse(None), Some((1, 1)));
        assert_eq!(parse(Some("3;min=2")), Some((3, 2)));
        assert_eq!(parse(Some("2")), Some((2, 2)));
        assert_eq!(parse(Some("x")), None);
    }

    #[test]
    fn one_version_behind_stays_compatible_when_allowed() {
        assert!(compatible_with((1, 1), (2, 1)));
        assert!(!compatible_with((1, 1), (2, 2)));
        assert!(!compatible_with((3, 3), (2, 1)));
        assert!(compatible_with((2, 1), (1, 1)));
    }

    #[test]
    fn refusal_pauses_until_success() {
        note_ok();
        assert!(observe(426, Some("2;min=2")));
        assert_eq!(update_needed(), Some(2));
        assert!(!observe(503, None));
        assert_eq!(update_needed(), Some(2));
        assert!(!observe(200, None));
        assert_eq!(update_needed(), None);
    }
}
