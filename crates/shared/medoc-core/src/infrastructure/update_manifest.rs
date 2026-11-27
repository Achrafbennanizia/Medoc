//! Signed update manifests per edition × flavor (T7.5, docs/architecture/editions-plan.md §11.6).
//!
//! Each release publishes `latest-<edition>-<flavor>[-early].json`. The file is the Tauri updater's
//! own manifest (version, notes, pub_date, platforms with the minisign signature of each package)
//! plus a `medoc` block: release kind, minimum supported version, sync protocol and schema version,
//! notes in four languages, edition, flavor and channel. The `medoc` block is signed with the vendor
//! Ed25519 key (`VENDOR_PUBKEY`) by `scripts/make-update-manifest.mjs`, so a package needs both
//! signatures: Tauri's on the package and the vendor's on what the package claims to be.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::infrastructure::crypto::sig::verify_ed25519;
use crate::infrastructure::license::VENDOR_PUBKEY;

/// Sync wire protocol of this build; a peer whose manifest says otherwise pauses sync (T7.6).
/// 2 (T5.8): every change carries its author (`syncActor`) inside the signed payload.
pub const SYNC_PROTOCOL: u32 = 2;
/// Oldest peer protocol this build still syncs with (§11.6). 2: protocol-1 devices pause with
/// "update needed" until they update (owner decision 2026-11-27, T5.8 plan D1).
pub const MIN_SYNC_PROTOCOL: u32 = 2;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Feature,
    Security,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
    Stable,
    Early,
}

impl Channel {
    pub fn parse(raw: &str) -> Channel {
        if raw.eq_ignore_ascii_case("early") {
            Channel::Early
        } else {
            Channel::Stable
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MedocBlock {
    pub version: String,
    pub kind: Kind,
    pub min_supported: String,
    pub sync_protocol: u32,
    pub schema_version: u32,
    pub edition: String,
    pub flavor: String,
    pub channel: Channel,
    /// `en`, `de`, `fr`, `ar`.
    #[serde(default)]
    pub notes: BTreeMap<String, String>,
    /// Vendor Ed25519 signature (base64, no padding) over [`MedocBlock::signed_bytes`].
    #[serde(default)]
    pub signature: String,
}

impl MedocBlock {
    /// What the vendor signs. Notes go in as a SHA-256 so their wording can't be swapped either.
    pub fn signed_bytes(&self) -> Vec<u8> {
        let mut h = Sha256::new();
        for (lang, text) in &self.notes {
            h.update(lang.as_bytes());
            h.update([0]);
            h.update(text.as_bytes());
            h.update([0]);
        }
        let kind = match self.kind {
            Kind::Feature => "feature",
            Kind::Security => "security",
        };
        let channel = match self.channel {
            Channel::Stable => "stable",
            Channel::Early => "early",
        };
        format!(
            "medoc-update-v1|{}|{kind}|{}|{}|{}|{}|{}|{channel}|{}",
            self.version,
            self.min_supported,
            self.sync_protocol,
            self.schema_version,
            self.edition,
            self.flavor,
            hex::encode(h.finalize()),
        )
        .into_bytes()
    }

    /// Notes in `locale`, else English, else any.
    pub fn notes_for(&self, locale: &str) -> String {
        self.notes
            .get(locale)
            .or_else(|| self.notes.get("en"))
            .or_else(|| self.notes.values().next())
            .cloned()
            .unwrap_or_default()
    }
}

/// `latest-solo-main.json`, `latest-group-replica-early.json`.
pub fn manifest_name(edition: &str, flavor: &str, channel: Channel) -> String {
    match channel {
        Channel::Stable => format!("latest-{edition}-{flavor}.json"),
        Channel::Early => format!("latest-{edition}-{flavor}-early.json"),
    }
}

/// Reads the `medoc` block of a manifest and checks it is signed by the vendor and made for this
/// build's edition and flavor. A manifest without the block (an older release) is refused.
pub fn verify(
    manifest: &serde_json::Value,
    edition: &str,
    flavor: &str,
) -> Result<MedocBlock, AppError> {
    verify_with_key(&VENDOR_PUBKEY, manifest, edition, flavor)
}

fn verify_with_key(
    key: &[u8; 32],
    manifest: &serde_json::Value,
    edition: &str,
    flavor: &str,
) -> Result<MedocBlock, AppError> {
    let block: MedocBlock = manifest
        .get("medoc")
        .cloned()
        .ok_or_else(|| AppError::Validation("update manifest is not signed by MeDoc".into()))
        .and_then(|v| {
            serde_json::from_value(v)
                .map_err(|e| AppError::Validation(format!("update manifest: {e}")))
        })?;
    verify_ed25519(key, &block.signed_bytes(), &block.signature)?;
    if block.edition != edition || block.flavor != flavor {
        return Err(AppError::Validation(format!(
            "update is for {}/{}, this computer runs {edition}/{flavor}",
            block.edition, block.flavor
        )));
    }
    let tauri_version = manifest.get("version").and_then(|v| v.as_str());
    if tauri_version.map(|v| v.trim_start_matches('v')) != Some(block.version.as_str()) {
        return Err(AppError::Validation(
            "update manifest versions do not match".into(),
        ));
    }
    Ok(block)
}

/// This build can install the release: at least `min_supported`, and the release is newer.
pub fn installable(block: &MedocBlock, current: &str) -> bool {
    use crate::infrastructure::update::version_newer;
    !version_newer(&block.min_supported, current) && version_newer(&block.version, current)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
    use ed25519_dalek::{Signer, SigningKey};

    fn key() -> SigningKey {
        SigningKey::from_bytes(&[9u8; 32])
    }

    fn block() -> MedocBlock {
        MedocBlock {
            version: "1.4.0".into(),
            kind: Kind::Security,
            min_supported: "1.0.0".into(),
            sync_protocol: 1,
            schema_version: 42,
            edition: "duo".into(),
            flavor: "main".into(),
            channel: Channel::Stable,
            notes: BTreeMap::from([
                ("en".into(), "Fixes".into()),
                ("fr".into(), "Correctifs".into()),
            ]),
            signature: String::new(),
        }
    }

    fn manifest(mut b: MedocBlock) -> serde_json::Value {
        b.signature = STANDARD_NO_PAD.encode(key().sign(&b.signed_bytes()).to_bytes());
        serde_json::json!({ "version": "1.4.0", "platforms": {}, "medoc": b })
    }

    fn check(m: &serde_json::Value, edition: &str, flavor: &str) -> Result<MedocBlock, AppError> {
        verify_with_key(&key().verifying_key().to_bytes(), m, edition, flavor)
    }

    #[test]
    fn a_vendor_signed_manifest_for_this_build_is_accepted() {
        let b = check(&manifest(block()), "duo", "main").expect("valid");
        assert_eq!(b.kind, Kind::Security);
        assert_eq!(b.notes_for("ar"), "Fixes");
        assert!(installable(&b, "1.3.2"));
        assert!(!installable(&b, "0.9.0"), "below min_supported");
        assert!(!installable(&b, "1.4.0"), "not newer");
    }

    #[test]
    fn changed_notes_other_editions_and_unsigned_manifests_are_refused() {
        let mut m = manifest(block());
        m["medoc"]["notes"]["fr"] = "Installez autre chose".into();
        assert!(check(&m, "duo", "main").is_err(), "notes are signed");

        let mut m = manifest(block());
        m["medoc"]["kind"] = "feature".into();
        assert!(check(&m, "duo", "main").is_err(), "kind is signed");

        assert!(check(&manifest(block()), "solo", "main").is_err());
        assert!(check(&manifest(block()), "duo", "replica").is_err());
        assert!(check(&serde_json::json!({ "version": "1.4.0" }), "duo", "main").is_err());

        let mut m = manifest(block());
        m["version"] = "9.9.9".into();
        assert!(
            check(&m, "duo", "main").is_err(),
            "Tauri and MeDoc versions must agree"
        );
    }

    #[test]
    fn manifest_names_follow_edition_flavor_and_channel() {
        assert_eq!(
            manifest_name("solo", "main", Channel::Stable),
            "latest-solo-main.json"
        );
        assert_eq!(
            manifest_name("group", "replica", Channel::Early),
            "latest-group-replica-early.json"
        );
    }

    /// `scripts/make-update-manifest.mjs` signed this block with the CI test key (the one matching
    /// `MEDOC_VENDOR_PUBKEY` in CI and `apps/practice-host/tests/update_signature_tests.rs`), so the
    /// script and this module agree on the signed bytes.
    #[test]
    fn the_release_script_signature_verifies_here() {
        let mut b = block();
        b.signature = "pP0KF26IzCEUTt0fcyENUO3WN/68P6nSsQLpgsJZ/YnntL8hpq67APrBGAoWLsmOfipagJiE74mCU5jf2Ei1Bw".into();
        let m = serde_json::json!({ "version": "1.4.0", "medoc": b });
        let ci_key: [u8; 32] =
            hex::decode("79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32")
                .unwrap()
                .try_into()
                .unwrap();
        verify_with_key(&ci_key, &m, "duo", "main").expect("script and Rust sign the same bytes");
    }
}
