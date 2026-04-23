# Bug-Tracking- und Problemlösungsprozess

**Standard-Bezug:** IEC 62304 §9 (NFA-PROC-03)
**Stand:** 2026-04-19

## 1. Werkzeug
Alle Probleme werden in einem zentralen Issue-Tracker (z. B. GitHub Issues, GitLab,
Jira) erfasst. Das System muss versionskontrolliert, durchsuchbar und exportierbar
sein.

## 2. Klassifikation

| Schweregrad | Definition | Reaktionszeit | Lösungsfrist |
|-------------|-----------|---------------|--------------|
| **S1 – Kritisch** | Datenverlust, Sicherheitsleck, Patientenakte unzugänglich | <1 h | <24 h (Hotfix) |
| **S2 – Hoch** | Wichtige Funktion ausgefallen, Workaround unklar | <4 h | <5 Werktage |
| **S3 – Mittel** | Funktion eingeschränkt, Workaround vorhanden | <1 Werktag | nächster Minor-Release |
| **S4 – Niedrig** | Kosmetisch, Komfort | <5 Werktage | best effort |

## 3. Lebenszyklus
```
NEU → TRIAGE → BESTÄTIGT → IN ARBEIT → IN REVIEW → BEHOBEN → VERIFIZIERT → GESCHLOSSEN
                            ↘ ABGEWIESEN (mit Begründung)
```

## 4. Pflichtfelder pro Issue
- Titel, Beschreibung, Reproduktionsschritte
- Erwartetes vs. tatsächliches Verhalten
- Version, Betriebssystem, Rolle
- Schweregrad und Häufigkeit
- Anhänge: Logs, Screenshots (PII anonymisieren!)
- CVSS-Score bei Sicherheitsbezug
- Verknüpfte Anforderungen (FA-/NFA-IDs)
- Verknüpftes Risiko (RM-ID aus ISO 14971-Akte)

## 5. Sicherheitsmeldungen (CVE-Watch)
- `cargo audit` und `npm audit` laufen wöchentlich automatisiert.
- Neue Advisories der Stufe **high/critical** erzeugen automatisch ein S1/S2-Issue.
- Verantwortlicher Engineer wird in <4h benachrichtigt.

## 6. Verifizierung
Jede Behebung erfordert:
- Reproduktions-Test als automatisierten Regressionstest.
- Manuelle Verifizierung durch QA in Test-Umgebung.
- Eintrag in `releases/vX.Y.Z/CHANGELOG.md`.

## 7. Eskalation
Issues, die ihre Lösungsfrist überschreiten, werden täglich an Engineering Lead
gemeldet und im Wochen-Stand-up behandelt.

## 8. Berichtswesen
- Monatlicher Bug-Report: offene/geschlossene Issues, Trends, mittlere Lösungszeit.
- Quartalsweise Auswertung: Häufung von Themen → Architektur-Reviews.
