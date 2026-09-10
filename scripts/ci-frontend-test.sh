#!/usr/bin/env bash
# Sequential Vitest: one project/file per process so GHA RSS stays bounded.
set -euo pipefail
cd "$(dirname "$0")/../apps/practice-host-ui"

run_project() {
  local project="$1"
  local heap="${2:-4096}"
  export NODE_OPTIONS="--max-old-space-size=${heap}"
  echo "::group::vitest project=${project} (heap=${heap}m)"
  npx vitest run --project "$project" --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch
  echo "::endgroup::"
}

# Smoke/jsdom is the memory hog — run each file in its own Node process.
run_smoke_files() {
  export NODE_OPTIONS="--max-old-space-size=3072"
  echo "::group::vitest project=smoke (per-file)"
  mapfile -t files < <(
    find src ../../packages -type f \( -name '*.smoke.test.ts' -o -name '*.smoke.test.tsx' \) | sort
  )

  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No smoke test files found" >&2
    exit 1
  fi

  local i=0
  for f in "${files[@]}"; do
    i=$((i + 1))
    echo "── smoke ${i}/${#files[@]}: $f"
    npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch "$f"
  done
  echo "::endgroup::"
}

run_project node 4096
run_smoke_files
run_project mvp-unit 4096
