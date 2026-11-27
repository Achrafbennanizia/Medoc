//! MeDoc serverless / peer replication.
//!
//! Devices keep a local SQLCipher database. Mutations are appended to an
//! **outbox** with a per-device sequence. A designated **master** device
//! arbitrates conflicts; **replicas** queue changes while offline and push
//! when the master is reachable (direct HTTPS on the LAN — no central server).

pub mod blob_resume;
pub mod cluster;
pub mod deployment;
pub mod durable_queue;
pub mod engine;
pub mod entry_signature;
pub mod hlc;
pub mod master_keys;
pub mod merge;
/// Practice-network transport (mDNS, Noise, TCP). Off in one-device builds (`net` feature),
/// where `net_offline.rs` stands in.
#[cfg(feature = "net")]
pub mod net;
#[cfg(not(feature = "net"))]
#[path = "net_offline.rs"]
pub mod net;
pub mod net_types;
pub mod numbering;
pub mod outbound_http_log;
pub mod pairing;
pub mod paths;
pub mod problems;
pub mod protocol_compat;
pub mod push_body;
pub mod reconcile;
pub mod repo;
pub mod schema;
pub mod tls_pin;
pub mod watch;

pub use deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
pub use engine::{SyncEngine, SyncPullResult, SyncPushResult, SyncRunReport};
pub use merge::ConflictPolicy;
pub use pairing::{
    ActivationTokenPayload, PairingDecideResult, PairingDecision, PairingRequest,
    PairingRequestSubmit, ACTIVATION_TOKEN_PREFIX, DEFAULT_ALLOWED_ACTIONS,
};
pub use repo::{InitialCopyStatus, OutboxEntry, SyncPeer, SyncStatusSnapshot};
