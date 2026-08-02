//! Process restart and network service shutdown for destructive ops (license clear, cluster reset).

use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Manager};

/// Full process restart — required after license clear or cluster reset.
pub fn schedule_app_restart(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(450)).await;
        tracing::info!(
            target: "medoc::app",
            event = "APP_RESTART_SCHEDULED"
        );
        app.restart();
    });
}

/// Stop cluster (Verbund) listener and LAN server before wiping network state.
pub async fn stop_network_services(app: &AppHandle) {
    if let Some(listener) =
        app.try_state::<crate::commands::network::verbund::VerbundListenerControl>()
    {
        listener.stop().await;
    }
    stop_lan_server_if_running(app).await;
}

pub async fn stop_lan_server_if_running(app: &AppHandle) {
    if let Some(lan) = app.try_state::<crate::commands::lan_commands::LanServerControl>() {
        stop_lan_server(&lan).await;
    }
}

async fn stop_lan_server(control: &crate::commands::lan_commands::LanServerControl) {
    let rt = {
        let mut g = control.0.lock().unwrap_or_else(|e| e.into_inner());
        g.runtime.take()
    };
    if let Some(rt) = rt {
        rt.shutdown.store(true, Ordering::SeqCst);
        let _ = tokio::time::timeout(Duration::from_secs(6), rt.http_task).await;
        let _ = tokio::time::timeout(Duration::from_secs(2), rt.udp_task).await;
    }
}
