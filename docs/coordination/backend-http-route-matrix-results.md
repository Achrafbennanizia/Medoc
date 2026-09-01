# LAN backend HTTP route matrix

**Generated:** `cargo test -p medoc-lan --test http_route_matrix_tests`  
**Harness:** in-process `LanTestHarness` (same handlers as `medoc-server`)  
**Result:** 33 passed / 0 failed / 33 total

| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |
|---:|---|---|---|---|---:|:---:|---|
| 1 | `health` | GET | `/health` | 200 | 200 | PASS | {"service":"medoc-lan","status":"ok","version":"0.1.0"} |
| 2 | `ping` | GET | `/api/v1/ping` | 200 | 200 | PASS | {"ok":true} |
| 3 | `pairing.master_info` | GET | `/api/v1/pairing/master-info` | 200 | 200 | PASS | {"masterDeviceId":"a74dca06-41c0-45a0-9a1e-43442f7f97e9","masterLabel":"MeDoc Master","masterPubkey":"IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY","masterVersion":"0.1.0"} |
| 4 | `auth.login` | POST | `/api/v1/auth/login` | 200 | 200 | PASS | {"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJtZWRvYy1sYW4iLCJzdWIiOiJzZWVkLXBoeXNpY2lhbi0wMDEiLCJlbWFpbCI6ImFobWVkQHByYWN0aWNlLmRlIiwicm9sZSI6IlBIWVNJQ0lBTiIsImV4cCI6MTc4NzI4MDUzNn0.mAKjkxEEi-vRLo2QGs… |
| 5 | `auth.login_bad_password` | POST | `/api/v1/auth/login` | 401|403|429 | 401 | PASS | {"error":"Unauthorized"} |
| 6 | `me.get` | GET | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":null,"email":"ahmed@practice.de","name":"Dr. Ahmed R.","phone":null,"role":"PHYSICIAN","specialty":"Dentistry","user_id":"seed-physician-001"} |
| 7 | `me.patch` | PATCH | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":null,"email":"ahmed@practice.de","name":"Dr. Ahmed R.","phone":"+49 421 900100","role":"PHYSICIAN","specialty":"Dentistry","user_id":"seed-physician-001"} |
| 8 | `patients.list` | GET | `/api/v1/patients` | 200 | 200 | PASS | [{"address":"Am Markt 15, 28195 Bremen","created_at":"2026-06-01T20:48:55","date_of_birth":"1996-07-09","email":"aylin.demir@medoc-demo.de","id":"seed-pat-005","insurance_number":"IKK-1000005","name":"Aylin Demir","phone… |
| 9 | `appointments.list` | GET | `/api/v1/appointments?date=2026-08-20` | 200 | 200 | PASS | [{"chief_complaint":"Hot/cold sensitivity","created_at":"2026-08-20T18:48:55","date":"2026-08-20","id":"seed-ter-001","kind":"FIRST_VISIT","notes":"Take anamnesis","patient_id":"seed-pat-001","physician_id":"seed-physici… |
| 10 | `app_kv.put` | PUT | `/api/v1/app-kv` | 200|204 | 204 | PASS | null |
| 11 | `app_kv.get` | GET | `/api/v1/app-kv?key=practice.preferences.v1` | 200 | 200 | PASS | "{\"theme\":\"system\"}" |
| 12 | `app_kv.delete` | DELETE | `/api/v1/app-kv?key=practice.preferences.v1` | 200|204 | 204 | PASS | null |
| 13 | `license.status` | GET | `/api/v1/license` | 200 | 200 | PASS | {"activatedAt":"2026-05-26T12:00:00+00:00","daysUntilExpiry":null,"format":"v2","message":"License active","status":"ACTIVE","tokenHint":"lan-…","valid":true} |
| 14 | `license.activate_invalid` | POST | `/api/v1/license/activate` | 200|400|422 | 200 | PASS | {"activatedAt":"","daysUntilExpiry":null,"format":null,"message":"Invalid format — separator missing","status":"INACTIVE","tokenHint":"","valid":false} |
| 15 | `eprescription.validate` | POST | `/api/v1/eprescriptions/validate` | 200 | 200 | PASS | {"accessCode":"","message":"Validation passed","redeemUrl":"","status":"VALIDATED","taskId":""} |
| 16 | `eprescription.submit_stub` | POST | `/api/v1/eprescriptions/submit` | 500|501 | 500 | PASS | {"error":"Internal error: E-prescription submission requires TI connector and HBA card"} |
| 17 | `pairing.pending` | GET | `/api/v1/pairing/pending` | 200 | 200 | PASS | [] |
| 18 | `pairing.all` | GET | `/api/v1/pairing/all` | 200 | 200 | PASS | [{"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLTEiLCJzbGF2ZUxhYmVsIjoiTWF0cml4IFJlcGxpY2EiLCJtYXN0ZXJEZXZpY2VJZCI6ImE3NGRjYTA2LTQxYzAtNDVhMC05YTFlLTQzNDQyZjdmOTdlOSIsImFsbG93ZWRBY3Rpb25zIjp… |
| 19 | `pairing.status` | GET | `/api/v1/pairing/status/591d241f-f736-4154-9719-2aabb794a198` | 200 | 200 | PASS | {"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLTEiLCJzbGF2ZUxhYmVsIjoiTWF0cml4IFJlcGxpY2EiLCJtYXN0ZXJEZXZpY2VJZCI6ImE3NGRjYTA2LTQxYzAtNDVhMC05YTFlLTQzNDQyZjdmOTdlOSIsImFsbG93ZWRBY3Rpb25zIjpb… |
| 20 | `pairing.peers` | GET | `/api/v1/pairing/peers` | 200 | 200 | PASS | {"masterDeviceId":"a74dca06-41c0-45a0-9a1e-43442f7f97e9","peers":[],"signature":"/k3cYZvcxtV6KSyjBBZ91j9R0DleASce4FJ206CZII+/DafL18jNaCwifDG3dsSlEL3sFG8udAtLsl6b7kW5Cg"} |
| 21 | `sync.status` | GET | `/api/v1/sync/status` | 200 | 200 | PASS | {"deployment":{"activationToken":"","deviceLabel":"LAN Test Master","masterAccessToken":"","masterBaseUrl":"","masterCertSha256":"","masterDeviceId":"","masterPubkey":"","mode":"serverless_peer","pairingRequestId":"","ro… |
| 22 | `sync.push_empty` | POST | `/api/v1/sync/push` | 200 | 200 | PASS | {"accepted":0,"lastSeq":0} |
| 23 | `sync.pull` | POST | `/api/v1/sync/pull` | 200 | 200 | PASS | {"entries":[]} |
| 24 | `company.summary_no_upstream` | GET | `/api/v1/company/summary` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal: practice_slug (tenant id) is missing."} |
| 25 | `company.feature_flags_no_upstream` | GET | `/api/v1/company/feature-flags` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal: practice_slug (tenant id) is missing."} |
| 26 | `company.integrations_no_upstream` | GET | `/api/v1/company/integrations/status` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal: practice_slug (tenant id) is missing."} |
| 27 | `company.billing_portal_no_upstream` | POST | `/api/v1/company/billing/portal-session` | 200|400|502|503|500|404 | 400 | PASS | {"error":"Validation error: Vendor portal: practice_slug (tenant id) is missing."} |
| 28 | `patients.unauthorized` | GET | `/api/v1/patients` | 401|403 | 401 | PASS | {"error":"Authorization header required"} |
| 29 | `pairing.request_for_revoke` | POST | `/api/v1/pairing/request` | 200 | 200 | PASS | {"activationToken":null,"allowedActions":[],"awaitingPin":false,"decidedAt":null,"decidedBy":null,"deviceId":"matrix-replica-revoke","id":"61f8a767-7afc-4f6f-a7c8-1f01b41a3f4f","requestedAt":"2026-08-20T18:48:57.021219+0… |
| 30 | `pairing.decide_for_revoke` | POST | `/api/v1/pairing/decide/61f8a767-7afc-4f6f-a7c8-1f01b41a3f4f` | 200 | 200 | PASS | {"confirmPin":"8110","request":{"activationToken":null,"allowedActions":["sync.push","sync.pull","sync.status","pairing.peers"],"awaitingPin":true,"decidedAt":"2026-08-20T18:48:57.024823+00:00","decidedBy":"seed-physicia… |
| 31 | `pairing.revoke` | POST | `/api/v1/pairing/revoke/matrix-replica-revoke` | 200|204 | 204 | PASS | null |
| 32 | `pairing.confirm_wrong_pin` | POST | `/api/v1/pairing/confirm/591d241f-f736-4154-9719-2aabb794a198` | 400|404|409 | 409 | PASS | {"error":"Conflict: pairing_request is not awaiting PIN confirmation"} |
| 33 | `license.clear` | DELETE | `/api/v1/license` | 200|204 | 204 | PASS | null |

## Notes

- `eprescription.submit_stub` expects 500/501 without TI connector.
- Company proxy routes expect 400 when vendor portal URL is unset.
- Auth uses seeded `ahmed@practice.de` / `password123` plus ops JWT.
- Sync/peers use activation token after pairing decide + PIN confirm.
- `license.activate_invalid` returns HTTP 200 with `valid:false` (structured status).
