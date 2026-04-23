// Runtime-configurable log level (NFA-LOG-10)

use serde::{Deserialize, Serialize};
use std::sync::RwLock;
use tracing::Metadata;
use tracing_subscriber::EnvFilter;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum LogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

impl LogLevel {
    pub fn as_filter(&self) -> &'static str {
        match self {
            LogLevel::Error => "error",
            LogLevel::Warn => "warn",
            LogLevel::Info => "info",
            LogLevel::Debug => "debug",
            LogLevel::Trace => "trace",
        }
    }
}

pub struct LoggingConfig {
    level: RwLock<LogLevel>,
}

impl LoggingConfig {
    const fn new() -> Self {
        Self {
            level: RwLock::new(LogLevel::Info),
        }
    }

    pub fn set_level(&self, level: LogLevel) {
        *self.level.write().unwrap() = level;
    }

    pub fn level(&self) -> LogLevel {
        *self.level.read().unwrap()
    }

    /// Whether a log event should be written to the JSON `app.log` channel.
    /// Re-evaluated on every event so `set_log_level` takes effect immediately
    /// (the file layer uses `FilterFn`, not a one-shot `EnvFilter`).
    pub fn app_json_accepts(&self, meta: &Metadata<'_>) -> bool {
        let t = meta.target();
        if t.starts_with("medoc::security")
            || t.starts_with("medoc::system")
            || t.starts_with("medoc::device")
            || t.starts_with("medoc::migration")
            || t.starts_with("medoc::perf")
        {
            return false;
        }
        Self::level_accepts(self.level(), *meta.level())
    }

    fn level_accepts(configured: LogLevel, event_level: tracing::Level) -> bool {
        use tracing::Level;
        match configured {
            LogLevel::Trace => true,
            LogLevel::Debug => matches!(
                event_level,
                Level::ERROR | Level::WARN | Level::INFO | Level::DEBUG
            ),
            LogLevel::Info => matches!(event_level, Level::ERROR | Level::WARN | Level::INFO),
            LogLevel::Warn => matches!(event_level, Level::ERROR | Level::WARN),
            LogLevel::Error => matches!(event_level, Level::ERROR),
        }
    }

    /// Static filter string for tests / tooling only (startup filters use
    /// [`Self::app_json_accepts`] for runtime updates).
    pub fn app_filter(&self) -> EnvFilter {
        let lvl = self.level().as_filter();
        EnvFilter::new(format!(
            "{lvl},medoc::security=off,medoc::system=off,medoc::device=off,medoc::migration=off,medoc::perf=off"
        ))
    }
}

pub static LOGGING_CONFIG: LoggingConfig = LoggingConfig::new();
