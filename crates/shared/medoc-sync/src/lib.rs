//! MeDoc serverless / peer replication.
//!
//! Devices keep a local SQLCipher database. Mutations are appended to an
//! **outbox** with a per-device sequence. A designated **master** device
//! arbitrates conflicts; **replicas** queue changes while offline and push
//! when the master is reachable (direct HTTPS on the LAN — no central server).

pub mod deployment;
pub mod engine;
pub mod master_keys;
pub mod merge;
pub mod pairing;
pub mod ports;
pub mod repo;
pub mod schema;

pub use deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
pub use engine::{SyncEngine, SyncPullResult, SyncPushResult, SyncRunReport};
pub use merge::ConflictPolicy;
pub use pairing::{
    ActivationTokenPayload, PairingDecision, PairingRequest, PairingRequestSubmit,
    ACTIVATION_TOKEN_PREFIX, DEFAULT_ALLOWED_ACTIONS,
};
pub use ports::{PairingPersistence, SqlitePairingStore, SqliteSyncStore, SyncReplicationStore};
pub use repo::{OutboxEntry, SyncPeer, SyncStatusSnapshot};
