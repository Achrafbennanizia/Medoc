#!/usr/bin/env bash
# Proves that code an edition does not have is not compiled in (docs/architecture/editions-plan.md §7).
#
#   scripts/check-edition-surface.sh [solo|duo|group]      (default: solo)
#
# Rust: the edition's dependency tree must not contain crates its capabilities exclude.
# Frontend: if apps/practice-host-ui/dist exists (built with MEDOC_EDITION=<edition>), its JS must
# not invoke commands of excluded capabilities.
# Exit 1 lists every leak.
set -euo pipefail
cd "$(dirname "$0")/.."

edition="${1:-solo}"
leaks=()

# capability that is off → crates and IPC commands that must be absent
# medoc-sync stays (device identity, licence, numbering); its transport crates must not.
crates_without_net=(medoc-lan medoc-company axum mdns-sd snow ciborium btleplug)
commands_without_net=(lan_server_get_config lan_server_set_config lan_server_status lan_server_start lan_server_stop lan_server_scan sync_set_deployment sync_run_now sync_exchange_queue sync_reconcile_now sync_last_update_check sync_probe_master pairing_list_pending pairing_list_all pairing_decide pairing_confirm_pin pairing_revoke pairing_master_info pairing_scan_lan pairing_scan_bluetooth pairing_submit_request pairing_check_status pairing_persist_token install_plan_run_provisioning cluster_discover_admins cluster_send_join_request cluster_submit_sas cluster_sync_staff_directory cluster_start_listener network_set_hidden cluster_list_pending cluster_accept_request cluster_reject_request cluster_list_devices cluster_reclaim_device cluster_revoke_device cluster_block_device cluster_unblock_device cluster_cluster_reset_preview cluster_execute_cluster_reset)
commands_without_multi_staff=(history_for_record history_for_patient access_catalog staff_access_get staff_access_set staff_access_reset staff_access_set_scopes list_staff get_staff create_staff update_staff delete_staff set_staff_password_by_admin list_staff_permission_overrides set_staff_permission_override delete_staff_permission_override reset_staff_permission_overrides set_staff_full_chart_readonly grant_staff_all_permissions get_staff_quota)
commands_without_tasks=(create_practice_ticket list_practice_tickets_for_me update_practice_ticket_status count_open_practice_tickets_for_me create_practice_task list_practice_tasks_for_me transition_practice_task count_open_practice_tasks_for_me list_practice_tasks_admin create_practice_task_admin update_practice_task_admin list_practice_task_comments add_practice_task_comment list_task_team_directory)
commands_without_validation=(list_charts_to_validate count_charts_to_validate validate_patient_chart decline_patient_chart forward_chart_to_physicians)
commands_without_day_close=(create_day_close_protocol delete_day_close_protocol prepare_day_close close_day correct_day_close)
commands_without_work_time=(work_time_start work_time_pause work_time_resume work_time_end work_time_reconcile_on_login work_time_get_active_session work_time_get_week_overview work_time_get_team_overview work_time_get_statistics work_time_get_preference work_time_set_preference work_time_set_auto_record_on_login work_time_get_auto_record_on_login work_time_get_practice_policy work_time_set_practice_policy sick_leave_certificate_save list_sick_leave_certificates end_sick_leave_certificate list_work_plan_adjustments)

case "$edition" in
  solo) off=(net multi_staff tasks validation work_time day_close) ;;
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
