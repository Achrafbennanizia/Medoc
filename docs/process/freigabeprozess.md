# Software-Freigabeprozess (Release Process)

**Standard-Bezug:** IEC 62304 §5.8 (NFA-PROC-01)
**Stand:** 2026-04-19
**Verantwortlich:** Engineering Lead

## 1. Geltungsbereich
Dieses Dokument definiert den verbindlichen Freigabeprozess für jede MeDoc-Version.
Es gilt für Major-, Minor- und Patch-Releases sowie für Sicherheits-Hotfixes.

## 2. Versionsschema
MeDoc folgt **Semantic Versioning** (`MAJOR.MINOR.PATCH`):
- **MAJOR**: Inkompatible API- oder Datenmodell-Änderung.
- **MINOR**: Funktionserweiterungen, abwärtskompatibel.
- **PATCH**: Bugfixes, Sicherheitsupdates.

Pre-Release-Tags: `-alpha.N`, `-beta.N`, `-rc.N`.

## 3. Phasen

### 3.1 Entwicklung
- Feature-Branches von `main`.
- Pull-Request mit verpflichtendem Code-Review (≥1 Reviewer).
- CI-Gate: push/PR `CI` wrapper delegates to reusable `.github/workflows/verify.yml` (Rust: `cargo fmt -- --check`, `cargo clippy -- -D warnings`, `cargo test`, `cargo audit`; Web: lint/typecheck/test/build; A11y: axe-core critical gate).

### 3.2 Stabilisierung (Release-Branch)
- Branch `release/x.y.z` von `main`.
- Nur Bugfixes; keine neuen Features.
- Mindestens **48h Beobachtung** in Test-Praxis-Umgebung.

### 3.3 Freigabekriterien (Release Gate)

| Kriterium | Nachweis | Verantwortlich |
|-----------|----------|----------------|
| Alle Unit-Tests grün | CI-Log | Engineering |
| `cargo audit` ohne **high/critical** | CI-Log | Engineering |
| `npm audit` ohne **high/critical** | CI-Log | Engineering |
| Audit-Chain-Verifikation grün (Test-DB) | Test-Protokoll | QA |
| Backup + Restore manuell durchgespielt | Test-Protokoll | QA |
| Risiko-Akte (ISO 14971) reviewt | Signoff | Risk Owner |
| SOUP-Liste aktuell (`docs/iso-standards/09-soup-liste.md`) | Diff-Review | Engineering |
| Benutzerhandbuch aktualisiert | Diff-Review | Tech Writer |
| Versionshinweise (CHANGELOG.md) erstellt | Datei-Existenz | Engineering Lead |
| Freigabe-Signoff durch Engineering Lead | Tag im Repo | Engineering Lead |

### 3.4 Tag und Build
- Annotierter Git-Tag `vX.Y.Z` mit GPG-Signatur.
- Reproduzierbarer Build über CI: `cargo build --release` + `npm run build` + `tauri build`.
- Artefakte: `MeDoc-vX.Y.Z-{windows,macos,linux}.{exe,dmg,AppImage}` + SHA-256-Summen.

### 3.5 Verteilung
- Signierte Installer (Code-Signing-Zertifikat).
- Release-Notes auf internem Portal.
- Manuelle Verteilung an Pilotpraxen vor breitem Rollout.

### 3.6 Hotfix-Prozess
- Branch `hotfix/x.y.z+1` von Tag.
- Verkürzter Gate: nur Tests + Audit + Sicherheits-Review.
- Innerhalb 24h für **CVSS ≥7** Sicherheitslücken.

## 4. Dokumentation
Pro Release wird abgelegt:
- `releases/vX.Y.Z/CHANGELOG.md`
- `releases/vX.Y.Z/release-gate-checklist.md` (alle Häkchen + Signaturen)
- `releases/vX.Y.Z/sbom.json` (CycloneDX)

## 5. Rollback
Bei kritischen Regressionen:
1. Stop-Bulletin an alle Praxen (Mail + Telefon).
2. Vorheriger Installer wird wieder bereitgestellt.
3. Datenbank-Migrationen sind rückwärts-kompatibel oder mit Migrations-Skript versehen.
4. Post-Mortem innerhalb 5 Werktagen.
