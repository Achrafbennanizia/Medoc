//! Integration: apply install_plan writes deployment + locale.

use medoc_core::infrastructure::database::app_kv_repo;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::install_plan::{
    DiscoverMode, InstallPlan, InstallRole, APP_KV_INSTALL_PLAN_PROVISIONING,
};
use medoc_sync::cluster::services::apply_install_plan;
use medoc_sync::deployment::APP_KV_DEPLOYMENT_KEY;
use medoc_sync::schema::ensure_sync_tables;

async fn fresh_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    ensure_sync_tables(&pool).await.expect("sync schema");
    pool
}

#[tokio::test]
async fn apply_install_plan_sets_deployment_and_locale() {
    let pool = fresh_pool().await;

    let mut plan = InstallPlan::new_master("Integration Master");
    plan.locale = "de".into();
    plan.discover.window_minutes = 45;

    let result = apply_install_plan(&pool, &plan).await.unwrap();
    assert!(result.applied);
    assert_eq!(result.locale.as_deref(), Some("de"));

    let dep_raw = app_kv_repo::get(&pool, APP_KV_DEPLOYMENT_KEY)
        .await
        .unwrap()
        .unwrap();
    assert!(dep_raw.contains("serverless_peer"));
    assert!(dep_raw.contains("MASTER"));

    let prefs = app_kv_repo::get(&pool, "practice.preferences.v1")
        .await
        .unwrap()
        .unwrap();
    assert!(prefs.contains("\"locale\":\"de\""));

    let prov = app_kv_repo::get(&pool, APP_KV_INSTALL_PLAN_PROVISIONING)
        .await
        .unwrap();
    assert!(prov.is_some());
}

#[tokio::test]
async fn apply_install_plan_replica_fixed_url() {
    let pool = fresh_pool().await;

    let mut plan = InstallPlan::new_master("Replica");
    plan.role = InstallRole::Replica;
    plan.discover.mode = DiscoverMode::Fixed;
    plan.discover.address = "10.0.0.5".into();
    plan.discover.port = 8787;

    apply_install_plan(&pool, &plan).await.unwrap();
    let dep_raw = app_kv_repo::get(&pool, APP_KV_DEPLOYMENT_KEY)
        .await
        .unwrap()
        .unwrap();
    assert!(dep_raw.contains("https://10.0.0.5:8787"));
    assert!(dep_raw.contains("REPLICA"));
}

#[tokio::test]
async fn consume_sidecar_then_gone() {
    let pool = fresh_pool().await;
    let dir = std::env::temp_dir().join(format!("medoc-sidecar-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("install_plan.pending.json");

    let plan = InstallPlan::new_master("Sidecar Master");
    medoc_core::infrastructure::usb_vault::write_sidecar_plan(&plan, &path).unwrap();
    assert!(path.exists());

    let result = medoc_sync::cluster::services::consume_pending_sidecar_and_apply(&pool, &path)
        .await
        .unwrap()
        .expect("applied");
    assert!(result.applied);
    assert!(!path.exists());

    let dep_raw = app_kv_repo::get(&pool, APP_KV_DEPLOYMENT_KEY)
        .await
        .unwrap()
        .unwrap();
    assert!(dep_raw.contains("MASTER"));
    let _ = std::fs::remove_dir_all(dir);
}
