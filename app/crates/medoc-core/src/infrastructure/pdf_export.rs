//! PDF export service — single entry surface over the shared renderer library
//! (`pdf_core`, `pdf_letterhead`, `clinical_pdf_layout`, `pdf`).
//!
//! Tauri commands and application use-cases should call through here so every
//! export path shares the same letterhead, encoding, and footer rules.

pub use super::clinical_pdf_layout::{
    render_clinical_layout, render_plain_preview, ClinicalPdfLayout,
};
pub use super::pdf::{
    render, render_akte, render_akte_blocks, render_report_pdf, render_template_preview_pdf,
    AkteHeaderContext, AktePdfBlock, AktePdfTable, Invoice, InvoiceLine, ReportPdfInput,
    ReportPdfSection, ReportPdfSummaryRow,
};
