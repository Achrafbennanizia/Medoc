#!/usr/bin/env bash
# Sequential Vitest projects with a single worker — avoids multi-GB heap OOM on GHA.
set -euo pipefail
cd "$(dirname "$0")/../apps/practice-host-ui"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=4096}"
for project in node smoke mvp-unit; do
  echo "::group::vitest project=${project}"
  npx vitest run --project "$project" --pool=forks --maxWorkers=1 --fileParallelism=false
  echo "::endgroup::"
done
