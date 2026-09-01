#!/usr/bin/env python3
"""Convert leftover German tokens everywhere: SQL, strings, i18n keys, identifiers.

Does not translate de.json *values* (German locale pack). Keys are rewritten.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")
SKIP_DIRS = {
    ".git",
    "node_modules",
    "target",
    "dist",
    "coverage",
    "releases",
    ".englishify",
}
SKIP_ROOT_PREFIXES = ("docs/",)
SKIP_FILES = {
    "GermanToEnglish.json",
    "clipped-identifiers.json",
    "package-lock.json",
    "Cargo.lock",
}

sys.path.insert(0, str(ROOT / ".englishify"))
import ident_rewrite as ir  # noqa: E402
import english_all_wires as wires  # noqa: E402

CODE_EXT = {".rs", ".ts", ".tsx", ".js", ".jsx", ".css", ".sql", ".yaml", ".yml", ".json", ".md", ".toml"}

ENUM_WIRE = dict(wires.ENUM_WIRE)
ENUM_WIRE.update(
    {
        "TAG": "DAY",
        "WOCHE": "WEEK",
        "MONAT": "MONTH",
        "JAHR": "YEAR",
        "IN_BEHANDLUNG": "IN_TREATMENT",
    }
)

EXTRAS = {
    "zu": "to",
    "von": "from",
    "bis": "until",
    "neu": "new",
    "bezeichnung": "designation",
    "vertraege": "contracts",
    "unbefristet": "unlimited",
    "befristet": "fixed_term",
    "intervall": "interval",
    "laufzeit": "term",
    "pfad": "path",
    "lager": "inventory",
    "validieren": "validate",
    "zahlungsziel": "payment_terms",
    "rezepttyp": "prescription_kind",
    "terminregeln": "appointment_rules",
    "direktzahlung": "direct_payment",
    "krankenhaus": "hospital",
    "erezept": "e_prescription",
    "bestellt": "ordered",
    "bestellnr": "order_number",
    "bestellwesen": "ordering",
    "zahnarzt": "dentist",
    "fachzahnarzt": "specialist_dentist",
    "behandler": "clinician",
    "berufsbezeichnung": "professional_title",
    "document_pfad": "document_path",
    "periode_von": "period_from",
    "periode_bis": "period_until",
    "passwort_aendern_erforderlich": "password_change_required",
    "dev-seed-vertraege": "dev-seed-contracts",
    "arbeitsunfaehigkeitsbescheinigung": "sick_leave_certificate",
    "arbeitsunfaehigkeit": "incapacity",
    "einverstaendnis": "consent",
    "EINVERSTAENDNIS": "CONSENT",
    "schulbefreiung": "school_exemption",
    "sportbefreiung": "sports_exemption",
    "tagesbericht": "daily_report",
    "sonstiges": "other",
    "sonstige": "other",
    "stammdaten": "master_data",
    "abrechnung": "billing",
    "ueberfaellig": "overdue",
    "ueberblick": "overview",
    "roentgen": "xray",
    "ROENTGEN": "XRAY",
    "finanz": "finance",
    "werkzeuge": "tools",
    "kosten": "cost",
    "vorname": "first_name",
    "nachname": "last_name",
    "steuernummer": "tax_number",
    "finanzamt": "tax_office",
    "gekuendigt": "terminated",
    "GEKUENDIGT": "TERMINATED",
    "schule": "school",
    "ueber": "about",
    "druck": "print",
    "labor": "lab",
    "LABOR": "LAB",
    "zahlungen": "payments",
    "bestellungen": "purchase_orders",
    "vorschlaege": "suggestions",
    "Vorschlaege": "Suggestions",
    "liefOptions": "supplierOptions",
    "kontaktOptions": "contactOptions",
    "kontakt": "contact",
    "Benachrichtigung": "Notification",
    "Benachrichtigungen": "Notifications",
    "benachrichtigungen": "notifications",
    "benachrichtigung": "notification",
    "fuellungstherapie": "filling_therapy",
    "parodontologie": "periodontology",
    "prothetik": "prosthodontics",
    "ausgestellt": "issued",
    "chronisch": "chronic",
    "einnahme": "dosing",
    "frueherDiagnosen": "previousDiagnoses",
    "impfreaktionen": "vaccineReactions",
    "lebensmittel": "foods",
    "medikamente": "medications",
    "nebenwirkungen": "sideEffects",
    "operationen": "surgeries",
    "psychisch": "mental",
    "regelmaessig": "regular",
    "versicherungsstatus": "insuranceStatus",
    "vorerkrankungen": "preExisting",
    "medikation": "medication",
    "allergien": "allergies",
    "chirurgie": "surgery",
}

VALUE_PLACEHOLDERS = {
    "{zahlungen}": "{payments}",
    "{bestellungen}": "{purchase_orders}",
    "{bezeichnung}": "{designation}",
    "{termine}": "{appointments}",
    "{akten}": "{charts}",
}


def prepare_maps() -> None:
    ir.IDENT_MAP.update(ENUM_WIRE)
    ir.IDENT_MAP.update(EXTRAS)
    ir.KEEP_TOKENS.clear()


def iter_files() -> list[Path]:
    out: list[Path] = []
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(ROOT)
        rel_s = str(rel)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        if any(rel_s.startswith(pref) for pref in SKIP_ROOT_PREFIXES):
            continue
        if p.name in SKIP_FILES:
            continue
        if p.suffix.lower() not in CODE_EXT:
            continue
        out.append(p)
    return out


def rewrite_idents(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        tok = m.group(0)
        if tok == "_created_at":
            return "created_at"
        mapped = ir.map_ident(tok)
        return mapped

    return ir.IDENT_RE.sub(repl, text)


def rewrite_placeholders(obj):
    if isinstance(obj, dict):
        return {k: rewrite_placeholders(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [rewrite_placeholders(x) for x in obj]
    if isinstance(obj, str):
        for old, new in VALUE_PLACEHOLDERS.items():
            obj = obj.replace(old, new)
        return obj
    return obj


def main() -> int:
    prepare_maps()
    n = 0
    for p in iter_files():
        rel = str(p.relative_to(ROOT))
        if rel.startswith("packages/shared/locales/"):
            data = json.loads(p.read_text(encoding="utf-8"))
            new = rewrite_placeholders(wires.rewrite_i18n_obj(data))
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
        dst = src.replace("_created_at", "created_at")
        dst = rewrite_idents(dst)
        if p.suffix in {".ts", ".tsx"}:
            dst = wires.rewrite_t_calls(dst)
        if dst != src:
            p.write_text(dst, encoding="utf-8")
            n += 1
            print(rel)
    print(f"rewrote {n} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
