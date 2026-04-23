#!/usr/bin/env bash
# Generates SBOMs (Software Bill of Materials) in CycloneDX JSON format
# for the Rust backend and Node frontend. Required by NFA-COMPLIANCE / EU CRA
# and useful evidence for hospital procurement security reviews.
#
# Output: releases/<version>/sbom-rust.json + sbom-node.json
#
# Prerequisites:
#   cargo install cargo-cyclonedx
#   npm  install -g @cyclonedx/cyclonedx-npm

set -euo pipefail

VERSION="${1:-$(git -C "$(dirname "$0")/.." describe --tags --always 2>/dev/null || echo dev)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/releases/$VERSION"
mkdir -p "$OUT"

echo "▶ Generating Rust SBOM …"
( cd "$ROOT/app/src-tauri" \
    && cargo cyclonedx --format json --override-filename "$OUT/sbom-rust" )

echo "▶ Generating Node SBOM …"
( cd "$ROOT/app" \
    && cyclonedx-npm --output-file "$OUT/sbom-node.json" --output-format JSON )

echo "✔ SBOMs written to $OUT"
ls -lh "$OUT"
