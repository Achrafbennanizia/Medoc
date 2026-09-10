#!/usr/bin/env bash
# Sequential Vitest projects with a single worker — keeps GHA RSS bounded.
set -euo pipefail
cd "$(dirname "$0")/../apps/practice-host-ui"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
for project in node mvp-unit; do
  echo "::group::vitest project=${project}"
  npx vitest run --project "$project" --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch
  echo "::endgroup::"
done
