# Backend API + connection matrix

**Generated:** `bash scripts/backend-api-connection-matrix.sh`  
**LAN:** `https://127.0.0.1:18787`  
**Company:** `http://127.0.0.1:19797`  
**Discovery UDP:** `47831`  
**Result:** 50 passed / 0 failed / 50 total

| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |
|---:|---|---|---|---|---:|:---:|---|
| 1 | `company.health` | GET | `/health` | 200 | 200 | PASS | {"_demo":true,"banner":"Demo-only billing stub — not for production (GAP-15 deferred).","service":"medoc-company-server","status":"ok"} |
| 2 | `company.register` | POST | `/register` | 200 201 409 400 | 200 | PASS | {"_demo":true,"admin_email":"matrix@example.com","admin_name":"Matrix Admin","api_key":"sk_live_XAfSAJ3fRP691yUzPRFalg","city":null,"display_name":"Matrix Practice","max_users":5,"… |
| 3 | `company.v1.health` | GET | `/v1/health` | 200 | 200 | PASS | {"_demo":true,"authenticated":true,"status":"ok"} |
| 4 | `company.v1.summary` | GET | `/v1/summary` | 200 | 200 | PASS | {"active_users":1,"display_name":"Demo Practice GmbH","e_prescription_month_quota":-1,"e_prescription_month_used":142,"max_users":5,"monthly_fee_cents":18900,"next_billing_iso":"20… |
| 5 | `company.v1.integrations` | GET | `/v1/integrations/status` | 200 | 200 | PASS | {"_demo":true,"card_reader":{"detail":"No card reader detected","status":"disconnected"},"datev":{"detail":"DATEV export prepared","status":"beta"},"doccheck_sso":{"detail":"Not co… |
| 6 | `company.v1.feature_flags` | GET | `/v1/feature-flags` | 200 | 200 | PASS | {"_demo":true,"notifications_email_digest_delivery":false,"notifications_patient_sms_delivery":false,"notifications_push_delivery":false,"two_factor_auth_enforced":false} |
| 7 | `company.v1.updates` | GET | `/v1/updates/manifest?current=0.1.0` | 200 | 200 | PASS | {"_demo":true,"channel":"stable","current_version":"0.1.0","latest_version":"0.1.0","update_available":false} |
| 8 | `company.v1.billing_portal` | POST | `/v1/billing/portal-session` | 200 | 200 | PASS | {"_demo":true,"provider":"stripe-demo","url":"https://billing.stripe.com/demo-portal-session"} |
| 9 | `company.v1.payment_methods` | POST | `/v1/billing/payment-methods` | 200 | 200 | PASS | {"_demo":true,"attached":true} |
| 10 | `company.v1.summary_bad_key` | GET | `/v1/summary` | 401 403 400 | 403 | PASS | invalid api key |
| 11 | `company.v1.summary_no_auth` | GET | `/v1/summary` | 401 403 400 | 400 | PASS | X-Practice-Slug required |
| 12 | `lan.health` | GET | `/health` | 200 | 200 | PASS | {"service":"medoc-lan","status":"ok","version":"0.1.0"} |
| 13 | `lan.ping` | GET | `/api/v1/ping` | 200 | 200 | PASS | {"ok":true} |
| 14 | `lan.pairing.master_info` | GET | `/api/v1/pairing/master-info` | 200 | 200 | PASS | {"masterDeviceId":"9cdcd065-2327-4d8f-8201-286b3176c369","masterPubkey":"IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY","masterLabel":"MeDoc Master","masterVersion":"0.1.0"} |
| 15 | `lan.auth.login` | POST | `/api/v1/auth/login` | 200 | 200 | PASS | {"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJtZWRvYy1sYW4iLCJzdWIiOiJzZWVkLXBoeXNpY2lhbi0wMDEiLCJlbWFpbCI6ImFobWVkQHByYWN0aWNlLmRlIiwicm9sZSI6IlBIWVNJQ0lBTiIsIm… |
| 16 | `lan.auth.login_bad` | POST | `/api/v1/auth/login` | 401 403 429 | 401 | PASS | {"error":"Unauthorized"} |
| 17 | `lan.me.get` | GET | `/api/v1/me` | 200 | 200 | PASS | {"user_id":"seed-physician-001","name":"Dr. Ahmed R.","email":"ahmed@practice.de","role":"PHYSICIAN","activity_area":null,"specialty":"Dentistry","phone":null} |
| 18 | `lan.me.patch` | PATCH | `/api/v1/me` | 200 | 200 | PASS | {"user_id":"seed-physician-001","name":"Dr. Ahmed R.","email":"ahmed@practice.de","role":"PHYSICIAN","activity_area":null,"specialty":"Dentistry","phone":"+49 421 900100"} |
| 19 | `lan.patients.list` | GET | `/api/v1/patients` | 200 | 200 | PASS | [{"id":"seed-pat-005","name":"Aylin Demir","date_of_birth":"1996-07-09","sex":"DIVERSE","insurance_number":"IKK-1000005","phone":"+49 172 8899001","email":"aylin.demir@medoc-demo.d… |
| 20 | `lan.appointments.list` | GET | `/api/v1/appointments?date=2026-08-20` | 200 | 200 | PASS | [{"id":"seed-ter-001","date":"2026-08-20","time":"08:30","kind":"FIRST_VISIT","status":"CONFIRMED","notes":"Take anamnesis","chief_complaint":"Hot/cold sensitivity","patient_id":"s… |
| 21 | `lan.app_kv.put` | PUT | `/api/v1/app-kv` | 200 204 | 204 | PASS |  |
| 22 | `lan.app_kv.get` | GET | `/api/v1/app-kv?key=practice.preferences.v1` | 200 | 200 | PASS | "{\"theme\":\"system\"}" |
| 23 | `lan.app_kv.delete` | DELETE | `/api/v1/app-kv?key=practice.preferences.v1` | 200 204 | 204 | PASS |  |
| 24 | `lan.license.status` | GET | `/api/v1/license` | 200 | 200 | PASS | {"activatedAt":"2026-05-26T12:00:00+00:00","daysUntilExpiry":null,"format":"v2","message":"License active","status":"ACTIVE","tokenHint":"e2e-…","valid":true} |
| 25 | `lan.license.activate_invalid` | POST | `/api/v1/license/activate` | 200 400 422 | 200 | PASS | {"activatedAt":"","daysUntilExpiry":null,"format":null,"message":"Invalid format — separator missing","status":"INACTIVE","tokenHint":"","valid":false} |
| 26 | `lan.eprescription.validate` | POST | `/api/v1/eprescriptions/validate` | 200 | 200 | PASS | {"accessCode":"","message":"Validation passed","redeemUrl":"","status":"VALIDATED","taskId":""} |
| 27 | `lan.eprescription.submit_stub` | POST | `/api/v1/eprescriptions/submit` | 500 501 | 500 | PASS | {"error":"Internal error: E-prescription submission requires TI connector and HBA card"} |
| 28 | `lan.pairing.request` | POST | `/api/v1/pairing/request` | 200 | 200 | PASS | {"id":"872a44a4-e6b2-4eb9-a3f4-3f541626f200","deviceId":"matrix-live-replica","slavePubkey":"9ESaVYuCOpouBPB4q6Nr5PjCiPpSfJX4dmcyY3lvBnU","slaveLabel":"Live Matrix Replica","reques… |
| 29 | `lan.pairing.decide` | POST | `/api/v1/pairing/decide/872a44a4-e6b2-4eb9-a3f4-3f541626f200` | 200 | 200 | PASS | {"request":{"id":"872a44a4-e6b2-4eb9-a3f4-3f541626f200","deviceId":"matrix-live-replica","slavePubkey":"9ESaVYuCOpouBPB4q6Nr5PjCiPpSfJX4dmcyY3lvBnU","slaveLabel":"Live Matrix Repli… |
| 30 | `lan.pairing.confirm` | POST | `/api/v1/pairing/confirm/872a44a4-e6b2-4eb9-a3f4-3f541626f200` | 200 | 200 | PASS | {"id":"872a44a4-e6b2-4eb9-a3f4-3f541626f200","deviceId":"matrix-live-replica","slavePubkey":"9ESaVYuCOpouBPB4q6Nr5PjCiPpSfJX4dmcyY3lvBnU","slaveLabel":"Live Matrix Replica","reques… |
| 31 | `lan.pairing.status` | GET | `/api/v1/pairing/status/872a44a4-e6b2-4eb9-a3f4-3f541626f200` | 200 | 200 | PASS | {"id":"872a44a4-e6b2-4eb9-a3f4-3f541626f200","deviceId":"matrix-live-replica","slavePubkey":"9ESaVYuCOpouBPB4q6Nr5PjCiPpSfJX4dmcyY3lvBnU","slaveLabel":"Live Matrix Replica","reques… |
| 32 | `lan.pairing.pending` | GET | `/api/v1/pairing/pending` | 200 | 200 | PASS | [] |
| 33 | `lan.pairing.all` | GET | `/api/v1/pairing/all` | 200 | 200 | PASS | [{"id":"872a44a4-e6b2-4eb9-a3f4-3f541626f200","deviceId":"matrix-live-replica","slavePubkey":"9ESaVYuCOpouBPB4q6Nr5PjCiPpSfJX4dmcyY3lvBnU","slaveLabel":"Live Matrix Replica","reque… |
| 34 | `lan.pairing.peers` | GET | `/api/v1/pairing/peers` | 200 | 200 | PASS | {"masterDeviceId":"9cdcd065-2327-4d8f-8201-286b3176c369","peers":[],"signature":"Uq1SVwrpV5nR0YCwb1L7egL6a2C98mJ1qcBKtmOoweNFYCl/bfunWCDF2FTXGJ02v0/EEZcGbYxUgxmyH7SwAg"} |
| 35 | `lan.sync.status` | GET | `/api/v1/sync/status` | 200 | 200 | PASS | {"localDeviceId":"9cdcd065-2327-4d8f-8201-286b3176c369","deployment":{"schemaVersion":1,"mode":"serverless_peer","role":"MASTER","masterBaseUrl":"","masterCertSha256":"","masterAcc… |
| 36 | `lan.sync.push` | POST | `/api/v1/sync/push` | 200 | 200 | PASS | {"accepted":0,"lastSeq":0} |
| 37 | `lan.sync.pull` | POST | `/api/v1/sync/pull` | 200 | 200 | PASS | {"entries":[]} |
| 38 | `lan.pairing.revoke` | POST | `/api/v1/pairing/revoke/matrix-live-replica` | 200 204 | 204 | PASS |  |
| 39 | `lan.company.summary_proxy` | GET | `/api/v1/company/summary` | 200 400 502 503 500 404 | 200 | PASS | {"active_users":1,"display_name":"Demo Practice GmbH","e_prescription_month_quota":-1,"e_prescription_month_used":142,"max_users":5,"monthly_fee_cents":18900,"next_billing_iso":"20… |
| 40 | `lan.company.flags_proxy` | GET | `/api/v1/company/feature-flags` | 200 400 502 503 500 404 | 200 | PASS | {"_demo":true,"notifications_email_digest_delivery":false,"notifications_patient_sms_delivery":false,"notifications_push_delivery":false,"two_factor_auth_enforced":false} |
| 41 | `lan.company.integrations_proxy` | GET | `/api/v1/company/integrations/status` | 200 400 502 503 500 404 | 200 | PASS | {"_demo":true,"card_reader":{"detail":"No card reader detected","status":"disconnected"},"datev":{"detail":"DATEV export prepared","status":"beta"},"doccheck_sso":{"detail":"Not co… |
| 42 | `lan.company.billing_proxy` | POST | `/api/v1/company/billing/portal-session` | 200 400 502 503 500 404 | 200 | PASS | {"provider":"Vendor portal","url":"https://billing.stripe.com/demo-portal-session"} |
| 43 | `lan.patients.unauthorized` | GET | `/api/v1/patients` | 401 403 | 401 | PASS | {"error":"Authorization header required"} |
| 44 | `discovery.udp_probe` | UDP | `127.0.0.1:47831` | 200 | 200 | PASS | {"schema":"medoc-lan-v1","version":"0.1.0","httpPort":18787,"instanceId":"93c04dea-8d82-40c0-8894-54e6728e7f67","label":"API Matrix Master","tls":true,"certSha256":"f947797e71d5463… |
| 45 | `suite.lan_http_route_matrix` | cargo | `test` | 200 | 200 | PASS | test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.25s |
| 46 | `suite.company_portal` | cargo | `test` | 200 | 200 | PASS | test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.81s |
| 47 | `suite.lan_pairing_sync` | cargo | `test` | 200 | 200 | PASS | test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.85s |
| 48 | `suite.serverful_lan_client_flows` | cargo | `test` | 200 | 200 | PASS | test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.41s |
| 49 | `suite.cluster_net_loopback` | cargo | `test` | 200 | 200 | PASS | test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.09s |
| 50 | `suite.engine_http_tests` | cargo | `test` | 200 | 200 | PASS | test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.43s |

## Notes

- Live TCP/TLS against real `medoc-server` + `medoc-company-server` binaries.
- Login may use TOTP `1234` when master was seeded by e2e `prepare_master_datadir`.
- e-Rx submit expects 500/501 without TI connector.
- LAN company proxy needs portal config; 400 without slug/base is acceptable.
- UDP discovery probe uses `MEDOC_DISCOVER_V1` (result: PASS).

## Suite log (tail)

```
## Cargo suite results


test lan_http_route_matrix_all_endpoints ... ok

test result: ok. 1 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.25s

lan_route_matrix_exit=0
test company_rejects_missing_slug_header ... ok
test company_authenticated_summary ... ok
test company_rejects_invalid_api_key ... ok
test company_feature_flags_and_integrations ... ok
test company_billing_attach_validates_token_length ... ok

test result: ok. 6 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 0.81s

company_portal_exit=0
test activation_token_cannot_access_patients ... ok
test pairing_reject_flow ... ok
test sync_push_rejects_mismatched_device_id ... ok
test pairing_accept_issue_activation_token_and_sync ... ok
test lan_login_and_me_profile ... ok

test result: ok. 7 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 3.85s

lan_pairing_sync_exit=0
test jwt_is_not_accepted_on_sync_routes_only_activation_token ... ok
test physician_jwt_lists_pending_and_all_pairing_requests ... ok
test app_kv_get_set_delete_round_trip_with_physician_jwt ... ok
test reception_jwt_reads_patients_but_not_company_endpoints ... ok
test login_with_wrong_password_returns_unauthorized ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 4.41s

serverful_exit=0
running 4 tests
test cluster_listener_binds_private_loopback ... ok
test noise_xx_produces_shared_transcript ... ok
test xx_handshake_over_tcp_matches_transcript ... ok
test join_request_accept_over_loopback ... ok

test result: ok. 4 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.09s

cluster_loopback_exit=0
test run_mesh_sync_peers_http_error ... ok
test run_mesh_sync_skips_peer_without_base_url ... ok
test run_replica_sync_push_and_pull_success ... ok
test run_mesh_sync_records_peer_push_failure ... ok
test run_replica_sync_includes_mesh_when_enabled ... ok

test result: ok. 19 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 7.43s

engine_http_exit=0
```
