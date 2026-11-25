#!/usr/bin/env bash
# Proves that code an edition does not have is not compiled in (docs/architecture/editions-plan.md §7).
#
#   scripts/check-edition-surface.sh [solo|duo|group]      (default: solo)
#
# Rust: the edition's dependency tree must not contain crates its capabilities exclude.
# Frontend: if apps/practice-host-ui/dist exists (built with MEDOC_EDITION=<edition>), its JS must
# not invoke commands of excluded capabilities.
# Exit 1 lists every leak. Until the capability gates land (phase P2), Solo is expected to leak.
set -euo pipefail
cd "$(dirname "$0")/.."

edition="${1:-solo}"
leaks=()

# capability that is off → crates and IPC commands that must be absent
crates_without_net=(medoc-lan medoc-sync axum)
commands_without_net=(sync_run_now pairing_submit_request pairing_decide lan_server_start)
commands_without_multi_staff=(staff_access_set create_staff)
commands_without_tasks=(create_practice_task list_practice_tickets_for_me)
commands_without_work_time=(work_time_start)

case "$edition" in
  solo) off=(net multi_staff tasks work_time) ;;
  duo)  off=() ;;
  group) off=() ;;
  *) echo "unknown edition: $edition" >&2; exit 2 ;;
esac

if [[ ${#off[@]} -eq 0 ]]; then
  echo "edition $edition: nothing to exclude"
  exit 0
fi

tree="$(cargo tree -p medoc --no-default-features --features "edition-$edition" -e normal --prefix none 2>/dev/null | awk '{print $1}' | sort -u)"
for cap in "${off[@]}"; do
  var="crates_without_${cap}[@]"
  for crate in "${!var-}"; do
    if [[ -n "$crate" ]] && grep -qx "$crate" <<<"$tree"; then leaks+=("crate $crate (capability $cap is off)"); fi
  done
done

dist=apps/practice-host-ui/dist/assets
if [[ -d "$dist" ]]; then
  for cap in "${off[@]}"; do
    var="commands_without_${cap}[@]"
    for cmd in "${!var-}"; do
      if [[ -n "$cmd" ]] && grep -rqs "\"$cmd\"" "$dist"; then leaks+=("bundle invokes $cmd (capability $cap is off)"); fi
    done
  done
else
  echo "note: $dist missing, frontend not checked (run: MEDOC_EDITION=$edition npm run build)"
fi

if [[ ${#leaks[@]} -gt 0 ]]; then
  echo "edition $edition: ${#leaks[@]} leak(s)"
  printf '  - %s\n' "${leaks[@]}"
  exit 1
fi
echo "edition $edition: no leaks"
