pub mod application;
pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;

use commands::auth_commands::{BruteForceState, SessionState};
use infrastructure::database;
use infrastructure::logging::{self, brute_force::BruteForceTracker};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SessionState::new())
        .manage(BruteForceState(BruteForceTracker::new()))
        .manage(commands::break_glass_commands::BreakGlassStateExt(
            application::break_glass::BreakGlassState::new(),
        ))
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialise file logging into ~/medoc-data/logs/ (NFA-LOG-01..07).
            // Guards must outlive the app — leak them deliberately.
            let data_dir = dirs::home_dir()
                .map(|h| h.join("medoc-data"))
                .unwrap_or_else(|| std::path::PathBuf::from("./medoc-data"));
            std::fs::create_dir_all(&data_dir).ok();
            match logging::init(&data_dir) {
                Ok(guards) => {
                    Box::leak(Box::new(guards));
                    tracing::info!(target: "medoc::system",
                        event = "APP_START",
                        version = env!("CARGO_PKG_VERSION"),
                        os = std::env::consts::OS,
                    );
                }
                Err(e) => eprintln!("logging init failed: {e}"),
            }

            // Enforce log retention windows at startup (NFA-LOG-05).
            let _ = infrastructure::retention::enforce(&data_dir.join("logs"));

            match tauri::async_runtime::block_on(database::connection::init_db(&app_handle)) {
                Ok(pool) => {
                    app_handle.manage(pool.clone());
                    tracing::info!(target: "medoc::system", event = "DB_READY");

                    // NFA-SEC-05: daily automatic backup scheduler (24h interval).
                    let backup_pool = pool.clone();
                    tauri::async_runtime::spawn(async move {
                        let mut ticker =
                            tokio::time::interval(std::time::Duration::from_secs(24 * 60 * 60));
                        // Skip the immediate first tick that `interval` fires.
                        ticker.tick().await;
                        loop {
                            ticker.tick().await;
                            match infrastructure::backup::create(&backup_pool).await {
                                Ok(p) => tracing::info!(
                                    target: "medoc::system",
                                    event = "BACKUP_AUTO_OK",
                                    path = %p.display()
                                ),
                                Err(e) => tracing::error!(
                                    target: "medoc::system",
                                    event = "BACKUP_AUTO_FAIL",
                                    error = %e
                                ),
                            }
                        }
                    });
                }
                Err(e) => {
                    tracing::error!(target: "medoc::system", event = "DB_INIT_FAILED", error = %e);
                    return Err(format!("Datenbank-Initialisierung fehlgeschlagen: {e}").into());
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::auth_commands::login,
            commands::auth_commands::logout,
            commands::auth_commands::get_session,
            commands::auth_commands::touch_session,
            // Personal
            commands::personal_commands::list_personal,
            commands::personal_commands::list_aerzte,
            commands::personal_commands::get_personal,
            commands::personal_commands::create_personal,
            commands::personal_commands::update_personal,
            commands::personal_commands::delete_personal,
            commands::personal_commands::change_password,
            // Patienten
            commands::patient_commands::list_patienten,
            commands::patient_commands::get_patient,
            commands::patient_commands::create_patient,
            commands::patient_commands::update_patient,
            commands::patient_commands::delete_patient,
            commands::patient_commands::search_patienten,
            // Termine
            commands::termin_commands::list_termine,
            commands::termin_commands::get_termin,
            commands::termin_commands::create_termin,
            commands::termin_commands::update_termin,
            commands::termin_commands::delete_termin,
            commands::termin_commands::list_termine_by_date,
            // Akte
            commands::akte_commands::get_akte,
            commands::akte_commands::update_zahnbefund,
            commands::akte_commands::list_zahnbefunde,
            commands::akte_commands::list_behandlungen,
            commands::akte_commands::list_untersuchungen,
            commands::akte_commands::save_anamnesebogen,
            commands::akte_commands::get_anamnesebogen,
            commands::akte_commands::create_untersuchung,
            commands::akte_commands::create_behandlung,
            commands::akte_commands::export_akte_pdf,
            // Zahlungen
            commands::zahlung_commands::list_zahlungen,
            commands::zahlung_commands::create_zahlung,
            commands::zahlung_commands::update_zahlung_status,
            commands::zahlung_commands::get_bilanz,
            // Leistungen
            commands::leistung_commands::list_leistungen,
            commands::leistung_commands::create_leistung,
            commands::leistung_commands::update_leistung,
            commands::leistung_commands::delete_leistung,
            // Produkte
            commands::produkt_commands::list_produkte,
            commands::produkt_commands::create_produkt,
            commands::produkt_commands::update_produkt,
            commands::produkt_commands::delete_produkt,
            // Statistik
            commands::statistik_commands::get_dashboard_stats,
            // Audit
            commands::audit_commands::list_audit_logs,
            commands::audit_commands::export_audit_csv,
            // Logging
            commands::logging_commands::get_log_level,
            commands::logging_commands::set_log_level,
            commands::logging_commands::export_logs,
            commands::logging_commands::verify_audit_chain,
            commands::logging_commands::log_dir,
            // Operations: Backup / DSGVO / Migration
            commands::ops_commands::create_backup,
            commands::ops_commands::list_backups,
            commands::ops_commands::validate_backup,
            commands::ops_commands::dsgvo_export_patient,
            commands::ops_commands::dsgvo_erase_patient,
            commands::ops_commands::import_patients_csv,
            commands::ops_commands::enforce_log_retention,
            // System: license / updates / perf
            commands::system_commands::verify_license,
            commands::system_commands::check_for_updates,
            commands::system_commands::system_health_check,
            commands::system_commands::get_perf_threshold_ms,
            commands::system_commands::set_perf_threshold_ms,
            // DSGVO Verzeichnis
            commands::devices_commands::generate_vvt,
            commands::devices_commands::generate_dsfa,
            // Devices
            commands::devices_commands::parse_gdt_file,
            commands::devices_commands::inspect_dicom_file,
            commands::devices_commands::scanner_list_recent,
            commands::devices_commands::scanner_attach,
            // Finance
            commands::devices_commands::process_payment,
            // Updates
            commands::devices_commands::evaluate_update_payload,
            commands::devices_commands::current_app_version,
            // Break-glass
            commands::break_glass_commands::break_glass_activate,
            commands::break_glass_commands::break_glass_active,
            // Invoice
            commands::invoice_commands::render_invoice_pdf,
            // Integrations & notifications
            commands::integration_commands::list_upcoming_appointments,
            commands::integration_commands::validate_eprescription,
            commands::integration_commands::submit_eprescription,
            commands::integration_commands::send_kim_message,
            // Rezept (FA-REZ)
            commands::rezept_commands::list_rezepte,
            commands::rezept_commands::create_rezept,
            commands::rezept_commands::delete_rezept,
            // Attest (FA-ATT)
            commands::attest_commands::list_atteste,
            commands::attest_commands::create_attest,
            commands::attest_commands::delete_attest,
            // Subscription / billing (FA-PAY)
            commands::subscription_commands::open_subscription_portal,
            commands::subscription_commands::attach_payment_method,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
