// Logging & Observability infrastructure (NFA-LOG-01..10).
//
// Architecture (see docs/architecture/logging.md):
//   events  ─ tracing macros with `target: "medoc::<area>"` and `event = "UPPER_SNAKE"`
//      │
//      ├─ console (stderr, RUST_LOG filter)
//      ├─ one rolling JSON file per channel in `channels::CHANNELS` (security, system, network, …)
//      ├─ app.log    : every target no channel claims (runtime level, `set_log_level`)
//      └─ errors.log : every WARN/ERROR from any target — the first file to open when something fails
//   audit_log (DB) : user actions, tamper-evident (handled by audit_repo, not here)
//
// All file writers go through `redacting_writer` so personal data is masked before it reaches disk.

pub mod brute_force;
pub mod channels;
pub mod config;
pub mod export;
pub mod redacting_writer;
pub mod sanitizer;

use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::filter::FilterFn;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Layer, Registry};

pub use channels::{channel_for, channel_name, Channel, APP_FILE, CHANNELS, ERRORS_FILE};
pub use config::{LogLevel, LoggingConfig, LOGGING_CONFIG};

/// Hold the worker guards so the non-blocking appenders flush on shutdown.
pub struct LogGuards {
    _guards: Vec<WorkerGuard>,
}

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn log_dir() -> Result<&'static Path, crate::error::AppError> {
    LOG_DIR
        .get()
        .map(|p| p.as_path())
        .ok_or_else(|| crate::error::AppError::Internal("Logging not initialized".into()))
}

type BoxedLayer = Box<dyn Layer<Registry> + Send + Sync + 'static>;

/// Initialise the global tracing subscriber: console + one file per channel + app.log + errors.log.
/// Must be called exactly once during application start-up.
pub fn init(data_dir: &Path) -> Result<LogGuards, std::io::Error> {
    let logs = data_dir.join("logs");
    std::fs::create_dir_all(&logs)?;
    LOG_DIR.set(logs.clone()).ok();

    let mut guards = Vec::with_capacity(CHANNELS.len() + 2);
    let mut layers: Vec<BoxedLayer> = Vec::with_capacity(CHANNELS.len() + 3);

    // Rolling daily file → non-blocking writer → redaction → JSON layer.
    let mut json_file = |file: &str| {
        let (writer, guard) =
            tracing_appender::non_blocking(RollingFileAppender::new(Rotation::DAILY, &logs, file));
        guards.push(guard);
        tracing_subscriber::fmt::layer()
            .json()
            .with_current_span(true)
            .with_span_events(FmtSpan::NONE)
            .with_writer(redacting_writer::SanitizingMakeWriter(writer))
    };

    layers.push(
        tracing_subscriber::fmt::layer()
            .with_target(true)
            .with_filter(
                EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
            )
            .boxed(),
    );
    for channel in CHANNELS {
        let owned: &'static Channel = channel;
        layers.push(
            json_file(channel.file)
                .with_filter(FilterFn::new(move |meta| {
                    *meta.level() <= tracing::Level::INFO
                        && channel_for(meta.target()).is_some_and(|c| std::ptr::eq(c, owned))
                }))
                .boxed(),
        );
    }
    layers.push(
        json_file(APP_FILE)
            .with_filter(FilterFn::new(|meta| LOGGING_CONFIG.app_json_accepts(meta)))
            .boxed(),
    );
    layers.push(
        json_file(ERRORS_FILE)
            .with_filter(FilterFn::new(|meta| *meta.level() <= tracing::Level::WARN))
            .boxed(),
    );

    Registry::default().with(layers).init();

    Ok(LogGuards { _guards: guards })
}

/// Run `f` inside a span named after an operation, so every event it logs (in any file) carries
/// `op` and `op_id`. Use for commands and requests: one id ties all their log lines together.
pub fn op_span(op: &'static str) -> tracing::Span {
    let op_id = crate::error::correlation_ref();
    tracing::info_span!("op", op, op_id = %op_id)
}

// --- Convenience macros ------------------------------------------------------
// Each channel uses a dedicated target so the layer filters route correctly.

#[macro_export]
macro_rules! log_security {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::security", $($arg)+)
    };
}

#[macro_export]
macro_rules! log_system {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::system", $($arg)+)
    };
}

#[macro_export]
macro_rules! log_workflow {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::workflow", $($arg)+)
    };
}

#[macro_export]
macro_rules! log_device {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::device", $($arg)+)
    };
}

#[macro_export]
macro_rules! log_migration {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::migration", $($arg)+)
    };
}

#[macro_export]
macro_rules! log_perf {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::perf", $($arg)+)
    };
}
