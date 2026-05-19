//! Single source of truth for which `app_kv` keys exist and which RBAC permission guards writes.
//! Used by [`crate::commands::app_kv_commands`] and the LAN HTTP API (`lan_server::http`).

/// Returns `Some(permission_action)` for keys that may be written only by roles matching `rbac::allowed`.
/// `None` means the key is unknown (reject).
/// Reads (`get_app_kv`): any authenticated user may access whitelisted keys (same as Tauri commands).
pub fn permission_for_app_kv_key(key: &str) -> Option<&'static str> {
    match key {
        "praxis.arbeitszeiten.v1" | "praxis.sperrzeiten.v1" => Some("ops.system"),
        "praxis.preferences.v1" | "praxis.preferences-termin.v1" => Some("dashboard.read"),
        "export.path.v1" | "export.formats.v1" | "praxis.logo.v1" | "invoice.praxis.v1" => Some("dashboard.read"),
        "lan.server.config.v1" => Some("ops.system"),
        _ => None,
    }
}
