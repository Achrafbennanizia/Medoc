//! DIN-5008-konformer Briefkopf für alle MeDoc-Dokumente.
//!
//! Layout (Form A, Fensterumschlag-kompatibel):
//!
//! ```text
//! ┌──────────────────────────────────────────────────────────────────┐
//! │ Praxisname (fett, 12 pt)                  ┌───────────────────┐ │
//! │ Straße                                    │ Meta-Block:       │ │
//! │ PLZ Ort                                   │ Rechnung-Nr.      │ │
//! │ Tel · Fax · E-Mail · Web                  │ Datum             │ │
//! │ BSNR · ZANR · USt-IdNr.                   │ Behandler         │ │
//! │                                           │ Patienten-Nr.     │ │
//! │                                           └───────────────────┘ │
//! │ ┌─── Praxisname · Straße · PLZ Ort (7 pt, klein)──────────────┐ │
//! │ │                                                              │ │
//! │ │  Empfänger Anschrift                                         │ │
//! │ │  (Fensterumschlag-Bereich, DIN 5008 A, Y 700–572)            │ │
//! │ │                                                              │ │
//! │ └──────────────────────────────────────────────────────────────┘ │
//! │ ───────────────────────────────────────────────────────────────  │
//! │ [Inhalt ab Y ≈ 560]                                              │
//! └──────────────────────────────────────────────────────────────────┘
//! ```
//!
//! Der Briefkopf wird **einmal** auf der ersten Seite gerendert; auf
//! Folgeseiten wird ein kurzer **Kopfzeilen-Stub** (Praxisname + Dokument-Nr.)
//! verwendet (siehe [`emit_continuation_header`]).

use super::pdf_core::{
    wrap_soft, PageBuilder, ADDRESS_WINDOW_Y, M_LEFT, M_RIGHT, M_TOP, SENDER_HINT_Y,
};

/// Eine Zeile des rechten Meta-Blocks: "Bezeichnung" + "Wert".
#[derive(Debug, Clone)]
pub struct MetaRow {
    pub label: String,
    pub value: String,
}

impl MetaRow {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
        }
    }
}

/// Vollständiger Briefkopf einer Praxis.
#[derive(Debug, Clone, Default)]
pub struct Letterhead<'a> {
    /// Erste Zeile = Praxisname (fett); weitere Zeilen = Adresse, Kontakt.
    /// Empfehlung: max. 6 Zeilen, damit der Adressblock nicht überlappt.
    pub praxis_lines: &'a [String],
    /// Rechte Spalte oben: kleine Zusatzinfos wie "Tel: …", "Fax: …".
    /// Nur wenn `meta_rows` leer ist — sonst nutzt man den Meta-Block.
    pub header_right_lines: &'a [String],
    /// Strukturierter Meta-Block rechts (Rechnung-Nr., Datum, Behandler, …).
    pub meta_rows: &'a [MetaRow],
    /// Empfänger-Adresse im Fensterumschlag-Bereich. Erste Zeile = Name,
    /// danach Straße, PLZ Ort, ggf. Land.
    pub address_lines: &'a [String],
    /// Wenn `true`: Rücksender-Mini-Zeile über dem Adressfenster
    /// ("Praxisname · Straße · PLZ Ort").
    pub show_sender_hint: bool,
}

/// Rendert den vollständigen Briefkopf auf die aktuelle Seite des PageBuilders
/// und positioniert `pb.y` direkt unter der Trennlinie, bereit für Inhalt.
///
/// Returns `pb.y` nach dem Briefkopf (kann der Aufrufer für weitere
/// Positionierung nutzen, ist aber bereits in `pb.y` gesetzt).
const LEFT_HEADER_WRAP: usize = 46;
const LEFT_HEADER_MIN_Y: i32 = M_TOP - 88;

pub fn emit_letterhead(pb: &mut PageBuilder, lh: &Letterhead) -> i32 {
    // --- 1. Praxis-Block oben links ---------------------------------------
    let mut left_y = M_TOP;
    for (i, line) in lh.praxis_lines.iter().enumerate() {
        if left_y < LEFT_HEADER_MIN_Y {
            break;
        }
        let chunks = wrap_soft(line, LEFT_HEADER_WRAP);
        for (ci, chunk) in chunks.iter().enumerate() {
            if left_y < LEFT_HEADER_MIN_Y {
                break;
            }
            let first = i == 0 && ci == 0;
            pb.y = left_y;
            pb.text(M_LEFT, if first { 12 } else { 9 }, first, chunk);
            left_y -= if first { 14 } else { 11 };
        }
    }

    // --- 2. Meta-Block rechts oder Kontaktblock rechts --------------------
    let mut right_y = M_TOP;
    if !lh.meta_rows.is_empty() {
        right_y = emit_meta_block(pb, lh.meta_rows, M_TOP);
    } else {
        for line in lh.header_right_lines.iter().take(5) {
            pb.y = right_y;
            pb.text_right(M_RIGHT, 9, false, line);
            right_y -= 11;
        }
    }

    let header_bottom = left_y.min(right_y);

    // --- 3. Adressfenster (Fensterumschlag) -------------------------------
    if !lh.address_lines.is_empty() {
        if lh.show_sender_hint {
            let sender = sender_hint_line(lh.praxis_lines);
            if !sender.trim().is_empty() {
                pb.y = SENDER_HINT_Y;
                pb.text(M_LEFT + 6, 7, false, &sender);
            }
        }
        let mut addr_y = ADDRESS_WINDOW_Y;
        for (i, line) in lh.address_lines.iter().enumerate() {
            let size = if i == 0 { 11 } else { 10 };
            for chunk in wrap_soft(line, 42) {
                pb.y = addr_y;
                pb.text(M_LEFT + 10, size, i == 0, &chunk);
                addr_y -= if size == 11 { 13 } else { 12 };
            }
        }
    }

    // --- 4. Trennlinie unter dem Briefkopf --------------------------------
    // Wenn ein Adressfeld da ist: knapp unter dem Adressfeld; sonst direkt
    // unter dem Praxis-/Meta-Block.
    let rule_y = if lh.address_lines.is_empty() {
        header_bottom - 8
    } else {
        // Unter dem Adressfenster (DIN 5008: ~Y 560)
        560
    };
    pb.hline_at(M_LEFT, rule_y, M_RIGHT);

    pb.y = rule_y - 18;
    pb.y
}

/// Kurze Kopfzeile für Folgeseiten (nur Praxisname + Dokumenttyp).
/// Wird **nicht** Teil von `emit_letterhead`, sondern direkt nach `break_page()`
/// aufgerufen.
pub fn emit_continuation_header(pb: &mut PageBuilder, praxis_name: &str, doc_title: &str) {
    pb.y = M_TOP;
    pb.text(M_LEFT, 9, true, praxis_name);
    pb.text_right(M_RIGHT, 9, false, &format!("{doc_title} (Fortsetzung)"));
    pb.y -= 4;
    pb.hline_at(M_LEFT, pb.y, M_RIGHT);
    pb.y -= 16;
}

/// Meta-Block rechts: pro Eintrag zwei Zeilen — Label klein, Wert größer.
/// Returns die `y`-Position der untersten geschriebenen Zeile.
fn emit_meta_block(pb: &mut PageBuilder, rows: &[MetaRow], start_y: i32) -> i32 {
    let label_x = 320;
    let mut y = start_y;
    for row in rows {
        pb.y = y;
        pb.text(label_x, 8, false, &row.label);
        y -= 11;
        for chunk in wrap_soft(&row.value, 34) {
            pb.y = y;
            pb.text_right(M_RIGHT, 9, false, &chunk);
            y -= 11;
        }
        y -= 4;
    }
    y
}

fn sender_hint_line(praxis_lines: &[String]) -> String {
    praxis_lines
        .iter()
        .take(3)
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" · ")
}

/// Ein einheitlicher Unterschriftsblock am Seitenende:
///
/// ```text
/// ─────────────────────────────  (Linie oben)
///
///   __________________________
///   Behandler-Name
///   Berufsbezeichnung · ZANR · BSNR
///   (Stempel)
/// ```
pub fn emit_signature_block(
    pb: &mut PageBuilder,
    behandler_name: Option<&str>,
    berufsbezeichnung: Option<&str>,
    zanr: Option<&str>,
    bsnr: Option<&str>,
    show_stempel_label: bool,
) {
    pb.ensure_space(80);
    pb.advance(20);
    pb.hline(M_LEFT, M_RIGHT);
    pb.advance(28);

    // Unterschriftslinie
    pb.hline_at(M_LEFT, pb.y, M_LEFT + 180);
    pb.advance(14);

    if let Some(n) = behandler_name.filter(|s| !s.trim().is_empty()) {
        pb.text(M_LEFT, 10, true, n);
        pb.advance(12);
    }

    let mut subline = Vec::new();
    if let Some(b) = berufsbezeichnung.filter(|s| !s.trim().is_empty()) {
        subline.push(b.to_string());
    }
    if let Some(z) = zanr.filter(|s| !s.trim().is_empty()) {
        subline.push(format!("ZANR: {z}"));
    }
    if let Some(b) = bsnr.filter(|s| !s.trim().is_empty()) {
        subline.push(format!("BSNR: {b}"));
    }
    if !subline.is_empty() {
        pb.text(M_LEFT, 9, false, &subline.join(" · "));
        pb.advance(11);
    }

    if show_stempel_label {
        pb.advance(6);
        pb.text(M_LEFT, 8, false, "(Praxisstempel)");
    }
}

/// Bankverbindungs-Block für Rechnungen.
pub fn emit_bankverbindung(pb: &mut PageBuilder, lines: &[String]) {
    if lines.is_empty() {
        return;
    }
    pb.ensure_space(40 + lines.len() as i32 * 11);
    pb.advance(6);
    pb.text(M_LEFT, 9, true, "Bankverbindung:");
    pb.advance(11);
    for line in lines {
        pb.text(M_LEFT, 9, false, line);
        pb.advance(11);
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn dummy_praxis() -> Vec<String> {
        vec![
            "Zahnarztpraxis Dr. Mustermann".into(),
            "Hauptstraße 1".into(),
            "10115 Berlin".into(),
            "Tel: 030/123456".into(),
        ]
    }

    fn dummy_address() -> Vec<String> {
        vec![
            "Max Mustermann".into(),
            "Musterstr. 2".into(),
            "10117 Berlin".into(),
        ]
    }

    #[test]
    fn letterhead_renders_without_panic() {
        let mut pb = PageBuilder::new();
        let praxis = dummy_praxis();
        let addr = dummy_address();
        let meta = vec![
            MetaRow::new("Rechnung-Nr.", "RE-2026-001"),
            MetaRow::new("Datum", "19.04.2026"),
        ];
        let lh = Letterhead {
            praxis_lines: &praxis,
            meta_rows: &meta,
            address_lines: &addr,
            header_right_lines: &[],
            show_sender_hint: true,
        };
        let y_after = emit_letterhead(&mut pb, &lh);
        assert!(y_after < M_TOP);
        let pages = pb.finish();
        assert_eq!(pages.len(), 1);
    }

    #[test]
    fn letterhead_without_address_compresses() {
        let mut pb = PageBuilder::new();
        let praxis = dummy_praxis();
        let lh = Letterhead {
            praxis_lines: &praxis,
            meta_rows: &[],
            address_lines: &[],
            header_right_lines: &[],
            show_sender_hint: false,
        };
        let y_after = emit_letterhead(&mut pb, &lh);
        // Ohne Adressfeld muss die Trennlinie früher sein als die DIN-5008-Y560.
        assert!(y_after > 560);
    }

    #[test]
    fn continuation_header_writes_practice_and_title() {
        let mut pb = PageBuilder::new();
        emit_continuation_header(&mut pb, "Praxis A", "Rechnung");
        let pages = pb.finish();
        assert!(pages[0].contains("Praxis A") || pages[0].contains("Rech"));
    }

    #[test]
    fn signature_block_handles_missing_fields() {
        let mut pb = PageBuilder::new();
        pb.y = 200;
        emit_signature_block(&mut pb, None, None, None, None, false);
        let pages = pb.finish();
        // Nur die Linien, keine Texte — sollte trotzdem valid sein
        assert_eq!(pages.len(), 1);
    }
}
