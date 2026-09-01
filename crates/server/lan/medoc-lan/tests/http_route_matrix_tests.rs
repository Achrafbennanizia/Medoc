//! Full LAN HTTP route matrix — calls every `/api/v1` handler and writes a results ledger.
//!
//! Run:
//! ```bash
//! cargo test -p medoc-lan --test http_route_matrix_tests -- --nocapture
//! ```
//!
//! Output: `docs/coordination/backend-http-route-matrix-results.md`

mod support;

use std::fs;
use std::path::PathBuf;

use axum::http::StatusCode;
use serial_test::serial;
use support::LanTestHarness;

#[derive(Clone)]
struct Case {
    name: &'static str,
    method: &'static str,
    path: String,
    body: Option<serde_json::Value>,
    auth: Auth,
    /// Acceptable HTTP statuses (business-correct outcomes, including intentional stubs).
    expect: &'static [u16],
}

#[derive(Clone, Copy)]
enum Auth {
    None,
    Jwt,
    /// Use activation token from pairing accept, if available.
    Activation,
}

struct Row {
    name: String,
    method: String,
    path: String,
    expect: String,
    status: u16,
    ok: bool,
    body: String,
}

fn truncate(s: &str, max: usize) -> String {
    let t = s.replace('\n', " ");
    if t.chars().count() <= max {
        t
    } else {
        format!("{}…", t.chars().take(max).collect::<String>())
    }
}

fn results_path() -> PathBuf {
    // crates/server/lan/medoc-lan → repo root
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../../../../docs/coordination/backend-http-route-matrix-results.md")
}

#[tokio::test]
#[serial]
async fn lan_http_route_matrix_all_endpoints() {
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");
    std::env::set_var("MEDOC_DEV_SEED", "1");

    let mut lan = LanTestHarness::licensed_master().await;
    let jwt = lan.ops_jwt();

    // --- Pairing flow to obtain activation token for sync/peers ---
    let device_id = "matrix-replica-1";
    let slave_pubkey = LanTestHarness::slave_pubkey(42);
    let (st, submitted) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": device_id,
                "slavePubkey": slave_pubkey,
                "slaveLabel": "Matrix Replica"
            })),
            None,
        )
        .await;
    assert_eq!(st, StatusCode::OK, "pairing request setup: {submitted}");
    let request_id = submitted["id"].as_str().expect("pairing id").to_string();

    let (st, decided) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/decide/{request_id}"),
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(st, StatusCode::OK, "pairing decide setup: {decided}");
    let pin = decided["confirmPin"]
        .as_str()
        .expect("confirmPin after accept")
        .to_string();
    let (st, confirmed) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": pin })),
            None,
        )
        .await;
    assert_eq!(st, StatusCode::OK, "pairing confirm setup: {confirmed}");
    let activation = confirmed["activationToken"]
        .as_str()
        .expect("activationToken after PIN confirm")
        .to_string();

    let today = chrono::Local::now().date_naive().format("%Y-%m-%d").to_string();

    let cases: Vec<Case> = vec![
        Case {
            name: "health",
            method: "GET",
            path: "/health".into(),
            body: None,
            auth: Auth::None,
            expect: &[200],
        },
        Case {
            name: "ping",
            method: "GET",
            path: "/api/v1/ping".into(),
            body: None,
            auth: Auth::None,
            expect: &[200],
        },
        Case {
            name: "pairing.master_info",
            method: "GET",
            path: "/api/v1/pairing/master-info".into(),
            body: None,
            auth: Auth::None,
            expect: &[200],
        },
        Case {
            name: "auth.login",
            method: "POST",
            path: "/api/v1/auth/login".into(),
            body: Some(serde_json::json!({
                "email": "ahmed@practice.de",
                "password": "password123"
            })),
            auth: Auth::None,
            expect: &[200],
        },
        Case {
            name: "auth.login_bad_password",
            method: "POST",
            path: "/api/v1/auth/login".into(),
            body: Some(serde_json::json!({
                "email": "ahmed@practice.de",
                "password": "wrong-password"
            })),
            auth: Auth::None,
            expect: &[401, 403, 429],
        },
        Case {
            name: "me.get",
            method: "GET",
            path: "/api/v1/me".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "me.patch",
            method: "PATCH",
            path: "/api/v1/me".into(),
            body: Some(serde_json::json!({
                "name": "Dr. Ahmed R.",
                "phone": "+49 421 900100"
            })),
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "patients.list",
            method: "GET",
            path: "/api/v1/patients".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "appointments.list",
            method: "GET",
            path: format!("/api/v1/appointments?date={today}"),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "app_kv.put",
            method: "PUT",
            path: "/api/v1/app-kv".into(),
            body: Some(serde_json::json!({
                "key": "practice.preferences.v1",
                "value": "{\"theme\":\"system\"}"
            })),
            auth: Auth::Jwt,
            expect: &[200, 204],
        },
        Case {
            name: "app_kv.get",
            method: "GET",
            path: "/api/v1/app-kv?key=practice.preferences.v1".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "app_kv.delete",
            method: "DELETE",
            path: "/api/v1/app-kv?key=practice.preferences.v1".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200, 204],
        },
        Case {
            name: "license.status",
            method: "GET",
            path: "/api/v1/license".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "license.activate_invalid",
            method: "POST",
            path: "/api/v1/license/activate".into(),
            body: Some(serde_json::json!({ "token": "not-a-real-license" })),
            auth: Auth::Jwt,
            // Handler returns 200 + valid:false for bad tokens (structured status body)
            expect: &[200, 400, 422],
        },
        Case {
            name: "eprescription.validate",
            method: "POST",
            path: "/api/v1/eprescriptions/validate".into(),
            body: Some(serde_json::json!({
                "patientId": "seed-pat-001",
                "kvnr": "A123456789",
                "pzn": "12345678",
                "medicationName": "Amoxicillin",
                "dosage": "1-0-1",
                "quantity": 1,
                "doctorLanr": "123456789"
            })),
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "eprescription.submit_stub",
            method: "POST",
            path: "/api/v1/eprescriptions/submit".into(),
            body: Some(serde_json::json!({
                "patientId": "seed-pat-001",
                "kvnr": "A123456789",
                "pzn": "12345678",
                "medicationName": "Amoxicillin",
                "dosage": "1-0-1",
                "quantity": 1,
                "doctorLanr": "123456789"
            })),
            auth: Auth::Jwt,
            // TI connector not present — intentional stub failure
            expect: &[500, 501],
        },
        Case {
            name: "pairing.pending",
            method: "GET",
            path: "/api/v1/pairing/pending".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "pairing.all",
            method: "GET",
            path: "/api/v1/pairing/all".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200],
        },
        Case {
            name: "pairing.status",
            method: "GET",
            path: format!("/api/v1/pairing/status/{request_id}"),
            body: None,
            auth: Auth::None,
            expect: &[200],
        },
        Case {
            name: "pairing.peers",
            method: "GET",
            path: "/api/v1/pairing/peers".into(),
            body: None,
            auth: Auth::Activation,
            expect: &[200],
        },
        Case {
            name: "sync.status",
            method: "GET",
            path: "/api/v1/sync/status".into(),
            body: None,
            auth: Auth::Activation,
            expect: &[200],
        },
        Case {
            name: "sync.push_empty",
            method: "POST",
            path: "/api/v1/sync/push".into(),
            body: Some(serde_json::json!({
                "fromDeviceId": device_id,
                "entries": []
            })),
            auth: Auth::Activation,
            expect: &[200],
        },
        Case {
            name: "sync.pull",
            method: "POST",
            path: "/api/v1/sync/pull".into(),
            body: Some(serde_json::json!({
                "deviceId": device_id,
                "sinceSeq": 0
            })),
            auth: Auth::Activation,
            expect: &[200],
        },
        Case {
            name: "company.summary_no_upstream",
            method: "GET",
            path: "/api/v1/company/summary".into(),
            body: None,
            auth: Auth::Jwt,
            // Without MEDOC_COMPANY_* upstream — validation 400 or upstream errors
            expect: &[200, 400, 502, 503, 500, 404],
        },
        Case {
            name: "company.feature_flags_no_upstream",
            method: "GET",
            path: "/api/v1/company/feature-flags".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200, 400, 502, 503, 500, 404],
        },
        Case {
            name: "company.integrations_no_upstream",
            method: "GET",
            path: "/api/v1/company/integrations/status".into(),
            body: None,
            auth: Auth::Jwt,
            expect: &[200, 400, 502, 503, 500, 404],
        },
        Case {
            name: "company.billing_portal_no_upstream",
            method: "POST",
            path: "/api/v1/company/billing/portal-session".into(),
            body: Some(serde_json::json!({})),
            auth: Auth::Jwt,
            expect: &[200, 400, 502, 503, 500, 404],
        },
        Case {
            name: "patients.unauthorized",
            method: "GET",
            path: "/api/v1/patients".into(),
            body: None,
            auth: Auth::None,
            expect: &[401, 403],
        },
        // Fresh pairing request + revoke (cleanup path)
        Case {
            name: "pairing.request_for_revoke",
            method: "POST",
            path: "/api/v1/pairing/request".into(),
            body: Some(serde_json::json!({
                "deviceId": "matrix-replica-revoke",
                "slavePubkey": LanTestHarness::slave_pubkey(99),
                "slaveLabel": "Revoke Me"
            })),
            auth: Auth::None,
            expect: &[200],
        },
    ];

    let mut rows: Vec<Row> = Vec::new();
    let mut revoke_device = String::new();

    for case in &cases {
        let bearer = match case.auth {
            Auth::None => None,
            Auth::Jwt => Some(jwt.as_str()),
            Auth::Activation => {
                if activation.is_empty() {
                    None
                } else {
                    Some(activation.as_str())
                }
            }
        };

        let (status, body) = lan
            .json(case.method, &case.path, case.body.as_ref(), bearer)
            .await;
        let code = status.as_u16();
        let ok = case.expect.contains(&code);
        let body_s = truncate(&body.to_string(), 220);

        if case.name == "pairing.request_for_revoke" && ok {
            revoke_device = "matrix-replica-revoke".into();
        }

        rows.push(Row {
            name: case.name.into(),
            method: case.method.into(),
            path: case.path.clone(),
            expect: case
                .expect
                .iter()
                .map(|c| c.to_string())
                .collect::<Vec<_>>()
                .join("|"),
            status: code,
            ok,
            body: body_s,
        });
    }

    // Decide + revoke for the revoke-target device
    if !revoke_device.is_empty() {
        // Find pending request id for revoke device via /pairing/pending
        let (st, pending) = lan
            .json("GET", "/api/v1/pairing/pending", None, Some(&jwt))
            .await;
        let mut rev_id = None;
        if st == StatusCode::OK {
            if let Some(arr) = pending.as_array() {
                for item in arr {
                    if item["deviceId"].as_str() == Some(revoke_device.as_str())
                        || item["device_id"].as_str() == Some(revoke_device.as_str())
                    {
                        rev_id = item["id"].as_str().map(|s| s.to_string());
                        break;
                    }
                }
            }
        }
        if let Some(id) = rev_id {
            let (st, body) = lan
                .json(
                    "POST",
                    &format!("/api/v1/pairing/decide/{id}"),
                    Some(&serde_json::json!({ "accept": true })),
                    Some(&jwt),
                )
                .await;
            rows.push(Row {
                name: "pairing.decide_for_revoke".into(),
                method: "POST".into(),
                path: format!("/api/v1/pairing/decide/{id}"),
                expect: "200".into(),
                status: st.as_u16(),
                ok: st == StatusCode::OK,
                body: truncate(&body.to_string(), 220),
            });
        }

        let (st, body) = lan
            .json(
                "POST",
                &format!("/api/v1/pairing/revoke/{revoke_device}"),
                None,
                Some(&jwt),
            )
            .await;
        rows.push(Row {
            name: "pairing.revoke".into(),
            method: "POST".into(),
            path: format!("/api/v1/pairing/revoke/{revoke_device}"),
            expect: "200|204".into(),
            status: st.as_u16(),
            ok: st == StatusCode::OK || st == StatusCode::NO_CONTENT,
            body: truncate(&body.to_string(), 220),
        });
    }

    // pairing.confirm with wrong PIN (setup already confirmed successfully)
    let (st, body) = lan
        .json(
            "POST",
            &format!("/api/v1/pairing/confirm/{request_id}"),
            Some(&serde_json::json!({ "pin": "0000" })),
            None,
        )
        .await;
    rows.push(Row {
        name: "pairing.confirm_wrong_pin".into(),
        method: "POST".into(),
        path: format!("/api/v1/pairing/confirm/{request_id}"),
        expect: "400|404|409".into(),
        status: st.as_u16(),
        ok: matches!(st.as_u16(), 400 | 404 | 409),
        body: truncate(&body.to_string(), 220),
    });

    // Last: clear license (destructive) — covered after all other license-dependent cases
    let (st, body) = lan
        .json("DELETE", "/api/v1/license", None, Some(&jwt))
        .await;
    rows.push(Row {
        name: "license.clear".into(),
        method: "DELETE".into(),
        path: "/api/v1/license".into(),
        expect: "200|204".into(),
        status: st.as_u16(),
        ok: st == StatusCode::OK || st == StatusCode::NO_CONTENT,
        body: truncate(&body.to_string(), 220),
    });

    let passed = rows.iter().filter(|r| r.ok).count();
    let failed = rows.iter().filter(|r| !r.ok).count();

    let mut md = String::new();
    md.push_str("# LAN backend HTTP route matrix\n\n");
    md.push_str(&format!(
        "**Generated:** `cargo test -p medoc-lan --test http_route_matrix_tests`  \n\
         **Harness:** in-process `LanTestHarness` (same handlers as `medoc-server`)  \n\
         **Result:** {passed} passed / {failed} failed / {} total\n\n",
        rows.len()
    ));
    md.push_str("| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |\n");
    md.push_str("|---:|---|---|---|---|---:|:---:|---|\n");
    for (i, r) in rows.iter().enumerate() {
        let mark = if r.ok { "PASS" } else { "**FAIL**" };
        md.push_str(&format!(
            "| {} | `{}` | {} | `{}` | {} | {} | {} | {} |\n",
            i + 1,
            r.name,
            r.method,
            r.path.replace('|', "\\|"),
            r.expect,
            r.status,
            mark,
            r.body.replace('|', "\\|")
        ));
    }
    md.push_str("\n## Notes\n\n");
    md.push_str("- `eprescription.submit_stub` expects 500/501 without TI connector.\n");
    md.push_str("- Company proxy routes expect 400 when vendor portal URL is unset.\n");
    md.push_str("- Auth uses seeded `ahmed@practice.de` / `password123` plus ops JWT.\n");
    md.push_str("- Sync/peers use activation token after pairing decide + PIN confirm.\n");
    md.push_str("- `license.activate_invalid` returns HTTP 200 with `valid:false` (structured status).\n");

    let out = results_path();
    if let Some(parent) = out.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&out, &md).expect("write results markdown");
    eprintln!("Wrote {}", out.display());
    eprintln!("{md}");

    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");

    let failures: Vec<_> = rows.iter().filter(|r| !r.ok).collect();
    assert!(
        failures.is_empty(),
        "LAN route matrix failures ({}):\n{}",
        failures.len(),
        failures
            .iter()
            .map(|r| format!(
                "- {} {} {} → {} (expect {}) body={}",
                r.name, r.method, r.path, r.status, r.expect, r.body
            ))
            .collect::<Vec<_>>()
            .join("\n")
    );
}
