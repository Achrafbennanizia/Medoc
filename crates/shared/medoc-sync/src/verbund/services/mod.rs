//! Geräteverbund application services.

pub mod audit;
pub mod lizenz_service;
pub mod provisioning_service;
pub mod verbund_service;

pub use crate::verbund::activation::{import_owner_activation, ActivationSummary};
pub use lizenz_service::{
    activate_cluster_license, needs_verbund_onboarding, require_owner_activation_device,
    require_owner_admin,
    require_owner_vendor_license, verbund_network_ready, verbund_status, ImportActivationResult,
    VerbundStatus,
};
pub use provisioning_service::{apply_provisioning, is_local_provisioned, ProvisionResult};
pub use verbund_service::{
    accept_join_request, block_device, create_join_request, list_devices, list_pending_requests,
    mirror_join_session, reclaim_stale_seat, reject_join_request, revoke_device, submit_sas,
    unblock_device, verify_peer_connection, GeraetView, JoinRequestResult, KopplungHandle,
    PendingRequest, SasCode,
};
