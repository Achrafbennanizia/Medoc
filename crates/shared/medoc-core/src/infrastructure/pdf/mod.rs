//! PDF generation — shared primitives, DIN letterhead, clinical layouts, exports.
//!
//! Submodules are grouped here (SRP per document type / layer). Parent
//! [`crate::infrastructure`] re-exports legacy flat paths (`pdf_core`,
//! `clinical_pdf_layout`, …) for existing call sites.

pub mod clinical_layout;
pub mod core;
pub mod export;
pub mod goz;
pub mod i18n;
pub mod invoice_goz;
pub mod letterhead;
pub mod logo;
pub mod metrics;
pub mod render;
pub mod unicode_font;

pub use clinical_layout::*;
pub use core::*;
pub use export::*;
pub use goz::*;
pub use invoice_goz::*;
pub use letterhead::*;
pub use logo::*;
pub use render::*;
