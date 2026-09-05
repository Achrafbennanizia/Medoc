//! Practice logo (`practice.logo.v1`) → PDF Image XObject.
//!
//! Stored as `{"mime":"image/png"|"image/jpeg","data":"<base64>"}`.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use flate2::write::ZlibEncoder;
use flate2::Compression;
use image::{ImageReader, Rgba, RgbaImage};
use serde::Deserialize;
use std::io::{Cursor, Write};

use super::core::{M_LEFT, M_RIGHT};

/// Max logo box on the letterhead (points).
pub const LOGO_MAX_HEIGHT: f64 = 48.0;
pub const LOGO_MAX_WIDTH: f64 = 120.0;
/// Gap between logo and practice text.
pub const LOGO_GAP: i32 = 10;

#[derive(Debug, Clone, Deserialize)]
struct LogoKv {
    /// Kept for Settings / KV compatibility; decode sniffs image bytes.
    #[allow(dead_code)]
    mime: String,
    data: String,
}

/// Decoded raster ready for a PDF Image XObject (DeviceRGB, FlateDecode).
#[derive(Debug, Clone)]
pub struct PdfLogo {
    pub width_px: u32,
    pub height_px: u32,
    /// Compressed RGB samples (zlib).
    pub data: Vec<u8>,
    pub display_w: f64,
    pub display_h: f64,
}

impl PdfLogo {
    /// Parse `practice.logo.v1` JSON. Returns `None` on missing/invalid data.
    pub fn from_kv_json(raw: &str) -> Option<Self> {
        let parsed: LogoKv = serde_json::from_str(raw.trim()).ok()?;
        // Prefer sniffing bytes over trusting `mime` — browsers often store WebP/GIF
        // while Settings preview still shows the image.
        let mut b64 = parsed.data.trim();
        if let Some((_, rest)) = b64.split_once("base64,") {
            b64 = rest.trim();
        }
        let bytes = STANDARD.decode(b64).ok()?;
        if bytes.is_empty() || bytes.len() > 4_000_000 {
            return None;
        }
        Self::from_image_bytes(&bytes)
    }

    pub fn from_image_bytes(bytes: &[u8]) -> Option<Self> {
        let reader = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .ok()?;
        let mut rgba = reader.decode().ok()?.to_rgba8();
        let (width_px, height_px) = rgba.dimensions();
        // Ignore 1×1 / placeholder “logos” (e.g. demo seed) — use classic letterhead.
        if width_px < 8 || height_px < 8 || width_px > 4096 || height_px > 4096 {
            return None;
        }
        // Drop transparency-grid / edge backdrop, then flatten onto white paper.
        strip_letterhead_backdrop(&mut rgba);
        let rgb = flatten_rgba_on_white(&rgba);
        let mut enc = ZlibEncoder::new(Vec::new(), Compression::fast());
        enc.write_all(rgb.as_raw()).ok()?;
        let data = enc.finish().ok()?;
        let (display_w, display_h) = fit_display(width_px, height_px);
        Some(Self {
            width_px,
            height_px,
            data,
            display_w,
            display_h,
        })
    }

    /// Bottom-left X of the logo box (top aligns with `M_TOP`).
    pub fn x_for_side(&self, rtl: bool) -> f64 {
        if rtl {
            f64::from(M_RIGHT) - self.display_w
        } else {
            f64::from(M_LEFT)
        }
    }

    /// Bottom Y of the logo (PDF coords; top of page is high Y).
    pub fn y_bottom(&self, top_y: i32) -> f64 {
        f64::from(top_y) - self.display_h
    }

    /// Left margin for practice text when logo is on the left (LTR).
    pub fn practice_text_left(&self, rtl: bool) -> i32 {
        if rtl {
            M_LEFT
        } else {
            M_LEFT + self.display_w.round() as i32 + LOGO_GAP
        }
    }

    /// Right bound for practice text when logo is on the right (RTL).
    pub fn practice_text_right_cap(&self, rtl: bool) -> i32 {
        if rtl {
            M_RIGHT - self.display_w.round() as i32 - LOGO_GAP
        } else {
            M_RIGHT - 200
        }
    }
}

fn fit_display(w: u32, h: u32) -> (f64, f64) {
    let w = f64::from(w.max(1));
    let h = f64::from(h.max(1));
    let scale = (LOGO_MAX_WIDTH / w).min(LOGO_MAX_HEIGHT / h).min(1.0);
    (w * scale, h * scale)
}

fn channel_close(a: u8, b: u8, tol: i32) -> bool {
    (i32::from(a) - i32::from(b)).abs() <= tol
}

fn rgba_close(a: Rgba<u8>, b: Rgba<u8>, tol: i32) -> bool {
    channel_close(a[0], b[0], tol)
        && channel_close(a[1], b[1], tol)
        && channel_close(a[2], b[2], tol)
}

/// Classic editor transparency grid + near-white paper crumbs.
///
/// macOS / modern previews often use ~`#EEEEEE` with white (not only `#C0C0C0`).
fn looks_like_backdrop(px: Rgba<u8>) -> bool {
    if px[3] < 24 {
        return true;
    }
    let (r, g, b) = (px[0], px[1], px[2]);
    // Low-chroma (neutral) and bright enough to be paper / transparency grid.
    let chroma_ok = channel_close(r, g, 18) && channel_close(g, b, 18);
    chroma_ok && r >= 200 && g >= 200 && b >= 200
}

/// Flood-fill from the image border through backdrop-like pixels and clear them
/// (alpha → 0). Removes exported transparency grids without eating gold/brand ink.
fn strip_letterhead_backdrop(img: &mut RgbaImage) {
    let (w, h) = img.dimensions();
    if w == 0 || h == 0 {
        return;
    }
    let mut visited = vec![false; (w * h) as usize];
    let mut stack: Vec<(u32, u32)> = Vec::new();

    let push = |stack: &mut Vec<(u32, u32)>, visited: &mut [bool], x: u32, y: u32| {
        let i = (y * w + x) as usize;
        if visited[i] {
            return;
        }
        visited[i] = true;
        stack.push((x, y));
    };

    for x in 0..w {
        push(&mut stack, &mut visited, x, 0);
        push(&mut stack, &mut visited, x, h - 1);
    }
    for y in 0..h {
        push(&mut stack, &mut visited, 0, y);
        push(&mut stack, &mut visited, w - 1, y);
    }

    while let Some((x, y)) = stack.pop() {
        let px = *img.get_pixel(x, y);
        if !looks_like_backdrop(px) {
            // Corner seed that is not backdrop (rare) — still allow flood only through backdrop.
            // If the edge pixel is brand color, do not clear it or expand.
            continue;
        }
        img.put_pixel(x, y, Rgba([255, 255, 255, 0]));
        for (nx, ny) in [
            (x.wrapping_sub(1), y),
            (x + 1, y),
            (x, y.wrapping_sub(1)),
            (x, y + 1),
        ] {
            if nx >= w || ny >= h {
                continue;
            }
            let i = (ny * w + nx) as usize;
            if visited[i] {
                continue;
            }
            let n = *img.get_pixel(nx, ny);
            if looks_like_backdrop(n) || rgba_close(n, px, 28) {
                push(&mut stack, &mut visited, nx, ny);
            }
        }
    }
}

fn flatten_rgba_on_white(img: &RgbaImage) -> image::RgbImage {
    let (w, h) = img.dimensions();
    let mut out = image::RgbImage::new(w, h);
    for (x, y, px) in img.enumerate_pixels() {
        let a = f32::from(px[3]) / 255.0;
        let r = (f32::from(px[0]) * a + 255.0 * (1.0 - a)).round() as u8;
        let g = (f32::from(px[1]) * a + 255.0 * (1.0 - a)).round() as u8;
        let b = (f32::from(px[2]) * a + 255.0 * (1.0 - a)).round() as u8;
        out.put_pixel(x, y, image::Rgb([r, g, b]));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_tiny_png_kv() {
        // Real 16×16 PNG (not the 1×1 seed placeholder)
        let img = image::RgbImage::from_pixel(16, 16, image::Rgb([20, 80, 160]));
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .expect("encode");
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
        let json = format!(r#"{{"mime":"image/png","data":"{b64}"}}"#);
        let logo = PdfLogo::from_kv_json(&json).expect("logo");
        assert_eq!(logo.width_px, 16);
        assert_eq!(logo.height_px, 16);
        assert!(logo.display_h <= LOGO_MAX_HEIGHT);
        assert!(logo.x_for_side(false) < logo.x_for_side(true));
    }

    #[test]
    fn rejects_one_pixel_placeholder() {
        let json = r#"{"mime":"image/png","data":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="}"#;
        assert!(PdfLogo::from_kv_json(json).is_none());
    }

    #[test]
    fn accepts_data_url_prefixed_base64() {
        let img = image::RgbImage::from_pixel(12, 12, image::Rgb([200, 40, 40]));
        let mut buf = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut std::io::Cursor::new(&mut buf), image::ImageFormat::Png)
            .expect("encode");
        use base64::Engine;
        let b64 = base64::engine::general_purpose::STANDARD.encode(&buf);
        let json = format!(r#"{{"mime":"image/webp","data":"data:image/png;base64,{b64}"}}"#);
        let logo = PdfLogo::from_kv_json(&json).expect("logo despite mime/data-url");
        assert_eq!(logo.width_px, 12);
    }

    #[test]
    fn strips_checkerboard_backdrop_keeps_subject() {
        let mut img = RgbaImage::from_fn(32, 32, |x, y| {
            // Classic transparency grid.
            if ((x / 4) + (y / 4)) % 2 == 0 {
                Rgba([255, 255, 255, 255])
            } else {
                Rgba([204, 204, 204, 255])
            }
        });
        // Solid brand blob in the center.
        for y in 10..22 {
            for x in 10..22 {
                img.put_pixel(x, y, Rgba([180, 120, 40, 255]));
            }
        }
        strip_letterhead_backdrop(&mut img);
        let flat = flatten_rgba_on_white(&img);
        // Corner must be paper white after flatten.
        assert_eq!(*flat.get_pixel(0, 0), image::Rgb([255, 255, 255]));
        assert_eq!(*flat.get_pixel(31, 31), image::Rgb([255, 255, 255]));
        // Subject remains gold-ish.
        let mid = *flat.get_pixel(16, 16);
        assert!(mid[0] > 100 && mid[1] > 60 && mid[2] < 80, "{mid:?}");
    }

    #[test]
    fn strips_macos_light_gray_transparency_grid() {
        // Observed in production screenshots: white + ~#EEEEEE cells.
        let mut img = RgbaImage::from_fn(40, 40, |x, y| {
            if ((x / 5) + (y / 5)) % 2 == 0 {
                Rgba([255, 255, 255, 255])
            } else {
                Rgba([238, 238, 238, 255])
            }
        });
        for y in 12..28 {
            for x in 12..28 {
                img.put_pixel(x, y, Rgba([190, 130, 45, 255]));
            }
        }
        strip_letterhead_backdrop(&mut img);
        let flat = flatten_rgba_on_white(&img);
        assert_eq!(*flat.get_pixel(1, 1), image::Rgb([255, 255, 255]));
        assert_eq!(*flat.get_pixel(7, 7), image::Rgb([255, 255, 255]));
        let mid = *flat.get_pixel(20, 20);
        assert!(mid[0] > 150 && mid[2] < 80, "{mid:?}");
    }
}
