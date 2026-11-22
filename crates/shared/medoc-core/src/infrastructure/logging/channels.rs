//! Log channel registry — the single source of truth for "which event goes to which file".
//!
//! Every event carries a `target` (`medoc::<area>`). A channel claims a set of target prefixes and gets its
//! own rolling JSON file. Anything no channel claims lands in `app.log`, and every WARN/ERROR from *any*
//! target is also copied to `errors.log`, the one file to open first when something goes wrong.
//!
//! Adding a channel = one entry in [`CHANNELS`]. Routing, the app.log exclusion list, export and retention
//! all derive from this table, so they can never drift apart again (they used to be three hand-kept lists).

/// One rolling log file and the targets it owns.
#[derive(Debug, Clone, Copy)]
pub struct Channel {
    /// Short name, written into `errors.log` lines as `channel` and used in docs.
    pub name: &'static str,
    /// File name inside the logs directory (daily rotation appends the date).
    pub file: &'static str,
    /// Target prefixes routed here (`medoc::sync` also matches `medoc::sync::engine`).
    pub targets: &'static [&'static str],
    /// What the channel is for (shown in docs/architecture/logging.md).
    pub purpose: &'static str,
}

pub const CHANNELS: &[Channel] = &[
    Channel {
        name: "security",
        file: "security.log",
        targets: &["medoc::security", "medoc::auth"],
        purpose: "Sign-in, lockouts, permission denials, licence and key events.",
    },
    Channel {
        name: "system",
        file: "system.log",
        targets: &["medoc::system", "medoc::workflow", "medoc::app", "medoc::native_menu", "medoc::onboarding"],
        purpose: "Start/stop, configuration, database lifecycle, backups, window and menu events.",
    },
    Channel {
        name: "network",
        file: "network.log",
        targets: &["medoc::sync", "medoc::cluster", "medoc::lan", "medoc::company", "medoc::http"],
        purpose: "LAN API requests, device discovery and pairing, replication and company portal traffic.",
    },
    Channel {
        name: "device",
        file: "device.log",
        targets: &["medoc::device"],
        purpose: "Imaging, GDT/TWAIN, USB and other attached-device events.",
    },
    Channel {
        name: "migration",
        file: "migration.log",
        targets: &["medoc::migration"],
        purpose: "Schema migrations and data imports.",
    },
    Channel {
        name: "perf",
        file: "perf.log",
        targets: &["medoc::perf"],
        purpose: "Slow commands, queries and requests (timings).",
    },
    Channel {
        name: "client",
        file: "client.log",
        targets: &["medoc::client"],
        purpose: "Errors and warnings reported by the user interface (log_client_event).",
    },
];

/// Default file for events no channel claims (clinical, staff, finance, …). Level is runtime-adjustable.
pub const APP_FILE: &str = "app.log";
/// Cross-cutting index: every WARN and ERROR from every target, whatever its channel.
pub const ERRORS_FILE: &str = "errors.log";

fn matches(target: &str, prefix: &str) -> bool {
    target == prefix || (target.starts_with(prefix) && target[prefix.len()..].starts_with("::"))
}

/// The channel that owns `target`, if any.
pub fn channel_for(target: &str) -> Option<&'static Channel> {
    CHANNELS
        .iter()
        .find(|c| c.targets.iter().any(|p| matches(target, p)))
}

/// Name written as `channel` in errors.log: the owning channel or `app`.
pub fn channel_name(target: &str) -> &'static str {
    channel_for(target).map_or("app", |c| c.name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_match_whole_segments_only() {
        assert_eq!(channel_name("medoc::sync"), "network");
        assert_eq!(channel_name("medoc::sync::engine"), "network");
        assert_eq!(channel_name("medoc::synchronizer"), "app");
        assert_eq!(channel_name("medoc::staff"), "app");
        assert_eq!(channel_name("medoc::client"), "client");
    }

    #[test]
    fn every_target_has_exactly_one_owner() {
        let mut seen = std::collections::HashSet::new();
        for c in CHANNELS {
            for t in c.targets {
                assert!(seen.insert(*t), "target {t} is claimed by two channels");
            }
        }
        let files: std::collections::HashSet<_> = CHANNELS.iter().map(|c| c.file).collect();
        assert_eq!(files.len(), CHANNELS.len(), "two channels share a file");
        assert!(!files.contains(APP_FILE) && !files.contains(ERRORS_FILE));
    }
}
