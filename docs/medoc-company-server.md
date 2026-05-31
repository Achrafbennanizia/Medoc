# medoc-company-server

Eigenständiges **Hersteller-Backend** (Demo/On-Prem) für Abo-Kennzahlen, Integrationsstatus, Feature-Flags, Billing-Portal-URL und Zahlungsmethoden-Anlage. Die **Desktop-App** spricht es über `company.portal.config.v1` in SQLite (`get_company_portal_config` / IPC) bzw. Umgebungsvariablen an.

## Build & Start

```bash
cargo run -p medoc-company-server -- --data-dir ./tmp-company-data
```

| Argument | Bedeutung |
|----------|-----------|
| `--data-dir <PATH>` | **Pflicht.** Verzeichnis für `company.db` (wird angelegt). |
| `--http-bind ADDR` | Standard: `0.0.0.0` |
| `--http-port PORT` | Standard: **9797** |

Öffentlicher Health-Check: `GET http://127.0.0.1:9797/health`  
Geschützte API: Präfix **`/v1`** (z. B. `GET /v1/summary`).

## Demo-Mandant (Seed)

Nach dem ersten Start enthält die Datenbank eine Demo-Praxis:

| Header / Feld | Wert |
|-----------------|------|
| `X-Practice-Slug` | `demo-praxis` |
| `Authorization` | `Bearer sk_demo_company_practice_key` |

Beispiel:

```bash
curl -sS -H "X-Practice-Slug: demo-praxis" \
  -H "Authorization: Bearer sk_demo_company_practice_key" \
  http://127.0.0.1:9797/v1/summary
```

## Desktop-Anbindung

In **Einstellungen › System › Hersteller-Portal** (nur `ops.system`):

- **Basis-URL:** `http://127.0.0.1:9797` (ohne abschließenden Slash)
- **Praxis-Slug:** `demo-praxis`
- **API-Schlüssel:** `sk_demo_company_practice_key`

Alternativ (CI / Skripte): Umgebungsvariablen **`MEDOC_COMPANY_API_BASE`** und **`MEDOC_COMPANY_API_KEY`** überschreiben die gespeicherte Konfiguration.

## Zahlungsmethode (Desktop)

Einheitlicher IPC-Befehl: **`attach_payment_method`** (siehe **Über die Anwendung › Zahlungsmethode**). Ist das Portal vollständig konfiguriert, leitet die Rust-Schicht an `POST /v1/billing/payment-methods` weiter.

## LAN-Spiegel (optional)

Der eingebettete **LAN-Server** (`medoc-lan`) bietet für dieselbe Rolle `ops.system` JSON-Spiegel unter:

- `GET /api/v1/company/summary`
- `GET /api/v1/company/integrations/status`
- `GET /api/v1/company/feature-flags`
- `POST /api/v1/company/billing/portal-session`

Authentifizierung wie bei den anderen LAN-Routen: **`Authorization: Bearer <JWT>`** nach `POST /api/v1/auth/login`.
