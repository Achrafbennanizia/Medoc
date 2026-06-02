# MeDoc Desktop – Rollen- und Berechtigungsmatrix

**Bezug:** `app/src-tauri/src/application/rbac.rs` (NFA-SEC-03)  
**Stand:** 2026-05-01

Diese Matrix beschreibt die **Tauri-Backend-Autorisierung** (Aktionen `action` in `allowed()`). Befehle rufen `require()` mit der passenden Aktion auf. Nicht aufgeführte Aktionen sind **standardmäßig verweigert** (`_ => false`).

**Legende:** ✓ = erlaubt · — = verweigert

## Berechtigungen nach Aktion

| Aktion | ARZT | REZEPTION | STEUERBERATER | PHARMABERATER |
|--------|:----:|:---------:|:---------------:|:-------------:|
| `patient.read_medical`, `patient.write_medical` | ✓ | — | — | — |
| `patient.read`, `patient.write` | ✓ | ✓ | — | — |
| `termin.list_aerzte`, `termin.read`, `termin.write` | ✓ | ✓ | — | — |
| `finanzen.read` | ✓ | ✓ | ✓ | — |
| `finanzen.write` | ✓ | ✓ | ✓ | — |
| `dashboard.read` | ✓ | ✓ | ✓ | ✓ |
| `produkt.read` | ✓ | ✓ | ✓ | ✓ |
| `produkt.write` | ✓ | ✓ | — | ✓ |
| `personal.read`, `personal.write` | ✓ | — | — | — |
| `vorlagen.read`, `vorlagen.write` | ✓ | — | — | — |
| `audit.read` | ✓ | — | — | — |
| `verwaltung.read` | ✓ | ✓ | ✓ | ✓ |
| `verwaltung.lager.read` | ✓ | ✓ | ✓ | ✓ |
| `verwaltung.lager.write` | ✓ | ✓ | — | ✓ |
| `verwaltung.vertraege.read` | ✓ | ✓ | ✓ | ✓ |
| `verwaltung.vertraege.write` | ✓ | ✓ | — | ✓ |
| `verwaltung.vorlagen.read`, `verwaltung.vorlagen.write` | ✓ | — | — | — |
| `verwaltung.kataloge.read`, `verwaltung.kataloge.write` | ✓ | ✓ | ✓ | — |
| `finanzen.tagesabschluss.write` | ✓ | ✓ | ✓ | — |
| `ops.backup`, `ops.dsgvo`, `ops.migration`, `ops.system`, `ops.logs` | ✓ | — | — | — |

## Hinweise

- **Rollen-Strings** in der Session: `ARZT`, `REZEPTION`, `STEUERBERATER`, `PHARMABERATER` (`Role::parse`).
- Das **Desktop-Frontend** unter `app/src/lib/rbac.ts` spiegelt dieselben `allowed()`-Strings für Navigation und `RoleRoute`; Verwaltungs-Unterpfade sind über `ROUTE_VISIBILITY` feiner als früher (`personal.read` nur noch Personal/Praxis-Kalender).
