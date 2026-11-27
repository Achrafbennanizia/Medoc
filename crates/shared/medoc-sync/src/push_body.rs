//! Push bodies over the LAN (T3.4, docs/architecture/editions-plan.md).
//!
//! Pull pages come back gzipped (the main device's `CompressionLayer`). A push page is the same
//! kind of JSON, so a replica gzips it once it is big enough to be worth it; the main device
//! decompresses it before its body limit (`medoc-lan` `RequestDecompressionLayer`). A main device
//! from before that layer answers 400/415: the caller then sends the page once more, plain.

use std::io::Write;

/// Below this a page is sent as it is (gzip costs more than it saves).
pub const GZIP_MIN_BYTES: usize = 8 * 1024;

/// The bytes to send and whether they are gzipped.
pub fn encode(json: &[u8]) -> (Vec<u8>, bool) {
    if json.len() < GZIP_MIN_BYTES {
        return (json.to_vec(), false);
    }
    let mut enc = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
    match enc.write_all(json).and_then(|_| enc.finish()) {
        Ok(gz) if gz.len() < json.len() => (gz, true),
        _ => (json.to_vec(), false),
    }
}

/// A JSON POST with the body from [`encode`].
pub fn request(
    builder: reqwest::RequestBuilder,
    body: Vec<u8>,
    gzipped: bool,
) -> reqwest::RequestBuilder {
    let builder = builder.header(reqwest::header::CONTENT_TYPE, "application/json");
    if gzipped {
        builder
            .header(reqwest::header::CONTENT_ENCODING, "gzip")
            .body(body)
    } else {
        builder.body(body)
    }
}

/// An older main device that cannot read a gzipped body.
pub fn rejected_encoding(status: reqwest::StatusCode) -> bool {
    matches!(status.as_u16(), 400 | 415)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn page(n: usize) -> Vec<u8> {
        let entries: Vec<_> = (0..n)
            .map(|i| {
                serde_json::json!({
                    "id": format!("e-{i:08}"), "deviceId": "3f9a21c0-1b2c-4d5e-8f90-a1b2c3d4e5f6",
                    "seq": i, "entityTable": "appointment", "entityId": format!("a-{i:08}"),
                    "op": "UPDATE",
                    "payloadJson": format!(r#"{{"id":"a-{i:08}","date":"2026-11-24","time":"09:{:02}","status":"PLANNED","notes":"Kontrolle","syncHlc":"1795545301914:{i}"}}"#, i % 60),
                    "createdAt": "2026-11-24T09:00:00Z", "signature": "x".repeat(88)
                })
            })
            .collect();
        serde_json::to_vec(&serde_json::json!({ "entries": entries })).unwrap()
    }

    #[test]
    fn small_pages_go_plain() {
        let (body, gz) = encode(b"{\"entries\":[]}");
        assert!(!gz);
        assert_eq!(body, b"{\"entries\":[]}");
    }

    #[test]
    fn a_full_page_shrinks_and_reads_back() {
        let json = page(200);
        let (body, gz) = encode(&json);
        assert!(gz);
        // Benchmark of record: a 200-entry appointment page shrinks more than 5x.
        assert!(
            body.len() * 5 < json.len(),
            "{} -> {}",
            json.len(),
            body.len()
        );
        let mut out = Vec::new();
        flate2::read::GzDecoder::new(&body[..])
            .read_to_end(&mut out)
            .unwrap();
        assert_eq!(out, json);
    }
}
