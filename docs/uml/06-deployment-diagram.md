# Verteilungsdiagramm (Deployment Diagram) – MeDoc

## Beschreibung
Zeigt die Zuordnung von Software-Komponenten zu physischer Hardware und wie das System auf einem Desktop-Arbeitsplatz deployrt wird.

## Desktop-Deployment

```mermaid
graph TB
    subgraph "Praxis-Netzwerk (LAN)"
        subgraph "Arbeitsplatz: Rezeption"
            subgraph "Hardware: PC (Windows/macOS/Linux)"
                subgraph "OS Process: MeDoc.exe / MeDoc.app"
                    subgraph "Tauri Runtime"
                        WV1["WebView (WebKit/WebView2)"]
                        RS1["Rust Backend Process"]
                    end
                    subgraph "Frontend (WebView)"
                        FE1["React SPA<br/>(HTML/CSS/JS Bundle)"]
                    end
                    subgraph "Backend (Rust)"
                        BE1["Application Services"]
                        BE1_DB["SQLite + SQLCipher"]
                    end
                end
                FS1[("Dateisystem<br/>~/medoc-data/<br/>├── medoc.db<br/>├── backups/<br/>└── dokumente/")]
            end
            MON1["Monitor ≥1259×1024"]
            KB1["Tastatur + Maus"]
            PR1["Drucker (Netzwerk)"]
        end

        subgraph "Arbeitsplatz: Arzt"
            subgraph "Hardware: PC (Windows/macOS/Linux) "
                subgraph "OS Process: MeDoc.exe / MeDoc.app "
                    subgraph "Tauri Runtime "
                        WV2["WebView"]
                        RS2["Rust Backend Process"]
                    end
                    subgraph "Frontend (WebView) "
                        FE2["React SPA"]
                    end
                    subgraph "Backend (Rust) "
                        BE2["Application Services"]
                        BE2_DB["SQLite + SQLCipher"]
                    end
                end
                FS2[("Dateisystem<br/>~/medoc-data/<br/>├── medoc.db<br/>├── backups/<br/>└── dokumente/")]
            end
            MON2["Monitor ≥1259×1024"]
            RX["Röntgengerät (DICOM)"]
            SC["Intraoral-Scanner"]
        end

        NAS[("NAS / Shared Drive<br/>Zentrales Backup<br/>Tägliche Sicherung")]
    end

    FE1 -.->|"Tauri IPC<br/>(invoke)"| RS1
    RS1 --> BE1
    BE1 --> BE1_DB
    BE1_DB --> FS1

    FE2 -.->|"Tauri IPC<br/>(invoke)"| RS2
    RS2 --> BE2
    BE2 --> BE2_DB
    BE2_DB --> FS2

    FS1 -.->|"Backup (täglich)"| NAS
    FS2 -.->|"Backup (täglich)"| NAS

    BE1 -.->|"Drucken"| PR1
    BE2 -.->|"Drucken"| PR1
    RX -.->|"DICOM Import"| FS2
    SC -.->|"Scan Import"| FS2
```

## Deployment-Konfiguration

### Einzelplatz-Modus (Standard)
Jeder Arbeitsplatz hat eine eigene SQLite-Datenbank. Ideal für kleine Praxen mit 1 Arzt.

| Komponente | Pfad | Beschreibung |
|-----------|------|-------------|
| Anwendung | `/Applications/MeDoc.app` (macOS) | Tauri-Bundle mit Frontend + Backend |
| | `C:\Program Files\MeDoc\MeDoc.exe` (Windows) | |
| Datenbank | `~/medoc-data/medoc.db` | SQLCipher-verschlüsselte SQLite |
| Backups | `~/medoc-data/backups/` | Tägliche automatische Sicherung |
| Dokumente | `~/medoc-data/dokumente/` | Röntgenbilder, Scans, Atteste |
| Logs | `~/medoc-data/logs/` | Application Logs |
| Config | `~/medoc-data/config.toml` | Benutzereinstellungen |

### Mehrplatz-Modus (Optional)
Für Praxen mit 2-3 Arbeitsplätzen: Gemeinsame SQLite-Datenbank auf NAS/Netzlaufwerk.

| Aspekt | Lösung |
|--------|--------|
| Datenbank-Pfad | Konfigurierbar auf Netzlaufwerk |
| Concurrent Access | SQLite WAL-Modus + Optimistic Locking |
| Dateisynchronisation | Gemeinsames Netzlaufwerk für Dokumente |
| Backup | Zentrales NAS-Backup |

## System-Anforderungen

### Minimum

| Ressource | Anforderung |
|-----------|-------------|
| OS | Windows 10+, macOS 12+, Ubuntu 22.04+ |
| CPU | x86_64 oder ARM64 |
| RAM | 4 GB |
| Festplatte | 500 MB (App) + Speicher für Dokumente |
| Display | 1259×1024 Pixel |
| WebView | WebView2 (Windows) / WebKit (macOS/Linux) |

### Empfohlen

| Ressource | Empfehlung |
|-----------|-----------|
| RAM | 8 GB |
| Festplatte | SSD, 10 GB+ für Dokumente |
| Display | Full HD (1920×1080) |
| Netzwerk | LAN für Mehrplatz-Modus |
| Backup | Externes NAS oder USB-Laufwerk |
