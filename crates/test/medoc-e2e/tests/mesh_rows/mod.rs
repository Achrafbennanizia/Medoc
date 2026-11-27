//! Row counters shared by the mesh tests (split from `sync_mesh_harness.rs`).

pub(super) async fn count_id(pool: &sqlx::SqlitePool, table: &str, id: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"))
        .bind(id)
        .fetch_one(pool)
        .await
        .expect("count")
}

pub(super) async fn shared_staff_id(pool: &sqlx::SqlitePool) -> String {
    let preferred: Option<String> =
        sqlx::query_scalar("SELECT id FROM staff WHERE id = 'seed-physician-001'")
            .fetch_optional(pool)
            .await
            .expect("staff lookup");
    if let Some(id) = preferred {
        return id;
    }
    sqlx::query_scalar("SELECT id FROM staff ORDER BY id LIMIT 1")
        .fetch_one(pool)
        .await
        .expect("seed staff")
}
