/**
 * Arabic UI digit style: Western (0-9) vs Eastern Arabic-Indic (٠-٩).
 * Applied only when the UI locale is Arabic; other locales always use Western digits.
 */

export type ArabicNumeralMode = "western" | "eastern";

const WESTERN = "0123456789";
/** Arabic-Indic (U+0660–U+0669). */
const EASTERN_ARABIC = "٠١٢٣٤٥٦٧٨٩";
/** Eastern Arabic-Indic / Persian (U+06F0–U+06F9) — normalize into the same 0-9 range. */
const EXTENDED_INDIC = "۰۱۲۳۴۵۶۷۸۹";

const DIGIT_CLASS = /[0-9\u0660-\u0669\u06F0-\u06F9]/g;

const ATTRS = ["aria-label", "title", "placeholder", "alt", "aria-valuetext"] as const;

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "NOSCRIPT", "CODE", "PRE", "KBD"]);

export function normalizeArabicNumeralMode(raw: unknown): ArabicNumeralMode {
    return raw === "eastern" ? "eastern" : "western";
}

export function effectiveArabicNumeralMode(locale: string, stored: unknown): ArabicNumeralMode {
    if (locale !== "ar") return "western";
    return normalizeArabicNumeralMode(stored);
}

export function numberingSystemForLocale(locale: string, stored: unknown): "latn" | "arab" {
    return effectiveArabicNumeralMode(locale, stored) === "eastern" ? "arab" : "latn";
}

function digitValue(ch: string): number | null {
    const w = WESTERN.indexOf(ch);
    if (w >= 0) return w;
    const e = EASTERN_ARABIC.indexOf(ch);
    if (e >= 0) return e;
    const x = EXTENDED_INDIC.indexOf(ch);
    if (x >= 0) return x;
    return null;
}

function rewriteAllDigits(text: string, mode: ArabicNumeralMode): string {
    if (!text) return text;
    const table = mode === "eastern" ? EASTERN_ARABIC : WESTERN;
    return text.replace(DIGIT_CLASS, (ch) => {
        const n = digitValue(ch);
        return n == null ? ch : table[n]!;
    });
}

const PHONE_DIGIT = "[0-9\\u0660-\\u0669\\u06F0-\\u06F9]";
/** International (+ / 00) or national (leading 0) numbers — keep stored Latin form. */
const PHONE_LIKE_RE = new RegExp(
    `(?:\\+|00)${PHONE_DIGIT}(?:[\\s()./-]*${PHONE_DIGIT}){5,}|\\b0${PHONE_DIGIT}(?:[\\s()./-]*${PHONE_DIGIT}){5,}\\b`,
    "g",
);

export function looksLikePhoneNumber(text: string): boolean {
    const t = text.trim();
    if (!t) return false;
    PHONE_LIKE_RE.lastIndex = 0;
    const m = PHONE_LIKE_RE.exec(t);
    return !!m && m[0] === t;
}

/** Map digits onto the target system, but leave telephone numbers in Western form. */
export function rewriteDigitsForMode(text: string, mode: ArabicNumeralMode): string {
    if (!text) return text;
    if (mode === "western") return rewriteAllDigits(text, "western");
    PHONE_LIKE_RE.lastIndex = 0;
    const parts: string[] = [];
    let last = 0;
    for (const m of text.matchAll(PHONE_LIKE_RE)) {
        const idx = m.index ?? 0;
        parts.push(rewriteAllDigits(text.slice(last, idx), mode));
        parts.push(rewriteAllDigits(m[0], "western"));
        last = idx + m[0].length;
    }
    parts.push(rewriteAllDigits(text.slice(last), mode));
    return parts.join("");
}

/** Keep +49… visually LTR inside Arabic/RTL strings (PDF and plain text). */
export function isolateLtrPhone(text: string): string {
    return `\u2066${text}\u2069`;
}

function shouldSkipElement(el: Element): boolean {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.classList?.contains("phone-text")) return true;
    if (el.getAttribute("data-arabic-numerals-skip") != null) return true;
    if (el.closest("[data-arabic-numerals-skip]")) return true;
    if (el instanceof HTMLElement && el.isContentEditable) return true;
    if (el.closest("[contenteditable='true']")) return true;
    return false;
}

function rewriteAttrs(el: Element, mode: ArabicNumeralMode): void {
    for (const name of ATTRS) {
        const v = el.getAttribute(name);
        if (!v) continue;
        const next = rewriteDigitsForMode(v, mode);
        if (next !== v) el.setAttribute(name, next);
    }
}

export function rewriteDomDigits(root: Node | null, mode: ArabicNumeralMode): void {
    if (!root) return;
    const visit = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            const parent = node.parentElement;
            if (parent && shouldSkipElement(parent)) return;
            const cur = node.nodeValue;
            if (!cur) return;
            const next = rewriteDigitsForMode(cur, mode);
            if (next !== cur) node.nodeValue = next;
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as Element;
        if (shouldSkipElement(el)) return;
        rewriteAttrs(el, mode);
        const children = el.childNodes;
        for (let i = 0; i < children.length; i++) visit(children[i]!);
    };
    visit(root);
}

let observer: MutationObserver | null = null;
let appliedMode: ArabicNumeralMode = "western";

function onMutations(mutations: MutationRecord[]): void {
    const mode = appliedMode;
    for (const m of mutations) {
        if (m.type === "characterData") {
            rewriteDomDigits(m.target, mode);
        } else if (m.type === "childList") {
            m.addedNodes.forEach((n) => rewriteDomDigits(n, mode));
        } else if (m.type === "attributes" && m.target instanceof Element) {
            if (shouldSkipElement(m.target)) continue;
            rewriteAttrs(m.target, mode);
        }
    }
}

function ensureObserver(): void {
    if (observer || typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: [...ATTRS],
    });
}

/** Sync `html[data-arabic-numerals]` and rewrite visible digits for the current locale + preference. */
export function applyArabicNumeralsToDocument(locale: string, stored: unknown): void {
    if (typeof document === "undefined") return;
    const mode = effectiveArabicNumeralMode(locale, stored);
    appliedMode = mode;
    document.documentElement.dataset.arabicNumerals = mode;
    rewriteDomDigits(document.body ?? document.documentElement, mode);
    ensureObserver();
}
