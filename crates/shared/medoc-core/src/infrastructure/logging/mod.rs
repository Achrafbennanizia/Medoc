// Logging & Observability infrastructure (NFA-LOG-01..10)
//
// 8 log channels:
//   - app.log         : structured application log (JSON)
//   - security.log    : auth events, brute-force lockouts
//   - system.log      : start/stop, config, migrations, updates
//   - device.log      : DICOM/GDT/TWAIN/USB events
//   - migration.log   : import operations
//   - perf.log        : slow requests / queries
//   - workflow.log    : frontend workflow lifecycle (route/action/result)
//   - audit_log (DB)  : user actions (handled separately by audit_repo)

pub mod brute_force;
pub mod config;
pub mod export;
pub mod sanitizer;

use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::filter::FilterFn;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::{EnvFilter, Layer, Registry};

pub use config::{LogLevel, LoggingConfig, LOGGING_CONFIG};

/// Hold the worker guards so the non-blocking appenders flush on shutdown.
pub struct LogGuards {
    _app: WorkerGuard,
    _security: WorkerGuard,
    _system: WorkerGuard,
    _device: WorkerGuard,
    _migration: WorkerGuard,
    _perf: WorkerGuard,
    _workflow: WorkerGuard,
}

static LOG_DIR: OnceLock<PathBuf> = OnceLock::new();

pub fn log_dir() -> Result<&'static Path, crate::error::AppError> {
    LOG_DIR
        .get()
        .map(|p| p.as_path())
        .ok_or_else(|| crate::error::AppError::Internal("Logging nicht initialisiert".into()))
}

/// Initialise the global tracing subscriber with 7 file layers.
/// Must be called exactly once during application start-up.
pub fn init(data_dir: &Path) -> Result<LogGuards, std::io::Error> {
    let logs = data_dir.join("logs");
    std::fs::create_dir_all(&logs)?;
    LOG_DIR.set(logs.clone()).ok();

    // Each appender rotates daily; size-based pruning is enforced via a janitor.
    let app_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "app.log");
    let security_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "security.log");
    let system_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "system.log");
    let device_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "device.log");
    let migration_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "migration.log");
    let perf_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "perf.log");
    let workflow_appender = RollingFileAppender::new(Rotation::DAILY, &logs, "workflow.log");

    let (app_w, app_g) = tracing_appender::non_blocking(app_appender);
    let (sec_w, sec_g) = tracing_appender::non_blocking(security_appender);
    let (sys_w, sys_g) = tracing_appender::non_blocking(system_appender);
    let (dev_w, dev_g) = tracing_appender::non_blocking(device_appender);
    let (mig_w, mig_g) = tracing_appender::non_blocking(migration_appender);
    let (perf_w, perf_g) = tracing_appender::non_blocking(perf_appender);
    let (workflow_w, workflow_g) = tracing_appender::non_blocking(workflow_appender);

    let json = |writer| {
        tracing_subscriber::fmt::layer()
            .json()
            .with_current_span(false)
            .with_span_events(FmtSpan::NONE)
            .with_writer(SanitizingMakeWriter::new(writer))
    };

    // Filter by `target` so each channel only catches its own messages.
    // Collected into a Vec because `Vec<L>` implements `Layer<S>` whenever
    // each inner `L` does, allowing arbitrary stacking on a single Registry.
    type BoxedLayer = Box<dyn Layer<Registry> + Send + Sync + 'static>;

    let layers: Vec<BoxedLayer> = vec![
        tracing_subscriber::fmt::layer()
            .with_target(true)
            .with_filter(
                EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
            )
            .boxed(),
        json(app_w)
            .with_filter(FilterFn::new(|meta| LOGGING_CONFIG.app_json_accepts(meta)))
            .boxed(),
        json(sec_w)
            .with_filter(EnvFilter::new("medoc::security=info"))
            .boxed(),
        json(sys_w)
            .with_filter(EnvFilter::new("medoc::system=info"))
            .boxed(),
        json(dev_w)
            .with_filter(EnvFilter::new("medoc::device=info"))
            .boxed(),
        json(mig_w)
            .with_filter(EnvFilter::new("medoc::migration=info"))
            .boxed(),
        json(perf_w)
            .with_filter(EnvFilter::new("medoc::perf=info"))
            .boxed(),
        json(workflow_w)
            .with_filter(EnvFilter::new("medoc::workflow=info"))
            .boxed(),
    ];

    Registry::default().with(layers).init();

    Ok(LogGuards {
        _app: app_g,
        _security: sec_g,
        _system: sys_g,
        _device: dev_g,
        _migration: mig_g,
        _perf: perf_g,
        _workflow: workflow_g,
    })
}

#[derive(Clone)]
struct SanitizingMakeWriter<W> {
    inner: W,
}

impl<W> SanitizingMakeWriter<W> {
    fn new(inner: W) -> Self {
        Self { inner }
    }
}

impl<'a, W> MakeWriter<'a> for SanitizingMakeWriter<W>
where
    W: MakeWriter<'a> + Clone + Send + Sync + 'static,
    W::Writer: Write,
{
    type Writer = SanitizingWriter<W::Writer>;

    fn make_writer(&'a self) -> Self::Writer {
        SanitizingWriter::new(self.inner.make_writer())
    }
}

struct SanitizingWriter<W: Write> {
    inner: W,
    pending: Vec<u8>,
}

impl<W: Write> SanitizingWriter<W> {
    fn new(inner: W) -> Self {
        Self {
            inner,
            pending: Vec::new(),
        }
    }

    fn flush_ready_lines(&mut self, flush_tail: bool) -> io::Result<()> {
        while let Some(newline_idx) = self.pending.iter().position(|b| *b == b'\n') {
            let chunk: Vec<u8> = self.pending.drain(..=newline_idx).collect();
            self.write_sanitized(&chunk)?;
        }
        if flush_tail && !self.pending.is_empty() {
            let tail = std::mem::take(&mut self.pending);
            self.write_sanitized(&tail)?;
        }
        Ok(())
    }

    fn write_sanitized(&mut self, bytes: &[u8]) -> io::Result<()> {
        let text = String::from_utf8_lossy(bytes);
        let redacted = sanitizer::sanitize(&text);
        self.inner.write_all(redacted.as_bytes())
    }
}

impl<W: Write> Write for SanitizingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        self.pending.extend_from_slice(buf);
        self.flush_ready_lines(false)?;
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        self.flush_ready_lines(true)?;
        self.inner.flush()
    }
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

#[macro_export]
macro_rules! log_workflow {
    ($lvl:ident, $($arg:tt)+) => {
        tracing::$lvl!(target: "medoc::workflow", $($arg)+)
    };
}
