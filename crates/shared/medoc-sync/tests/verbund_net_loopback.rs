//! Loopback integration: TCP listener bind + Noise XX handshake.

use std::net::IpAddr;

use medoc_sync::net::{bind_verbund_listener, complete_xx_handshake, generate_keypair};

#[tokio::test]
async fn verbund_listener_binds_private_loopback() {
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_verbund_listener(addr, 0).await.expect("bind");
    assert!(listener.local_addr().unwrap().port() > 0);
}

#[test]
fn noise_xx_produces_shared_transcript() {
    let kp1 = generate_keypair().expect("kp1");
    let kp2 = generate_keypair().expect("kp2");
    let (_t1, _t2, transcript) = complete_xx_handshake(&kp1, &kp2).expect("hs");
    assert!(!transcript.is_empty());
}
