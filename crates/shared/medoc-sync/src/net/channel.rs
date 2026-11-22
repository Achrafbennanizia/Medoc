//! Encrypted wire messages over an established Noise transport.
//!
//! A Noise transport message is limited to 65 535 bytes (ciphertext incl.
//! the 16-byte tag). Wire frames can be up to 4 MiB (provisioning settings,
//! staff directory), so a frame is split into chunks of at most
//! [`MAX_NOISE_PLAINTEXT`] bytes, each encrypted as its own Noise message
//! and sent with a 4-byte length prefix. The receiver knows the frame size
//! from the first 4 plaintext bytes (the CBOR frame header) and reads chunks
//! until the frame is complete. A frame that fits in one chunk is sent
//! exactly as before, so small messages are unchanged on the wire.

use std::time::Duration;

use medoc_core::error::AppError;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::transport::NoiseTransport;
use super::wire::{decode_frame, encode_frame, WireMessage};

/// Noise spec: max message length 65 535 bytes.
const NOISE_MAX_MESSAGE: usize = 65_535;
/// ChaChaPoly authentication tag.
const NOISE_TAG_LEN: usize = 16;
/// Largest plaintext that fits in one Noise transport message.
pub const MAX_NOISE_PLAINTEXT: usize = NOISE_MAX_MESSAGE - NOISE_TAG_LEN;
/// Upper bound for a whole wire frame (matches `wire::MAX_FRAME` + header).
const MAX_WIRE_FRAME: usize = 4 * 1024 * 1024 + 4;
/// Time allowed for one encrypted chunk to arrive once it has started.
const CHUNK_READ_TIMEOUT: Duration = Duration::from_secs(30);

async fn write_cipher_frame(stream: &mut TcpStream, ciphertext: &[u8]) -> Result<(), AppError> {
    let len = u32::try_from(ciphertext.len())
        .map_err(|_| AppError::Internal("cipher frame length overflow".into()))?;
    stream
        .write_all(&len.to_be_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("cipher write len: {e}")))?;
    stream
        .write_all(ciphertext)
        .await
        .map_err(|e| AppError::Internal(format!("cipher write: {e}")))?;
    Ok(())
}

async fn read_cipher_frame(stream: &mut TcpStream) -> Result<Vec<u8>, AppError> {
    let mut len_buf = [0u8; 4];
    stream
        .read_exact(&mut len_buf)
        .await
        .map_err(|e| AppError::Internal(format!("cipher read len: {e}")))?;
    let len = u32::from_be_bytes(len_buf) as usize;
    // One Noise message can never be longer than 65 535 bytes; anything
    // larger is a protocol error (and would otherwise allocate up to 4 GiB).
    if len == 0 || len > NOISE_MAX_MESSAGE {
        return Err(AppError::Validation("cipher frame length invalid".into()));
    }
    let mut buf = vec![0u8; len];
    tokio::time::timeout(CHUNK_READ_TIMEOUT, stream.read_exact(&mut buf))
        .await
        .map_err(|_| AppError::Validation("cipher read timed out".into()))?
        .map_err(|e| AppError::Internal(format!("cipher read: {e}")))?;
    Ok(buf)
}

/// Encode, encrypt (in ≤64 KiB chunks), and send a wire message.
pub async fn send_wire_message(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    msg: &WireMessage,
) -> Result<(), AppError> {
    let frame = encode_frame(msg)?;
    let mut enc = vec![0u8; NOISE_MAX_MESSAGE];
    for chunk in frame.chunks(MAX_NOISE_PLAINTEXT) {
        let enc_len = transport.encrypt(chunk, &mut enc)?;
        write_cipher_frame(stream, &enc[..enc_len]).await?;
    }
    stream
        .flush()
        .await
        .map_err(|e| AppError::Internal(format!("cipher flush: {e}")))?;
    Ok(())
}

/// Receive, decrypt (reassembling chunks), and decode a wire message.
pub async fn recv_wire_message(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
) -> Result<WireMessage, AppError> {
    let mut plain = vec![0u8; NOISE_MAX_MESSAGE];
    let mut frame: Vec<u8> = Vec::new();
    let mut expected: Option<usize> = None;
    loop {
        let cipher = read_cipher_frame(stream).await?;
        let n = transport.decrypt(&cipher, &mut plain)?;
        frame.extend_from_slice(&plain[..n]);
        if expected.is_none() && frame.len() >= 4 {
            let body = u32::from_be_bytes([frame[0], frame[1], frame[2], frame[3]]) as usize;
            let total = body
                .checked_add(4)
                .filter(|t| *t <= MAX_WIRE_FRAME)
                .ok_or_else(|| AppError::Validation("wire frame too large".into()))?;
            expected = Some(total);
        }
        match expected {
            Some(total) if frame.len() == total => return decode_frame(&frame),
            Some(total) if frame.len() > total => {
                return Err(AppError::Validation("wire frame overrun".into()))
            }
            _ => {}
        }
        if frame.len() > MAX_WIRE_FRAME {
            return Err(AppError::Validation("wire frame too large".into()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::transport::{complete_xx_handshake, generate_keypair};
    use tokio::net::TcpListener;

    /// Frames above the Noise 64 KiB message limit used to fail in `encrypt`.
    #[tokio::test]
    async fn large_frame_is_chunked_and_reassembled() {
        let kp1 = generate_keypair().expect("kp1");
        let kp2 = generate_keypair().expect("kp2");
        let (mut t1, mut t2, _) = complete_xx_handshake(&kp1, &kp2).expect("hs");

        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        let big = "x".repeat(300_000);
        let expected = WireMessage::StaffDirectoryResponse {
            directory_json: big.clone(),
        };
        let server = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.expect("accept");
            let first = recv_wire_message(&mut s, &mut t2).await.expect("recv");
            let second = recv_wire_message(&mut s, &mut t2)
                .await
                .expect("recv small");
            (first, second)
        });
        let mut client = TcpStream::connect(addr).await.expect("connect");
        send_wire_message(&mut client, &mut t1, &expected)
            .await
            .expect("send");
        // A small message afterwards must still decrypt (nonce order kept).
        let small = WireMessage::Discover;
        send_wire_message(&mut client, &mut t1, &small)
            .await
            .expect("send small");
        let (got, second) = server.await.expect("join");
        assert_eq!(got, expected);
        assert_eq!(second, WireMessage::Discover);
    }
}
