//! The vendor tool opens what the app sealed, and only with the matching secret.

use medoc_core::infrastructure::support_seal as seal;
use std::process::Command;

fn tool() -> Command {
    Command::new(env!("CARGO_BIN_EXE_medoc-support-open"))
}

#[test]
fn opens_a_file_sealed_to_its_key_and_refuses_others() {
    let dir = std::env::temp_dir().join(format!("medoc-support-open-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let key = dir.join("vendor.key");
    let status = tool().arg("keygen").arg(&key).output().unwrap();
    assert!(
        status.status.success(),
        "{}",
        String::from_utf8_lossy(&status.stderr)
    );
    let secret_hex = std::fs::read_to_string(&key).unwrap();
    let mut secret = [0u8; 32];
    for (i, b) in secret.iter_mut().enumerate() {
        *b = u8::from_str_radix(&secret_hex.trim()[i * 2..i * 2 + 2], 16).unwrap();
    }

    let sealed = dir.join("bundle.mdsb");
    std::fs::write(
        &sealed,
        seal::seal_to(&seal::public_key_of(&secret), b"zip bytes").unwrap(),
    )
    .unwrap();
    let out = dir.join("bundle.zip");
    let ok = tool()
        .args(["open"])
        .arg(&sealed)
        .arg("--secret")
        .arg(&key)
        .arg("--out")
        .arg(&out)
        .output()
        .unwrap();
    assert!(
        ok.status.success(),
        "{}",
        String::from_utf8_lossy(&ok.stderr)
    );
    assert_eq!(std::fs::read(&out).unwrap(), b"zip bytes");

    let refused = tool()
        .args(["open"])
        .arg(&sealed)
        .arg("--dev")
        .output()
        .unwrap();
    assert!(
        !refused.status.success(),
        "the dev key must not open a file sealed to the vendor key"
    );
    assert!(
        tool()
            .arg("keygen")
            .arg(&key)
            .output()
            .unwrap()
            .status
            .code()
            != Some(0),
        "never overwrite a key"
    );
    let _ = std::fs::remove_dir_all(&dir);
}
