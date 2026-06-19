#!/usr/bin/env bash
# Build medoc-keygen (+ verify tool) for the host platform.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/installer/medoc-keygen"
BUILD="$SRC/build"

if ! command -v cmake >/dev/null 2>&1; then
  echo "cmake required" >&2
  exit 1
fi

if [[ "$(uname -s)" == "Linux" ]] && ! pkg-config --exists libsodium 2>/dev/null; then
  echo "Installing libsodium (apt)…" >&2
  sudo apt-get update -qq
  sudo apt-get install -y libsodium-dev cmake build-essential
elif [[ "$(uname -s)" == "Darwin" ]] && ! brew --prefix libsodium >/dev/null 2>&1; then
  echo "Installing libsodium (brew)…" >&2
  brew install libsodium
fi

cmake -S "$SRC" -B "$BUILD"
cmake --build "$BUILD" --parallel

OUT="$ROOT/installer/dist"
mkdir -p "$OUT"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
cp "$BUILD/medoc-keygen" "$OUT/medoc-keygen-${OS}-${ARCH}"
cp "$BUILD/medoc-keygen-verify" "$OUT/medoc-keygen-verify-${OS}-${ARCH}"
chmod +x "$OUT/medoc-keygen-${OS}-${ARCH}" "$OUT/medoc-keygen-verify-${OS}-${ARCH}"

echo "Built:"
echo "  $OUT/medoc-keygen-${OS}-${ARCH}"
echo "  $OUT/medoc-keygen-verify-${OS}-${ARCH}"
