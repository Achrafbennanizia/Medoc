//! Native OS menu bar (Windows menu bar / Linux / macOS menu bar).
//! Dispatches actions to the WebView via the `app-menu` event.
//!
//! Menu contents are driven by the frontend (`sync_native_menu`) so RBAC matches the UI.

use serde_json::json;
use tauri::menu::{Menu, MenuBuilder, MenuEvent, MenuItem, MenuItemBuilder, PredefinedMenuItem, Submenu, SubmenuBuilder};
use tauri::{App, AppHandle, Emitter, Manager, PackageInfo, Runtime};

/// Sentinel path in go-items: inserts a separator in „Gehe zu“.
pub(crate) const GO_MENU_SEP_PATH: &str = "__sep__";

#[derive(Debug, Clone, serde::Deserialize)]
pub struct NativeGoMenuItem {
    pub path: String,
    pub label: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeFileNewGate {
    pub termin: bool,
    pub patient: bool,
    pub zahlung: bool,
    pub bestellung: bool,
    pub leistung: bool,
    pub bilanz: bool,
}

impl Default for NativeFileNewGate {
    fn default() -> Self {
        Self {
            termin: false,
            patient: false,
            zahlung: false,
            bestellung: false,
            leistung: false,
            bilanz: false,
        }
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncNativeMenuPayload {
    pub go_items: Vec<NativeGoMenuItem>,
    pub file_new: NativeFileNewGate,
    pub help_show_datenschutz: bool,
    pub view_show_calendar: bool,
}

impl Default for SyncNativeMenuPayload {
    fn default() -> Self {
        Self {
            go_items: vec![],
            file_new: NativeFileNewGate::default(),
            help_show_datenschutz: true,
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
    let mut go_builder = SubmenuBuilder::new(manager, "Gehe zu");
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

fn build_datei_submenu<R: Runtime, M: Manager<R>>(
    manager: &M,
    gates: &NativeFileNewGate,
) -> tauri::Result<Submenu<R>> {
    let mut items: Vec<MenuItem<R>> = Vec::new();

    if gates.termin {
        items.push(
            MenuItemBuilder::with_id("menu_new_termin", "Neuer Termin …")
                .accelerator("CmdOrCtrl+N")
                .build(manager)?,
        );
    }
    if gates.patient {
        items.push(MenuItemBuilder::with_id("menu_new_patient", "Neuer Patient …").build(manager)?);
    }
    if gates.zahlung {
        items.push(MenuItemBuilder::with_id("menu_new_zahlung", "Neue Zahlung …").build(manager)?);
    }
    if gates.bestellung {
        items.push(MenuItemBuilder::with_id("menu_new_bestellung", "Neue Bestellung …").build(manager)?);
    }
    if gates.leistung {
        items.push(MenuItemBuilder::with_id("menu_new_leistung", "Neue Leistung …").build(manager)?);
    }
    if gates.bilanz {
        items.push(MenuItemBuilder::with_id("menu_new_bilanz", "Neuer Bilanz-Eintrag …").build(manager)?);
    }

    #[cfg(target_os = "macos")]
    if items.is_empty() {
        items.push(
            MenuItemBuilder::with_id("menu_file_placeholder", "(Keine neuen Einträge für diese Rolle)")
                .enabled(false)
                .build(manager)?,
        );
    }

    let mut b = SubmenuBuilder::new(manager, "Datei");
    for it in &items {
        b = b.item(it);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let quit_app = MenuItemBuilder::with_id("menu_quit", "Beenden")
            .accelerator("CmdOrCtrl+Q")
            .build(manager)?;
        if !items.is_empty() {
            b = b.separator();
        }
        b = b.item(&quit_app);
    }

    b.build()
}

fn build_full_menu<R: Runtime, M: Manager<R>>(
    manager: &M,
    pkg: &PackageInfo,
    payload: &SyncNativeMenuPayload,
) -> tauri::Result<Menu<R>> {
    let go_menu = build_go_submenu(manager, &payload.go_items)?;
    let file_menu = build_datei_submenu(manager, &payload.file_new)?;

    let termin_tag = MenuItemBuilder::with_id("menu_termin_view_tag", "Kalender: Tag").build(manager)?;
    let termin_woche = MenuItemBuilder::with_id("menu_termin_view_woche", "Kalender: Woche").build(manager)?;
    let termin_monat = MenuItemBuilder::with_id("menu_termin_view_monat", "Kalender: Monat").build(manager)?;
    let termin_heute = MenuItemBuilder::with_id("menu_termin_today", "Kalender: Heute").build(manager)?;
    let termin_prev = MenuItemBuilder::with_id("menu_termin_nav_prev", "Kalender: Zeitraum zurück").build(manager)?;
    let termin_next = MenuItemBuilder::with_id("menu_termin_nav_next", "Kalender: Zeitraum vor").build(manager)?;

    let palette = MenuItemBuilder::with_id("menu_app_command_palette", "Befehlspalette …")
        .accelerator("CmdOrCtrl+K")
        .build(manager)?;
    let zoom_in = MenuItemBuilder::with_id("menu_app_zoom_in", "Vergrößern")
        .accelerator("CmdOrCtrl+=")
        .build(manager)?;
    let zoom_out = MenuItemBuilder::with_id("menu_app_zoom_out", "Verkleinern")
        .accelerator("CmdOrCtrl+-")
        .build(manager)?;
    let zoom_reset = MenuItemBuilder::with_id("menu_app_zoom_reset", "Zoom zurücksetzen")
        .accelerator("CmdOrCtrl+0")
        .build(manager)?;
    let reload = MenuItemBuilder::with_id("menu_app_reload", "Ansicht neu laden")
        .accelerator("CmdOrCtrl+R")
        .build(manager)?;

    let view_menu = if payload.view_show_calendar {
        SubmenuBuilder::new(manager, "Ansicht")
            .item(&termin_tag)
            .item(&termin_woche)
            .item(&termin_monat)
            .separator()
            .item(&termin_heute)
            .item(&termin_prev)
            .item(&termin_next)
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
        SubmenuBuilder::new(manager, "Ansicht")
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

    let window_menu = SubmenuBuilder::new(manager, "Fenster")
        .item(&win_min)
        .item(&win_max)
        .item(&win_fs)
        .separator()
        .item(&win_close)
        .build()?;

    let help_shortcuts = MenuItemBuilder::with_id("menu_help_shortcuts", "Hilfe & Kurzbefehle …").build(manager)?;
    let help_calendar = MenuItemBuilder::with_id(
        "menu_help_calendar",
        "Kalender: Bedienung & Mausgesten …",
    )
    .build(manager)?;
    let help_page = MenuItemBuilder::with_id("menu_help_open_page", "Hilfe-Themen im Browser …").build(manager)?;
    let help_feedback = MenuItemBuilder::with_id("menu_help_feedback", "Feedback …").build(manager)?;
    let help_privacy = MenuItemBuilder::with_id("menu_help_privacy", "Datenschutz …").build(manager)?;
    let help_about = MenuItemBuilder::with_id("menu_help_about", "Über MeDoc").build(manager)?;

    let mut help_b = SubmenuBuilder::new(manager, "Hilfe").item(&help_shortcuts);
    if payload.view_show_calendar {
        help_b = help_b.item(&help_calendar);
    }
    help_b = help_b.separator().item(&help_page).item(&help_feedback);
    let help_menu = if payload.help_show_datenschutz {
        help_b.item(&help_privacy).separator().item(&help_about).build()?
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

    let edit_menu = SubmenuBuilder::new(manager, "Bearbeiten")
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
        .items(&[&file_menu, &edit_menu, &go_menu, &view_menu, &window_menu, &help_menu])
        .build()?;

    Ok(menu)
}

/// Build and attach the application menu. Safe to call once during setup.
pub fn install_native_menu(app: &mut App) -> tauri::Result<()> {
    let pkg = app.package_info();
    let menu = build_full_menu(app, &pkg, &SyncNativeMenuPayload::default())?;
    let _ = app.set_menu(menu)?;
    Ok(())
}

/// Rebuild the full menu bar from a frontend payload (RBAC-aligned).
pub fn set_native_menu<R: Runtime>(app: &AppHandle<R>, payload: SyncNativeMenuPayload) -> tauri::Result<()> {
    let pkg = app.package_info();
    let menu = build_full_menu(app, &pkg, &payload)?;
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
        "menu_new_termin" => emit_menu(app, json!({ "kind": "navigate", "path": "/termine/neu" })),
        "menu_new_patient" => emit_menu(app, json!({ "kind": "navigate", "path": "/patienten/neu" })),
        "menu_new_zahlung" => emit_menu(app, json!({ "kind": "navigate", "path": "/finanzen/neu" })),
        "menu_new_bestellung" => emit_menu(app, json!({ "kind": "navigate", "path": "/bestellungen/neu" })),
        "menu_new_leistung" => emit_menu(app, json!({ "kind": "navigate", "path": "/leistungen/neu" })),
        "menu_new_bilanz" => emit_menu(app, json!({ "kind": "navigate", "path": "/bilanz/neu" })),

        "menu_termin_view_tag" => emit_menu(app, json!({ "kind": "termin", "action": "view_tag" })),
        "menu_termin_view_woche" => emit_menu(app, json!({ "kind": "termin", "action": "view_woche" })),
        "menu_termin_view_monat" => emit_menu(app, json!({ "kind": "termin", "action": "view_monat" })),
        "menu_termin_today" => emit_menu(app, json!({ "kind": "termin", "action": "today" })),
        "menu_termin_nav_prev" => emit_menu(app, json!({ "kind": "termin", "action": "nav_prev" })),
        "menu_termin_nav_next" => emit_menu(app, json!({ "kind": "termin", "action": "nav_next" })),

        "menu_app_command_palette" => emit_menu(app, json!({ "kind": "app", "action": "command_palette" })),
        "menu_app_zoom_in" => emit_menu(app, json!({ "kind": "app", "action": "zoom_in" })),
        "menu_app_zoom_out" => emit_menu(app, json!({ "kind": "app", "action": "zoom_out" })),
        "menu_app_zoom_reset" => emit_menu(app, json!({ "kind": "app", "action": "zoom_reset" })),
        "menu_app_reload" => emit_menu(app, json!({ "kind": "app", "action": "reload" })),

        "menu_help_shortcuts" => emit_menu(app, json!({ "kind": "help", "topic": "shortcuts" })),
        "menu_help_calendar" => emit_menu(app, json!({ "kind": "help", "topic": "calendar" })),
        "menu_help_open_page" => emit_menu(app, json!({ "kind": "navigate", "path": "/hilfe" })),
        "menu_help_feedback" => emit_menu(app, json!({ "kind": "navigate", "path": "/feedback" })),
        "menu_help_privacy" => emit_menu(app, json!({ "kind": "navigate", "path": "/datenschutz" })),
        "menu_help_about" => emit_menu(app, json!({ "kind": "help", "topic": "about", "version": ver })),

        "menu_quit" => std::process::exit(0),
        _ => {}
    }
}
