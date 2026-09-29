# MeDoc installers and offline keygen

**This tree is not the main product CD.** GitHub Actions **Release** on this repo
ships the **desktop app** only (`medoc` / `MeDoc.app`). NSIS/MSI/DMG, USB kits,
and **medoc-keygen** belong in a **separate installer/ops system**. Scripts here
remain for that product and for local ops builds.

Admin (cluster owner) devices are provisioned with the **medoc-keygen** tool, distributed
separately from the desktop app. Member devices use in-app pairing only.

## USB multi-installer kit

Portable field installer with encrypted campaign vault, audit log, and `install_plan` sidecar:

```bash
cargo build -p medoc-usb-setup --release
bash installer/build-usb-kit.sh   # or build-usb-kit.ps1 on Windows
```

Operator flow: copy `installer/dist/usb-kit/` to USB → run `MedocUsbSetup wizard`.

See [docs/architecture/usb-multi-installer.md](../docs/architecture/usb-multi-installer.md).

## medoc-keygen (C++)

```bash
bash installer/build-keygen.sh
# binaries: installer/dist/medoc-keygen-<os>-<arch>
```

See [medoc-keygen/README.md](medoc-keygen/README.md).

## App installers (Tauri)

```bash
bash installer/build-app-installers.sh
```

Requires `MEDOC_VENDOR_PUBKEY` and platform Tauri build dependencies (see root README).

## Admin onboarding flow

1. **Step 1** — License code (`/onboarding/license`) *or* join existing network (`/onboarding/beitreten`)
2. **Step 2 (new network / owner)** — Practice setup + admin account (`/onboarding/abonnement`)
3. **Step 2 (existing network / member)** — Create account or sign in (`/onboarding/konto`)
4. Sign in at `/login`

Run **medoc-keygen** for owner license codes (`license.code`). Member devices never need a vendor license.

## CI (this repo)

`.github/workflows/ci.yml` — tests. `.github/workflows/release.yml` — **app binaries**
(`medoc-app-*` artifacts), not installers or keygen.

## In-app updates (Tauri + GitHub Releases)

Updater signing, `latest.json`, and OS installer packages are owned by the
**installer/ops** pipeline, not this repo’s Release workflow.

`apps/practice-host/tauri.conf.json` → `plugins.updater` is configured by
`scripts/configure-tauri-updater.mjs` in the **installer/ops** build, not in this
repo’s app Release job.

### One-time setup (installer/ops GitHub repo)

1. Generate a Tauri updater key pair:
   ```bash
   npm run tauri -w medoc signer generate -w ~/.medoc/tauri-updater.key
   ```
2. Add GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Minisign private key — **CI only**, used to sign updater artifacts. Never written into `tauri.conf.json` or the app binary. |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase for that key — **CI only**. |
| `TAURI_UPDATER_PUBKEY` | Matching public key — shipped in the app so clients can verify updates. |

Do **not** put a GitHub PAT in CI env for the desktop build. A compile-time `MEDOC_UPDATER_GITHUB_TOKEN` would be embedded in the binary and recoverable from the installer.

`GITHUB_TOKEN` is used only inside CI to **create** the GitHub Release (`contents: write` on that job). Checkouts use `persist-credentials: false`.

Private-repo clients: store a **fine-grained PAT** (this repo, **Contents: read** only) in app KV `updates.github_token` (`ops.system`). That token stays on the practice device, not in the shipped installer.

Public GitHub Releases need no PAT.

The desktop app checks `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` and installs via **Settings → About → Install update**. Payloads are accepted only if they verify against `TAURI_UPDATER_PUBKEY`.

### CI/CD (installer product)

Build OS packages and keygen in the **separate installer system**, or locally:

```bash
bash installer/build-keygen.sh
bash installer/build-app-installers.sh
```

