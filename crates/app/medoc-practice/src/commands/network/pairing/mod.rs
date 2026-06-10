//! Tauri IPC for master/replica pairing.
//!
//! | Submodule | Responsibility |
//! |-----------|----------------|
//! | [`master`] | Inbox list/decide/revoke, master pubkey |
//! | [`replica`] | Submit request, poll status, confirm PIN, persist token |
//! | [`discovery_lan`] | UDP scan for LAN masters |
//! | [`discovery_ble`] | BLE central scan for masters |
//! | [`types`] | IPC DTOs shared with the frontend |
//! | [`support`] | License gate, HTTP client, device id helpers |

pub mod discovery_ble;
pub mod discovery_lan;
pub mod master;
pub mod replica;
mod support;
mod types;

pub use discovery_ble::pairing_scan_bluetooth;
pub use discovery_lan::pairing_scan_lan;
pub use master::{
    pairing_decide, pairing_list_all, pairing_list_pending, pairing_master_info, pairing_revoke,
};
pub use replica::{
    pairing_check_status, pairing_confirm_pin, pairing_persist_token, pairing_submit_request,
};
pub use types::{
    DiscoveredMaster, PairingCheckStatusPayload, PairingConfirmPinPayload, PairingDecidePayload,
    PairingMasterInfo, PairingPersistTokenPayload, PairingScanPayload, PairingSubmitPayload,
    PairingSubmitResult,
};

#[macro_export]
macro_rules! register_pairing_commands {
    () => {
        $crate::commands::network::pairing::master::pairing_list_pending,
        $crate::commands::network::pairing::master::pairing_list_all,
        $crate::commands::network::pairing::master::pairing_decide,
        $crate::commands::network::pairing::replica::pairing_confirm_pin,
        $crate::commands::network::pairing::master::pairing_revoke,
        $crate::commands::network::pairing::master::pairing_master_info,
        $crate::commands::network::pairing::discovery_lan::pairing_scan_lan,
        $crate::commands::network::pairing::discovery_ble::pairing_scan_bluetooth,
        $crate::commands::network::pairing::replica::pairing_submit_request,
        $crate::commands::network::pairing::replica::pairing_check_status,
        $crate::commands::network::pairing::replica::pairing_persist_token,
    };
}
