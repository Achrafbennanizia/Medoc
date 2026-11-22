//! Schema evolution: SQLx file migrations, legacy ALTER paths, sync DDL, demo seed.

mod cluster_tables;
mod english_schema_upgrade;
mod contract_activation_columns;
mod goz_billing_columns;
mod issued_documents;
mod legacy_embedded;
mod rust_only;
mod seed;
mod seed_practice;
mod seed_workday;
mod seed_year;
mod status_checks;
mod sync_tables;

pub use cluster_tables::ensure_cluster_tables;
pub use english_schema_upgrade::{run_english_schema_upgrade, schema_already_present};
pub use legacy_embedded::run_legacy_embedded_migrations;
pub use rust_only::run_rust_only_migrations;
pub use seed::run_post_migration_seed;
pub use status_checks::{rewrite_check, widen_status_checks, STATUS_CHECKS};
pub use sync_tables::{ensure_packet_queue, ensure_sync_replication_tables};
