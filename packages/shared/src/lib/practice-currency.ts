import { createListenerSet } from "./create-listener-set";
/** ISO 4217 codes offered in Settings → Practice. Default is EUR. */
export const PRACTICE_CURRENCIES = [
    "EUR",
    "USD",
    "GBP",
    "CHF",
    "MAD",
    "CAD",
    "AUD",
    "SEK",
    "NOK",
    "DKK",
    "PLN",
    "CZK",
    "TND",
    "AED",
    "SAR",
] as const;

export type PracticeCurrency = (typeof PRACTICE_CURRENCIES)[number];

const PRACTICE_STORAGE_KEY = "medoc-invoice-practice-v1";

const listeners = createListenerSet();

export function normalizePracticeCurrency(raw: string | undefined | null): PracticeCurrency {
    const code = (raw ?? "").trim().toUpperCase();
    return (PRACTICE_CURRENCIES as readonly string[]).includes(code) ? (code as PracticeCurrency) : "EUR";
}

/** Currency saved with the practice profile. Missing or unknown values are EUR. */
export function practiceCurrency(): PracticeCurrency {
    try {
        const raw = localStorage.getItem(PRACTICE_STORAGE_KEY);
        if (!raw) return "EUR";
        const parsed = JSON.parse(raw) as { currency?: unknown };
        return normalizePracticeCurrency(typeof parsed.currency === "string" ? parsed.currency : "EUR");
    } catch {
        return "EUR";
    }
}

export function subscribePracticeCurrency(listener: () => void): () => void {
    return listeners.subscribe(listener);
}

export function publishPracticeCurrency(): void {
    listeners.notify();
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("medoc:practice-currency-changed"));
    }
}
