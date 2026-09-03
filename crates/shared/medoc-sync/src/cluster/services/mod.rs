//! Device-cluster application services.

pub mod install_plan_service;
pub mod cluster_reset_service;
pub mod audit;
pub mod license_service;
pub mod provisioning_service;
pub mod staff_directory;
pub mod cluster_service;

pub use install_plan_service::{
    apply_install_plan, apply_install_plan_from_license_v2, consume_default_sidecar_and_apply,
    consume_pending_sidecar_and_apply,     get_provisioning_window, plan_includes_server, read_deployment_mode,
    run_provisioning_tasks, ApplyInstallPlanResult,
};
pub use cluster_reset_service::{
    cluster_reset_preview, execute_member_cluster_reset, execute_owner_cluster_reset,
    persist_cluster_ca_pubkey, queue_verified_remote_reset, apply_queued_remote_reset_if_any,
    wipe_desktop_network_state, ClusterResetMode, ClusterResetPreview, ClusterResetReport,
};
pub use crate::cluster::activation::{import_owner_activation, ActivationSummary};
pub use license_service::{
    activate_cluster_license, enable_lan_auto_start, mint_and_activate_usb_owner_license, needs_cluster_onboarding, require_owner_activation_device,
    require_owner_admin,
    require_owner_vendor_license, cluster_network_ready, cluster_status, ImportActivationResult,
    ClusterStatus,
};
pub use provisioning_service::{apply_provisioning, is_local_provisioned, ProvisionResult};
pub use staff_directory::{
    export_staff_directory_json, fetch_provisioning_settings_json, import_staff_directory_json,
    store_join_admin_endpoint, sync_staff_from_stored_admin_endpoint,
    sync_staff_from_stored_admin_endpoint_required,
};
pub use cluster_service::{
    accept_join_request, block_device, create_join_request, list_devices, list_pending_requests,
    mirror_join_session, reclaim_stale_seat, reject_join_request, revoke_device, submit_sas,
    unblock_device, verify_peer_connection, DeviceView, JoinRequestResult, PairingHandle,
    PendingRequest, SasCode,
};
