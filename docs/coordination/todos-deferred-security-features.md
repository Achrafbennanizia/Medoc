# Deferred security features (TODO)

**Status:** Break-Glass and 2FA disabled; staff cap **1 PHYSICIAN + 4 RECEPTION (5 total)** enforced (2026-06-18).  
**Flags:** `crates/shared/medoc-core/src/mvp_security.rs` (authoritative) · `packages/shared/src/lib/mvp-security-config.ts` (UI mirror).

## Re-enable Break-Glass

1. Set `BREAK_GLASS_ENABLED = true` in `mvp_security.rs` and `mvp-security-config.ts`.
2. **`apps/practice-host/src/lib.rs`** — `register_break_glass` runs when flag is true (already gated).
3. **`apps/practice-host-ui/src/views/layouts/app-layout.tsx`** — Notfallzugriff menu + dialog + banner.
4. **`apps/practice-host-ui/src/views/pages/audit.tsx`** — Break-Glass filter checkbox.
5. **`apps/practice-host-ui/src/views/pages/login.tsx`** — `login.notfall.*` hint block.
6. **Tests** — remove `#[ignore]` from `apps/practice-host/tests/audit_break_glass_tests.rs`.
7. **Docs** — `docs/benutzerhandbuch.md` §4.4, `verarbeitungsverzeichnis.md` window (15 vs 30 min).

## Re-enable 2FA / TOTP

**Current state (2026-07-12):** Fully unwired — IPC commands commented out of `register.rs` (300 handlers), UI removed from login/settings/network-reset, `totp.controller.ts` stubbed. Implementation preserved in block comments.

1. Set `TOTP_2FA_ENABLED = true` in `mvp_security.rs` and `mvp-security-config.ts`.
2. Uncomment 6 IPC registrations in `register.rs` (+ update `EXPECTED_INVOKE_COMMAND_COUNT` to 306).
3. Uncomment `auth_service.rs` TOTP branch, `auth.rs` / `staff.rs` command fns + register macros.
4. Restore `totp.controller.ts`, `login.tsx` enroll/verify steps, `settings-sicherheit-section.tsx` panel.
5. Restore network-reset TOTP reauth in `verbund.rs` + confirm dialog field.
6. **E2E** — restore `enroll_seed_arzt_totp` usage; Playwright `totp_code` if needed.
7. **Tests** — remove `#[ignore]` from `apps/practice-host/tests/totp_tests.rs`.

## Staff limit (change or wire to license)

1. Adjust caps only in `staff_quota_limits()` body in `mvp_security.rs` (+ mirror in `mvp-security-config.ts`).
2. Triggers reinstall automatically from `staff_quota_limits()` on migration via `reinstall_staff_quota_db_triggers`; after license activate, call the same function.
3. Long-term: enforce `license.max_users` from signed payload instead of hardcoded MVP constants.
4. **`seed.rs`** — re-enable `seed-arzt-002` if quota allows.
5. **Company portal defaults** — `medoc-company/src/db.rs` display meters.

### Atomicity (verified 2026-06-16)

- **Transaction mode:** `begin_immediate_quota_tx` uses `pool.begin_with("BEGIN IMMEDIATE")` only — not `pool.begin()` + nested `BEGIN IMMEDIATE`. Precedent: `audit_repo::create`, `invoice_sequence` uses `acquire` + single `BEGIN IMMEDIATE`.
- **Write-lock pin:** first statement in quota tx upserts `app_kv` sentinel `mvp.staff_quota.write_lock.v1` before `COUNT(*)`.
- **Role change:** `update_with_quota` enforces inside the same tx as `update_in_tx` (same `id` for exclude + update).
- **DB triggers:** `trg_personal_quota_insert` / `trg_personal_quota_update_rolle` — DDL generated from `staff_quota_trigger_ddl(staff_quota_limits())`, DROP+CREATE on reinstall.
- **Sync bypass:** `staff` is **not** in `medoc_sync::merge::sanitize_table` allow-list — replicas cannot apply remote staff rows.
- **Tests:** `staff_quota_tests` — 30× concurrent create boundary, 25× concurrent promote-to-PHYSICIAN, direct-insert trigger block.

## Evidence

| Area | Path |
| ---- | ---- |
| Rust flags + quota | `crates/shared/medoc-core/src/mvp_security.rs` |
| TS UI flags | `packages/shared/src/lib/mvp-security-config.ts` |
| Staff IPC | `get_staff_quota`, `create_staff`, `update_staff` |
| Break-Glass IPC | `crates/app/medoc-practice/src/commands/admin/break_glass.rs` |
| Quota tests | `crates/shared/medoc-core/tests/staff_quota_tests.rs` |
| IPC gate tests | `crates/shared/medoc-core/tests/mvp_security_gates_tests.rs` |
| Session mint audit | `apps/practice-host/tests/auth_session_audit_tests.rs` — `authenticate` is sole login session issuer |
| `totp_required_for_role` | Returns `false` when `TOTP_2FA_ENABLED` is false; callers in `auth_service.rs`, `auth.rs`, `staff.rs` |
