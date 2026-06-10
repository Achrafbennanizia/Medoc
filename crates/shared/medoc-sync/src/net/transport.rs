//! L5/L6 Noise XX (pairing) and KK (reconnect) transport with AEAD framing.

use medoc_core::error::AppError;
use snow::{Builder, HandshakeState, Keypair, TransportState};

pub const NOISE_XX: &str = "Noise_XX_25519_ChaChaPoly_SHA256";
pub const NOISE_KK: &str = "Noise_KK_25519_ChaChaPoly_SHA256";

pub struct NoiseHandshake {
    state: HandshakeState,
    transcript: Vec<u8>,
}

impl NoiseHandshake {
    pub fn new_xx_initiator(local: &Keypair) -> Result<Self, AppError> {
        let builder = Builder::new(NOISE_XX.parse().map_err(map_noise)?);
        let state = builder
            .local_private_key(&local.private)
            .build_initiator()
            .map_err(map_noise)?;
        Ok(Self {
            state,
            transcript: Vec::new(),
        })
    }

    pub fn new_xx_responder(local: &Keypair) -> Result<Self, AppError> {
        let builder = Builder::new(NOISE_XX.parse().map_err(map_noise)?);
        let state = builder
            .local_private_key(&local.private)
            .build_responder()
            .map_err(map_noise)?;
        Ok(Self {
            state,
            transcript: Vec::new(),
        })
    }

    pub fn new_kk_initiator(local: &Keypair, remote_static: &[u8]) -> Result<Self, AppError> {
        let builder = Builder::new(NOISE_KK.parse().map_err(map_noise)?);
        let state = builder
            .local_private_key(&local.private)
            .remote_public_key(remote_static)
            .build_initiator()
            .map_err(map_noise)?;
        Ok(Self {
            state,
            transcript: Vec::new(),
        })
    }

    pub fn new_kk_responder(local: &Keypair, remote_static: &[u8]) -> Result<Self, AppError> {
        let builder = Builder::new(NOISE_KK.parse().map_err(map_noise)?);
        let state = builder
            .local_private_key(&local.private)
            .remote_public_key(remote_static)
            .build_responder()
            .map_err(map_noise)?;
        Ok(Self {
            state,
            transcript: Vec::new(),
        })
    }

    pub fn write_message(&mut self, payload: &[u8], out: &mut [u8]) -> Result<usize, AppError> {
        let n = self.state.write_message(payload, out).map_err(map_noise)?;
        self.transcript.extend_from_slice(&out[..n]);
        Ok(n)
    }

    pub fn read_message(&mut self, msg: &[u8], payload: &mut [u8]) -> Result<usize, AppError> {
        self.transcript.extend_from_slice(msg);
        self.state.read_message(msg, payload).map_err(map_noise)
    }

    pub fn is_complete(&self) -> bool {
        self.state.is_handshake_finished()
    }

    pub fn into_transport(self) -> Result<NoiseTransport, AppError> {
        let state = self.state.into_transport_mode().map_err(map_noise)?;
        Ok(NoiseTransport { state })
    }

    pub fn transcript(&self) -> &[u8] {
        &self.transcript
    }
}

pub struct NoiseTransport {
    state: TransportState,
}

impl NoiseTransport {
    pub fn encrypt(&mut self, plaintext: &[u8], out: &mut [u8]) -> Result<usize, AppError> {
        self.state.write_message(plaintext, out).map_err(map_noise)
    }

    pub fn decrypt(&mut self, ciphertext: &[u8], out: &mut [u8]) -> Result<usize, AppError> {
        self.state.read_message(ciphertext, out).map_err(map_noise)
    }
}

pub fn generate_keypair() -> Result<Keypair, AppError> {
    Builder::new(NOISE_XX.parse().map_err(map_noise)?)
        .generate_keypair()
        .map_err(map_noise)
}

fn map_noise(e: snow::Error) -> AppError {
    AppError::Internal(format!("noise: {e}"))
}

/// Run a full XX handshake between initiator and responder (in-process).
pub fn complete_xx_handshake(
    initiator_kp: &Keypair,
    responder_kp: &Keypair,
) -> Result<(NoiseTransport, NoiseTransport, Vec<u8>), AppError> {
    let mut buf1 = [0u8; 65535];
    let mut buf2 = [0u8; 65535];
    let mut payload = [0u8; 65535];

    let mut ini = NoiseHandshake::new_xx_initiator(initiator_kp)?;
    let mut res = NoiseHandshake::new_xx_responder(responder_kp)?;

    // -> e
    let n1 = ini.write_message(&[], &mut buf1)?;
    let _ = res.read_message(&buf1[..n1], &mut payload)?;

    // <- e, ee, s, es
    let n2 = res.write_message(&[], &mut buf2)?;
    let _ = ini.read_message(&buf2[..n2], &mut payload)?;

    // -> s, se
    let n3 = ini.write_message(&[], &mut buf1)?;
    let _ = res.read_message(&buf1[..n3], &mut payload)?;

    if !ini.is_complete() || !res.is_complete() {
        return Err(AppError::Internal("Noise XX handshake incomplete".into()));
    }

    let transcript = ini.transcript().to_vec();
    let t1 = ini.into_transport()?;
    let t2 = res.into_transport()?;
    Ok((t1, t2, transcript))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::wire::{encode_frame, WireMessage};
    use crate::verbund::crypto::derive_sas_from_transcript;

    #[test]
    fn xx_handshake_and_encrypted_frame() {
        let kp1 = generate_keypair().expect("kp1");
        let kp2 = generate_keypair().expect("kp2");
        let (mut t1, mut t2, transcript) = complete_xx_handshake(&kp1, &kp2).expect("hs");

        let sas = derive_sas_from_transcript(&transcript);
        assert_eq!(sas.len(), 4);

        let frame = encode_frame(&WireMessage::Discover).expect("encode");
        let mut enc = [0u8; 4096];
        let enc_len = t1.encrypt(&frame, &mut enc).expect("enc");

        let mut dec = [0u8; 4096];
        let dec_len = t2.decrypt(&enc[..enc_len], &mut dec).expect("dec");
        assert_eq!(&frame, &dec[..dec_len]);
    }
}
