# LAN backend HTTP route matrix

**Generated:** `cargo test -p medoc-lan --test http_route_matrix_tests`  
**Harness:** in-process `LanTestHarness` (same handlers as `medoc-server`)  
**Result:** 33 passed / 0 failed / 33 total

| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |
|---:|---|---|---|---|---:|:---:|---|
| 1 | `health` | GET | `/health` | 200 | 200 | PASS | {"service":"medoc-lan","status":"ok","version":"0.1.0"} |
| 2 | `ping` | GET | `/api/v1/ping` | 200 | 200 | PASS | {"ok":true} |
| 3 | `pairing.master_info` | GET | `/api/v1/pairing/master-info` | 200 | 200 | PASS | {"masterDeviceId":"5a2623f0-c601-47c5-9254-719064f858ef","masterLabel":"MeDoc Master","masterPubkey":"IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY","masterVersion":"0.1.0"} |
| 4 | `auth.login` | POST | `/api/v1/auth/login` | 200 | 200 | PASS | {"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJtZWRvYy1sYW4iLCJzdWIiOiJzZWVkLXBoeXNpY2lhbi0wMDEiLCJlbWFpbCI6ImFobWVkQHByYWN0aWNlLmRlIiwicm9sZSI6IlBIWVNJQ0lBTiIsImV4cCI6MTc5MDg3OTYxOH0.QwhYPAt4VQpab7AH9W… |
| 5 | `auth.login_bad_password` | POST | `/api/v1/auth/login` | 401|403|429 | 401 | PASS | {"error":"Unauthorized"} |
| 6 | `me.get` | GET | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":"General dentistry","email":"ahmed@practice.de","name":"Dr. Ahmed Rahman","phone":"+49 421 900100","role":"PHYSICIAN","specialty":"Restorative & prosthodontics","user_id":"seed-physician-001"} |
| 7 | `me.patch` | PATCH | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":"General dentistry","email":"ahmed@practice.de","name":"Dr. Ahmed R.","phone":"+49 421 900100","role":"PHYSICIAN","specialty":"Restorative & prosthodontics","user_id":"seed-physician-001"} |
| 8 | `patients.list` | GET | `/api/v1/patients` | 200 | 200 | PASS | [{"address":"Silva 107, 27278 Verden","created_at":"2025-11-14T09:00:00","date_of_birth":"1999-06-20","email":"yr.patient.0120@medoc-demo.de","id":"seed-yr-pat-0120","insurance_number":"HEK-YR00120","name":"Amir Hartmann… |
| 9 | `appointments.list` | GET | `/api/v1/appointments?date=2026-10-01` | 200 | 200 | PASS | [{"chief_complaint":"Hot/cold sensitivity","created_at":"2026-10-01T08:00:00","date":"2026-10-01","id":"seed-wd-00","kind":"FIRST_VISIT","notes":"Duration: 45 min · New patient intake · full anamnesis","patient_id":"seed… |
| 10 | `app_kv.put` | PUT | `/api/v1/app-kv` | 200|204 | 204 | PASS | null |
| 11 | `app_kv.get` | GET | `/api/v1/app-kv?key=practice.preferences.v1` | 200 | 200 | PASS | "{\"theme\":\"system\"}" |
| 12 | `app_kv.delete` | DELETE | `/api/v1/app-kv?key=practice.preferences.v1` | 200|204 | 204 | PASS | null |
| 13 | `license.status` | GET | `/api/v1/license` | 200 | 200 | PASS | {"activatedAt":"2026-05-26T12:00:00+00:00","daysUntilExpiry":null,"format":"v2","message":"License active","status":"ACTIVE","tokenHint":"lan-…","valid":true} |
| 14 | `license.activate_invalid` | POST | `/api/v1/license/activate` | 200|400|422 | 200 | PASS | {"activatedAt":"","daysUntilExpiry":null,"format":null,"message":"Invalid format — separator missing","status":"INACTIVE","tokenHint":"","valid":false} |
| 15 | `eprescription.validate` | POST | `/api/v1/eprescriptions/validate` | 200 | 200 | PASS | {"accessCode":"","message":"Validation passed","redeemUrl":"","status":"VALIDATED","taskId":""} |
| 16 | `eprescription.submit_stub` | POST | `/api/v1/eprescriptions/submit` | 500|501 | 500 | PASS | {"error":"Internal error: E-prescription submission requires TI connector and HBA card"} |
| 17 | `pairing.pending` | GET | `/api/v1/pairing/pending` | 200 | 200 | PASS | [] |
| 18 | `pairing.all` | GET | `/api/v1/pairing/all` | 200 | 200 | PASS | [{"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLTEiLCJzbGF2ZUxhYmVsIjoiTWF0cml4IFJlcGxpY2EiLCJtYXN0ZXJEZXZpY2VJZCI6IjVhMjYyM2YwLWM2MDEtNDdjNS05MjU0LTcxOTA2NGY4NThlZiIsImFsbG93ZWRBY3Rpb25zIjp… |
| 19 | `pairing.status` | GET | `/api/v1/pairing/status/383d1262-838a-4af4-8612-da486484fa94` | 200 | 200 | PASS | {"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLTEiLCJzbGF2ZUxhYmVsIjoiTWF0cml4IFJlcGxpY2EiLCJtYXN0ZXJEZXZpY2VJZCI6IjVhMjYyM2YwLWM2MDEtNDdjNS05MjU0LTcxOTA2NGY4NThlZiIsImFsbG93ZWRBY3Rpb25zIjpb… |
| 20 | `pairing.peers` | GET | `/api/v1/pairing/peers` | 200 | 200 | PASS | {"masterDeviceId":"5a2623f0-c601-47c5-9254-719064f858ef","peers":[],"signature":"peXvlXFwOcI3wL6PTtZVb4uQbbrUIz8ez23+j3ImVUwuAJvU9SfDrKZqNad7qbvix6lBB+0RlKrbzS1BprULBA"} |
| 21 | `sync.status` | GET | `/api/v1/sync/status` | 200 | 200 | PASS | {"deployment":{"activationToken":"","deviceLabel":"LAN Test Master","masterAccessToken":"","masterBaseUrl":"","masterCertSha256":"","masterDeviceId":"","masterPubkey":"","mode":"serverless_peer","pairingRequestId":"","ro… |
| 22 | `sync.push_empty` | POST | `/api/v1/sync/push` | 200 | 200 | PASS | {"accepted":0,"lastSeq":0} |
| 23 | `sync.pull` | POST | `/api/v1/sync/pull` | 200 | 200 | PASS | {"entries":[{"createdAt":"2026-10-01T10:33:38.748776+00:00","deviceId":"5a2623f0-c601-47c5-9254-719064f858ef","entityId":"practice.preferences.v1","entityTable":"app_kv","id":"81e519d4-c0a1-4458-b807-eaea454e8a21","op":"… |
| 24 | `company.summary_no_upstream` | GET | `/api/v1/company/summary` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE."} |
| 25 | `company.feature_flags_no_upstream` | GET | `/api/v1/company/feature-flags` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE."} |
| 26 | `company.integrations_no_upstream` | GET | `/api/v1/company/integrations/status` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE."} |
| 27 | `company.billing_portal_no_upstream` | POST | `/api/v1/company/billing/portal-session` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE."} |
| 28 | `patients.unauthorized` | GET | `/api/v1/patients` | 401|403 | 401 | PASS | {"error":"Authorization header required"} |
| 29 | `pairing.request_for_revoke` | POST | `/api/v1/pairing/request` | 200 | 200 | PASS | {"activationToken":null,"allowedActions":[],"awaitingPin":false,"clusterSas":false,"decidedAt":null,"decidedBy":null,"deviceId":"matrix-replica-revoke","id":"9add0b29-77bb-4f90-9e2a-cd40d5f343a4","requestedAt":"2026-10-0… |
| 30 | `pairing.decide_for_revoke` | POST | `/api/v1/pairing/decide/9add0b29-77bb-4f90-9e2a-cd40d5f343a4` | 200 | 200 | PASS | {"confirmPin":"7658","request":{"activationToken":null,"allowedActions":["sync.push","sync.pull","sync.status","pairing.peers"],"awaitingPin":true,"clusterSas":false,"decidedAt":"2026-10-01T10:33:39.108156+00:00","decide… |
| 31 | `pairing.revoke` | POST | `/api/v1/pairing/revoke/matrix-replica-revoke` | 200|204 | 204 | PASS | null |
| 32 | `pairing.confirm_wrong_pin` | POST | `/api/v1/pairing/confirm/383d1262-838a-4af4-8612-da486484fa94` | 400|404|409 | 409 | PASS | {"error":"Conflict: pairing_request is not awaiting PIN confirmation"} |
| 33 | `license.clear` | DELETE | `/api/v1/license` | 200|204 | 204 | PASS | null |

## Notes

- `eprescription.submit_stub` expects 500/501 without TI connector.
- Company proxy routes expect 400 when vendor portal URL is unset.
- Auth uses seeded `ahmed@practice.de` / `password123` plus ops JWT.
- Sync/peers use activation token after pairing decide + PIN confirm.
- `license.activate_invalid` returns HTTP 200 with `valid:false` (structured status).
