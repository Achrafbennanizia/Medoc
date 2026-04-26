// Integration tests for security-critical primitives.
// Run with: cargo test --manifest-path src-tauri/Cargo.toml

use medoc_lib::infrastructure::crypto::{audit_hmac, hash_password, needs_rehash, verify_password};

#[test]
fn argon2_round_trip() {
    let h = hash_password("hunter2!").unwrap();
    assert!(h.starts_with("$argon2"));
    assert!(verify_password("hunter2!", &h).unwrap());
    assert!(!verify_password("wrong", &h).unwrap());
    assert!(!needs_rehash(&h));
}

#[test]
fn bcrypt_legacy_accepted_and_marked_for_rehash() {
    // bcrypt cost 4 for fast test execution
    let legacy = bcrypt::hash("legacy-pw", 4).unwrap();
    assert!(verify_password("legacy-pw", &legacy).unwrap());
    assert!(!verify_password("nope", &legacy).unwrap());
    assert!(needs_rehash(&legacy));
}

#[test]
fn hmac_is_deterministic_and_keyed() {
    let key = b"shared-secret";
    let a = audit_hmac(key, "row-1").unwrap();
    let b = audit_hmac(key, "row-1").unwrap();
    let c = audit_hmac(b"different", "row-1").unwrap();
    assert_eq!(a, b);
    assert_ne!(a, c);
    assert_eq!(a.len(), 64); // hex-encoded SHA-256
}
