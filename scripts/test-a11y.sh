#!/usr/bin/env bash
set -euo pipefail

PORT="${A11Y_PORT:-4173}"
URL="http://127.0.0.1:${PORT}"
PREVIEW_LOG="$(mktemp)"
TEMP_REPORT=0
if [[ -n "${A11Y_PREVIEW_COMMAND:-}" ]]; then
  PREVIEW_COMMAND="${A11Y_PREVIEW_COMMAND}"
else
  PREVIEW_COMMAND="npm run preview -w medoc -- --host 127.0.0.1 --port ${PORT}"
fi

if [[ -n "${A11Y_REPORT_FILE:-}" ]]; then
  REPORT_FILE="${A11Y_REPORT_FILE}"
else
  REPORT_FILE="$(mktemp)"
  TEMP_REPORT=1
fi

cleanup() {
  if [[ -n "${PREVIEW_PID:-}" ]]; then
    kill "${PREVIEW_PID}" >/dev/null 2>&1 || true
    wait "${PREVIEW_PID}" >/dev/null 2>&1 || true
  fi
  rm -f "${PREVIEW_LOG}"
  if [[ "${TEMP_REPORT}" == "1" ]]; then
    rm -f "${REPORT_FILE}"
  fi
}
trap cleanup EXIT INT TERM

bash -lc "${PREVIEW_COMMAND}" >"${PREVIEW_LOG}" 2>&1 &
PREVIEW_PID=$!

for _ in $(seq 1 60); do
  if curl --silent --fail "${URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl --silent --fail "${URL}" >/dev/null 2>&1; then
  echo "A11y preview server did not become ready at ${URL}." >&2
  cat "${PREVIEW_LOG}" >&2
  exit 1
fi

npx --yes @axe-core/cli "${URL}" --tags wcag2a,wcag2aa --save "${REPORT_FILE}" >/dev/null

node - "${REPORT_FILE}" <<'NODE'
const fs = require("node:fs");

const reportPath = process.argv[2];
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const violations = Array.isArray(report.violations) ? report.violations : [];
const critical = violations.filter((entry) => entry.impact === "critical");

if (critical.length > 0) {
  console.error(`Critical WCAG 2.1 A/AA violations: ${critical.length}`);
  for (const violation of critical) {
    const nodeCount = Array.isArray(violation.nodes) ? violation.nodes.length : 0;
    const nodeLabel = nodeCount === 1 ? "node" : "nodes";
    console.error(`- ${violation.id}: ${violation.help} (${nodeCount} ${nodeLabel})`);
  }
  process.exit(1);
}

console.log("No critical WCAG 2.1 A/AA axe-core violations detected.");
NODE
