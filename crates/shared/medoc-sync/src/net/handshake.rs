//! Noise XX handshake over async TCP streams (length-prefixed handshake messages).

use medoc_core::error::AppError;
use snow::Keypair;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::transport::{generate_keypair, NoiseHandshake, NoiseTransport};

const HS_BUF: usize = 2048;

async fn write_hs_message(stream: &mut TcpStream, data: &[u8]) -> Result<(), AppError> {
    let len = u16::try_from(data.len())
        .map_err(|_| AppError::Internal("handshake message too large".into()))?;
    stream
        .write_all(&len.to_be_bytes())
        .await
        .map_err(|e| AppError::Internal(format!("handshake write len: {e}")))?;
    stream
        .write_all(data)
        .await
        .map_err(|e| AppError::Internal(format!("handshake write: {e}")))?;
    Ok(())
}

async fn read_hs_message(stream: &mut TcpStream) -> Result<Vec<u8>, AppError> {
    let mut len_buf = [0u8; 2];
    stream
        .read_exact(&mut len_buf)
        .await
        .map_err(|e| AppError::Internal(format!("handshake read len: {e}")))?;
    let len = usize::from(u16::from_be_bytes(len_buf));
    if len > HS_BUF {
        return Err(AppError::Validation("handshake message too large".into()));
    }
    let mut buf = vec![0u8; len];
    stream
        .read_exact(&mut buf)
        .await
        .map_err(|e| AppError::Internal(format!("handshake read: {e}")))?;
    Ok(buf)
}

/// Run Noise XX as initiator on `stream` using a fresh local keypair.
pub async fn run_xx_initiator(
    stream: &mut TcpStream,
) -> Result<(NoiseTransport, Vec<u8>), AppError> {
    run_xx_initiator_with_keypair(stream, &generate_keypair()?).await
}

/// Run Noise XX as initiator with the given device keypair.
pub async fn run_xx_initiator_with_keypair(
    stream: &mut TcpStream,
    local: &Keypair,
) -> Result<(NoiseTransport, Vec<u8>), AppError> {
    let mut buf_out = vec![0u8; HS_BUF];
    let mut payload = vec![0u8; HS_BUF];

    let mut ini = NoiseHandshake::new_xx_initiator(local)?;

    let n1 = ini.write_message(&[], &mut buf_out)?;
    write_hs_message(stream, &buf_out[..n1]).await?;
    let msg2 = read_hs_message(stream).await?;
    let _ = ini.read_message(&msg2, &mut payload)?;

    let n3 = ini.write_message(&[], &mut buf_out)?;
    write_hs_message(stream, &buf_out[..n3]).await?;

    if !ini.is_complete() {
        return Err(AppError::Internal("Noise XX initiator incomplete".into()));
    }
    let transcript = ini.transcript().to_vec();
    let transport = ini.into_transport()?;
    Ok((transport, transcript))
}

/// Run Noise XX as responder on `stream`.
pub async fn run_xx_responder(
    stream: &mut TcpStream,
) -> Result<(NoiseTransport, Vec<u8>), AppError> {
    run_xx_responder_with_keypair(stream, &generate_keypair()?).await
}

/// Run Noise XX as responder with the given device keypair.
pub async fn run_xx_responder_with_keypair(
    stream: &mut TcpStream,
    local: &Keypair,
) -> Result<(NoiseTransport, Vec<u8>), AppError> {
    let mut buf_out = vec![0u8; HS_BUF];
    let mut payload = vec![0u8; HS_BUF];

    let mut res = NoiseHandshake::new_xx_responder(local)?;

    let msg1 = read_hs_message(stream).await?;
    let _ = res.read_message(&msg1, &mut payload)?;

    let n2 = res.write_message(&[], &mut buf_out)?;
    write_hs_message(stream, &buf_out[..n2]).await?;
    let msg3 = read_hs_message(stream).await?;
    let _ = res.read_message(&msg3, &mut payload)?;

    if !res.is_complete() {
        return Err(AppError::Internal("Noise XX responder incomplete".into()));
    }
    let transcript = res.transcript().to_vec();
    let transport = res.into_transport()?;
    Ok((transport, transcript))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn xx_handshake_over_tcp_loopback() {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind");
        let addr = listener.local_addr().expect("addr");
        let kp1 = generate_keypair().expect("kp1");
        let kp2 = generate_keypair().expect("kp2");

        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.expect("accept");
            run_xx_responder_with_keypair(&mut stream, &kp2)
                .await
                .expect("responder")
        });

        let mut client = TcpStream::connect(addr).await.expect("connect");
        let (_t1, tr1) = run_xx_initiator_with_keypair(&mut client, &kp1)
            .await
            .expect("initiator");
        let (_t2, tr2) = server.await.expect("server join");
        assert!(!tr1.is_empty());
        assert_eq!(tr1, tr2);
    }
}
