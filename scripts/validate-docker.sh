#!/usr/bin/env bash
# Run CI-equivalent checks inside Docker (Linux), independent of host OS/toolchain.
#
# Default: frontend + Wave V1 scoped Rust (medoc-core, medoc-sync, medoc-lan, …).
# Full workspace + Tauri link requires `VALIDATE_DOCKER_FULL=1` and ~8+ GiB free disk.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# medoc-e2e link steps OOM on default Docker Desktop limits without these.
DOCKER_RUST_RUN=(--rm --shm-size=4g -e CARGO_BUILD_JOBS=1)

if ! docker info >/dev/null 2>&1; then
  echo "ERROR: Docker daemon is not running. Start Docker Desktop and retry."
  exit 1
fi

echo "Building frontend validation image..."
docker build -f docker/ci/Dockerfile.frontend -t medoc-fe-ci:latest .

echo "Building Wave V1 Rust validation image..."
docker build -f docker/ci/Dockerfile.rust-wave-v1 -t medoc-rust-wave-v1:latest .

echo ""
echo "========== FRONTEND (Docker / Node 20) =========="
docker run --rm \
  -v "$ROOT:/work" \
  -v medoc-node-modules:/work/app/node_modules \
  medoc-fe-ci:latest

echo ""
echo "========== RUST Wave V1 scoped (Docker / Linux) =========="
docker run "${DOCKER_RUST_RUN[@]}" \
  -v "$ROOT:/work" \
  -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git \
  -v medoc-target-linux-e2e:/work/app/target \
  medoc-rust-wave-v1:latest

echo ""
echo "========== E2E Wave V1 (Docker / Linux — all systems) =========="
docker build -f docker/ci/Dockerfile.e2e -t medoc-e2e:latest .
docker run "${DOCKER_RUST_RUN[@]}" \
  -v "$ROOT:/work" \
  -v medoc-cargo-registry:/usr/local/cargo/registry \
  -v medoc-cargo-git:/usr/local/cargo/git \
  -v medoc-target-linux-e2e:/work/app/target \
  medoc-e2e:latest

if [[ "${VALIDATE_DOCKER_MULTI_DEVICE:-}" == "1" ]]; then
  echo ""
  echo "========== MULTI-DEVICE PORT E2E (Docker / Linux) =========="
  docker build -f docker/ci/Dockerfile.multi-device-e2e -t medoc-multi-device-e2e:latest .
  docker run "${DOCKER_RUST_RUN[@]}" \
    -v "$ROOT:/work" \
    -v medoc-cargo-registry:/usr/local/cargo/registry \
    -v medoc-cargo-git:/usr/local/cargo/git \
    -v medoc-target-linux-e2e:/work/app/target \
    medoc-multi-device-e2e:latest
fi

if [[ "${VALIDATE_DOCKER_FULL:-}" == "1" ]]; then
  echo "Building full Rust validation image (includes Tauri)..."
  docker build -f docker/ci/Dockerfile.rust -t medoc-rust-ci:latest .
  echo ""
  echo "========== RUST full workspace (Docker / Linux + Tauri) =========="
  docker run "${DOCKER_RUST_RUN[@]}" \
    -v "$ROOT:/work" \
    -v medoc-cargo-registry:/usr/local/cargo/registry \
    -v medoc-cargo-git:/usr/local/cargo/git \
    -v medoc-target-linux:/work/app/target \
    medoc-rust-ci:latest
fi

echo ""
echo "All Docker validation checks passed."
