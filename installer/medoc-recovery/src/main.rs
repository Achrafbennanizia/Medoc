//! Offline Safe Bridge recovery CLI (v2).

use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use medoc_recovery::{
    auth_check, export, export_key_file, password, recover, write_wrap, Bridge, RecoverRequest,
    RecoveryResult,
};

#[derive(Parser)]
#[command(
    name = "medoc-recovery",
    about = "Safe Bridge recovery (offline, no vendor backdoor)"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,
}

#[allow(clippy::large_enum_variant)]
#[derive(Subcommand)]
enum Commands {
    /// Reconstruct the SQLCipher key via Bridge A, B, or C.
    Recover {
        #[arg(long)]
        bridge: String,
        #[arg(long)]
        manifest: Option<PathBuf>,
        #[arg(long)]
        app_dir: Option<PathBuf>,
        #[arg(long)]
        practice_share: Option<PathBuf>,
        #[arg(long)]
        vendor_share: Option<PathBuf>,
        #[arg(long)]
        vendor_sk: Option<PathBuf>,
        #[arg(long)]
        passphrase_file: Option<PathBuf>,
        /// After recover, write db-key.wrap for the main app (no keychain).
        #[arg(long)]
        write_wrap_dir: Option<PathBuf>,
        #[arg(long)]
        wrap_passphrase_file: Option<PathBuf>,
        /// Optional: verify a medoc.db copy opens with the recovered key.
        #[arg(long)]
        verify_db: Option<PathBuf>,
        /// Create a new recovery result file (json|xml|yaml).
        #[arg(long)]
        export_out: Option<PathBuf>,
        #[arg(long, default_value = "json")]
        export_format: String,
        /// Include key_hex in the export file (dangerous).
        #[arg(long)]
        export_include_key: bool,
        /// Folder holding the practice's medoc.db (default: --app-dir, then --write-wrap-dir).
        #[arg(long)]
        practice_dir: Option<PathBuf>,
        /// List the staff accounts of the practice (after recovering the key).
        #[arg(long)]
        list_accounts: bool,
        /// Set a new login password for this account (email or staff id). MeDoc must be closed.
        #[arg(long)]
        reset_login: Option<String>,
        /// New login password (first line of the file; prompted when omitted).
        #[arg(long)]
        new_login_password_file: Option<PathBuf>,
    },
    /// Write wrap/salt/kcv for an already-known key (hex).
    WriteWrap {
        #[arg(long)]
        app_dir: PathBuf,
        #[arg(long)]
        key_hex: String,
        #[arg(long)]
        passphrase_file: PathBuf,
    },
    /// Open a *copy* of medoc.db with the key (same PRAGMA as the app).
    VerifyDb {
        #[arg(long)]
        db: PathBuf,
        #[arg(long)]
        key_hex: String,
    },
    /// Export plaintext key (dangerous). Requires explicit flag.
    ExportKey {
        #[arg(long)]
        out: PathBuf,
        #[arg(long)]
        key_hex: String,
        #[arg(long)]
        i_understand_plaintext_export: bool,
    },
    /// Verify an auth ticket signature (audit only — not a crypto gate).
    AuthCheck {
        #[arg(long)]
        ticket: PathBuf,
        #[arg(long)]
        vendor_pubkey_hex: String,
        #[arg(long)]
        fingerprint: Option<String>,
    },
}

fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();
    match cli.cmd {
        Commands::Recover {
            bridge,
            manifest,
            app_dir,
            practice_share,
            vendor_share,
            vendor_sk,
            passphrase_file,
            write_wrap_dir,
            wrap_passphrase_file,
            verify_db,
            export_out,
            export_format,
            export_include_key,
            practice_dir,
            list_accounts,
            reset_login,
            new_login_password_file,
        } => {
            let practice_dir = practice_dir
                .or_else(|| app_dir.clone())
                .or_else(|| write_wrap_dir.clone());
            let bridge = Bridge::parse(&bridge)?;
            let passphrase = match bridge {
                Bridge::A | Bridge::B => Some(read_pass(passphrase_file.as_deref())?),
                Bridge::C => passphrase_file
                    .as_ref()
                    .map(|p| read_pass(Some(p)))
                    .transpose()?,
            };
            let wrap_passphrase = wrap_passphrase_file
                .as_ref()
                .map(|p| read_pass(Some(p)))
                .transpose()?;
            let req = RecoverRequest {
                bridge: Some(bridge),
                manifest,
                app_dir,
                practice_share,
                vendor_share,
                vendor_sk,
                passphrase,
                write_wrap_dir: write_wrap_dir.clone(),
                wrap_passphrase,
                verify_db,
            };
            let (key, mut result) = recover(&req)?;
            eprintln!(
                "recover OK (bridge {}), kcv={}",
                result.bridge, result.kcv_b64
            );
            if let Some(ref dir) = result.wrap_written {
                eprintln!("wrote db-key.wrap (+ salt/kcv) under {dir}");
                eprintln!(
                    "Start MeDoc and unlock with that passphrase (no keychain write from this tool)."
                );
            }
            if let Some(ref v) = result.verify_db {
                eprintln!("verify-db: {v}");
            }
            if let Some(out) = export_out {
                if export_include_key {
                    result.key_hex = Some(hex::encode(&*key));
                    eprintln!("WARNING: export includes plaintext key_hex");
                }
                let fmt = export::ExportFormat::parse(&export_format)?;
                export::write_recovery_file(&out, &result, fmt)?;
                eprintln!("wrote recovery result {} ({})", out.display(), fmt.as_str());
            } else if write_wrap_dir.is_none() && !list_accounts && reset_login.is_none() {
                println!("key_hex={}", hex::encode(&*key));
            }
            if list_accounts || reset_login.is_some() {
                let dir = practice_dir
                    .as_deref()
                    .context("--practice-dir (or --app-dir) required to reach medoc.db")?;
                let db = password::practice_db(dir);
                let rt = tokio::runtime::Runtime::new()?;
                if list_accounts {
                    for a in rt.block_on(password::list_accounts(&db, &key))? {
                        println!("{}\t{}\t{}\t{}", a.email, a.role, a.name, a.id);
                    }
                }
                if let Some(account) = reset_login {
                    let new_pw = match new_login_password_file.as_deref() {
                        Some(p) => read_pass(Some(p))?,
                        None => {
                            let a = rpassword::prompt_password("New login password: ")?;
                            let b = rpassword::prompt_password("Repeat new login password: ")?;
                            if a != b {
                                bail!("the two passwords differ");
                            }
                            a
                        }
                    };
                    let r = rt.block_on(password::reset_password(
                        &db,
                        &key,
                        &account,
                        &new_pw,
                        &result.bridge,
                    ))?;
                    eprintln!(
                        "login password reset for {} ({}); {} session(s) ended, {} lockout(s) cleared, audit log: {}",
                        r.account.email,
                        r.account.role,
                        r.sessions_ended,
                        r.lockouts_cleared,
                        if r.audit_logged { "written" } else { "not written (no audit key on this computer)" }
                    );
                }
            }
            Ok(())
        }
        Commands::WriteWrap {
            app_dir,
            key_hex,
            passphrase_file,
        } => {
            let key = hex::decode(key_hex.trim()).context("key_hex")?;
            let pw = std::fs::read_to_string(&passphrase_file)?;
            write_wrap(&app_dir, &key, pw.trim())?;
            eprintln!("wrote wrap under {}", app_dir.display());
            Ok(())
        }
        Commands::VerifyDb { db, key_hex } => {
            let key = hex::decode(key_hex.trim()).context("key_hex")?;
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(medoc_recovery::verify_db_copy(&db, &key))?;
            eprintln!("verify-db: OK (opened temp copy with app PRAGMA key format)");
            Ok(())
        }
        Commands::ExportKey {
            out,
            key_hex,
            i_understand_plaintext_export,
        } => {
            if !i_understand_plaintext_export {
                bail!("refusing export without --i-understand-plaintext-export (FAT USB ignores mode 0600)");
            }
            eprintln!("WARNING: plaintext key export; FAT/exFAT USB sticks do not honor 0600.");
            let key = hex::decode(key_hex.trim())?;
            export_key_file(&out, &key)?;
            eprintln!("wrote {}", out.display());
            Ok(())
        }
        Commands::AuthCheck {
            ticket,
            vendor_pubkey_hex,
            fingerprint,
        } => {
            auth_check(&ticket, &vendor_pubkey_hex, fingerprint.as_deref())?;
            eprintln!("auth ticket OK (audit/process control only — not a crypto unlock gate)");
            Ok(())
        }
    }
}

fn read_pass(file: Option<&Path>) -> Result<String> {
    if let Some(p) = file {
        let s = std::fs::read_to_string(p)?;
        Ok(s.lines().next().unwrap_or("").to_string())
    } else {
        Ok(rpassword::prompt_password("Practice passphrase: ")?)
    }
}

#[allow(dead_code)]
fn _keep_result_type(_: RecoveryResult) {}
