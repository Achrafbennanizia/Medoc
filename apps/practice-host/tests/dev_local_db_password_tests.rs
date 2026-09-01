//! Verify documented dev credentials against the real app-data database (SQLCipher via medoc crate).
//! Requires `MEDOC_DEV_SEED=1` (same as `tools/dev-tauri.sh`) so seed accounts skip forced password change.
use medoc_lib::infrastructure::crypto;
use medoc_lib::infrastructure::database::connection::init_db_headless;

#[tokio::test]
#[ignore = "dev-only: requires local medoc.db seeded via tools/dev-tauri.sh with MEDOC_DEV_SEED=1"]
async fn seed_accounts_accept_password_123() {
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
    for email in ["ahmed@practice.de", "aya@practice.de"] {
        let (hash, pw_change): (String, i32) = sqlx::query_as(
            "SELECT password_hash, password_change_required FROM staff WHERE email = ?1",
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
            crypto::verify_password("password123", &hash).expect("verify"),
            "password123 must match stored hash for {email} (prefix={})",
            &hash[..hash.len().min(7)]
        );
    }
}

#[tokio::test]
#[ignore = "dev-only: dump local staff rows for login debugging"]
async fn inspect_local_staff_accounts() {
    std::env::set_var("MEDOC_DEV_SEED", "1");
    let app_dir = dirs::home_dir()
        .expect("home")
        .join("Library/Application Support/de.medoc.app");
    if !app_dir.join("medoc.db").exists() {
        eprintln!("skip: no local medoc.db");
        return;
    }
    let pool = init_db_headless(&app_dir)
        .await
        .expect("open local db (set MEDOC_DB_KEY like dev-tauri.sh)");

    #[derive(Debug)]
    struct Row {
        id: String,
        name: String,
        email: String,
        role: String,
        available: i32,
        password_change_required: i32,
        password123: bool,
    }

    let rows: Vec<(String, String, String, String, i32, String)> = sqlx::query_as(
        "SELECT id, name, email, role, available, password_hash FROM staff ORDER BY email COLLATE NOCASE",
    )
    .fetch_all(&pool)
    .await
    .expect("staff query");

    println!("\n=== local staff ({} rows) ===", rows.len());
    for (id, name, email, role, available, hash) in rows {
        let password123 = crypto::verify_password("password123", &hash).unwrap_or(false);
        let row = Row {
            id,
            name,
            email,
            role,
            available,
            password_change_required: 0,
            password123,
        };
        println!("{row:?}");
    }

    let kv: Vec<(String, String)> = sqlx::query_as(
        "SELECT key, substr(value, 1, 80) FROM app_kv WHERE key LIKE 'onboarding%' OR key LIKE 'license%' OR key LIKE 'migration.demo%' ORDER BY key",
    )
    .fetch_all(&pool)
    .await
    .expect("app_kv query");
    println!("\n=== onboarding/license kv ===");
    for (k, v) in kv {
        println!("{k}: {v}");
    }

    use medoc_lib::application::auth_service::{authenticate, LoginRequest};
    for email in ["ahmed@practice.de", "aya@practice.de"] {
        let req = LoginRequest {
            email: email.to_string(),
            password: "password123".to_string(),
            totp_code: None,
        };
        match authenticate(&pool, &req).await {
            Ok(s) => println!("authenticate OK: email={} role={}", s.email, s.role),
            Err(e) => println!("authenticate FAIL: email={email} err={e:?}"),
        }
    }
}
