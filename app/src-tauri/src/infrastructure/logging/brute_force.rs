// Brute-force detection (NFA-LOG-02)
//
// Tracks failed login attempts per IP. After more than 5 failed attempts in
// a 10-minute window, the IP is locked out for 15 minutes.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const WINDOW: Duration = Duration::from_secs(10 * 60);
const LOCKOUT: Duration = Duration::from_secs(15 * 60);
const THRESHOLD: usize = 5;

#[derive(Default)]
struct Entry {
    failures: Vec<Instant>,
    locked_until: Option<Instant>,
}

#[derive(Default)]
pub struct BruteForceTracker {
    inner: Mutex<HashMap<String, Entry>>,
}

pub enum CheckResult {
    Allowed,
    Locked { remaining_secs: u64 },
}

impl BruteForceTracker {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if an IP is currently allowed to attempt a login.
    pub fn check(&self, ip: &str) -> CheckResult {
        let map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = map.get(ip) {
            if let Some(until) = entry.locked_until {
                if Instant::now() < until {
                    return CheckResult::Locked {
                        remaining_secs: (until - Instant::now()).as_secs(),
                    };
                }
            }
        }
        CheckResult::Allowed
    }

    /// Record a failed login. Returns `true` if the IP just became locked out.
    pub fn record_failure(&self, ip: &str) -> bool {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        let entry = map.entry(ip.to_string()).or_default();
        let now = Instant::now();
        entry.failures.retain(|t| now.duration_since(*t) <= WINDOW);
        entry.failures.push(now);
        if entry.failures.len() > THRESHOLD {
            entry.locked_until = Some(now + LOCKOUT);
            entry.failures.clear();
            true
        } else {
            false
        }
    }

    /// Reset on successful login.
    pub fn record_success(&self, ip: &str) {
        let mut map = self.inner.lock().unwrap_or_else(|e| e.into_inner());
        map.remove(ip);
    }
}
