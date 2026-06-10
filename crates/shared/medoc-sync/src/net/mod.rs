//! Geräteverbund network stack (L3–L7).

pub mod bind_guard;
pub mod discovery;
pub mod listener;
pub mod transport;
pub mod wire;

pub use bind_guard::{assert_private_bind, is_private_lan_address};
pub use discovery::{scan_admins, AdminEndpoint, MdnsResponder};
pub use listener::{bind_verbund_listener, DEFAULT_VERBUND_PORT};
pub use transport::{
    complete_xx_handshake, generate_keypair, NoiseHandshake, NoiseTransport, NOISE_KK, NOISE_XX,
};
pub use wire::{decode_frame, encode_frame, read_frame, write_frame, WireMessage};
