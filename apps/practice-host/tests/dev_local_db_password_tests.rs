//! Verify documented dev credentials against the real app-data database (SQLCipher via medoc crate).
//! Requires `MEDOC_DEV_SEED=1` (same as `tools/dev-tauri.sh`) so seed accounts skip forced password change.
use medoc_lib::infrastructure::crypto;
use medoc_lib::infrastructure::database::connection::init_db_headless;

#[tokio::test]
#[ignore = "dev-only: requires local medoc.db seeded via tools/dev-tauri.sh with MEDOC_DEV_SEED=1"]
async fn seed_accounts_accept_passwort123() {
    std::env::set_var("MEDOC_DEV_SEED", "1");
    let app_dir = dirs::home_dir()
        .expect("home")
        .join("Library/Application Support/de.medoc.app");
    if !app_dir.join("medoc.db").exists() {
        eprintln!("skip: no local medoc.db — launch tools/dev-tauri.sh first");
        return;
    }
    let pool = init_db_headless(&app_dir)
        .await
        .expect("open local db (set MEDOC_DB_KEY like dev-tauri.sh)");
    for email in ["ahmed@praxis.de", "aya@praxis.de"] {
        let (hash, pw_change): (String, i32) = sqlx::query_as(
            "SELECT passwort_hash, passwort_aendern_erforderlich FROM personal WHERE email = ?1",
        )
        .bind(email)
        .fetch_one(&pool)
        .await
        .unwrap_or_else(|_| panic!("missing {email}"));
        assert_eq!(
            pw_change, 0,
            "{email} should not require password change in dev seed"
        );
        assert!(
            crypto::verify_password("passwort123", &hash).expect("verify"),
            "passwort123 must match stored hash for {email} (prefix={})",
            &hash[..hash.len().min(7)]
        );
    }
}
