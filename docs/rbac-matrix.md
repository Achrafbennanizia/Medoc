# MeDoc Desktop – Rollen- und Berechtigungsmatrix

**Bezug:** `app/src-tauri/src/application/rbac.rs` (NFA-SEC-03)  
**Stand:** 2026-05-01

Diese Matrix beschreibt die **Tauri-Backend-Autorisierung** (Aktionen `action` in `allowed()`). Befehle rufen `require()` mit der passenden Aktion auf. Nicht aufgeführte Aktionen sind **standardmäßig verweigert** (`_ => false`).

**Legende:** ✓ = erlaubt · — = verweigert

## Berechtigungen nach Aktion

| Aktion | PHYSICIAN | RECEPTION | TAX_ADVISOR | PHARMA_CONSULTANT |
|--------|:----:|:---------:|:---------------:|:-------------:|
| `patient.read_medical`, `patient.write_medical` | ✓ | — | — | — |
| `patient.read`, `patient.write` | ✓ | ✓ | — | — |
| `appointment.list_physicians`, `appointment.read`, `appointment.write` | ✓ | ✓ | — | — |
| `finance.read` | ✓ | ✓ | ✓ | — |
| `finance.write` | ✓ | ✓ | ✓ | — |
| `dashboard.read` | ✓ | ✓ | ✓ | ✓ |
| `product.read` | ✓ | ✓ | ✓ | ✓ |
| `product.write` | ✓ | ✓ | — | ✓ |
| `staff.read`, `staff.write` | ✓ | — | — | — |
| `templates.read`, `templates.write` | ✓ | — | — | — |
| `audit.read` | ✓ | — | — | — |
| `administration.read` | ✓ | ✓ | ✓ | ✓ |
| `administration.inventory.read` | ✓ | ✓ | ✓ | ✓ |
| `administration.inventory.write` | ✓ | ✓ | — | ✓ |
| `administration.contracts.read` | ✓ | ✓ | ✓ | ✓ |
| `administration.contracts.write` | ✓ | ✓ | — | ✓ |
| `administration.templates.read`, `administration.templates.write` | ✓ | — | — | — |
| `administration.catalogs.read`, `administration.catalogs.write` | ✓ | ✓ | ✓ | — |
| `finance.day_close.write` | ✓ | ✓ | ✓ | — |
| `ops.backup`, `ops.dsgvo`, `ops.migration`, `ops.system`, `ops.logs` | ✓ | — | — | — |

## Hinweise

- **Rollen-Strings** in der Session: `PHYSICIAN`, `RECEPTION`, `TAX_ADVISOR`, `PHARMA_CONSULTANT` (`Role::parse`).
- Das **Desktop-Frontend** unter `app/src/lib/rbac.ts` spiegelt dieselben `allowed()`-Strings für Navigation und `RoleRoute`; Verwaltungs-Unterpfade sind über `ROUTE_VISIBILITY` feiner als früher (`staff.read` nur noch Personal/Praxis-Kalender).
