//! Arabic (and any other non-WinAnsi) text, shaped with Noto Naskh Arabic.
//!
//! Helvetica stays the font for German, English, and French. A string that
//! contains Arabic is shaped as one run and drawn with an embedded TrueType
//! font so the receipt can be issued in every supported language.

use std::io::Write;
use std::sync::LazyLock;
use std::fmt::Write as _;

use flate2::write::ZlibEncoder;
use flate2::Compression;

const FONT: &[u8] = include_bytes!("../../../assets/NotoNaskhArabic-Regular.ttf");

fn shape_face() -> &'static rustybuzz::Face<'static> {
    static FACE: LazyLock<rustybuzz::Face<'static>> =
        LazyLock::new(|| rustybuzz::Face::from_slice(FONT, 0).expect("Noto Naskh Arabic"));
    &FACE
}

fn parser_face() -> &'static ttf_parser::Face<'static> {
    static FACE: LazyLock<ttf_parser::Face<'static>> =
        LazyLock::new(|| ttf_parser::Face::parse(FONT, 0).expect("Noto Naskh Arabic"));
    &FACE
}

pub fn has_glyph(ch: char) -> bool {
    parser_face().glyph_index(ch).is_some()
}

/// True when Helvetica cannot draw this string and the embedded font must.
pub fn needs_unicode(s: &str) -> bool {
    !super::core::is_winansi_renderable(s)
}

struct Glyph {
    id: u16,
    x: f64,
    y: f64,
}

struct Run {
    glyphs: Vec<Glyph>,
    width: f64,
}

fn shape_run(text: &str, font_size: i32) -> Run {
    let face = shape_face();
    let upem = face.units_per_em().max(1) as f64;
    let scale = f64::from(font_size) / upem;
    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(text);
    buffer.guess_segment_properties();
    let output = rustybuzz::shape(face, &[], buffer);
    let mut glyphs = Vec::new();
    let mut pen = 0.0f64;
    for (info, pos) in output.glyph_infos().iter().zip(output.glyph_positions()) {
        if info.glyph_id == 0 {
            pen += pos.x_advance as f64 * scale;
            continue;
        }
        glyphs.push(Glyph {
            id: info.glyph_id as u16,
            x: pen + pos.x_offset as f64 * scale,
            y: pos.y_offset as f64 * scale,
        });
        pen += pos.x_advance as f64 * scale;
    }
    Run {
        glyphs,
        width: pen,
    }
}

pub fn width_pt(text: &str, font_size: i32) -> f64 {
    shape_run(text, font_size).width
}

/// Content-stream operators that draw `text` with its left edge at `(x, y)`.
pub fn positioned_ops(x: i32, y: i32, font_size: i32, text: &str) -> String {
    let run = shape_run(text, font_size);
    let mut out = String::new();
    for glyph in run.glyphs {
        let gx = f64::from(x) + glyph.x;
        let gy = f64::from(y) + glyph.y;
        let _ = writeln!(
            out,
            "BT /F3 {font_size} Tf {gx:.2} {gy:.2} Td <{id:04X}> Tj ET",
            id = glyph.id,
        );
    }
    out
}

/// Four PDF objects starting at `first_id`: Type0, CIDFont, descriptor, file.
/// `/F3` must point at `first_id`.
pub fn append_font_objects(out: &mut Vec<u8>, offsets: &mut Vec<usize>, first_id: usize) {
    let face = parser_face();
    let upem = i32::from(face.units_per_em()).max(1);
    let scale = |v: i16| -> i32 { i32::from(v) * 1000 / upem };
    let bbox = face.global_bounding_box();
    let type0 = first_id;
    let cid = first_id + 1;
    let descriptor = first_id + 2;
    let file_id = first_id + 3;

    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{type0} 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /NotoNaskhArabic \
             /Encoding /Identity-H /DescendantFonts [{cid} 0 R] >>\nendobj\n"
        )
        .as_bytes(),
    );

    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{cid} 0 obj\n<< /Type /Font /Subtype /CIDFontType2 /BaseFont /NotoNaskhArabic \
             /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> \
             /FontDescriptor {descriptor} 0 R /CIDToGIDMap /Identity /DW 500 >>\nendobj\n"
        )
        .as_bytes(),
    );

    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{descriptor} 0 obj\n<< /Type /FontDescriptor /FontName /NotoNaskhArabic /Flags 4 \
             /FontBBox [{x0} {y0} {x1} {y1}] /ItalicAngle 0 /Ascent {ascent} /Descent {descent} \
             /CapHeight {cap} /StemV 80 /FontFile2 {file_id} 0 R >>\nendobj\n",
            x0 = scale(bbox.x_min),
            y0 = scale(bbox.y_min),
            x1 = scale(bbox.x_max),
            y1 = scale(bbox.y_max),
            ascent = scale(face.ascender()),
            descent = scale(face.descender()),
            cap = scale(face.capital_height().unwrap_or(face.ascender())),
        )
        .as_bytes(),
    );

    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(FONT).expect("compress font");
    let compressed = encoder.finish().expect("compress font");
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{file_id} 0 obj\n<< /Length {} /Length1 {} /Filter /FlateDecode >>\nstream\n",
            compressed.len(),
            FONT.len()
        )
        .as_bytes(),
    );
    out.extend_from_slice(&compressed);
    out.extend_from_slice(b"\nendstream\nendobj\n");
}
