//! A pasted v2 sealed for another computer is rejected. A valid key can be activated again.

mod support;

use medoc_core::infrastructure::database::repos::admin::license as license_repo;
use medoc_core::infrastructure::license::mint_dev_v2_license_envelope;
use medoc_practice::commands::network::company_portal::resolve_onboarding_license_key_with;
use medoc_sync::cluster::services::activate_cluster_license;
use support::fresh_pool;

#[tokio::test]
async fn a_foreign_v2_is_not_rebound_to_this_device() {
    let pool = fresh_pool().await;
    let foreign = mint_dev_v2_license_envelope("other-device-not-this-one", "elsewhere", "PRO")
        .expect("mint");
    let resolved = resolve_onboarding_license_key_with(&pool, &foreign, true)
        .await
        .expect("resolve");
    assert_eq!(resolved, foreign);
    let err = activate_cluster_license(&pool, "onboarding", &resolved)
        .await
        .expect_err("reject");
    assert_eq!(err.to_string(), "error.license.wrong_device");
}

#[tokio::test]
async fn production_rejects_a_foreign_v2_with_wrong_device_code() {
    let pool = fresh_pool().await;
    let foreign = mint_dev_v2_license_envelope("other-device-not-this-one", "elsewhere", "PRO")
        .expect("mint");
    let resolved = resolve_onboarding_license_key_with(&pool, &foreign, false)
        .await
        .expect("resolve");
    assert_eq!(resolved, foreign);
    let err = activate_cluster_license(&pool, "onboarding", &resolved)
        .await
        .expect_err("reject");
    assert_eq!(err.to_string(), "error.license.wrong_device");
}

#[tokio::test]
async fn a_valid_license_can_be_activated_twice() {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join(format!("medoc-license-audit-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir).expect("audit dir");
    medoc_core::infrastructure::database::repos::admin::audit::init_audit_hmac_key(&dir)
        .expect("audit");

    let pool = fresh_pool().await;
    let local = license_repo::ensure_device_id(&pool).await.expect("device");
    let key = mint_dev_v2_license_envelope(&local, "dev-local", "PRO").expect("mint");
    let first = activate_cluster_license(&pool, "onboarding", &key)
        .await
        .expect("first");
    assert!(first.licensed);
    let second = activate_cluster_license(&pool, "onboarding", &key)
        .await
        .expect("second");
    assert!(second.licensed);
}
