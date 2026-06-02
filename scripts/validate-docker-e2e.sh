#!/usr/bin/env bash
# Run Wave V1 end-to-end validation in Docker (all three server systems + license/sync).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker Desktop and retry."
  exit 1
fi

echo "Building e2e validation image..."
docker build -f docker/ci/Dockerfile.e2e -t medoc-e2e:latest .

echo ""
echo "========== E2E Wave V1 (Docker / Linux) =========="
docker run --rm \
  -v "$ROOT:/work" \
  -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git \
  -v medoc-target-linux-e2e:/work/app/target \
  medoc-e2e:latest

echo ""
echo "E2E Docker validation passed."
