#!/usr/bin/env python3
"""Drive the MeDoc Tauri window via the Vite capture bridge and replace website/img shots."""

from __future__ import annotations

import json
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"
BRIDGE = "http://localhost:1420/__medoc_capture"


def http_json(method: str, url: str, body: dict[str, Any] | None = None, timeout: float = 5.0) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            if not raw:
                return resp.status, None
            return resp.status, json.loads(raw.decode())
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw.decode()) if raw else None
        except json.JSONDecodeError:
            parsed = None
        return e.code, parsed
    except (urllib.error.URLError, ConnectionError, TimeoutError, OSError):
        return 0, None


def send(op: str, timeout: float = 20.0, **kw: Any) -> dict[str, Any]:
    cid = str(uuid.uuid4())
    code, _ = http_json("POST", f"{BRIDGE}/enqueue", {"id": cid, "op": op, **kw})
    if code != 200:
        return {"ok": False, "error": f"enqueue {code}", "op": op}
    deadline = time.time() + timeout
    while time.time() < deadline:
        code, body = http_json("GET", f"{BRIDGE}/result?id={cid}")
        if code == 200 and isinstance(body, dict):
            if not body.get("ok", True):
                print("cmd fail", op, body, flush=True)
            return body
        time.sleep(0.15)
    print("cmd timeout", op, kw, flush=True)
    return {"ok": False, "error": "timeout", "op": op}


def wait_bridge(seconds: float = 90.0) -> bool:
    t0 = time.time()
    while time.time() - t0 < seconds:
        code, body = http_json("GET", f"{BRIDGE}/status")
        if code == 200 and isinstance(body, dict):
            age = body.get("ageMs")
            if isinstance(age, (int, float)) and age < 4000:
                print("poller hello age_ms", int(age), flush=True)
                return True
        time.sleep(0.5)
    return False


SKIP_EXISTING = False
CAPTURE_MAX_BYTES = 3_500_000
_WINDOW_ID: Optional[int] = None

_SWIFT_WINDOW_ID = r"""
import CoreGraphics
let opts = CGWindowListOption.optionOnScreenOnly.union(.excludeDesktopElements)
guard let info = CGWindowListCopyWindowInfo(opts, kCGNullWindowID) as? [[String: Any]] else { exit(1) }
for w in info {
  let owner = (w[kCGWindowOwnerName as String] as? String) ?? ""
  if owner.caseInsensitiveCompare("medoc") == .orderedSame {
    let num = w[kCGWindowNumber as String] as? Int ?? 0
    if num > 0 {
      print(num)
      exit(0)
    }
  }
}
exit(2)
"""


def medoc_window_id(refresh: bool = False) -> Optional[int]:
    global _WINDOW_ID
    if _WINDOW_ID and not refresh:
        return _WINDOW_ID
    try:
        r = subprocess.run(
            ["swift", "-e", _SWIFT_WINDOW_ID],
            capture_output=True,
            text=True,
            timeout=20,
        )
    except (subprocess.TimeoutExpired, OSError) as e:
        print("window id lookup failed", e, flush=True)
        return _WINDOW_ID
    line = (r.stdout or "").strip().splitlines()
    if line and line[0].isdigit():
        _WINDOW_ID = int(line[0])
        print("medoc window id", _WINDOW_ID, flush=True)
        return _WINDOW_ID
    print("window id lookup empty", r.returncode, r.stderr[:200] if r.stderr else "", flush=True)
    return _WINDOW_ID


def capture_window(dest: Path, skip_existing: Optional[bool] = None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    skip = SKIP_EXISTING if skip_existing is None else skip_existing
    if skip and dest.exists():
        sz = dest.stat().st_size
        if 50_000 < sz < CAPTURE_MAX_BYTES:
            print("skip existing", dest.name, flush=True)
            return
    last_sz = 0
    wid = medoc_window_id()
    for attempt in range(3):
        if attempt:
            wid = medoc_window_id(refresh=True)
        cmd = ["screencapture", "-x"]
        if wid:
            cmd += [f"-l{wid}"]
        else:
            cmd += ["-D1"]
        cmd.append(str(dest))
        r = subprocess.run(cmd, capture_output=True, timeout=8)
        if r.returncode != 0:
            print("screencapture fail", r.returncode, r.stderr, flush=True)
            wid = None
        last_sz = dest.stat().st_size if dest.exists() else 0
        if 50_000 < last_sz < CAPTURE_MAX_BYTES:
            break
        print("retry shot", dest.name, last_sz, "attempt", attempt, flush=True)
    print("shot", dest.name, dest.exists(), last_sz, flush=True)


def href_slug(href: str) -> str:
    mapping = {
        "/": "overview",
        "/appointments": "schedule",
        "/patients": "patient-records",
        "/charts/to-validate": "charts-to-validate",
        "/tickets": "practice-tasks",
        "/prescriptions": "prescriptions",
        "/statistics": "analytics",
        "/finance": "finance",
        "/finance/cash": "cash-entries",
        "/purchase-orders": "orders",
        "/staff/work-time": "work-time",
        "/administration": "administration",
        "/settings": "settings",
        "/services": "services",
        "/inbox": "inbox",
    }
    return mapping.get(href, href.strip("/").replace("/", "-") or "overview")


DAY = {"en": "Day", "de": "Tag", "fr": "Jour", "ar": "يوم"}
WEEK = {"en": "Week", "de": "Woche", "fr": "Semaine", "ar": "الأسبوع"}
LOGOUT = {
    "en": "Sign out",
    "de": "Abmelden",
    "fr": "Se déconnecter",
    "ar": "تسجيل الخروج",
}

ROLES = [
    ("physician", "ahmed@practice.de", "password123"),
    ("reception", "aya@practice.de", "password123"),
]
LOCALES = ["en", "de", "fr", "ar"]
THEMES = ["light", "dark"]


def ensure_logged_out(locale: str) -> None:
    for _ in range(12):
        snap = send("snapshot")
        if snap.get("login") or (snap.get("path") or "").startswith("/login"):
            return
        send("logout")
        send("confirmLogout")
        time.sleep(0.8)
    print("WARN still not on login", send("snapshot"), flush=True)


def wait_role(role: str, seconds: float = 12.0) -> dict[str, Any]:
    deadline = time.time() + seconds
    snap: dict[str, Any] = {}
    while time.time() < deadline:
        snap = send("snapshot")
        if snap.get("role") == role and snap.get("sidebar"):
            return snap
        time.sleep(0.35)
    return snap


def login(email: str, password: str, want_role: str, locale: str) -> None:
    ensure_logged_out(locale)
    for attempt in range(8):
        snap = send("snapshot")
        on_login = snap.get("login") or (snap.get("path") or "").startswith("/login")
        if on_login:
            filled = send("fillLogin", email=email, password=password)
            print("fillLogin", filled.get("ok"), attempt, flush=True)
            if not filled.get("ok"):
                time.sleep(0.8)
                continue
            time.sleep(0.2)
            send("submitLogin")
        elif snap.get("role") == want_role:
            print("already", want_role, flush=True)
            return
        else:
            send("logout")
            send("confirmLogout")
            time.sleep(1.0)
            continue
        snap = wait_role(want_role, 16.0)
        if snap.get("role") == want_role and snap.get("sidebar"):
            print("logged in", want_role, "items", len(snap.get("sidebar") or []), flush=True)
            send("clickSidebar", href="/")
            time.sleep(0.8)
            return
    print("WARN login failed", want_role, send("snapshot"), flush=True)


def walk_menu(out_dir: Path, role: str, locale: str, theme: str) -> None:
    snap = wait_role(role, 16.0)
    if snap.get("role") != role:
        print("SKIP walk wrong role", snap.get("role"), "want", role, flush=True)
        return
    items = snap.get("sidebar") or []
    hrefs = []
    for it in items:
        h = it.get("href") or ""
        if h and h not in hrefs:
            hrefs.append(h)
    print(f"  menu {role}/{locale}/{theme}: {len(hrefs)} items", flush=True)
    if len(hrefs) < 4:
        print("SKIP sparse menu", flush=True)
        return
    for href in hrefs:
        send("clickSidebar", href=href)
        time.sleep(1.15)
        slug = href_slug(href)
        if href.rstrip("/") == "/appointments":
            send("clickText", text=DAY[locale])
            time.sleep(0.8)
            slug = "schedule-day"
        capture_window(out_dir / f"{role}-{locale}-{theme}-{slug}.png")
        if href.rstrip("/") == "/appointments":
            send("clickText", text=WEEK[locale])
            time.sleep(0.8)
            capture_window(out_dir / f"{role}-{locale}-{theme}-schedule-week.png")
            send("clickText", text=DAY[locale])
            time.sleep(0.4)


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--roles", default="reception,physician", help="Comma list: reception,physician")
    parser.add_argument("--skip-login-shots", action="store_true")
    parser.add_argument("--replace", action="store_true", help="Delete existing role PNGs before capturing")
    parser.add_argument("--skip-existing", action="store_true")
    args = parser.parse_args()
    wanted = [r.strip() for r in args.roles.split(",") if r.strip()]
    cred_by = {n: (n, e, p) for n, e, p in ROLES}
    role_creds = [cred_by[n] for n in wanted if n in cred_by]

    IMG.mkdir(parents=True, exist_ok=True)
    print("waiting for poller on", BRIDGE, flush=True)
    if not wait_bridge():
        raise SystemExit("MeDoc window never polled the capture bridge (is Vite+Tauri running?)")

    if args.replace:
        for role in wanted:
            for p in IMG.glob(f"{role}-*.png"):
                p.unlink()
                print("removed", p.name, flush=True)
        if not args.skip_login_shots:
            for p in IMG.glob("login-*.png"):
                p.unlink()
                print("removed", p.name, flush=True)

    skip_existing = args.skip_existing
    global SKIP_EXISTING
    SKIP_EXISTING = skip_existing

    for locale in LOCALES:
        send("setLocale", locale=locale)
        time.sleep(0.4)
        for theme in THEMES:
            send("setTheme", theme=theme)
            time.sleep(0.35)
            ensure_logged_out(locale)
            send("setLocale", locale=locale)
            send("setTheme", theme=theme)
            time.sleep(0.5)
            if not args.skip_login_shots:
                capture_window(IMG / f"login-{locale}-{theme}.png")
            for role, email, password in role_creds:
                login(email, password, role, locale)
                send("setLocale", locale=locale)
                send("setTheme", theme=theme)
                wait_role(role, 10.0)
                walk_menu(IMG, role, locale, theme)
                send("logout")
                send("confirmLogout")
                time.sleep(1.5)
                ensure_logged_out(locale)

    print("captures written under", IMG, flush=True)


if __name__ == "__main__":
    main()
