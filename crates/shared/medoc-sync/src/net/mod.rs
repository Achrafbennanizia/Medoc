//! Geräteverbund network stack (L3–L7).

pub mod bind_guard;
pub mod channel;
pub mod discovery;
pub mod handshake;
pub mod join_client;
pub mod join_handler;
pub mod listener;
pub mod member_cluster_watch;
pub mod reset_broadcast;
pub mod transport;
pub mod wire;

pub use bind_guard::{assert_private_bind, is_private_lan_address};
pub use channel::{recv_wire_message, send_wire_message};
pub use discovery::{scan_admins, AdminEndpoint, MdnsResponder};
pub use handshake::{run_xx_initiator, run_xx_responder};
pub use join_client::{fetch_staff_directory, join_admin_endpoint, JoinOutcome};
pub use join_handler::{handle_join_connection, handle_verbund_connection, spawn_verbund_connection_handler};
pub use listener::{bind_verbund_listener, DEFAULT_VERBUND_PORT};
pub use transport::{
    complete_xx_handshake, generate_keypair, NoiseHandshake, NoiseTransport, NOISE_KK, NOISE_XX,
};
pub use wire::{decode_frame, encode_frame, read_frame, write_frame, WireMessage};
