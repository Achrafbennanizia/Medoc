# LAN backend HTTP route matrix

**Generated:** `cargo test -p medoc-lan --test http_route_matrix_tests`  
**Harness:** in-process `LanTestHarness` (same handlers as `medoc-server`)  
**Result:** 34 passed / 0 failed / 34 total

| # | Test / function | Method | Path | Expect | Status | OK | Output (truncated) |
|---:|---|---|---|---|---:|:---:|---|
| 1 | `health` | GET | `/health` | 200 | 200 | PASS | {"server_time":"2026-11-27T21:24:51.218Z","service":"medoc-lan","status":"ok","utc_offset_minutes":0,"version":"0.1.0"} |
| 2 | `ping` | GET | `/api/v1/ping` | 200 | 200 | PASS | {"ok":true,"server_time":"2026-11-27T21:24:51.219Z","utc_offset_minutes":0} |
| 3 | `pairing.master_info` | GET | `/api/v1/pairing/master-info` | 200 | 200 | PASS | {"masterDeviceId":"831dddcd-729b-4ee3-a3e3-c5fcf9553cbc","masterLabel":"MeDoc Master","masterPubkey":"IHoGeJKCHiXXcPH7oMR8Ef9LgT5UFi7Onrg54HYjGrY","masterVersion":"0.1.0"} |
| 4 | `auth.login` | POST | `/api/v1/auth/login` | 200 | 200 | PASS | {"access_token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJtZWRvYy1sYW4iLCJzdWIiOiJzZWVkLXBoeXNpY2lhbi0wMDEiLCJlbWFpbCI6ImFobWVkQHByYWN0aWNlLmRlIiwicm9sZSI6IlBIWVNJQ0lBTiIsInRva2VuX3ZlcnNpb24iOjAsImV4cCI6MTc5NTg0Mz… |
| 5 | `auth.login_bad_password` | POST | `/api/v1/auth/login` | 401|403|429 | 401 | PASS | {"error":"error.app.unauthorized","status":401} |
| 6 | `me.get` | GET | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":"General dentistry","email":"ahmed@practice.de","name":"Dr. Ahmed Rahman","phone":"+49 421 900100","role":"PHYSICIAN","specialty":"Restorative & prosthodontics","user_id":"seed-physician-001"} |
| 7 | `me.patch` | PATCH | `/api/v1/me` | 200 | 200 | PASS | {"activity_area":"General dentistry","email":"ahmed@practice.de","name":"Dr. Ahmed R.","phone":"+49 421 900100","role":"PHYSICIAN","specialty":"Restorative & prosthodontics","user_id":"seed-physician-001"} |
| 8 | `patients.list` | GET | `/api/v1/patients` | 404 | 404 | PASS | null |
| 9 | `appointments.list` | GET | `/api/v1/appointments?date=2026-11-27` | 404 | 404 | PASS | null |
| 10 | `app_kv.put` | PUT | `/api/v1/app-kv` | 200|204 | 204 | PASS | null |
| 11 | `app_kv.get` | GET | `/api/v1/app-kv?key=practice.preferences.v1` | 200 | 200 | PASS | "{\"theme\":\"system\"}" |
| 12 | `app_kv.delete` | DELETE | `/api/v1/app-kv?key=practice.preferences.v1` | 200|204 | 204 | PASS | null |
| 13 | `license.status` | GET | `/api/v1/license` | 200 | 200 | PASS | {"activatedAt":"2026-05-26T12:00:00+00:00","daysUntilExpiry":null,"format":"v2","message":"License active","status":"ACTIVE","tokenHint":"lan-…","valid":true} |
| 14 | `license.activate_invalid` | POST | `/api/v1/license/activate` | 200|400|422 | 200 | PASS | {"activatedAt":"","daysUntilExpiry":null,"format":null,"message":"Invalid format — separator missing","status":"INACTIVE","tokenHint":"","valid":false} |
| 15 | `eprescription.validate` | POST | `/api/v1/eprescriptions/validate` | 409 | 409 | PASS | {"error":"FEATURE_DISABLED\|feature=eprescription","status":409} |
| 16 | `eprescription.submit_stub` | POST | `/api/v1/eprescriptions/submit` | 409 | 409 | PASS | {"error":"FEATURE_DISABLED\|feature=eprescription","status":409} |
| 17 | `pairing.pending` | GET | `/api/v1/pairing/pending` | 200 | 200 | PASS | [] |
| 18 | `pairing.all` | GET | `/api/v1/pairing/all` | 200 | 200 | PASS | [{"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLTEiLCJzbGF2ZUxhYmVsIjoiTWF0cml4IFJlcGxpY2EiLCJtYXN0ZXJEZXZpY2VJZCI6IjgzMWRkZGNkLTcyOWItNGVlMy1hM2UzLWM1ZmNmOTU1M2NiYyIsImFsbG93ZWRBY3Rpb25zIjp… |
| 19 | `pairing.status` | GET | `/api/v1/pairing/status/9a4adf6e-f5f9-470f-830d-2dfb376dc584` | 200 | 200 | PASS | {"activationToken":null,"allowedActions":["sync.push","sync.pull","sync.status","sync.blob.get","sync.blob.put","sync.reconcile","sync.number","pairing.peers"],"awaitingPin":false,"clusterSas":false,"decidedAt":"2026-11-… |
| 20 | `pairing.peers` | GET | `/api/v1/pairing/peers` | 200 | 200 | PASS | {"masterDeviceId":"831dddcd-729b-4ee3-a3e3-c5fcf9553cbc","peers":[],"signature":"yezOwcDFV5VAZoBGgIjBrT1IkQwwbeax/id2ccfKAeSLTW90gz6mWtE/6Hv/xnRkWCz5eX0EhRELOj6URmWnDQ"} |
| 21 | `sync.status` | GET | `/api/v1/sync/status` | 200 | 200 | PASS | {"deployment":{"activationToken":"","deviceLabel":"LAN Test Master","masterAccessToken":"","masterBaseUrl":"","masterCertSha256":"","masterDeviceId":"","masterPubkey":"","mode":"serverless_peer","pairingRequestId":"","ro… |
| 22 | `sync.push_empty` | POST | `/api/v1/sync/push` | 200 | 200 | PASS | {"accepted":0,"lastSeq":0} |
| 23 | `sync.pull` | POST | `/api/v1/sync/pull` | 200 | 200 | PASS | {"entries":[{"createdAt":"2026-11-27T21:24:52.497018+00:00","deviceId":"831dddcd-729b-4ee3-a3e3-c5fcf9553cbc","entityId":"practice.preferences.v1","entityTable":"app_kv","id":"6ef7da38-86bb-4e76-bd1d-855f1d4c82d1","op":"… |
| 24 | `company.summary_no_upstream` | GET | `/api/v1/company/summary` | 200|400|502|503|500|404 | 400 | PASS | {"error":"error.app.validation\|detail=Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE.","status":400} |
| 25 | `company.feature_flags_no_upstream` | GET | `/api/v1/company/feature-flags` | 200|400|502|503|500|404 | 400 | PASS | {"error":"error.app.validation\|detail=Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE.","status":400} |
| 26 | `company.integrations_no_upstream` | GET | `/api/v1/company/integrations/status` | 200|400|502|503|500|404 | 400 | PASS | {"error":"error.app.validation\|detail=Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE.","status":400} |
| 27 | `company.billing_portal_no_upstream` | POST | `/api/v1/company/billing/portal-session` | 200|400|502|503|500|404 | 400 | PASS | {"error":"error.app.validation\|detail=Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE.","status":400} |
| 28 | `patients.unauthorized` | GET | `/api/v1/patients` | 404 | 404 | PASS | null |
| 29 | `pairing.request_for_revoke` | POST | `/api/v1/pairing/request` | 200 | 200 | PASS | {"activationToken":null,"allowedActions":[],"awaitingPin":false,"clusterSas":false,"decidedAt":null,"decidedBy":null,"deviceId":"matrix-replica-revoke","id":"a5519d4d-0f64-4928-b5a9-b92989340d73","requestedAt":"2026-11-2… |
| 30 | `pairing.decide_for_revoke` | POST | `/api/v1/pairing/decide/a5519d4d-0f64-4928-b5a9-b92989340d73` | 200 | 200 | PASS | {"confirmPin":"962960","request":{"activationToken":null,"allowedActions":["sync.push","sync.pull","sync.status","sync.blob.get","sync.blob.put","sync.reconcile","sync.number","pairing.peers"],"awaitingPin":true,"cluster… |
| 31 | `pairing.confirm_for_revoke` | POST | `/api/v1/pairing/confirm/a5519d4d-0f64-4928-b5a9-b92989340d73` | 200 | 200 | PASS | {"activationToken":"mt2.eyJ2ZXJzaW9uIjoyLCJkZXZpY2VJZCI6Im1hdHJpeC1yZXBsaWNhLXJldm9rZSIsInNsYXZlTGFiZWwiOiJSZXZva2UgTWUiLCJtYXN0ZXJEZXZpY2VJZCI6IjgzMWRkZGNkLTcyOWItNGVlMy1hM2UzLWM1ZmNmOTU1M2NiYyIsImFsbG93ZWRBY3Rpb25zIjpb… |
| 32 | `pairing.revoke` | POST | `/api/v1/pairing/revoke/matrix-replica-revoke` | 200|204 | 204 | PASS | null |
| 33 | `pairing.confirm_wrong_pin` | POST | `/api/v1/pairing/confirm/9a4adf6e-f5f9-470f-830d-2dfb376dc584` | 400|404|409 | 409 | PASS | {"error":"error.app.conflict\|detail=pairing_request is not awaiting PIN confirmation","status":409} |
| 34 | `license.clear` | DELETE | `/api/v1/license` | 200|204 | 204 | PASS | null |

## Notes

- `eprescription.submit_stub` expects 500/501 without TI connector.
- Company proxy routes expect 400 when vendor portal URL is unset.
- Auth uses seeded `ahmed@practice.de` / `password123` plus ops JWT.
- Sync/peers use activation token after pairing decide + PIN confirm.
- `license.activate_invalid` returns HTTP 200 with `valid:false` (structured status).
