# Feedback- und Vigilanz-Prozess

**Standard-Bezug:** ISO 14971 §10, IEC 82304-1 §7 (NFA-PROC-05, NFA-PROC-06)
**Stand:** 2026-04-19

## 1. Zweck
Systematische Erfassung von Nutzerproblemen, Sicherheitsmeldungen und Erfahrungen
aus dem Feldeinsatz zur kontinuierlichen Verbesserung und zur Erfüllung der
Nachmarktüberwachungs-Anforderungen.

## 2. Eingangskanäle

| Kanal | Adressat | Reaktionszeit |
|-------|----------|---------------|
| In-App-Feedback (Menü → Hilfe → Feedback senden) | Support | 2 Werktage |
| support@medoc.local | Support | 2 Werktage |
| Telefon (Hotline 24/7) | Bereitschaft | <4 h |
| Sicherheits-E-Mail security@medoc.local (PGP) | Security Officer | <24 h |
| Datenschutz-E-Mail dsb@medoc.local | DSB | <72 h (DSGVO-Frist) |

## 3. Klassifikation eingehender Meldungen

| Typ | Beispiele | Eskalation |
|-----|-----------|-----------|
| Funktionsfehler | Falscher Wert in Liste | Bug-Tracker (siehe `bug-tracking.md`) |
| Usability-Hinweis | Knopf schwer zu finden | UX-Backlog |
| Sicherheits­meldung | Verdacht auf Datenleck | Security-Incident-Prozess |
| Datenschutz-Vorfall | Unbefugter Zugriff | DSGVO Art. 33 (72h-Meldepflicht) |
| Vorkommnis (PSUR) | Patient gefährdet durch falsche Information | Vigilanz-Verfahren §3 MPDG |

## 4. Vigilanz-Verfahren (Vorkommnismeldung)
Auch wenn MeDoc kein Medizinprodukt im Sinne der MDR ist, wird ein freiwilliges
Vorkommnis-Verfahren betrieben, weil Software-Fehler zu fehlerhafter Dokumentation
und damit indirekt zu Patientenschäden führen können.

1. **Erfassung** binnen 24 h nach Kenntnis.
2. **Soforteinschätzung** durch Engineering Lead + Risk Owner:
   - Schweregrad nach ISO 14971 (S1 katastrophal … S5 unbedeutend)
   - Wahrscheinlichkeit
   - Notwendigkeit Sofortmaßnahme (Stop-Bulletin / Hotfix)
3. **Untersuchung**: Root-Cause-Analyse, Logs der betroffenen Praxis sichten
   (mit deren Zustimmung; Daten pseudonymisieren).
4. **Maßnahmen**: Hotfix, Bulletin, Schulungs-Hinweis, Risikobewertung anpassen.
5. **Abschluss**: Eintrag in Risiko-Akte und CAPA-Liste.

## 5. Nachmarktüberwachung (Post-Market Surveillance)
Quartalsweiser **PMS-Bericht** mit:
- Anzahl Meldungen nach Kategorie
- Trends (häufige Probleme)
- Status offener Maßnahmen
- Bewertung des Restrisikos
- Änderungen an SOUP-Komponenten und deren Sicherheitslage

Der Bericht wird vom Security Officer erstellt und vom Engineering Lead
freigegeben. Ablage unter `docs/post-market/YYYY-Qn-pms.md`.

## 6. CAPA (Corrective and Preventive Actions)
Jede S1/S2-Meldung erzeugt einen CAPA-Eintrag mit:
- Sofortmaßnahme (Containment)
- Korrekturmaßnahme (Fix)
- Vorbeugende Maßnahme (Prävention künftiger gleichartiger Vorkommnisse)
- Verantwortlich, Frist, Erledigt-Datum, Wirksamkeits-Nachweis

CAPA-Liste wird monatlich im Engineering-Review besprochen.

## 7. Datenschutz
- Nutzerfeedback enthält **keine** Patientendaten (Hinweis im UI).
- Eingehende Logs werden vor Versand pseudonymisiert.
- Speicherung ≤24 Monate, danach Löschung oder Aggregation.

## 8. Wirksamkeitsmessung
- Mittlere Zeit bis Reaktion / Behebung
- Wiederholungsrate gleicher Meldungen
- Anteil eskalationspflichtiger Vorkommnisse

Ziele werden jährlich überprüft und angepasst.
