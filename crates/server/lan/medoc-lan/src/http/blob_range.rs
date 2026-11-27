//! `Range: bytes=N-` on attachment downloads (T3.4): a replica whose download broke off asks
//! for the rest only. Any other range form gets the whole blob (200), which clients handle too.

use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

/// Start offset of a `bytes=N-` range, when it lies inside the blob.
fn open_range_start(headers: &HeaderMap, len: usize) -> Option<usize> {
    let raw = headers.get(header::RANGE)?.to_str().ok()?.trim();
    let start: usize = raw
        .strip_prefix("bytes=")?
        .strip_suffix('-')?
        .parse()
        .ok()?;
    (start > 0 && start < len).then_some(start)
}

pub fn respond(headers: &HeaderMap, bytes: Vec<u8>) -> Response {
    let len = bytes.len();
    let Some(start) = open_range_start(headers, len) else {
        return (
            [(header::ACCEPT_RANGES, HeaderValue::from_static("bytes"))],
            bytes,
        )
            .into_response();
    };
    let range = format!("bytes {start}-{}/{len}", len - 1);
    let mut resp = (StatusCode::PARTIAL_CONTENT, bytes[start..].to_vec()).into_response();
    if let Ok(v) = HeaderValue::from_str(&range) {
        resp.headers_mut().insert(header::CONTENT_RANGE, v);
    }
    resp
}

#[cfg(test)]
mod tests {
    use super::*;

    fn with_range(v: &str) -> HeaderMap {
        let mut h = HeaderMap::new();
        h.insert(header::RANGE, HeaderValue::from_str(v).unwrap());
        h
    }

    #[test]
    fn only_an_open_range_inside_the_blob_is_honoured() {
        assert_eq!(open_range_start(&with_range("bytes=4-"), 10), Some(4));
        assert_eq!(open_range_start(&with_range("bytes=0-"), 10), None);
        assert_eq!(open_range_start(&with_range("bytes=10-"), 10), None);
        assert_eq!(open_range_start(&with_range("bytes=2-5"), 10), None);
        assert_eq!(open_range_start(&HeaderMap::new(), 10), None);
    }

    #[test]
    fn a_resumed_download_gets_the_rest_with_206() {
        let resp = respond(&with_range("bytes=3-"), b"0123456789".to_vec());
        assert_eq!(resp.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(resp.headers()[header::CONTENT_RANGE], "bytes 3-9/10");
    }
}
