//! Loopback integration: TCP listener bind + Noise XX handshake + JOIN_REQUEST.

use std::net::IpAddr;

use medoc_core::infrastructure::database::audit_repo::init_audit_hmac_key;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_sync::net::{
    bind_verbund_listener, complete_xx_handshake, generate_keypair, handle_join_connection,
    join_admin_endpoint, run_xx_initiator, run_xx_responder,
};
use medoc_sync::schema::ensure_sync_tables;
use medoc_sync::verbund::crypto::DeviceIdentity;
use medoc_sync::verbund::services::list_pending_requests;
use medoc_sync::verbund::SeatRolle;
use tokio::net::TcpStream;

async fn fresh_pool() -> sqlx::SqlitePool {
    let audit_dir = std::env::temp_dir().join(format!(
        "medoc-verbund-test-{}",
        uuid::Uuid::new_v4()
    ));
    std::fs::create_dir_all(&audit_dir).expect("audit dir");
    init_audit_hmac_key(&audit_dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("schema");
    pool
}

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

#[tokio::test]
async fn xx_handshake_over_tcp_matches_transcript() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.expect("bind");
    let addr = listener.local_addr().expect("addr");
    let server = tokio::spawn(async move {
        let (mut stream, _) = listener.accept().await.expect("accept");
        run_xx_responder(&mut stream).await.expect("responder")
    });
    let mut client = TcpStream::connect(addr).await.expect("connect");
    let (_t1, tr1) = run_xx_initiator(&mut client).await.expect("initiator");
    let (_t2, tr2) = server.await.expect("server");
    assert_eq!(tr1, tr2);
}

#[tokio::test]
async fn join_request_accept_over_loopback() {
    std::env::set_var(
        "MEDOC_VERBUND_DEVICE_SECRET",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );

    let pool = fresh_pool().await;
    let addr: IpAddr = "127.0.0.1".parse().unwrap();
    let listener = bind_verbund_listener(addr, 0).await.expect("bind");
    let port = listener.local_addr().unwrap().port();
    let pool_clone = pool.clone();

    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.expect("accept");
        handle_join_connection(stream, pool_clone).await;
    });

    let identity = DeviceIdentity::load_or_create().expect("identity");
    let outcome = join_admin_endpoint("127.0.0.1", port, &identity, SeatRolle::Member)
        .await
        .expect("join");
    server.await.expect("server done");

    assert!(!outcome.session_id.is_empty());
    assert!(!outcome.handshake_transcript.is_empty());

    let pending = list_pending_requests(&pool).await.expect("pending");
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0].fingerprint, identity.fingerprint);

    std::env::remove_var("MEDOC_VERBUND_DEVICE_SECRET");
}
