//! Domain enums — generated from `config/enums.yaml` at build time (`cargo build`).

// NOTE on case-handling: SQLite columns store enum values in SCREAMING_UPPERCASE
// (`KONTROLLE`, `MAENNLICH`, …); the frontend sends uppercase strings. Rust variants
// use PascalCase. sqlx and serde need explicit `rename_all` / per-variant `rename`
// (see yaml) or Tauri commands fail to deserialize `art`/`geschlecht`/`status`.

include!(concat!(env!("OUT_DIR"), "/domain_enums_generated.rs"));

#[cfg(test)]
mod termin_status_serde_tests {
    use super::TerminStatus;

    #[test]
    fn nicht_erschienen_serializes_like_sqlite_check() {
        assert_eq!(
            serde_json::to_string(&TerminStatus::NichtErschienen).unwrap(),
            "\"NICHT_ERSCHIENEN\""
        );
    }
}
