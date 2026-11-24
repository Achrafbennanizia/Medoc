//! `edition_info`: the edition, flavor and capabilities this binary was built with.
//! Needs no state, so the UI can check it before anything else at start.

use crate::edition::{self, EditionInfo};

#[tauri::command]
pub fn edition_info() -> EditionInfo {
    edition::info()
}
