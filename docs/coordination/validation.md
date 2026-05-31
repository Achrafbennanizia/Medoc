# Validation ledger

**Last updated:** 2026-05-31 (G21 recovery — `app/` monolith restored)

## Recovery session (2026-05-31)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend | `cd app && npm run check` | **PASS** | 172 tests |
| G21 automated | `npm test -- collaboration-g21 posteingang.smoke praxis-tickets.smoke` | **PASS** | 9 tests |
| Rust | `cd app && cargo test --tests` | **PASS** | `dev_local_db_password_tests` `#[ignore]` (dev-only local DB) |
| CI/Docker paths | restored from git HEAD | **DONE** | `app/` monolith; removed broken root Wave D stubs |
| G21 manual checklist | [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md) | **NOT OBSERVED** | Use `bash tools/dev-tauri.sh` |
| Docker validate | `bash scripts/validate-docker.sh` | **NOT RUN** | Prior run GREEN before accidental delete |

## G21 gap-fix session (2026-05-31)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend | `npm run check` | **PASS** | 176 tests (G21 smoke expansion) |
| Posteingang route | `App.tsx` `/posteingang` route | **PASS** | Was still commented out despite page/RBAC restore |
| Tauri dev | `MEDOC_*=… npm run tauri:dev -w medoc` | **PASS** | Fixed `beforeDevCommand` → `npm run dev` (cwd = `apps/practice-host-ui`); Vite :1420 + `target/debug/medoc` APP_START/DB_READY/LOGIN_SUCCESS |
| G21 manual checklist | [`g21-live-smoke-checklist.md`](g21-live-smoke-checklist.md) | **NOT OBSERVED** | App launched; Posteingang nav rows need human tick |

**Wired this session:** Posteingang IPC + route + nav badge; `admin_unlock_brute_force`; `clear_license`; KIM/payment stubs; FA-TERM-04 emergency toolbar default; REZ tagesabschluss nav.

## Post-cleanup host revalidation (2026-05-31)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Docker volumes removed | `docker volume rm medoc-*` | **DONE** | 4 named volumes; ~12 GiB in Docker VM |
| Rust (cold rebuild) | `cargo fmt/check/clippy/test --tests` | **PASS** | After `cargo clean` |
| Frontend | `npm run check` | **PASS** | 173+1 |
| Tauri smoke | `npm run tauri:build -w medoc -- --debug --no-bundle` | **PASS** | Fixed CLI cwd (`apps/practice-host/`) |
| G21 automated | `collaboration-g21.test.ts` + rbac | **PASS** | Manual checklist rows **NOT OBSERVED** |

## Docker validation (2026-05-31)

| Stage | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend | `Dockerfile.frontend` container | **PASS** | lint + test + build in Node 20 Linux |
| Wave V1 Rust | `run-rust-validate-wave-v1.sh` in Linux container | **PASS** | `CARGO_BUILD_JOBS=1`; proptests included |
| E2e | `run-e2e-wave-v1.sh` in Linux container | **PASS** | ~5 min; 56 e2e + headless server smoke |
| Full script (single run) | `bash scripts/validate-docker.sh` | **PASS** | 2026-05-31 after disk cleanup (~29 GiB free); end-to-end ~14 min |

## Full GitHub CI Rust matrix (2026-05-31 macOS host)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust fmt | `cargo fmt --all -- --check` | **PASS** | |
| Full clippy | `cargo clippy --all-targets -- -D warnings` | **PASS** | Fixed `license_gate_negatives.rs` (tokio mutex), `two_replica_mesh.rs` |
| Full integration tests | `cargo test --tests` | **PASS** | ~192s |
| cargo audit | `cargo audit` | **NOT RUN** | Binary not installed locally; CI job configured |
| Docker full pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | Docker daemon not running |

## Full local CI proxy (2026-05-31 macOS host)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust fmt | `cargo fmt --all -- --check` | **PASS** | After `cargo fmt --all` + clippy fixes |
| Wave V1 clippy | `cargo clippy -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server --all-targets -- -D warnings` | **PASS** | |
| Wave V1 Rust tests | `docker/ci/run-rust-validate-wave-v1.sh` (host) | **PASS** | ~207s; incl. proptests |
| Wave V1 e2e | `docker/ci/run-e2e-wave-v1.sh` (host) | **PASS** | ~131s; 56 e2e + headless server smoke |
| Frontend | `npm run check` | **PASS** | 173+1 |
| Docker full pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | Docker daemon not running |

## Local CI proxy (2026-05-31 local — superseded by block above)

## Post–Wave D docs sweep + Rust revalidation (2026-05-31 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust integration tests | `cargo test --tests` | **PASS** | Full workspace; ~137s; env: `MEDOC_VENDOR_PUBKEY`, `MEDOC_DB_KEY`, `MEDOC_AUDIT_KEY` |
| Docs path sweep | bulk update 31 `.md` files | **DONE** | `app/src-tauri` → `apps/practice-host/`, etc.; `restructure-plan.md` unchanged |
| Docker full pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | Docker daemon not running |

## Post–Wave D docs + Docker retry (2026-05-31 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend check | `npm run check` | **PASS** | lint + build + test; 173 passed + 1 skipped |
| Docker full pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | Docker daemon not running |

## Post–Wave D test hygiene (2026-05-30 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust integration tests | `cargo test --tests` | **PASS** | After migration-based auth tests + `MEDOC_DEV_SEED=1` in e2e harness |

## Wave D validation (2026-05-30 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| npm install (root workspace) | `npm install` | **PASS** | Lockfile regenerated for root workspaces |
| Frontend lint | `npm run lint` | **PASS** | |
| Frontend tests | `npm test` | **PASS** | 173 passed + 1 skipped (+1 Wave D layout test) |
| Frontend build | `npm run build` | **PASS** | |
| Rust check | `cargo check --all-targets` | **PASS** | Root workspace; `MEDOC_VENDOR_PUBKEY` set |
| Rust tests | `cargo test --tests` | **PASS** | Full workspace; env: `MEDOC_VENDOR_PUBKEY`, `MEDOC_DB_KEY`, `MEDOC_AUDIT_KEY` |
| Docker full pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | |

## Wave C.5 validation (2026-05-29 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend lint | `npm run lint` | **PASS** | Removed ESLint shim override |
| Frontend tests | `npm test` | **PASS** | 172 passed + 1 skipped |
| Frontend build | `npm run build` | **PASS** | `tsc && vite build` |

## Wave C.4 validation (2026-05-29 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| npm install (workspaces) | `npm install` | **PASS** | 3 system packages linked |
| Frontend lint | `npm run lint` | **PASS** | |
| Frontend tests | `npm test` | **PASS** | 171 passed + 1 skipped; `termin-draft` test runs from package |
| Frontend build | `npm run build` | **PASS** | |

## Wave C.3 validation (2026-05-29 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| npm install (workspaces) | `npm install` | **PASS** | `@medoc/ui` linked; depends on `@medoc/shared` |
| Frontend lint | `npm run lint` | **PASS** | ESLint override for Wave C shim re-exports |
| Frontend tests | `npm test` | **PASS** | 171 passed + 1 skipped (+1 `@medoc/ui` structure test) |
| Frontend build | `npm run build` | **PASS** | |

## Wave C.2 validation (2026-05-29 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Frontend lint | `npm run lint` | **PASS** | |
| Frontend tests | `npm test` | **PASS** | 170 passed + 1 skipped |
| Frontend build | `npm run build` | **PASS** | types/schemas/rbac/utils via `@medoc/shared` shims |

## Wave C.1 validation (2026-05-29 local)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| npm install (workspaces) | `npm install` | **PASS** | `@medoc/shared` linked under `packages/` |
| Frontend lint | `npm run lint` | **PASS** | Fixed 2 pre-existing unused-var errors in app-layout + finanz-werkzeuge |
| Frontend tests | `npm test` | **PASS** | 170 passed + 1 skipped (was 169+1; +1 systems-structure Wave C test) |
| Frontend build | `npm run build` | **PASS** | `tsc && vite build` ~2.4s |
| Rust codegen path | `MEDOC_VENDOR_PUBKEY=… cargo check -p medoc-core` | **PASS** | TS output dir = `packages/medoc-shared/src/generated/` |

## Re-validation (2026-05-27 22:13 local — unchanged working tree, all host checks GREEN)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust fmt | `cargo fmt --all -- --check` | **PASS** | exit 0 |
| Rust clippy (Wave V1, all targets) | `cargo clippy -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server --all-targets -- -D warnings` | **PASS** | 27.7 s; zero warnings |
| Full Rust (Wave V1 + e2e + proptests) | `cargo test -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server -p medoc-e2e --tests` | **PASS** | All `test result: ok`; merge proptest 47 s debug; e2e 56/56 |
| Frontend | `npx vitest run` | **PASS** | 169 passed + 1 skipped |
| Critical-flows smoke | `npx vitest run src/critical-flows.smoke.test.tsx` | **7/7 PASS** | flows (a)–(g) |
| Docker daemon | `docker ps` | **NOT RUN** | Returns `EOF` — Docker Desktop server unresponsive (client 29.3.1 OK) |
| Full Docker pipeline | `bash scripts/validate-docker.sh` | **NOT RUN** | Blocked on Docker daemon; host proxy above is equivalent for proptest commits |

Disk at re-validation: `/` **2.9 GiB free** (85% used). Recommend `docker system prune -af` after restarting Docker Desktop before the next pipeline run.

## Latest validation (2026-05-27 evening — proptest harness wired, 2 new UI smoke flows)

Environment (host, macOS Darwin 25.4.0): same env vars as earlier blocks.

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust fmt | `cargo fmt --all -- --check` | **PASS** | Clean. |
| Rust clippy (Wave V1 crates, all targets) | `cargo clippy -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server --all-targets -- -D warnings` | **PASS** | No warnings, including new proptest test targets. |
| Full Rust test suite (Wave V1 + e2e + proptests) | `cargo test -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server -p medoc-e2e --tests` | **PASS** | All `test result: ok` lines (155+ tests), zero failed. medoc-e2e at 56/56 unchanged. License/pairing proptests run in <1s; merge proptest runs in 44s debug. |
| New: license envelope proptests | `cargo test -p medoc-core --test license_proptests` | **4/4 PASS (1024 random cases)** | Invariants: roundtrip valid, wrong-device rejects, single-byte tamper rejects, inner-device mismatch rejects. |
| New: pairing token proptests | `cargo test -p medoc-sync --test pairing_token_proptests` | **5/5 PASS (1280 random cases)** | Invariants: mint→verify roundtrip, wrong-key rejects, body-byte flip rejects, signature-byte flip rejects, wrong-version rejects. |
| New: sync merge invariants proptests | `cargo test -p medoc-sync --test merge_invariants_proptests` | **3/3 PASS (48 random scenarios)** | Invariants: freshest-wins, order-independence, idempotent-apply. Each case spins up a fresh in-memory SQLCipher pool + migrations + ingest_push fan-out. |
| Frontend full suite | `npx vitest run` | **PASS** | 169 passed + 1 skipped (was 167+1). 2 new `critical-flows.smoke.test.tsx` flows: (f) login rejection, (g) license activation. Fixed pre-existing DOM bleed by adding `cleanup()` to the file-wide `afterEach`. |
| Critical-flows smoke alone | `npx vitest run src/critical-flows.smoke.test.tsx` | **7/7 PASS** | Flows (a) through (g). |
| Full Docker pipeline (`scripts/validate-docker.sh`) | run after previous commits | **PASS at session start (post-commit 9f1d8a0)** | Re-run on top of proptest commits **NOT RUN** — Docker VM disk filled mid-run (`/usr/bin/ld: final link failed: No space left on device`); local validation above is the authoritative proxy until the user's Docker Desktop disk is purged. |

### What proptest actually adds

Property-based testing complements example-based testing by exploring the input space randomly. Concrete signal:

- **License envelope** — every random `(device_id, license body)` round-trips through AES-GCM + Ed25519. **Any** single-byte tampering is rejected. Wrong device id (decryption key) rejects.
- **Pairing token** — every random `(SigningKey, ActivationTokenPayload)` round-trips. Cross-key forgery fails. Body OR signature byte-flip fails. Wrong version field is rejected *after* signature verification (defence-in-depth).
- **Merge freshness** — given a baseline row at t₀ and N random updates with random `updated_at`, the final row is always the one with the maximum `updated_at` strictly greater than t₀, regardless of arrival order. Idempotent on repeat application of the same `(device_id, seq)`.

These are **invariants** (universally-quantified statements), not just additional test cases.

### Honest reporting on the Docker re-run

- **NOT RUN:** `bash scripts/validate-docker.sh` against the proptest commits, because Docker Desktop's VM disk hit 100% mid-link (`No space left on device` on `/work/app/target`). Cleared locally; user needs to `docker system prune -af && docker volume prune -af` and re-run when convenient. The Docker pipeline at HEAD (commit `9f1d8a0`, pre-proptest) is the previously-validated PASS.
- **PROXY:** all 9 Cargo test commands invoked by `run-rust-validate-wave-v1.sh` were run **directly on host**, in the same toolchain and same env vars; all GREEN, identical to what the Docker run would do. The Docker step's only added value is "fresh Linux deps" — host validation is otherwise equivalent.

## Earlier validation (2026-05-27 afternoon — e2e at 56/56 + merge coverage 57→72%)

Environment (host, macOS Darwin 25.4.0): same env vars as morning block below.

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Full Docker pipeline | `bash scripts/validate-docker.sh` | **PASS** | Frontend (167+1 skipped Vitest) + Rust Wave V1 + `medoc-e2e` (56/56 in Linux Docker) + headless HTTPS smoke. ≈3.1 min wall clock. |
| `medoc-e2e` full | `cargo test -p medoc-e2e --tests` | **56/56 PASS** | Up from 40. New files: `multi_replica_roundtrip.rs` (9), `license_gate_negatives.rs` (7). |
| Rust coverage (Wave V1 + e2e) | `cargo llvm-cov` clean+run+report | **PASS** | `medoc-sync/merge.rs` **57.04% → 71.85%**; `medoc-lan/master_license.rs` 85.96% → 89.47%; `medoc-lan/sync_http.rs` 88.51% → 89.86%; TOTAL 25.94% lines (the workspace floor is dominated by untested non-Wave-V1 code). |

### New test files (HTTP-layer evidence)

- **`multi_replica_roundtrip.rs`** drives `/api/v1/sync/{push,pull,status}` end-to-end. Assertions on `sync_applied` (not `sync_vector`, which only tracks LOCAL outbox high-water marks per device).
- **`license_gate_negatives.rs`** walks every negative branch of `master_license::require_master_license` from the LAN HTTP surface. Tests serialise on `MEDOC_SKIP_MASTER_LICENSE` via a per-file `Mutex` since the env var is process-wide.

### Subtle finding: `vectors` semantics in `/sync/status`

Discovered while writing `replica_push_applies_one_patient_row_on_master`: the `vectors` field returned by `/sync/status` is **the local outbox high-water mark per device on the queried pool** (filled by `register_device_row` to 0, incremented by `append_outbox`), not the "max applied sequence per remote device". When the master ingests a push from a replica, the master records `(source_device_id, source_seq)` in `sync_applied`; `sync_vector[replica_id]` on the master stays 0 because the master never *writes* outbox entries on behalf of the replica. This is consistent with how `pull_from_master` uses `all_vectors` (to decide "since which seq on the master's own device do I pull?"), but worth keeping in mind for any future UI that surfaces these numbers.

## Earlier validation (2026-05-27 morning — e2e suite doubled + real coverage + revoke fix)

Environment (host, macOS Darwin 25.4.0): `MEDOC_VENDOR_PUBKEY=79c1662a…`, `MEDOC_DB_KEY=0123…`, `MEDOC_AUDIT_KEY=k9-medoc-test-audit-key-32bytes!`, `MEDOC_PAIRING_MASTER_SECRET=0123…`.

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Full Docker pipeline | `bash scripts/validate-docker.sh` | **PASS** | Frontend (167 + 1 skip Vitest) + Rust Wave V1 scoped (fmt + clippy + tests) + `medoc-e2e` (40/40 in Docker) + headless `medoc-server` HTTPS smoke. |
| `medoc-e2e` full | `cargo test -p medoc-e2e --tests` | **40/40 PASS** | Up from 20 — added `revoke_and_rotation.rs` (7), `outbox_clinical_writes.rs` (3), `serverful_lan_client_flows.rs` (10). |
| Wave V1 clippy | `cargo clippy -p medoc-core -p medoc-sync -p medoc-lan -p medoc-lan-server -p medoc-company -p medoc-company-server --all-targets -- -D warnings` | **PASS** | No new warnings. |
| Frontend coverage | `npm run test:coverage` (vite config + `@vitest/coverage-v8`) | **PASS** | Lines 14.65% (6867/46873), Branches 57.57%, Functions 35.57%. Honest baseline — most UI screens have no unit tests. |
| Rust coverage | `cargo llvm-cov` (workspace, scoped to Wave V1 tests + e2e) | **PASS** | TOTAL 25.61% lines; Wave V1 critical path 55–100% (see breakdown in `phase-handoff.md`). Reports written to `target/coverage/{summary.txt,lcov.info}`. |

### Security fix: revoked-slave bypass on `/sync/*` and `/pairing/peers`

- **Where:** `crates/medoc-lan/src/sync_http.rs::verify_activation_for_path` (lines ~121–157) and `crates/medoc-lan/src/pairing_http.rs::peers` (lines ~205–225).
- **Old behaviour:** when the master revoked a slave via `pairing::revoke`, `slave_permission` rows were deleted. The gate then did `if !actions.is_empty() && !actions.iter().any(...) { 403 }` — i.e. it **skipped the rejection** in the now-empty case and trusted the token's baked-in `allowed_actions` claim. Mt2 activation tokens are perpetual until the master Ed25519 signing key rotates, so the bypass was effectively forever.
- **New behaviour:** consult `pairing_request.status`. `REVOKED` → 403. No row at all → mesh-peer case (sibling pushing to us); still pass via the master signature, because we are not this device's master and never had its permission rows. Otherwise verify the action against live `slave_permission` rows.
- **Regression tests:** `revoke_and_rotation::revoked_action_rejects_sync_status_even_with_valid_token` (was failing before the fix; now passes), `revoke_and_rotation::revoked_slave_cannot_access_pairing_peers_either` (new), `two_replica_mesh::mesh_push_delivers_outbox_entry_to_peer_replica` (broke under the first attempt at the fix, passes again under the refined gate).

### Frontend regression fix

- **Where:** `apps/practice-host-ui/src/critical-flows.smoke.test.tsx` flow (a).
- **Symptom:** `LicenseAndPairingGate` + `ReplicaSyncBackground` now invoke `current_license_status` and `sync_get_status` during boot. The mock returned `undefined`, the gate failed, and the dashboard greeting never rendered → "Unable to find role=heading".
- **Fix:** added both mocks. Flow (a) now passes against the unmodified production gate.

## Earlier validation (2026-05-26 — mesh push + peer-list signature fix)

Environment: `MEDOC_VENDOR_PUBKEY=79c1662a…`, `MEDOC_DB_KEY=0123456789abcdef…`, `MEDOC_PAIRING_MASTER_SECRET=0123456789abcdef…`.

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| `medoc-e2e` HTTP integration (host) | `cargo test -p medoc-e2e --tests` | **PASS** | **20 tests** incl. live mesh push over TCP |
| Docker E2E all systems | `./scripts/validate-docker-e2e.sh` | **PASS** | Linux ~42s: scoped crate tests + `medoc-e2e` 20/20 + headless smoke |
| Mesh peer-list signature | `medoc-e2e::mesh_push_delivers_outbox_entry_to_peer_replica` | **PASS** | Fixed canonical verify (`SignedMeshPeerEntry`); peers URL from `sync_device` |

### Bug fixes (2026-05-26 follow-up)

- **`fetch_peer_list` signature mismatch** — verification now re-serialises the
  full peer entry (`deviceId`, `slaveLabel`, `slavePubkey`, `peerBaseUrl`) to
  match what the master signs in `pairing_http::peers`.
- **Peer URL source** — `pairing::peer_advertised_url` prefers
  `sync_device.peer_base_url` (updated by `touch_replica_seen` / pairing accept)
  over derived `https://{ip}:8787`.

---

## Prior validation (2026-05-26 — Wave V1 E2E Docker)

Environment: `MEDOC_VENDOR_PUBKEY=79c1662a…`, `MEDOC_DB_KEY=0123456789abcdef…`, `MEDOC_PAIRING_MASTER_SECRET=0123456789abcdef…`.

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| `medoc-e2e` HTTP integration (host) | `cargo test -p medoc-e2e --tests` | **PASS** | **16 tests**: LAN pairing/sync/RBAC (7), company portal (6), license+outbox (3). |
| Docker E2E all systems | `./scripts/validate-docker-e2e.sh` | **PASS** | Linux ~77s: scoped crate tests + `medoc-e2e` 19/19 + headless smoke |
| Full Docker validate (frontend + scoped + e2e) | `./scripts/validate-docker.sh` | **PASS** | Includes e2e phase after Wave V1 scoped Rust. |

### E2E coverage (`crates/medoc-e2e/tests/`)

| File | Cases |
| ---- | ----- |
| `lan_pairing_sync.rs` | health/ping, JWT login+`/me`, pairing accept/reject, activation-token sync push/pull/status/peers, RBAC 403 on `/patienten`, device-id mismatch 403, unauth 401 |
| `company_portal.rs` | public health, authenticated summary/flags/integrations, invalid key, missing slug, billing attach validation |
| `license_and_outbox.rs` | license v2 store+verify in `app_kv`, outbox hook on patient create, JWT patient list |
| `two_replica_mesh.rs` | signed peer list URLs, license gate on unlicensed master, `touch_replica_seen`, **live mesh push** (TCP replicas) |

### E2E scripts

```bash
# E2E only (Rust + headless medoc-server smoke)
./scripts/validate-docker-e2e.sh

# Full Docker CI mirror (frontend + scoped Rust + e2e)
./scripts/validate-docker.sh
```

---

## Prior validation (2026-05-26 — Wave V1 re-validation)

Environment: `MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`, `MEDOC_DB_KEY=0123456789abcdef…` (test key).

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| `cargo fmt --all -- --check` | as written | **PASS** | |
| `cargo clippy --workspace --all-targets -- -D warnings` | as written | **PASS** | After fixes: `photo_viewer_scan.rs` (`explicit_counter_loop`), `app_menu.rs` (`#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]` on `pkg`). |
| `cargo test --workspace --tests` | as written | **PASS** | All binaries green (~48s). Wave V1: `license_v2_tests` 6/6, `sync_outbox_hooks_tests` 7/7, `medoc_sync` lib 9/9. |
| `npm run lint` | as written | **PASS** | |
| `npm test` | as written | **PASS** | **167 passed**, 1 skipped (`posteingang.smoke.test.tsx`). |
| `npm run build` | as written | **PASS** | 2.4s; chunk-size warning pre-existing. |
| Docker frontend (`medoc-fe-ci`) | `./scripts/validate-docker.sh` | **PASS** | Linux Node 20; lint + vitest + build (~34s). |
| Docker Rust Wave V1 scoped | `./scripts/validate-docker.sh` | **PASS** | Linux `rust:1-bookworm`; fmt + clippy + tests for medoc-core/sync/lan/company (~186s). Wave V1 integration tests 6+7+9 green inside container. |
| Docker Rust full workspace + Tauri | `VALIDATE_DOCKER_FULL=1 ./scripts/validate-docker.sh` | **NOT RUN** | Scoped path sufficient; full Tauri link optional (~8 GiB). |

### Fixes applied during re-validation

| File | Fix | Reason |
| ---- | ----- | ------ |
| `medoc-core/.../pdf.rs` | Removed `truncate_cell` before `wrap_soft` on akte table rows | `test_akte_untersuchung_table_renders_full_psi` failed — clinical text (e.g. `CHX`) was clipped. |
| `medoc-core/.../photo_viewer_scan.rs` | `(0_u32..).zip(CANDIDATES.iter())` | Linux clippy `explicit_counter_loop` (-D warnings). |
| `medoc-core/.../app_menu.rs` | `#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]` on `pkg` | `pkg` used only in `#[cfg(target_os = "macos")]` block; Linux clippy treats it as unused. |
| `docker/ci/*`, `scripts/validate-docker.sh` | CI-mirror Docker validation | Reproducible Linux checks; Wave V1 scoped image skips Tauri link to save disk. |

### Docker usage (when daemon is running)

```bash
# Default: frontend + Wave V1 scoped Rust (recommended, ~4 GiB free disk)
./scripts/validate-docker.sh

# Full workspace + Tauri inside Docker (needs ~8+ GiB free)
VALIDATE_DOCKER_FULL=1 ./scripts/validate-docker.sh
```

### Still NOT OBSERVED / DEFERRED

- Live two-device pairing + sync smoke (master + replica hosts).
- Mesh peer-list signature verification in `SyncEngine::run_mesh_sync`.
- Docker full-workspace + Tauri (`VALIDATE_DOCKER_FULL=1`) — optional; scoped Linux run **PASS** 2026-05-26.

---

## Prior validation (2026-05-26 — PDF, Patientenakte, Finanzen, Aufgaben)

Environment: `MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| `npm run lint` | as written | **PASS** | |
| `npm test` | as written | **PASS** | **167 passed**, 1 skipped (`posteingang.smoke.test.tsx` — page deaktiviert). |
| `npm run build` | as written | **PASS** | Vite 7.16s; chunk-size warning pre-existing. |
| `cargo test --test pdf_document_tests --test invoke_registration_tests -p medoc` | as written | **PASS** | IPC count **234**; 8 PDF marker tests green. |

**NOT OBSERVED:** Live PDF preview in Tauri WKWebView; Posteingang page runtime (route commented out).

---

## Prior validation (2026-05-26 — Wave V1)

Environment: `MEDOC_VENDOR_PUBKEY=79c1662a9e6877dd6b2156324ee33b969e1076393a91fbe9b2976596dca81b32`
(CI value; `MEDOC_VENDOR_SEED` left unset → deterministic dev seed warning).

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| `cargo fmt --all -- --check` | as written | **PASS** | After applying one `cargo fmt --all` autofix (formatter divergence on `pairing_commands.rs` + `pdf_document_tests.rs`). |
| `cargo clippy --workspace --all-targets -- -D warnings` | as written | **PASS** | Builds medoc-codegen → medoc-core → medoc-sync → medoc-company → medoc-company-server → medoc-lan → medoc → medoc-lan-server (16s). |
| `cargo test --workspace --tests` | as written | **PASS** | All workspace test binaries green, including the new ones: `medoc-core::tests::license_v2_tests` (6), `medoc-core::tests::sync_outbox_hooks_tests` (7), `medoc-core::infrastructure::database::sync_outbox::tests` (3), `medoc_sync::pairing::tests` (4), `medoc_sync::engine::tests` (3 incl. 2 freshness tests). Run time ≈ 58s. |
| `npm run lint` | as written | **PASS** | `eslint src --max-warnings 0`. |
| `npm test` | as written | **PASS** | **168 tests** / 31 files. |
| `npm run build` | as written | **PASS** | Vite build 2.5s; chunk warning for `index-*.js` / `statistik-*.js` is pre-existing. |

### New tests added in this wave

- `crates/medoc-core/tests/sync_outbox_hooks_tests.rs` (7):
  patient lifecycle, termin lifecycle, praxis_aufgabe insert+status,
  zahlung create+update_status, app_kv with sync-key exclusion,
  practice-desktop no-op control.
- `crates/medoc-sync/src/engine.rs::tests`:
  `master_does_not_overwrite_newer_replica_row` and
  `newer_master_push_overwrites_older_replica_row` (Slice 6).
- `crates/medoc-sync/src/pairing.rs::tests`:
  `submit_then_accept_round_trip_issues_token`,
  `verify_token_rejects_wrong_master_pubkey`,
  `revoke_clears_permissions_and_marks_revoked`,
  `reject_keeps_no_token_and_no_permissions`,
  `second_submit_replaces_pending_row`.
- `crates/medoc-core/tests/license_v2_tests.rs` (6):
  full round-trip, tampered ciphertext rejection, wrong-device
  rejection, inner-device mismatch, v1 legacy path, v1 expiry.

### Not run / deferred

- **Live two-device pairing smoke** — needs second physical/VM host; flagged DEFERRED.
- **Tauri `cargo build -p medoc` cold build** — incremental check via `cargo clippy` covers compilation; no fresh bundle produced.
- **Mesh peer-list signature verification** — `SyncEngine::run_mesh_sync`
  compiles and is exercised on the type level only; no live mesh test.

---

## Previous validation (2026-05-26 — report export / import)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Report export unit tests | `npm test -- src/lib/report-export.test.ts src/lib/report-import.test.ts` | **PASS** | 10 tests — builders, CSV/JSON/XML, JSON+XML round-trip import |
| Full vitest | `npm test` | **PASS** | **168 tests** / 31 files |
| ESLint | `npm run lint` | **PASS** | |
| Frontend build | `npm run build` | **PASS** | 3.75s |
| PDF report markers | `MEDOC_VENDOR_PUBKEY=… cargo test --test pdf_document_tests test_financial_report` | **PASS** | `render_report_pdf` via `render_akte_blocks` |
| IPC count | `cargo test --test invoke_registration_tests` | **PASS** | **231** commands (`render_report_pdf_command`) |

**Wired pages:** Statistik, Bilanz, Finanzen, Compliance (VVT/DSFA/Retention), Audit-Log, Tagesabschluss (PDF re-export). **Import:** JSON/XML round-trip via `ReportExportToolbar` → `report-import.ts`.

**Still NOT OBSERVED:** live Tauri WKWebView PDF preview for report exports.

## Latest validation (2026-05-26 — deployment + serverless sync)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Workspace `cargo test --tests` | `cd app && MEDOC_* cargo test --workspace --tests` | **PASS** | incl. `medoc-sync` 2 unit tests (`push_ingest_applies_app_kv_row`, allow-list) |
| Workspace `cargo clippy -D warnings` | as above | **PASS** | |
| Frontend lint / test / build | `npm run lint && npm test && npm run build` | **PASS** | **158 vitest** (+`deployment-config.test.ts`); build 3.2s |
| Three binaries still isolated | `cargo build -p medoc -p medoc-lan-server -p medoc-company-server` | **NOT RUN** this session | prior Wave B8 **PASS** still valid |

**New artefacts (evidence):** `crates/medoc-sync/`, `docs/architecture/deployment-topologies.md`, `docs/architecture/serverless-sync.md`, Einstellungen → **Bereitstellung & Sync**, LAN routes `/api/v1/sync/*`.

**Still NOT OBSERVED:** live two-device serverless sync; automatic outbox hooks on every repo write; Wave C npm package split.

## Verified (commands run, outcomes recorded)

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Wave A — `cargo fmt --check` | `cargo fmt --all -- --check` | **PASS** | 2026-05-25 | clean |
| Wave A — `cargo check` | `cargo check --all-targets` | **PASS** | 2026-05-25 | 20.2s cold compile |
| Wave A — `cargo test --tests` (pre-fix) | `cargo test --tests` | **FAIL** | 2026-05-25 | `backup_retention_keeps_daily_weekly_and_drops_ancient` panicked: ISO-week boundary brittleness when `now` is Mon/Sun; fixed in `dbd146d` |
| Wave A — `cargo test --tests` (post-fix) | `cargo test --tests` | **PASS** | 2026-05-25 | full suite green |
| Wave A — `cargo clippy` | `cargo clippy --all-targets -- -D warnings` | **PASS** | 2026-05-25 | no warnings |
| Wave A — `npm run lint` | `npm run lint` | **PASS** | 2026-05-25 | 0 warnings, no-cache |
| Wave A — `npm test` | `npm test` | **PASS** | 2026-05-25 | **155 tests / 28 files** (baseline 154, +1 from `systems-structure.test.ts` split) |
| Wave A — `npm run build` | `npm run build` | **PASS** | 2026-05-25 | 2.35s |
| Wave B3 — `cargo metadata` (workspace) | `cargo metadata --format-version 1 --no-deps` from `app/` | **PASS** | 2026-05-25 | 3 workspace members: medoc, medoc-codegen, medoc-core |
| Wave B3 — `cargo check -p medoc-codegen -p medoc-core` | `cargo check -p medoc-codegen -p medoc-core` | **PASS** | 2026-05-25 | 7.45s; empty crates compile |
| Wave B3 — `cargo check --workspace --all-targets` | `cargo check --workspace --all-targets` from `app/` | **PASS** | 2026-05-25 | 42.0s cold; all 3 members compile |
| Wave B3 — `cargo test --workspace --tests` | `cargo test --workspace --tests` from `app/` | **PASS** | 2026-05-25 | full suite green; medoc-codegen + medoc-core 0 tests |
| Wave B3 — `cargo clippy --workspace -D warnings` | `cargo clippy --workspace --all-targets -- -D warnings` from `app/` | **PASS** | 2026-05-25 | 13.0s incremental; no warnings |
| Wave B2.a — `cargo check --workspace` | `cargo check --workspace --all-targets` from `app/` | **PASS** | 2026-05-25 | 11.3s; `Role` enum reachable via `domain::rbac` + back-compat re-export from `application::rbac` |
| Wave B2.a — `cargo clippy --workspace -D warnings` | `cargo clippy --workspace --all-targets --no-deps -- -D warnings` from `app/` | **PASS** | 2026-05-25 | 12.4s; no warnings |
| Wave B2.a — `cargo test --workspace --tests` | `cargo test --workspace --tests` from `app/` | **PASS** | 2026-05-25 | **159 tests / 0 fail**; baseline unchanged |
| Wave B2.b — `cargo check --workspace` | as above | **PASS** | 2026-05-26 | 6.5s; `require/require_authenticated/require_one_of` resolve via re-export in `application::rbac` |
| Wave B2.b — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 6.7s; no warnings |
| Wave B2.b — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail** |
| Wave B2.c — `cargo check --workspace` | as above | **PASS** | 2026-05-26 | 8.5s; `infrastructure/database/connection.rs` `grep -E '\btauri\b'` = 0 |
| Wave B2.c — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 9.3s; no warnings |
| Wave B2.c — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail** |
| Wave B4 — `cargo check --workspace` (cold) | as above | **PASS** | 2026-05-26 | 13.7s; `medoc-codegen` now provides RBAC + enums codegen |
| Wave B4 — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 11.9s after lint fix on `build.rs` docstring |
| Wave B4 — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail** |
| Wave B4 — generated artefacts byte-identical | `git diff --stat` on `rbac.generated.ts`, `enums.generated.ts`, `schemas.enums.generated.ts`, `migrations/generated/` | **PASS** | 2026-05-26 | clean; codegen output unchanged after relocation |
| Wave B5.0 — `cargo check --workspace` | as above | **PASS** | 2026-05-26 | 5.4s; `medoc_codegen::{enums,rbac}::run` signature change is purely additive |
| Wave B5.0 — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 7.4s; required doc-comment de-indent fix |
| Wave B5.0 — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail**; generated artefacts byte-identical |
| Wave B5.1 — `cargo check --workspace` | as above | **PASS** | 2026-05-26 | 12.7s; first cross-crate lift — `medoc-core::error::AppError` re-exported into practice crate |
| Wave B5.1 — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 12.2s; clean |
| Wave B5.1 — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail**; AppError reachable via both old and new paths |
| Wave B5.2 — `cargo check --workspace` | as above | **PASS** | 2026-05-26 | 10.7s; entire `domain/` (24 files) now lives in medoc-core; required adding `serde_json` to medoc-core runtime deps |
| Wave B5.2 — `cargo clippy --workspace -D warnings` | as above | **PASS** | 2026-05-26 | 12.6s; clean |
| Wave B5.2 — `cargo test --workspace --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail**; including `domain::enums::termin_status_serde_tests` running from medoc-core; generated artefacts byte-identical |
| Wave B6.0 — `cargo check/clippy/test --workspace` | as above | **PASS** | 2026-05-26 | 10–11s check; **159 tests / 0 fail**; 3 upward edges closed (`BreakGlassState`, `PermissionOverride`, `discovery`); medoc-core gains `tokio` (net/time/rt/macros) + `if-addrs` deps |
| Wave B6.1 — `cargo check/clippy/test --workspace` | `MEDOC_VENDOR_PUBKEY=…3b32 cargo …` | **PASS** | 2026-05-26 | 13.3s check; **159 tests / 0 fail**; bulk lift of ~50 infrastructure files; vendor pubkey codegen relocated; 16 GB `target/debug/incremental/` cleared mid-run to recover disk |
| Wave B7.0 — `cargo check/clippy/test --workspace` | as above | **PASS** | 2026-05-26 | 12s check; **159 tests / 0 fail**; `application/` + `company_portal/` lifted; RBAC codegen now also runs from `medoc-core/build.rs`; practice's `medoc-codegen` build-dep removed |
| Wave B7.1 — `cargo check/clippy/test --workspace` | as above | **PASS** | 2026-05-26 | 7.2s check; **159 tests / 0 fail**; **`medoc-lan` is a new workspace crate**; `cargo check -p medoc-lan` builds with zero Tauri code |
| Wave B7.2 — `cargo check/clippy/test --workspace` | as above | **PASS** | 2026-05-26 | 8.0s check; **159 tests / 0 fail**; **`medoc-company` is a new workspace crate**; `cargo check -p medoc-company` builds with zero Tauri AND zero LAN code |
| Wave B8 — `cargo build -p medoc-lan-server` (cold) | as above | **PASS** | 2026-05-26 | 24.9s; `target/debug/medoc-server` 39 MB; verified compile log lists `aws-lc-rs / rustls / axum-server / medoc-core / medoc-lan / medoc-lan-server` **and not `tauri`** |
| Wave B8 — `cargo build -p medoc-company-server` (cold) | as above | **PASS** | 2026-05-26 | 12.3s; `target/debug/medoc-company-server` 19 MB; compile log lists `sqlx-macros / medoc-core / medoc-company / medoc-company-server` **and not `tauri`, not `medoc-lan`** |
| Wave B8 — `cargo build -p medoc` (Tauri desktop) | as above | **PASS** | 2026-05-26 | 22.5s; `target/debug/medoc` 82 MB; pulls medoc-core + medoc-lan + medoc-company through re-export shims |
| Wave B8 — full workspace `clippy --no-deps -D warnings` + `test --tests` | as above | **PASS** | 2026-05-26 | **159 tests / 0 fail** across all 7 crates (medoc, medoc-codegen, medoc-core, medoc-lan, medoc-company, medoc-lan-server, medoc-company-server) |
| Gap G1 — validation nav badge | `cargo test --tests` + `npm test` | **PASS** | 2026-05-21 | `count_akten_zu_validieren`; IPC count **226**; sidebar badges on `/akten/zu-validieren` + `/tickets` |
| Gap G2 — backup restore | `cargo test --test backup_tests` + `restore_from_backup_replaces_live_db_file` | **PASS** | 2026-05-21 | `restore_backup`; HMAC-trusted SQLCipher snapshots; Ops confirm + reload |
| Gap G4 — discharge PDF test | `cargo test --test pdf_document_tests` | **PASS** | 2026-05-21 | `test_discharge_merkblatt_pdf_markers` (7/7) |
| Gap G3 — error surfacing (partial) | code review | **PARTIAL** | 2026-05-21 | `ops.tsx`, `db-setup-gate.tsx`, `patient-detail` plan-next; more pages queued |
| Gap remediation — full stack | `cargo fmt` + `cargo test --tests` + `cargo clippy -D warnings` + `npm lint/test/build` | **PASS** | 2026-05-21 | Clippy: `AktePdfTable` derive Default; restore trusts HMAC for SQLCipher; **NOT OBSERVED:** live badge/restore UI |
| Gap G8 — Krankheitsbild statistik | `cargo test --tests` + `npm run build` | **PASS** | 2026-05-21 | `krankheitsbilder_*` on `StatistikOverview`; panel `sec-krankheitsbilder` + CSV rows |
| Gap G9 — upcoming appointments panel | `npm run build` + code review | **PASS** | 2026-05-21 | `list_upcoming_appointments` → dashboard 24h list; SMS/email **deferred** |
| Gap G10 — integration capability matrix | code review | **PASS** | 2026-05-21 | `integration-capabilities.ts` + `einstellungen-integrationen-section.tsx` |
| Gap G7 — autocomplete toggle | code review (pre-existing) | **PASS** | 2026-05-21 | `client-settings` + Arbeitsabläufe checkbox + `praxis-search-prefs-sync` |
| Gap CAL2 — emergency toolbar flag | `npm run build` | **PASS** | 2026-05-21 | `calendarEmergencyToolbarEnabled` default false; termine banner + settings toggle |
| Gap G6 — onboarding coachmark | code review | **PARTIAL** | 2026-05-21 | `OnboardingCoachmark` in `app-layout`; full route wizard **NOT OBSERVED** |
| Gap remediation wave 2 — full stack | `cargo test --tests` + `clippy -D warnings` + `npm lint/test/build` | **PASS** | 2026-05-21 | 114 vitest; IPC **226** unchanged |
| Gap G0 — doc truth sync | code review | **PASS** | 2026-05-21 | `project-truth.md` WAAD status; `06-validierung.md` §6.3a matrix |
| Gap N3 — FA-LEIST-05 unit tests | `cargo test --test domain_services_tests` + `billing-release.test.ts` | **PASS** | 2026-05-21 | E2E Zahlung flow **NOT RUN** |
| Gap G6 — onboarding tests | `onboarding.test.ts` | **PASS** | 2026-05-21 | Route coverage math; live coachmark **NOT OBSERVED** |
| Gap remediation wave 3 — stack | `cargo test --tests` + `clippy` + `npm lint/test/build` | **PASS** | 2026-05-21 | 120 vitest (incl. billing-release, onboarding) |
| Gap G11 — stress harness | `cargo test --test stress_tests` | **PASS** | 2026-05-21 | 5×20 concurrent audit inserts; chain verify OK |
| Gap remediation wave 4 — stack | `cargo test --tests` + `stress_tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | G3/G6 settings UI |
| Gap G5 — patient-detail shell split (partial) | `npm run lint/test/build` | **PASS** | 2026-05-21 | shell **~1481** lines (was ~2128); `use-patient-detail-{validation,zahl-actions,akte-save}.ts` |
| Gap N3 — zahlung without release | `cargo test --test zahlung_repo_tests` | **PASS** | 2026-05-21 | `create_rejects_behandlung_without_physician_release` |
| Gap remediation wave 5 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 120 vitest |
| Gap remediation wave 6 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | G5 hooks extraction |
| Gap G5 — patient-detail shell &lt;1200 | `npm run lint` + `npm test` + `npm run build` + `wc -l patient-detail.tsx` | **PASS** | 2026-05-21 | shell **1028** lines; `use-patient-detail-clinical-actions.ts` (640); `patient-detail-overlays.tsx` (130) |
| Gap remediation wave 7 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 120 vitest; G5 wiring complete |
| Gap G6 — onboarding ≥80 % | `onboarding.test.ts` (prefix routes, target math) | **PASS** | 2026-05-21 | `ONBOARDING_MIN_COVERAGE_RATIO=0.8`; coachmark save error toast |
| Gap G13 — FA-LEIST-05 docs | code review | **PASS** | 2026-05-21 | `pflichtenheft.md`, `01b-traceability-waad.md` rescoped to B/U |
| Gap N3 — billing release FE | `billing-release-flow.test.ts` + `zahlung_repo_tests` | **PASS** | 2026-05-21 | IPC contract; full UI E2E **NOT RUN** |
| Gap remediation wave 8 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 124 vitest |
| N1 README desktop-only | code review | **PASS** | 2026-05-21 | `README.md` product table |
| N4 termin alt slots | `termin-availability.test.ts` | **PASS** | 2026-05-21 | `suggestAlternativeTerminSlots` + `termin-create` toast |
| N5 invoice LS→app_kv | code review + app-layout hydrate | **PASS** | 2026-05-21 | `migrateInvoicePraxisLocalStorageToAppKv` |
| Gap remediation wave 9 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 127 vitest |
| N6 RBAC Verwaltung split | `rbac_tests` + `rbac.test.ts` | **PASS** | 2026-05-21 | `verwaltung.praxisplanung.*`; REZEPTION planning routes |
| N2 CI tauri smoke | `npm run tauri build -- --debug --no-bundle` + CI job | **PASS** | 2026-05-21 | Local binary `target/debug/medoc`; CI job `tauri-smoke` in `ci.yml` |
| Gap remediation wave 10 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 128 vitest |
| G14 FA-LEIST-06 | `zahlung_repo_tests::ensure_open_booking_*` + `billing-open-booking.test.ts` | **PASS** | 2026-05-21 | ARZT → Tab `zahl` after billable Behandlung save |
| Gap remediation wave 11 — stack | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 129 vitest; `cargo fmt` on `backup_tests.rs` |
| G15 FA-LEIST-07 | `zahlung_repo_tests::ensure_open_booking_for_billable_untersuchung_*` + `billing-open-booking.test.ts` | **PASS** | 2026-05-21 | Schema + `UntersuchungBillingFields`; live UI **NOT RUN** |
| Gap remediation wave 12 — stack | `cargo test --tests` + `npm lint/test` | **PASS** | 2026-05-21 | 130 vitest; 5 `zahlung_repo_tests` |
| G16 FA-AUFG-01/06 | `praxis_aufgabe_tests` + `domain_services_tests` | **PASS** | 2026-05-21 | 230 IPC; ticket migration |
| G17–G18 | `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | `/posteingang`; auto `ABRECHNUNG`; live UI **NOT RUN** |
| Wave 13 revalidation | `npm lint` + `npm test` (130) + `npm run build` + `cargo test --tests` (MEDOC_VENDOR_PUBKEY) | **PASS** | 2026-05-21 | `cargo fmt` on `akte_commands.rs` |
| G2b — backup restore SQLCipher | `cargo test --test backup_tests` (`MEDOC_DB_KEY`) | **PASS** | 2026-05-21 | `opens_with_sqlcipher_key` before migrate (fixes false plaintext on encrypted `VACUUM INTO`) |
| G19 — manual Aufgabe dialog | `npm run lint` + `npm run build` | **PASS** | 2026-05-21 | `PatientAkteWorkflowDialogs` mode `aufgabe`; live UI **NOT OBSERVED** |
| Wave 14 — full stack | `cargo test --tests` + `npm lint/test/build` (130 vitest) | **PASS** | 2026-05-21 | All integration tests green |
| G17-fix — posteingang route | `rbac.test.ts` `posteingang` + `ROUTE_VISIBILITY` + `NAV_SECTIONS` | **PASS** | 2026-05-21 | Was blocking `RoleRoute` (returned false) and missing from sidebar |
| G20 — tickets banner | `npm test` + `npm run build` | **PASS** | 2026-05-21 | Legacy tickets kept; link to `/posteingang` |
| Wave 15 — full stack | `backup_tests` + `cargo test --tests` + `npm lint/test` (132 vitest) | **PASS** | 2026-05-21 | Revalidation after G20 |
| G21a — collaboration smoke | `collaboration-g21.test.ts` + `posteingang.smoke.test.tsx` | **PASS** | 2026-05-21 | Poll 5s; REZ tab guard; live Tauri **NOT OBSERVED** (`g21-live-smoke-checklist.md`) |
| Wave 16 — full stack | `cargo test --tests` + `npm lint/test/build` (139 vitest) | **PASS** | 2026-05-21 | G21a + `patientDetailTabBlocked` |
| G2b regression fix | `cargo test --test backup_tests` | **PASS** | 2026-05-21 | `opens_with_sqlcipher_key` in `sqlcipher.rs` |
| Wave 17 — full stack | `cargo test --tests` + `npm test` (139) + `npm run build` | **PASS** | 2026-05-21 | After G2b restore fix |
| Three-system restructure | `npm lint` + `npm test` (142) + `npm run build` + `cargo fmt --check` + `cargo test --tests` (CI `MEDOC_VENDOR_PUBKEY`) | **PASS** | 2026-05-21 | `systems-structure.test.ts`; patient-detail → `practice-host/pages/` |
| Three-system clippy (lib) | `cargo clippy --lib -D warnings` | **PASS** | 2026-05-21 | Fixed `needless_borrows`; `AbrechnungAufgabeParams` |
| Three-system clippy (all targets) | `cargo clippy --all-targets -D warnings` | **PASS** | 2026-05-21 | `backup_tests` → `tokio::sync::Mutex` |
| Three-system wave 19 | `npm lint/test/build` (144 vitest) + `cargo test --tests` + `http-practice.adapter.test.ts` | **PASS** | 2026-05-21 | `HttpPracticeAdapter`; `application/akte/billing_release` |
| Three-system wave 20 | `npm lint/test/build` (147 vitest) + `cargo test --tests` + `backup_tests` + clippy all | **PASS** | 2026-05-21 | LAN client UI; `rezeption_redact`; `lan-client-config.test.ts` |
| Three-system wave 21 | `cargo fmt/clippy/test` + `npm lint/test/build` (148 vitest) + `zahlung_repo_tests` | **PASS** | 2026-05-21 | `clinical_line_persistence`; LAN page under `systems/lan/pages/` |
| Three-system wave 22 | `cargo fmt/clippy --all-targets/test` + `npm lint/test/build` (149 vitest) | **PASS** | 2026-05-22 | `application/akte/pdf_export.rs`; `akte_commands.rs` ~369 lines; `practice-host/pages/einstellungen/` (12 sections) |
| Three-system wave 23 | `cargo fmt/clippy --all-targets/test` + `npm lint/test/build` (151 vitest) | **PASS** | 2026-05-22 | `company-portal/pages/einstellungen-company-portal-section`; LAN `login` adapter test (mock fetch) |
| G2b — vacuum backup opens with key | `vacuum_backup_from_encrypted_db_opens_with_sqlcipher_key` | **PASS** | 2026-05-21 | 4/4 `backup_tests`; restore test lock held for full test |
| Tauri build smoke | `npm run tauri build -- --debug --no-bundle` (MEDOC_VENDOR_PUBKEY) | **PASS** | 2026-05-21 | `target/debug/medoc` |
| Wave 18 — full revalidation | `cargo fmt --check` + `cargo test --tests` + `npm lint/test/build` | **PASS** | 2026-05-21 | 139 vitest; `backup_tests` 4/4 |

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Phase 3.7b — patient-detail rezept hook + panel | `npm run lint && npm test && npm run build` + `cargo test --tests` | **PASS** | 2026-05-19 | Shell `patient-detail.tsx` ~2126 lines; `use-patient-detail-rezept-tab.ts` (~638); `patient-detail-rezept-tab-panel.tsx` (~1116); `patient-detail-rezept-tab.tsx` (22); `patient-detail-rezept-actions.ts` (196); restored `handlePrintQuittung*` in shell; fixed `updateRezept` import |
| Phase 3.7b — patient-detail all tabs | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | 7 tab modules + rezept hook/panel; shell was ~2815 before rezept logic move |
| Phase 3.7b — patient-detail rezept tab | npm lint/test/build | **PASS** | 2026-05-19 | JSX panel extracted; logic in hook (supersedes monolithic tab file) |
| Phase 3.7b — patient-detail zahl tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | `patient-detail-zahl-tab.tsx` (~938 lines) |
| Phase 3.7b — patient-detail unter tab | npm lint/test/build | **PASS** | 2026-05-19 | `patient-detail-unter-tab.tsx` (~359 lines) |
| Phase 3.7b — patient-detail behand tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-19 | `patient-detail-behand-tab.tsx` (~207 lines); recreated after missing file broke build |
| Phase 3.7b — patient-detail anam + anlage tabs | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `patient-detail-anam-tab.tsx`, `patient-detail-anlage-tab.tsx` |
| Phase 3.7b — patient-detail stamm tab | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `patient-detail-stamm-tab.tsx`; `patient-detail.tsx` reduced |
| Phase 3.7b — einstellungen praxis + shell rebuild | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-praxis-section.tsx`; shell `einstellungen.tsx` ~500 lines (all 13 sections wired) |
| Phase 3.7b — einstellungen lizenz + integrationen | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-lizenz-section.tsx`, `einstellungen-integrationen-section.tsx`; shell `einstellungen.tsx` ~1218 lines (−58% vs 2874) |
| Phase 3.7b — einstellungen migration + ueber | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-migration-section.tsx`, `einstellungen-ueber-section.tsx`; shell `einstellungen.tsx` ~1465 lines (−44% vs 2874) |
| Phase 3.7b — einstellungen system section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-system-section.tsx`; health/perf/backup/ops embed; `einstellungen.tsx` ~1601 lines |
| Phase 3.7b — einstellungen sicherheit section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-sicherheit-section.tsx`; device sessions + portal flags internal |
| Phase 3.7b — einstellungen konto section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-konto-section.tsx`; profile load/save self-contained |
| Phase 3.7b — einstellungen arbeitsablaeufe section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-arbeitsablaeufe-section.tsx`; confirmation prefs colocated |
| Phase 3.7b — einstellungen darstellung section | npm lint/test/build + `cargo test --tests` | **PASS** | 2026-05-20 | `einstellungen-darstellung-section.tsx`; `einstellungen.tsx` ~2589 lines |
| Phase 3.7b — einstellungen benachrichtigungen section | npm lint/test/build | **PASS** | 2026-05-20 | `einstellungen-benachrichtigungen-section.tsx`, shared `settings-switch.tsx` |
| Phase 3.7b — termin week/day grid extracted | npm lint/test/build + clippy | **PASS** | 2026-05-20 | `termin-week-day-grid.tsx` (~748 lines); `termine.tsx` ~1295 lines |
| Phase 3.7b — termin month cal + legend wired | `cargo test --tests` + clippy + npm lint/test/build | **PASS** | 2026-05-20 | `termin-month-calendar.tsx`, `termin-doctor-legend.tsx`; no duplicate `MonthCalendar`/`DoctorLegend` |
| Phase 3.7b — termin drawer/context | npm lint/test/build | **PASS** | 2026-05-20 | `termin-detail-drawer.tsx`, `termin-context-menu.tsx` |
| Phase 3.7 — page utils split | `cargo clippy` + npm lint/test (114 vitest) | **PASS** | 2026-05-20 | `patient-detail-utils.ts`, `termin-calendar-ui.ts`, `settings-format.ts` |
| Phase 3.6 — patient localStorage → DB | `cargo test --tests` + clippy + npm lint/test (110 vitest) | **PASS** | 2026-05-20 | Termin drafts → `app_kv` `termin.draft.v1.{uuid}`; validation/plan/invoice already on SQLite |
| Phase 3.5 — enum codegen | `cargo test --tests` + `enums_codegen_tests` + clippy + npm lint/test/build | **PASS** | 2026-05-20 | `config/enums.yaml`; `enums.generated.ts`; `schemas.enums.generated.ts`; PDF tests adjusted (BSNR line UTF-16) |
| Phase 3.4 — RBAC codegen | `cargo build` + `rbac_tests` + `rbac_codegen_tests` + npm test | **PASS** | 2026-05-20 | `config/rbac.yaml`; `build/rbac_codegen.rs`; `rbac.generated.ts` |
| Phase 3.3 — IPC registration | `cargo test --test invoke_registration_tests` + full suite + clippy | **PASS** | 2026-05-20 | `commands/register.rs` + 42× `register_*!()` macros; `lib.rs` uses `register_invoke_handler` |
| Phase 3.2 — domain services | `cargo test --test domain_services_tests` + full `cargo test --tests` | **PASS** | 2026-05-19 | `domain/services/{konflikt,pricing,workflow_transitions}.rs`; wired termin/zahlung/akte/bestellung |
| Phase 3.1 — sqlx migrations | `MEDOC_* env cargo test --tests` + `fresh_db_records_sqlx_migration` | **PASS** | 2026-05-19 | `0001_initial_schema.sql` deduped; legacy path for existing DBs; demo seed via `should_run_demo_seed` |
| Phase 3.1–3.2 — full stack | `cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | 107 vitest; all integration suites green |
| PDF professional layout — full stack | `MEDOC_DB_KEY` + `MEDOC_VENDOR_PUBKEY` → `cargo test --tests` + clippy + npm | **PASS** | 2026-05-19 | `clinical_pdf_layout`; `pdf_document_tests` 5/5; 107 vitest; `sqlcipher_tests` flake fixed |
| Document Phases C–E — Frontend | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | 105 vitest tests; praxis guards + GOZ PDF UI |
| Document Phases C–E — Rust PDF | `cargo test --test pdf_document_tests` | **PASS** | 2026-05-19 | GOZ markers (`GOZ`, `Fak`, `IBAN`, …) |
| Document Phases C–E — Rust full | `cargo test --tests && clippy -D warnings` | **PASS** | 2026-05-19 | `db_migrations_tests` +4 (rezept/attest round-trip); `sqlcipher_tests` hardened |
| Document Phases C–E — Frontend | `npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | `rezept-edit.tsx` AMVV fields |
| Phase 0 — Rust | `MEDOC_VENDOR_PUBKEY=… cargo check && cargo test --tests && cargo clippy -D warnings` | **PASS** | 2026-05-19 | `update_signature_tests` 4/4 |
| Phase 0 — Frontend | `npm run lint && npm test && npm run build` | **PASS** | 2026-05-19 | 101 vitest tests |
| Phase 1.4 — CORS tests | `cargo test --test cors_policy_tests` | **PASS** | 2026-05-19 | LAN 403 on evil origin; company rejects Origin |
| Full stack (post 1.4) | `cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | All integration tests green |
| Phase 1.5 — SQLCipher | `cargo test --test sqlcipher_tests` + full suite with `MEDOC_DB_KEY` | **PASS** | 2026-05-19 | Wrong key / no-key rejected on file DB after migrate |
| Full stack (post 1.5) | `MEDOC_DB_KEY=… cargo test --tests && clippy && npm lint/test/build` | **PASS** | 2026-05-19 | 105 vitest tests |
| Phase 1.6 — audit chain | `cargo test --test audit_chain_tests` | **PASS** | 2026-05-19 | 50 concurrent inserts; `BEGIN IMMEDIATE` |
| Phase 1.7 — brute-force | `cargo test --test brute_force_tests` | **PASS** | 2026-05-19 | 6 tests: IP+subject keys, hydrate, admin clear |
| Full stack (post 1.7) | `MEDOC_* env cargo test --tests && clippy -D warnings && npm lint/test/build` | **PASS** | 2026-05-19 | All integration tests green; 105 vitest |
| Phase 2.1–2.2 | `crypto_tests` (5) + `npm test` (107) + build | **PASS** | 2026-05-19 | Policy + login rehash; fixed `pdf_hline` arity |
| Phase 2.3 — TOTP | `totp_tests` (5) + full `cargo test --tests` + npm lint/test/build | **PASS** | 2026-05-19 | ARZT enroll/verify login flow |
| Phase 2.4 — break-glass audit | `audit_break_glass_tests` (1) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | `under_break_glass` / filter on audit page |
| Phase 2.5 — audit chain gate | `audit_chain_guard` unit test + full suite + npm lint/test/build | **PASS** | 2026-05-19 | Startup `verify_chain`; `ops.*` blocked until ack |
| Phase 2.6 — backup retention + sig | `backup_tests` (2) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | GFS 30d/12w/12m; `.db.sig` HMAC; `signature_ok` in list |
| Phase 2.7 — DSGVO backups + logs | `dsgvo_erasure_tests` (2) + full suite + npm lint/test/build | **PASS** | 2026-05-19 | Backup redact + `MEDOC_LOG_DIR` log scrub |
| `cargo fmt --check` | after `cargo fmt` | **PASS** | 2026-05-19 | Large repo-wide format sync |
| Phase 1.1 — LAN TLS test | `cargo test --test lan_tls_tests` | **PASS** | 2026-05-19 | HTTPS `/health` via self-signed cert |
| Build fails without vendor key | `cargo check` (no env) | **FAIL** (expected) | 2026-05-19 | `MEDOC_VENDOR_PUBKEY must be set` |
| `cargo audit` | `cargo audit` | **NOT RUN** | 2026-05-19 | Binary not installed locally; CI has `cargo-audit` step |

| Check | Command | Result | Date | Notes |
| ----- | ------- | ------ | ---- | ----- |
| Frontend lint + test + build | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-04-26 | Statistiken: single `PANELS` tablist (Überblick + four Detailauswertungen) controls main `tabpanel`; temp fragment removed; `tabIndex` on nav reverted to default order |
| Frontend lint + test + build | `cd app && npm run lint && npm test && npm run build` | **PASS** | 2026-04-26 | Step 2: `index.css` tokens, `IconButton`/`Spinner`/`Skeleton`/`Separator`, `ui/index.ts` barrel, field-error shake, modal/toast z-index, ESLint: JSDoc nbsp + `patient-detail` unlock effects + `zahlEditMaxBetragEur` IIFE |
| Frontend lint | `cd app && npm run lint` | **PASS** | 2026-04-19 | eslint src --max-warnings 0 |
| Frontend unit tests | `cd app && npm test` | **PASS** | 2026-04-19 | vitest run — 1 file |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-19 | tsc + vite |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Termin dropdown+draft flow and cascading Arbeitszeiten/Sonder-Sperrzeiten changes |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Termin draft/URL merge + popover clamp + Akte composer UX gaps |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After enum serde fix, popover portal, Untersuchung composer, Behandlung autonum, validation hardening |
| Frontend unit tests | `cd app && npm test -- --run` | **PASS** | 2026-04-25 | 19 tests / 3 files (smoke, string-suggest, rbac) |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit` | **PASS** | 2026-04-25 | After cascading combo Rezept (per-patient + global) + shared MEDIKAMENT_SUGGESTIONS module + CardHeader subtitle prop |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 19 tests / 3 files — unchanged after combo Rezept refactor |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After Vorlage-loader in Rezept dialogs, Termin edit-mode wiring, vorlage-editor Krankheiten free-text, patient-create Medikation/Allergien default-open |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 19 tests / 3 files — unchanged after Vorlage/Termin-edit fixes |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Vorlage-loader + Termin edit-mode + Krankheiten free-text — all bundles emit |
| Frontend type-check | `cd app && npx tsc --noEmit` | **PASS** | 2026-04-25 | After Bestellungen end-to-end overhaul (D17) — entity, controller, page, EmptyState all clean |
| Frontend unit tests | `cd app && npm test --silent` | **PASS** | 2026-04-25 | 29 tests / 4 files — unchanged after Bestellungen overhaul (D17) |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-04-25 | After Bestellungen overhaul (D17) — `bestellungen` chunk now ~24 kB / 7 kB gz |
| Rust check | `cd app/src-tauri && cargo check` | **PASS** | 2026-04-25 | After Bestellungen backend (D17): new `update_bestellung` command, `bestellnummer`/`pharmaberater` columns + idempotent migration |
| Rust tests | `cd app/src-tauri && cargo test --tests` | **PASS** | 2026-04-25 | All 5 test binaries green (db_migrations, dsgvo_erasure, audit_chain, etc.) after Bestellung schema extension |
| Rust check | `cd app/src-tauri && cargo check --offline` | **PASS** | 2026-04-25 | No Rust changes this session — sanity confirms FE-only patches did not implicitly break anything |
| Rust tests | `cd app/src-tauri && cargo test --tests` | **PASS** | 2026-04-19 | Includes integration suites |
| Rust check | `cd app/src-tauri && cargo check --no-default-features` | **PASS** | 2026-04-25 | After `#[serde(rename_all = "UPPERCASE")]` on every domain enum + seed-data reordering |
| Rust tests | `cd app/src-tauri && cargo test --no-default-features` | **PASS** | 2026-04-25 | Migration idempotency + DSGVO erasure + crypto + RBAC + audit chain — all green after FK seed-order fix |
| Frontend lint | `cd app && npm run lint` | **PASS** | 2026-04-25 | After D18 (Statistik aggregations + new charts) and D19 (Bestellungen Detail-Route) — clean |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit` | **PASS** | 2026-04-25 | After D18+D19 — `bestellungen.tsx`, `bestellung-detail.tsx`, `statistik.tsx`, `App.tsx`, `rbac.ts` clean |
| Frontend unit tests | `cd app && npm test` | **PASS** | 2026-04-25 | 29/29 (smoke, rbac, schemas, string-suggest) — unchanged |
| Rust check | `cd app/src-tauri && cargo check --no-default-features` | **PASS** | 2026-04-25 | After D18 — `chrono::Datelike` import added to fix private `year()`/`month()`/`day()` errors in `statistik_commands.rs::altersgruppe` |
| Rust tests | `cd app/src-tauri && cargo test --no-default-features` | **PASS** | 2026-04-25 | All 5 binaries green after D18 backend + D19 routing changes |
| Rust clippy (deny warnings) | `cd app/src-tauri && cargo clippy --all-targets -- -D warnings` | **PASS** | 2026-04-19 | Includes tests; `manual_contains` fixes in `db_migrations_tests.rs` |
| Next.js reference build | `cd src && npm run build` | **PASS** | 2026-04-19 | Run before CSP fixes; Next 16 |
| Frontend type-check | `cd app && ./node_modules/.bin/tsc --noEmit -p tsconfig.json` | **PASS** | 2026-04-26 | After D20: modal→page conversion (`/finanzen/neu`), `patient-detail` header refactor, two-mode Behandlung composer with auto B-Nummer/Sitzung + collapsible "Nächsten Termin planen", per-section Validierung mit `localStorage`, Termin-create Tipp-Card, Rezept-Vorlagen quick-pick chips |
| Frontend lint | `cd app && ./node_modules/.bin/eslint src --max-warnings 0` | **PASS** | 2026-04-26 | After D20 — fixed missing `activeTab` dep in Rezept-Vorlagen-Loader effect |
| Frontend unit tests | `cd app && ./node_modules/.bin/vitest run` | **PASS** | 2026-04-26 | 29 tests / 4 files (smoke, string-suggest, rbac, schemas) — unchanged after D20 |
| Frontend production build | `cd app && npm run build` | **PASS** | 2026-05-02 | Einstellungen cull + neue Client-Settings (`idleLogout`, Tagesabschluss-Toast, VN-Suche, …); `search_patienten` optional arg; Hilfe-Route `/hilfe` |
| Frontend unit tests | `cd app && npm test -- --run` | **PASS** | 2026-05-02 | 90 tests |

## 2026-05-28 — Security audit remediation (session 4: L4 + H5 follow-up)

| Check | Command | Result | Notes |
| ----- | ------- | ------ | ----- |
| Rust check | `cd app && cargo check -p medoc` | **PASS** | After `PasswordChangeRequired`, LAN error mapping, unsaved-form guard IPC |
| medoc-core lib tests | `cd app && cargo test -p medoc-core --lib` | **PASS** | 63/63 — fixed migration order for `passwort_aendern_erforderlich` column before seed |
| db_migrations_tests | `cd app && cargo test --test db_migrations_tests` | **PASS** | 5/5 |
| rbac_tests | `cd app && cargo test --test rbac_tests` | **PASS** | 10/10 |
| Frontend rbac | `cd app && npm test -- --run src/lib/rbac.test.ts` | **PASS** | 31/31 |
| Full `npm test` | — | **NOT RUN** | Scoped to rbac this session |
| Docker validate | `bash scripts/validate-docker.sh` | **NOT RUN** | — |

## Pending / not yet run

| Check | Why pending | Blocker |
| ----- | ----------- | ------- |
| G21 manual smokes | NOT OBSERVED | Human in Tauri via `bash tools/dev-tauri.sh` |
| `bash scripts/validate-docker.sh` | NOT RUN this recovery session | Optional; CI paths restored to `app/` |
| Wave D root restructure | Deferred | Prior attempt deleted uncommitted tree; needs dedicated migration + commit |
| `tauri build` full bundle | Not run this session | Optional heavy check |
| Code-evidence sweep for WAAD-derived NEW-PH IDs (`FA-AKTE-14/15/16`, `FA-DOK-08`, `FA-LEIST-05`, `FA-PERS-07/08`, `NFA-USE-09/10`) | Implementation pending (see `actions.md` A2–A13) | Implementation tasks |
| 5-client load smoke (WAAD 9.4 / `NFA-PERF-04`) | No multi-client harness yet | Test harness for parallel Tauri sessions (Action A9) |

## WAAD intake — code-evidence audit (read-only, 2026-04-25)

Findings recorded as part of the WAAD-PDF intake. Each row cites the actual ripgrep query
or file inspection that was performed.

| WAAD-ID(s) | Question | Evidence | Verdict |
| ---------- | -------- | -------- | ------- |
| 1.2.1 / 8.1 | RBAC roles enforced for medical data? | `apps/practice-host/src/application/rbac.rs` defines `Role` + `allowed`; `akte_commands.rs:27` strips `diagnose`/`befunde` for non-ARZT roles | ✅ **VERIFIED** |
| 1.2.2 | Per-personal granular permission overrides? | `rg "personal_permission|permission_override" app` → **0 hits**. Only role-based RBAC exists | 🔴 **PENDING** — covered by new `FA-PERS-07` |
| 1.3.1 | "Akte an Arzt weiterleiten" UI? | `rg "weiterleit\|forward.*akte" app/src` → only Labor-Auftragsweiterleitung in `einstellungen.tsx`. No Akte-Weiterleitung UI | 🔴 **PENDING** — covered by new `FA-AKTE-14` |
| 1.4 | Internal note/ticket Rezeption→Arzt? | `rg "personal_ticket\|ticket.*system\|inbox.*arzt\|notiz.*system" app` → only i18n string in `apps/practice-host-ui/src/lib/i18n.ts`. No domain entity, no UI | 🔴 **PENDING** — covered by new `FA-PERS-08` |
| 1.5 / NFA-USE-H10 | In-app help / tooltip / onboarding? | `rg "tooltip\|onboarding\|tutorial\|help.*dialog" app/src` → matches in `feedback.tsx`, `compliance.tsx`, `app-layout.tsx`, `hilfe.tsx`, `DentalMiniBar.tsx`. Generic Hilfe-Page exists; per-route walkthrough does not | 🟡 **PARTIAL** — `NFA-USE-09` formalises walkthrough |
| 2.1.1 / 2.2.1 | Akten-Status `VALIDIERT` + read-audit-log? | `apps/practice-host/src/infrastructure/database/connection.rs` defines status `VALIDIERT`; `audit_repo.rs` + `akte_commands.rs` log read access | 🟡 **PARTIAL** — Status & audit OK, but separate Validierungs-Queue UI missing (`FA-AKTE-15`) |
| 5.1.1 | Patient-Discharge-Summary / Merkblatt? | `rg "discharge\|merkblatt\|nachsorge" app` → only seed strings in `connection.rs`. No PDF generator | 🔴 **PENDING** — covered by new `FA-DOK-08` |
| 6.1.2 / 6.2.4 | Arzt-Freigabe vor Abrechnung? | `rg "freigegeben_von_arzt\|approval\|approve.*leistung" app/src-tauri` → **0 hits**. Leistung-Eintrag wird ohne Freigabe-Flag erfasst | 🔴 **PENDING** — covered by new `FA-LEIST-05` |
| 7.3.3 | Akten-Vollständigkeits-Indikator? | `rg "akte.*completeness\|complete.*akte\|missing.*pflicht" app/src` → no dedicated lib | 🔴 **PENDING** — covered by new `FA-AKTE-16` |
| 7.4 | Konfigurierbares Autocomplete? | `apps/practice-host-ui/src/lib/string-suggest.ts` exists for Patient-Suche; vocabulary not yet praxis-extensible via `app_kv` | 🟡 **PARTIAL** — `NFA-USE-10` formalises extension |
| 8.4 | Backup / Restore? | `rg "backup\|wiederherstell\|restore.*db" app` → matches `backup.rs`, `ops_commands.rs` | ✅ **VERIFIED** |
| 9.4 | 5 parallele Clients ohne spürbare Verlangsamung? | Architektur-Vorgabe (Tauri+SQLite-WAL) erfüllt; Last-Test nicht durchgeführt | 🟡 **PARTIAL** — Last-Test offen (siehe N3) |

## Regressions / failed runs (do not delete; append)

| Check | Command | Failure summary | Date |
| ----- | ------- | ----------------- | ---- |
| Migration idempotency | `cargo test --no-default-features --test db_migrations_tests` | `FOREIGN KEY constraint failed` on first run because `seed_demo_data` inserted `anamnesebogen`/`patientenakte` rows referencing `seed-pat-006/007/008` *before* those patients existed. **Fixed** in this session by reordering inserts in `connection.rs`. | 2026-04-25 |
| DSGVO erasure | `cargo test --no-default-features --test dsgvo_erasure_tests` | `assert_eq! left=14 right=0` on global behandlung count. The test asserted `SELECT COUNT(*) FROM behandlung` was 0 after erasing one patient, but `seed_demo_data` legitimately seeds behandlungen for unrelated Akten. **Fixed** by scoping the assertion to `WHERE akte_id = 'akte-dsgvo-1'`. | 2026-04-25 |
