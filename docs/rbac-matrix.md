# MeDoc Desktop – Rollen- und Berechtigungsmatrix

**Bezug:** `app/src-tauri/src/application/rbac.rs` (NFA-SEC-03)  
**Stand:** 2026-04-19

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
| `ops.backup`, `ops.dsgvo`, `ops.migration`, `ops.system`, `ops.logs` | ✓ | — | — | — |

## Hinweise

- **Rollen-Strings** in der Session: `ARZT`, `REZEPTION`, `STEUERBERATER`, `PHARMABERATER` (`Role::parse`).
- Das **Next.js-Prototyping** unter `src/` nutzt eine **eigene** Matrix in `src/src/lib/rbac.ts` (Resource/Action-Modell) und kann von dieser Datei abweichen.
