#!/usr/bin/env python3
"""Generate scripts/i18n-translation-patches-pass4.json from i18n-gap-keys.json."""
import json
import os
import re
import sys
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent.parent
GAP_PATH = ROOT / "scripts" / "i18n-gap-keys.json"
OUT_PATH = ROOT / "scripts" / "i18n-translation-patches-pass4.json"
PATCHES_PATH = ROOT / "scripts" / "i18n-translation-patches.json"
PASS3_PATH = ROOT / "scripts" / "i18n-translation-patches-pass3.json"

KEEP_LITERAL = [
    "FA-AKTE-15", "G9", "DATEV", "MeDoc", "medoc-keygen", "activation.json",
    "otpauth://", "JSON", "CSV", "PDF", "HTML", "Break-Glass", "Tauri",
    "Wi‑Fi", "Wi-Fi", "SMS", "E-Mail", "Mesh", "serverless", "LAN", "HTTPS",
    "RBAC", "Dev build", "GDT", "DICOM", "AMVV", "PZN", "GOZ", "RGPD",
    "Ed25519", "TI-Konnektor", "TI connector", "medoc-server", "MeDoc Practice Pro",
    "GET /api/", "POST /api/", "PUT /api/", "DELETE /api/",
    "otpauth", "SQL", "ZIP", "DCM", "JPG", "PNG",
    "Röntgen", "Roentgen", "Speicheldruesen", "Speichelfluss",
    "Taetigkeitseinschraenkung", "Durchgefuehrt", "Moechten",
    "Pause-Block", "12:30–13:15", "B-number",
]

PLACEHOLDER_RE = re.compile(r"\{\{[a-zA-Z_]+\}\}|\{[a-zA-Z_]+\}")
API_PATH_RE = re.compile(r"(/api/v\d+/[a-zA-Z0-9_\-/]+)")
MASK_PREFIX = "⟦"
MASK_SUFFIX = "⟧"
BATCH_SIZE = 40


def log(msg: str) -> None:
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


def mask_text(text: str) -> tuple[str, list[str]]:
    tokens: list[str] = []
    masked = text
    for lit in sorted(KEEP_LITERAL, key=len, reverse=True):
        if lit in masked:
            idx = len(tokens)
            tokens.append(lit)
            masked = masked.replace(lit, f"{MASK_PREFIX}{idx}{MASK_SUFFIX}")

    def stash(m: re.Match) -> str:
        tokens.append(m.group(0))
        return f"{MASK_PREFIX}{len(tokens) - 1}{MASK_SUFFIX}"

    masked = API_PATH_RE.sub(stash, masked)
    masked = PLACEHOLDER_RE.sub(stash, masked)
    return masked, tokens


def unmask_text(text: str, tokens: list[str]) -> str:
    out = text
    for i, tok in enumerate(tokens):
        out = out.replace(f"{MASK_PREFIX}{i}{MASK_SUFFIX}", tok)
        out = out.replace(f"⟦{i}⟧", tok)
    return out


def translate_one(text: str, target: str, retries: int = 4) -> str:
    if not text or not text.strip():
        return text
    masked, tokens = mask_text(text)
    for attempt in range(retries):
        try:
            raw = GoogleTranslator(source="en", target=target).translate(masked)
            if raw is None:
                raise ValueError("empty")
            return unmask_text(raw, tokens)
        except Exception:
            if attempt == retries - 1:
                return text
            time.sleep(0.6 * (attempt + 1))
    return text


def translate_batch(texts: list[str], target: str, retries: int = 5) -> list[str]:
    if not texts:
        return []
    masked_list: list[str] = []
    token_lists: list[list[str]] = []
    for text in texts:
        masked, tokens = mask_text(text or "")
        masked_list.append(masked)
        token_lists.append(tokens)

    for attempt in range(retries):
        try:
            raw = GoogleTranslator(source="en", target=target).translate_batch(masked_list)
            if not isinstance(raw, list) or len(raw) != len(texts):
                raise ValueError("batch size mismatch")
            return [unmask_text(r or texts[i], token_lists[i]) for i, r in enumerate(raw)]
        except Exception as e:
            if attempt == retries - 1:
                log(f"WARN batch failed ({target}), sequential fallback: {e}")
                return [translate_one(t, target) for t in texts]
            time.sleep(1.2 * (attempt + 1))
    return texts


FR_FIXES = [
    (r"\bSign in\b", "Se connecter"),
    (r"\bSign out\b", "Se déconnecter"),
    (r"\bAbout MeDoc\b", "À propos de MeDoc"),
    (r"\bClose dialog\b", "Fermer la boîte de dialogue"),
    (r"\bDismiss notification\b", "Fermer la notification"),
    (r"\bSkip to main content\b", "Aller au contenu principal"),
    (r"\bPick a time\b", "Choisir une heure"),
    (r"\bAllergies & intolerances\b", "Allergies et intolérances"),
    (r"\bHelp & shortcuts\b", "Aide et raccourcis"),
    (r"\bDental practice North\b", "Cabinet dentaire Nord"),
    (r"\bSession expired — please sign in again\.\b", "Session expirée — veuillez vous reconnecter."),
    (r"\bAudit log\b", "Journal d'audit"),
    (r"\bFront desk & assistance\b", "Accueil et assistance"),
    (r"\bPharma advisory\b", "Conseil pharmaceutique"),
    (r"\bTax advisory\b", "Conseil fiscal"),
    (r"\bDentist\b", "Dentiste"),
    (r"\bEmergency access only \(break-glass\)\b", "Accès d'urgence uniquement (Break-Glass)"),
    (r"\bNo audit entries\b", "Aucune entrée d'audit"),
    (r"\bLoading audit entries…\b", "Chargement des entrées d'audit…"),
    (r"\bExport — audit log\b", "Export — journal d'audit"),
    (r"\bPaginated view \(max\. \{max\} entries per page\)\. Export remains complete\.\b",
     "Vue paginée (max. {max} entrées par page). L'export reste complet."),
    (r"\bNo entries\.\b", "Aucune entrée."),
    (r"\bNo messages\.\b", "Aucun message."),
    (r"\bMark all read\b", "Tout marquer comme lu"),
    (r"\bAll marked as read\.\b", "Tout marqué comme lu."),
    (r"\bThis action is not available for your role\.\b",
     "Cette action n'est pas disponible pour votre rôle."),
]


def apply_fixes(text: str, fixes: list[tuple[str, str]]) -> str:
    for pat, repl in fixes:
        text = re.sub(pat, repl, text)
    return text


def build_cache(unique_en: list[str], target: str, fixes: list[tuple[str, str]]) -> dict[str, str]:
    cache: dict[str, str] = {}
    for i in range(0, len(unique_en), BATCH_SIZE):
        chunk = unique_en[i : i + BATCH_SIZE]
        translated = translate_batch(chunk, target)
        for en, tr in zip(chunk, translated):
            cache[en] = apply_fixes(tr, fixes)
        log(f"{target} batch {min(i + BATCH_SIZE, len(unique_en))}/{len(unique_en)}")
        time.sleep(0.12)
    return cache


def main() -> None:
    gap = json.loads(GAP_PATH.read_text(encoding="utf8"))
    patches = json.loads(PATCHES_PATH.read_text(encoding="utf8"))
    pass3 = json.loads(PASS3_PATH.read_text(encoding="utf8"))
    existing_fr = {**(patches.get("fr") or {}), **(pass3.get("fr") or {})}
    existing_ar = {**(patches.get("ar") or {}), **(pass3.get("ar") or {})}

    keys = gap["keys"]
    unique_en = sorted({item["en"] for item in keys})
    log(f"gap keys: {len(keys)}, unique en: {len(unique_en)}")

    fr_cache = build_cache(unique_en, "fr", FR_FIXES)
    ar_cache = build_cache(unique_en, "ar", [])

    fr_out: dict[str, str] = {}
    ar_out: dict[str, str] = {}
    for item in keys:
        key = item["key"]
        en = item["en"]
        fr_out[key] = existing_fr[key] if key in existing_fr and existing_fr[key] != en else fr_cache[en]
        ar_out[key] = existing_ar[key] if key in existing_ar and existing_ar[key] != en else ar_cache[en]

    OUT_PATH.write_text(json.dumps({"fr": fr_out, "ar": ar_out}, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    log(f"wrote {OUT_PATH}")
    log(f"fr: {len(fr_out)} keys, ar: {len(ar_out)} keys")


if __name__ == "__main__":
    main()
