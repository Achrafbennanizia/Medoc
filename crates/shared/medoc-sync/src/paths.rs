//! LAN sync routes. The client and `medoc-lan` both use these.
//! Axum mounts `route` under [`API_PREFIX`].

pub const API_PREFIX: &str = "/api/v1";

pub const SYNC_PUSH: &str = "/sync/push";
pub const SYNC_PULL: &str = "/sync/pull";
/// One round trip: the caller’s pending packets go in, the callee’s pending
/// packets come back. Both the main device and a replica serve and call it.
pub const SYNC_EXCHANGE: &str = "/sync/exchange";
pub const SYNC_STATUS: &str = "/sync/status";
pub const SYNC_DIGEST: &str = "/sync/digest";
pub const SYNC_ROW_HASHES: &str = "/sync/row-hashes";
pub const SYNC_ROWS: &str = "/sync/rows";
pub const SYNC_NUMBER: &str = "/sync/number";
/// Group: the primary reserves a number block for the second admin hub (T4.3).
pub const SYNC_NUMBER_BLOCK: &str = "/sync/number-block";
/// Group mode O: signed copies of other devices' changes after the caller's vector (T4.1).
pub const SYNC_ORIGIN_PULL: &str = "/sync/origin-pull";
pub const SYNC_BLOB: &str = "/sync/blob";
pub const SYNC_BLOB_PREFIX: &str = "/sync/blob/";
pub const SYNC_BLOB_ROUTE: &str = "/sync/blob/{sha256}";

pub fn api_url(base: &str, route: &str) -> String {
    format!("{}{API_PREFIX}{route}", base.trim_end_matches('/'))
}

pub fn blob_url(base: &str, sha: &str) -> String {
    format!(
        "{}{API_PREFIX}{SYNC_BLOB}/{sha}",
        base.trim_end_matches('/')
    )
}
