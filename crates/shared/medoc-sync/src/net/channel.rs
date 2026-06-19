//! Encrypted wire messages over an established Noise transport.

use medoc_core::error::AppError;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::transport::NoiseTransport;
use super::wire::{decode_frame, encode_frame, WireMessage};

const MAX_CIPHER: usize = 4 * 1024 * 1024 + 64;

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
    if len > MAX_CIPHER {
        return Err(AppError::Validation("cipher frame too large".into()));
    }
    let mut buf = vec![0u8; len];
    stream
        .read_exact(&mut buf)
        .await
        .map_err(|e| AppError::Internal(format!("cipher read: {e}")))?;
    Ok(buf)
}

/// Encode, encrypt, and send a wire message.
pub async fn send_wire_message(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    msg: &WireMessage,
) -> Result<(), AppError> {
    let frame = encode_frame(msg)?;
    let mut enc = vec![0u8; frame.len() + 64];
    let enc_len = transport.encrypt(&frame, &mut enc)?;
    write_cipher_frame(stream, &enc[..enc_len]).await
}

/// Receive, decrypt, and decode a wire message.
pub async fn recv_wire_message(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
) -> Result<WireMessage, AppError> {
    let cipher = read_cipher_frame(stream).await?;
    let mut plain = vec![0u8; MAX_CIPHER];
    let plain_len = transport.decrypt(&cipher, &mut plain)?;
    decode_frame(&plain[..plain_len])
}
