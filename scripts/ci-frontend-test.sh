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

# Full <App /> smoke files OOM during Vite collect (~6GB+) on 7GB GHA runners.
# describe.skipIf is insufficient — the App import still gets transformed.
is_app_mount_smoke() {
  case "$(basename "$1")" in
    critical-flows-auth.smoke.test.tsx|critical-flows-auth.smoke.test.ts|g21-routing.smoke.test.tsx|g21-routing.smoke.test.ts)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

run_smoke_file() {
  local f="$1"
  export NODE_OPTIONS="--max-old-space-size=4096"
  if is_app_mount_smoke "$f"; then
    echo "── smoke skip (App mount OOM on CI runners): $(basename "$f")"
    return 0
  fi
  echo "── smoke: $f"
  npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch \
    --testTimeout=120000 "$f"
}

run_smoke_files() {
  echo "::group::vitest project=smoke (per-file; App mounts skipped on CI)"
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
    echo "── smoke file ${i}/${#files[@]}"
    run_smoke_file "$f"
  done
  echo "::endgroup::"
}

run_project node 4096
run_smoke_files
run_project mvp-unit 4096
