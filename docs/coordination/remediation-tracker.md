# Remediation tracker

Source: findings log in the 2026-11-06 remediation plan. Decisions D1–D9 are locked to the plan recommendations.

Status values: `Fixed (prior)`, `Fixed (working tree)`, `Partial`, `Open`.

A row is `Fixed` only after the cited code changed and its check passed. Commit hashes are empty until this work is committed.

## P0

| ID | Status | Evidence |
| --- | --- | --- |
| F6 | Fixed (working tree) | `decline_patient_chart` registered. Registry test PASS. |
| F7 | Fixed (working tree) | `replica_pull_sees_master_local_writes` PASS against the current create contract. |
| F55 | Fixed (working tree) | `medoc-core` enables `bundled-sqlcipher`. Crate tests compile and run. |

Harness: `patient_created_on_replica_a_is_visible_on_replica_b` PASS.
Playwright CI job added. Job itself NOT RUN.

## P1

| ID | Status | Evidence |
| --- | --- | --- |
| F33 | Fixed (working tree) | Relay and `sync_applied` share one transaction. Relay test PASS. |
| F47 | Fixed (working tree) | `wrong_key_leaves_the_database_file_and_its_rows` PASS. Plain text is still quarantined. |
| F48 | Fixed (working tree) | `activation_rekey_keeps_existing_rows` PASS. |
| F49 | Fixed (working tree) | `failed_migration_leaves_existing_rows_and_foreign_keys_on` PASS. |
| F50 | Fixed (working tree) | `validate_open_accepts_only_the_practice_key` PASS. |
| F51 | Fixed (working tree) | `restore_reopen_in_process_keeps_the_backup_rows` PASS. The desktop command stops LAN, swaps the managed pool, and returns `requires_app_restart: false`. The Tauri window path was not clicked. |
| F54 | Fixed (working tree) | `plaintext_backup_is_removed_after_encryption` PASS. |
| F101 | Fixed (working tree) | `audit_repair_archives_the_tail_instead_of_dropping_it` PASS. |
| F124 | Fixed (working tree) | Sick leave for another staff member stays. `staff_delete_keeps_another_staff_members_sick_leave` PASS. `created_by` is moved to a remaining account so the delete can finish. |

## Already fixed before this work

F1, F2, F3, F4, F10 — Fixed (prior). Not reopened.

## Still open

P2 in progress. Fixed in the working tree: F18 (`sync_pull_rejects_staff_jwt` PASS), F37 (`backs_off_when_the_main_device_is_down` PASS, cap 30s), F5 (sync, probe, and pairing clients use `pinned_http_client`; empty pin is refused; `tls_pin` tests PASS; a live handshake against a mismatched certificate was NOT RUN), F39 (new LAN certificates put `127.0.0.1` and practice LAN addresses in IP SANs; `certificate_carries_loopback_as_an_ip_san` PASS; an already written `lan-tls.crt` is left as-is).

Fixed in the working tree this pass: F8 and F131 (`snapshot_omits_staff_secrets_and_portal_keys` PASS; applying the snapshot keeps the existing hash), F19 and F20 (`revoked_device_is_not_reminted` PASS; revoke and block clear the token), F21 (submit and status call `redact_public_token`; confirm still returns the token; `public_view_drops_the_activation_token` PASS), F23 (`wipe_network_kv_clears_license_and_onboarding_keys` PASS), F24 (`sas_replica_activation_demotes_owner_and_skips_onboarding` PASS, URL uses the stored port 49300), F36 (`align_moves_pending_outbox_onto_the_activation_token_device` PASS; a foreign token device id is not adopted).

Fixed in the working tree this pass: F12 (sync and activation-token 403 bodies include `reason`; `sync_push_rejects_a_foreign_device_id` and `sync_status_rejects_an_unlicensed_paired_device` PASS), F13 (pull without `requesterId` is 403 `requester_mismatch`; the route matrix sends the paired device id and gets 200), F30 (`tax_advisor_password_does_not_open_a_session` PASS; seeded physician login still 200), F40 and F43 (`apps/lan-web-client` removed; `GET /api/v1/patients` and `/appointments` are 404 in the route matrix), F41 and F42 (`reception_cannot_delete_the_license_or_submit_a_prescription` PASS; physician `license.clear` is 204 and `eprescription.validate` is 200).

Fixed in the working tree this pass: F38 (`pending_pairing_is_not_minted` and `foreign_fingerprint_does_not_match_the_noise_key` PASS; a join whose fingerprint does not match the 32-byte device key is rejected; cluster loopback 10 PASS), F132 (desktop summary, integrations, feature flags, and update manifest require `ops.system`; LAN company routes already did), F135 (`vendor_url_accepts_https_and_loopback_http_only` PASS; `http` is accepted only for localhost, `127.0.0.1`, and `::1`). `HttpPracticeAdapter` no longer calls `/api/v1/patients` or `/appointments`.

Fixed in the working tree this pass: B1 `authorize()` (`authorize_tests` 4 PASS). An idle desktop clock and a stale device session are unauthorized. An unavailable account cannot sign in. A DENY override blocks `patient.write_medical`. A medical read writes an audit row with action `READ`. LAN license clear and e-prescription call it. The route matrix still passes, including physician clear (204) and validate (200). Reception on the seeded desk account is 403.

F11 Fixed (working tree): replica token empty/wrong prefix needs refresh; 403 `token_mismatch`/`token_unknown` refresh; `revoked`/`not_accepted` do not refresh. Tests `token_for_another_device_needs_refresh`, `mismatch_403_refreshes_once`, `revoked_403_stops_the_loop_and_sets_repair_required` PASS. Live TLS pin handshake still **NOT RUN**.

P3 started. Fixed in the working tree: F108 (invoice profile, logo, export path, and calendar workflow keys require `ops.system` on read and write; `invoice_profile_requires_ops_system` PASS; route matrix still PASS), F116 (`denied_document_permission_hides_attachment_names` PASS), F121 (`unknown_override_action_is_rejected` PASS; `set_staff_permission_override` rejects an action that is not in the matrix), F127 (`register_onboarding_member_account` returns an error when setup is already complete), F130 (`setup_is_complete_only_when_the_value_is_one` PASS).

P3 continued. Fixed in the working tree: F28 (`password_change_bumps_the_token_and_ends_other_sessions` PASS; a password replace increments `token_version` and ends the other device sessions; LAN middleware rejects a token whose version does not match; a hash upgrade of the same password does not bump), F29 (`different_addresses_still_lock_the_account` PASS; six failures from different addresses lock the account), F117 (`export_rejects_a_folder_outside_the_configured_root` PASS; a non-admin write must stay inside `export.path.v1`).

F27 was implemented, then deferred on 2026-11-07. `TOTP_2FA_ENABLED` is false. Password login does not require enrollment or a code, including accounts that already store a secret. Re-enable steps are in `docs/coordination/todos-deferred-security-features.md`.

P3 this pass: F26 `company.portal.config.v1` is `ops.system`; `sync_get_status` strips tokens without `ops.system`. F61 attachments use `patient.read_documents`. F120 `available = false` ends sessions and bumps `token_version`. F45 keychain account is instance-suffixed; `sqlcipher.key` is migrated then deleted. F128 setup gate stays closed on status error with Retry. F141/F142 `safe_id`/`ensure_inside`; scanner/GDT/DICOM/e-Rx return `FeatureDisabled`. F25 Partial: idle still on `require()`; staff reload is in `authorize()` (async), not every IPC `require()` call. F46 Partial: wrap-only still errors in `ensure_sqlcipher_key`; full NeedsUnlock pool holder **NOT DONE**. Live pin **NOT RUN**.

P4: F14 Partial. F15–F17 Fixed. F22/F118 Partial. F34/F35/F68/F96 harness **PASS**. F31 Partial (store + HTTP + engine PUT/GET + attachment PASS). F32 Partial. H2 guard **PASS**. F80/F109 family harness **PASS** (absence, catalog, templates, masters, product, PO, contract, day close, balance, invoice, work time, sick leave). Remaining: Part D.

P5: hourly reconciliation not started.

P6: F44, F52, F57, F59, F60, F62, F63, F64, F65, F66, F67, F69, F70, F94, F97, F99, F122, F126.

P7: F71, F72, F73, F74, F75, F76, F77, F78, F79, F84, F85, F98, F105, F106, F114.

P8: F81, F82, F83, F86, F87, F88, F89, F90, F91, F92, F93, F112, F115, F125.

P9: F53, F100, F102, F103, F104, F107, F113, F119, F136, F137, F138, F139.

P10: F9, F129, F133, F134, F140, F143.

## Helpers (Part A, 2026-11-07)

| ID | Status | Evidence |
| --- | --- | --- |
| H1 | Fixed (working tree) | `feature_disabled_maps_to_409` PASS. `AppError::FeatureDisabled` maps to HTTP 409. IPC code `FEATURE_DISABLED`. |
| H2 | Partial | `recorded_write.rs` exists. `record_or_noop` calls `record_in_tx` in its own transaction. `audit_repo::create` calls `create_in_tx`. Guard test `every_synced_write_is_recorded` is due at the end of Part E and was not added yet. |
| H3 | Fixed (working tree) | `registry_lists_every_table_exactly_once`, `snapshot_and_payload_skip_denied_columns`, `delete_writes_a_tombstone` PASS. `SYNCED_TABLES` constants replaced by `sync_registry::synced_tables()`. Staff is DeviceLocal (D2). |
| H4 | Fixed (working tree) | `local_day_bounds_cover_dst_change` and `payment_at_0030_local_is_in_that_local_day` PASS. Key `practice.timezone.v1`. Settings select added. |
| H5 | Fixed (working tree) | `domain/status.rs`. CHECK lists include ARCHIVED, DECLINED, IN_PROGRESS. `status_check_tests` 3 PASS. Enum transition tests are in the module. |
| H6 | Partial | `number_sequence` + `allocate_number`. `two_allocators_never_get_the_same_number` and `concurrent_allocators_are_unique` PASS. LAN `POST /sync/number`. Replica client HTTP path **NOT RUN**. Invoice RE-/BR-/QU- still uses `app_kv`. |
| H7 | Fixed (working tree) | `rejects_parent_traversal`, `rejects_symlink_escape`, `accepts_nested_file` PASS. |
| H8 | Fixed (working tree) | JSON keys, email, IBAN. Tracing writers wrap `SanitizingMakeWriter`. `json_password_and_email_are_redacted_on_write` PASS. |

S22 (VVT / DPIA) was not analysed. Next finding id remains F144.
