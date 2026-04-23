# Requirements Engineering – MeDoc

## Prozessübersicht

Das Requirements Engineering für MeDoc folgt zwei komplementäre Prozessmodelle:

### Modell 1: Iterativer Zyklus (nach Sommerville)

```
    ┌─────────────────────────────┐
    │                             ▼
┌────────────┐    ┌──────────────────────────┐
│ 4. Spezi-  │    │ 1. Sammeln der           │
│ fikation   │    │    Anforderungen          │
└────────────┘    └──────────────────────────┘
    ▲                             │
    │                             ▼
┌────────────────────────┐    ┌──────────────────────────┐
│ 3. Priorisierung und   │◄───│ 2. Klassifizierung und   │
│    Konfliktauflösung    │    │    Organisation           │
└────────────────────────┘    └──────────────────────────┘
```

### Modell 2: RE-Prozessfluss

```
Durchführbarkeitsstudie ──► Anforderungserhebung und -analyse
         │                          │              │
         ▼                          ▼              ▼
  Durchführbarkeits-        Systemmodelle    Anforderungs-
  bericht                                   spezifikation
                                                │       │
                                                ▼       ▼
                                          Benutzer-   Anforderungs-
                                          und System- validierung
                                          anforde-        │
                                          rungen          ▼
                                                    Anforderungs-
                                                    spezifikation
```

## Dokumentstruktur

| Dokument | Beschreibung | Status |
|----------|-------------|--------|
| [01-sammeln.md](./01-sammeln.md) | Sammeln der Anforderungen | ✅ Abgeschlossen |
| [02-klassifizierung.md](./02-klassifizierung.md) | Klassifizierung und Organisation | ✅ Abgeschlossen |
| [03-priorisierung.md](./03-priorisierung.md) | Priorisierung und Konfliktauflösung | ✅ Abgeschlossen |
| [04-spezifikation.md](./04-spezifikation.md) | Spezifikation der Anforderungen | ✅ Abgeschlossen |
| [05-durchfuehrbarkeit.md](./05-durchfuehrbarkeit.md) | Durchführbarkeitsstudie und -bericht | ✅ Abgeschlossen |
| [06-validierung.md](./06-validierung.md) | Anforderungsvalidierung | ✅ Abgeschlossen |
