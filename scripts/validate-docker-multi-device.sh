#!/usr/bin/env bash
# Run multi-device port-based backend e2e inside Docker (Linux).
#
# Starts real medoc-server (HTTPS) + medoc-company-server (HTTP), then drives
# pairing/sync/auth flows over TCP ports — simulating master + replica devices.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOCKER_RUST_RUN=(--rm --shm-size=4g -e CARGO_BUILD_JOBS=1)

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running."
  exit 1
fi

echo "Building multi-device port e2e image..."
docker build -f docker/ci/Dockerfile.multi-device-e2e -t medoc-multi-device-e2e:latest .

echo ""
echo "========== MULTI-DEVICE PORT E2E (Docker / Linux) =========="
docker run "${DOCKER_RUST_RUN[@]}" \
  -v "$ROOT:/work" \
  -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git \
  -v medoc-target-linux-e2e:/work/target \
  medoc-multi-device-e2e:latest

echo ""
echo "Multi-device port e2e passed."
