#!/usr/bin/env python3
"""Convert remaining German *wires* to English: IPC commands, serde/sqlx names,
routes, enum values, RBAC actions, i18n keys. Locale *values* in de.json stay German.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")
SKIP_DIRS = {".git", "node_modules", "target", "dist", "coverage", "releases", ".englishify"}
SKIP_FILES = {"GermanToEnglish.json", "clipped-identifiers.json"}

sys.path.insert(0, str(ROOT / ".englishify"))
import ident_rewrite as ir  # noqa: E402

CODE_EXT = {".rs", ".ts", ".tsx", ".js", ".jsx", ".sql", ".yaml", ".yml", ".json", ".md"}

ENUM_WIRE = {
    "NICHT_ERSCHIENEN": "NO_SHOW",
    "IN_BEARBEITUNG": "IN_PROGRESS",
    "STEUERBERATER": "TAX_ADVISOR",
    "PHARMABERATER": "PHARMA_CONSULTANT",
    "ERSTBESUCH": "FIRST_VISIT",
    "UNTERSUCHUNG": "EXAMINATION",
    "BEHANDLUNG": "TREATMENT",
    "KONTROLLE": "CHECKUP",
    "BERATUNG": "CONSULTATION",
    "BESTAETIGT": "CONFIRMED",
    "DURCHGEFUEHRT": "COMPLETED",
    "TEILBEZAHLT": "PARTIALLY_PAID",
    "UEBERWEISUNG": "BANK_TRANSFER",
    "MAENNLICH": "MALE",
    "WEIBLICH": "FEMALE",
    "REZEPTION": "RECEPTION",
    "AUSSTEHEND": "OUTSTANDING",
    "UNTERWEGS": "IN_TRANSIT",
    "GELIEFERT": "DELIVERED",
    "VALIDIERT": "VALIDATED",
    "ABGESAGT": "CANCELLED",
    "STORNIERT": "CANCELLED",
    "GEPLANT": "PLANNED",
    "BEARBEITUNG": "IN_PROGRESS",
    "SONSTIGES": "OTHER",
    "READONLY": "READONLY",
    "ENTWURF": "DRAFT",
    "ERLEDIGT": "DONE",
    "BEZAHLT": "PAID",
    "DIVERS": "DIVERSE",
    "RECHNUNG": "INVOICE",
    "KARTE": "CARD",
    "ARZT": "PHYSICIAN",
    "OFFEN": "OPEN",
    "AKTIV": "ACTIVE",
    "NEU": "NEW",
    "BAR": "CASH",
}

TABLE_MAP = {
    "personal_permission_override": "staff_permission_override",
    "tagesabschluss_protokoll": "day_close_protocol",
    "lieferant_pharma_vorlage": "supplier_pharma_template",
    "behandlungs_katalog": "treatment_catalog",
    "dokument_vorlage": "document_template",
    "praxis_aufgabe": "practice_task",
    "praxis_ticket": "practice_ticket",
    "patientenakte": "patient_chart",
    "akte_anlage": "chart_attachment",
    "zahnbefund": "dental_finding",
    "untersuchung": "examination",
    "behandlung": "treatment",
    "bestellung": "purchase_order",
    "bilanz_snapshot": "balance_sheet_snapshot",
    "anamnesebogen": "anamnesis_form",
    "krankenbescheinigung": "sick_leave_certificate",
    "arbeitsplan": "work_plan",
    "pharmaberater": "pharma_consultant",
    "lieferant": "supplier",
    "personal": "staff",
    "zahlung": "payment",
    "leistung": "service_item",
    "rezept": "prescription",
    "attest": "certificate",
    "produkt": "product",
    "termin": "appointment",
    "vertrag": "contract",
    "rechnung": "invoice",
}

ROUTE_MAP = {
    "akten/zu-validieren": "charts/to-validate",
    "verwaltung/lager-und-bestellwesen": "administration/inventory-and-ordering",
    "verwaltung/leistungen-kataloge-vorlagen": "administration/services-catalogs-templates",
    "verwaltung/finanzen-berichte/tagesabschluss": "administration/finance-reports/day-close",
    "verwaltung/finanzen-berichte/rechnung": "administration/finance-reports/invoice",
    "verwaltung/finanzen-berichte": "administration/finance-reports",
    "verwaltung/finanzen-werkzeuge": "administration/finance-tools",
    "verwaltung/krankenbescheinigung": "administration/sick-leave-certificate",
    "verwaltung/praxis-praeferenzen": "administration/practice-preferences",
    "verwaltung/sonder-sperrzeiten": "administration/special-blocked-times",
    "verwaltung/behandlungs-katalog": "administration/treatment-catalog",
    "verwaltung/praxisplanung": "administration/practice-planning",
    "verwaltung/arbeitszeiten": "administration/work-hours",
    "verwaltung/arbeitstage": "administration/work-days",
    "verwaltung/tagesabschluss": "administration/day-close",
    "verwaltung/bestellstamm": "administration/order-master",
    "verwaltung/vorlagen/editor": "administration/templates/editor",
    "verwaltung/vorlagen": "administration/templates",
    "verwaltung/vertraege": "administration/contracts",
    "verwaltung/aufgaben": "administration/tasks",
    "verwaltung/team/arbeitszeit": "administration/team/work-time",
    "verwaltung/team": "administration/team",
    "personal/arbeitsplan": "staff/work-plan",
    "personal/arbeitszeit": "staff/work-time",
    "personal/neu": "staff/new",
    "finanzen/kasse/neu": "finance/cash/new",
    "finanzen/kasse": "finance/cash",
    "finanzen/neu": "finance/new",
    "bestellungen/neu": "purchase-orders/new",
    "leistungen/neu": "services/new",
    "termine/neu": "appointments/new",
    "patienten/neu": "patients/new",
    "bilanz/neu": "balance-sheet/new",
    "tickets/neu": "tickets/new",
    "posteingang": "inbox",
    "datenschutz": "privacy",
    "einstellungen": "settings",
    "statistik": "statistics",
    "verwaltung": "administration",
    "bestellungen": "purchase-orders",
    "patienten": "patients",
    "termine": "appointments",
    "rezepte": "prescriptions",
    "atteste": "certificates",
    "leistungen": "services",
    "produkte": "products",
    "personal": "staff",
    "finanzen": "finance",
    "bilanz": "balance-sheet",
    "akten": "charts",
}

RBAC_ACTION = {
    "patient.behandlungen_list_for_zahlung": "patient.treatments_list_for_payment",
    "termin.list_aerzte": "appointment.list_physicians",
    "finanzen.tagesabschluss.write": "finance.day_close.write",
    "finanzen.reception.view": "finance.reception.view",
    "verwaltung.praxisplanung.read": "administration.practice_planning.read",
    "verwaltung.praxisplanung.write": "administration.practice_planning.write",
    "verwaltung.vertraege.read": "administration.contracts.read",
    "verwaltung.vertraege.write": "administration.contracts.write",
    "verwaltung.kataloge.read": "administration.catalogs.read",
    "verwaltung.kataloge.write": "administration.catalogs.write",
    "verwaltung.vorlagen.read": "administration.templates.read",
    "verwaltung.vorlagen.write": "administration.templates.write",
    "verwaltung.lager.read": "administration.inventory.read",
    "verwaltung.lager.write": "administration.inventory.write",
    "verwaltung.team.read": "administration.team.read",
    "verwaltung.read": "administration.read",
    "aufgabe.status.fulfill": "task.status.fulfill",
    "aufgabe.status.admin": "task.status.admin",
    "bestellung.read": "purchase_order.read",
    "bestellung.write": "purchase_order.write",
    "statistik.read": "statistics.read",
    "finanzen.read": "finance.read",
    "finanzen.write": "finance.write",
    "personal.read": "staff.read",
    "personal.write": "staff.write",
    "produkt.read": "product.read",
    "produkt.write": "product.write",
    "vorlagen.read": "templates.read",
    "vorlagen.write": "templates.write",
    "termin.read": "appointment.read",
    "termin.write": "appointment.write",
}

MISC = {
    "pauseVon": "breakFrom",
    "pauseBis": "breakUntil",
    "praxis.preferences.v1": "practice.preferences.v1",
    "arzt_only": "physician_only",
    "finanzen_staff": "finance_staff",
}


def iter_files() -> list[Path]:
    out: list[Path] = []
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if p.name in SKIP_FILES:
            continue
        if p.suffix.lower() not in CODE_EXT:
            continue
        out.append(p)
    return out


def collect_tauri_map() -> dict[str, str]:
    pat = re.compile(
        r'#\[tauri::command\(rename\s*=\s*"([^"]+)"\)\][^\n]*\n(?:#\[[^\]]+\]\s*\n)*'
        r"pub\s+(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)",
        re.M,
    )
    m: dict[str, str] = {}
    for p in (ROOT / "crates").rglob("*.rs"):
        if "target" in p.parts:
            continue
        text = p.read_text(encoding="utf-8")
        for de, en in pat.findall(text):
            m[de] = en
    return m


def collect_rename_map() -> dict[str, str]:
    """German serde/sqlx rename string → following English field name."""
    pat = re.compile(
        r'#\[(?:serde|sqlx)\(rename\s*=\s*"([^"]+)"\)\]\s*\n\s*'
        r'(?:#\[(?:serde|sqlx)\(rename\s*=\s*"[^"]+"\)\]\s*\n\s*)*'
        r"(?:pub\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*:",
        re.M,
    )
    m: dict[str, str] = {}
    for p in ROOT.rglob("*.rs"):
        if "target" in p.parts or ".git" in p.parts:
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except OSError:
            continue
        for de, en in pat.findall(text):
            if de != en:
                m[de] = en
    return m


def boundary_sub(text: str, old: str, new: str) -> str:
    if old == new or not old:
        return text
    pat = re.compile(rf"(?<![A-Za-z0-9_]){re.escape(old)}(?![A-Za-z0-9_])")
    return pat.sub(new, text)


def apply_map(text: str, mapping: dict[str, str]) -> str:
    for old, new in sorted(mapping.items(), key=lambda kv: len(kv[0]), reverse=True):
        if old == new:
            continue
        text = boundary_sub(text, old, new)
    return text


def strip_tauri_rename(text: str) -> str:
    return re.sub(r"#\[tauri::command\(rename\s*=\s*\"[^\"]+\"\)\]", "#[tauri::command]", text)


def strip_serde_sqlx_rename(text: str) -> str:
    text = re.sub(r"[ \t]*#\[serde\(rename\s*=\s*\"[^\"]+\"\)\]\n", "", text)
    text = re.sub(r"[ \t]*#\[sqlx\(rename\s*=\s*\"[^\"]+\"\)\]\n", "", text)
    return text


def translate_i18n_key(key: str) -> str:
    parts = key.split(".")
    out: list[str] = []
    for part in parts:
        hyphen = "-" in part
        token = part.replace("-", "_")
        mapped = ir.map_ident(token)
        if hyphen:
            mapped = mapped.replace("_", "-")
        out.append(mapped)
    return ".".join(out)


def rewrite_i18n_obj(obj):
    if isinstance(obj, dict):
        return {translate_i18n_key(k): rewrite_i18n_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rewrite_i18n_obj(x) for x in obj]
    return obj


def rewrite_t_calls(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        q = m.group(1)
        key = m.group(2)
        return f"{m.group(0)[: m.start(2) - m.start()]}{translate_i18n_key(key)}{q}"

    # too fragile; replace keys inside t("...") / tp("...") / t('...')
    def repl2(m: re.Match[str]) -> str:
        fn, q, key = m.group(1), m.group(2), m.group(3)
        return f"{fn}({q}{translate_i18n_key(key)}{q}"

    return re.sub(r"""\b(t|tp|tRaw)\(\s*(['"])([^'"]+)\2""", repl2, text)


def main() -> int:
    tauri = collect_tauri_map()
    fields = collect_rename_map()
    print(f"tauri commands {len(tauri)} field renames {len(fields)}", file=sys.stderr)

    mapping: dict[str, str] = {}
    mapping.update(TABLE_MAP)
    mapping.update(tauri)
    mapping.update(fields)
    mapping.update(ROUTE_MAP)
    mapping.update(RBAC_ACTION)
    mapping.update(ENUM_WIRE)
    mapping.update(MISC)
    # IPC JSON keys from the TS bridge (english: german)
    bridge = (ROOT / "packages/shared/src/lib/ipc-bridge.ts").read_text(encoding="utf-8")
    for m in re.finditer(r'^\s+([A-Za-z_][A-Za-z0-9_]*):\s*"([^"]+)"', bridge, re.M):
        en, de = m.group(1), m.group(2)
        if de != en:
            mapping.setdefault(de, en)

    files = iter_files()
    n = 0
    for p in files:
        rel = str(p.relative_to(ROOT))
        if rel.startswith("packages/shared/locales/"):
            # keys only
            data = json.loads(p.read_text(encoding="utf-8"))
            new = rewrite_i18n_obj(data)
            dst = json.dumps(new, ensure_ascii=False, indent=2) + "\n"
            src = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
            if dst != src:
                p.write_text(dst, encoding="utf-8")
                n += 1
                print(rel)
            continue
        try:
            src = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        dst = apply_map(src, mapping)
        if p.suffix == ".rs":
            dst = strip_tauri_rename(dst)
            dst = strip_serde_sqlx_rename(dst)
        if p.suffix in {".ts", ".tsx"}:
            dst = rewrite_t_calls(dst)
        if dst != src:
            p.write_text(dst, encoding="utf-8")
            n += 1
            print(rel)
    print(f"rewrote {n} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
