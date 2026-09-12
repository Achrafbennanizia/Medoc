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

# Best unique captures (skip dock-overlapped duplicates and mid-scroll fragments).
CURATED = [
    ("Screenshot 2026-09-12 at 14.02.03.png", "sign-in"),
    ("Screenshot 2026-09-12 at 14.02.27.png", "overview"),
    ("Screenshot 2026-09-12 at 14.03.20.png", "schedule-week"),
    ("Screenshot 2026-09-12 at 14.04.02.png", "schedule-day"),
    ("Screenshot 2026-09-12 at 14.04.20.png", "patient-records"),
    ("Screenshot 2026-09-12 at 14.04.42.png", "patient-new"),
    ("Screenshot 2026-09-12 at 14.05.59.png", "appointment-new"),
    ("Screenshot 2026-09-12 at 14.06.27.png", "patient-record"),
    ("Screenshot 2026-09-12 at 14.06.38.png", "examinations"),
    ("Screenshot 2026-09-12 at 14.06.57.png", "odontogram"),
    ("Screenshot 2026-09-12 at 14.07.07.png", "treatments"),
    ("Screenshot 2026-09-12 at 14.07.31.png", "treatment-new"),
    ("Screenshot 2026-09-12 at 14.07.43.png", "prescriptions"),
    ("Screenshot 2026-09-12 at 14.08.37.png", "prescription-new"),
    ("Screenshot 2026-09-12 at 14.09.11.png", "certificate-new"),
    ("Screenshot 2026-09-12 at 14.09.25.png", "billing"),
    ("Screenshot 2026-09-12 at 14.10.25.png", "finance"),
    ("Screenshot 2026-09-12 at 14.10.37.png", "orders"),
    ("Screenshot 2026-09-12 at 14.10.50.png", "administration"),
    ("Screenshot 2026-09-12 at 14.10.59.png", "settings"),
    ("Screenshot 2026-09-12 at 15.39.57.png", "export-chart"),
    ("Screenshot 2026-09-12 at 15.41.07.png", "practice-tasks"),
    ("Screenshot 2026-09-12 at 15.41.23.png", "appointment-detail"),
    ("Screenshot 2026-09-12 at 15.41.35.png", "order-detail"),
    ("Screenshot 2026-09-12 at 15.42.18.png", "analytics"),
    ("Screenshot 2026-09-12 at 15.42.30.png", "settings-security"),
    ("Screenshot 2026-09-12 at 15.45.07.png", "reception-overview"),
    ("Screenshot 2026-09-12 at 15.45.24.png", "reception-patient"),
    ("Screenshot 2026-09-12 at 15.46.06.png", "cash-entries"),
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
    # Drop a 1px fringe after the menu / black bar.
    top = min(h - 2, top + 1)
    if bottom < h:
        bottom = max(top + 200, bottom - 1)
    return im.crop((left, top, right, bottom))


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
        im = Image.open(src)
        cropped = crop_chrome(im)
        finished = improve(round_on_canvas(cropped))
        jpg = f"{slug}.jpg"
        finished.save(OUT / jpg, "JPEG", quality=88, optimize=True)
        finished.save(PUBLIC / jpg, "JPEG", quality=88, optimize=True)
        print(f"{slug:22s} {finished.size[0]}×{finished.size[1]}  from {src_name}")


if __name__ == "__main__":
    main()
