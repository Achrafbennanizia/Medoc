#!/usr/bin/env bash
# Sequential Vitest: one project/file (or test) per process so GHA RSS stays bounded.
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

# Full <App /> mounts are Windows heap killers — one test case per Node process.
# Heap 6144 leaves headroom on 7GB GHA runners (8192 fights the OS).
heavy_test_names() {
  case "$(basename "$1")" in
    critical-flows-auth.smoke.test.tsx|critical-flows-auth.smoke.test.ts)
      printf '%s\n' \
        "signs in, shows dashboard greeting, signs out" \
        "surfaces the backend error message and keeps the user on the login screen"
      ;;
    g21-routing.smoke.test.tsx|g21-routing.smoke.test.ts)
      printf '%s\n' \
        "RECEPTION can open Practice-Tickets (integrated practice tasks) without access denied"
      ;;
    *)
      return 1
      ;;
  esac
}

run_smoke_file() {
  local f="$1"
  local heap=6144
  export NODE_OPTIONS="--max-old-space-size=${heap}"
  local names
  if names="$(heavy_test_names "$f")"; then
    local n=0
    local total
    total="$(printf '%s\n' "$names" | grep -c . || true)"
    while IFS= read -r name; do
      [[ -z "$name" ]] && continue
      n=$((n + 1))
      echo "── smoke heavy ${n}/${total}: $(basename "$f") :: $name"
      npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch \
        --testTimeout=120000 -t "$name" "$f"
    done <<< "$names"
  else
    echo "── smoke: $f"
    npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch \
      --testTimeout=120000 "$f"
  fi
}

run_smoke_files() {
  echo "::group::vitest project=smoke (per-file / per-test for App mounts)"
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
