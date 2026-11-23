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
pub use medoc_practice::{
    log_device, log_migration, log_perf, log_security, log_system, log_workflow,
};

use commands::admin::audit_chain::AuditChainGuardExt;
use commands::admin::auth::{BruteForceState, SessionState};
use infrastructure::database;
use infrastructure::logging::{self, brute_force::BruteForceTracker};
use std::sync::Arc;
use tauri::Manager;

/// Dock label for this process. The window title stays empty.
#[cfg(target_os = "macos")]
fn set_macos_desktop_name(name: &str) {
    // `CPSSetProcessName` aborts on some macOS builds for unsigned debug binaries; window title is enough for now.
    tracing::debug!(target: "medoc::system", event = "MAC_DOCK_NAME_SKIP", name = %name);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let instance_lock_name = std::env::var("MEDOC_INSTANCE")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("de.medoc.app.practice-host.{s}"))
        .unwrap_or_else(|| "de.medoc.app.practice-host".to_string());
    // macOS stores this name as a file path. A relative name fails when
    // LaunchServices starts the app with working directory "/".
    let instance_lock_path = dirs::home_dir()
        .map(|home| home.join(&instance_lock_name))
        .unwrap_or_else(|| std::path::PathBuf::from(&instance_lock_name));
    let instance_lock_name = instance_lock_path.to_string_lossy().into_owned();
    let instance = match single_instance::SingleInstance::new(&instance_lock_name) {
        Ok(i) => i,
        Err(e) => {
            eprintln!("medoc instance lock: {e}");
            return;
        }
    };
    if !instance.is_single() {
        tracing::info!(target: "medoc::system", event = "APP_ALREADY_RUNNING");
        eprintln!("MeDoc is already running — use the existing window.");
        return;
    }
    // Keep the OS mutex until process exit so a second launch cannot start LAN/DB again.
    std::mem::forget(instance);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(SessionState::new())
        .manage(BruteForceState(BruteForceTracker::new()))
        .manage(commands::admin::break_glass::BreakGlassStateExt(
            Arc::new(application::break_glass::BreakGlassState::new()),
        ))
        .manage(commands::network::lan::LanServerControl::default())
        .manage(commands::network::cluster::ClusterListenerControl::default())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialise file logging into ~/medoc-data/logs/ (NFA-LOG-01..07).
            // Guards must outlive the app — leak them deliberately.
            let data_dir = dirs::home_dir()
                .map(|h| h.join("medoc-data"))
                .unwrap_or_else(|| std::path::PathBuf::from("./medoc-data"));
            std::fs::create_dir_all(&data_dir).ok();
            // Crash-safe queues (offline changes, changes being sent): docs/architecture/serverless-sync.md.
            infrastructure::durable_cache::init(data_dir.join("cache"));
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

            if let Ok(app_dir) = app_handle.path().app_data_dir() {
                let _ = database::connection::prepare_practice_db_before_launch(&app_dir);
            }

            let mut db_result = tauri::async_runtime::block_on(
                crate::commands::admin::db_setup::init_db_from_app(&app_handle),
            );
            if let Err(ref e) = db_result {
                let msg = e.to_string();
                if msg.contains("already running") || msg.contains("in use") {
                    eprintln!("{msg}");
                    std::process::exit(0);
                }
                if let Ok(app_dir) = app_handle.path().app_data_dir() {
                    let _ = database::connection::prepare_practice_db_before_launch(&app_dir);
                    db_result = tauri::async_runtime::block_on(
                        crate::commands::admin::db_setup::init_db_from_app(&app_handle),
                    );
                }
            }

            let mut replica_desktop_name: Option<&'static str> = None;
            match db_result {
                Ok(pool) => {
                    #[cfg(debug_assertions)]
                    {
                        if std::env::args().any(|a| a == "--dev-seed-contracts") {
                            if let Err(e) = tauri::async_runtime::block_on(
                                database::repos::billing::contract::dev_seed_demo(&pool),
                            ) {
                                tracing::warn!(
                                    target: "medoc::system",
                                    event = "DEV_CONTRACT_SEED_FAILED",
                                    error = %e
                                );
                            } else {
                                tracing::info!(
                                    target: "medoc::system",
                                    event = "DEV_CONTRACT_SEED_OK",
                                    hint = "flag --dev-seed-contracts (debug builds only)"
                                );
                            }
                        }
                    }
                    app_handle.manage(pool.clone());
                    tracing::info!(target: "medoc::system", event = "DB_READY");

                    match tauri::async_runtime::block_on(
                        crate::systems::usb_install_startup::apply_usb_install_plan_on_startup(&pool),
                    ) {
                        Ok(Some(applied)) => {
                            tracing::info!(
                                target: "medoc::system",
                                event = "INSTALL_PLAN_APPLIED",
                                applied = applied.applied,
                                locale = ?applied.locale,
                            );
                            if let Ok(Some(msg)) = tauri::async_runtime::block_on(
                                crate::systems::usb_install_startup::run_usb_provisioning_on_startup(&pool),
                            ) {
                                tracing::info!(
                                    target: "medoc::system",
                                    event = "INSTALL_PLAN_PROVISIONING",
                                    message = %msg,
                                );
                            }
                        }
                        Ok(None) => {}
                        Err(e) => tracing::warn!(
                            target: "medoc::system",
                            event = "INSTALL_PLAN_SIDECAR_SKIP",
                            error = %e
                        ),
                    }

                    replica_desktop_name = tauri::async_runtime::block_on(
                        commands::network::sync::replica_desktop_name(&pool),
                    );

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

                    if crate::application::mvp_security::BREAK_GLASS_ENABLED {
                        if let Some(bg) = app.try_state::<commands::admin::break_glass::BreakGlassStateExt>() {
                            crate::infrastructure::database::repos::admin::audit_break_glass::register_break_glass(
                                Arc::clone(&bg.0),
                            );
                        }
                    }

                    let verify_pool = pool.clone();
                    let verify_guard = audit_chain_guard.clone();
                    tauri::async_runtime::spawn(async move {
                        match infrastructure::database::repos::admin::audit::purge_legacy_placeholder_audit_rows(
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
                        match infrastructure::database::repos::admin::audit::verify_chain(&verify_pool).await
                        {
                            Ok(None) => verify_guard.set_ok(),
                            Ok(Some(row_id)) => {
                                match infrastructure::database::repos::admin::audit::repair_broken_audit_chain(
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
                                match infrastructure::database::repos::admin::audit::verify_chain(&verify_pool).await
                                {
                                    Ok(None) => verify_guard.set_ok(),
                                    Ok(Some(still_broken)) => {
                                        verify_guard.set_broken(still_broken.clone());
                                        // F100: an acknowledgement given before the restart still applies.
                                        if matches!(
                                            application::audit_chain_guard::is_acked(&verify_pool, &still_broken).await,
                                            Ok(true)
                                        ) {
                                            verify_guard.acknowledge();
                                        }
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
                        commands::network::lan::auto_start_if_enabled(
                            auto_app.clone(),
                            auto_pool.clone(),
                        )
                        .await;
                        if let Some(ctrl) = auto_app.try_state::<commands::network::lan::LanServerControl>() {
                            commands::network::lan::auto_start_replica_sync_lan(
                                &auto_app,
                                auto_pool.clone(),
                                &ctrl,
                            )
                            .await;
                        }
                        if let Some(cluster_ctrl) =
                            auto_app.try_state::<commands::network::cluster::ClusterListenerControl>()
                        {
                            commands::network::cluster::auto_start_cluster_if_ready(
                                &auto_pool,
                                &cluster_ctrl,
                            )
                            .await;
                        }
                        commands::network::cluster::spawn_member_cluster_watch_task(
                            auto_app.clone(),
                            auto_pool.clone(),
                        );
                        // Before the first sync: restore changes a crash or power cut left in the queue files.
                        commands::network::reconnect_update_check::recover_queues(&auto_pool).await;
                        commands::network::sync::spawn_replica_offline_sync_loop(auto_pool.clone());
                        // F150: started once (was twice: two threads pushing the same changes).
                        commands::network::sync::spawn_shared_change_sync_thread(auto_pool.clone());
                        // F137: stored log level survives restarts.
                        let lvl_pool = auto_pool.clone();
                        tauri::async_runtime::spawn(async move {
                            commands::system::logging::restore_log_level(&lvl_pool).await;
                        });
                        // F122: close work-time sessions left open past their local day.
                        let wt_pool = auto_pool.clone();
                        tauri::async_runtime::spawn(async move {
                            loop {
                                if let Err(e) =
                                    commands::admin::work_time::reconcile_all_stale_sessions(&wt_pool).await
                                {
                                    tracing::warn!(target: "medoc::system", event = "WORK_TIME_SWEEP_FAILED", error = %e);
                                }
                                tokio::time::sleep(std::time::Duration::from_secs(15 * 60)).await;
                            }
                        });
                    });

                    // NFA-SEC-05: automatic daily backup. Checked every 30 minutes (and shortly
                    // after start), so a practice that closes the app every evening still gets
                    // its backup; the old 24 h interval restarted with every launch and never ran.
                    // Compressed + encrypted, rotated to 3 daily, 1 weekly, 1 half-yearly.
                    let backup_pool = pool.clone();
                    let backup_app = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                        loop {
                            if let Ok(app_dir) = commands::app_data_dir(&backup_app) {
                                match infrastructure::backup::run_scheduled_if_due(&backup_pool, &app_dir).await {
                                    Ok(Some(p)) => tracing::info!(
                                        target: "medoc::system",
                                        event = "BACKUP_AUTO_OK",
                                        path = %p.display()
                                    ),
                                    Ok(None) => {}
                                    Err(e) => tracing::error!(
                                        target: "medoc::system",
                                        event = "BACKUP_AUTO_FAIL",
                                        error = %e
                                    ),
                                }
                            }
                            tokio::time::sleep(std::time::Duration::from_secs(30 * 60)).await;
                        }
                    });
                }
                Err(e) => {
                    tracing::error!(target: "medoc::system", event = "DB_INIT_FAILED", error = %e);
                    let msg = e.to_string();
                    if msg.contains("already running") || msg.contains("in use") {
                        eprintln!("{msg}");
                        std::process::exit(0);
                    }
                    return Err(format!("Database initialisation failed: {e}").into());
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
                    let dock_name = replica_desktop_name.unwrap_or("MeDoc");
                    set_macos_desktop_name(dock_name);
                    let _ = w.show();
                    let _ = w.unminimize();
                    if let Err(e) = w.set_focus() {
                        tracing::warn!(
                            target: "medoc::system",
                            event = "MAC_WINDOW_FOCUS",
                            error = %e
                        );
                    }
                } else {
                    tracing::warn!(target: "medoc::system", event = "MAC_WINDOW_MAIN_NOT_FOUND");
                }
            }
            #[cfg(not(target_os = "macos"))]
            {
                let _ = replica_desktop_name;
                // Windows / Linux: the app draws its own unified title bar with window buttons
                // (WindowControls), like the macOS overlay. Drop the native frame so there is one bar.
                if let Some(w) = app_handle.get_webview_window("main") {
                    if let Err(e) = w.set_decorations(false) {
                        tracing::warn!(target: "medoc::system", event = "WINDOW_DECORATIONS_OFF_FAILED", error = %e);
                    }
                    // Without a frame Windows also drops the drop shadow; keep it so the window stays distinct.
                    #[cfg(target_os = "windows")]
                    if let Err(e) = w.set_shadow(true) {
                        tracing::warn!(target: "medoc::system", event = "WINDOW_SHADOW_FAILED", error = %e);
                    }
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
