//! Device-cluster cryptography — device identity, seat certs, SAS.

pub mod device_identity;
pub mod sas;
pub mod seat_cert;

pub use device_identity::{
    fingerprint_from_pubkey, fingerprint_matches_pubkey, forget_cached_device_identity,
    verify_channel_signature, ChannelPurpose, DeviceIdentity,
};
pub use sas::{
    decode_handshake_transcript, derive_sas_from_transcript, hash_sas, normalise_sas_input,
    transcript_sha_prefix, validate_sas_match, verify_sas, SAS_LEN,
};
pub use seat_cert::{mint_seat_certificate, verify_seat_certificate, SEAT_CERT_PREFIX};
