#!/usr/bin/env node
/**
 * Generates the user manuals from the same sources the app renders, so docs cannot drift from the UI:
 *   docs/manual/error-codes.<locale>.md   ← packages/shared/src/lib/errors/error-catalog.ts + locales
 *   docs/manual/status-guide.<locale>.md  ← packages/shared/src/lib/status/status-registry.ts + locales
 * Usage: node scripts/generate-manuals.mjs [--check]   (--check fails when committed files are stale)
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ERROR_CATALOG } = await import(join(root, "packages/shared/src/lib/errors/error-catalog.ts"));
const { STATUS_REGISTRY, STATUS_ENTITY_IDS } = await import(join(root, "packages/shared/src/lib/status/status-registry.ts"));
const LOCALES = ["en", "de", "fr", "ar"];
const outDir = join(root, "docs/manual");
const check = process.argv.includes("--check");
let stale = false;

const HEAD = {
    en: { tech: "technical check, shown in English", allows: "The app allows", locked: "Locked", derived: "Set automatically by the app", err: "MeDoc error code manual", st: "MeDoc status guide", gen: "Generated — do not edit. Run `node scripts/generate-manuals.mjs`.", code: "Code", msg: "Message", why: "Why it happens", what: "What to do", sev: "Severity", retry: "Retrying can help", status: "Status", meaning: "Meaning", phase: "Phase", next: "Can change to", final: "Final", flags: "Flags (not statuses)", starts: "Starts as" },
    de: { tech: "technische Prüfung, Anzeige auf Englisch", allows: "Die App erlaubt", locked: "Gesperrt", derived: "Wird von der App automatisch gesetzt", err: "MeDoc-Fehlercode-Handbuch", st: "MeDoc-Statusleitfaden", gen: "Generiert — nicht bearbeiten. `node scripts/generate-manuals.mjs` ausführen.", code: "Code", msg: "Meldung", why: "Warum es auftritt", what: "Was tun", sev: "Schweregrad", retry: "Erneuter Versuch kann helfen", status: "Status", meaning: "Bedeutung", phase: "Phase", next: "Kann wechseln zu", final: "Endgültig", flags: "Markierungen (kein Status)", starts: "Beginnt als" },
    fr: { tech: "contrôle technique, affiché en anglais", allows: "L'application permet", locked: "Verrouillé", derived: "Défini automatiquement par l'application", err: "Manuel des codes d'erreur MeDoc", st: "Guide des statuts MeDoc", gen: "Généré — ne pas modifier. Exécuter `node scripts/generate-manuals.mjs`.", code: "Code", msg: "Message", why: "Pourquoi", what: "Que faire", sev: "Gravité", retry: "Réessayer peut aider", status: "Statut", meaning: "Signification", phase: "Phase", next: "Peut passer à", final: "Définitif", flags: "Indicateurs (pas des statuts)", starts: "Commence par" },
    ar: { tech: "فحص تقني، يُعرض بالإنجليزية", allows: "يسمح التطبيق بـ", locked: "مقفل", derived: "يضبطه التطبيق تلقائيًا", err: "دليل رموز أخطاء MeDoc", st: "دليل حالات MeDoc", gen: "مُولَّد تلقائيًا — لا تعدّله. شغّل `node scripts/generate-manuals.mjs`.", code: "الرمز", msg: "الرسالة", why: "السبب", what: "ما العمل", sev: "الخطورة", retry: "قد تفيد إعادة المحاولة", status: "الحالة", meaning: "المعنى", phase: "المرحلة", next: "يمكن أن تتحول إلى", final: "نهائي", flags: "مؤشرات (ليست حالات)", starts: "تبدأ بـ" },
};

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\{\w+\}/g, "…").replace(/\n/g, " ");

function write(file, content) {
    const p = join(outDir, file);
    if (check) {
        if (!existsSync(p) || readFileSync(p, "utf8") !== content) {
            console.error(`[manuals] stale: docs/manual/${file}`);
            stale = true;
        }
        return;
    }
    writeFileSync(p, content);
}

mkdirSync(outDir, { recursive: true });
for (const loc of LOCALES) {
    const T = JSON.parse(readFileSync(join(root, `packages/shared/locales/${loc}.json`), "utf8"));
    const tr = (k) => T[k] ?? k;
    const list = (xs) => xs.join(loc === "ar" ? "، " : ", ");
    const h = HEAD[loc];

    let md = `# ${h.err}\n\n> ${h.gen}\n\n${tr("help.errors.intro")}\n`;
    const domains = [...new Set(ERROR_CATALOG.map((e) => e.domain))].sort();
    for (const d of domains) {
        md += `\n## ${tr(`errors.domain.${d}`)}\n\n| ${h.code} | ${h.msg} | ${h.sev} | ${h.why} | ${h.what} |\n|---|---|---|---|---|\n`;
        for (const e of ERROR_CATALOG.filter((x) => x.domain === d)) {
            const sev = tr(`errors.severity.${e.severity}`) + (e.retryable ? ` · ${h.retry}` : "");
            const msg = e.origin === "feature"
                ? tr("error.app.feature_disabled").replace("{feature}", tr(`errors.feature.${e.feature}`))
                : e.origin && !e.translated
                  ? `${e.template} _(${h.tech})_`
                  : tr(e.key);
            md += `| \`${e.code}\` | ${cell(msg)} | ${cell(sev)} | ${cell(tr(`errors.kind.${e.kind}.cause`))} | ${cell(tr(`errors.kind.${e.kind}.action`))} |\n`;
        }
    }
    write(`error-codes.${loc}.md`, md);

    let st = `# ${h.st}\n\n> ${h.gen}\n\n${tr("help.statuses.intro")}\n`;
    for (const id of STATUS_ENTITY_IDS) {
        const ent = STATUS_REGISTRY[id];
        const label = (w) => tr(`status.${id}.${w.toLowerCase()}.label`);
        st += `\n## ${tr(`status.entity.${id}`)}\n\n${h.starts}: **${label(ent.initial)}** · \`${ent.source}\`${ent.derived ? ` · _${h.derived}_` : ""}\n\n| ${h.status} | ${h.meaning} | ${h.phase} | ${h.next} | ${h.allows} |\n|---|---|---|---|---|\n`;
        for (const s of ent.states) {
            const next = s.terminal ? h.final : list(s.next.map(label));
            const can = s.can.length ? list(s.can.map((c) => tr(`status.capability.${c}`))) : h.locked;
            st += `| **${label(s.wire)}** (\`${s.wire}\`) | ${cell(tr(`status.${id}.${s.wire.toLowerCase()}.description`))} | ${tr(`status.phase.${s.phase}`)} | ${cell(next)} | ${cell(can)} |\n`;
        }
        if (ent.flags?.length) st += `\n${h.flags}: ${ent.flags.map((f) => tr(`status.${id}.flag.${f}`)).join(" · ")}\n`;
    }
    write(`status-guide.${loc}.md`, st);
}
if (check && stale) process.exit(1);
console.log(check ? "[manuals] up to date" : `[manuals] wrote ${LOCALES.length * 2} files to docs/manual/`);
