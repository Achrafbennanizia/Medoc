//! Per-kind renderers: certificate, prescription, receipt and the generic layout.

use super::*;

// ---------------------------------------------------------------------------
// CERTIFICATE  (Form-1 style)
// ---------------------------------------------------------------------------

pub(super) fn render_certificate(
    pb: &mut PageBuilder,
    doc: &ClinicalPdfLayout,
    logo: Option<&PdfLogo>,
    locale: &str,
) {
    // Letterhead — certificates usually go to the patient directly, so
    // address_lines apply
    let meta_rows = meta_rows_with_number(doc, locale);
    let lh = clinical_letterhead(doc, &meta_rows, logo, locale);
    emit_letterhead(pb, &lh);

    // Centered title
    pb.text_center(17, true, &doc.document_title);
    pb.advance(22);
    if let Some(sub) = doc
        .document_subtitle
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.text_center(10, false, sub);
        pb.advance(14);
    }

    emit_copy_variant_line(pb, doc, locale);
    pb.hline(M_LEFT + 100, M_RIGHT - 100);
    pb.advance(16);

    if let Some(ref tc) = doc.two_column {
        emit_two_column_panel(pb, tc);
    }
    render_intro(pb, &doc.intro_paragraphs);
    emit_label_value_rows(pb, &doc.label_value_rows);

    for table in &doc.tables {
        emit_table(
            pb,
            table,
            (
                doc.practice_lines
                    .first()
                    .map(|s| s.as_str())
                    .unwrap_or("MeDoc"),
                &doc.document_title,
            ),
        );
    }

    emit_detail_records(pb, &doc.detail_records);

    for p in &doc.closing_paragraphs {
        if !p.trim().is_empty() {
            pb.paragraph(p, 10, 84, 0);
        }
    }

    emit_default_or_custom_signature(pb, doc);
}

// ---------------------------------------------------------------------------
// PRESCRIPTION  (Form-16 style — private prescription)
// ---------------------------------------------------------------------------

pub(super) fn render_prescription(
    pb: &mut PageBuilder,
    doc: &ClinicalPdfLayout,
    logo: Option<&PdfLogo>,
    locale: &str,
) {
    let meta_rows = meta_rows_with_number(doc, locale);
    let lh = clinical_letterhead(doc, &meta_rows, logo, locale);
    emit_letterhead(pb, &lh);

    // Large "Prescription" title on the left, optional subtitle (private / statutory / BtM)
    pb.text(M_LEFT, 18, true, &doc.document_title);
    pb.advance(22);
    if let Some(sub) = doc
        .document_subtitle
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.text(M_LEFT, 10, false, sub);
        pb.advance(14);
    }
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(18);

    // Patient panel (two columns)
    if let Some(ref tc) = doc.two_column {
        emit_two_column_panel(pb, tc);
    }

    // "Rp." (the prescribed drugs) comes first, then duration / aut idem / notes.
    if !doc.tables.is_empty() {
        pb.advance(6);
        for table in &doc.tables {
            emit_table(
                pb,
                table,
                (
                    doc.practice_lines
                        .first()
                        .map(|s| s.as_str())
                        .unwrap_or("MeDoc"),
                    &doc.document_title,
                ),
            );
        }
        pb.advance(6);
    }

    emit_label_value_rows(pb, &doc.label_value_rows);

    render_intro(pb, &doc.intro_paragraphs);

    for p in &doc.closing_paragraphs {
        if !p.trim().is_empty() {
            pb.paragraph(p, 10, 84, 0);
        }
    }

    emit_default_or_custom_signature(pb, doc);
}

// ---------------------------------------------------------------------------
// RECEIPT  (GoBD-compliant)
// ---------------------------------------------------------------------------

pub(super) fn render_receipt(
    pb: &mut PageBuilder,
    doc: &ClinicalPdfLayout,
    logo: Option<&PdfLogo>,
    locale: &str,
) {
    let meta_rows = meta_rows_with_number(doc, locale);
    let lh = clinical_letterhead(doc, &meta_rows, logo, locale);
    emit_letterhead(pb, &lh);

    // Hand-out receipt: title, then the services that were paid for.
    pb.text(M_LEFT, 16, true, &doc.document_title);
    pb.advance(18);
    if let Some(sub) = doc
        .document_subtitle
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.text(M_LEFT, 9, false, sub);
        pb.advance(14);
    }
    pb.advance(4);

    render_intro(pb, &doc.intro_paragraphs);
    emit_label_value_rows(pb, &doc.label_value_rows);

    let cont = (
        doc.practice_lines
            .first()
            .map(|s| s.as_str())
            .unwrap_or("MeDoc"),
        doc.document_title.as_str(),
    );
    // Service lines first, then money totals (standard receipt order).
    // Amounts carry the practice currency even when the client sent a bare number.
    let tables = receipt_tables_with_currency(&doc.tables);
    let totals = receipt_totals_with_currency(&doc.totals);
    for table in &tables {
        emit_table(pb, table, cont);
    }
    emit_receipt_totals(pb, &totals);

    pb.advance(6);
    for p in &doc.closing_paragraphs {
        if !p.trim().is_empty() {
            pb.paragraph(p, 9, 90, 0);
        }
    }
}

// ---------------------------------------------------------------------------
// GENERIC  (fallback for unknown kind)
// ---------------------------------------------------------------------------

pub(super) fn render_generic(
    pb: &mut PageBuilder,
    doc: &ClinicalPdfLayout,
    logo: Option<&PdfLogo>,
    locale: &str,
) {
    let meta_rows = meta_rows_with_number(doc, locale);
    let lh = clinical_letterhead(doc, &meta_rows, logo, locale);
    emit_letterhead(pb, &lh);

    pb.text(M_LEFT, 14, true, &doc.document_title);
    pb.advance(18);
    if let Some(sub) = doc
        .document_subtitle
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        pb.text(M_LEFT, 10, false, sub);
        pb.advance(14);
    }

    render_intro(pb, &doc.intro_paragraphs);
    emit_label_value_rows(pb, &doc.label_value_rows);

    if let Some(ref tc) = doc.two_column {
        emit_two_column_panel(pb, tc);
    }

    for table in &doc.tables {
        emit_table(
            pb,
            table,
            (
                doc.practice_lines
                    .first()
                    .map(|s| s.as_str())
                    .unwrap_or("MeDoc"),
                &doc.document_title,
            ),
        );
    }

    emit_detail_records(pb, &doc.detail_records);
    emit_totals_block(pb, &doc.totals);

    for p in &doc.closing_paragraphs {
        if !p.trim().is_empty() {
            pb.paragraph(p, 10, 84, 0);
        }
    }

    emit_default_or_custom_signature(pb, doc);
}
