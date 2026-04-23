// Performance instrumentation (NFA-LOG-06).
//
// Provides a `time_it!` macro and a `time_async` helper that emit an entry
// to the `medoc::perf` channel only when the elapsed duration exceeds the
// configured threshold (default 500 ms).

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Instant;

static THRESHOLD_MS: AtomicU64 = AtomicU64::new(500);

pub fn set_threshold_ms(ms: u64) {
    THRESHOLD_MS.store(ms, Ordering::Relaxed);
}

pub fn threshold_ms() -> u64 {
    THRESHOLD_MS.load(Ordering::Relaxed)
}

/// Time an async future. Logs to `medoc::perf` only if it exceeds the threshold.
pub async fn time_async<F, T>(label: &'static str, fut: F) -> T
where
    F: std::future::Future<Output = T>,
{
    let start = Instant::now();
    let out = fut.await;
    let elapsed = start.elapsed().as_millis() as u64;
    if elapsed >= threshold_ms() {
        tracing::warn!(
            target: "medoc::perf",
            event = "SLOW_CALL",
            label = label,
            duration_ms = elapsed,
            threshold_ms = threshold_ms(),
        );
    }
    out
}

/// Synchronous timer for tight code paths.
pub struct Timer {
    label: &'static str,
    start: Instant,
}

impl Timer {
    pub fn start(label: &'static str) -> Self {
        Self {
            label,
            start: Instant::now(),
        }
    }
}

impl Drop for Timer {
    fn drop(&mut self) {
        let elapsed = self.start.elapsed().as_millis() as u64;
        if elapsed >= threshold_ms() {
            tracing::warn!(
                target: "medoc::perf",
                event = "SLOW_BLOCK",
                label = self.label,
                duration_ms = elapsed,
            );
        }
    }
}
