#!/usr/bin/env python3
"""One-shot leftover English identifier conversion (prefs, calendar view, i18n, DPIA, tasks)."""
from __future__ import annotations

import pathlib
import re

ROOT = pathlib.Path("/Users/achraf/pro/Medoc")

LOCALE_KEY_RENAMES = [
    ('"settings.praef.saved"', '"settings.prefs.saved"'),
    ('"settings.praef.save_failed"', '"settings.prefs.save_failed"'),
    ('"settings.workflows.notfall_puffer"', '"settings.workflows.emergency_buffer"'),
    ('"settings.workflows.puffer"', '"settings.workflows.buffer"'),
    ('"practice.tasks.status.offen"', '"practice.tasks.status.open"'),
    ('"practice.tasks.workflow.offen"', '"practice.tasks.workflow.open"'),
    ('"page.purchase_orders.status.offen"', '"page.purchase_orders.status.open"'),
    ('"enum.payment_method.bar"', '"enum.payment_method.cash"'),
    ('"document.practice_field.notfall_tel"', '"document.practice_field.emergency_phone"'),
    ('"document.practice_field.ust_hinweis"', '"document.practice_field.vat_notice"'),
    ('"document.table_column.einzelpreis"', '"document.table_column.unit_price"'),
    ('"document.table_column.gesamt"', '"document.table_column.total"'),
    ('"document.table_column.ust"', '"document.table_column.vat"'),
    ('"page.compliance.btn.dsfa"', '"page.compliance.btn.dpia"'),
    ('"page.compliance.dsfa.', '"page.compliance.dpia.'),
]


def replace_all(text: str, pairs: list[tuple[str, str]]) -> str:
    for a, b in pairs:
        text = text.replace(a, b)
    return text


def rewrite_file(path: pathlib.Path, pairs: list[tuple[str, str]]) -> bool:
    old = path.read_text(encoding="utf-8")
    new = replace_all(old, pairs)
    if new != old:
        path.write_text(new, encoding="utf-8")
        return True
    return False


changed: list[str] = []

for loc in ("en", "de", "fr", "ar"):
    p = ROOT / "packages/shared/locales" / f"{loc}.json"
    if rewrite_file(p, LOCALE_KEY_RENAMES):
        changed.append(str(p.relative_to(ROOT)))

# Calendar view quoted literals in specific files
CAL_VIEW_PAIRS = [
    ('"tag"', '"day"'),
    ('"woche"', '"week"'),
    ('"monat"', '"month"'),
    ("AppointmentsKalenderAnsicht", "AppointmentCalendarView"),
]
for rel in [
    "apps/practice-host-ui/src/views/pages/appointments.tsx",
    "packages/app/practice-host/src/pages/settings/settings-workflows-section.tsx",
]:
    p = ROOT / rel
    if rewrite_file(p, CAL_VIEW_PAIRS):
        changed.append(rel)

# Prefs identifiers
PREFS_PAIRS = [
    ("appointmentPufferMin", "appointmentBufferMin"),
    ("setAppointmentPufferMin", "setAppointmentBufferMin"),
    ("pufferMin", "bufferMin"),
    ("notfallPuffer", "emergencyBuffer"),
    ("kalenderDragDropEnabled", "calendarDragDropEnabled"),
    ("onPraefChange", "onPrefsChange"),
    ("onPraefDirty", "onPrefsDirty"),
    ("onSavePraef", "onSavePrefs"),
    ("praefDirty", "prefsDirty"),
    ("setPraefDirty", "setPrefsDirty"),
    ("savePraef", "savePrefs"),
    ("setPraef", "setPrefs"),
    ("praef=", "prefs="),
    ("praef.", "prefs."),
    ("praef,", "prefs,"),
    ("praef)", "prefs)"),
    ("(praef)", "(prefs)"),
    ("const praef", "const prefs"),
    ("[praef,", "[prefs,"),
    ("praef:", "prefs:"),
    ("{ praef }", "{ prefs }"),
    ("settings.praef.", "settings.prefs."),
    ("settings.workflows.puffer", "settings.workflows.buffer"),
    ("settings.workflows.notfall_puffer", "settings.workflows.emergency_buffer"),
    ("id=\"set-puffer\"", "id=\"set-buffer\""),
    ("id=\"set-notfall\"", "id=\"set-emergency\""),
]

for rel in [
    "packages/app/practice-host/src/pages/settings/settings-workflows-section.tsx",
    "packages/app/practice-host/src/pages/settings/settings-account-section.tsx",
    "apps/practice-host-ui/src/views/pages/settings.tsx",
    "apps/practice-host-ui/src/views/pages/practice-preferences.tsx",
    "apps/practice-host-ui/src/views/pages/appointments.tsx",
    "apps/practice-host-ui/src/views/pages/appointment-create.tsx",
    "apps/practice-host-ui/src/views/pages/settings.rbac.smoke.test.tsx",
    "packages/shared/src/lib/appointment-slot-grid.test.ts",
]:
    p = ROOT / rel
    if p.exists() and rewrite_file(p, PREFS_PAIRS):
        changed.append(rel)

# Opening hours locals
HOURS_PAIRS = [
    ("editPracticeOeffnungszeiten", "editPracticeOpeningHours"),
    ("setEditPracticeOeffnungszeiten", "setEditPracticeOpeningHours"),
    ("draftPracticeOeffnungszeiten", "draftPracticeOpeningHours"),
    ("setDraftPracticeOeffnungszeiten", "setDraftPracticeOpeningHours"),
    ("savePracticeOeffnungszeiten", "savePracticeOpeningHours"),
]
p = ROOT / "packages/app/practice-host/src/pages/settings/settings-practice-section.tsx"
if rewrite_file(p, HOURS_PAIRS):
    changed.append("packages/app/practice-host/src/pages/settings/settings-practice-section.tsx")

# i18n key usages in TS
I18N_TS = [
    ("practice.tasks.status.offen", "practice.tasks.status.open"),
    ("practice.tasks.workflow.offen", "practice.tasks.workflow.open"),
    ("page.purchase-orders.status.offen", "page.purchase_orders.status.open"),
    ("page.purchase_orders.status.offen", "page.purchase_orders.status.open"),
    ("enum.payment_method.bar", "enum.payment_method.cash"),
]
for rel in [
    "apps/practice-host-ui/src/views/components/practice-tasks/constants.ts",
    "apps/practice-host-ui/src/views/components/practice-tasks/task-workflow-ui.ts",
    "packages/shared/src/lib/finance-order-labels.ts",
    "apps/practice-host-ui/src/views/pages/purchase-orders.tsx",
]:
    p = ROOT / rel
    if p.exists() and rewrite_file(p, I18N_TS):
        changed.append(rel)

# Task kinds
TASK_PAIRS = [
    ('"TERMIN"', '"APPOINTMENT"'),
    ('"DRUCK"', '"PRINT"'),
    ("TASK_TYPS", "TASK_KINDS"),
]
for rel in [
    "packages/app/practice-host/src/controllers/practice-task.controller.ts",
    "apps/practice-host-ui/src/views/components/practice-tasks/constants.ts",
    "apps/practice-host-ui/src/views/components/patient-chart-workflow-dialogs.tsx",
    "crates/app/medoc-practice/src/commands/scheduling/practice_task.rs",
    "apps/practice-host/tests/practice_task_tests.rs",
]:
    p = ROOT / rel
    if p.exists() and rewrite_file(p, TASK_PAIRS):
        changed.append(rel)

# Document template TS consumers (schema already rewritten)
DOC_PAIRS = [
    ("buildClinicalTemplateKopfLines", "buildClinicalTemplateHeaderLines"),
    ("CLINICAL_KOPF_FIELDS", "CLINICAL_HEADER_FIELDS"),
    ("const KOPF_FIELDS", "const HEADER_FIELDS"),
    ("KOPF_FIELDS", "HEADER_FIELDS"),
    ("const KOPF_ORDER", "const HEADER_ORDER"),
    ("KOPF_ORDER", "HEADER_ORDER"),
    ("payload.kopf", "payload.header"),
    ("tpl.kopf", "tpl.header"),
    ('"ust_hinweis"', '"vat_notice"'),
    ('"notfall_tel"', '"emergency_phone"'),
    ("case \"ust_hinweis\"", "case \"vat_notice\""),
    ("case \"notfall_tel\"", "case \"emergency_phone\""),
    ("const kopf =", "const headerLines ="),
    ("kopf.length", "headerLines.length"),
    ("...kopf,", "...headerLines,"),
]
for rel in [
    "packages/shared/src/lib/clinical-document-pdf.ts",
    "packages/shared/src/lib/clinical-pdf-layout.ts",
    "packages/shared/src/lib/document-print-html.ts",
]:
    p = ROOT / rel
    if rewrite_file(p, DOC_PAIRS):
        changed.append(rel)

# DPIA TS/Rust command names
DPIA_PAIRS = [
    ("generateDsfa", "generateDpia"),
    ("generate_dsfa", "generate_dpia"),
    ("type DSFA", "type Dpia"),
    ("interface DSFA", "interface Dpia"),
    ("DSFA>", "Dpia>"),
    ("DSFA |", "Dpia |"),
    ("as DSFA", "as Dpia"),
    ("data: DSFA", "data: Dpia"),
    ("{ data }: { data: DSFA }", "{ data }: { data: Dpia }"),
    ("function DsfaStructured", "function DpiaStructured"),
    ("<DsfaStructured", "<DpiaStructured"),
    ('"dsfa"', '"dpia"'),
    ("kind === \"dsfa\"", "kind === \"dpia\""),
    ("kind === 'dsfa'", "kind === 'dpia'"),
    ("page.compliance.dsfa.", "page.compliance.dpia."),
    ("page.compliance.btn.dsfa", "page.compliance.btn.dpia"),
    ('"vvt" | "dsfa"', '"vvt" | "dpia"'),
    ("medoc-dsfa-", "medoc-dpia-"),
    ("DSFA_GENERATED", "DPIA_GENERATED"),
    ("pub struct DSFA", "pub struct Dpia"),
    ("-> DSFA", "-> Dpia"),
    ("DSFA {", "Dpia {"),
    ("use crate::infrastructure::{dsfa,", "use crate::infrastructure::{dpia,"),
    ("dsfa::generate", "dpia::generate"),
]
for rel in [
    "packages/app/practice-host/src/controllers/compliance.controller.ts",
    "packages/app/practice-host/src/pages/compliance.tsx",
    "packages/shared/src/lib/report-export.ts",
    "crates/app/medoc-practice/src/commands/system/devices.rs",
    "crates/app/medoc-practice/src/commands/register.rs",
]:
    p = ROOT / rel
    if rewrite_file(p, DPIA_PAIRS):
        changed.append(rel)

print("changed:")
for c in sorted(set(changed)):
    print(" ", c)
print(f"count={len(set(changed))}")
