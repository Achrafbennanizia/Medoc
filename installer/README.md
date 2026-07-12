# MeDoc installers and offline keygen

Admin (cluster owner) devices are provisioned with the **medoc-keygen** tool, distributed
separately from the desktop app installers. Member devices use in-app pairing only.

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

Requires `MEDOC_VENDOR_PUBKEY` and platform Tauri build dependencies (see CI).

## Admin onboarding flow

1. **Step 1** — License code (`/onboarding/lizenz`) *or* join existing network (`/onboarding/beitreten`)
2. **Step 2 (new network / owner)** — Practice setup + admin account (`/onboarding/abonnement`)
3. **Step 2 (existing network / member)** — Create account or sign in (`/onboarding/konto`)
4. Sign in at `/login`

Run **medoc-keygen** for owner license codes (`license.code`). Member devices never need a vendor license.

## CI

`.github/workflows/release.yml` — keygen artifacts, interop smoke, per-OS Tauri bundles.

## In-app updates (Tauri + GitHub Releases)

`apps/practice-host/tauri.conf.json` → `plugins.updater` is configured by `scripts/configure-tauri-updater.mjs` before release builds.

### One-time setup

1. Generate a Tauri updater key pair:
   ```bash
   npm run tauri -w medoc signer generate -w ~/.medoc/tauri-updater.key
   ```
2. Add GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of the generated private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Passphrase used when generating the key |
| `TAURI_UPDATER_PUBKEY` | Public key string (safe to commit; also injected at build time) |
| `MEDOC_UPDATER_GITHUB_PAT` | Fine-grained PAT with **Contents: read** on this repo — baked into release builds so clients can fetch private release assets |

`GITHUB_TOKEN` is used only inside CI to **create** the release; it is never embedded in the app.

Optional per-practice override: store a read-only PAT in app KV key `updates.github_token` (requires `ops.system`).

### CI/CD

Tag a release (`git tag v0.1.1 && git push origin v0.1.1`). Workflow `.github/workflows/release.yml`:

1. Builds signed installers on Linux, macOS, and Windows
2. Merges updater manifests into `latest.json`
3. Publishes a GitHub Release with installers + `latest.json`

The desktop app checks `https://github.com/<owner>/<repo>/releases/latest/download/latest.json` (with bearer auth for private repos) and installs via **Settings → About → Install update**.

