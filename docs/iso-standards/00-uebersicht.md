# ISO-Normen und regulatorische Anforderungen – MeDoc

## Dokumentübersicht

Dieses Dokument identifiziert und erläutert alle relevanten ISO-Normen und regulatorischen Anforderungen für das Praxismanagementsystem **MeDoc** – eine Desktop-Anwendung zur Verwaltung einer Zahnarztpraxis, die sensible Patientengesundheitsdaten verarbeitet.

### Einordnung: Ist MeDoc ein Medizinprodukt?

**Wichtige Vorbemerkung:** Die Frage, ob MeDoc als Medizinprodukt gemäß der EU-Medizinprodukteverordnung (MDR 2017/745) einzustufen ist, bestimmt, welche Normen **verpflichtend** und welche **empfohlen** sind.

**MeDoc enthält folgende Funktionen:**
- Verwaltung elektronischer Patientenakten (Befunde, Diagnosen, Behandlungen)
- Interaktives Zahnschema mit klinischen Befunddaten
- Ärztliche Dokumentation (Untersuchungen, Behandlungen)
- Termin-, Finanz- und Personalverwaltung

**Einschätzung:** Nach Artikel 2 Absatz 1 der MDR 2017/745 wird Software dann als Medizinprodukt eingestuft, wenn sie einem **medizinischen Zweck** dient (z.B. Diagnose, Prävention, Überwachung, Behandlung). Ein reines Praxisverwaltungssystem (PVS) zur administrativen Unterstützung fällt typischerweise **nicht** unter die MDR. Da MeDoc jedoch klinische Befunddaten im Zahnschema verwaltet und eine ärztliche Dokumentation mit Diagnosen führt, könnte eine Grauzone bestehen. 

**Empfehlung:** Auch wenn MeDoc voraussichtlich nicht als Medizinprodukt im Sinne der MDR eingestuft wird, sollten die relevanten Normen für Gesundheitssoftware als **Best Practice** angewendet werden, da das System hochsensible Gesundheitsdaten verarbeitet.

---

## Relevante Normen – Übersicht

| # | Norm | Titel | Anwendbarkeit | Verbindlichkeit |
|---|------|-------|---------------|-----------------|
| 1 | IEC 62304:2006+AMD1:2015 | Medizingeräte-Software – Lebenszyklusprozesse | Empfohlen (Best Practice) | Verpflichtend nur bei MDR-Einstufung |
| 2 | ISO 14971:2019 | Anwendung des Risikomanagements auf Medizinprodukte | Empfohlen (Best Practice) | Verpflichtend nur bei MDR-Einstufung |
| 3 | IEC 82304-1:2016 | Gesundheitssoftware – Allgemeine Anforderungen an die Produktsicherheit | Hoch relevant | Empfohlen für Gesundheitssoftware |
| 4 | ISO/IEC 27001:2022 | Informationssicherheits-Managementsysteme | Hoch relevant | Empfohlen, de-facto-Standard |
| 5 | ISO 27799:2016 | Informationssicherheitsmanagement im Gesundheitswesen | Hoch relevant | Empfohlen für Gesundheits-IT |
| 6 | ISO/IEC 25010:2011 | Software-Qualitätsmodell (SQuaRE) | Relevant | Empfohlen |
| 7 | ISO 9241-210:2019 | Menschzentrierte Gestaltung interaktiver Systeme | Relevant | Empfohlen |
| 8 | ISO 9241-110:2020 | Interaktionsprinzipien | Relevant | Empfohlen |
| 9 | ISO 22600:2014 | Privilegienmanagement und Zugriffskontrolle im Gesundheitswesen | Relevant | Empfohlen |
| 10 | DSGVO (EU 2016/679) | Datenschutz-Grundverordnung | Direkt anwendbar | **Verpflichtend** |
| 11 | ISO 13485:2016 | Medizinprodukte – Qualitätsmanagementsysteme | Bedingt relevant | Verpflichtend nur bei MDR-Einstufung |

---

## Dokumentstruktur

| Datei | Inhalt |
|-------|--------|
| [01-iec-62304.md](01-iec-62304.md) | IEC 62304 – Software-Lebenszyklusprozesse |
| [02-iso-14971.md](02-iso-14971.md) | ISO 14971 – Risikomanagement |
| [03-iec-82304.md](03-iec-82304.md) | IEC 82304-1 – Gesundheitssoftware-Sicherheit |
| [04-iso-27001-27799.md](04-iso-27001-27799.md) | ISO 27001 + ISO 27799 – Informationssicherheit im Gesundheitswesen |
| [05-iso-25010.md](05-iso-25010.md) | ISO/IEC 25010 – Software-Qualitätsmodell |
| [06-iso-9241.md](06-iso-9241.md) | ISO 9241 – Usability und Interaktionsprinzipien |
| [07-iso-22600-dsgvo.md](07-iso-22600-dsgvo.md) | ISO 22600 + DSGVO – Zugriffskontrolle und Datenschutz |
| [08-anforderungen-iso-mapping.md](08-anforderungen-iso-mapping.md) | Mapping: ISO-Anforderungen → MeDoc-Anforderungen |
