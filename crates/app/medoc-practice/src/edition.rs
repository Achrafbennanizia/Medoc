//! The edition this binary was built as (Cargo feature `edition-solo|duo|group`).
//! See docs/architecture/editions-plan.md §3.2.

use serde::Serialize;

pub use medoc_core::edition::{Caps, EditionSpec, Limits, CORE_CAPS};

#[cfg(not(any(
    feature = "edition-solo",
    feature = "edition-duo",
    feature = "edition-group"
)))]
compile_error!("choose an edition: --features edition-solo | edition-duo | edition-group");

#[cfg(any(
    all(feature = "edition-solo", feature = "edition-duo"),
    all(feature = "edition-solo", feature = "edition-group"),
    all(feature = "edition-duo", feature = "edition-group"),
))]
compile_error!("only one edition feature may be on (build with --no-default-features)");

#[cfg(all(feature = "edition-solo", feature = "replica"))]
compile_error!("the Solo edition has no replica app");

#[cfg(feature = "edition-solo")]
pub const EDITION: EditionSpec = medoc_core::edition::SOLO;
#[cfg(feature = "edition-duo")]
pub const EDITION: EditionSpec = medoc_core::edition::DUO;
#[cfg(feature = "edition-group")]
pub const EDITION: EditionSpec = medoc_core::edition::GROUP;

// The edition feature turns on its `cap-*` features in medoc-core; this fails the build when the
// Cargo lists and config/editions.yaml disagree, or a `cap-*` feature was turned on by hand.
const _: () = assert!(
    EDITION.caps.same_as(&CORE_CAPS),
    "medoc-core cap-* features do not match this edition in config/editions.yaml"
);

/// What the UI compares with its own build-time constants at start (`edition_info`).
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditionInfo {
    pub edition: &'static str,
    pub flavor: &'static str,
    pub caps: Caps,
    pub limits: Limits,
    pub version: &'static str,
}

pub fn info() -> EditionInfo {
    EditionInfo {
        edition: EDITION.id,
        flavor: medoc_core::domain::device::FLAVOR.wire(),
        caps: EDITION.caps,
        limits: EDITION.limits,
        version: env!("CARGO_PKG_VERSION"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn info_reports_the_compiled_edition() {
        let i = info();
        assert_eq!(i.edition, EDITION.id);
        assert!(i.caps.same_as(&CORE_CAPS));
    }
}
