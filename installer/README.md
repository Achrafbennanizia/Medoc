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

1. Ops runs `medoc-keygen` on an offline workstation → `activation.json`
2. Admin installs MeDoc from platform installer
3. Onboarding → **Aktivierungsmanifest importieren** (`/onboarding/aktivierung`)
4. **Lizenz aktivieren** (`/onboarding/lizenz`)

The app removes the **networked admin copy** of `activation.json` after a successful import.
Ops must **retain the offline original** (e.g. on USB) as the disaster-recovery path — the cluster
CA private key is not recoverable from the app alone if the admin device is lost.

Member devices: **Verbund beitreten** only (no keygen).

## CI

`.github/workflows/release.yml` — keygen artifacts, interop smoke, per-OS Tauri bundles.

## In-app updates (Tauri)

`apps/practice-host/tauri.conf.json` → `plugins.updater`:

- Set `endpoints` to your private GitHub release `latest.json` URL.
- Set `pubkey` to the Tauri updater public key (generate with `tauri signer generate`).
- CI release job uploads signed bundles; `GITHUB_TOKEN` with `contents: read` for private repos.

Users: Einstellungen → System → update check (when wired in UI) or OS installer for major jumps.

