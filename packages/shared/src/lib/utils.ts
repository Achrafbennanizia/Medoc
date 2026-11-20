import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Product } from "@/models/types";
import { formatIpcError } from "./ipc-errors";
import { effectiveArabicNumeralMode, rewriteDigitsForMode } from "./arabic-numerals";
import { loadClientSettings } from "./client-settings";
import { practiceCurrency } from "./practice-currency";
import type { Locale } from "./i18n";
import { bcp47ForLocale, useLocale } from "./i18n";

/**
 * Database timestamps (`YYYY-MM-DD HH:MM:SS`) are UTC. Without a zone,
 * `new Date()` would read them as local time.
 */
export function parseDbUtc(raw: string): Date {
    const t = raw.trim();
    const iso = t.includes("T") ? t : t.replace(" ", "T");
    const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
    return new Date(hasZone ? iso : `${iso}Z`);
}

/** Stable hue 0–359 from an id. Same id keeps the same color. */
export function hueFromId(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return Math.abs(h >>> 0) % 360;
}

/** Two-letter avatar mark: first and last name, or the first two letters of a single name. */
export function initialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

/** Minutes from midnight as `HH:MM`. */
export function minutesToTime(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Local calendar day `yyyy-MM-dd`. */
export function localIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Escape text for safe interpolation into HTML (e.g. print templates). */
export function escapeHtml(raw: string): string {
    return raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Replace `{key}` placeholders in i18n-style templates (missing keys become empty string). */
export function formatTpl(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}

/** Safe string for catch blocks / invoke failures */
export function errorMessage(e: unknown): string {
    return formatIpcError(e);
}

/** The main device did not accept a connection. Not a settings or HTTPS failure. */
export function masterDeviceUnreachable(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes("connection refused") ||
        lower.includes("cluster connect") ||
        lower.includes("cluster auth connect") ||
        lower.includes("cluster sas connect") ||
        lower.includes("master unreachable") ||
        lower.includes("os error 61") ||
        lower.includes("timed out") ||
        lower.includes("network is unreachable") ||
        lower.includes("no route to host")
    );
}

function resolveLocaleTag(locale?: Locale): string {
    return bcp47ForLocale(locale ?? useLocale.getState().locale);
}

function applyUiDigits(text: string, locale?: Locale): string {
    const loc = locale ?? useLocale.getState().locale;
    const mode = effectiveArabicNumeralMode(loc, loadClientSettings().appearance?.arabicNumeralMode);
    return rewriteDigitsForMode(text, mode);
}

/** A calendar day stays that day. A timestamp is UTC, then shown in the local zone. */
export function parseDisplayDate(raw: string): Date {
    const s = raw.trim();
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return parseDbUtc(s);
}

/** Inclusive day count for two written calendar days. */
export function inclusiveCalendarDays(fromIso: string, untilIso: string): number {
    const a = parseDisplayDate(fromIso.slice(0, 10));
    const b = parseDisplayDate(untilIso.slice(0, 10));
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.max(1, Math.round((utcB - utcA) / 86_400_000) + 1);
}

/** Add calendar days to a written day. The result is `yyyy-MM-dd`. */
export function addCalendarDays(iso: string, days: number): string {
    const d = parseDisplayDate(iso.slice(0, 10));
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    d.setDate(d.getDate() + days);
    return localIsoDate(d);
}

export function formatDate(dateStr: string, locale?: Locale): string {
    return applyUiDigits(
        parseDisplayDate(dateStr).toLocaleDateString(resolveLocaleTag(locale), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        }),
        locale,
    );
}

/** Clinical printouts keep `DD.MM.YYYY`, independent of the UI locale. */
export function formatWrittenDay(iso: string): string {
    const d = iso.trim().slice(0, 10);
    if (d.length >= 10 && d[4] === "-" && d[7] === "-") {
        return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
    }
    return formatDate(iso);
}

export function formatCurrency(amount: number, locale?: Locale): string {
    const currency = practiceCurrency();
    try {
        return applyUiDigits(
            new Intl.NumberFormat(resolveLocaleTag(locale), {
                style: "currency",
                currency,
            }).format(amount),
            locale,
        );
    } catch {
        return applyUiDigits(
            new Intl.NumberFormat(resolveLocaleTag(locale), {
                style: "currency",
                currency: "EUR",
            }).format(amount),
            locale,
        );
    }
}

/** Extra size modifiers so long currency strings stay inside the card. */
export function kpiValueSizeClass(value: string, base = "kpi-val"): string {
    const len = value.replace(/\s/g, "").length;
    if (len >= 15) return `${base} ${base}--xl`;
    if (len >= 12) return `${base} ${base}--long`;
    return base;
}

/**
 * Parse a typed amount.
 * - `1.234,56` → 1234.56 (German: dot thousands, comma decimal)
 * - `1,234.50` → 1234.50 (English: comma thousands, point decimal)
 * - `1234,56` → 1234.56
 * - `1.234.567` (two or more groups of three) → 1234567
 * - one point is always the decimal point, including three digits (`245.500` → 245.5, `12.345` → 12.345)
 */
export function parseEuroInput(raw: string): number | null {
    const s0 = String(raw).trim().replace(/\s/g, "");
    if (s0 === "") return null;

    const lastComma = s0.lastIndexOf(",");
    const lastDot = s0.lastIndexOf(".");
    let s: string;
    if (lastComma >= 0 && lastDot >= 0) {
        s = lastComma > lastDot ? s0.replace(/\./g, "").replace(",", ".") : s0.replace(/,/g, "");
    } else if (lastComma >= 0) {
        s = s0.replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s0) && s0.split(".").length > 2) {
        s = s0.replace(/\./g, "");
    } else {
        s = s0;
    }

    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
}

/** How often the name appears — for ambiguity (same name, different category/price/ID). */
export function countProductsWithName(products: Product[], name: string): number {
    return products.filter((p) => p.name === name).length;
}

/** Row in product dropdowns: name · category · price; append short ID for name duplicates. */
export function productSelectLabel(p: Product, nameDupCount: number): string {
    const base = `${p.name} · ${p.category} · ${formatCurrency(p.price)}`;
    if (nameDupCount > 1) {
        return `${base} · #${p.id.slice(0, 8)}`;
    }
    return base;
}

export function formatDateTime(dateStr: string, locale?: Locale): string {
    return applyUiDigits(
        parseDbUtc(dateStr).toLocaleString(resolveLocaleTag(locale), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }),
        locale,
    );
}

/** Clock time of a database timestamp. Empty when the timestamp cannot be read. */
export function formatDbTime(raw: string, locale?: Locale): string {
    const d = parseDbUtc(raw);
    if (Number.isNaN(d.getTime())) return "";
    return applyUiDigits(
        d.toLocaleTimeString(resolveLocaleTag(locale), { hour: "2-digit", minute: "2-digit" }),
        locale,
    );
}
