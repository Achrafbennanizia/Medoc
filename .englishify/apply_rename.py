#!/usr/bin/env python3
"""Englishify file names + code identifiers. See glossary.md for KEEP rules."""
from __future__ import annotations

import json
import os
import re
import subprocess
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

# Longest-first path segment replacements (applied to each path part).
PATH_PARTS: list[tuple[str, str]] = [
    ("krankenbescheinigung-verwaltung", "sick-leave-administration"),
    ("krankenbescheinigung", "sick-leave-certificate"),
    ("tagesabschluss-protokoll", "day-close-protocol"),
    ("tagesabschluss_protokoll", "day_close_protocol"),
    ("tagesabschluss", "day-close"),
    ("praxis-aufgabe", "practice-task"),
    ("praxis_aufgabe", "practice_task"),
    ("praxis-aufgaben", "practice-tasks"),
    ("praxis-tickets", "practice-tickets"),
    ("praxis-praeferenzen", "practice-preferences"),
    ("praxis-arbeitszeiten", "practice-work-hours"),
    ("praxisplanung", "practice-planning"),
    ("praxis-completeness", "practice-completeness"),
    ("praxis-header-privacy", "practice-header-privacy"),
    ("praxis-planning", "practice-planning"),
    ("praxis-search-prefs-sync", "practice-search-prefs-sync"),
    ("praxis-setup-wizard", "practice-setup-wizard"),
    ("praxis-readiness-dialog", "practice-readiness-dialog"),
    ("praxis-billing", "practice-billing"),
    ("patientenakte", "patient-chart"),
    ("zahnbefund", "dental-finding"),
    ("anamnesebogen", "anamnesis-form"),
    ("behandlungs-katalog", "treatment-catalog"),
    ("behandlung-akte", "treatment-chart"),
    ("untersuchung", "examination"),
    ("bestellstamm-verwaltung", "order-master-administration"),
    ("bestellung-produkt", "order-product"),
    ("bestellung", "purchase-order"),
    ("bestellungen", "purchase-orders"),
    ("einstellungen", "settings"),
    ("verwaltung-leistungen-kataloge-vorlagen", "administration-services-catalogs-templates"),
    ("verwaltung-lager-bestellwesen", "administration-inventory-ordering"),
    ("verwaltung-finanzen-berichte", "administration-finance-reports"),
    ("verwaltung-finanz-werkzeuge", "administration-finance-tools"),
    ("verwaltung-vertraege", "administration-contracts"),
    ("verwaltung-aufgaben", "administration-tasks"),
    ("verwaltung", "administration"),
    ("zahlung-buchung", "payment-booking"),
    ("zahlung", "payment"),
    ("akten-zu-validieren", "charts-to-validate"),
    ("akte-anlagen", "chart-attachments"),
    ("akte-workflow", "chart-workflow"),
    ("akte-next-termin", "chart-next-appointment"),
    ("akte_next_termin", "chart_next_appointment"),
    ("akte-validation", "chart-validation"),
    ("akte-completeness", "chart-completeness"),
    ("akte-export", "chart-export"),
    ("akte-confirm", "chart-confirm"),
    ("akte-scanner", "chart-scanner"),
    ("patient-akte", "patient-chart"),
    ("plan-next-termin", "plan-next-appointment"),
    ("termin-draft", "appointment-draft"),
    ("termin-availability", "appointment-availability"),
    ("termin-calendar", "appointment-calendar"),
    ("termin-domain", "appointment-domain"),
    ("termin-drag", "appointment-drag"),
    ("termin-slot", "appointment-slot"),
    ("termin-create", "appointment-create"),
    ("termin-detail", "appointment-detail"),
    ("termin-context", "appointment-context"),
    ("termin-doctor", "appointment-doctor"),
    ("termin-month", "appointment-month"),
    ("termin-week", "appointment-week"),
    ("termine", "appointments"),
    ("termin", "appointment"),
    ("rezept-create", "prescription-create"),
    ("rezept-edit", "prescription-edit"),
    ("rezept-actions", "prescription-actions"),
    ("rezept-tab", "prescription-tab"),
    ("rezepte", "prescriptions"),
    ("rezept", "prescription"),
    ("atteste", "certificates"),
    ("attest", "certificate"),
    ("leistungen", "services"),
    ("leistung", "service-item"),
    ("invoice-leistung", "invoice-service-item"),
    ("bilanz-snapshot", "balance-sheet-snapshot"),
    ("bilanz-neu", "balance-sheet-new"),
    ("bilanz", "balance-sheet"),
    ("statistik", "statistics"),
    ("anamnese", "anamnesis"),
    ("patienten", "patients"),
    ("datenschutz", "privacy"),
    ("posteingang", "inbox"),
    ("finanzen-kasse", "finance-cash"),
    ("finanzen-tx", "finance-tx"),
    ("finanzen", "finance"),
    ("produkte", "products"),
    ("produkt-form", "product-form"),
    ("produkt", "product"),
    ("personal-arbeitsplan", "staff-work-plan"),
    ("personal_permission", "staff_permission"),
    ("personal", "staff"),
    ("arbeitsplan-adjustment", "work-plan-adjustment"),
    ("arbeitsplan-compose", "work-plan-compose"),
    ("arbeitsplan-preferences", "work-plan-preferences"),
    ("arbeitsplan-practice", "work-plan-practice"),
    ("arbeitszeit-tracking", "work-time-tracking"),
    ("arbeitszeit-team", "work-time-team"),
    ("arbeitszeiten", "work-hours"),
    ("arbeitszeit", "work-time"),
    ("arbeitstage", "work-days"),
    ("sonder-sperrzeiten", "special-blocks"),
    ("geraeteverbund", "device-cluster"),
    ("verbund", "cluster"),
    ("rechnung-document", "invoice-document"),
    ("rechnung_document", "invoice_document"),
    ("dokument-template", "document-template"),
    ("dokument_template", "document_template"),
    ("vertrag-domain", "contract-domain"),
    ("vertrag", "contract"),
    ("quittung-export", "receipt-export"),
    ("quittung", "receipt"),
    ("discharge-merkblatt", "discharge-leaflet"),
    ("konflikt", "conflict"),
    ("aufgabe-workflow", "task-workflow"),
    ("aufgaben", "tasks"),
    ("aufgabe_visibility", "task_visibility"),
    ("zahl-row", "payment-row"),
    ("zahl-tab", "payment-tab"),
    ("zahl-actions", "payment-actions"),
    ("behand-tab", "treatment-tab"),
    ("unter-tab", "examination-tab"),
    ("anlage-tab", "attachment-tab"),
    ("akte-subnav", "chart-subnav"),
    ("akte-save", "chart-save"),
    ("akte", "chart"),
    ("praxis", "practice"),
    ("vorlagen-rezepte-atteste", "templates-prescriptions-certificates"),
    ("lieferant", "supplier"),
    ("pharmaberater", "pharma-consultant"),
    ("lizenz", "license"),
    ("sicherheit", "security"),
    ("darstellung", "appearance"),
    ("benachrichtigungen", "notifications"),
    ("arbeitsablaeufe", "workflows"),
    ("konto", "account"),
    ("ueber", "about"),
    ("kommentare", "comments"),
]

# Identifier replacements (regex, longest first). Do not include enum WIRE tokens.
IDENT: list[tuple[str, str]] = [
    ("Krankenbescheinigung", "SickLeaveCertificate"),
    ("krankenbescheinigungen", "sick_leave_certificates"),
    ("krankenbescheinigung", "sick_leave_certificate"),
    ("TagesabschlussProtokoll", "DayCloseProtocol"),
    ("tagesabschluss_protokoll", "day_close_protocol"),
    ("tagesabschluss", "day_close"),
    ("PraxisAufgabe", "PracticeTask"),
    ("praxis_aufgabe", "practice_task"),
    ("praxisAufgabe", "practiceTask"),
    ("Patientenakte", "PatientChart"),
    ("patientenakte", "patient_chart"),
    ("Zahnbefund", "DentalFinding"),
    ("zahnbefund", "dental_finding"),
    ("Anamnesebogen", "AnamnesisForm"),
    ("anamnesebogen", "anamnesis_form"),
    ("AnamneseVisual", "AnamnesisVisual"),
    ("UntersuchungComposer", "ExaminationComposer"),
    ("UntersuchungDetailPanel", "ExaminationDetailPanel"),
    ("Untersuchung", "Examination"),
    ("untersuchung", "examination"),
    ("Behandlung", "Treatment"),
    ("behandlung", "treatment"),
    ("Bestellung", "PurchaseOrder"),
    ("bestellungen", "purchase_orders"),
    ("bestellung", "purchase_order"),
    ("Einstellungen", "Settings"),
    ("einstellungen", "settings"),
    ("Verwaltung", "Administration"),
    ("verwaltung", "administration"),
    ("Zahlungsart", "PaymentMethod"),
    ("zahlungsart", "payment_method"),
    ("Zahlung", "Payment"),
    ("zahlung", "payment"),
    ("list_termine_by_date", "list_appointments_by_date"),
    ("listTermineByDate", "listAppointmentsByDate"),
    ("list_termine", "list_appointments"),
    ("listTermine", "listAppointments"),
    ("create_termin", "create_appointment"),
    ("createTermin", "createAppointment"),
    ("update_termin", "update_appointment"),
    ("updateTermin", "updateAppointment"),
    ("delete_termin", "delete_appointment"),
    ("deleteTermin", "deleteAppointment"),
    ("get_termin", "get_appointment"),
    ("getTermin", "getAppointment"),
    ("CreateTermin", "CreateAppointment"),
    ("UpdateTermin", "UpdateAppointment"),
    ("TerminArt", "AppointmentKind"),
    ("TerminStatus", "AppointmentStatus"),
    ("TerminCreate", "AppointmentCreate"),
    ("TerminePage", "AppointmentsPage"),
    ("Termine", "Appointments"),
    ("termin_hint_fulfillment", "appointment_hint_fulfillment"),
    ("termin_repo", "appointment_repo"),
    ("termin_draft", "appointment_draft"),
    ("plan_next_termin", "plan_next_appointment"),
    ("akte_next_termin", "chart_next_appointment"),
    ("next_termin", "next_appointment"),
    ("Termin", "Appointment"),
    ("termine", "appointments"),
    ("RezeptCreate", "PrescriptionCreate"),
    ("RezeptEdit", "PrescriptionEdit"),
    ("RezeptePage", "PrescriptionsPage"),
    ("Rezepte", "Prescriptions"),
    ("rezept", "prescription"),
    ("Rezept", "Prescription"),
    ("AttestePage", "CertificatesPage"),
    ("Atteste", "Certificates"),
    ("attest", "certificate"),
    ("Attest", "Certificate"),
    ("LeistungenPage", "ServicesPage"),
    ("leistungen", "services"),
    ("Leistung", "ServiceItem"),
    ("leistung", "service_item"),
    ("BilanzSnapshot", "BalanceSheetSnapshot"),
    ("bilanz_snapshot", "balance_sheet_snapshot"),
    ("BilanzNeu", "BalanceSheetNew"),
    ("BilanzPage", "BalanceSheetPage"),
    ("Bilanz", "BalanceSheet"),
    ("bilanz", "balance_sheet"),
    ("StatistikPage", "StatisticsPage"),
    ("statistik", "statistics"),
    ("Statistik", "Statistics"),
    ("Anamnese", "Anamnesis"),
    ("anamnese", "anamnesis"),
    ("PatientenPage", "PatientsPage"),
    ("list_patienten", "list_patients"),
    ("listPatienten", "listPatients"),
    ("patienten", "patients"),
    ("DatenschutzPage", "PrivacyPage"),
    ("datenschutz", "privacy"),
    ("Datenschutz", "Privacy"),
    ("Posteingang", "Inbox"),
    ("posteingang", "inbox"),
    ("FinanzenPage", "FinancePage"),
    ("FinanzenKasse", "FinanceCash"),
    ("finanzen", "finance"),
    ("Finanzen", "Finance"),
    ("ProduktePage", "ProductsPage"),
    ("produkte", "products"),
    ("Produkt", "Product"),
    ("produkt", "product"),
    ("list_personal", "list_staff"),
    ("listPersonal", "listStaff"),
    ("create_personal", "create_staff"),
    ("PersonalPage", "StaffPage"),
    ("personal_permission", "staff_permission"),
    ("personal_repo", "staff_repo"),
    ("Personal", "Staff"),
    ("Arbeitsplan", "WorkPlan"),
    ("arbeitsplan", "work_plan"),
    ("Arbeitszeit", "WorkTime"),
    ("arbeitszeiten", "work_hours"),
    ("arbeitszeit", "work_time"),
    ("Arbeitstage", "WorkDays"),
    ("arbeitstage", "work_days"),
    ("SonderSperrzeiten", "SpecialBlocks"),
    ("sonder-sperrzeiten", "special-blocks"),
    ("Geraeteverbund", "DeviceCluster"),
    ("geraeteverbund", "device_cluster"),
    ("RechnungDocument", "InvoiceDocument"),
    ("rechnung_document", "invoice_document"),
    ("DokumentTemplate", "DocumentTemplate"),
    ("dokument_template", "document_template"),
    ("dokument", "document"),
    ("Dokument", "Document"),
    ("Vertrag", "Contract"),
    ("vertrag", "contract"),
    ("Quittung", "Receipt"),
    ("quittung", "receipt"),
    ("Merkblatt", "Leaflet"),
    ("merkblatt", "leaflet"),
    ("AkteAnlage", "ChartAttachment"),
    ("akte_anlage", "chart_attachment"),
    ("akte_workflow", "chart_workflow"),
    ("akte_validation", "chart_validation"),
    ("AktePage", "ChartPage"),
    ("praxis_repo", "practice_repo"),
    ("praxis_ticket", "practice_ticket"),
    ("PraxisTickets", "PracticeTickets"),
    ("Praxisplanung", "PracticePlanning"),
    ("praxisplanung", "practice_planning"),
    ("PraxisPraeferenzen", "PracticePreferences"),
    ("praxis_praeferenzen", "practice_preferences"),
    ("konflikt", "conflict"),
    ("Konflikt", "Conflict"),
    ("lieferant_stamm", "supplier_master"),
    ("lieferant_pharma", "supplier_pharma"),
    ("lieferant", "supplier"),
    ("Lieferant", "Supplier"),
    ("pharmaberater_stamm", "pharma_consultant_master"),
    ("pharmaberater", "pharma_consultant"),
    ("Pharmaberater", "PharmaConsultant"),
    ("lizenz_activate", "license_activate"),
    ("lizenz", "license"),
    ("Lizenz", "License"),
    ("verbund_", "cluster_"),
    ("Verbund", "Cluster"),
    ("verbund", "cluster"),
    ("VorlagenRezepteAtteste", "TemplatesPrescriptionsCertificates"),
    ("vorlagen", "templates"),
    ("Vorlage", "Template"),
    ("vorlage", "template"),
    ("AktenZuValidieren", "ChartsToValidate"),
    ("aufgabe_visibility", "task_visibility"),
    ("PraxisAufgabe", "PracticeTask"),
    ("AufgabenPage", "TasksPage"),
    ("aufgaben", "tasks"),
    ("Aufgabe", "Task"),
    ("akte", "chart"),
    ("Akte", "Chart"),
    ("praxis", "practice"),
    ("Praxis", "Practice"),
    ("rechnung", "invoice"),
    ("Rechnung", "Invoice"),
    ("personal.", "staff."),
    ("termin.read", "appointment.read"),
    ("termin.write", "appointment.write"),
    ("termin.list_aerzte", "appointment.list_physicians"),
]

# Applied after IDENT; remaining module/path tokens (not SQL tables).
MODULE_PATHS: list[tuple[str, str]] = [
    (r"\bmod termin\b", "mod appointment"),
    (r"\bentities::termin\b", "entities::appointment"),
    (r"\bdatabase::termin_repo\b", "database::appointment_repo"),
    (r"\bscheduling::termin\b", "scheduling::appointment"),
    (r"\bmod praxis\b", "mod practice"),
    (r"\bcommands::praxis\b", "commands::practice"),
    (r"\bmod personal\b", "mod staff"),
    (r"\bentities::personal\b", "entities::staff"),
    (r"\bmod zahlung\b", "mod payment"),
    (r"\bentities::zahlung\b", "entities::payment"),
    (r"\bmod bestellung\b", "mod purchase_order"),
    (r"\bmod rezept\b", "mod prescription"),
    (r"\bmod attest\b", "mod certificate"),
    (r"\bmod leistung\b", "mod service_item"),
    (r"\bmod produkt\b", "mod product"),
    (r"\bmod vertrag\b", "mod contract"),
    (r"\bmod statistik\b", "mod statistics"),
    (r"\bmod akte\b", "mod chart"),
    (r"\bentities::akte\b", "entities::chart"),
    (r"\bmod patientenakte\b", "mod patient_chart"),
    (r"\bmod zahnbefund\b", "mod dental_finding"),
    (r"\bmod anamnesebogen\b", "mod anamnesis_form"),
    (r"\bmod behandlung\b", "mod treatment"),
    (r"\bmod konflikt\b", "mod conflict"),
    (r"\bservices::konflikt\b", "services::conflict"),
    (r"\bmod tagesabschluss_protokoll\b", "mod day_close_protocol"),
    (r"\bmod bilanz_snapshot\b", "mod balance_sheet_snapshot"),
    (r"\bmod praxis_aufgabe\b", "mod practice_task"),
    (r"\bmod dokument_template_user\b", "mod document_template_user"),
    (r"\bmod rechnung_document\b", "mod invoice_document"),
    (r"/patienten", "/patients"),
    (r"/termine", "/appointments"),
    (r"/einstellungen", "/settings"),
    (r"/verwaltung", "/administration"),
    (r"/finanzen", "/finance"),
    (r"/bestellungen", "/orders"),
    (r"/bilanz", "/balance-sheet"),
    (r"/rezepte", "/prescriptions"),
    (r"/atteste", "/certificates"),
    (r"/leistungen", "/services"),
    (r"/produkte", "/products"),
    (r"/personal", "/staff"),
    (r"/statistik", "/statistics"),
    (r"/datenschutz", "/privacy"),
    (r"/posteingang", "/inbox"),
    (r"/akten/", "/charts/"),
    (r"routePath=\"patienten", 'routePath="patients'),
    (r"routePath=\"termine", 'routePath="appointments'),
    (r"routePath=\"einstellungen", 'routePath="settings'),
    (r"routePath=\"verwaltung", 'routePath="administration'),
    (r"routePath=\"finanzen", 'routePath="finance'),
    (r"routePath=\"bestellungen", 'routePath="orders'),
    (r"routePath=\"bilanz", 'routePath="balance-sheet'),
    (r"routePath=\"personal", 'routePath="staff'),
    (r"routePath=\"statistik", 'routePath="statistics'),
    (r"routePath=\"datenschutz", 'routePath="privacy'),
    (r"routePath=\"posteingang", 'routePath="inbox'),
    (r"routePath=\"rezepte", 'routePath="prescriptions'),
    (r"routePath=\"atteste", 'routePath="certificates'),
    (r"routePath=\"leistungen", 'routePath="services'),
    (r"routePath=\"produkte", 'routePath="products'),
    (r"routePath=\"tickets", 'routePath="tickets'),
]

SQL_SKIP_SUBSTR = (
    "/migrations/",
    "0001_initial_schema.sql",
    "enum_check_fragments.sql",
    "legacy_embedded.rs",
    "rust_only.rs",
    "sync_tables.rs",
    "seed.rs",
)

# Persist SQLite table names (do not Englishify inside SQL).
SQL_TABLES = sorted(
    [
        "patientenakte",
        "praxis_aufgabe",
        "praxis_ticket",
        "tagesabschluss_protokoll",
        "zahnbefund",
        "bilanz_snapshot",
        "dokument_template_user",
        "dokument_template",
        "krankenbescheinigung",
        "rechnung_document",
        "akte_anlage",
        "akte_validation",
        "anamnese",
        "anamnesebogen",
        "behandlung",
        "untersuchung",
        "bestellung",
        "zahlung",
        "termin",
        "rezept",
        "attest",
        "leistung",
        "personal",
        "produkt",
        "vertrag",
        "patient",
        "audit_log",
    ],
    key=len,
    reverse=True,
)


def protect_sql_tables(text: str) -> str:
    for table in SQL_TABLES:
        text = re.sub(
            rf"(?i)(\b(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+)({table})\b",
            lambda m, t=table: f"{m.group(1)}__SQLTABLE_{t}__",
            text,
        )
        text = text.replace(f'"{table}"', f'"__SQLTABLE_{table}__"')
        text = text.replace(f"`{table}`", f"`__SQLTABLE_{table}__`")
    return text


def unprotect_sql_tables(text: str) -> str:
    for table in SQL_TABLES:
        text = text.replace(f"__SQLTABLE_{table}__", table)
    return text

LOCALE_FILES = {
    ROOT / "packages/shared/locales/en.json",
    ROOT / "packages/shared/locales/de.json",
    ROOT / "packages/shared/locales/fr.json",
    ROOT / "packages/shared/locales/ar.json",
}

TEXT_SUFFIX = {
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".rs",
    ".json",
    ".yaml",
    ".yml",
    ".md",
    ".html",
    ".css",
    ".toml",
    ".sh",
    ".mjs",
}


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIRS or (name.startswith(".") and name not in {".github", ".cursor"})


def iter_files() -> list[Path]:
    out: list[Path] = []
    for dirpath, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if not should_skip_dir(d)]
        p = Path(dirpath)
        rel = p.relative_to(ROOT).as_posix()
        if rel.startswith("docs/") or rel.startswith("releases/"):
            continue
        for f in files:
            out.append(p / f)
    return out


def rewrite_part(part: str) -> str:
    # Preserve extension
    if "." in part and not part.startswith("."):
        stem, *rest = part.split(".")
        ext = ".".join(rest)
        new_stem = stem
        for old, new in PATH_PARTS:
            new_stem = new_stem.replace(old, new)
        return new_stem + "." + ext if ext else new_stem
    new = part
    for old, n in PATH_PARTS:
        new = new.replace(old, n)
    return new


def dest_path(src: Path) -> Path:
    rel = src.relative_to(ROOT)
    parts = [rewrite_part(p) for p in rel.parts]
    return ROOT.joinpath(*parts)


def git_mv(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.resolve() == dst.resolve():
        return
    subprocess.run(["git", "mv", str(src), str(dst)], cwd=ROOT, check=True)


def is_sql_keep(path: Path) -> bool:
    s = path.as_posix()
    return any(x in s for x in SQL_SKIP_SUBSTR) or path.suffix == ".sql"


def apply_idents(text: str) -> str:
    for old, new in IDENT:
        if old == new:
            continue
        text = text.replace(old, new)
    for pat, new in MODULE_PATHS:
        text = re.sub(pat, new, text)
    return text


def rename_i18n_key(key: str) -> str:
    return apply_idents(key)


def walk_locale_obj(obj):
    if isinstance(obj, dict):
        return {rename_i18n_key(k): walk_locale_obj(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [walk_locale_obj(x) for x in obj]
    return obj  # values untouched (de stays German)


def process_locale(path: Path) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    new = walk_locale_obj(data)
    dumped = json.dumps(new, ensure_ascii=False, indent=2) + "\n"
    old = path.read_text(encoding="utf-8")
    if dumped != old:
        path.write_text(dumped, encoding="utf-8")
        return True
    return False


def main() -> int:
    dry = "--dry-run" in sys.argv
    files = iter_files()

    # 1) file moves (deepest first)
    moves: list[tuple[Path, Path]] = []
    for src in files:
        dst = dest_path(src)
        if dst != src:
            moves.append((src, dst))
    moves.sort(key=lambda x: len(x[0].as_posix()), reverse=True)
    print(f"file moves: {len(moves)}")
    if not dry:
        for src, dst in moves:
            if not src.exists():
                continue
            git_mv(src, dst)

    # 2) content
    changed = 0
    files_after = iter_files() if not dry else files
    for path in files_after:
        if path.suffix not in TEXT_SUFFIX:
            continue
        if path in LOCALE_FILES:
            if not dry:
                if process_locale(path):
                    changed += 1
            continue
        if is_sql_keep(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        new = unprotect_sql_tables(apply_idents(protect_sql_tables(text)))
        if new != text:
            changed += 1
            if not dry:
                path.write_text(new, encoding="utf-8")
    print(f"content files changed: {changed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
