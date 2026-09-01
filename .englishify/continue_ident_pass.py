#!/usr/bin/env python3
"""Continue leftover German/camelCase identifier conversion (in-repo only)."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path("/Users/achraf/pro/Medoc")

LOCALE_RENAMES: list[tuple[str, str]] = [
    ("page.hilfe.", "page.help."),
    ("page.statistics.section.krankheitsbilder.", "page.statistics.section.disease_patterns."),
    ("page.statistics.chart.krankheitsbilder_empty", "page.statistics.chart.disease_patterns_empty"),
    ("page.statistics.chart.krankheitsbilder_verlauf", "page.statistics.chart.disease_patterns_trend"),
    ("onboarding.reception.purchaseOrders.", "onboarding.reception.purchase_orders."),
    ("palette.cmd.purchaseOrders", "palette.cmd.purchase-orders"),
    ("palette.cmd.hilfe", "palette.cmd.help"),
    ("nav.help.purchaseOrders", "nav.help.purchase_orders"),
    ("nav.help.hilfe", "nav.help.help"),
    ("nav.purchaseOrders", "nav.purchase-orders"),
    ("nav.hilfe", "nav.help"),
    ("settings.nav.konto", "settings.nav.account"),
    ("settings.nav.sicherheit", "settings.nav.security"),
    ("settings.nav.darstellung", "settings.nav.appearance"),
    ("settings.nav.arbeitsablaeufe", "settings.nav.workflows"),
]


def rename_locale_keys(catalog: dict[str, str]) -> dict[str, str]:
    items = list(catalog.items())
    out: dict[str, str] = {}
    for key, value in items:
        new = key
        if key.startswith("settings.konto."):
            new = "settings.account." + key[len("settings.konto.") :]
        else:
            for old, dest in LOCALE_RENAMES:
                if old.endswith(".") and key.startswith(old):
                    new = dest + key[len(old) :]
                    break
                if key == old:
                    new = dest
                    break
        if new in out and new != key:
            continue
        out[new] = value
    return dict(sorted(out.items()))


def rewrite_locales() -> None:
    loc_dir = ROOT / "packages/shared/locales"
    for name in ("en.json", "de.json", "fr.json", "ar.json"):
        path = loc_dir / name
        data = json.loads(path.read_text())
        new = rename_locale_keys(data)
        path.write_text(json.dumps(new, ensure_ascii=False, indent=2) + "\n")
        print(f"locale {name}: {len(data)} -> {len(new)}")


CLUSTER_REPLACES = [
    ("pub async fn list_geraete", "pub async fn list_devices"),
    ("super::repo::list_geraete", "super::repo::list_devices"),
    ("pub async fn create_kopplung_session", "pub async fn create_pairing_session"),
    ("super::repo::create_kopplung_session", "super::repo::create_pairing_session"),
    ("pub async fn load_kopplung_session", "pub async fn load_pairing_session"),
    ("super::repo::load_kopplung_session", "super::repo::load_pairing_session"),
    ("pub async fn list_pending_kopplung", "pub async fn list_pending_pairing"),
    ("super::repo::list_pending_kopplung", "super::repo::list_pending_pairing"),
    ("pub async fn log_kopplung", "pub async fn log_pairing"),
    ("audit::log_kopplung", "audit::log_pairing"),
    ('pub const ENTITY_KOPPLUNG: &str = "KOPPLUNG"', 'pub const ENTITY_PAIRING: &str = "PAIRING"'),
    ("ENTITY_KOPPLUNG", "ENTITY_PAIRING"),
    ('pub const ENTITY_CLUSTER: &str = "VERBUND"', 'pub const ENTITY_CLUSTER: &str = "CLUSTER"'),
    ('format!("kopplung.expires_at: {e}")', 'format!("pairing.expires_at: {e}")'),
    ('format!("kopplung.created_at: {e}")', 'format!("pairing.created_at: {e}")'),
]


def rewrite_cluster() -> None:
    cluster = ROOT / "crates/shared/medoc-sync/src/cluster"
    for path in cluster.rglob("*.rs"):
        text = path.read_text()
        orig = text
        for a, b in CLUSTER_REPLACES:
            text = text.replace(a, b)
        if text != orig:
            path.write_text(text)
            print(f"cluster {path.relative_to(ROOT)}")


FILE_REPLACES: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "crates/app/medoc-practice/src/infrastructure/app_menu.rs",
        [
            ("let appointment_woche =", "let appointment_week ="),
            ("let appointment_monat =", "let appointment_month ="),
            ("let appointment_heute =", "let appointment_today ="),
            (".item(&appointment_woche)", ".item(&appointment_week)"),
            (".item(&appointment_monat)", ".item(&appointment_month)"),
            (".item(&appointment_heute)", ".item(&appointment_today)"),
            ('"path": "/hilfe"', '"path": "/help"'),
        ],
    ),
    (
        "crates/app/medoc-practice/src/commands/practice/statistics.rs",
        [
            ('"CONFIRMED" => "Bestätigt".to_string()', '"CONFIRMED" => "Confirmed".to_string()'),
            ('"COMPLETED" => "Durchgeführt".to_string()', '"COMPLETED" => "Completed".to_string()'),
            ('"NO_SHOW" => "Nicht erschienen".to_string()', '"NO_SHOW" => "No-show".to_string()'),
            ('"CHECKUP" => "Kontrolle".to_string()', '"CHECKUP" => "Checkup".to_string()'),
            ('"CONSULTATION" => "Beratung".to_string()', '"CONSULTATION" => "Consultation".to_string()'),
            ('"CASH" => "Bar".to_string()', '"CASH" => "Cash".to_string()'),
            ('"BANK_TRANSFER" => "Überweisung".to_string()', '"BANK_TRANSFER" => "Bank transfer".to_string()'),
            ('"OPEN" => "Offen".to_string()', '"OPEN" => "Open".to_string()'),
            ("ter_mon", "appt_mon"),
            ("ter_st", "appt_st"),
            ("ter_kind", "appt_kind"),
            ("einn_mon", "income_mon"),
            ("best_st", "order_st"),
            ("best_mon", "order_mon"),
        ],
    ),
]


def apply_file_replaces() -> None:
    for rel, pairs in FILE_REPLACES:
        path = ROOT / rel
        if not path.exists():
            print(f"SKIP missing {rel}")
            continue
        text = path.read_text()
        orig = text
        for a, b in pairs:
            text = text.replace(a, b)
        if text != orig:
            path.write_text(text)
            print(f"updated {rel}")
        else:
            print(f"unchanged {rel}")


def main() -> None:
    rewrite_locales()
    rewrite_cluster()
    apply_file_replaces()


if __name__ == "__main__":
    main()
