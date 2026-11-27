//! T3.4: an attachment download that breaks off resumes where it stopped.

use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

const BLOB: &[u8] = b"0123456789";

/// First request: promises 10 bytes, sends 4, hangs up. Second: must ask for `bytes=4-`.
async fn flaky_server() -> (String, tokio::task::JoinHandle<Vec<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
        let mut seen = Vec::new();
        for round in 0..2 {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut req = vec![0u8; 2048];
            let n = sock.read(&mut req).await.unwrap();
            let text = String::from_utf8_lossy(&req[..n]).to_ascii_lowercase();
            let range = text
                .lines()
                .find_map(|l| l.strip_prefix("range: ").map(str::to_string))
                .unwrap_or_default();
            seen.push(range.clone());
            if round == 0 {
                let head = "HTTP/1.1 200 OK\r\ncontent-length: 10\r\nconnection: close\r\n\r\n";
                sock.write_all(head.as_bytes()).await.unwrap();
                sock.write_all(&BLOB[..4]).await.unwrap();
            } else {
                let start: usize = range
                    .trim()
                    .trim_start_matches("bytes=")
                    .trim_end_matches('-')
                    .parse()
                    .unwrap_or(0);
                let rest = &BLOB[start..];
                let head = format!(
                    "HTTP/1.1 206 Partial Content\r\ncontent-length: {}\r\ncontent-range: bytes {start}-9/10\r\nconnection: close\r\n\r\n",
                    rest.len()
                );
                sock.write_all(head.as_bytes()).await.unwrap();
                sock.write_all(rest).await.unwrap();
            }
            sock.shutdown().await.ok();
        }
        seen
    });
    (format!("http://{addr}/blob"), handle)
}

#[tokio::test]
async fn a_broken_download_resumes_from_where_it_stopped() {
    let pool = test_memory_pool().await.unwrap();
    run_migrations(&pool).await.unwrap();
    let client = reqwest::Client::new();
    let (url, server) = flaky_server().await;

    let first = medoc_sync::blob_resume::fetch(&client, &url, "t", &pool, "sha").await;
    assert!(first.is_none(), "a broken stream is not a finished blob");
    let second = medoc_sync::blob_resume::fetch(&client, &url, "t", &pool, "sha").await;
    assert_eq!(second.as_deref(), Some(BLOB));

    let ranges = server.await.unwrap();
    assert_eq!(ranges[0], "", "first request asks for everything");
    assert_eq!(
        ranges[1].trim(),
        "bytes=4-",
        "second asks only for the rest"
    );
}
