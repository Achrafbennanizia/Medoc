//! Native OS menu bar (Windows menu bar / Linux / macOS menu bar).
//! Dispatches actions to the WebView via the `app-menu` event.
//!
//! Menu contents are driven by the frontend (`sync_native_menu`) so RBAC matches the UI.

use serde_json::json;
use tauri::menu::{
    Menu, MenuBuilder, MenuEvent, MenuItem, MenuItemBuilder, PredefinedMenuItem, Submenu,
    SubmenuBuilder,
};
use tauri::{App, AppHandle, Emitter, Manager, PackageInfo, Runtime};

/// Sentinel path in go-items: inserts a separator in the "Go to" submenu.
pub(crate) const GO_MENU_SEP_PATH: &str = "__sep__";

#[derive(Debug, Clone, serde::Deserialize)]
pub struct NativeGoMenuItem {
    pub path: String,
    pub label: String,
}

#[derive(Debug, Clone, Default, serde::Deserialize)]
pub struct NativeFileNewGate {
    pub appointment: bool,
    pub patient: bool,
    pub payment: bool,
    pub purchase_order: bool,
    pub service_item: bool,
    pub balance_sheet: bool,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNativeMenuPayload {
    pub go_items: Vec<NativeGoMenuItem>,
    pub file_new: NativeFileNewGate,
    pub help_show_privacy: bool,
    pub view_show_calendar: bool,
}

impl Default for SyncNativeMenuPayload {
    fn default() -> Self {
        Self {
            go_items: vec![],
            file_new: NativeFileNewGate::default(),
            help_show_privacy: true,
            view_show_calendar: true,
        }
    }
}

fn emit_menu<R: Runtime>(app: &AppHandle<R>, payload: serde_json::Value) {
    let wins = app.webview_windows();
    if wins.is_empty() {
        if let Err(e) = app.emit("app-menu", payload) {
            tracing::warn!(target: "medoc::native_menu", event = "APP_MENU_EMIT_EMPTY_WEBVIEWS", error = %e);
        }
        return;
    }
    let mut any_ok = false;
    for (_label, w) in wins.iter() {
        if w.emit("app-menu", payload.clone()).is_ok() {
            any_ok = true;
        }
    }
    if !any_ok {
        tracing::warn!(target: "medoc::native_menu", event = "APP_MENU_WEBVIEW_EMIT_FALLBACK");
        let _ = app.emit("app-menu", payload);
    }
}

fn encode_go_path_fragment(path: &str) -> String {
    if path == "/" || path.is_empty() {
        return "__root__".to_string();
    }
    path.trim_start_matches('/').replace('/', "::")
}

fn go_menu_item_id(path: &str) -> String {
    format!("menu_go::{}", encode_go_path_fragment(path))
}

fn path_from_go_menu_id(id: &str) -> Option<String> {
    let rest = id.strip_prefix("menu_go::")?;
    if rest == "__root__" {
        return Some("/".into());
    }
    if rest.is_empty() {
        return None;
    }
    Some(format!("/{}", rest.replace("::", "/")))
}

fn build_go_submenu<R: Runtime, M: Manager<R>>(
    manager: &M,
    go_items: &[NativeGoMenuItem],
) -> tauri::Result<Submenu<R>> {
    let mut go_builder = SubmenuBuilder::new(manager, "Go");
    for row in go_items {
        if row.path == GO_MENU_SEP_PATH {
            go_builder = go_builder.separator();
            continue;
        }
        let id = go_menu_item_id(&row.path);
        let label = row.label.trim();
        if label.is_empty() {
            continue;
        }
        let mi = MenuItemBuilder::with_id(id, label).build(manager)?;
        go_builder = go_builder.item(&mi);
    }
    go_builder.build()
}

fn build_file_submenu<R: Runtime, M: Manager<R>>(
    manager: &M,
    gates: &NativeFileNewGate,
) -> tauri::Result<Submenu<R>> {
    let mut new_items: Vec<MenuItem<R>> = Vec::new();

    if gates.appointment {
        new_items.push(
            MenuItemBuilder::with_id("menu_new_appointment", "New Appointment…")
                .accelerator("CmdOrCtrl+N")
                .build(manager)?,
        );
    }
    if gates.patient {
        new_items
            .push(MenuItemBuilder::with_id("menu_new_patient", "New Patient…").build(manager)?);
    }
    if gates.payment {
        new_items
            .push(MenuItemBuilder::with_id("menu_new_payment", "New Payment…").build(manager)?);
    }
    if gates.purchase_order {
        new_items.push(
            MenuItemBuilder::with_id("menu_new_purchase_order", "New Purchase Order…").build(manager)?,
        );
    }
    if gates.service_item {
        new_items
            .push(MenuItemBuilder::with_id("menu_new_service_item", "New Service…").build(manager)?);
    }
    if gates.balance_sheet {
        new_items.push(
            MenuItemBuilder::with_id("menu_new_balance_sheet", "New Balance Sheet Entry…").build(manager)?,
        );
    }

    let print_item = MenuItemBuilder::with_id("menu_file_print", "Print…")
        .accelerator("CmdOrCtrl+P")
        .build(manager)?;

    #[cfg(target_os = "macos")]
    let role_placeholder: Option<MenuItem<R>> = if new_items.is_empty() {
        Some(
            MenuItemBuilder::with_id(
                "menu_file_placeholder",
                "(No new items for this role)",
            )
            .enabled(false)
            .build(manager)?,
        )
    } else {
        None
    };

    let mut b = SubmenuBuilder::new(manager, "File");
    for it in &new_items {
        b = b.item(it);
    }
    if !new_items.is_empty() {
        b = b.separator();
    }
    b = b.item(&print_item);

    #[cfg(target_os = "macos")]
    if let Some(ph) = role_placeholder {
        b = b.separator();
        b = b.item(&ph);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let quit_app = MenuItemBuilder::with_id("menu_quit", "Quit")
            .accelerator("CmdOrCtrl+Q")
            .build(manager)?;
        b = b.separator();
        b = b.item(&quit_app);
    }

    b.build()
}

#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
fn build_full_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    pkg: &PackageInfo,
    payload: &SyncNativeMenuPayload,
) -> tauri::Result<Menu<R>> {
    let go_menu = build_go_submenu(manager, &payload.go_items)?;
    let file_menu = build_file_submenu(manager, &payload.file_new)?;

    let appointment_tag =
        MenuItemBuilder::with_id("menu_appointment_view_day", "Calendar: Day").build(manager)?;
    let appointment_week =
        MenuItemBuilder::with_id("menu_appointment_view_week", "Calendar: Week").build(manager)?;
    let appointment_month =
        MenuItemBuilder::with_id("menu_appointment_view_month", "Calendar: Month").build(manager)?;
    let appointment_today =
        MenuItemBuilder::with_id("menu_appointment_today", "Calendar: Today").build(manager)?;
    let appointment_prev = MenuItemBuilder::with_id("menu_appointment_nav_prev", "Calendar: Previous period")
        .build(manager)?;
    let appointment_next = MenuItemBuilder::with_id("menu_appointment_nav_next", "Calendar: Next period")
        .build(manager)?;

    let palette = MenuItemBuilder::with_id("menu_app_command_palette", "Command Palette…")
        .accelerator("CmdOrCtrl+K")
        .build(manager)?;
    let zoom_in = MenuItemBuilder::with_id("menu_app_zoom_in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(manager)?;
    let zoom_out = MenuItemBuilder::with_id("menu_app_zoom_out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(manager)?;
    let zoom_reset = MenuItemBuilder::with_id("menu_app_zoom_reset", "Reset Zoom")
        .accelerator("CmdOrCtrl+0")
        .build(manager)?;
    let reload = MenuItemBuilder::with_id("menu_app_reload", "Reload View")
        .accelerator("CmdOrCtrl+R")
        .build(manager)?;

    let view_menu = if payload.view_show_calendar {
        SubmenuBuilder::new(manager, "View")
            .item(&appointment_tag)
            .item(&appointment_week)
            .item(&appointment_month)
            .separator()
            .item(&appointment_today)
            .item(&appointment_prev)
            .item(&appointment_next)
            .separator()
            .item(&palette)
            .separator()
            .item(&zoom_in)
            .item(&zoom_out)
            .item(&zoom_reset)
            .separator()
            .item(&reload)
            .build()?
    } else {
        SubmenuBuilder::new(manager, "View")
            .item(&palette)
            .separator()
            .item(&zoom_in)
            .item(&zoom_out)
            .item(&zoom_reset)
            .separator()
            .item(&reload)
            .build()?
    };

    let win_min = PredefinedMenuItem::minimize(manager, None)?;
    let win_max = PredefinedMenuItem::maximize(manager, None)?;
    let win_fs = PredefinedMenuItem::fullscreen(manager, None)?;
    let win_close = PredefinedMenuItem::close_window(manager, None)?;

    let window_menu = SubmenuBuilder::new(manager, "Window")
        .item(&win_min)
        .item(&win_max)
        .item(&win_fs)
        .separator()
        .item(&win_close)
        .build()?;

    let help_shortcuts =
        MenuItemBuilder::with_id("menu_help_shortcuts", "Help & Shortcuts…").build(manager)?;
    let help_calendar =
        MenuItemBuilder::with_id("menu_help_calendar", "Calendar: Controls & Gestures…")
            .build(manager)?;
    let help_page = MenuItemBuilder::with_id("menu_help_open_page", "Help Topics in Browser…")
        .build(manager)?;
    let help_feedback =
        MenuItemBuilder::with_id("menu_help_feedback", "Feedback …").build(manager)?;
    let help_privacy =
        MenuItemBuilder::with_id("menu_help_privacy", "Privacy …").build(manager)?;
    let help_about = MenuItemBuilder::with_id("menu_help_about", "About MeDoc").build(manager)?;

    let mut help_b = SubmenuBuilder::new(manager, "Help").item(&help_shortcuts);
    if payload.view_show_calendar {
        help_b = help_b.item(&help_calendar);
    }
    help_b = help_b.separator().item(&help_page).item(&help_feedback);
    let help_menu = if payload.help_show_privacy {
        help_b
            .item(&help_privacy)
            .separator()
            .item(&help_about)
            .build()?
    } else {
        help_b.separator().item(&help_about).build()?
    };

    #[cfg(target_os = "macos")]
    let app_menu = {
        let name = pkg.name.as_str();
        SubmenuBuilder::new(manager, name)
            .about(None)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?
    };

    let edit_menu = SubmenuBuilder::new(manager, "Edit")
        .item(&PredefinedMenuItem::undo(manager, None)?)
        .item(&PredefinedMenuItem::redo(manager, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(manager, None)?)
        .item(&PredefinedMenuItem::copy(manager, None)?)
        .item(&PredefinedMenuItem::paste(manager, None)?)
        .item(&PredefinedMenuItem::select_all(manager, None)?)
        .build()?;

    #[cfg(target_os = "macos")]
    let menu = MenuBuilder::new(manager)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &go_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()?;

    #[cfg(not(target_os = "macos"))]
    let menu = MenuBuilder::new(manager)
        .items(&[
            &file_menu,
            &edit_menu,
            &go_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()?;

    Ok(menu)
}

/// Build and attach the application menu. Safe to call once during setup.
pub fn install_native_menu(app: &mut App) -> tauri::Result<()> {
    let pkg = app.package_info();
    let menu = build_full_menu(app, pkg, &SyncNativeMenuPayload::default())?;
    let _ = app.set_menu(menu)?;
    Ok(())
}

/// Rebuild the full menu bar from a frontend payload (RBAC-aligned).
pub fn set_native_menu<R: Runtime>(
    app: &AppHandle<R>,
    payload: SyncNativeMenuPayload,
) -> tauri::Result<()> {
    let pkg = app.package_info();
    let menu = build_full_menu(app, pkg, &payload)?;
    let _ = app.set_menu(menu)?;
    Ok(())
}

pub fn handle_menu_event<R: Runtime>(app: &tauri::AppHandle<R>, event: &MenuEvent) {
    let id = event.id().as_ref();
    let ver = app.package_info().version.to_string();

    if let Some(path) = path_from_go_menu_id(id) {
        emit_menu(app, json!({ "kind": "navigate", "path": path }));
        return;
    }

    match id {
        "menu_new_appointment" => emit_menu(app, json!({ "kind": "navigate", "path": "/appointments/new" })),
        "menu_new_patient" => {
            emit_menu(app, json!({ "kind": "navigate", "path": "/patients/new" }))
        }
        "menu_new_payment" => {
            emit_menu(app, json!({ "kind": "navigate", "path": "/finance/new" }))
        }
        "menu_new_purchase_order" => emit_menu(
            app,
            json!({ "kind": "navigate", "path": "/purchase-orders/new" }),
        ),
        "menu_new_service_item" => emit_menu(
            app,
            json!({ "kind": "navigate", "path": "/services/new" }),
        ),
        "menu_new_balance_sheet" => emit_menu(app, json!({ "kind": "navigate", "path": "/balance-sheet/new" })),

        "menu_file_print" => emit_menu(app, json!({ "kind": "app", "action": "print" })),

        "menu_appointment_view_day" => emit_menu(app, json!({ "kind": "appointment", "action": "view_day" })),
        "menu_appointment_view_week" => {
            emit_menu(app, json!({ "kind": "appointment", "action": "view_week" }))
        }
        "menu_appointment_view_month" => {
            emit_menu(app, json!({ "kind": "appointment", "action": "view_month" }))
        }
        "menu_appointment_today" => emit_menu(app, json!({ "kind": "appointment", "action": "today" })),
        "menu_appointment_nav_prev" => emit_menu(app, json!({ "kind": "appointment", "action": "nav_prev" })),
        "menu_appointment_nav_next" => emit_menu(app, json!({ "kind": "appointment", "action": "nav_next" })),

        "menu_app_command_palette" => {
            emit_menu(app, json!({ "kind": "app", "action": "command_palette" }))
        }
        "menu_app_zoom_in" => emit_menu(app, json!({ "kind": "app", "action": "zoom_in" })),
        "menu_app_zoom_out" => emit_menu(app, json!({ "kind": "app", "action": "zoom_out" })),
        "menu_app_zoom_reset" => emit_menu(app, json!({ "kind": "app", "action": "zoom_reset" })),
        "menu_app_reload" => emit_menu(app, json!({ "kind": "app", "action": "reload" })),

        "menu_help_shortcuts" => emit_menu(app, json!({ "kind": "help", "topic": "shortcuts" })),
        "menu_help_calendar" => emit_menu(app, json!({ "kind": "help", "topic": "calendar" })),
        "menu_help_open_page" => emit_menu(app, json!({ "kind": "navigate", "path": "/help" })),
        "menu_help_feedback" => emit_menu(app, json!({ "kind": "navigate", "path": "/feedback" })),
        "menu_help_privacy" => {
            emit_menu(app, json!({ "kind": "navigate", "path": "/privacy" }))
        }
        "menu_help_about" => emit_menu(
            app,
            json!({ "kind": "help", "topic": "about", "version": ver }),
        ),

        "menu_quit" => std::process::exit(0),
        _ => {}
    }
}
