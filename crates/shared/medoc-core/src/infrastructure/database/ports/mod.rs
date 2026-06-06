//! Repository ports — depend on traits in tests/alternate backends, not SQLx details.

mod pool;

pub use pool::{DatabasePool, SqlitePoolHandle};
