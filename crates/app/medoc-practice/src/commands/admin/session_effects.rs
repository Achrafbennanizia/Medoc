//! What happens around signing in and out, apart from the session itself: the link to the main
//! device (replicas) and recording work time at sign-out.

use sqlx::SqlitePool;

use crate::systems::main_device;

/// After a successful local sign-in. Links to the main device in the background so a slow or
/// offline main device never delays the sign-in.
pub fn after_sign_in(pool: &SqlitePool, email: &str, password: &str) {
    let (pool, email, password) = (pool.clone(), email.to_string(), password.to_string());
    tauri::async_runtime::spawn(async move {
        main_device::establish_link(&pool, &email, &password).await;
    });
}

/// After the session is ended: drop the main-device token and end an open work-time entry
/// when the person asked for that.
pub async fn after_sign_out(pool: &SqlitePool, user_id: Option<&str>) {
    main_device::clear_link();
    let Some(user_id) = user_id else { return };
    if let Ok(pref) =
        crate::commands::admin::work_time::get_or_create_preference(pool, user_id).await
    {
        if pref.auto_record_on_logout {
            let _ = crate::commands::admin::work_time::end_open_session_for_user(
                pool, user_id, "logout",
            )
            .await;
        }
    }
}
