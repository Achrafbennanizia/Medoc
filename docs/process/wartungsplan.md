# Software-Wartungsplan

**Standard-Bezug:** IEC 62304 §6 (NFA-PROC-04)
**Stand:** 2026-04-19

## 1. Wartungsstrategie
MeDoc wird als sicherheits-relevantes Praxisverwaltungssystem über die gesamte
Lebensdauer aktiv gewartet. Wartung umfasst korrigierende, adaptive, perfektive
und präventive Maßnahmen (IEEE 14764).

## 2. Update-Zyklen

| Typ | Frequenz | Inhalt |
|-----|----------|--------|
| **Patch** | Bei Bedarf (max. 4 Wochen nach Sicherheitsmeldung) | Bugfixes, Sicherheits-Patches |
| **Minor** | Quartalsweise | Feature-Erweiterungen, abwärtskompatibel |
| **Major** | Jährlich | Größere Umbauten, ggf. Migrationen |
| **Hotfix** | <24 h | CVSS≥7-Sicherheitslücken, Datenverlust-Risiken |

## 3. Pflicht-Wartungsaktivitäten

### 3.1 Wöchentlich (automatisiert)
- `cargo audit` für Rust-Abhängigkeiten.
- `npm audit --omit=dev --audit-level=high` für Frontend-Abhängigkeiten.
- CI-Build-Verifikation auf neuestem Toolchain-Stand.

### 3.2 Monatlich
- Triage neuer Sicherheitsmeldungen aus SOUP-Liste.
- Review offener S2-Issues älter als 30 Tage.
- Performance-Smoke-Test (Patientensuche, Akten-Öffnen <2s).

### 3.3 Quartalsweise
- Aktualisierung von SOUP-Liste (`docs/iso-standards/09-soup-liste.md`).
- Risiko-Akte (ISO 14971) durchsehen, Restrisiken bewerten.
- Backup-Restore-Übung (Wiederherstellung in Test-Umgebung).
- Audit-Chain-Stichprobe in Test-Praxis.
- Review der Aufbewahrungsfristen-Konfiguration (`infrastructure/retention.rs`).

### 3.4 Jährlich
- Penetrationstest durch unabhängigen Anbieter.
- Disaster-Recovery-Übung (kompletter Praxis-Wiederaufbau).
- Review aller Prozess-Dokumente.
- Schulung für Praxispersonal.

## 4. Kompatibilitätsmatrix

| MeDoc-Version | Rust | Node | OS-Mindeststand |
|---------------|------|------|-----------------|
| 0.1.x | 1.78+ | 20 LTS | Win10 / macOS 12 / Ubuntu 22.04 |

Toolchain-Updates erfolgen mindestens jährlich, nicht über zwei
Major-Versionen hinaus zurück bleibend.

## 5. End-of-Life
- Eine Major-Version wird **24 Monate** nach dem Folge-Major-Release nicht mehr
  mit Sicherheitspatches versorgt.
- 6 Monate vor EOL erfolgt eine schriftliche Mitteilung an alle Praxen.

## 6. Verantwortlichkeiten

| Rolle | Aufgabe |
|-------|---------|
| Engineering Lead | Release-Planung, EOL-Kommunikation |
| Security Officer | Sicherheits-Patches, CVE-Tracking |
| QA | Regressionstests, Restore-Übungen |
| Tech Writer | Aktualisierung Benutzerhandbuch |
| Datenschutzbeauftragter | DSGVO-/Aufbewahrungsfristen-Review |

## 7. Dokumentation
Jeder Wartungs-Release wird im `CHANGELOG.md` und in der `releases/`-Hierarchie
dokumentiert.
