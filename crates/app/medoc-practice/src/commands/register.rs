//! Central Tauri IPC registration.
//! `tauri::generate_handler!` only sees paths written here, so this list is the
//! only registration site. Add a command by adding its path here.

#[macro_export]
macro_rules! medoc_invoke_handler {
    () => {
        tauri::generate_handler![
            $crate::commands::admin::access::device_info,
            #[cfg(feature = "cap-allowances")]
            $crate::commands::admin::allowances::allowances_list,
            #[cfg(feature = "cap-allowances")]
            $crate::commands::admin::allowances::allowances_set,
            #[cfg(feature = "cap-allowances")]
            $crate::commands::admin::allowances::record_visibility_set,
            #[cfg(feature = "cap-allowances")]
            $crate::commands::admin::allowances::record_visibility_get,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::guest_account_get,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::guest_account_set,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::staged_change_submit,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::staged_change_list,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::staged_change_count_pending,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::staged_change_add,
            #[cfg(feature = "cap-guest-inbox")]
            $crate::commands::admin::guest::staged_change_dismiss,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::history::history_for_record,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::history::history_for_patient,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::access::access_catalog,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::access::staff_access_get,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::access::staff_access_set,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::access::staff_access_reset,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::access::staff_access_set_scopes,
            $crate::commands::clinical::chart_attachment::list_chart_attachments,
            $crate::commands::clinical::chart_attachment::create_chart_attachment,
            $crate::commands::clinical::chart_attachment::create_chart_attachment_from_path,
            $crate::commands::clinical::chart_attachment::delete_chart_attachment,
            $crate::commands::clinical::chart_attachment::rename_chart_attachment,
            $crate::commands::clinical::chart_attachment::set_chart_attachment_document_kind,
            $crate::commands::clinical::chart_attachment::open_chart_attachment_externally,
            $crate::commands::clinical::chart_attachment::duplicate_chart_attachment,
            $crate::commands::clinical::chart::get_chart,
            $crate::commands::clinical::chart::update_dental_finding,
            $crate::commands::clinical::chart::list_dental_findings,
            $crate::commands::clinical::chart::list_treatments,
            $crate::commands::clinical::chart::list_examinations,
            $crate::commands::clinical::chart::save_anamnesis_form,
            $crate::commands::clinical::chart::get_anamnesis_form,
            $crate::commands::clinical::chart::create_examination,
            $crate::commands::clinical::chart::create_treatment,
            $crate::commands::clinical::chart::update_treatment,
            $crate::commands::clinical::chart::delete_treatment,
            $crate::commands::clinical::chart::release_treatment_for_billing,
            $crate::commands::clinical::chart::set_treatment_billing,
            $crate::commands::clinical::chart::release_examination_for_billing,
            $crate::commands::clinical::chart::update_examination,
            $crate::commands::clinical::chart::delete_examination,
            $crate::commands::clinical::chart::export_chart_pdf,
            $crate::commands::clinical::chart::export_discharge_leaflet_pdf,
            $crate::commands::clinical::chart_next_appointment::get_chart_next_appointment_hint,
            $crate::commands::clinical::chart_next_appointment::list_chart_next_appointment_hints_pending,
            $crate::commands::clinical::chart_next_appointment::set_chart_next_appointment_hint,
            $crate::commands::clinical::chart_validation::list_chart_validation,
            $crate::commands::clinical::chart_validation::set_chart_section_validated,
            $crate::commands::clinical::chart_validation::set_chart_item_validated,
            $crate::commands::clinical::chart_validation::clear_chart_validation,
            #[cfg(feature = "cap-validation")]
            $crate::commands::clinical::chart_workflow::list_charts_to_validate,
            #[cfg(feature = "cap-validation")]
            $crate::commands::clinical::chart_workflow::count_charts_to_validate,
            #[cfg(feature = "cap-validation")]
            $crate::commands::clinical::chart_workflow::validate_patient_chart,
            #[cfg(feature = "cap-validation")]
            $crate::commands::clinical::chart_workflow::decline_patient_chart,
            #[cfg(feature = "cap-validation")]
            $crate::commands::clinical::chart_workflow::forward_chart_to_physicians,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::clinical::chart_workflow::create_practice_ticket,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::clinical::chart_workflow::list_practice_tickets_for_me,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::clinical::chart_workflow::update_practice_ticket_status,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::clinical::chart_workflow::count_open_practice_tickets_for_me,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::create_practice_task,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::list_practice_tasks_for_me,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::transition_practice_task,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::count_open_practice_tasks_for_me,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::list_practice_tasks_admin,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::create_practice_task_admin,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::update_practice_task_admin,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::list_practice_task_comments,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::scheduling::practice_task::add_practice_task_comment,
            $crate::commands::admin::app_kv::get_app_kv,
            $crate::commands::admin::app_kv::set_app_kv,
            $crate::commands::admin::app_kv::delete_app_kv,
            $crate::commands::system::ui_prefs::get_ui_prefs,
            $crate::commands::system::offline_cache::offline_cache_read,
            $crate::commands::system::offline_cache::offline_cache_write,
            $crate::commands::system::offline_cache::offline_cache_clear,
            $crate::commands::system::ui_prefs::set_ui_prefs,
            $crate::commands::clinical::certificate::list_certificates,
            $crate::commands::clinical::certificate::create_certificate,
            $crate::commands::clinical::certificate::delete_certificate,
            $crate::commands::admin::audit_chain::get_audit_chain_status,
            $crate::commands::admin::audit_chain::acknowledge_audit_chain_break,
            $crate::commands::admin::audit_chain::repair_audit_chain,
            $crate::commands::admin::audit::list_audit_logs,
            $crate::commands::admin::audit::list_audit_logs_paged,
            $crate::commands::admin::audit::export_audit_csv,
            $crate::commands::admin::auth::login,
            $crate::commands::admin::auth::logout,
            $crate::commands::admin::auth::get_session,
            $crate::commands::admin::auth::touch_session,
            $crate::commands::admin::auth::list_my_device_sessions,
            $crate::commands::admin::auth::revoke_my_other_device_sessions,
            $crate::commands::admin::auth::investigate_my_device_session,
            $crate::commands::admin::auth::revoke_my_device_session,
            $crate::commands::admin::auth::set_my_device_session_trusted,
            $crate::commands::admin::auth::start_totp_enrollment_login,
            $crate::commands::admin::auth::confirm_totp_enrollment_login,
            $crate::commands::practice::purchase_order::list_purchase_orders,
            $crate::commands::practice::purchase_order::create_purchase_order,
            $crate::commands::practice::purchase_order::update_purchase_order_status,
            $crate::commands::practice::purchase_order::update_purchase_order,
            $crate::commands::practice::purchase_order::delete_purchase_order,
            $crate::commands::billing::balance_sheet_snapshot::list_balance_sheet_snapshots,
            $crate::commands::billing::balance_sheet_snapshot::get_balance_sheet_snapshot,
            $crate::commands::billing::balance_sheet_snapshot::create_balance_sheet_snapshot,
            $crate::commands::billing::balance_sheet_snapshot::delete_balance_sheet_snapshot,
            $crate::commands::billing::balance_sheet_snapshot::compute_period_report,
            $crate::commands::billing::balance_sheet_snapshot::create_period_report,
            $crate::commands::billing::balance_sheet_snapshot::reprint_period_report,
            $crate::commands::admin::break_glass::break_glass_activate,
            $crate::commands::admin::break_glass::break_glass_active,
            $crate::commands::network::company_portal::get_company_portal_config,
            $crate::commands::network::company_portal::set_company_portal_config,
            $crate::commands::network::company_portal::company_portal_fetch_summary,
            $crate::commands::network::company_portal::company_portal_fetch_integrations,
            $crate::commands::network::company_portal::company_portal_fetch_feature_flags,
            $crate::commands::network::company_portal::company_portal_billing_portal_url,
            $crate::commands::network::company_portal::company_portal_attach_payment,
            $crate::commands::network::company_portal::company_portal_fetch_update_manifest,
            $crate::commands::network::company_portal::company_portal_ping,
            $crate::commands::network::company_portal::onboarding_subscription_status,
            $crate::commands::network::company_portal::register_onboarding_subscription,
            $crate::commands::network::company_portal::register_onboarding_member_account,
            $crate::commands::network::company_portal::onboarding_use_existing_account,
            $crate::commands::network::company_portal::onboarding_skip_practice_setup,
            $crate::commands::admin::db_setup::get_db_setup_status,
            $crate::commands::admin::db_setup::provision_db_passphrase,
            $crate::commands::admin::db_setup::unlock_db_passphrase,
            $crate::commands::system::devices::generate_vvt,
            $crate::commands::system::devices::generate_dpia,
            $crate::commands::system::devices::parse_gdt_file,
            $crate::commands::system::devices::inspect_dicom_file,
            $crate::commands::system::devices::scanner_list_recent,
            $crate::commands::system::devices::open_system_scan_utility,
            $crate::commands::system::devices::open_native_print_dialog,
            $crate::commands::system::devices::scanner_attach,
            $crate::commands::system::devices::scanner_attach_contract,
            $crate::commands::system::devices::scanner_attach_contract_app_data,
            $crate::commands::system::devices::pick_contract_pdf_file,
            $crate::commands::system::devices::process_payment,
            $crate::commands::system::devices::evaluate_update_payload,
            $crate::commands::system::devices::current_app_version,
            $crate::commands::system::document_pdf::preview_document_pdf,
            $crate::commands::practice::document_template::list_document_templates_for_kind,
            $crate::commands::system::export::save_export_file,
            $crate::commands::system::export::pick_export_directory,
            $crate::commands::system::export::save_export_bytes_to_folder,
            $crate::commands::practice::feedback::submit_feedback,
            $crate::commands::practice::feedback::list_feedback,
            $crate::commands::practice::in_app_notification::list_in_app_notifications,
            $crate::commands::practice::in_app_notification::count_unread_in_app_notifications,
            $crate::commands::practice::in_app_notification::mark_in_app_notification_read,
            $crate::commands::practice::in_app_notification::mark_all_in_app_notifications_read,
            $crate::commands::practice::in_app_notification::create_in_app_notification,
            $crate::commands::practice::in_app_notification::dismiss_unread_in_app_notifications_by_kind,
            $crate::commands::system::integration::list_upcoming_appointments,
            $crate::commands::system::integration::validate_eprescription,
            $crate::commands::system::integration::submit_eprescription,
            $crate::commands::system::integration::send_kim_message,
            $crate::commands::billing::invoice::render_invoice_pdf,
            $crate::commands::documents::issue::issue_clinical_document,
            $crate::commands::documents::issue::issue_invoice,
            $crate::commands::documents::issue::cancel_issued_invoice,
            $crate::commands::documents::issue::reprint_issued_document,
            $crate::commands::documents::issue::issue_report_pdf,
            $crate::commands::documents::issue::list_issued_documents,
            $crate::commands::documents::issue::verify_issued_document,
            $crate::commands::system::report_pdf::render_report_pdf_command,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_get_config,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_set_config,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_status,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_start,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_stop,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::lan::lan_server_scan,
            $crate::commands::network::local::sync_get_status,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync::sync_set_deployment,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync::sync_run_now,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync::sync_exchange_queue,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync::sync_reconcile_now,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::reconnect_update_check::sync_last_update_check,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync::sync_probe_master,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync_problems::sync_problem_list,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync_problems::sync_problem_open_count,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync_problems::sync_problem_retry,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::sync_problems::sync_problem_dismiss,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::master::pairing_list_pending,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::master::pairing_list_all,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::master::pairing_decide,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::replica::pairing_confirm_pin,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::master::pairing_revoke,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::master::pairing_master_info,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::discovery_lan::pairing_scan_lan,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::discovery_ble::pairing_scan_bluetooth,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::replica::pairing_submit_request,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::replica::pairing_check_status,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::pairing::replica::pairing_persist_token,
            $crate::commands::network::local::cluster_status_cmd,
            $crate::commands::network::local::license_activate,
            $crate::commands::network::local::import_activation_manifest,
            $crate::commands::network::local::pick_activation_manifest_file,
            $crate::commands::network::local::install_plan_consume_sidecar,
            $crate::commands::network::local::install_plan_apply,
            $crate::commands::network::local::install_plan_provisioning_status,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::install_plan_run_provisioning,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_discover_admins,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_send_join_request,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_submit_sas,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_sync_staff_directory,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_start_listener,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::network_set_hidden,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_list_pending,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_accept_request,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_reject_request,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_list_devices,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_reclaim_device,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_revoke_device,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_block_device,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_unblock_device,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_cluster_reset_preview,
            #[cfg(feature = "cap-net")]
            $crate::commands::network::cluster::cluster_execute_cluster_reset,
            $crate::commands::billing::service_item::list_services,
            $crate::commands::billing::service_item::create_service_item,
            $crate::commands::billing::service_item::update_service_item,
            $crate::commands::billing::service_item::delete_service_item,
            $crate::commands::system::logging::get_log_level,
            $crate::commands::system::logging::set_log_level,
            $crate::commands::system::logging::export_logs,
            $crate::commands::system::support::support_bundle_create,
            $crate::commands::system::health::health_summary,
            $crate::commands::system::health::remote_command_list,
            $crate::commands::system::health::remote_command_decide,
            $crate::commands::system::health::numbering_gap_acknowledge,
            $crate::commands::system::update_rollout::update_rollout_state,
            $crate::commands::system::update_rollout::update_schedule,
            $crate::commands::system::update_rollout::update_schedule_cancel,
            $crate::commands::system::logging::verify_audit_chain,
            $crate::commands::system::logging::log_dir,
            $crate::commands::system::logging::log_client_event,
            $crate::commands::system::menu::sync_native_menu,
            $crate::commands::system::ops::create_backup,
            $crate::commands::system::ops::list_backups,
            $crate::commands::system::ops::validate_backup,
            $crate::commands::system::ops::restore_backup,
            $crate::commands::system::ops::backup_overview,
            $crate::commands::system::ops::set_backup_schedule,
            $crate::commands::system::ops::reset_backups,
            $crate::commands::system::ops::delete_backup,
            $crate::commands::system::ops::pick_backup_folder,
            $crate::commands::system::ops::set_backup_folder,
            $crate::commands::system::ops::dsgvo_export_patient,
            $crate::commands::system::ops::dsgvo_erase_patient,
            $crate::commands::system::ops::import_patients_csv,
            $crate::commands::system::ops::pick_patients_csv_file,
            $crate::commands::system::ops::pick_backup_file,
            $crate::commands::system::ops::enforce_log_retention,
            $crate::commands::clinical::patient::list_patients,
            $crate::commands::clinical::patient::list_patients_paged,
            $crate::commands::clinical::patient::list_patient_ids_open_chart,
            $crate::commands::clinical::patient::count_patients_by_filter,
            $crate::commands::clinical::patient::list_patients_by_ids,
            $crate::commands::clinical::patient::get_patient,
            $crate::commands::clinical::patient::create_patient,
            $crate::commands::clinical::patient::update_patient,
            $crate::commands::clinical::patient::delete_patient,
            $crate::commands::clinical::patient::restore_patient,
            $crate::commands::clinical::patient::search_patients,
            $crate::commands::clinical::patient::export_patients_csv,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::list_staff,
            $crate::commands::admin::staff::list_physicians,
            #[cfg(feature = "cap-tasks")]
            $crate::commands::admin::staff::list_task_team_directory,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::get_staff,
            $crate::commands::admin::staff::get_own_profile,
            $crate::commands::admin::staff::update_own_profile,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::create_staff,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::update_staff,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::delete_staff,
            $crate::commands::admin::staff::change_password,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::set_staff_password_by_admin,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::list_staff_permission_overrides,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::set_staff_permission_override,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::delete_staff_permission_override,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::reset_staff_permission_overrides,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::set_staff_full_chart_readonly,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::grant_staff_all_permissions,
            $crate::commands::admin::staff::admin_unlock_brute_force,
            $crate::commands::admin::staff::evaluate_password_policy,
            #[cfg(feature = "cap-multi-staff")]
            $crate::commands::admin::staff::get_staff_quota,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_start,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_pause,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_resume,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_end,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_reconcile_on_login,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_active_session,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_week_overview,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_team_overview,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_statistics,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_preference,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_set_preference,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_set_auto_record_on_login,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_auto_record_on_login,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_get_practice_policy,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_time::work_time_set_practice_policy,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::sick_leave_certificate::sick_leave_certificate_save,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::sick_leave_certificate::list_sick_leave_certificates,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::sick_leave_certificate::end_sick_leave_certificate,
            #[cfg(feature = "cap-work-time")]
            $crate::commands::admin::work_plan_adjustment::list_work_plan_adjustments,
            // TODO(deferred-security): 2FA IPC unwired — see todos-deferred-security-features.md
            // $crate::commands::admin::staff::get_totp_status,
            // $crate::commands::admin::staff::start_totp_enrollment,
            // $crate::commands::admin::staff::confirm_totp_enrollment,
            // $crate::commands::admin::staff::deactivate_totp,
            $crate::commands::practice::core::list_absences,
            $crate::commands::practice::core::create_absence,
            $crate::commands::practice::core::update_absence,
            $crate::commands::practice::core::delete_absence,
            $crate::commands::practice::core::list_document_templates,
            $crate::commands::practice::core::create_document_template,
            $crate::commands::practice::core::update_document_template,
            $crate::commands::practice::core::delete_document_template,
            $crate::commands::practice::core::list_treatment_catalog,
            $crate::commands::practice::core::create_treatment_catalog_item,
            $crate::commands::practice::core::update_treatment_catalog_item,
            $crate::commands::practice::core::delete_treatment_catalog_item,
            $crate::commands::practice::core::list_supplier_master,
            $crate::commands::practice::core::create_supplier_master,
            $crate::commands::practice::core::delete_supplier_master,
            $crate::commands::practice::core::list_pharma_consultant_master,
            $crate::commands::practice::core::create_pharma_consultant_master,
            $crate::commands::practice::core::delete_pharma_consultant_master,
            $crate::commands::practice::core::list_supplier_pharma_templates,
            $crate::commands::practice::core::create_supplier_pharma_template,
            $crate::commands::practice::core::delete_supplier_pharma_template,
            $crate::commands::practice::product::list_products,
            $crate::commands::practice::product::create_product,
            $crate::commands::practice::product::update_product,
            $crate::commands::practice::product::delete_product,
            $crate::commands::billing::invoice_document::list_invoice_documents,
            $crate::commands::billing::invoice_document::append_invoice_document,
            $crate::commands::billing::invoice_document::list_invoice_status,
            $crate::commands::billing::invoice_document::get_invoice_status,
            $crate::commands::billing::invoice_document::issue_payment_reminder,
            $crate::commands::billing::invoice_document::list_payment_reminders,
            $crate::commands::billing::invoice_document::payment_reminder_copy,
            $crate::commands::clinical::prescription::list_prescriptions,
            $crate::commands::clinical::prescription::create_prescription,
            $crate::commands::clinical::prescription::update_prescription,
            $crate::commands::clinical::prescription::delete_prescription,
            $crate::commands::practice::statistics::get_dashboard_stats,
            $crate::commands::practice::statistics::get_statistics_overview,
            $crate::commands::system::subscription::open_subscription_portal,
            $crate::commands::system::subscription::attach_payment_method,
            $crate::commands::system::core::verify_license,
            $crate::commands::system::core::activate_license,
            $crate::commands::system::core::current_license_status,
            $crate::commands::system::core::clear_license,
            $crate::commands::system::core::check_for_updates,
            $crate::commands::system::edition::edition_info,
        $crate::commands::system::core::install_available_update,
            $crate::commands::system::core::list_detected_photo_viewer_apps,
            $crate::commands::system::core::system_health_check,
            $crate::commands::system::core::get_perf_threshold_ms,
            $crate::commands::system::core::set_perf_threshold_ms,
            $crate::commands::billing::day_close_protocol::list_day_close_protocols,
            $crate::commands::billing::day_close_protocol::get_day_close_protocol,
            #[cfg(feature = "cap-day-close")]
            $crate::commands::billing::day_close_protocol::create_day_close_protocol,
            #[cfg(feature = "cap-day-close")]
            $crate::commands::billing::day_close_protocol::delete_day_close_protocol,
            #[cfg(feature = "cap-day-close")]
            $crate::commands::billing::day_close_protocol::prepare_day_close,
            #[cfg(feature = "cap-day-close")]
            $crate::commands::billing::day_close_protocol::close_day,
            #[cfg(feature = "cap-day-close")]
            $crate::commands::billing::day_close_protocol::correct_day_close,
            $crate::commands::billing::day_close_protocol::day_close_report_copy,
            $crate::commands::billing::day_close_protocol::record_cash_movement,
            $crate::commands::billing::day_close_protocol::reverse_cash_movement,
            $crate::commands::billing::day_close_protocol::list_cash_movements,
            $crate::commands::scheduling::appointment::list_appointments,
            $crate::commands::scheduling::appointment::list_appointments_paged,
            $crate::commands::scheduling::appointment::list_appointments_in_range,
            $crate::commands::scheduling::appointment::move_appointments,
            $crate::commands::scheduling::appointment::get_appointment,
            $crate::commands::scheduling::appointment::create_appointment,
            $crate::commands::scheduling::appointment::update_appointment,
            $crate::commands::scheduling::appointment::delete_appointment,
            $crate::commands::scheduling::appointment::list_appointments_by_date,
            $crate::commands::billing::contract::list_contracts,
            $crate::commands::billing::contract::upsert_contract,
            $crate::commands::billing::contract::delete_contract,
            $crate::commands::billing::contract::open_contract_document,
            $crate::commands::billing::payment::list_payments,
            $crate::commands::billing::payment::list_payments_paged,
            $crate::commands::billing::payment::payment_finance_kpis,
            $crate::commands::billing::payment::payment_monthly_breakdown,
            $crate::commands::billing::payment::list_payments_for_patient,
            $crate::commands::billing::payment::list_patient_ids_open_invoice,
            $crate::commands::billing::payment::create_payment,
            $crate::commands::billing::payment::update_payment,
            $crate::commands::billing::payment::delete_payment,
            $crate::commands::billing::payment::update_payment_status,
            $crate::commands::billing::payment::get_balance_sheet,
            $crate::commands::billing::payment::set_payments_cash_verified,
        ]
    };
}

/// Attach the consolidated IPC handler to the Tauri builder.
///
/// Concrete `Wry` runtime required so commands taking `AppHandle` type-check
/// (see `commands::clinical::chart_attachment`).
pub fn register_invoke_handler(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.invoke_handler(crate::medoc_invoke_handler!())
}
