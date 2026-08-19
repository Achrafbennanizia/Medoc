//! PDF export service — single entry surface over the shared renderer library
//! (`pdf::core`, `pdf::letterhead`, `pdf::clinical_layout`, `pdf::render`).
//!
//! Tauri commands and application use-cases should call through here so every
//! export path shares the same letterhead, encoding, and footer rules.

pub use super::clinical_layout::{render_clinical_layout, render_plain_preview, ClinicalPdfLayout};
pub use super::render::{
    render, render_chart, render_chart_blocks, render_report_pdf, render_template_preview_pdf,
    ChartHeaderContext, ChartPdfBlock, ChartPdfTable, Invoice, InvoiceLine, ReportPdfInput,
    ReportPdfSection, ReportPdfSummaryRow,
};
