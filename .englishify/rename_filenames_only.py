#!/usr/bin/env python3
"""Rename German source filenames to English. Does not rewrite identifiers.

Safety:
- Tokenize on '-', '_', '.' so 'praxis-aufgaben' → 'practice-tasks' (not 'practice-taskn').
- Skip docs/, locales, generated dumps, .englishify/.
- Skip symlink paths (apps/practice-host-ui/src/lib → packages/shared).
- TypeScript import updates only inside path-like quoted strings.
- Rust updates only mod/use module path forms, not SQL or IPC command names.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from typing import Optional
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
SKIP_ROOT_PREFIXES = (
    "docs/",
    "packages/shared/locales/",
    "scripts/i18n-",
)
CODE_SUFFIXES = (
    ".controller.test.ts",
    ".controller.test.tsx",
    ".smoke.test.tsx",
    ".smoke.test.ts",
    ".spec.ts",
    ".spec.tsx",
    ".test.ts",
    ".test.tsx",
    ".controller.ts",
    ".controller.tsx",
    ".tsx",
    ".ts",
    ".rs",
    ".css",
    ".js",
    ".mjs",
)

# Longest-first single tokens (path segments).
TOKENS: list[tuple[str, str]] = [
    ("krankenbescheinigung", "sick-leave-certificate"),
    ("tagesabschluss", "day-close"),
    ("behandlungs", "treatment"),
    ("behandlung", "treatment"),
    ("untersuchung", "examination"),
    ("anamnesebogen", "anamnesis-form"),
    ("anamnese", "anamnesis"),
    ("patientenakte", "patient-chart"),
    ("zahnbefund", "dental-finding"),
    ("bestellstamm", "order-master"),
    ("bestellungen", "purchase-orders"),
    ("bestellung", "purchase-order"),
    ("bestellwesen", "ordering"),
    ("einstellungen", "settings"),
    ("verwaltung", "administration"),
    ("zahlungen", "payments"),
    ("zahlung", "payment"),
    ("praxisplanung", "practice-planning"),
    ("praeferenzen", "preferences"),
    ("praxis", "practice"),
    ("aufgaben", "tasks"),
    ("aufgabe", "task"),
    ("anlagen", "attachments"),
    ("anlage", "attachment"),
    ("akten", "charts"),
    ("akte", "chart"),
    ("termine", "appointments"),
    ("termin", "appointment"),
    ("rezepte", "prescriptions"),
    ("rezept", "prescription"),
    ("atteste", "certificates"),
    ("attest", "certificate"),
    ("leistungen", "services"),
    ("leistung", "service-item"),
    ("kataloge", "catalogs"),
    ("katalog", "catalog"),
    ("vorlagen", "templates"),
    ("vorlage", "template"),
    ("bilanz", "balance-sheet"),
    ("statistik", "statistics"),
    ("patienten", "patients"),
    ("datenschutz", "privacy"),
    ("posteingang", "inbox"),
    ("finanzen", "finance"),
    ("finanz", "finance"),
    ("produkte", "products"),
    ("produkt", "product"),
    ("personal", "staff"),
    ("arbeitsplan", "work-plan"),
    ("arbeitszeiten", "work-hours"),
    ("arbeitszeit", "work-time"),
    ("arbeitstage", "work-days"),
    ("sperrzeiten", "blocks"),
    ("sonder", "special"),
    ("geraeteverbund", "device-cluster"),
    ("verbund", "cluster"),
    ("rechnung", "invoice"),
    ("dokument", "document"),
    ("vertraege", "contracts"),
    ("vertrag", "contract"),
    ("quittung", "receipt"),
    ("merkblatt", "leaflet"),
    ("kommentare", "comments"),
    ("kommentar", "comment"),
    ("lieferant", "supplier"),
    ("pharmaberater", "pharma-consultant"),
    ("lizenz", "license"),
    ("sicherheit", "security"),
    ("darstellung", "appearance"),
    ("benachrichtigungen", "notifications"),
    ("arbeitsablaeufe", "workflows"),
    ("integrationen", "integrations"),
    ("konto", "account"),
    ("ueber", "about"),
    ("aktivierung", "activation"),
    ("aktivieren", "activate"),
    ("einrichten", "setup"),
    ("beitreten", "join"),
    ("medikamente", "medications"),
    ("rezeption", "reception"),
    ("werkzeuge", "tools"),
    ("berichte", "reports"),
    ("lager", "inventory"),
    ("buchung", "booking"),
    ("kasse", "cash"),
    ("stamm", "master-data"),
    ("protokoll", "protocol"),
    ("behand", "treatment"),
    ("anam", "anamnesis"),
    ("zahl", "payment"),
    ("dsgvo", "gdpr"),
    ("validieren", "validate"),
    ("neu", "new"),
    ("zu", "to"),
]


def split_suffix(name: str) -> tuple[str, str]:
    lower = name.lower()
    for suf in CODE_SUFFIXES:
        if lower.endswith(suf):
            return name[: -len(suf)], name[-len(suf) :]
    return name, ""


def translate_token(tok: str) -> str:
    if not tok:
        return tok
    lower = tok.lower()
    for old, new in TOKENS:
        if lower == old:
            out = new
            break
    else:
        return tok
    if tok.isupper():
        return out.upper()
    if tok[:1].isupper():
        return out[:1].upper() + out[1:]
    return out


def translate_stem(stem: str) -> str:
    if not stem:
        return stem
    parts = re.split(r"([-_.])", stem)
    out: list[str] = []
    for part in parts:
        if part in "-_.":
            out.append(part)
        else:
            out.append(translate_token(part))
    return "".join(out)


def to_snake(name: str) -> str:
    return name.replace("-", "_")


def is_rust_file(rel: Path) -> bool:
    return str(rel).endswith(".rs")


def rust_module_cutoff(rel: Path) -> Optional[int]:
    """Index of src/ or tests/; only parts after this are Rust modules."""
    parts = rel.parts
    idxs = [i for i, p in enumerate(parts) if p in {"src", "tests"}]
    return min(idxs) if idxs else None


def translate_path(rel: Path) -> Path:
    parts: list[str] = []
    rust = is_rust_file(rel)
    cutoff = rust_module_cutoff(rel) if rust else None
    for i, part in enumerate(rel.parts):
        snake = rust and cutoff is not None and i > cutoff
        is_last = i == len(rel.parts) - 1
        if is_last and rel.suffix:
            stem, suf = split_suffix(part)
            new_stem = translate_stem(stem)
            if snake:
                new_stem = to_snake(new_stem)
            parts.append(new_stem + suf)
        else:
            new_part = translate_stem(part)
            if snake:
                new_part = to_snake(new_part)
            parts.append(new_part)
    return Path(*parts)


def iter_code_files() -> list[Path]:
    files: list[Path] = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if p.is_symlink():
            continue
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        s = str(rel).replace("\\", "/")
        if any(s.startswith(pref) for pref in SKIP_ROOT_PREFIXES):
            continue
        if any(parent.is_symlink() for parent in p.parents if str(parent).startswith(str(ROOT))):
            continue
        stem, suf = split_suffix(p.name)
        if not suf:
            continue
        files.append(rel)
    return files


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=check,
        text=True,
        capture_output=True,
    )


def rust_module_repls(old: str, new: str) -> list[tuple[str, str]]:
    if old == new:
        return []
    return [
        (f"pub mod {old};", f"pub mod {new};"),
        (f"mod {old};", f"mod {new};"),
        (f"::{old}::", f"::{new}::"),
        (f"::{old}::*", f"::{new}::*"),
        (f"::{old}::{{", f"::{new}::{{"),
        (f"pub use {old}::", f"pub use {new}::"),
        (f"use {old}::", f"use {new}::"),
    ]


PATH_STRING_RE = re.compile(r"""(['"])((?:\.|\.\.|@|/)[^'"]*)\1""")


def rewrite_ts_paths(text: str, stem_map: list[tuple[str, str]]) -> str:
    def repl_string(m: re.Match[str]) -> str:
        q, body = m.group(1), m.group(2)
        new_body = body
        for old, new in stem_map:
            if old == new:
                continue
            new_body = new_body.replace(old, new)
        return f"{q}{new_body}{q}"

    return PATH_STRING_RE.sub(repl_string, text)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    mappings: list[tuple[Path, Path]] = []
    collisions: list[str] = []
    seen_targets: dict[Path, Path] = {}
    for src in sorted(iter_code_files()):
        dst = translate_path(src)
        if src == dst:
            continue
        mappings.append((src, dst))
        if dst in seen_targets:
            collisions.append(f"{seen_targets[dst]} and {src} -> {dst}")
        seen_targets[dst] = src
        abs_dst = ROOT / dst
        if abs_dst.exists() and src != dst:
            collisions.append(f"target exists: {dst} (from {src})")

    print(f"planned renames: {len(mappings)}")
    for src, dst in mappings:
        print(f"  {src} -> {dst}")
    if collisions:
        print("COLLISIONS:")
        for c in collisions:
            print("  ", c)
        return 1

    if not args.apply:
        print("dry-run only (pass --apply to git mv + path rewrites)")
        return 0

    for src, dst in mappings:
        abs_dst = ROOT / dst
        abs_dst.parent.mkdir(parents=True, exist_ok=True)
        r = git("mv", str(src), str(dst), check=False)
        if r.returncode != 0:
            # untracked files: filesystem move
            src_abs = ROOT / src
            if not src_abs.exists():
                print("missing", src, r.stderr)
                return 1
            os.rename(src_abs, abs_dst)
            print("fs-mv (untracked)", src, "->", dst)
        else:
            print("git-mv", src, "->", dst)

    # drop empty leftover dirs
    leftover_dirs = sorted(
        {src.parent for src, dst in mappings if src.parent != dst.parent},
        key=lambda p: len(p.parts),
        reverse=True,
    )
    for d in leftover_dirs:
        absd = ROOT / d
        if absd.is_dir() and not any(absd.iterdir()):
            absd.rmdir()
            print("rmdir", d)

    rust_stems: dict[str, str] = {}
    ts_stems: dict[str, str] = {}
    dir_stems: dict[str, str] = {}
    for src, dst in mappings:
        rust = is_rust_file(src)
        src_stem, _ = split_suffix(src.name)
        dst_stem, _ = split_suffix(dst.name)
        if rust:
            rust_stems[to_snake(src_stem)] = to_snake(dst_stem)
        else:
            ts_stems[src_stem] = dst_stem
        for a, b in zip(src.parts[:-1], dst.parts[:-1]):
            if a != b:
                if rust:
                    dir_stems[to_snake(a)] = to_snake(b)
                else:
                    ts_stems.setdefault(a, b)
                    dir_stems[a] = b

    rust_pairs = sorted(
        {**rust_stems, **{k: v for k, v in dir_stems.items() if "_" in k or k.isidentifier()}}.items(),
        key=lambda kv: len(kv[0]),
        reverse=True,
    )
    ts_pairs = sorted(ts_stems.items(), key=lambda kv: len(kv[0]), reverse=True)

    rust_subs: list[tuple[str, str]] = []
    for old, new in rust_pairs:
        rust_subs.extend(rust_module_repls(old, new))
    rust_subs.sort(key=lambda kv: len(kv[0]), reverse=True)

    rewritten = 0
    for p in ROOT.rglob("*"):
        if not p.is_file() or p.is_symlink():
            continue
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS for part in rel.parts):
            continue
        s = str(rel).replace("\\", "/")
        if any(s.startswith(pref) for pref in SKIP_ROOT_PREFIXES):
            continue
        if p.suffix not in {".rs", ".ts", ".tsx", ".js", ".mjs"}:
            continue
        text = p.read_text(encoding="utf-8")
        orig = text
        if p.suffix == ".rs":
            for old, new in rust_subs:
                text = text.replace(old, new)
        else:
            text = rewrite_ts_paths(text, ts_pairs)
        if text != orig:
            p.write_text(text, encoding="utf-8")
            rewritten += 1
            print("rewrite", rel)
    print(f"rewrote {rewritten} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
