import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { Produkt } from "@/models/types";

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
    if (e instanceof Error) return e.message;
    return String(e);
}

export function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
    }).format(amount);
}

/** Wie oft der Name vorkommt — für Mehrdeutigkeit (gleicher Name, versch. Kategorie/Preis/ID). */
export function countProdukteWithName(produkte: Produkt[], name: string): number {
    return produkte.filter((p) => p.name === name).length;
}

/** Zeile in Produkt-Dropdowns: Name · Kategorie · Preis; bei Namens-Duplikaten Kurz-ID anhängen. */
export function produktSelectLabel(p: Produkt, nameDupCount: number): string {
    const base = `${p.name} · ${p.kategorie} · ${formatCurrency(p.preis)}`;
    if (nameDupCount > 1) {
        return `${base} · #${p.id.slice(0, 8)}`;
    }
    return base;
}

export function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}
