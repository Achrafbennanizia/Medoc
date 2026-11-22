//! Embedded TrueType fonts and their PDF objects.
//!
//! Helvetica / Helvetica-Bold (base-14, `/F1`, `/F2`) still draw every string
//! that WinAnsi can encode, so German, English and French documents keep
//! their look and stay small. Everything else is drawn with an embedded font:
//!
//! | Resource | Font                       | Used for                               |
//! |----------|----------------------------|----------------------------------------|
//! | `/F3`    | Noto Naskh Arabic Regular  | Arabic script (ar, fa, ur …)           |
//! | `/F4`    | Noto Naskh Arabic Bold     | Arabic script, bold                    |
//! | `/F5`    | Noto Sans Regular          | Latin Extended, Greek, Cyrillic, IPA … |
//! | `/F6`    | Noto Sans Bold             | the same, bold                         |
//!
//! Adding a script later (e.g. Hebrew) means adding one [`FontSpec`] entry
//! and its two `.ttf` files; the text engine picks the first font in
//! [`FONTS`] that has a glyph for a character.
//!
//! Fonts are **subset** per document: only the glyphs a PDF uses are
//! embedded. Content streams address glyphs by their original glyph id (used
//! as CID); a `/CIDToGIDMap` stream maps those CIDs to the subset's glyph ids.
//! Every font also gets a `/W` width array and a `/ToUnicode` CMap, so text
//! can be searched and copied from the PDF (Arabic included).

use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fmt::Write as _;
use std::io::Write as _;
use std::sync::{LazyLock, Mutex};

use flate2::write::ZlibEncoder;
use flate2::Compression;

/// What a font is meant for. The text engine asks for a role, then falls
/// back through [`FONTS`] by glyph coverage.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum FontRole {
    /// Arabic-script runs (right to left, joined letters).
    Arabic,
    /// Any other script Helvetica cannot draw.
    Universal,
}

pub struct FontSpec {
    /// PDF resource name for the regular weight (bold = `res_bold`).
    pub res_regular: &'static str,
    pub res_bold: &'static str,
    pub base_name_regular: &'static str,
    pub base_name_bold: &'static str,
    pub role: FontRole,
    pub regular: &'static [u8],
    pub bold: &'static [u8],
}

/// Ordered by preference inside a role. Resource names must be unique and
/// must not clash with `/F1` / `/F2` (Helvetica).
pub static FONTS: &[FontSpec] = &[
    FontSpec {
        res_regular: "F3",
        res_bold: "F4",
        base_name_regular: "NotoNaskhArabic",
        base_name_bold: "NotoNaskhArabic-Bold",
        role: FontRole::Arabic,
        regular: include_bytes!("../../../assets/fonts/NotoNaskhArabic-Regular.ttf"),
        bold: include_bytes!("../../../assets/fonts/NotoNaskhArabic-Bold.ttf"),
    },
    FontSpec {
        res_regular: "F5",
        res_bold: "F6",
        base_name_regular: "NotoSans",
        base_name_bold: "NotoSans-Bold",
        role: FontRole::Universal,
        regular: include_bytes!("../../../assets/fonts/NotoSans-Regular.ttf"),
        bold: include_bytes!("../../../assets/fonts/NotoSans-Bold.ttf"),
    },
];

/// One loaded face (one weight of one [`FontSpec`]).
pub struct LoadedFace {
    pub res: &'static str,
    pub base_name: &'static str,
    pub role: FontRole,
    pub bold: bool,
    pub data: &'static [u8],
    pub face: rustybuzz::Face<'static>,
    pub upem: f64,
}

impl LoadedFace {
    pub fn has_glyph(&self, ch: char) -> bool {
        self.face.glyph_index(ch).is_some_and(|g| g.0 != 0)
    }

    /// Advance width of a glyph in 1/1000 em (PDF glyph space).
    pub fn advance_1000(&self, gid: u16) -> i32 {
        let adv = self
            .face
            .glyph_hor_advance(rustybuzz::ttf_parser::GlyphId(gid))
            .unwrap_or(0);
        (f64::from(adv) * 1000.0 / self.upem).round() as i32
    }
}

static FACES: LazyLock<Vec<LoadedFace>> = LazyLock::new(|| {
    let mut out = Vec::new();
    for spec in FONTS {
        for bold in [false, true] {
            let data = if bold { spec.bold } else { spec.regular };
            let face = rustybuzz::Face::from_slice(data, 0).expect("embedded font must parse");
            let upem = f64::from(face.units_per_em().max(1));
            out.push(LoadedFace {
                res: if bold {
                    spec.res_bold
                } else {
                    spec.res_regular
                },
                base_name: if bold {
                    spec.base_name_bold
                } else {
                    spec.base_name_regular
                },
                role: spec.role,
                bold,
                data,
                face,
                upem,
            });
        }
    }
    out
});

pub fn faces() -> &'static [LoadedFace] {
    &FACES
}

pub fn face_by_res(res: &str) -> Option<&'static LoadedFace> {
    FACES.iter().find(|f| f.res == res)
}

/// First face of `role` (or, failing that, of any role) that can draw `ch`.
pub fn face_for(ch: char, role: FontRole, bold: bool) -> Option<&'static LoadedFace> {
    let by_weight = |f: &&LoadedFace| f.bold == bold;
    FACES
        .iter()
        .filter(by_weight)
        .filter(|f| f.role == role)
        .find(|f| f.has_glyph(ch))
        .or_else(|| FACES.iter().filter(by_weight).find(|f| f.has_glyph(ch)))
}

/// True when any embedded font has a glyph for `ch`.
pub fn any_has_glyph(ch: char) -> bool {
    FACES.iter().any(|f| f.has_glyph(ch))
}

// ---------------------------------------------------------------------------
// ToUnicode registry
// ---------------------------------------------------------------------------

/// Glyph → text it stands for, per font resource. Filled while shaping so the
/// ToUnicode CMap can map contextual Arabic forms back to their letters.
static TO_UNICODE: LazyLock<Mutex<HashMap<(&'static str, u16), String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn remember_unicode(res: &'static str, gid: u16, text: &str) {
    if gid == 0 || text.is_empty() {
        return;
    }
    if let Ok(mut map) = TO_UNICODE.lock() {
        map.entry((res, gid)).or_insert_with(|| text.to_string());
    }
}

fn unicode_for(res: &'static str, gid: u16) -> Option<String> {
    TO_UNICODE.lock().ok()?.get(&(res, gid)).cloned()
}

// ---------------------------------------------------------------------------
// Usage scan + PDF objects
// ---------------------------------------------------------------------------

/// Glyph ids used per embedded font resource, read back from the content
/// streams (`/F3 9 Tf … <0012003A> Tj`).
pub fn scan_used_glyphs(streams: &[&str]) -> BTreeMap<&'static str, BTreeSet<u16>> {
    let mut used: BTreeMap<&'static str, BTreeSet<u16>> = BTreeMap::new();
    for stream in streams {
        let mut current: Option<&'static str> = None;
        let bytes = stream.as_bytes();
        let mut i = 0;
        while i < bytes.len() {
            match bytes[i] {
                b'/' => {
                    // `/Fn size Tf`
                    let start = i + 1;
                    let mut j = start;
                    while j < bytes.len() && bytes[j].is_ascii_alphanumeric() {
                        j += 1;
                    }
                    let name = &stream[start..j];
                    if name.starts_with('F') {
                        current = FACES.iter().find(|f| f.res == name).map(|f| f.res);
                    }
                    i = j;
                }
                b'<' if current.is_some() => {
                    let start = i + 1;
                    let mut j = start;
                    while j < bytes.len() && bytes[j] != b'>' {
                        j += 1;
                    }
                    let hex = &stream[start..j.min(stream.len())];
                    let set = used.entry(current.unwrap_or("F3")).or_default();
                    for k in (0..hex.len() / 4).map(|n| n * 4) {
                        if let Ok(g) = u16::from_str_radix(&hex[k..k + 4], 16) {
                            set.insert(g);
                        }
                    }
                    i = j + 1;
                }
                b'(' => {
                    // Skip literal strings (Helvetica text) so a "<" inside
                    // them is not read as a glyph string.
                    let mut j = i + 1;
                    let mut depth = 1;
                    while j < bytes.len() && depth > 0 {
                        match bytes[j] {
                            b'\\' => j += 1,
                            b'(' => depth += 1,
                            b')' => depth -= 1,
                            _ => {}
                        }
                        j += 1;
                    }
                    i = j;
                }
                _ => i += 1,
            }
        }
    }
    used
}

fn compress(data: &[u8]) -> Vec<u8> {
    let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
    enc.write_all(data).expect("zlib");
    enc.finish().expect("zlib")
}

fn stream_obj(id: usize, dict_extra: &str, data: &[u8]) -> Vec<u8> {
    let compressed = compress(data);
    let mut out = format!(
        "{id} 0 obj\n<< /Length {} /Filter /FlateDecode{dict_extra} >>\nstream\n",
        compressed.len()
    )
    .into_bytes();
    out.extend_from_slice(&compressed);
    out.extend_from_slice(b"\nendstream\nendobj\n");
    out
}

/// Number of PDF objects [`append_font_objects`] writes per font.
pub const OBJECTS_PER_FONT: usize = 6;

/// Six objects starting at `first_id`: Type0, CIDFont, descriptor, font
/// file, CIDToGIDMap, ToUnicode. The `/Fn` resource must point at `first_id`.
pub fn append_font_objects(
    out: &mut Vec<u8>,
    offsets: &mut Vec<usize>,
    first_id: usize,
    face: &LoadedFace,
    used: &BTreeSet<u16>,
) {
    let type0 = first_id;
    let cid_font = first_id + 1;
    let descriptor = first_id + 2;
    let file_id = first_id + 3;
    let map_id = first_id + 4;
    let tounicode_id = first_id + 5;

    // Subset. On failure embed the whole font (bigger, still correct) with an
    // identity map.
    let mut remapper = subsetter::GlyphRemapper::new();
    for g in used {
        remapper.remap(*g);
    }
    let (font_bytes, map): (Vec<u8>, Vec<(u16, u16)>) =
        match subsetter::subset(face.data, 0, &remapper) {
            Ok(bytes) => (
                bytes,
                used.iter()
                    .map(|g| (*g, remapper.get(*g).unwrap_or(0)))
                    .collect(),
            ),
            Err(_) => (face.data.to_vec(), used.iter().map(|g| (*g, *g)).collect()),
        };

    let tag = subset_tag(used);
    let font_name = format!("{tag}+{}", face.base_name);
    let scale = |v: i16| -> i32 { (f64::from(v) * 1000.0 / face.upem).round() as i32 };
    let bbox = face.face.global_bounding_box();

    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{type0} 0 obj\n<< /Type /Font /Subtype /Type0 /BaseFont /{font_name} \
             /Encoding /Identity-H /DescendantFonts [{cid_font} 0 R] /ToUnicode {tounicode_id} 0 R >>\nendobj\n"
        )
        .as_bytes(),
    );

    // /W: [cid [w]] per used glyph.
    let mut widths = String::new();
    for g in used {
        let _ = write!(widths, "{g} [{}] ", face.advance_1000(*g));
    }
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{cid_font} 0 obj\n<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{font_name} \
             /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> \
             /FontDescriptor {descriptor} 0 R /CIDToGIDMap {map_id} 0 R /DW 0 /W [{widths}] >>\nendobj\n"
        )
        .as_bytes(),
    );

    let flags = 4 | if face.bold { 1 << 18 } else { 0 };
    offsets.push(out.len());
    out.extend_from_slice(
        format!(
            "{descriptor} 0 obj\n<< /Type /FontDescriptor /FontName /{font_name} /Flags {flags} \
             /FontBBox [{x0} {y0} {x1} {y1}] /ItalicAngle 0 /Ascent {ascent} /Descent {descent} \
             /CapHeight {cap} /StemV {stem} /FontFile2 {file_id} 0 R >>\nendobj\n",
            x0 = scale(bbox.x_min),
            y0 = scale(bbox.y_min),
            x1 = scale(bbox.x_max),
            y1 = scale(bbox.y_max),
            ascent = scale(face.face.ascender()),
            descent = scale(face.face.descender()),
            cap = scale(face.face.capital_height().unwrap_or(face.face.ascender())),
            stem = if face.bold { 120 } else { 80 },
        )
        .as_bytes(),
    );

    offsets.push(out.len());
    out.extend_from_slice(&stream_obj(
        file_id,
        &format!(" /Length1 {}", font_bytes.len()),
        &font_bytes,
    ));

    // CIDToGIDMap: two bytes per CID, CID = original glyph id.
    let max_cid = used.iter().copied().max().unwrap_or(0) as usize;
    let mut cid_map = vec![0u8; (max_cid + 1) * 2];
    for (cid, gid) in &map {
        let i = *cid as usize * 2;
        cid_map[i] = (gid >> 8) as u8;
        cid_map[i + 1] = (gid & 0xFF) as u8;
    }
    offsets.push(out.len());
    out.extend_from_slice(&stream_obj(map_id, "", &cid_map));

    offsets.push(out.len());
    out.extend_from_slice(&stream_obj(
        tounicode_id,
        "",
        to_unicode_cmap(face.res, used).as_bytes(),
    ));
}

/// Six capital letters derived from the glyph set (PDF subset prefix).
fn subset_tag(used: &BTreeSet<u16>) -> String {
    let mut h: u64 = 0xcbf2_9ce4_8422_2325;
    for g in used {
        h ^= u64::from(*g);
        h = h.wrapping_mul(0x0100_0000_01b3);
    }
    (0..6)
        .map(|i| (b'A' + ((h >> (i * 5)) % 26) as u8) as char)
        .collect()
}

fn to_unicode_cmap(res: &'static str, used: &BTreeSet<u16>) -> String {
    let mut entries: Vec<(u16, String)> = Vec::new();
    for g in used {
        if let Some(text) = unicode_for(res, *g) {
            let mut hex = String::new();
            for unit in text.encode_utf16() {
                let _ = write!(hex, "{unit:04X}");
            }
            entries.push((*g, hex));
        }
    }
    let mut s = String::from(
        "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n\
         /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n\
         /CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n\
         1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n",
    );
    for chunk in entries.chunks(100) {
        let _ = writeln!(s, "{} beginbfchar", chunk.len());
        for (g, hex) in chunk {
            let _ = writeln!(s, "<{g:04X}> <{hex}>");
        }
        s.push_str("endbfchar\n");
    }
    s.push_str("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_font_parses_and_has_its_script() {
        assert!(face_for('م', FontRole::Arabic, false).is_some());
        assert!(face_for('م', FontRole::Arabic, true).is_some());
        assert!(face_for('Ł', FontRole::Universal, false).is_some());
        assert!(face_for('Ж', FontRole::Universal, true).is_some());
    }

    #[test]
    fn scan_reads_glyph_strings_but_not_literals() {
        let s = "BT /F1 9 Tf (a <0001> b) Tj ET\nBT /F3 9 Tf 10 10 Td <0012003A> Tj ET";
        let used = scan_used_glyphs(&[s]);
        assert_eq!(used.len(), 1);
        assert_eq!(
            used.get("F3").unwrap().iter().copied().collect::<Vec<_>>(),
            vec![0x12, 0x3A]
        );
    }

    #[test]
    fn subset_is_much_smaller_than_the_font() {
        let face = face_by_res("F5").unwrap();
        let used: BTreeSet<u16> = "Łukasz"
            .chars()
            .filter_map(|c| face.face.glyph_index(c).map(|g| g.0))
            .collect();
        let mut out = Vec::new();
        let mut offsets = Vec::new();
        append_font_objects(&mut out, &mut offsets, 10, face, &used);
        assert_eq!(offsets.len(), OBJECTS_PER_FONT);
        assert!(out.len() < 60_000, "subset too big: {}", out.len());
    }
}
