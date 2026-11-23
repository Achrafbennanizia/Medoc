//! Performance probe on realistic volume (opt-in, not part of CI):
//!   cargo test -p medoc-core --test perf_probe -- --ignored --nocapture
//! Seeds the full demo year (1000 patients, 10k treatments/examinations, ~12k documents, a year
//! of appointments) into an encrypted file database, then reports:
//!   1. table sizes,
//!   2. foreign keys without an index starting with that column,
//!   3. timing (median of 5) and query plan of the queries behind the main screens.

use std::time::Instant;

use medoc_core::infrastructure::database::connection;
use sqlx::{Row, SqlitePool};

fn env_keys() {
    std::env::set_var(
        "MEDOC_DB_KEY",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    std::env::set_var(
        "MEDOC_VENDOR_PUBKEY",
        "79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32",
    );
    std::env::set_var("MEDOC_DEV_SEED", "1");
}

async fn scalar(pool: &SqlitePool, sql: &str) -> Option<String> {
    sqlx::query(sql)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<String, _>(0).ok())
}

async fn unindexed_foreign_keys(pool: &SqlitePool) -> Vec<String> {
    let tables: Vec<String> = sqlx::query_scalar(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_sqlx%'",
    )
    .fetch_all(pool)
    .await
    .unwrap();
    let mut out = Vec::new();
    for t in tables {
        let fks: Vec<String> = sqlx::query_scalar(&format!(
            "SELECT \"from\" FROM pragma_foreign_key_list('{t}')"
        ))
        .fetch_all(pool)
        .await
        .unwrap_or_default();
        for col in fks {
            // An index whose first column is the FK column (a primary key counts too).
            let n: i64 = sqlx::query_scalar(&format!(
                "SELECT COUNT(*) FROM pragma_index_list('{t}') il
                  JOIN pragma_index_info(il.name) ii ON ii.seqno = 0
                 WHERE ii.name = ?1"
            ))
            .bind(&col)
            .fetch_one(pool)
            .await
            .unwrap_or(0);
            if n == 0 {
                let rows: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{t}\""))
                    .fetch_one(pool)
                    .await
                    .unwrap_or(0);
                out.push(format!("{t}.{col} ({rows} rows)"));
            }
        }
    }
    out
}

async fn probe(pool: &SqlitePool, label: &str, sql: &str, binds: &[&str]) {
    let mut times = Vec::new();
    let mut rows = 0usize;
    for _ in 0..5 {
        let mut q = sqlx::query(sql);
        for b in binds {
            q = q.bind(*b);
        }
        let t = Instant::now();
        match q.fetch_all(pool).await {
            Ok(r) => rows = r.len(),
            Err(e) => {
                println!("  !! {label}: {e}");
                return;
            }
        }
        times.push(t.elapsed().as_secs_f64() * 1000.0);
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let explain = format!("EXPLAIN QUERY PLAN {sql}");
    let mut eq = sqlx::query(&explain);
    for b in binds {
        eq = eq.bind(*b);
    }
    let plan: Vec<String> = eq
        .fetch_all(pool)
        .await
        .map(|r| r.iter().map(|x| x.get::<String, _>("detail")).collect())
        .unwrap_or_default();
    let scans: Vec<&String> = plan
        .iter()
        .filter(|d| d.starts_with("SCAN") && !d.contains("USING"))
        .collect();
    let temp = plan.iter().any(|d| d.contains("TEMP B-TREE"));
    println!(
        "  {label:<44} {:>8.2} ms  {rows:>6} rows  {}{}",
        times[2],
        if scans.is_empty() {
            String::new()
        } else {
            format!("FULL SCAN {:?} ", scans)
        },
        if temp { "sort-in-temp" } else { "" }
    );
}

#[tokio::test]
#[ignore = "slow: seeds a full demo year"]
async fn perf_probe() {
    env_keys();
    let dir = std::env::temp_dir().join(format!("medoc-perf-{}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    let t = Instant::now();
    let pool = connection::init_db_headless(&dir).await.expect("init");
    println!("seed + migrations: {:.1} s", t.elapsed().as_secs_f64());

    println!("\n1. Table sizes");
    for t in [
        "patient",
        "appointment",
        "treatment",
        "examination",
        "prescription",
        "certificate",
        "payment",
        "issued_document",
        "audit_log",
        "practice_task",
        "dental_finding",
        "in_app_notification",
        "sync_outbox",
        "chart_attachment",
        "purchase_order",
    ] {
        let n: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{t}\""))
            .fetch_one(&pool)
            .await
            .unwrap_or(-1);
        println!("  {t:<24} {n:>8}");
    }

    println!("\n2. Foreign keys without an index");
    for f in unindexed_foreign_keys(&pool).await {
        println!("  {f}");
    }

    let pid = scalar(&pool, "SELECT p.id FROM patient p JOIN patient_chart c ON c.patient_id = p.id ORDER BY (SELECT COUNT(*) FROM treatment t WHERE t.chart_id = c.id) DESC LIMIT 1").await.unwrap_or_default();
    let cid = scalar(
        &pool,
        &format!("SELECT id FROM patient_chart WHERE patient_id = '{pid}'"),
    )
    .await
    .unwrap_or_default();
    let month_from = scalar(&pool, "SELECT date('now','start of month')")
        .await
        .unwrap();
    let month_to = scalar(
        &pool,
        "SELECT date('now','start of month','+1 month','-1 day')",
    )
    .await
    .unwrap();
    let staff = "seed-physician-001";

    println!("\n3. Queries behind the main screens (median of 5)");
    let q: &[(&str, &str, Vec<&str>)] = &[
        ("patients: list all (find_all)", "SELECT * FROM patient WHERE COALESCE(status,'ACTIVE') != 'ARCHIVED' ORDER BY name, id", vec![]),
        ("patients: search by name", "SELECT * FROM patient WHERE COALESCE(status,'ACTIVE') != 'ARCHIVED' AND (name LIKE ?1 OR insurance_number LIKE ?1) ORDER BY name", vec!["%ma%"]),
        ("appointments: all (find_all)", "SELECT * FROM appointment ORDER BY date DESC, time ASC", vec![]),
        ("appointments: one month", "SELECT * FROM appointment WHERE date >= ?1 AND date <= ?2 ORDER BY date, time", vec![month_from.as_str(), month_to.as_str()]),
        ("appointments: one patient", "SELECT * FROM appointment WHERE patient_id = ?1 ORDER BY date DESC", vec![pid.as_str()]),
        ("payments: all (find_all)", "SELECT * FROM payment ORDER BY created_at DESC", vec![]),
        ("payments: one patient", "SELECT * FROM payment WHERE patient_id = ?1 ORDER BY created_at DESC", vec![pid.as_str()]),
        ("chart: by patient", "SELECT * FROM patient_chart WHERE patient_id = ?1", vec![pid.as_str()]),
        ("treatments: one chart", "SELECT * FROM treatment WHERE chart_id = ?1 ORDER BY created_at DESC", vec![cid.as_str()]),
        ("examinations: one chart", "SELECT * FROM examination WHERE chart_id = ?1 ORDER BY created_at DESC", vec![cid.as_str()]),
        ("dental findings: one chart", "SELECT * FROM dental_finding WHERE chart_id = ?1", vec![cid.as_str()]),
        ("prescriptions: one patient", "SELECT * FROM prescription WHERE patient_id = ?1 ORDER BY issued_at DESC", vec![pid.as_str()]),
        ("certificates: one patient", "SELECT * FROM certificate WHERE patient_id = ?1 ORDER BY issued_at DESC", vec![pid.as_str()]),
        ("issued documents: one patient", "SELECT id FROM issued_document WHERE patient_id = ?1 ORDER BY issued_at DESC", vec![pid.as_str()]),
        ("audit log: latest 50", "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 50", vec![]),
        ("tasks: admin list", "SELECT * FROM practice_task ORDER BY datetime(updated_at) DESC LIMIT 200", vec![]),
        ("notifications: one user", "SELECT * FROM in_app_notification WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 100", vec![staff]),
    ];
    for (label, sql, binds) in q {
        probe(&pool, label, sql, binds).await;
    }
    let _ = std::fs::remove_dir_all(&dir);
}
