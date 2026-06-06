//! Schema evolution: SQLx file migrations, legacy ALTER paths, sync DDL, demo seed.

mod legacy_embedded;
mod rust_only;
mod seed;
mod sync_tables;

pub use legacy_embedded::run_legacy_embedded_migrations;
pub use rust_only::run_rust_only_migrations;
pub use seed::run_post_migration_seed;
