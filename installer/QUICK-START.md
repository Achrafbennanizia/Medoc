# Installer Quick Start Guide

## Prerequisites

### macOS / Linux

```bash
cd /Users/achraf/pro/Medoc  # Make sure you're in the project root

# Install cmake (macOS)
brew install cmake libsodium

# Bootstrap Rust (one-time setup)
bash scripts/bootstrap-dev-rust.sh

# Source Rust environment (before each build session)
source scripts/rust-env.sh
```

### Windows

```powershell
# Install vcpkg (if not already installed)
git clone https://github.com/Microsoft/vcpkg.git
cd vcpkg
.\bootstrap-vcpkg.bat
$env:VCPKG_ROOT = "C:\path\to\vcpkg"

# Install libsodium
vcpkg install libsodium:x64-windows
```

---

## Build Commands

**Always run from the Medoc project root directory:**

```bash
cd /Users/achraf/pro/Medoc
```

### 1. Keygen (Admin device provisioning)

Generates cluster keys, CA certificates, and database encryption keys.

```bash
# macOS / Linux
bash installer/build-keygen.sh

# Windows
$env:VCPKG_ROOT = "C:\path\to\vcpkg"
.\installer\build-keygen.ps1

# Output: installer/dist/medoc-keygen-<os>-<arch>
```

**Usage:**
```bash
./installer/dist/medoc-keygen-darwin-arm64 --out activation.json
# Prompts for passphrase (hidden input, twice)
```

---

### 2. USB Multi-Installer Kit

Packages deployment tools for field operators.

```bash
# macOS / Linux
source scripts/rust-env.sh
bash installer/build-usb-kit.sh

# Windows
.\installer\build-usb-kit.ps1

# Output: installer/dist/usb-kit/
#   - MedocUsbSetup (main wizard)
#   - medoc-usb/payloads/ (app binaries, server)
```

**Usage:**
```bash
cd installer/dist/usb-kit
./MedocUsbSetup wizard
```

---

### 3. Desktop App Installers (Tauri)

Builds platform-specific installers (.dmg, .msi, .deb, etc.).

```bash
# Requires Node.js, npm, Tauri
bash installer/build-app-installers.sh

# Output: apps/practice-host/target/release/bundle/
#   macOS: *.dmg, *.app
#   Windows: *.msi, *.exe
#   Linux: *.AppImage, *.deb, *.rpm
```

---

## Environment Variables

### MEDOC_VENDOR_PUBKEY

**Default:** `79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`

Override for custom license key:
```bash
export MEDOC_VENDOR_PUBKEY="<your-64-char-hex-key>"
bash installer/build-usb-kit.sh
```

### CARGO_TARGET_DIR

**Default:** `./target`

Customize build output directory:
```bash
export CARGO_TARGET_DIR="/var/build/medoc"
bash installer/build-usb-kit.sh
```

### REBUILD

Force rebuild (skip binary cache):
```bash
REBUILD=1 bash installer/build-usb-kit.sh
```

---

## Troubleshooting

**If commands don't work, make sure you're in the Medoc project root:**
```bash
cd /Users/achraf/pro/Medoc
```

### CMake not found
```bash
# macOS
brew install cmake

# Linux
sudo apt-get install cmake build-essential

# Windows
# Download from https://cmake.org/download/
```

### libsodium not found
```bash
# macOS
brew install libsodium

# Linux
sudo apt-get install libsodium-dev

# Windows (use vcpkg)
vcpkg install libsodium:x64-windows
```

### Cargo not found
```bash
bash scripts/bootstrap-dev-rust.sh
source scripts/rust-env.sh
```

### MEDOC_VENDOR_PUBKEY error
```bash
# Ensure it's exported before cargo build
export MEDOC_VENDOR_PUBKEY="79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32"
source scripts/rust-env.sh
bash installer/build-usb-kit.sh
```

---

## Output Locations

| Build | Path |
|-------|------|
| Keygen | `installer/dist/medoc-keygen-<os>-<arch>` |
| Keygen Verify | `installer/dist/medoc-keygen-verify-<os>-<arch>` |
| USB Kit | `installer/dist/usb-kit/` |
| App (macOS) | `apps/practice-host/target/release/bundle/macos/` |
| App (Windows) | `apps/practice-host/target/release/bundle/x64/` |
| App (Linux) | `apps/practice-host/target/release/bundle/` |

---

## Distribution

### USB Kit Deployment

1. Copy contents of `installer/dist/usb-kit/` to USB stick root
2. Distribute USB to field operators
3. Operators run `./MedocUsbSetup wizard` to install devices

### Keygen Distribution (Admin Only)

1. Build on **secure admin device only**
2. Run `medoc-keygen` to generate `activation.json`
3. Import in app: `/onboarding/license` → load `activation.json`
4. **DO NOT** distribute keygen or activation files; keep on secure device

### App Installer Distribution

1. Build on CI/CD (see `.github/workflows/release.yml`)
2. Sign binaries with corporate certificate
3. Publish to GitHub Releases / app store
4. Users download and run platform-specific installer

---

## CI/CD Integration

See `.github/workflows/release.yml` for automated:
- Keygen builds (all platforms)
- USB kit assembly
- Signed app installers
- Release artifact publishing

