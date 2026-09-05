//! Schema evolution: SQLx file migrations, legacy ALTER paths, sync DDL, demo seed.

mod english_schema_upgrade;
mod legacy_embedded;
mod rust_only;
mod seed;
mod seed_year;
mod seed_practice;
mod sync_tables;
mod cluster_tables;

pub use english_schema_upgrade::{run_english_schema_upgrade, schema_already_present};
pub use legacy_embedded::run_legacy_embedded_migrations;
pub use rust_only::run_rust_only_migrations;
pub use seed::run_post_migration_seed;
pub use cluster_tables::ensure_cluster_tables;
