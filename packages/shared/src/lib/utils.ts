import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Product } from "@/models/types";
import { formatIpcError } from "./ipc-errors";
import type { Locale } from "./i18n";
import { bcp47ForLocale, useLocale } from "./i18n";

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

function resolveLocaleTag(locale?: Locale): string {
    return bcp47ForLocale(locale ?? useLocale.getState().locale);
}

export function formatDate(dateStr: string, locale?: Locale): string {
    return new Date(dateStr).toLocaleDateString(resolveLocaleTag(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function formatCurrency(amount: number, locale?: Locale): string {
    return new Intl.NumberFormat(resolveLocaleTag(locale), {
        style: "currency",
        currency: "EUR",
    }).format(amount);
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
    return new Date(dateStr).toLocaleString(resolveLocaleTag(locale), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
