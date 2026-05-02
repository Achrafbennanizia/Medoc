# Settings inventory & cull (2026-05-02)

Each setting from the pre-refactor UI / `client-settings.ts` is classified. **REMOVE** items had no runtime readers (grep across `app/src` + Rust) or were duplicate non-functional toggles.

| Setting / UI block | Verdict | Justification |
| --- | --- | --- |
| `notifications.push` | **REMOVE** | No code reads this; purely cosmetic with no observable effect. |
| `notifications.mailDigest` | **REMOVE** | No code reads this; purely cosmetic with no observable effect. |
| `notifications.criticalAlerts` | **REMOVE** | No code reads this; purely cosmetic with no observable effect. |
| `notifications.smsReminders` | **REMOVE** | No SMS pipeline; no code reads this. |
| `security.remindTwoFactor` | **REMOVE** | No 2FA path; no code reads this. |
| `security.remindAutoLock` | **REMOVE** | No lock UI reads this; purely cosmetic with no observable effect. |
| `integrations.doccheckSso` | **REMOVE** | No DocCheck integration exists; no code reads this. |
| `integrations.tkKim` | **REMOVE** | KIM / TK flow stubbed; no code reads this. |
| `integrations.laborDentalUnion` | **REMOVE** | No Labor integration exists; no code reads this. |
| `integrations.datevMonthlyExport` | **REMOVE** | No DATEV export reads this flag; purely cosmetic with no observable effect. |
| Einstellungen → **Hilfe** embedded `LazyHilfePage` | **REMOVE** | Duplicate of standalone `/hilfe`; replace with link row. |
| Einstellungen → **Compliance** embedded in Sicherheit | **REMOVE** | Duplicate of `/compliance`; use link. |
| **Module & Abläufe** (embedded full pages) | **REMOVE** | Decorative/noisy; navigation already available app-wide. |
| Separate nav: Benachrichtigungen, Integrationen | **REMOVE** | Sections empty after cull. |
| Lizenz card “Über & Updates” isolated | **MOVE** | Merged into **Über die Anwendung** group. |
| Embedded About from Hilfe (duplicate entry points) | **MOVE** | Single **Über** section + native menu still opens `AboutAppDialog`. |
| `appearance.density` | **KEEP** | Read by `applyAppearanceFromSettings` → `html[data-density]`. |
| `appearance.darkSidebar` | **KEEP** | Read by `applyAppearanceFromSettings` → `html[data-sidebar-tone]`. |
| `workflows.termineDefaultView` | **KEEP** | Read in `termine.tsx` on first paint + persisted on view change. |
| `akte.openImagesWithApp` | **KEEP** | Read in `patient-detail.tsx` for extern open. |
| Praxis Rechnung Stammdaten (local storage) | **KEEP** | Real PDF/invoice consumers. |
| Praxis-Präferenzen (KV) Terminregeln | **KEEP** | Used by Termin-planning paths. |
| Bestätigungs-Modi (`confirmation-preferences` + KV) | **KEEP** | Read via `resolveConfirmationPresentation` in Akte confirms. |
| Performance-Schwelle (Tauri) | **KEEP** | `getPerfThresholdMs` / `setPerfThresholdMs` real backend. |
| Health-Check | **KEEP** | `systemHealthCheck` real. |
| Migration + Backup | **KEEP** | Real commands; folded under **System** links/actions. |

## Added (must be wired)

| Setting | Behavior |
| --- | --- |
| `security.idleLogoutMinutes` | Client idle timer → logout after N min (0 = off); still uses `touchSession` on activity when not idle. |
| `workflows.tagesabschlussReminderTime` | Dashboard toast at local HH:MM once per day. |
| `workflows.defaultTerminDauerMin` | Prefill **Neuer Termin** duration. |
| `search.patientIncludeVersicherungsnummer` | Passed to `search_patienten` (Rust: name-only vs name+VN). |
| `appearance.showHeaderAvatar` | Hides topbar avatar chip when false. |
| `appearance.showKeyboardHints` | Hides `.ui-kbd-hint` elements (e.g. ⌘K). |

## DoD

- **Phase 1:** This doc + removals applied in `client-settings.ts` / `einstellungen.tsx`.
- **Phase 2:** All new keys have a verified read site (see code + Rust `search` branch).
- **Phase 3:** Nav groups: Praxis, Konto, Darstellung, Arbeitsabläufe, Export & Druck, System, Über.
