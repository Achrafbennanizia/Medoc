# Englishify manifest

Generated: 2026-08-01 (Phase 1 inventory)

Process strictly top to bottom. Mark `[x]` only when the file is fully done and recorded.
Do not advance past an unfinished row. Resume at the first unchecked row.

Columns: status | path | group | notes

## Counts

| Group | Name | Files |
| --- | --- | ---: |
| 1 | Shared i18n catalog | 5 |
| 2 | Rust domain | 32 |
| 3 | Rust application | 18 |
| 4 | Rust commands (IPC) | 69 |
| 5 | Rust infrastructure (+ remaining Rust) | 223 |
| 6 | TS models/types | 8 |
| 7 | TS services | 1 |
| 8 | TS controllers | 50 |
| 9 | React views | 211 |
| 10 | TS lib/utils and remaining source | 120 |
| 11 | Tests and config | 135 |
| G | Generated appendix (REGENERATE-ONLY) | 9 |
| | **Processable total (1–11)** | **872** |
| | **Grand total (with generated)** | **881** |

## Group 1: Shared i18n catalog

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `packages/shared/locales/ar.json` | 1-shared-i18n-catalog | Audited: 4515 keys, parity OK, no blank/TODO. Values correctly Arabic. German key namespaces deferred — see ledger PROPOSED i18n-key-namespace.* |
| [x] | `packages/shared/locales/de.json` | 1-shared-i18n-catalog | Audited: Sie-form DE values kept (display language). No Tier A edits. Key renames deferred with other locales. |
| [x] | `packages/shared/locales/en.json` | 1-shared-i18n-catalog | Audited: EN source strings; no umlaut keys; `npm run i18n:verify` PASS. Cognate "Filter" OK. Namespace renames PROPOSED in ledger. |
| [x] | `packages/shared/locales/fr.json` | 1-shared-i18n-catalog | Audited: FR values present, parity OK. Same deferred key-namespace list as siblings. |
| [x] | `packages/shared/src/lib/i18n.ts` | 1-shared-i18n-catalog | Already English (comments, APIs, hooks). No Tier B/C identifiers. Default locale `de` kept (UI default). |

## Group 2: Rust domain

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/practice-host/src/domain.rs` | 2-rust-domain | Re-export only; already English. No ledger. |
| [x] | `crates/app/medoc-practice/src/domain.rs` | 2-rust-domain | Re-export only; already English. No ledger. |
| [x] | `crates/shared/medoc-core/src/domain/entities/anamnesebogen.rs` | 2-rust-domain | Tier C identifiers kept (Anamnesebogen, antworten, …). No Tier A. Ledger PROPOSED entity.Anamnesebogen. |
| [x] | `crates/shared/medoc-core/src/domain/entities/attest.rs` | 2-rust-domain | Tier C identifiers kept. No Tier A. Ledger PROPOSED entity.Attest fields. |
| [x] | `crates/shared/medoc-core/src/domain/entities/audit_log.rs` | 2-rust-domain | Already English identifiers/comments. |
| [x] | `crates/shared/medoc-core/src/domain/entities/behandlung.rs` | 2-rust-domain | Tier A docs EN. Tier C Behandlung/Untersuchung + fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/bestellung.rs` | 2-rust-domain | Tier A docs EN. Tier C Bestellung + status wires KEEP/PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/bilanz_snapshot.rs` | 2-rust-domain | Tier A module/docs EN. Tier C BilanzSnapshot PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/dokument_template_user.rs` | 2-rust-domain | Tier C type name only; no Tier A edits. |
| [x] | `crates/shared/medoc-core/src/domain/entities/leistung.rs` | 2-rust-domain | Tier C only; no Tier A edits. |
| [x] | `crates/shared/medoc-core/src/domain/entities/mod.rs` | 2-rust-domain | Module re-exports; German stems Tier C PROPOSED (file renames deferred). |
| [x] | `crates/shared/medoc-core/src/domain/entities/patient.rs` | 2-rust-domain | Tier C field names kept; no Tier A. |
| [x] | `crates/shared/medoc-core/src/domain/entities/patientenakte.rs` | 2-rust-domain | Tier C Patientenakte kept; no Tier A. |
| [x] | `crates/shared/medoc-core/src/domain/entities/personal.rs` | 2-rust-domain | Tier A docs EN. Tier C Personal/AerztSummary/fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/praxis_aufgabe.rs` | 2-rust-domain | Tier A docs EN. Tier C PraxisAufgabe* + fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/produkt.rs` | 2-rust-domain | Tier C only; no Tier A. |
| [x] | `crates/shared/medoc-core/src/domain/entities/rezept.rs` | 2-rust-domain | Tier C only; no Tier A. |
| [x] | `crates/shared/medoc-core/src/domain/entities/tagesabschluss_protokoll.rs` | 2-rust-domain | Tier A docs EN. Tier C TagesabschlussProtokoll PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/entities/termin.rs` | 2-rust-domain | Tier C Termin + fields PROPOSED; no Tier A. |
| [x] | `crates/shared/medoc-core/src/domain/entities/zahlung.rs` | 2-rust-domain | Tier A docs EN. Bilanz DTO + Zahlung fields PROPOSED (unsure B/C → C). |
| [x] | `crates/shared/medoc-core/src/domain/entities/zahnbefund.rs` | 2-rust-domain | Tier A validation Err → EN. Tier C Zahnbefund/fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/enums.rs` | 2-rust-domain | Wire values KEEP (generated). No Tier A edits. |
| [x] | `crates/shared/medoc-core/src/domain/mod.rs` | 2-rust-domain | Already English module docs. |
| [x] | `crates/shared/medoc-core/src/domain/rbac.rs` | 2-rust-domain | Role wires KEEP (ARZT/REZEPTION/…). Already English docs. |
| [x] | `crates/shared/medoc-core/src/domain/repositories/mod.rs` | 2-rust-domain | Already English. |
| [x] | `crates/shared/medoc-core/src/domain/repositories/personal_repo.rs` | 2-rust-domain | Already English. |
| [x] | `crates/shared/medoc-core/src/domain/services/aufgabe_visibility.rs` | 2-rust-domain | Tier A docs EN. Fn/type names Tier C PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/services/device_session_risk.rs` | 2-rust-domain | Tier A reason strings → EN + unit test. Displayed raw in UI until i18n keys. |
| [x] | `crates/shared/medoc-core/src/domain/services/konflikt.rs` | 2-rust-domain | Tier B DONE: conflict IPC messages EN; FE matcher updated; fn rename appointment_conflict_short_message. |
| [x] | `crates/shared/medoc-core/src/domain/services/mod.rs` | 2-rust-domain | Module `konflikt` name PROPOSED rename; no edit. |
| [x] | `crates/shared/medoc-core/src/domain/services/pricing.rs` | 2-rust-domain | Tier A docs EN. Fn names with German stems PROPOSED. |
| [x] | `crates/shared/medoc-core/src/domain/services/workflow_transitions.rs` | 2-rust-domain | Tier A docs/comments EN. Status wires KEEP. |

## Group 3: Rust application

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/practice-host/src/application.rs` | 3-rust-application | Re-export only; already English. |
| [x] | `crates/app/medoc-practice/src/application.rs` | 3-rust-application | Facade docs already English. |
| [x] | `crates/shared/medoc-core/src/application/akte/billing_release.rs` | 3-rust-application | Audit-only. Audit wires KEEP (FREIGABE_ABRECHNUNG). |
| [x] | `crates/shared/medoc-core/src/application/akte/clinical_line_persistence.rs` | 3-rust-application | Audit-only. Domain names in logs kept. |
| [x] | `crates/shared/medoc-core/src/application/akte/mod.rs` | 3-rust-application | Tier A module doc EN. Module name `akte` PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/akte/pdf_export.rs` | 3-rust-application | DE PDF labels restored (EN-hardcode reverted). Module doc EN. Locale-aware PDF labels PROPOSED in ledger. DTO/section keys PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/akte/rezeption_redact.rs` | 3-rust-application | Tier A docs EN. Fn names PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/app_kv_policy.rs` | 3-rust-application | Audit-only. app_kv keys KEEP. |
| [x] | `crates/shared/medoc-core/src/application/audit_chain_guard.rs` | 3-rust-application | Already English. |
| [x] | `crates/shared/medoc-core/src/application/auth_service.rs` | 3-rust-application | Tier A Hash-Fehler→Hash error. Serde fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/break_glass.rs` | 3-rust-application | Already English. |
| [x] | `crates/shared/medoc-core/src/application/device_session_service.rs` | 3-rust-application | Tier A module doc EN. |
| [x] | `crates/shared/medoc-core/src/application/mod.rs` | 3-rust-application | Audit-only. Module names PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/own_profile.rs` | 3-rust-application | Tier A docs EN. DTO fields PROPOSED. |
| [x] | `crates/shared/medoc-core/src/application/praxis_aufgabe_notify.rs` | 3-rust-application | Tier A notify copy → EN. Status wires KEEP. |
| [x] | `crates/shared/medoc-core/src/application/rbac.rs` | 3-rust-application | Tier A docs EN. Perm string constants PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/application/termin_hint_fulfillment.rs` | 3-rust-application | Tier A notify copy → EN. Audit entity KEEP. |
| [x] | `crates/shared/medoc-core/src/application/totp_service.rs` | 3-rust-application | Tier A error messages → EN. |

## Group 4: Rust commands (IPC)

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/practice-host/src/commands/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/admin/app_kv.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/arbeitsplan_adjustment.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/audit.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/audit_chain.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/auth.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/break_glass.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/db_setup.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/krankenbescheinigung.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/admin/personal.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/admin/work_time.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/app_lifecycle.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/bilanz_snapshot.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/invoice.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/invoice_sequence.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/leistung.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/billing/rechnung_document.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/tagesabschluss_protokoll.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/vertrag.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/billing/zahlung.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/akte.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/akte_anlage.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/akte_next_termin.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/akte_validation.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/akte_workflow.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/attest.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/clinical/patient.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/clinical/rezept.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/list_params.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/network/company_portal.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/lan.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/discovery_ble.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/discovery_lan.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/master.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/replica.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/support.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/pairing/types.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/sync.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/network/verbund.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/bestellung.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/core.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/dokument_template.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/feedback.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/in_app_notification.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/praxis/produkt.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/praxis/statistik.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). DE chart labels kept (locale PROPOSED). |
| [x] | `crates/app/medoc-practice/src/commands/rbac_state.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/register.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/scheduling/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/scheduling/praxis_aufgabe.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/scheduling/termin.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/core.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/devices.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/document_pdf.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/export.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/integration.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/logging.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/menu.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/mod.rs` | 4-rust-commands | Audit-only / already English. Command registry names PROPOSED for later both-sides rename. |
| [x] | `crates/app/medoc-practice/src/commands/system/ops.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/report_pdf.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |
| [x] | `crates/app/medoc-practice/src/commands/system/subscription.rs` | 4-rust-commands | Tier A docs/errors EN where applicable. Command names PROPOSED. NotFound resource strings KEEP (AppError `{0} nicht gefunden` + FE matchers). |

## Group 5: Rust infrastructure (+ remaining Rust)

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/practice-host/build.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `apps/practice-host/src/error.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `apps/practice-host/src/infrastructure/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `apps/practice-host/src/lib.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `apps/practice-host/src/main.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `apps/practice-host/src/systems/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/error.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/infrastructure/app_menu.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/app/medoc-practice/src/infrastructure/github_updates.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/infrastructure/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/systems/company/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/systems/lan/facade.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/systems/lan/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/systems/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/app/medoc-practice/src/systems/practice/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/company/medoc-company-server/src/main.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/server/company/medoc-company/src/api_key.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/company/medoc-company/src/db.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/server/company/medoc-company/src/http.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/server/company/medoc-company/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan-server/src/main.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/config.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/discovery.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/http/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/server/lan/medoc-lan/src/http/pairing.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/http/sync.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/jwt.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/master_license.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/pairing_http.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/secrets.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/sync_http.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/server/lan/medoc-lan/src/tls.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-codegen/src/enums.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-codegen/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-codegen/src/rbac.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/build.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/break_glass.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/company/adapter.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/company/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/company/port.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/discovery/beacon.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/discovery/lan_udp.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/discovery/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/error.rs` | 5-rust-infrastructure | Audit-only for Display templates KEEP (`{0} nicht gefunden` + FE matchers). Coordinated EN PROPOSED. |
| [x] | `crates/shared/medoc-core/src/infrastructure/backup.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/clinical_pdf_layout.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/clinical_text_format.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/company_portal/client.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/company_portal/config.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/company_portal/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/cors_policy.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/crypto/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/crypto/sig.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/akte_anlage_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/akte_next_termin_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/akte_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/akte_validation_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/app_kv_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/attest_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/audit_break_glass.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/audit_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/bestellung_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/bilanz_snapshot_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/brute_force_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/connection.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/db_key.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/device_session_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/dokument_template_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/in_app_notification_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/leistung_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/license_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/legacy_embedded.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/rust_only.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/seed.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/sync_tables.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/migrations/verbund_tables.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/patient_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/personal_permission_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/personal_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/ports/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/ports/pool.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/praxis_aufgabe_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/praxis_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/praxis_ticket_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/produkt_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/rechnung_document_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/app_kv.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/audit.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/audit_break_glass.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/brute_force.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/device_session.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/license.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/personal.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/admin/personal_permission.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/bilanz_snapshot.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/leistung.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/rechnung_document.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/tagesabschluss_protokoll.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/vertrag.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/billing/zahlung.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/akte.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/akte_anlage.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/akte_next_termin.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/akte_validation.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/attest.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/patient.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/clinical/rezept.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/bestellung.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/dokument_template.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/in_app_notification.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/produkt.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/praxis/stamm.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/scheduling/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/scheduling/praxis_aufgabe.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/scheduling/praxis_ticket.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/repos/scheduling/termin.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/rezept_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/sqlcipher.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/sync_outbox.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/tagesabschluss_protokoll_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/termin_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/vertrag_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/database/zahlung_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/devices/dicom.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/devices/gdt.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/devices/host_integration.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/devices/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/devices/scanner.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/dsfa.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/dsgvo.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/license.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/license_repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/logging/brute_force.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/logging/config.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/logging/export.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/logging/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/logging/sanitizer.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/migration.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/notifications.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/payment.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/clinical_layout.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/core.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/export.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/letterhead.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf/render.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf_core.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf_export.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/pdf_letterhead.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/perf.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/photo_viewer_scan.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/retention.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/secret_store.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/telematik.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/totp.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/infrastructure/update.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/infrastructure/vvt.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-core/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-core/src/mvp_security.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/deployment.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/engine.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/engine/run.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/engine/types.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/lib.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/master_keys.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/merge.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/net/bind_guard.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/net/channel.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/discovery.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/handshake.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/join_client.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/join_handler.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/net/listener.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/member_cluster_watch.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/net/reset_broadcast.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/transport.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/net/wire.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/pairing.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/pairing/pin.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/pairing/policy.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/pairing/port.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/pairing/store/finalize.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/pairing/store/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/pairing/store/row.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/pairing/token.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/pairing/types.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/ports/mod.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/ports/pairing.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/ports/sync.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/repo.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/repo/store.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/repo/types.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/schema.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/verbund.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/activation.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/crypto/device_identity.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/verbund/crypto/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/crypto/sas.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/crypto/seat_cert.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/entities.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/enums.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/identity.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/ports.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/repo.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/seat_budget.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/audit.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/cluster_reset_service.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/lizenz_service.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/mod.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/provisioning_service.rs` | 5-rust-infrastructure | Audit-only: no German Tier A prose detected. Identifiers Tier C/PROPOSED deferred. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/staff_directory.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |
| [x] | `crates/shared/medoc-sync/src/verbund/services/verbund_service.rs` | 5-rust-infrastructure | Tier A comments/errors EN where applicable. Display/PDF/NotFound DE kept. Identifiers PROPOSED/KEEP. |

## Group 6: TS models/types

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `packages/shared/src/models/store/auth-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/export-preview-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/form-dirty-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/praxis-arbeitszeiten-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/replica-sync-status-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/ui-preferences-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/store/verbund-store.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/shared/src/models/types.ts` | 6-ts-models | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |

## Group 7: TS services

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/practice-host-ui/src/services/tauri.service.ts` | 7-ts-services | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |

## Group 8: TS controllers

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `packages/app/practice-host/src/controllers/akte-workflow.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/akte.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/app-kv.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/arbeitsplan-adjustment.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/attest.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/audit-chain.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/audit.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/auth.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/bestellung.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/bilanz-snapshot.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/break-glass.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/compliance.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/db-setup.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/device-session.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/document-template.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/feedback.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/in-app-notification.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/integration.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/invoice.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/krankenbescheinigung.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/leistung.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/logging.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/native-menu.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/ops.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/pairing.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/patient.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/personal.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/plan-next-termin.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/praxis-aufgabe.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/praxis.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/produkt.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/rechnung-document.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/report.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/rezept.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/settings-page.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/statistik.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/sync.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/system.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/tagesabschluss-protokoll.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/termin-draft.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/termin.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/totp.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/validation.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/verbund.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/vertrag.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/work-time.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/app/practice-host/src/controllers/zahlung.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/server/company/src/controllers/company-portal.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/server/lan/src/controllers/lan-server.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |
| [x] | `packages/server/lan/src/controllers/pairing-scan.controller.ts` | 8-ts-controllers | Tier A docs EN where needed; audit-only if already EN. Invoke/DTO wires PROPOSED/KEEP (no rename). |

## Group 9: React views

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/lan-web-client/src/lan-client-app.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/lan-web-client/src/main.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/App.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/main.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/AnamneseVisual.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/DentalChart.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/DentalMiniBar.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/UntersuchungComposer.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/UntersuchungDetailPanel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/akte-anlagen-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/akte-confirm-presentation.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/akte-scanner-import-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/app-help-dialogs.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/arbeitsplan-practice-time-policy.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/audit-chain-banner.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/behandlung-akte-composer-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/bestellung-detail-drawer.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/break-glass-banner.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/cluster-reset-listener.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/command-palette.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/data-export-picker-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/db-setup-gate.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/dental-tooth-picker-mini.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/desktop-chrome.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/desktop-window-frame.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/discharge-merkblatt-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/error-boundary.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/export-picker-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/export-preview-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/export-preview-host.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/finanzen-tx-detail-drawer.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/license-and-pairing-gate.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/locale-switcher.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/notifications-popover.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/onboarding-coachmark.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/onboarding-shell.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/page-back-button.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/password-policy-hints.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/patient-akte-workflow-dialogs.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/patient-combo-field.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-arbeitszeiten-background.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/aufgabe-workflow-ui.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/aufgabe-workflow.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/constants.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/load-aufgabe-team.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-admin-grid.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-admin-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-detail-drawer.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-form-fields.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-inbox-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-inbox-row.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-aufgaben/praxis-aufgabe-kommentare.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-readiness-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/praxis-setup-wizard.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/produkt-form-shared.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/rbac-gate.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/replica-sync-background.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/report-export-picker-dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/report-export-toolbar.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/resolve-desktop-chrome-mode.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/responsive-label.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/role-route.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/route-outlet-guard.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/session-gate.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/settings-switch.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/sync-status-badge.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/tagesabschluss-form.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/termin-context-menu.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/termin-detail-drawer.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/termin-doctor-legend.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/termin-month-calendar.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/termin-week-day-grid.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/user-account-menu.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verbund-onboarding-gate.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verwaltung-back-button.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verwaltung-hub-page.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verwaltung-page-header.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verwaltung-read-field.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/verwaltung-toc-page.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/components/zahl-row-actions-menu.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/layouts/app-layout.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/akten-zu-validieren.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/arbeitstage.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/arbeitszeit-team.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/arbeitszeit-tracking.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/arbeitszeiten.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/atteste.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `apps/practice-host-ui/src/views/pages/audit.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/behandlungs-katalog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/bestellstamm-verwaltung.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/bestellung-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/bestellung-detail.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/bestellungen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/bilanz-neu.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `apps/practice-host-ui/src/views/pages/bilanz.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/compliance.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/dashboard.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/datenschutz.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/einstellungen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/feedback.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/finanzen-kasse.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/finanzen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/hilfe.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/krankenbescheinigung-verwaltung.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/leistungen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/logging.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/login.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/migration-wizard.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `apps/practice-host-ui/src/views/pages/ops.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/patient-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/patienten.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/personal-arbeitsplan.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/personal.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/posteingang.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/praxis-aufgabe-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/praxis-aufgabe-edit.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/praxis-praeferenzen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/praxis-tickets.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/praxisplanung.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/produkte.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/rezept-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/rezept-edit.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/rezepte.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/sonder-sperrzeiten.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/statistik.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `apps/practice-host-ui/src/views/pages/tagesabschluss.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/termin-create.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `apps/practice-host-ui/src/views/pages/termine.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-aufgaben.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-finanz-werkzeuge.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-finanzen-berichte.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-lager-bestellwesen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-leistungen-kataloge-vorlagen.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-team.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung-vertraege.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/verwaltung.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/vorlage-editor.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/vorlagen-rezepte-atteste.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/zahlung-create-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/zahlung-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `apps/practice-host-ui/src/views/pages/zahlung-kasse-create.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/components/verbund-join-flow.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/akten-zu-validieren.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/audit.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/compliance.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-arbeitsablaeufe-section.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-benachrichtigungen-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-darstellung-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-deployment-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-device-sessions-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-integrationen-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-konto-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-lizenz-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-migration-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-network-reset-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-pairing-inbox.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-praxis-billing.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-praxis-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-sicherheit-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-system-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/einstellungen-ueber-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/einstellungen/geraeteverbund-panel.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/license-activate.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `packages/app/practice-host/src/pages/logging.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/onboarding/abonnement-registrieren.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/onboarding/aktivierung-import.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/onboarding/konto-einrichten.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/onboarding/lizenz-aktivieren.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/onboarding/verbund-onboarding.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/ops.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-akte-subnav.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-anam-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-anlage-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-behand-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-overlays.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-rezept-tab-panel.tsx` | 9-react-views | Tier A/i18n: user-facing DE → catalog keys where applicable; wire/storage codes KEEP. See ledger. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-rezept-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-shell-header.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-unter-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-zahl-tab.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/use-patient-detail-akte-save.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/use-patient-detail-clinical-actions.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/use-patient-detail-rezept-tab.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/use-patient-detail-validation.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/use-patient-detail-zahl-actions.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/server/company/src/pages/einstellungen-company-portal-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/server/lan/src/pages/einstellungen-lan-host.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/server/lan/src/pages/pairing-scan.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/server/lan/src/pages/verbund-beitreten.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/shared/src/lib/icons.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/badge.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/button.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/card.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/dialog.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/dismissible-notice.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/empty-state.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/filter-option-bar.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/form-section.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/icon-button.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/index.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/input.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/page-status.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/separator.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/skeleton.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/spinner.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/tag-input.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/time-slot-picker.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/toast-store.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/toast.tsx` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |
| [x] | `packages/ui/src/use-dismissible-layer.ts` | 9-react-views | Audit-only: no DE UI markers; already on t()/tp() or English. |

## Group 10: TS lib/utils and remaining source

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/lan-web-client/src/practice-http-shim.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/hooks/use-verwaltung-toc-hub.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/platform/akte-anlagen.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/platform/desktop-window-controls.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/platform/mac-window-drag.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/platform/native-app-menu-bridge.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/systems/company-portal/adapters/tauri-company.adapter.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/systems/index.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/systems/lan/adapters/tauri-lan.adapter.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/systems/registry.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/systems/shared/transport/tauri-transport.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/vite-env.d.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/vitest-setup.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/adapters/http-practice.adapter.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/adapters/practice-transport.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/adapters/tauri-practice.adapter.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/lib/clear-desktop-license-client-state.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/lib/deployment-config.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/lib/license-device-role.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/ports/practice-system.port.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/server/company/src/ports/company-system.port.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/server/lan/src/index.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/server/lan/src/lib/lan-client-config.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/server/lan/src/ports/lan-system.port.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/json.d.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/abbreviations.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/accent-preset.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-anlagen.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-completeness.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-export.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-validation.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/anamnese.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/arbeitsplan-compose.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/arbeitsplan-preferences.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/attest-composer.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/behandlungs-katalog-categories.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/bestellung-produkt-bridge.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/billing-open-booking.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/billing-release.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/breadcrumb-keys.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/breakpoints.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/catalog-menu-flags.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/client-settings.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/clinical-document-pdf.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/clinical-pdf-layout.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/command-palette-data.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/confirmation-preferences.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/datenschutz-config.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/deferred-roles.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/dental.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/document-print-html.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/document-template-i18n.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/document-template-schema.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/export-delimited.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/export-settings.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/export.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/finance-order-labels.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/font-stack-preset.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/integration-capabilities.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/interaction-standards.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/invoice-leistung.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/ipc-errors.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/kpi-icon-chrome.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/krankenbescheinigung-orchestrator.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/list-params.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/login-totp-errors.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/medikamente.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/mvp-security-config.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/native-go-menu.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/nav-sections.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/onboarding.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/password-policy.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/patient-browser-storage.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/patient-csv.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/patient-detail-rezept-actions.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/patient-detail-utils.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/personal-arbeitsplan.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/photo-viewer-apps.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/plan-next-termin.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/posteingang-config.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-arbeitszeiten-validation.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-completeness.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-header-privacy.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-planning.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-praeferenzen-storage.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-search-prefs-sync.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/print-html.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/produkt-form-model.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/quittung-export-flow.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/rbac.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/report-export.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/report-import.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/save-download.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/schemas.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/settings-format.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/settings-ui-flags.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/string-suggest.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/tagesabschluss-invoice-pdf.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/tagesabschluss.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-availability.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-calendar-layout.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-calendar-ui.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-domain.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-drag-runtime.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-drag-snap.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-slot-grid.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/test-app-root.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/untersuchung.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/use-rbac.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/utils.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/v1-ui-flags.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/vertrag-domain.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-hierarchy.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-toc/controller.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-toc/index.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-toc/model.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-toc/types.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/work-time-focus-mode.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/work-time-ui.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/zahlung-buchung.ts` | 10-ts-lib-utils-remaining | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |

## Group 11: Tests and config

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [x] | `apps/lan-web-client/vite.config.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/e2e-playwright/lan-server.spec.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/playwright.config.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/critical-flows.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/g21-routing.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/p0-routes.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/smoke.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/components/export-preview-dialog.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/components/notifications-popover.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/components/patient-akte-workflow-dialogs.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/pages/einstellungen.rbac.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/pages/posteingang.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/src/views/pages/praxis-tickets.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host-ui/vite.config.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/akte_workflow_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/audit_break_glass_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/audit_chain_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/auth_session_audit_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/backup_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/brute_force_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/company_host_auth_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/cors_policy_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/crypto_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/db_migrations_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/dev_local_db_password_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/dicom_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/domain_services_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/dsgvo_erasure_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/enums_codegen_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/gdt_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/invoke_registration_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/lan_tls_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/migration_import_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/patient_neu_status_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/payment_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/pdf_document_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/praxis_aufgabe_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/rbac_codegen_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/rbac_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/retention_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/sqlcipher_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/stress_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/totp_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/update_signature_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `apps/practice-host/tests/zahlung_repo_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `config/enums.yaml` | 11-tests-and-config | Config wire values KEEP. Comments EN if touched. Renames PROPOSED only via codegen+migration. |
| [x] | `config/rbac.yaml` | 11-tests-and-config | Config wire values KEEP. Comments EN if touched. Renames PROPOSED only via codegen+migration. |
| [x] | `crates/app/medoc-practice/tests/architecture_boundary_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/app/medoc-practice/tests/invoke_command_registry_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/app/medoc-practice/tests/ipc_sync_pairing_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/app/medoc-practice/tests/support.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/server/lan/medoc-lan/tests/http_pairing_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/server/lan/medoc-lan/tests/http_sync_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/server/lan/medoc-lan/tests/support.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/dev_init_seed_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/gen_dev_license_once.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/license_proptests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/license_v2_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/mvp_security_gates_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/staff_quota_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-core/tests/sync_outbox_hooks_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/src/pairing/tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/src/verbund/tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/engine_http_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/engine_run_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/merge_apply_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/merge_invariants_proptests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/pairing_token_proptests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/repo_store_tests.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/shared/medoc-sync/tests/verbund_net_loopback.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/src/harness.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/src/lib.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/src/port_client.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/activation_token_rbac.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/company_portal.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/lan_pairing_sync.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/license_and_outbox.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/license_gate_negatives.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/mesh_peer_delivery.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/multi_device_port_http.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/multi_replica_roundtrip.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/outbox_clinical_writes.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/revoke_and_rotation.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/serverful_lan_client_flows.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/three_replica_conflict_matrix.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/tier1_http_push.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/two_replica_mesh.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `crates/test/medoc-e2e/tests/verbund_seat_caps.rs` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/controllers/pairing.controller.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/controllers/sync.controller.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/controllers/termin-draft.controller.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/pages/akten-zu-validieren.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/pages/ops.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/app/practice-host/src/pages/patient-detail/patient-detail-akte-subnav.smoke.test.tsx` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/server/lan/src/controllers/pairing-scan.controller.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-anlagen.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/akte-completeness.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/behandlungs-katalog-categories.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/billing-open-booking.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/billing-release-flow.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/billing-release.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/collaboration-g21.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/deployment-config.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/domain-enums.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/font-stack-preset.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/http-practice.adapter.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/i18n-locales.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/lan-client-config.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/native-go-menu.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/nav-sections.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/onboarding.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/password-policy.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/patient-detail-utils.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-arbeitszeiten-validation.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/praxis-completeness.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/quittung-export-flow.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/rbac.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/report-export.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/report-import.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/schemas.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/string-suggest.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/systems-structure.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/tagesabschluss.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-availability.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-calendar-layout.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-calendar-ui.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-domain.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-drag-snap.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/termin-slot-grid.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/untersuchung.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/utils.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/vertrag-domain.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-hierarchy.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/lib/verwaltung-toc.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |
| [x] | `packages/shared/src/models/store/export-preview-store.test.ts` | 11-tests-and-config | Tier A applied or audit-only. Wire/FE-matcher/DE fixtures KEEP where required. See ledger PROPOSED. |

## Appendix G: Generated (REGENERATE-ONLY)

Do not hand-edit these in Phase 2. Change `config/*.yaml` or codegen sources, then regenerate.

| Status | Path | Group | Notes |
| --- | --- | --- | --- |
| [G] | `apps/practice-host/gen/schemas/acl-manifests.json` | generated | REGENERATE-ONLY |
| [G] | `apps/practice-host/gen/schemas/capabilities.json` | generated | REGENERATE-ONLY |
| [G] | `apps/practice-host/gen/schemas/desktop-schema.json` | generated | REGENERATE-ONLY |
| [G] | `apps/practice-host/gen/schemas/linux-schema.json` | generated | REGENERATE-ONLY |
| [G] | `apps/practice-host/gen/schemas/macOS-schema.json` | generated | REGENERATE-ONLY |
| [G] | `crates/shared/medoc-core/migrations/generated/enum_check_fragments.sql` | generated | REGENERATE-ONLY |
| [G] | `packages/shared/src/lib/enums.generated.ts` | generated | REGENERATE-ONLY |
| [G] | `packages/shared/src/lib/rbac.generated.ts` | generated | REGENERATE-ONLY |
| [G] | `packages/shared/src/lib/schemas.enums.generated.ts` | generated | REGENERATE-ONLY |

