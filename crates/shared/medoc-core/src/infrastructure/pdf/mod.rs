//! PDF generation — shared primitives, DIN letterhead, clinical layouts, exports.
//!
//! Submodules are grouped here, one per document layer.
//!
//! - [`text`] — every string goes through it (normalisation, bidi, fonts,
//!   shaping); [`fonts`] embeds and subsets the TrueType fonts.
//! - [`i18n`] — document languages and the catalogs in `locales/*.json`.

pub mod clinical_layout;
pub mod core;
pub mod export;
pub mod fonts;
pub mod goz;
pub mod i18n;
pub mod invoice_goz;
pub mod invoice_ma;
pub mod letterhead;
pub mod logo;
pub mod metrics;
pub mod render;
pub mod text;
pub mod unicode_font;

pub use clinical_layout::*;
pub use core::*;
pub use export::*;
pub use goz::*;
pub use invoice_goz::*;
pub use invoice_ma::*;
pub use letterhead::*;
pub use logo::*;
pub use render::*;
