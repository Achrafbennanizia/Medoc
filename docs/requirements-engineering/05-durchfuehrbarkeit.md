# 5. Durchführbarkeitsstudie und -bericht

## 5.1 Durchführbarkeitsstudie

### Projektziel
Entwicklung eines Desktop-basierten Praxismanagementsystems (PMS) für Zahnarztpraxen mit 1-3 Ärzten, das Terminverwaltung, elektronische Patientenakte, Zahnschema, Finanzverwaltung und Personalmanagement in einer integrierten Anwendung vereint.

### Technische Durchführbarkeit

| Kriterium | Bewertung | Begründung |
|-----------|-----------|-----------|
| **Desktop-Framework** | ✅ Machbar | Tauri v2 – leichtgewichtig, native Performance, Rust-Backend |
| **Frontend-Technologie** | ✅ Machbar | React + TypeScript mit MVC-Architektur, etabliertes Ökosystem |
| **Backend-Sprache** | ✅ Machbar | Rust – Speichersicherheit, Performance, Parallelität |
| **Datenbank** | ✅ Machbar | SQLite – embedded, kein Server nötig, ACID-konform |
| **Offline-Fähigkeit** | ✅ Machbar | Lokale SQLite-DB, kein Netzwerk erforderlich |
| **Sicherheit** | ✅ Machbar | SQLCipher (verschlüsselte SQLite), bcrypt, RBAC |
| **Zahnschema** | ✅ Machbar | SVG-basiert, interaktiv, 32 Zähne FDI-Standard |

### Wirtschaftliche Durchführbarkeit

| Faktor | Analyse |
|--------|---------|
| Entwicklungskosten | Niedriger als kommerzielle PMS (Eigentwicklung, Open Source) |
| Lizenzkosten | Keine – Tauri (MIT), SQLite (Public Domain), React (MIT) |
| Wartungskosten | Gering – embedded DB, kein Server-Betrieb, automatische Updates via Tauri |
| ROI | Hoch – Ersetzt manuelle/papierbasierte Prozesse, Zeitersparnis ~2h/Tag |
| Marktvergleich | Bestehende PMS: Dampsoft, Charly, Z1 (teuer, komplex). MeDoc: fokussiert, kostengünstig |

### Organisatorische Durchführbarkeit

| Faktor | Bewertung |
|--------|-----------|
| Zielgruppe | Kleine Zahnarztpraxen mit geringer IT-Kompetenz |
| Schulungsaufwand | Gering – intuitive Oberfläche nach Nielsen-Heuristiken |
| Umstellungsrisiko | Mittel – Migration von Papier/Alt-System nötig |
| Datenmigration | Import-Schnittstelle vorgesehen (CSV/JSON) |

### Risikobewertung

| Risiko | Eintritt | Auswirkung | Maßnahme |
|--------|----------|-----------|----------|
| SQLite Concurrent-Writes | Mittel | Niedrig | WAL-Modus, optimistic locking |
| Datenverlust | Niedrig | Hoch | Automatisches tägliches Backup |
| DSGVO-Verletzung | Niedrig | Hoch | Verschlüsselung, Audit-Log, Rollenkonzept |
| Usability-Probleme | Mittel | Mittel | Iterative Evaluation, Nutzertests |
| Performance bei großen Datenmengen | Niedrig | Mittel | Indizierung, Pagination, lazy loading |
| ISO-Compliance-Lücken | Mittel | Mittel | ISO-Normen-Analyse durchgeführt (docs/iso-standards/), 9 neue Anforderungen identifiziert, 12 Erweiterungen bestehender Anforderungen |

## 5.2 Durchführbarkeitsbericht

### Ergebnis: ✅ Projekt ist durchführbar

**Begründung:**
1. Alle technischen Komponenten sind verfügbar und erprobt (Tauri, Rust, React, SQLite)
2. Die wirtschaftlichen Kosten sind minimal (nur Entwicklungszeit, keine Lizenzen)
3. Die organisatorische Einbettung ist realistisch für die Zielgruppe
4. Identifizierte Risiken sind beherrschbar durch definierte Gegenmaßnahmen
5. Der Architekturansatz (Clean Architecture + MVC) ermöglicht schrittweise Entwicklung

**Empfehlung:** Projekt starten mit Fokus auf Must-Have-Anforderungen (MoSCoW Prio M). Iterative Entwicklung in 4-Wochen-Zyklen mit jeweils Nutzer-Feedback.
