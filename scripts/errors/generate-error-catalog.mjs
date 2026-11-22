#!/usr/bin/env node
/**
 * Error catalog generator — finds EVERY error the app can raise and gives it a stable support code.
 *
 * Sources scanned:
 *   1. coded keys      `error.<domain>.<name>` in locales, Rust and TypeScript
 *   2. backend text    `AppError::Validation|Conflict("…")` literals (incl. `format!`) in Rust
 *   3. features        `AppError::FeatureDisabled("…")`
 *   4. UI text         `throw new Error("…")` literals in the TypeScript app
 *   (Internal / database errors are deliberately ONE code each — MD-APP-004 / MD-APP-002 — with a
 *    per-occurrence reference; their detail is logged, never shown. Sites are listed in the developer appendix.)
 *
 * Outputs:
 *   config/error-codes.lock.json                       append-only id → code map (codes never change)
 *   packages/shared/src/lib/errors/error-catalog.ts    catalog used by the app
 *   docs/manual/error-sites.md                         developer appendix: where each code is raised
 *
 * Usage: node scripts/errors/generate-error-catalog.mjs [--check]
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const check = process.argv.includes("--check");
const LOCK = join(root, "config/error-codes.lock.json");
const OUT = join(root, "packages/shared/src/lib/errors/error-catalog.ts");
const SITES = join(root, "docs/manual/error-sites.md");
const OVERRIDES = JSON.parse(readFileSync(join(root, "scripts/errors/error-overrides.json"), "utf8"));
/** English template → [de, fr, ar] for backend / UI messages people actually see. */
const TRANSLATIONS = JSON.parse(readFileSync(join(root, "scripts/errors/error-text-translations.json"), "utf8"));
const LOCALES = ["en", "de", "fr", "ar"];
/** `{}` positional → `{p0}`, `{name:?}` → `{name}` so templates are valid i18n strings. */
function i18nTemplate(t) {
    let i = 0;
    return t.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)?(?::[^}]*)?\}/g, (_, name) => `{${name ?? `p${i++}`}}`);
}

const files = (glob) => execSync(`git ls-files ${glob}`, { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const read = (f) => readFileSync(join(root, f), "utf8");
const stripTests = (s) => s.split(/#\[cfg\(test\)\]/)[0];

/** Domain prefixes (3–4 letters). Second key segment for coded keys; path for text errors. */
const DOMAIN_PREFIX = {
    app: "APP", auth: "AUTH", attachment: "ATT", backup: "BAK", billing: "BIL", boundary: "BND", break_glass: "BRG",
    chart: "CHT", cluster: "CLU", device_session: "DEV", export: "EXP", lan: "LAN", master: "MST", pairing: "PAR",
    payment: "PAY", practice_task: "TSK", profile: "PRF", staff: "STF", work_time: "WTM", workflow: "WFL",
    appointment: "APT", patient: "PAT", prescription: "RXP", certificate: "CRT", document: "DOC", invoice: "INV",
    contract: "CON", license: "LIC", sync: "SYN", security: "SEC", settings: "SET", scanner: "SCN", audit: "AUD",
    treatment: "TRT", inventory: "INVT", integration: "INT", notification: "NTF", ui: "UIX", report: "REP",
    work_plan: "WPL", day_close: "DCL", setup: "SUP", update: "UPD", examination: "EXM", feature: "FEA",
};
/** Path fragment → domain (first match wins). */
const PATH_DOMAIN = [
    [/pairing/, "pairing"], [/cluster|lan_peer|discovery|mdns/, "cluster"], [/sync|outbox|replica/, "sync"],
    [/medoc-lan|\/lan\//, "lan"], [/license|seat|provision|activation|company/, "license"],
    [/crypto|keyring|sqlcipher|passphrase|security|break_glass|totp|brute|session/, "security"],
    [/payment|cash|day_close|receivable|cash_book/, "payment"], [/invoice|billing|goz|fee/, "invoice"],
    [/appointment|calendar|schedul/, "appointment"], [/prescription|eprescription|telematik/, "prescription"],
    [/certificate|sick_leave/, "certificate"], [/document|pdf|template|print|letter/, "document"],
    [/chart|anamnes|dental|examination|treatment|clinical/, "chart"], [/patient/, "patient"],
    [/contract/, "contract"], [/product|purchase|supplier|inventory|stock|order|master/, "inventory"],
    [/staff|access|rbac|permission|profile|auth|login/, "staff"], [/work_time|work_plan|absence/, "work_time"],
    [/practice_task|ticket|task/, "practice_task"], [/notification/, "notification"], [/scanner|scan/, "scanner"],
    [/backup|restore|usb/, "backup"], [/audit|log/, "audit"], [/export|report|csv/, "export"],
    [/setup|onboarding|bootstrap|db_setup/, "setup"], [/update/, "update"], [/settings|app_kv|kv/, "settings"],
];
const domainFromPath = (p) => (PATH_DOMAIN.find(([re]) => re.test(p.toLowerCase())) ?? [null, "app"])[1];

const TECH = /\{e\}|\{\}|\b[a-z]+_[a-z_]+\b|\bsas\b|salt|nonce|pubkey|signature|token|wire|frame|json|decode|base64|utf|keyring|verifier|seat cert|blob|outbox|bind_addr|handshake|metrics|\.v1|bcrypt|hmac|aes|sqlite|kdf|cipher|rekey/i;

function kindFor(entry) {
    const o = OVERRIDES.kinds?.[entry.id];
    if (o) return o;
    if (entry.source === "feature") return "state";
    if (entry.source === "backend-text") {
        if (entry.variant === "Conflict") return "conflict";
        return TECH.test(entry.template) ? "integrity" : "validation";
    }
    if (entry.source === "ui") return /network|fetch|timeout|LAN|reach|offline/i.test(entry.template) ? "connectivity" : "validation";
    // coded keys
    const [, dom, ...rest] = entry.key.split(".");
    const tail = rest.join(".");
    const special = OVERRIDES.codedKinds ?? {};
    if (special[entry.key]) return special[entry.key];
    if (dom === "lan" || dom === "cluster" || dom === "sync") return "connectivity";
    if (dom === "auth" || dom === "license") return "auth";
    if (/signature|invalid_sqlite|invalid_medoc|tamper|integrity/.test(tail)) return "integrity";
    if (dom === "workflow" || /locked|already|no_open|not_running|not_paused|no_paused|no_running|cannot|not_released|closed|expired|derived/.test(tail)) return "state";
    if (/not_found|missing_file/.test(tail)) return "not_found";
    if (/taken|dual_link|duplicate|conflict|overlap/.test(tail)) return "conflict";
    if (/forbidden|not_allowed|permission|role/.test(tail)) return "permission";
    return "validation";
}
const SEVERITY = { validation: "warning", state: "warning", not_found: "warning", conflict: "warning", permission: "error", auth: "error", connectivity: "error", integrity: "error", system: "critical" };
const RETRY = new Set(["connectivity", "system"]);

// ---------- 1. coded keys ----------
const en = JSON.parse(read("packages/shared/locales/en.json"));
const coded = new Map(); // key → { sites: Set }
const addCoded = (key, site) => {
    if (!/^error\.[a-z0-9_]+\.[a-z0-9_.]*[a-z0-9_]$/.test(key)) return;
    if (key.startsWith("error.entity.") || key === "error.boundary.body" || key.startsWith("error.text.")) return;
    if (!coded.has(key)) coded.set(key, new Set());
    if (site) coded.get(key).add(site);
};
for (const k of Object.keys(en)) if (k.startsWith("error.")) addCoded(k, null);
const rustFiles = files("'crates/*.rs' 'apps/practice-host/src/*.rs'").filter((f) => !f.includes("/tests/"));
const tsFiles = files("'packages/*.ts' 'packages/*.tsx' 'apps/practice-host-ui/src/*.ts' 'apps/practice-host-ui/src/*.tsx' 'apps/lan-web-client/src/*.ts' 'apps/lan-web-client/src/*.tsx'")
    .filter((f) => !/\.test\.|\.generated\.|error-catalog\.ts|node_modules/.test(f));
for (const f of [...rustFiles, ...tsFiles]) {
    const s = f.endsWith(".rs") ? stripTests(read(f)) : read(f);
    for (const m of s.matchAll(/["`](error\.[a-z0-9_]+\.[a-z0-9_.]+)/g)) addCoded(m[1].replace(/\.$/, ""), f);
}

// ---------- 2–3. backend text + features ----------
const texts = new Map(); // id → entry
const unescape = (t) => t.replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/\\\\/g, "\\");
for (const f of rustFiles) {
    const s = stripTests(read(f));
    for (const m of s.matchAll(/AppError::(Validation|Conflict|FeatureDisabled)\(\s*(?:format!\(\s*)?"((?:[^"\\]|\\.)*)"/g)) {
        const variant = m[1];
        const template = unescape(m[2]);
        if (template.startsWith("error.")) continue;
        const source = variant === "FeatureDisabled" ? "feature" : "backend-text";
        const id = `${source === "feature" ? "feature" : "text"}:${variant}:${template}`;
        if (!texts.has(id)) texts.set(id, { id, source, variant, template, domain: source === "feature" ? "feature" : domainFromPath(f), sites: new Set() });
        texts.get(id).sites.add(f);
    }
}
// ---------- 4. UI thrown text ----------
for (const f of tsFiles) {
    const s = read(f);
    for (const m of s.matchAll(/throw new Error\(\s*(["`])((?:(?!\1)[^\\]|\\.)*)\1\s*\)/g)) {
        const template = m[2].replace(/\$\{([^}]+)\}/g, "{$1}");
        if (template.startsWith("error.") || template.length < 4) continue;
        const id = `ui:${template}`;
        if (!texts.has(id)) texts.set(id, { id, source: "ui", variant: "Error", template, domain: "ui", sites: new Set() });
        texts.get(id).sites.add(f);
    }
}

// ---------- assign stable codes ----------
const lock = existsSync(LOCK) ? JSON.parse(readFileSync(LOCK, "utf8")) : {};
const used = new Set(Object.values(lock));
const nextCode = (prefix, start) => {
    for (let n = start; n < 1000; n++) {
        const c = `MD-${prefix}-${String(n).padStart(3, "0")}`;
        if (!used.has(c)) { used.add(c); return c; }
    }
    throw new Error(`code space exhausted for ${prefix}`);
};
const entries = [];
for (const key of [...coded.keys()].sort()) {
    const dom = key.split(".")[1];
    const prefix = DOMAIN_PREFIX[dom] ?? "APP";
    const id = key;
    if (!lock[id]) lock[id] = nextCode(prefix, 1);
    entries.push({ id, code: lock[id], key, domain: dom, source: "coded", sites: coded.get(key) });
}
for (const t of [...texts.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const prefix = DOMAIN_PREFIX[t.domain] ?? "APP";
    if (!lock[t.id]) lock[t.id] = nextCode(prefix, t.source === "ui" ? 500 : 100);
    const code = lock[t.id];
    entries.push({ ...t, code, key: t.source === "feature" ? "error.app.feature_disabled" : `error.text.${code.toLowerCase().replace(/-/g, "_")}` });
}
for (const e of entries) {
    e.translated = e.source === "coded" || (e.template != null && TRANSLATIONS[e.template] != null);
    e.kind = kindFor(e);
    e.severity = SEVERITY[e.kind];
    e.retryable = RETRY.has(e.kind);
}

// ---------- write ----------
const esc = (s) => JSON.stringify(s);
const lines = entries.map((e) => {
    const extra = e.source === "coded"
        ? ""
        : `, template: ${esc(e.template)}, origin: ${esc(e.source)}, translated: ${e.translated}${e.source === "feature" ? `, feature: ${esc(e.template)}` : ""}`;
    return `    { code: ${esc(e.code)}, key: ${esc(e.key)}, domain: ${esc(e.domain)}, kind: ${esc(e.kind)}, severity: ${esc(e.severity)}, retryable: ${e.retryable}${extra} },`;
});
const catalog = `/**
 * @generated by scripts/errors/generate-error-catalog.mjs — do not edit by hand.
 * Every error the app can raise, with a stable support code (codes live in config/error-codes.lock.json).
 * ${entries.length} entries: coded keys, backend messages, disabled features and UI errors.
 */
import type { ErrorCatalogEntry } from "./error-types";

export const ERROR_CATALOG: readonly ErrorCatalogEntry[] = [
${lines.join("\n")}
];
`;
const sitesMd = `# Error sites (developer appendix)

> Generated by \`scripts/errors/generate-error-catalog.mjs\`. Where each support code is raised.
> Internal and database failures are not listed per site: they surface as MD-APP-004 / MD-APP-002 with a
> reference that matches the \`INTERNAL_ERROR\` / \`DB_ERROR\` log line.

| Code | Origin | Message / key | Raised in |
|---|---|---|---|
${entries.map((e) => `| \`${e.code}\` | ${e.source} | ${(e.template ?? e.key).replace(/\|/g, "\\|")} | ${[...(e.sites ?? [])].slice(0, 3).map((s) => `\`${s}\``).join("<br>") || "—"} |`).join("\n")}
`;
const lockOut = JSON.stringify(Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n";

let stale = false;
const emit = (p, content) => {
    if (check) {
        if (!existsSync(p) || readFileSync(p, "utf8") !== content) { console.error(`[errors] stale: ${p.replace(root + "/", "")}`); stale = true; }
    } else writeFileSync(p, content);
};
// Locale keys for translated backend / UI messages (`error.text.md_xxx_nnn`).
for (const [li, loc] of LOCALES.entries()) {
    const path = join(root, `packages/shared/locales/${loc}.json`);
    const cat = JSON.parse(readFileSync(path, "utf8"));
    for (const k of Object.keys(cat)) if (k.startsWith("error.text.")) delete cat[k];
    for (const e of entries) {
        if (e.source === "coded" || e.source === "feature" || !e.translated) continue;
        const tr = TRANSLATIONS[e.template];
        cat[e.key] = i18nTemplate(li === 0 ? e.template : tr[li - 1]);
    }
    emit(path, JSON.stringify(cat, null, 2) + "\n");
}
emit(LOCK, lockOut);
emit(OUT, catalog);
emit(SITES, sitesMd);
if (stale) process.exit(1);
const by = (src) => entries.filter((e) => e.source === src).length;
console.log(`[errors] ${entries.length} codes — coded ${by("coded")}, backend ${by("backend-text")}, features ${by("feature")}, ui ${by("ui")}`);
