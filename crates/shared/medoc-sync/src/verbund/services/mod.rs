//! Geräteverbund application services.

pub mod cluster_reset_service;
pub mod audit;
pub mod lizenz_service;
pub mod provisioning_service;
pub mod staff_directory;
pub mod verbund_service;

pub use cluster_reset_service::{
    cluster_reset_preview, execute_member_cluster_reset, execute_owner_cluster_reset,
    persist_cluster_ca_pubkey, queue_verified_remote_reset, apply_queued_remote_reset_if_any,
    wipe_desktop_network_state, ClusterResetMode, ClusterResetPreview, ClusterResetReport,
};
pub use crate::verbund::activation::{import_owner_activation, ActivationSummary};
pub use lizenz_service::{
    activate_cluster_license, needs_verbund_onboarding, require_owner_activation_device,
    require_owner_admin,
    require_owner_vendor_license, verbund_network_ready, verbund_status, ImportActivationResult,
    VerbundStatus,
};
pub use provisioning_service::{apply_provisioning, is_local_provisioned, ProvisionResult};
pub use staff_directory::{
    export_staff_directory_json, fetch_provisioning_settings_json, import_staff_directory_json,
    store_join_admin_endpoint, sync_staff_from_stored_admin_endpoint,
    sync_staff_from_stored_admin_endpoint_required,
};
pub use verbund_service::{
    accept_join_request, block_device, create_join_request, list_devices, list_pending_requests,
    mirror_join_session, reclaim_stale_seat, reject_join_request, revoke_device, submit_sas,
    unblock_device, verify_peer_connection, GeraetView, JoinRequestResult, KopplungHandle,
    PendingRequest, SasCode,
};
