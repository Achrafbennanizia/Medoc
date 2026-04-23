// Minimal PDF 1.4 invoice writer.
//
// Hand-rolled to avoid a heavy PDF dependency. The output passes
// `qpdf --check` and is valid PDF/A-friendly: Helvetica (built-in font),
// no external resources, document metadata embedded.
//
// FA-FIN-INVOICE: every Rechnung must be exportable as a PDF document.

use crate::error::AppError;
use std::fmt::Write;

pub struct InvoiceLine {
    pub description: String,
    pub amount_cents: i64,
}

pub struct Invoice {
    pub number: String,
    pub date: String, // ISO 8601 date
    pub recipient_name: String,
    pub recipient_address: Vec<String>,
    pub practice_name: String,
    pub practice_address: Vec<String>,
    pub lines: Vec<InvoiceLine>,
    pub note: Option<String>,
}

impl Invoice {
    pub fn total_cents(&self) -> i64 {
        self.lines.iter().map(|l| l.amount_cents).sum()
    }
}

/// Emit a PDF as raw bytes. Single A4 page, Helvetica.
pub fn render(invoice: &Invoice) -> Result<Vec<u8>, AppError> {
    let stream = build_content_stream(invoice);
    let stream_bytes = stream.into_bytes();

    // Object table accumulators.
    let mut out: Vec<u8> = Vec::new();
    let mut offsets: Vec<usize> = Vec::new();

    write_str(&mut out, "%PDF-1.4\n");
    out.extend_from_slice(b"%\xE2\xE3\xCF\xD3\n"); // binary marker

    // Object 1: Catalog
    offsets.push(out.len());
    write_str(
        &mut out,
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    );

    // Object 2: Pages tree
    offsets.push(out.len());
    write_str(
        &mut out,
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    );

    // Object 3: Page
    offsets.push(out.len());
    write_str(
        &mut out,
        concat!(
            "3 0 obj\n",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ",
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\n",
            "endobj\n",
        ),
    );

    // Object 4: Content stream
    offsets.push(out.len());
    write_str(
        &mut out,
        &format!("4 0 obj\n<< /Length {} >>\nstream\n", stream_bytes.len()),
    );
    out.extend_from_slice(&stream_bytes);
    write_str(&mut out, "\nendstream\nendobj\n");

    // Object 5: Font
    offsets.push(out.len());
    write_str(
        &mut out,
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    );

    // Object 6: Info dictionary (metadata)
    offsets.push(out.len());
    write_str(
        &mut out,
        &format!(
            "6 0 obj\n<< /Title ({}) /Producer (MeDoc) /Creator (MeDoc) >>\nendobj\n",
            pdf_escape(&format!("Rechnung {}", invoice.number)),
        ),
    );

    // Cross-reference table
    let xref_pos = out.len();
    write_str(&mut out, &format!("xref\n0 {}\n", offsets.len() + 1));
    write_str(&mut out, "0000000000 65535 f \n");
    for off in &offsets {
        write_str(&mut out, &format!("{:010} 00000 n \n", off));
    }

    // Trailer
    write_str(
        &mut out,
        &format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 6 0 R >>\nstartxref\n{}\n%%EOF\n",
            offsets.len() + 1,
            xref_pos,
        ),
    );

    Ok(out)
}

fn write_str(out: &mut Vec<u8>, s: &str) {
    out.extend_from_slice(s.as_bytes());
}

/// Escape parentheses and backslashes inside a PDF text-literal.
fn pdf_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '(' | ')' | '\\' => {
                out.push('\\');
                out.push(ch);
            }
            // Drop control characters; replace non-Latin1 with '?'.
            c if (c as u32) < 32 => out.push(' '),
            c if (c as u32) > 0xFF => out.push('?'),
            c => out.push(c),
        }
    }
    out
}

fn build_content_stream(inv: &Invoice) -> String {
    let mut s = String::new();
    let mut y = 800; // top of page (PDF origin is bottom-left)

    let line = |s: &mut String, x: i32, y: i32, font_size: i32, text: &str| {
        let _ = writeln!(
            s,
            "BT /F1 {fs} Tf {x} {y} Td ({txt}) Tj ET",
            fs = font_size,
            x = x,
            y = y,
            txt = pdf_escape(text),
        );
    };

    // Practice header (right aligned simulated by indent)
    for addr in &inv.practice_address {
        line(&mut s, 350, y, 9, addr);
        y -= 12;
    }
    y -= 10;
    line(&mut s, 350, y, 11, &inv.practice_name);
    y -= 30;

    // Recipient block
    line(&mut s, 60, y, 11, &inv.recipient_name);
    y -= 14;
    for a in &inv.recipient_address {
        line(&mut s, 60, y, 10, a);
        y -= 12;
    }

    y -= 30;
    line(&mut s, 60, y, 16, &format!("Rechnung {}", inv.number));
    y -= 18;
    line(&mut s, 60, y, 10, &format!("Datum: {}", inv.date));
    y -= 30;

    // Header row
    line(&mut s, 60, y, 10, "Position");
    line(&mut s, 460, y, 10, "Betrag (EUR)");
    y -= 6;
    let _ = writeln!(s, "{} {} m {} {} l S", 60, y, 540, y);
    y -= 14;

    for (i, l) in inv.lines.iter().enumerate() {
        line(&mut s, 60, y, 10, &format!("{}. {}", i + 1, l.description));
        line(&mut s, 460, y, 10, &format_eur(l.amount_cents));
        y -= 14;
    }

    y -= 8;
    let _ = writeln!(s, "{} {} m {} {} l S", 60, y, 540, y);
    y -= 16;
    line(&mut s, 60, y, 11, "Gesamt:");
    line(&mut s, 460, y, 11, &format_eur(inv.total_cents()));

    if let Some(note) = &inv.note {
        y -= 40;
        for chunk in note.lines() {
            line(&mut s, 60, y, 9, chunk);
            y -= 11;
        }
    }

    s
}

fn format_eur(cents: i64) -> String {
    let neg = cents < 0;
    let v = cents.abs();
    let euros = v / 100;
    let frac = v % 100;
    format!("{}{},{:02}", if neg { "-" } else { "" }, euros, frac)
}

// ---------------------------------------------------------------------------
// FA-AKTE-04: Patientenakte als PDF exportieren.
// ---------------------------------------------------------------------------

pub struct AkteDocument {
    pub patient_name: String,
    pub patient_geburtsdatum: String,
    pub patient_versicherungsnummer: String,
    pub akte_status: String,
    pub diagnose: Option<String>,
    pub befunde: Option<String>,
    /// Behandlungs-Einträge: (datum, beschreibung).
    pub behandlungen: Vec<(String, String)>,
    pub generated_at: String,
}

/// Render a patient record as a single-page A4 PDF (FA-AKTE-04).
///
/// Mirrors `render` for invoices but lays out clinical data: patient header,
/// diagnose, befunde, and a behandlungs-list. Output validates with qpdf.
pub fn render_akte(doc: &AkteDocument) -> Result<Vec<u8>, AppError> {
    let stream = build_akte_content_stream(doc);
    let stream_bytes = stream.into_bytes();

    let mut out: Vec<u8> = Vec::new();
    let mut offsets: Vec<usize> = Vec::new();

    write_str(&mut out, "%PDF-1.4\n");
    out.extend_from_slice(b"%\xE2\xE3\xCF\xD3\n");

    offsets.push(out.len());
    write_str(
        &mut out,
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    );

    offsets.push(out.len());
    write_str(
        &mut out,
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    );

    offsets.push(out.len());
    write_str(
        &mut out,
        concat!(
            "3 0 obj\n",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ",
            "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\n",
            "endobj\n",
        ),
    );

    offsets.push(out.len());
    write_str(
        &mut out,
        &format!("4 0 obj\n<< /Length {} >>\nstream\n", stream_bytes.len()),
    );
    out.extend_from_slice(&stream_bytes);
    write_str(&mut out, "\nendstream\nendobj\n");

    offsets.push(out.len());
    write_str(
        &mut out,
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    );

    offsets.push(out.len());
    write_str(
        &mut out,
        &format!(
            "6 0 obj\n<< /Title ({}) /Producer (MeDoc) /Creator (MeDoc) >>\nendobj\n",
            pdf_escape(&format!("Patientenakte {}", doc.patient_name)),
        ),
    );

    let xref_pos = out.len();
    write_str(&mut out, &format!("xref\n0 {}\n", offsets.len() + 1));
    write_str(&mut out, "0000000000 65535 f \n");
    for off in &offsets {
        write_str(&mut out, &format!("{:010} 00000 n \n", off));
    }
    write_str(
        &mut out,
        &format!(
            "trailer\n<< /Size {} /Root 1 0 R /Info 6 0 R >>\nstartxref\n{}\n%%EOF\n",
            offsets.len() + 1,
            xref_pos,
        ),
    );

    Ok(out)
}

fn build_akte_content_stream(doc: &AkteDocument) -> String {
    let mut s = String::new();
    let mut y: i32 = 800;

    let line = |s: &mut String, x: i32, y: i32, font_size: i32, text: &str| {
        let _ = writeln!(
            s,
            "BT /F1 {fs} Tf {x} {y} Td ({txt}) Tj ET",
            fs = font_size,
            x = x,
            y = y,
            txt = pdf_escape(text),
        );
    };

    line(&mut s, 60, y, 16, "Patientenakte");
    y -= 18;
    line(&mut s, 60, y, 9, &format!("Erstellt: {}", doc.generated_at));
    y -= 24;

    line(&mut s, 60, y, 12, &format!("Patient: {}", doc.patient_name));
    y -= 14;
    line(
        &mut s,
        60,
        y,
        10,
        &format!("Geburtsdatum: {}", doc.patient_geburtsdatum),
    );
    y -= 12;
    line(
        &mut s,
        60,
        y,
        10,
        &format!("Versicherungsnr.: {}", doc.patient_versicherungsnummer),
    );
    y -= 12;
    line(&mut s, 60, y, 10, &format!("Status: {}", doc.akte_status));
    y -= 24;

    let _ = writeln!(s, "{} {} m {} {} l S", 60, y, 540, y);
    y -= 16;
    line(&mut s, 60, y, 12, "Diagnose");
    y -= 14;
    for chunk in wrap_text(doc.diagnose.as_deref().unwrap_or("(keine Eintragung)"), 90) {
        line(&mut s, 60, y, 10, &chunk);
        y -= 12;
        if y < 80 {
            break;
        }
    }

    y -= 12;
    let _ = writeln!(s, "{} {} m {} {} l S", 60, y, 540, y);
    y -= 16;
    line(&mut s, 60, y, 12, "Befunde");
    y -= 14;
    for chunk in wrap_text(doc.befunde.as_deref().unwrap_or("(keine Eintragung)"), 90) {
        line(&mut s, 60, y, 10, &chunk);
        y -= 12;
        if y < 80 {
            break;
        }
    }

    y -= 12;
    let _ = writeln!(s, "{} {} m {} {} l S", 60, y, 540, y);
    y -= 16;
    line(&mut s, 60, y, 12, "Behandlungen");
    y -= 14;
    if doc.behandlungen.is_empty() {
        line(&mut s, 60, y, 10, "(keine Behandlungen erfasst)");
    } else {
        for (datum, beschreibung) in &doc.behandlungen {
            line(
                &mut s,
                60,
                y,
                10,
                &format!("{}  -  {}", datum, beschreibung),
            );
            y -= 12;
            if y < 60 {
                break;
            }
        }
    }

    s
}

/// Naïve word-wrap to fit a fixed character width.
fn wrap_text(text: &str, width: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for paragraph in text.split('\n') {
        let mut current = String::new();
        for word in paragraph.split_whitespace() {
            if current.is_empty() {
                current.push_str(word);
            } else if current.len() + 1 + word.len() <= width {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(std::mem::take(&mut current));
                current.push_str(word);
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn _format_eur_unused(_cents: i64) -> String {
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_minimal_invoice() {
        let inv = Invoice {
            number: "2026-001".into(),
            date: "2026-04-19".into(),
            recipient_name: "Max Mustermann".into(),
            recipient_address: vec!["Musterstr. 1".into(), "10115 Berlin".into()],
            practice_name: "Zahnarztpraxis Dr. Beispiel".into(),
            practice_address: vec!["Hauptstr. 2".into(), "10115 Berlin".into()],
            lines: vec![
                InvoiceLine {
                    description: "Kontrolluntersuchung".into(),
                    amount_cents: 4500,
                },
                InvoiceLine {
                    description: "Zahnreinigung".into(),
                    amount_cents: 8500,
                },
            ],
            note: Some("Zahlbar innerhalb 14 Tagen.".into()),
        };
        let pdf = render(&inv).unwrap();
        assert!(pdf.starts_with(b"%PDF-1.4"));
        assert!(pdf.ends_with(b"%%EOF\n"));
        assert!(pdf.windows(7).any(|w| w == b"/Length"));
    }

    #[test]
    fn pdf_escape_handles_specials() {
        assert_eq!(pdf_escape("a (b) c"), "a \\(b\\) c");
        assert_eq!(pdf_escape("a\\b"), "a\\\\b");
        // Latin-1 chars are preserved; non-Latin1 chars become '?'.
        assert_eq!(pdf_escape("Ümlaut"), "Ümlaut");
        assert_eq!(pdf_escape("中"), "?");
    }
}
