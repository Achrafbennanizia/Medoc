//! Geräteverbund application services.

pub mod audit;
pub mod lizenz_service;
pub mod provisioning_service;
pub mod verbund_service;

pub use lizenz_service::{activate_cluster_license, verbund_status, VerbundStatus};
pub use provisioning_service::{apply_provisioning, is_local_provisioned, ProvisionResult};
pub use verbund_service::{
    accept_join_request, block_device, create_join_request, list_devices, list_pending_requests,
    reclaim_stale_seat, reject_join_request, revoke_device, submit_sas, unblock_device,
    verify_peer_connection, GeraetView, KopplungHandle, PendingRequest, SasCode,
};
