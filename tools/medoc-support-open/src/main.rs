//! Vendor tool for sealed MeDoc support files (`.mdsb`, docs/architecture/editions-plan.md §11.2).
//!
//! ```text
//! medoc-support-open keygen <secret-file>
//!     New support key pair. Writes the secret (hex) to <secret-file>, prints the public key to put
//!     into MEDOC_VENDOR_SUPPORT_PUBKEY for release builds, and its key id.
//! medoc-support-open pubkey <secret-file>
//!     Prints the public key and key id of an existing secret (to set or check MEDOC_VENDOR_SUPPORT_PUBKEY).
//! medoc-support-open open <file.mdsb> [--secret <secret-file>]... [--dev] [--out <file>]
//!     Decrypts with whichever secret matches the file's key id (old secrets keep old files readable).
//!     --dev also tries the published dev key (bundles from builds without the release key).
//! ```

use std::path::PathBuf;
use std::process::ExitCode;

use medoc_core::infrastructure::support_seal as seal;
use rand::RngCore;

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn read_secret(path: &PathBuf) -> Result<[u8; 32], String> {
    let raw = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let raw = raw.trim();
    if raw.len() != 64 {
        return Err(format!("{}: expected 64 hex characters", path.display()));
    }
    let mut out = [0u8; 32];
    for (i, b) in out.iter_mut().enumerate() {
        *b = u8::from_str_radix(&raw[i * 2..i * 2 + 2], 16)
            .map_err(|_| format!("{}: not hex", path.display()))?;
    }
    Ok(out)
}

fn keygen(out: PathBuf) -> Result<(), String> {
    if out.exists() {
        return Err(format!(
            "{} exists; refusing to overwrite a key",
            out.display()
        ));
    }
    let mut secret = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut secret);
    std::fs::write(&out, hex(&secret) + "\n").map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&out, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    let public = seal::public_key_of(&secret);
    println!("secret: {} (keep offline)", out.display());
    println!("MEDOC_VENDOR_SUPPORT_PUBKEY={}", hex(&public));
    println!("key id: {}", hex(&seal::key_id(&public)));
    Ok(())
}

fn open(args: &[String]) -> Result<(), String> {
    let mut file = None;
    let mut secrets = Vec::new();
    let mut out = None;
    let mut it = args.iter();
    while let Some(a) = it.next() {
        match a.as_str() {
            "--secret" => secrets.push(read_secret(&PathBuf::from(
                it.next().ok_or("--secret needs a file")?,
            ))?),
            "--dev" => secrets.push(seal::DEV_SUPPORT_SECRET),
            "--out" => out = Some(PathBuf::from(it.next().ok_or("--out needs a file")?)),
            other => file = Some(PathBuf::from(other)),
        }
    }
    let file = file.ok_or("no input file")?;
    let sealed = std::fs::read(&file).map_err(|e| format!("{}: {e}", file.display()))?;
    let id = seal::sealed_key_id(&sealed).ok_or("not a MeDoc support file")?;
    let secret = secrets
        .iter()
        .find(|s| seal::key_id(&seal::public_key_of(s)) == id)
        .ok_or_else(|| format!("no secret for key id {}", hex(&id)))?;
    let plain = seal::open(secret, &sealed).map_err(|e| e.to_string())?;
    let out = out.unwrap_or_else(|| file.with_extension("zip"));
    std::fs::write(&out, plain).map_err(|e| e.to_string())?;
    println!("{}", out.display());
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(String::as_str) {
        Some("keygen") if args.len() == 2 => keygen(PathBuf::from(&args[1])),
        Some("pubkey") if args.len() == 2 => read_secret(&PathBuf::from(&args[1])).map(|s| {
            let public = seal::public_key_of(&s);
            println!("MEDOC_VENDOR_SUPPORT_PUBKEY={}", hex(&public));
            println!("key id: {}", hex(&seal::key_id(&public)));
        }),
        Some("open") => open(&args[1..]),
        _ => Err("usage: medoc-support-open keygen <secret-file> | pubkey <secret-file> | open <file.mdsb> [--secret <file>]... [--dev] [--out <file>]".into()),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("{e}");
            ExitCode::FAILURE
        }
    }
}
