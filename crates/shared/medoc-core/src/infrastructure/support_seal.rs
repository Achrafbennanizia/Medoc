//! Sealing to the vendor support key (T7.1, docs/architecture/editions-plan.md §11.2).
//!
//! Support bundles, error reports and health reports leave the practice encrypted so only the vendor
//! can read them (the mail server, the USB stick or a later company server cannot).
//!
//! Format `MDSB` v1:
//! `"MDSB" | 0x01 | key id (8) | ephemeral X25519 public key (32) | nonce (24) | ciphertext`
//! - key = HKDF-SHA256(ikm = X25519(ephemeral, vendor), salt = ephemeral ‖ vendor, info = "medoc-support-seal-v1")
//! - XChaCha20-Poly1305, associated data = the whole header, so no header byte can be changed.
//! - key id = first 8 bytes of SHA-256(vendor public key): a rotated key still opens old files
//!   (the vendor tool picks the secret by id; `docs/operations/vendor-key-rotation.md`).

use chacha20poly1305::aead::{Aead, KeyInit, Payload};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use hkdf::Hkdf;
use rand::RngCore;
use sha2::{Digest, Sha256};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::error::AppError;

include!(concat!(env!("OUT_DIR"), "/support_pubkey.rs"));

const MAGIC: &[u8; 4] = b"MDSB";
const VERSION: u8 = 1;
const INFO: &[u8] = b"medoc-support-seal-v1";
const HEADER_LEN: usize = 4 + 1 + 8 + 32 + 24;

/// Published development secret: builds without `MEDOC_VENDOR_SUPPORT_PUBKEY` seal to its public key,
/// so their bundles are readable by anyone. Never used when the release key is set.
pub const DEV_SUPPORT_SECRET: [u8; 32] = *b"medoc-dev-support-key-not-secret";

/// The vendor support public key this build seals to.
pub fn vendor_support_pubkey() -> [u8; 32] {
    VENDOR_SUPPORT_PUBKEY.unwrap_or_else(|| public_key_of(&DEV_SUPPORT_SECRET))
}

/// True when this build seals to the published dev key (support should not rely on privacy).
pub fn uses_dev_key() -> bool {
    VENDOR_SUPPORT_PUBKEY.is_none()
}

pub fn public_key_of(secret: &[u8; 32]) -> [u8; 32] {
    PublicKey::from(&StaticSecret::from(*secret)).to_bytes()
}

pub fn key_id(public: &[u8; 32]) -> [u8; 8] {
    let digest = Sha256::digest(public);
    let mut id = [0u8; 8];
    id.copy_from_slice(&digest[..8]);
    id
}

fn derive(shared: &[u8], eph: &[u8; 32], recipient: &[u8; 32]) -> [u8; 32] {
    let mut salt = [0u8; 64];
    salt[..32].copy_from_slice(eph);
    salt[32..].copy_from_slice(recipient);
    let mut key = [0u8; 32];
    Hkdf::<Sha256>::new(Some(&salt), shared)
        .expand(INFO, &mut key)
        .expect("32 bytes is a valid HKDF length");
    key
}

/// Seals `plain` to `recipient` (normally [`vendor_support_pubkey`]).
pub fn seal_to(recipient: &[u8; 32], plain: &[u8]) -> Result<Vec<u8>, AppError> {
    let mut eph_bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut eph_bytes);
    let eph = StaticSecret::from(eph_bytes);
    let eph_pub = PublicKey::from(&eph).to_bytes();
    let shared = eph.diffie_hellman(&PublicKey::from(*recipient));
    let key = derive(shared.as_bytes(), &eph_pub, recipient);
    let mut nonce = [0u8; 24];
    rand::rngs::OsRng.fill_bytes(&mut nonce);

    let mut out = Vec::with_capacity(HEADER_LEN + plain.len() + 16);
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&key_id(recipient));
    out.extend_from_slice(&eph_pub);
    out.extend_from_slice(&nonce);
    let cipher = XChaCha20Poly1305::new((&key).into())
        .encrypt(
            XNonce::from_slice(&nonce),
            Payload {
                msg: plain,
                aad: &out[..HEADER_LEN],
            },
        )
        .map_err(|_| AppError::Internal("support seal failed".into()))?;
    out.extend_from_slice(&cipher);
    Ok(out)
}

/// Seals to this build's vendor support key.
pub fn seal(plain: &[u8]) -> Result<Vec<u8>, AppError> {
    seal_to(&vendor_support_pubkey(), plain)
}

/// The key id a sealed file was made for (lets the vendor tool pick the right secret).
pub fn sealed_key_id(sealed: &[u8]) -> Option<[u8; 8]> {
    if sealed.len() < HEADER_LEN || &sealed[..4] != MAGIC || sealed[4] != VERSION {
        return None;
    }
    let mut id = [0u8; 8];
    id.copy_from_slice(&sealed[5..13]);
    Some(id)
}

/// Opens a sealed file with the vendor secret (vendor tool and tests only).
pub fn open(secret: &[u8; 32], sealed: &[u8]) -> Result<Vec<u8>, AppError> {
    let bad = || AppError::Validation("not a MeDoc support file, or not for this key".into());
    let id = sealed_key_id(sealed).ok_or_else(bad)?;
    let recipient = public_key_of(secret);
    if id != key_id(&recipient) {
        return Err(bad());
    }
    let mut eph_pub = [0u8; 32];
    eph_pub.copy_from_slice(&sealed[13..45]);
    let nonce = &sealed[45..HEADER_LEN];
    let shared = StaticSecret::from(*secret).diffie_hellman(&PublicKey::from(eph_pub));
    let key = derive(shared.as_bytes(), &eph_pub, &recipient);
    XChaCha20Poly1305::new((&key).into())
        .decrypt(
            XNonce::from_slice(nonce),
            Payload {
                msg: &sealed[HEADER_LEN..],
                aad: &sealed[..HEADER_LEN],
            },
        )
        .map_err(|_| bad())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_sealed_file_opens_only_with_the_vendor_secret() {
        let secret = [7u8; 32];
        let sealed = seal_to(&public_key_of(&secret), b"logs and health").unwrap();
        assert_eq!(open(&secret, &sealed).unwrap(), b"logs and health");
        assert!(open(&[8u8; 32], &sealed).is_err(), "other key");
    }

    #[test]
    fn any_changed_byte_is_refused() {
        let secret = [7u8; 32];
        let sealed = seal_to(&public_key_of(&secret), b"x").unwrap();
        for i in [0, 5, 20, 50, sealed.len() - 1] {
            let mut bad = sealed.clone();
            bad[i] ^= 1;
            assert!(open(&secret, &bad).is_err(), "byte {i}");
        }
    }

    #[test]
    fn dev_builds_seal_to_the_published_dev_key() {
        if !uses_dev_key() {
            return;
        }
        let sealed = seal(b"dev").unwrap();
        assert_eq!(open(&DEV_SUPPORT_SECRET, &sealed).unwrap(), b"dev");
    }
}
