//! Device-cluster cryptography — device identity, seat certs, SAS.

pub mod device_identity;
pub mod sas;
pub mod seat_cert;

pub use device_identity::{fingerprint_from_pubkey, DeviceIdentity};
pub use sas::{
    derive_sas_from_transcript, hash_sas, normalise_sas_input, validate_sas_match, verify_sas,
    SAS_LEN,
};
pub use seat_cert::{mint_seat_certificate, verify_seat_certificate, SEAT_CERT_PREFIX};
