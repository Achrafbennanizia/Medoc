#!/usr/bin/env python3
"""Scan every first-party file for German / partly-German tokens.

Writes GermanToEnglish.json at the repo root: file path → list of {line, match, english}.
Every text file is listed (empty hits if clean). Binary files are listed under _meta.skipped_binary.
"""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")
OUT = ROOT / "GermanToEnglish.json"

SKIP_DIRS = {
    ".git",
    "node_modules",
    "target",
    "dist",
    "coverage",
    "releases",
}
BINARY_EXT = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".pdf",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".zip",
    ".gz",
    ".wasm",
    ".lock",
}

# Extra stems not always present as exact IDENT_MAP keys (plurals, compounds, Rust).
STEM_EN: dict[str, str] = {
    "termin": "appointment",
    "termine": "appointments",
    "zahlung": "payment",
    "zahlungen": "payments",
    "zahlungsart": "payment_method",
    "zahlungs": "payment",
    "zahl": "payment",
    "zuordnung": "assignment",
    "summe": "total",
    "behand": "treatment",
    "untersuch": "examination",
    "rechn": "invoice",
    "quitt": "receipt",
    "sitz": "session",
    "bestellung": "purchase_order",
    "bestellungen": "purchase_orders",
    "bestell": "order",
    "behandlung": "treatment",
    "behandlungen": "treatments",
    "behandlungs": "treatment",
    "untersuchung": "examination",
    "untersuchungen": "examinations",
    "praxis": "practice",
    "verwaltung": "administration",
    "einstellungen": "settings",
    "einstellung": "setting",
    "patientenakte": "patient_chart",
    "akte": "chart",
    "akten": "charts",
    "rezept": "prescription",
    "rezepte": "prescriptions",
    "attest": "certificate",
    "atteste": "certificates",
    "leistung": "service_item",
    "leistungen": "services",
    "bilanz": "balance_sheet",
    "personal": "staff",
    "statistik": "statistics",
    "anamnese": "anamnesis",
    "anamnesebogen": "anamnesis_form",
    "zahnbefund": "dental_finding",
    "zahnbefunde": "dental_findings",
    "produkt": "product",
    "produkte": "products",
    "rechnung": "invoice",
    "tagesabschluss": "day_close",
    "arbeitszeit": "work_time",
    "arbeitszeiten": "work_hours",
    "arbeitsplan": "work_plan",
    "datenschutz": "privacy",
    "posteingang": "inbox",
    "finanzen": "finance",
    "patienten": "patients",
    "vorlage": "template",
    "vorlagen": "templates",
    "konflikt": "conflict",
    "quittung": "receipt",
    "merkblatt": "leaflet",
    "verbund": "cluster",
    "krankenbescheinigung": "sick_leave_certificate",
    "vertrag": "contract",
    "dokument": "document",
    "lieferant": "supplier",
    "lieferanten": "suppliers",
    "lizenz": "license",
    "aufgabe": "task",
    "aufgaben": "tasks",
    "arzt": "physician",
    "aerzte": "physicians",
    "ärzte": "physicians",
    "datum": "date",
    "uhrzeit": "time",
    "betrag": "amount",
    "geburtsdatum": "date_of_birth",
    "notizen": "notes",
    "notiz": "note",
    "beschwerden": "chief_complaint",
    "passwort": "password",
    "telefon": "phone",
    "adresse": "address",
    "geschlecht": "sex",
    "rolle": "role",
    "kasse": "cash",
    "abwesenheit": "absence",
    "abwesenheiten": "absences",
    "notfall": "emergency",
    "bearbeiten": "edit",
    "loeschen": "delete",
    "löschen": "delete",
    "speichern": "save",
    "versicherungsnummer": "insurance_number",
    "versicherung": "insurance",
    "krankenkasse": "health_insurance",
    "taetigkeitsbereich": "activity_area",
    "tätigkeitsbereich": "activity_area",
    "fachrichtung": "specialty",
    "verfuegbar": "available",
    "verfügbar": "available",
    "unterschrieben": "signed",
    "ergebnisse": "results",
    "befund": "finding",
    "befunde": "findings",
    "diagnose": "diagnosis",
    "kategorie": "category",
    "kategorien": "categories",
    "einnahmen": "income",
    "ausgaben": "expenses",
    "saldo": "balance",
    "stichtag": "as_of_date",
    "gezaehlt": "counted",
    "gezählt": "counted",
    "laut": "according_to",
    "stimmt": "matches",
    "zurueck": "back",
    "zurück": "back",
    "begruendung": "reason",
    "begründung": "reason",
    "geliefert": "delivered",
    "unterwegs": "in_transit",
    "bearbeitung": "processing",
    "erledigt": "done",
    "ausstehend": "outstanding",
    "storniert": "cancelled",
    "bestand": "stock",
    "mindestbestand": "min_stock",
    "preis": "price",
    "aktiv": "active",
    "titel": "title",
    "medikament": "medication",
    "wirkstoff": "active_ingredient",
    "dosierung": "dosage",
    "dauer": "duration",
    "hinweise": "instructions",
    "hinweis": "note",
    "darreichungsform": "dosage_form",
    "packungsgroesse": "pack_size",
    "packungsgröße": "pack_size",
    "arbeitgeber": "employer",
    "inhalt": "body_text",
    "menge": "quantity",
    "einheit": "unit",
    "artikel": "item",
    "betreff": "subject",
    "nachricht": "message",
    "referenz": "reference",
    "zeitraum": "period",
    "kommentar": "comment",
    "gueltig": "valid",
    "gültig": "valid",
    "ausgestellt": "issued",
    "freigegeben": "released",
    "behandler": "treating_physician",
    "rezeption": "reception",
    "pharmaberater": "pharma_consultant",
    "stammdaten": "master_data",
    "stamm": "master",
    "katalog": "catalog",
    "sperrzeit": "blocked_time",
    "sperrzeiten": "blocked_times",
    "praeferenz": "preference",
    "präferenz": "preference",
    "praeferenzen": "preferences",
    "hilfe": "help",
    "ueber": "about",
    "über": "about",
    "konto": "account",
    "sicherheit": "security",
    "darstellung": "appearance",
    "arbeitsablaeufe": "workflows",
    "arbeitsabläufe": "workflows",
    "integrationen": "integrations",
    "benachrichtigungen": "notifications",
    "benachrichtigung": "notification",
    "pausevon": "break_from",
    "pausebis": "break_until",
    "zusatzhinweise": "additional_notes",
    "ueberweisungshinweise": "referral_notes",
    "überweisungshinweise": "referral_notes",
    "erst_oder_folge": "first_or_followup",
    "icd10": "icd10",
    "zaehne": "teeth",
    "zähne": "teeth",
    "zahn": "tooth",
    "sitzung": "session",
    "gesamtkosten": "total_cost",
    "gesamtbetrag": "total_amount",
    "betrag_erwartet": "amount_expected",
    "anzahl": "count",
    "patienten_gesamt": "patients_total",
    "einnahmen_monat": "revenue_month",
    "neu": "new",
    "art": "kind",
    "typ": "kind",
    "von": "from",
    "bis": "until",
    "modus": "mode",
    "kassegeprueft": "cash_verified",
    "sonder": "special",
    "arbeitstage": "work_days",
    "arbeitstag": "work_day",
    "tages": "day",
    "protokoll": "protocol",
    "geraet": "device",
    "gerät": "device",
    "abonnieren": "subscribe",
    "abonnement": "subscription",
    "aktivierung": "activation",
    "beitreten": "join",
    "passwort": "password",
    "anmelden": "sign_in",
    "abmelden": "sign_out",
    "speichern": "save",
    "abbrechen": "cancel",
    "schliessen": "close",
    "schließen": "close",
    "oeffnen": "open",
    "öffnen": "open",
    "drucken": "print",
    "exportieren": "export",
    "importieren": "import",
    "suchen": "search",
    "heute": "today",
    "gestern": "yesterday",
    "woche": "week",
    "monat": "month",
    "jahr": "year",
    "tag": "day",
    "uhr": "clock",
    "stunden": "hours",
    "stunde": "hour",
    "geburt": "birth",
    "versicherung": "insurance",
    "kvnr": "insurance_number",
    "kranken": "health",
    "zahnarzt": "dentist",
    "medizin": "medicine",
    "rezeptur": "formula",
    "ueberweisung": "referral",
    "überweisung": "referral",
    "entlassung": "discharge",
    "anamnest": "anamnesis",
    "befundung": "finding",
    "therapie": "therapy",
    "kontrolle": "checkup",
    "notfall": "emergency",
    "wartezimmer": "waiting_room",
    "sprechstunde": "consultation",
    "kalender": "calendar",
    "terminplan": "schedule",
    "schicht": "shift",
    "urlaub": "vacation",
    "krankheit": "illness",
    "fortbildung": "training",
    "gehalt": "salary",
    "steuer": "tax",
    "steuerberater": "tax_advisor",
    "mandanten": "clients",
    "mandant": "client",
    "beleg": "voucher",
    "kassenbuch": "cash_book",
    "abschluss": "closeout",
    "offene": "open",
    "bezahlt": "paid",
    "unbezahlt": "unpaid",
    "mahnung": "reminder",
    "skonto": "discount",
    "mwst": "vat",
    "ust": "vat",
    "netto": "net",
    "brutto": "gross",
    "lieferdatum": "delivery_date",
    "bestellnummer": "order_number",
    "artikelnummer": "item_number",
    "lager": "inventory",
    "waren": "goods",
    "wareneingang": "goods_receipt",
    "mindesthaltbar": "best_before",
    "charge": "batch",
    "dokumentation": "documentation",
    "vorerkrankungen": "preexisting_conditions",
    "medikation": "medication",
    "allergie": "allergy",
    "allergien": "allergies",
    "risiken": "risks",
    "risiko": "risk",
    "schwanger": "pregnant",
    "rauch": "smoke",
    "alkohol": "alcohol",
    "unterschrift": "signature",
    "einwilligung": "consent",
    "widerruf": "revocation",
    "loeschung": "erasure",
    "löschung": "erasure",
    "auskunft": "access_request",
    "verarbeitung": "processing",
    "zweck": "purpose",
    "empfaenger": "recipient",
    "empfänger": "recipient",
    "speicherdauer": "retention",
    "massnahme": "measure",
    "maßnahme": "measure",
    "verletzung": "breach",
    "meldestelle": "reporting_office",
    "datenschutzbeauftragter": "dpo",
    "einwilligungen": "consents",
    "protokollierung": "logging",
    "zugriff": "access",
    "berechtigung": "permission",
    "rolle": "role",
    "passwoerter": "passwords",
    "passwörter": "passwords",
    "sitzung": "session",
    "geraet": "device",
    "lizenzschluessel": "license_key",
    "lizenzschlüssel": "license_key",
    "abonnement": "subscription",
    "rechnungswesen": "accounting",
    "finanzamt": "tax_office",
    "umsatz": "revenue",
    "gewinn": "profit",
    "verlust": "loss",
    "kosten": "cost",
    "honorar": "fee",
    "privat": "private",
    "gesetzlich": "statutory",
    "selbstzahler": "self_payer",
    "zuzahlung": "copay",
    "rezeptgebuehr": "prescription_fee",
    "rezeptgebühr": "prescription_fee",
    "autidem": "aut_idem",
    "wirkstaerke": "strength",
    "wirkstärke": "strength",
    "einmal": "once",
    "taeglich": "daily",
    "täglich": "daily",
    "woechentlich": "weekly",
    "wöchentlich": "weekly",
    "morgens": "morning",
    "mittags": "noon",
    "abends": "evening",
    "nachts": "night",
    "tropfen": "drops",
    "tablette": "tablet",
    "tabletten": "tablets",
    "salbe": "ointment",
    "saft": "syrup",
    "spritze": "injection",
    "verband": "dressing",
    "naht": "suture",
    "extraktion": "extraction",
    "fuellung": "filling",
    "füllung": "filling",
    "krone": "crown",
    "implantat": "implant",
    "prothese": "denture",
    "kiefer": "jaw",
    "zahnfleisch": "gums",
    "karies": "caries",
    "parodont": "periodontal",
    "roentgen": "xray",
    "röntgen": "xray",
    "befundung": "assessment",
    "ueberweisung": "referral",
    "krankenhaus": "hospital",
    "facharzt": "specialist",
    "hausarzt": "gp",
    "notarzt": "emergency_physician",
    "rettung": "rescue",
    "krankenwagen": "ambulance",
    "ziel": "due_target",
    "wesen": "operations",
    "nummer": "number",
    "kopf": "header",
    "inhaber": "owner",
    "leitung": "leadership",
    "stempel": "stamp",
    "bericht": "report",
    "abweichung": "discrepancy",
    "bedingung": "condition",
    "bedingungen": "terms",
    "historie": "history",
    "verfolgung": "tracking",
    "daten": "data",
    "kassette": "cassette",
    "bestaetigung": "confirmation",
    "bestätigung": "confirmation",
    "befund": "finding",
}

# Clipped prefixes that look German-ish but are English words (inverse stem match).
CLIP_PREFIX_BLOCK = {
    "best",
    "term",
    "real",
    "rest",
    "last",
    "test",
    "post",
    "list",
    "cost",
    "part",
    "auto",
    "info",
    "form",
    "file",
    "user",
    "case",
    "code",
    "mode",
    "text",
    "line",
    "page",
    "view",
    "menu",
    "row",
    "wrap",
    "label",
    "edit",
    "state",
    "action",
    "kind",
    "type",
    "name",
    "date",
    "time",
    "item",
    "data",
}

# English tokens that must not be flagged even if a stem is a prefix.
ENGLISH_BLOCK = {
    "start",
    "started",
    "starting",
    "starts",
    "partial",
    "partials",
    "partially",
    "article",
    "articles",
    "partition",
    "terminal",
    "terminals",
    "terminate",
    "terminated",
    "terminates",
    "termination",
    "determine",
    "determined",
    "determines",
    "determination",
    "predetermined",
    "international",
    "orientation",
    "destination",
    "duration",
    "durations",
    "update",
    "updated",
    "updates",
    "updating",
    "validate",
    "validated",
    "validation",
    "invalid",
    "invalidate",
    "candidate",
    "candidates",
    "mandatory",
    "date",
    "dates",
    "data",
    "dataset",
    "metadata",
    "personal",  # English adjective — still used as German "staff" in this repo; keep mapping via exact STEM
    "personality",
    "practice",
    "practices",
    "practitioner",
    "patient",
    "patients",
    "document",
    "documents",
    "documentation",
    "template",
    "templates",
    "filter",
    "filters",
    "system",
    "systems",
    "migration",
    "name",
    "names",
    "minute",
    "minutes",
    "month",
    "year",
    "hour",
    "hours",
    "clock",
    "risk",
    "risks",
    "therapy",
    "implant",
    "extraction",
    "private",
    "pairing",
    "charge",
    "batch",
    "net",
    "gross",
    "once",
    "access",
    "session",
    "comment",
    "message",
    "subject",
    "period",
    "unit",
    "item",
    "items",
    "price",
    "active",
    "title",
    "role",
    "kind",
    "type",
    "types",
    "catalog",
    "inventory",
    "license",
    "contract",
    "cluster",
    "task",
    "tasks",
    "product",
    "products",
    "staff",
    "settings",
    "privacy",
    "inbox",
    "finance",
    "invoice",
    "receipt",
    "chart",
    "charts",
    "examination",
    "treatment",
    "appointment",
    "payment",
    "prescription",
    "certificate",
    "physician",
    "practice",
    "administration",
    "statistics",
    "anamnese",  # already mapped; don't double via other stems
    "filter",
    "import",
    "export",
    "print",
    "search",
    "save",
    "edit",
    "delete",
    "open",
    "close",
    "cancel",
    "new",
    "day",
    "week",
    "help",
    "about",
    "account",
    "security",
    "notification",
    "notifications",
    "activation",
    "subscribe",
    "subscription",
    "join",
    "sign",
    "login",
    "device",
    "protocol",
    "master",
    "preference",
    "preferences",
    "special",
    "count",
    "cost",
    "fee",
    "tax",
    "profit",
    "loss",
    "revenue",
    "goods",
    "batch",
    "allergy",
    "allergies",
    "consent",
    "purpose",
    "recipient",
    "measure",
    "breach",
    "logging",
    "permission",
    "password",
    "passwords",
    "filling",
    "crown",
    "denture",
    "gums",
    "caries",
    "hospital",
    "specialist",
    "ambulance",
    "rescue",
    "illness",
    "vacation",
    "training",
    "salary",
    "clients",
    "client",
    "voucher",
    "reminder",
    "discount",
    "vat",
    "tablet",
    "tablets",
    "drops",
    "ointment",
    "syrup",
    "injection",
    "dressing",
    "suture",
    "jaw",
    "periodontal",
    "assessment",
    "referral",
    "dentist",
    "medicine",
    "formula",
    "discharge",
    "pregnant",
    "smoke",
    "alcohol",
    "signature",
    "revocation",
    "erasure",
    "processing",
    "retention",
    "reporting",
    "dpo",
    "accounting",
    "copay",
    "strength",
    "daily",
    "weekly",
    "morning",
    "noon",
    "evening",
    "night",
    "once",
    "private",
    "statutory",
    "appearance",
    "workflows",
    "integrations",
    "workflows",
}

IDENT_RE = re.compile(r"[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*")
UMLAUT_RE = re.compile(r"[ÄÖÜäöüß]")
CAMEL_RE = re.compile(r"[A-ZÄÖÜ]?[a-zäöüß]+|[A-ZÄÖÜ]+(?![a-zäöüß])|[0-9]+")

GERMAN_SUFFIXES = (
    "",
    "e",
    "en",
    "er",
    "es",
    "n",
    "s",
    "ung",
    "ungen",
    "heit",
    "keit",
    "lich",
    "chen",
    "lein",
    "t",
    "te",
    "ten",
    "tem",
    "ter",
    "tes",
    "bar",
    "bare",
    "baren",
    "ieren",
    "iert",
    "ierte",
    "ierten",
    "nd",
    "nde",
    "nden",
)

_PREFIX_STEMS: list[tuple[str, str]] | None = None


def prefix_stems(ident_map: dict[str, str]) -> list[tuple[str, str]]:
    """Longest-first German stems used to catch fused compounds (bestellstamm)."""
    global _PREFIX_STEMS
    if _PREFIX_STEMS is not None:
        return _PREFIX_STEMS
    seen: set[str] = set()
    out: list[tuple[str, str]] = []
    for src in (ident_map, STEM_EN):
        for k, v in src.items():
            low = k.lower()
            if len(low) < 4 or low in seen:
                continue
            if low in CLIP_PREFIX_BLOCK or (low in ENGLISH_BLOCK and low not in STEM_EN):
                continue
            seen.add(low)
            out.append((low, v))
    for clip in EXPLICIT_CLIPS:
        if clip in seen or len(clip) < 4:
            continue
        seen.add(clip)
        out.append((clip, STEM_EN.get(clip, clip)))
    out.sort(key=lambda x: (-len(x[0]), x[0]))
    _PREFIX_STEMS = out
    return out


def load_ident_map() -> dict[str, str]:
    spec = importlib.util.spec_from_file_location(
        "ident_rewrite", ROOT / ".englishify" / "ident_rewrite.py"
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return dict(mod.IDENT_MAP)


def split_ident(tok: str) -> list[str]:
    parts: list[str] = []
    for chunk in re.split(r"[_\-]+", tok):
        if not chunk:
            continue
        bits = CAMEL_RE.findall(chunk)
        parts.extend(bits if bits else [chunk])
    return parts


def suggest_for_part(part: str, ident_map: dict[str, str]) -> str | None:
    if part in ident_map:
        return ident_map[part]
    low = part.lower()
    if low in ENGLISH_BLOCK and low not in {"personal"}:
        return None
    if low in CLIP_PREFIX_BLOCK:
        return None
    if low in STEM_EN:
        return STEM_EN[low]
    if UMLAUT_RE.search(part):
        return STEM_EN.get(low, "(German spelling — translate in context)")
    if len(low) < 4:
        return None
    for stem, en in STEM_EN.items():
        if len(stem) < 4:
            continue
        if low == stem:
            return en
        # Inflection: zahlungen starts with zahlung + en
        if low.startswith(stem) and low[len(stem) :] in GERMAN_SUFFIXES:
            return en
        # Clipped camelCase: Zahl in ZahlRowAction → zahlung (leftover ung)
        rest = stem[len(low) :] if stem.startswith(low) and len(stem) > len(low) else ""
        if rest and rest in GERMAN_SUFFIXES:
            return en
    # Fused compounds with no camelCase break: bestellstamm, Rezeptverwaltung,
    # behandlungsdatum, zahlungsziel, Praxissoftware, quittieren, …
    for stem, en in prefix_stems(ident_map):
        if low.startswith(stem) and len(low) > len(stem):
            return en
    return None


def analyze_token(tok: str, ident_map: dict[str, str]) -> str | None:
    if tok in ident_map:
        return ident_map[tok]
    low = tok.lower()
    # Standalone articles / prepositions (including umlaut forms) — not identifier inventory.
    if low in {"für", "fuer", "und", "oder", "nicht", "der", "die", "das", "den", "dem", "des", "ist", "mit"}:
        return None
    if low in ENGLISH_BLOCK and low not in STEM_EN:
        return None
    if low in CLIP_PREFIX_BLOCK:
        return None
    if low in STEM_EN:
        return STEM_EN[low]
    parts = split_ident(tok)
    hits: list[str] = []
    for p in parts:
        s = suggest_for_part(p, ident_map)
        if s:
            hits.append(f"{p}→{s}")
    if hits:
        if tok in ident_map:
            return ident_map[tok]
        return "; ".join(hits)
    if UMLAUT_RE.search(tok):
        return "(contains German umlaut)"
    return None


def iter_files() -> list[Path]:
    files: list[Path] = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel_parts = p.relative_to(ROOT).parts
        if any(part in SKIP_DIRS for part in rel_parts):
            continue
        if p.name in {"GermanToEnglish.json"}:
            continue
        files.append(p)
    files.sort(key=lambda x: str(x.relative_to(ROOT)).lower())
    return files


def is_binary_path(p: Path) -> bool:
    if p.suffix.lower() in BINARY_EXT:
        return True
    if p.is_symlink():
        return False
    return False


CODE_EXT = {".ts", ".tsx", ".js", ".jsx", ".rs"}
CLIP_RESTS = frozenset({"ung", "ungen", "heit", "keit", "lich", "chen", "schaft"})
EXPLICIT_CLIPS = frozenset(
    {"zahl", "bestell", "leist", "behand", "untersuch", "rechn", "quitt", "sitz"}
)


def clipped_parts_of(tok: str) -> list[tuple[str, str, str]]:
    """Zahl in ZahlRowAction: clipped German stem + other camelCase/snake parts."""
    parts = split_ident(tok)
    if len(parts) < 2:
        return []
    out: list[tuple[str, str, str]] = []
    for part in parts:
        low = part.lower()
        if len(low) < 4:
            continue
        if low in CLIP_PREFIX_BLOCK:
            continue
        if low in EXPLICIT_CLIPS:
            stem = next((s for s in STEM_EN if s.startswith(low) and len(s) > len(low)), low)
            out.append((part, stem, STEM_EN.get(low, STEM_EN.get(stem, low))))
            continue
        if low in STEM_EN:
            continue
        for stem, en in STEM_EN.items():
            if stem.startswith(low) and len(stem) > len(low) and stem[len(low) :] in CLIP_RESTS:
                out.append((part, stem, en))
                break
    return out


def german_parts_of(tok: str, ident_map: dict[str, str]) -> list[str]:
    """Every German or partial-German segment in an identifier."""
    bits: list[str] = []
    seen: set[str] = set()
    for part in split_ident(tok) or [tok]:
        s = suggest_for_part(part, ident_map)
        if not s:
            continue
        label = f"{part}→{s}"
        if label not in seen:
            seen.add(label)
            bits.append(label)
    extra = clipped_parts_of(tok)
    for part, stem, en in extra:
        label = f"{part} ⊂ {stem} → {en}"
        if label not in seen:
            seen.add(label)
            bits.append(label)
    return bits


def collect_clipped(ident_map: dict[str, str]) -> dict:
    """Unique identifiers that are German words or contain a German/partial stem."""
    found: dict[str, dict] = {}
    for f in iter_files():
        if is_binary_path(f):
            continue
        rel = f.relative_to(ROOT)
        if any(p in {".englishify"} for p in rel.parts):
            continue
        try:
            text = f.read_text(encoding="utf-8")
        except OSError:
            continue
        rels = str(rel)
        tokens_by_line: list[tuple[int, str]] = []
        for tok in IDENT_RE.findall(rels.replace("/", "_").replace("-", "_")):
            tokens_by_line.append((0, tok))
        for lineno, line in enumerate(text.splitlines(), start=1):
            for tok in IDENT_RE.findall(line):
                tokens_by_line.append((lineno, tok))
        for lineno, tok in tokens_by_line:
            en = analyze_token(tok, ident_map)
            parts = german_parts_of(tok, ident_map)
            if not en and not parts:
                continue
            rec = found.setdefault(
                tok,
                {
                    "english": en,
                    "parts": parts,
                    "examples": [],
                },
            )
            loc = f"{rels}:{lineno}"
            if loc not in rec["examples"] and len(rec["examples"]) < 8:
                rec["examples"].append(loc)
            if en and rec["english"] is None:
                rec["english"] = en
            for p in parts:
                if p not in rec["parts"]:
                    rec["parts"].append(p)
    identifiers = {k: found[k] for k in sorted(found, key=str.lower)}
    return {
        "note": (
            "Every unique identifier that is a German word or contains a German / "
            "partial-German stem (Zahl⊂Zahlung, TerminCreatePage, pauseVon, list_termine, …)."
        ),
        "count": len(identifiers),
        "identifiers": identifiers,
    }


def scan_file(path: Path, ident_map: dict[str, str]) -> list[dict]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        try:
            text = path.read_text(encoding="latin-1")
        except OSError:
            return [{"line": 0, "match": "(unreadable)", "english": "(skip)"}]
    except OSError:
        return [{"line": 0, "match": "(unreadable)", "english": "(skip)"}]

    hits: list[dict] = []
    seen_on_line: set[tuple[int, str]] = set()

    # Filename itself
    name_toks = IDENT_RE.findall(str(path.relative_to(ROOT)))
    for tok in name_toks:
        en = analyze_token(tok, ident_map)
        if en:
            key = (0, tok)
            if key not in seen_on_line:
                seen_on_line.add(key)
                hits.append({"line": 0, "match": tok, "english": en, "kind": "path"})

    for lineno, line in enumerate(text.splitlines(), start=1):
        for tok in IDENT_RE.findall(line):
            en = analyze_token(tok, ident_map)
            if not en:
                continue
            key = (lineno, tok)
            if key in seen_on_line:
                continue
            seen_on_line.add(key)
            hits.append({"line": lineno, "match": tok, "english": en})
    return hits


def main() -> int:
    ident_map = load_ident_map()
    # prefer longer IDENT_MAP keys when suggesting whole tokens
    files = iter_files()
    out_files: dict[str, list] = {}
    skipped_binary: list[str] = []
    total_hits = 0
    with_hits = 0

    for i, p in enumerate(files, start=1):
        rel = str(p.relative_to(ROOT))
        if is_binary_path(p):
            skipped_binary.append(rel)
            out_files[rel] = []
            continue
        hits = scan_file(p, ident_map)
        out_files[rel] = hits
        if hits:
            with_hits += 1
            total_hits += len(hits)
        if i % 200 == 0:
            print(f"scanned {i}/{len(files)}", file=sys.stderr)

    print("collecting clipped compounds…", file=sys.stderr)
    clipped = collect_clipped(ident_map)
    clip_path = ROOT / ".englishify" / "clipped-identifiers.json"
    clip_path.write_text(json.dumps(clipped, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    payload = {
        "_meta": {
            "generated": date.today().isoformat(),
            "scanned_files": len(files),
            "files_listed": len(out_files),
            "files_with_hits": with_hits,
            "total_hits": total_hits,
            "clipped_count": clipped["count"],
            "skipped_binary": skipped_binary,
            "note": (
                "`clipped` is the unique list of every German identifier and every "
                "partial-German stem (not only ZahlRowAction-class clips). "
                "`files` still has per-file line hits. line 0 = German in the path."
            ),
        },
        "clipped": clipped,
        "files": out_files,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT} files={len(files)} with_hits={with_hits} hits={total_hits}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
