#!/usr/bin/env python3
"""Exact leftover German *copy* → English (errors, PDF labels, catalog, enum wires)."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")
SKIP_DIRS = {".git", "node_modules", "target", "dist", "coverage", "releases", ".englishify"}
SKIP_ROOT_PREFIXES = ("docs/", "packages/shared/locales/")
SKIP_FILES = {
    "GermanToEnglish.json",
    "clipped-identifiers.json",
    "package-lock.json",
    "Cargo.lock",
}
CODE_EXT = {".rs", ".ts", ".tsx", ".js", ".jsx", ".sql", ".yaml", ".yml", ".json", ".css", ".md"}

# Longest first.
PHRASES: list[tuple[str, str]] = [
    ("Zu viele Fehlversuche — bitte {0} Sekunden warten", "Too many failed attempts — wait {0} seconds"),
    ("Zwei-Faktor-Einrichtung required", "Two-factor enrollment required"),
    ("Zwei-Faktor-Code required", "Two-factor code required"),
    ("Kopplungssitzung nicht gefunden", "Pairing session not found"),
    ("Vertragsdatei nicht gefunden", "Contract file not found"),
    ("PatientChart nicht gefunden", "PatientChart not found"),
    ("PatientChart.*?nicht gefunden", "PatientChart.*?not found"),
    ("Hiermit wird bescheinigt, dass sich", "This certifies that"),
    ("in ärztlicher Treatment befindet", "is under medical treatment"),
    ("Priorität: Notfall (über Kalender markiert)", "Priority: emergency (marked from calendar)"),
    ("(Stempel / Unterschrift)", "(Stamp / signature)"),
    ("Art der Bescheinigung", "Type of certificate"),
    ("Gültigkeitszeitraum", "Validity period"),
    ("Befund / Angaben", "Findings / notes"),
    ("Ort, Datum", "Place, date"),
    ("ÄRZTLICHES ATTEST", "MEDICAL CERTIFICATE"),
    ("Folgebescheinigung", "Follow-up certificate"),
    ("Erstbescheinigung", "Initial certificate"),
    ("Diagnose (ICD-10)", "Diagnosis (ICD-10)"),
    ("Kalendertag", "calendar day"),
    ("Arbeitgeber", "Employer"),
    ("geboren am", "born on"),
    ("Abgerechnete ServiceItem für", "Billed service items for"),
    ("Austausch möglich", "Substitution allowed"),
    ("Nicht autorisiert", "Unauthorized"),
    ("Zugriff verweigert", "Access denied"),
    ("Validierungsfehler:", "Validation error:"),
    ("Datenbankfehler:", "Database error:"),
    ("Interner Fehler:", "Internal error:"),
    ("nicht gefunden", "not found"),
    ("Konflikt:", "Conflict:"),
    ("Kontrolluntersuchung", "Checkup"),
    ("Fuellungstherapie", "FillingTherapy"),
    ("Parodontologie", "Periodontology"),
    ("Prothetik", "Prosthodontics"),
    ("Chirurgie", "Surgery"),
    ("Rezeptnummer", "Prescription number"),
    ("Rezepttyp", "Prescription type"),
    ("Zahlungsdatum", "Payment date"),
    ("Zahlungsart", "Payment method"),
    ("passwort123", "password123"),
    ("AUSGESTELLT", "ISSUED"),
    ('"ERST"', '"FIRST"'),
    ("'ERST'", "'FIRST'"),
    ('"FOLGE"', '"FOLLOW_UP"'),
    ("'FOLGE'", "'FOLLOW_UP'"),
    (" === \"ERST\"", " === \"FIRST\""),
    (" === \"FOLGE\"", " === \"FOLLOW_UP\""),
    (" ?? \"ERST\"", " ?? \"FIRST\""),
    ('unwrap_or("ERST")', 'unwrap_or("FIRST")'),
    ("first_or_follow_up: \"ERST\"", "first_or_follow_up: \"FIRST\""),
    ('z.enum(["ERST", "FOLGE"])', 'z.enum(["FIRST", "FOLLOW_UP"])'),
    ('"ERST" | "FOLGE"', '"FIRST" | "FOLLOW_UP"'),
    ("arbeitsunfähig", "sick_leave"),
    ("Implantologie", "Implantology"),
    ('startsWith("unter:")', 'startsWith("examination:")'),
    ('slice("unter:".length)', 'slice("examination:".length)'),
    ('"unter:"', '"examination:"'),
    ("'unter:'", "'examination:'"),
    ('kind: "unter"', 'kind: "examination"'),
    ('| "unter"', '| "examination"'),
    ('=== "unter"', '=== "examination"'),
    ('== "unter"', '== "examination"'),
    ('id === "unter"', 'id === "examination"'),
    ('id === "anam"', 'id === "anamnesis"'),
    ('id === "zahn"', 'id === "dental"'),
    ('tab: "unter"', 'tab: "examination"'),
    ('tab: "anam"', 'tab: "anamnesis"'),
    ('"unter"', '"examination"'),
    ("'unter'", "'examination'"),
    ('"anam"', '"anamnesis"'),
    ("'anam'", "'anamnesis'"),
    ("dental.status.fuellung", "dental.status.filling"),
    ("dental-fuellung", "dental-filling"),
    ("fuellung:", "filling:"),
    ('"fuellung"', '"filling"'),
    ("dental.status.karies", "dental.status.caries"),
    ("dental-karies", "dental-caries"),
    ('"karies"', '"caries"'),
    ("dental.status.krone", "dental.status.crown"),
    ("dental-krone", "dental-crown"),
    ('"krone"', '"crown"'),
    ("dental.status.wurzel", "dental.status.root"),
    ("dental-wurzel", "dental-root"),
    ('"wurzel"', '"root"'),
    ("dental.status.fehlt", "dental.status.missing"),
    ("dental-fehlt", "dental-missing"),
    ('"fehlt"', '"missing"'),
    ("dental.status.implantat", "dental.status.implant"),
    ("dental-implantat", "dental-implant"),
    ('"implantat"', '"implant"'),
    ("oeffnungszeiten", "opening_hours"),
]


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


def main() -> int:
    n = 0
    for p in iter_files():
        try:
            src = p.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        dst = src
        for old, new in PHRASES:
            dst = dst.replace(old, new)
        if dst != src:
            p.write_text(dst, encoding="utf-8")
            n += 1
            print(p.relative_to(ROOT))
    print(f"rewrote {n} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
