# medoc-recovery (Rust, Safe Bridge v2)

Offline recovery **CLI** + small **UI** (same egui stack as MeDoc USB Setup). Reuses [`medoc-core` `db_key`](../../crates/shared/medoc-core/src/infrastructure/database/db_key.rs).
**Does not write the OS keychain** (macOS ACL issues). Writes `db-key.wrap` for the main app to unlock.

Architecture: [`docs/architecture/safe-bridge-recovery.md`](../../docs/architecture/safe-bridge-recovery.md).

The former C++ implementation under this directory is **deprecated** (see `CMakeLists.txt` / `third_party/` leftover). Prefer:

```bash
cargo build -p medoc-recovery --release
# binaries: target/release/medoc-recovery  and  target/release/medoc-recovery-ui
```

CI/Release upload these as `medoc-ops-uis-*` artifacts (with `MedocUsbSetup`).

## UI app

```bash
cargo run -p medoc-recovery --bin medoc-recovery-ui
```

Pick Bridge A / B / C, optionally write wrap, and **create a new recovery result file** as **JSON**, **XML**, or **YAML** (Desktop default: `medoc-recovery-result.json`). Plaintext `key_hex` in that file is off by default (dangerous opt-in).

### Auto paths + vendor store

On launch (and **Rescan / reload**), the UI searches Desktop, Downloads, cwd, `.tmp/medoc-recovery-demo`, and `~/Library/Application Support/de.medoc.app`, then **copies** matches into the local store and fills the fields:

| Store path | Purpose |
|------------|---------|
| `~/Library/Application Support/MeDocRecovery/vendor/vendor-recovery.sk` | Vendor Bridge C private key |
| `…/vendor/vendor-recovery.pk` | Optional public key |
| `…/kit/activation.json` | Bridge A kit |
| `…/kit/practice-recovery.share.v2.json` | Practice share |
| `…/kit/vendor-recovery.share.v2.json` | Vendor share for this customer |

**Rotate vendor material:** replace the file under `vendor/` (or `kit/`) directly, then click **Rescan**. **Open store folder** reveals the directory. Paths typed outside the store are copied in on Recover.

## Commands

```bash
# Bridge A
cargo run -p medoc-recovery -- recover --bridge a --manifest activation.json \
  --passphrase-file pw.txt --write-wrap-dir /path/to/app-data

# Bridge B
cargo run -p medoc-recovery -- recover --bridge b --app-dir /path/to/app-data \
  --passphrase-file pw.txt

# Bridge C — forgotten passphrase (printed sheet + vendor share)
cargo run -p medoc-recovery -- recover --bridge c \
  --practice-share practice-recovery.share.v2.json \
  --vendor-share vendor-recovery.share.v2.json \
  --vendor-sk vendor-recovery.sk \
  --write-wrap-dir /path/to/app-data --wrap-passphrase-file new-pw.txt

# Create a new result file (json|xml|yaml)
cargo run -p medoc-recovery -- recover --bridge c \
  --practice-share practice-recovery.share.v2.json \
  --vendor-share vendor-recovery.share.v2.json \
  --vendor-sk vendor-recovery.sk \
  --export-out ~/Desktop/medoc-recovery-result.yaml \
  --export-format yaml

cargo run -p medoc-recovery -- verify-db --db medoc.db --key-hex …
cargo run -p medoc-recovery -- export-key --out sqlcipher.key --key-hex … \
  --i-understand-plaintext-export
cargo run -p medoc-recovery -- auth-check --ticket auth.json --vendor-pubkey-hex …
```

## Reset a login password

After any bridge recovers the key, set a new login password for one staff account (forgotten
password, or a dentist locked out). MeDoc must be closed. Same rules as in MeDoc: password policy,
Argon2 hash, LAN tokens invalidated, every device session ended, login lockout cleared. Recorded in
the practice audit log (`PASSWORD_RECOVERY`, actor `recovery-tool`, with the bridge) when this
computer holds the practice's audit key (the tool never creates one), and always in
`<app data>/logs/recovery.log`. The password is never logged.

In the UI, the **Reset a login password** section appears after a successful recover.

```bash
# Vendor key + printed sheet (Bridge C), then list accounts and reset one
cargo run -p medoc-recovery -- recover --bridge c \
  --practice-share practice-recovery.share.v2.json \
  --vendor-share vendor-recovery.share.v2.json \
  --vendor-sk vendor-recovery.sk \
  --practice-dir /path/to/app-data --list-accounts \
  --reset-login dentist@practice.example --new-login-password-file new-login.txt

# With the passphrase instead (Bridge B)
cargo run -p medoc-recovery -- recover --bridge b --app-dir /path/to/app-data \
  --passphrase-file pw.txt --reset-login dentist@practice.example
```

Tested end to end in `tests/password_recovery.rs` (Bridge C and B, MeDoc's own sign-in).

## Live demo (manual test)

End-to-end kit under `.tmp/medoc-recovery-demo` (gitignored). From repo root:

```bash
# Build
cargo build -p medoc-recovery
cmake -S installer/medoc-keygen -B installer/medoc-keygen/build
cmake --build installer/medoc-keygen/build

KIT=.tmp/medoc-recovery-demo
rm -rf "$KIT" && mkdir -p "$KIT/app-data"
printf '%s\n' 'correct horse battery staple' > "$KIT/pw.txt"
printf '%s\n' 'NewWrapPass1word' > "$KIT/new-wrap.txt"

# Mint activation + Bridge C sheet/shares
installer/medoc-keygen/build/medoc-keygen \
  --out "$KIT/activation.json" \
  --passphrase-file "$KIT/pw.txt"

REC=target/debug/medoc-recovery

# Bridge A (known passphrase)
$REC recover --bridge a \
  --manifest "$KIT/activation.json" \
  --passphrase-file "$KIT/pw.txt"

# Bridge C — forgotten passphrase (sheet + vendor share, no passphrase)
$REC recover --bridge c \
  --practice-share "$KIT/practice-recovery.share.v2.json" \
  --vendor-share "$KIT/vendor-recovery.share.v2.json" \
  --vendor-sk "$KIT/vendor-recovery.sk" \
  --write-wrap-dir "$KIT/app-data" \
  --wrap-passphrase-file "$KIT/new-wrap.txt"

# Bridge B unlocks the wrap written above
$REC recover --bridge b \
  --app-dir "$KIT/app-data" \
  --passphrase-file "$KIT/new-wrap.txt"
```

**Expected:** Bridges A and C print the same `kcv` / `key_hex`. Bridge C writes `app-data/db-key.wrap`, `db-key.salt`, `db-key.kcv`. Bridge B recovers the same key.

**Negative (KCV before SQLCipher):** corrupt the practice share and re-run Bridge C — expect `KCV mismatch` and exit 1.

Automated equivalent: [`scripts/smoke-bridges-v2.sh`](scripts/smoke-bridges-v2.sh).

Demo passphrases (local kit only): activation `correct horse battery staple`; wrap `NewWrapPass1word`.

## Safety

- Vendor license / vendor share / auth ticket **alone** cannot open `medoc.db`.
- Wrong Bridge C share fails **KCV** before SQLCipher.
- Auth ticket is audit-only.
- `export-key` requires an explicit flag; FAT USB ignores mode 0600.
