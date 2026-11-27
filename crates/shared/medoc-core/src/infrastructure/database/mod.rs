//! SQLCipher database layer — connection, migrations, domain-grouped repos.
//!
//! - [`connection`], [`db_key`], [`sqlcipher`] — pool lifecycle
//! - [`migrations`] — schema evolution
//! - [`repos`] — repository implementations by domain

pub mod migrations;
pub mod repos;

pub mod actor;
pub mod change_record;
pub mod connection;
pub mod db_key;
pub mod field_hlc;
pub mod hlc;
pub mod number_sequence;
pub mod recorded_write;
pub mod sqlcipher;
pub mod sqlite_error;
pub mod sync_blob;
pub mod sync_outbox;
pub mod sync_registry;
