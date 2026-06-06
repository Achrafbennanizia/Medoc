use tauri::AppHandle;

use crate::infrastructure::app_menu::{set_native_menu, SyncNativeMenuPayload};

#[tauri::command]
pub fn sync_native_menu(app: AppHandle, payload: SyncNativeMenuPayload) -> Result<(), String> {
    set_native_menu(&app, payload).map_err(|e| e.to_string())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_menu_commands {
    () => {
        $crate::commands::menu_commands::sync_native_menu,
    };
}
