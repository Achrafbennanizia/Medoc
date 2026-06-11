pub mod application;
pub mod commands;
pub mod domain;
pub mod error;
pub mod infrastructure;
pub mod systems;

// Re-export the structured-log macros from medoc-core. `#[macro_export]`
// places macros at the *defining* crate's root, so `crate::log_security!`
// inside the practice crate would not resolve after the logging module
// moved into `medoc-core`. Re-exporting them here keeps every existing
// `use crate::log_security;` / `crate::log_system!(…)` call site working.
pub use medoc_practice::{log_device, log_migration, log_perf, log_security, log_system, log_workflow};

use commands::audit_chain_commands::AuditChainGuardExt;
use commands::auth_commands::{BruteForceState, SessionState};
use infrastructure::database;
use infrastructure::logging::{self, brute_force::BruteForceTracker};
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SessionState::new())
        .manage(BruteForceState(BruteForceTracker::new()))
        .manage(commands::break_glass_commands::BreakGlassStateExt(
            Arc::new(application::break_glass::BreakGlassState::new()),
        ))
        .manage(commands::lan_commands::LanServerControl::default())
        .manage(commands::network::verbund::VerbundListenerControl::default())
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

            if let Err(e) = infrastructure::app_menu::install_native_menu(app) {
                tracing::warn!(target: "medoc::system", event = "NATIVE_MENU_SKIP", error = %e);
            }

            // Enforce log retention windows at startup (NFA-LOG-05).
            let _ = infrastructure::retention::enforce(&data_dir.join("logs"));

            let audit_chain_guard = Arc::new(application::audit_chain_guard::AuditChainGuard::new());
            application::audit_chain_guard::register(Arc::clone(&audit_chain_guard));
            app.manage(AuditChainGuardExt(audit_chain_guard.clone()));

            match tauri::async_runtime::block_on(
                crate::commands::db_setup_commands::init_db_from_app(&app_handle),
            ) {
                Ok(pool) => {
                    #[cfg(debug_assertions)]
                    {
                        if std::env::args().any(|a| a == "--dev-seed-vertraege") {
                            if let Err(e) = tauri::async_runtime::block_on(
                                database::vertrag_repo::dev_seed_demo(&pool),
                            ) {
                                tracing::warn!(
                                    target: "medoc::system",
                                    event = "DEV_VERTRAG_SEED_FAILED",
                                    error = %e
                                );
                            } else {
                                tracing::info!(
                                    target: "medoc::system",
                                    event = "DEV_VERTRAG_SEED_OK",
                                    hint = "flag --dev-seed-vertraege (debug builds only)"
                                );
                            }
                        }
                    }
                    app_handle.manage(pool.clone());
                    tracing::info!(target: "medoc::system", event = "DB_READY");

                    if let Some(brute) = app.try_state::<BruteForceState>() {
                        if let Err(e) =
                            tauri::async_runtime::block_on(brute.0.hydrate_from_db(&pool))
                        {
                            tracing::warn!(
                                target: "medoc::system",
                                event = "BRUTE_FORCE_HYDRATE_FAILED",
                                error = %e
                            );
                        }
                    }

                    if let Some(bg) = app.try_state::<commands::break_glass_commands::BreakGlassStateExt>() {
                        crate::infrastructure::database::audit_break_glass::register_break_glass(
                            Arc::clone(&bg.0),
                        );
                    }

                    let verify_pool = pool.clone();
                    let verify_guard = audit_chain_guard.clone();
                    tauri::async_runtime::spawn(async move {
                        match infrastructure::database::audit_repo::purge_legacy_placeholder_audit_rows(
                            &verify_pool,
                        )
                        .await
                        {
                            Ok(n) if n > 0 => tracing::warn!(
                                target: "medoc::system",
                                event = "AUDIT_CHAIN_PURGED_PLACEHOLDERS",
                                deleted = n,
                            ),
                            Ok(_) => {}
                            Err(e) => tracing::warn!(
                                target: "medoc::system",
                                event = "AUDIT_CHAIN_PURGE_FAILED",
                                error = %e
                            ),
                        }
                        match infrastructure::database::audit_repo::verify_chain(&verify_pool).await
                        {
                            Ok(None) => verify_guard.set_ok(),
                            Ok(Some(row_id)) => {
                                match infrastructure::database::audit_repo::repair_broken_audit_chain(
                                    &verify_pool,
                                )
                                .await
                                {
                                    Ok(n) if n > 0 => tracing::warn!(
                                        target: "medoc::system",
                                        event = "AUDIT_CHAIN_REPAIRED",
                                        deleted = n,
                                        broken_at = %row_id,
                                    ),
                                    Ok(_) => {}
                                    Err(e) => tracing::warn!(
                                        target: "medoc::system",
                                        event = "AUDIT_CHAIN_REPAIR_FAILED",
                                        error = %e
                                    ),
                                }
                                match infrastructure::database::audit_repo::verify_chain(&verify_pool).await
                                {
                                    Ok(None) => verify_guard.set_ok(),
                                    Ok(Some(still_broken)) => {
                                        verify_guard.set_broken(still_broken.clone());
                                        log_security!(error,
                                            event = "AUDIT_CHAIN_BROKEN",
                                            broken_at = %still_broken,
                                        );
                                    }
                                    Err(e) => tracing::warn!(
                                        target: "medoc::system",
                                        event = "AUDIT_CHAIN_VERIFY_FAILED",
                                        error = %e
                                    ),
                                }
                            }
                            Err(e) => tracing::warn!(
                                target: "medoc::system",
                                event = "AUDIT_CHAIN_VERIFY_FAILED",
                                error = %e
                            ),
                        }
                    });

                    let auto_pool = pool.clone();
                    let auto_app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        commands::lan_commands::auto_start_if_enabled(
                            auto_app.clone(),
                            auto_pool.clone(),
                        )
                        .await;
                        if let Some(ctrl) = auto_app.try_state::<commands::lan_commands::LanServerControl>() {
                            commands::lan_commands::auto_start_replica_sync_lan(
                                &auto_app,
                                auto_pool.clone(),
                                &ctrl,
                            )
                            .await;
                        }
                        if let Some(verbund_ctrl) =
                            auto_app.try_state::<commands::network::verbund::VerbundListenerControl>()
                        {
                            commands::network::verbund::auto_start_verbund_if_ready(
                                &auto_pool,
                                &verbund_ctrl,
                            )
                            .await;
                        }
                    });

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

            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                if let Some(w) = app_handle.get_webview_window("main") {
                    if let Err(e) = w.set_decorations(true) {
                        tracing::warn!(
                            target: "medoc::system",
                            event = "MAC_WINDOW_DECORATIONS",
                            error = %e
                        );
                    }
                    if let Err(e) = w.set_title_bar_style(TitleBarStyle::Overlay) {
                        tracing::warn!(
                            target: "medoc::system",
                            event = "MAC_WINDOW_TITLE_BAR_OVERLAY",
                            error = %e
                        );
                    }
                    if let Err(e) = w.set_title("") {
                        tracing::warn!(target: "medoc::system", event = "MAC_WINDOW_TITLE_CLEAR", error = %e);
                    } else {
                        tracing::info!(target: "medoc::system", event = "MAC_WINDOW_TRAFFIC_OVERLAY_OK");
                    }
                } else {
                    tracing::warn!(target: "medoc::system", event = "MAC_WINDOW_MAIN_NOT_FOUND");
                }
            }

            Ok(())
        })
        .on_menu_event(|app, event| {
            infrastructure::app_menu::handle_menu_event(app, &event);
        });
    let app = commands::register::register_invoke_handler(app);
    app.run(tauri::generate_context!()).unwrap_or_else(|e| {
        // Last-resort log; tracing may not be initialised if `setup` failed,
        // so we always echo to stderr too.
        tracing::error!(target: "medoc::system", event = "APP_FATAL", error = %e);
        eprintln!("medoc fatal: {e}");
        std::process::exit(1);
    });
}
