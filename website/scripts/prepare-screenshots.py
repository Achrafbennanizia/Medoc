#!/usr/bin/env python3
"""Crop macOS chrome from MeDoc screenshots and export marketing frames."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "img"
OUT = ROOT / "img" / "product"
PUBLIC = ROOT / "public" / "product"

# Prefer a normal weekday in English light; fall back to the first matching capture.
CURATED = [
    ("login-en-light.png", "sign-in"),
    ("physician-en-light-overview.png", "overview"),
    ("physician-en-light-schedule-week.png", "schedule-week"),
    ("physician-en-light-schedule-day.png", "schedule-day"),
    ("physician-en-light-patient-records.png", "patient-records"),
    ("physician-en-light-practice-tasks.png", "practice-tasks"),
    ("physician-en-light-practice-tasks.png", "prescriptions"),
    ("physician-en-light-finance.png", "finance"),
    ("physician-en-light-orders.png", "orders"),
    ("physician-en-light-administration.png", "administration"),
    ("physician-en-light-settings.png", "settings"),
    ("physician-en-light-analytics.png", "analytics"),
    ("physician-en-light-charts-to-validate.png", "export-chart"),
    ("reception-en-light-overview.png", "reception-overview"),
    ("reception-en-light-patient-records.png", "reception-patient"),
    ("reception-en-light-cash-entries.png", "cash-entries"),
    ("physician-en-light-work-time.png", "billing"),
    ("reception-en-dark-overview.png", "odontogram"),
    ("reception-en-dark-schedule-day.png", "treatments"),
    ("physician-de-light-overview.png", "examinations"),
    ("physician-en-light-settings.png", "settings-security"),
    ("physician-de-dark-settings.png", "appointment-detail"),
    ("reception-en-dark-overview.png", "appointment-new"),
    ("physician-de-light-patient-records.png", "patient-new"),
    ("physician-en-light-practice-tasks.png", "prescription-new"),
    ("physician-en-light-practice-tasks.png", "certificate-new"),
    ("reception-en-light-orders.png", "order-detail"),
    ("reception-ar-light-overview.png", "treatment-new"),
    ("physician-de-dark-finance.png", "patient-record"),
]


def luminance(arr: np.ndarray) -> np.ndarray:
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def crop_chrome(im: Image.Image) -> Image.Image:
    rgb = np.asarray(im.convert("RGB"))
    lum = luminance(rgb)
    h, w = lum.shape

    top = 0
    while top < 140 and float(lum[top].mean()) < 8:
        top += 1
    if top < 40:
        for y in range(top, min(140, h // 8)):
            if float(lum[y].mean()) > 185:
                top = y
                break

    bottom = h
    for y in range(h - 1, int(h * 0.72), -1):
        row = lum[y]
        if float(row.mean()) < 45 and float((row < 28).mean()) > 0.35:
            bottom = y
            while bottom > top + 200 and float(lum[bottom].mean()) < 80:
                bottom -= 1
            break

    left, right = 0, w
    top = min(h - 2, top + 1)
    if bottom < h:
        bottom = max(top + 200, bottom - 1)
    cropped = im.crop((left, top, right, bottom))
    if cropped.size[1] < 400:
        return im
    return cropped


def round_on_canvas(im: Image.Image, radius: int = 20, bg=(243, 244, 246)) -> Image.Image:
    im = im.convert("RGBA")
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.size[0] - 1, im.size[1] - 1), radius=radius, fill=255)
    rounded = im.copy()
    rounded.putalpha(mask)
    canvas = Image.new("RGB", im.size, bg)
    canvas.paste(rounded, mask=rounded.split()[-1])
    return canvas


def improve(im: Image.Image) -> Image.Image:
    im = ImageEnhance.Contrast(im).enhance(1.04)
    im = ImageEnhance.Color(im).enhance(1.03)
    im = ImageEnhance.Sharpness(im).enhance(1.12)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=3))
    return im


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for src_name, slug in CURATED:
        src = SRC / src_name
        if not src.exists():
            print(f"SKIP {slug:22s} missing {src_name}")
            continue
        im = Image.open(src)
        cropped = crop_chrome(im)
        finished = improve(round_on_canvas(cropped))
        jpg = f"{slug}.jpg"
        finished.save(OUT / jpg, "JPEG", quality=88, optimize=True)
        finished.save(PUBLIC / jpg, "JPEG", quality=88, optimize=True)
        print(f"{slug:22s} {finished.size[0]}×{finished.size[1]}  from {src_name}")


if __name__ == "__main__":
    main()
