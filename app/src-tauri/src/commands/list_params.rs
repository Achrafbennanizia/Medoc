// Shared list/pagination/sort/filter parameter type for list_* commands.
//
// Tauri v2 deserialises camelCase fields by default (when struct fields use
// `#[serde(rename_all = "camelCase")]`). The matching FE shape lives in
// `app/src/lib/list-params.ts`.
//
// Hard rule: every server consumer MUST whitelist `sort_by` against a static
// allow-list to prevent SQL injection — never interpolate `sort_by` directly.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAX_PAGE_SIZE: u32 = 200;

#[derive(Debug, Default, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ListParams {
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub page_size: Option<u32>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub sort_by: Option<String>,
    #[serde(default)]
    pub sort_dir: Option<SortDir>,
    #[serde(default)]
    pub filter: Option<HashMap<String, FilterValue>>,
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SortDir {
    Asc,
    Desc,
}

impl SortDir {
    pub fn sql(&self) -> &'static str {
        match self {
            SortDir::Asc => "ASC",
            SortDir::Desc => "DESC",
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum FilterValue {
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Null,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T: Serialize> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

impl ListParams {
    /// Resolve to (limit, offset, sort_dir).
    pub fn page_size_clamped(&self) -> u32 {
        self.page_size
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAX_PAGE_SIZE)
    }

    pub fn page_one_based(&self) -> u32 {
        self.page.unwrap_or(1).max(1)
    }

    pub fn limit(&self) -> u32 {
        self.page_size_clamped()
    }

    pub fn offset(&self) -> u32 {
        (self.page_one_based() - 1) * self.page_size_clamped()
    }

    pub fn sort_dir_or(&self, default: SortDir) -> SortDir {
        self.sort_dir.unwrap_or(default)
    }

    /// Whitelist-validated sort column. Returns `default` if `sort_by` isn't allowed.
    pub fn sort_by_or<'a>(&self, allowed: &'a [&'a str], default: &'a str) -> &'a str {
        match &self.sort_by {
            Some(s) => allowed
                .iter()
                .copied()
                .find(|c| c.eq_ignore_ascii_case(s))
                .unwrap_or(default),
            None => default,
        }
    }
}
