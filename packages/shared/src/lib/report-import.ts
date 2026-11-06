import {
    exportReportBundle,
    reportBundleToJson,
    type ReportBundle,
    type ReportExportFormat,
    type ReportSection,
    type ReportSummaryRow,
} from "@/lib/report-export";
import { openExportPreview } from "@/models/store/export-preview-store";
import { translateLocale, useLocale } from "@/lib/i18n";

function isSummaryRow(version: unknown): version is ReportSummaryRow {
    return (
        typeof version === "object" &&
        version != null &&
        typeof (version as ReportSummaryRow).label === "string" &&
        typeof (version as ReportSummaryRow).value === "string"
    );
}

function isSection(version: unknown): version is ReportSection {
    if (typeof version !== "object" || version == null) return false;
    const s = version as ReportSection;
    return (
        typeof s.title === "string" &&
        Array.isArray(s.headers) &&
        s.headers.every((h) => typeof h === "string") &&
        Array.isArray(s.rows) &&
        s.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))
    );
}

/** Parse exported MeDoc report JSON (version 1) back into a bundle for re-export or preview. */
export function parseReportBundleJson(text: string): ReportBundle {
    const j = JSON.parse(text) as {
        version?: number;
        docTitle?: string;
        generatedAt?: string;
        summary?: unknown[];
        sections?: unknown[];
    };
    if (j.version !== 1) {
        throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_bad_version"));
    }
    if (!j.docTitle?.trim()) throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_missing_title"));
    const summary = (j.summary ?? []).filter(isSummaryRow);
    const sections = (j.sections ?? []).filter(isSection);
    const base = j.docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    return {
        docTitle: j.docTitle,
        exportTitle: translateLocale(useLocale.getState().locale, "export.report.import_title"),
        hint: translateLocale(useLocale.getState().locale, "export.report.import_hint_json"),
        suggestedBasename: `medoc-import-${base || "report"}`,
        generatedAt: j.generatedAt ?? new Date().toLocaleDateString("de-DE"),
        summary,
        sections,
    };
}

/** Parse exported MeDoc report XML back into a bundle. */
export function parseReportBundleXml(text: string): ReportBundle {
    if (typeof DOMParser !== "undefined") {
        return parseReportBundleXmlDom(text);
    }
    return parseReportBundleXmlRegex(text);
}

function parseReportBundleXmlDom(text: string): ReportBundle {
    const doc = new DOMParser().parseFromString(text, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_invalid_xml"));
    const root = doc.documentElement;
    if (root.tagName !== "medocReport") throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_bad_root"));
    const docTitle = root.getAttribute("title")?.trim();
    if (!docTitle) throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_missing_title_attr"));
    const generatedAt = root.getAttribute("generatedAt")?.trim() ?? new Date().toLocaleDateString("de-DE");

    const summary: ReportSummaryRow[] = [];
    for (const row of root.querySelectorAll("summary > row")) {
        summary.push({
            label: row.getAttribute("label") ?? "",
            value: row.getAttribute("value") ?? "",
        });
    }

    const sections: ReportSection[] = [];
    for (const secEl of root.querySelectorAll(":scope > section")) {
        const title = secEl.getAttribute("title") ?? "Abschnitt";
        const headers = Array.from(secEl.querySelectorAll("headers > col")).map((c) => c.textContent ?? "");
        const rows = Array.from(secEl.querySelectorAll("rows > row")).map((rowEl) =>
            Array.from(rowEl.querySelectorAll("cell")).map((c) => c.textContent ?? ""),
        );
        sections.push({ title, headers, rows });
    }

    return finalizeImportedBundle(docTitle, generatedAt, summary, sections);
}

function xmlUnescape(s: string): string {
    return s
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}

/** Node/vitest fallback — sufficient for our deterministic export format. */
function parseReportBundleXmlRegex(text: string): ReportBundle {
    const rootMatch = text.match(/<medocReport[^>]*title="([^"]*)"[^>]*generatedAt="([^"]*)"/);
    if (!rootMatch) throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_bad_root"));
    const docTitle = xmlUnescape(rootMatch[1] ?? "");
    const generatedAt = xmlUnescape(rootMatch[2] ?? new Date().toLocaleDateString("de-DE"));
    const summary: ReportSummaryRow[] = [];
    for (const m of text.matchAll(/<row label="([^"]*)" value="([^"]*)"\s*\/>/g)) {
        summary.push({ label: xmlUnescape(m[1] ?? ""), value: xmlUnescape(m[2] ?? "") });
    }
    const sections: ReportSection[] = [];
    for (const sec of text.matchAll(/<section title="([^"]*)">([\s\S]*?)<\/section>/g)) {
        const title = xmlUnescape(sec[1] ?? "Abschnitt");
        const body = sec[2] ?? "";
        const headers = [...body.matchAll(/<col>([\s\S]*?)<\/col>/g)].map((m) => xmlUnescape(m[1] ?? ""));
        const rows = [...body.matchAll(/<row>([\s\S]*?)<\/row>/g)].map((rowMatch) =>
            [...(rowMatch[1] ?? "").matchAll(/<cell>([\s\S]*?)<\/cell>/g)].map((c) => xmlUnescape(c[1] ?? "")),
        );
        sections.push({ title, headers, rows });
    }
    return finalizeImportedBundle(docTitle, generatedAt, summary, sections);
}

function finalizeImportedBundle(
    docTitle: string,
    generatedAt: string,
    summary: ReportSummaryRow[],
    sections: ReportSection[],
): ReportBundle {
    const base = docTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    return {
        docTitle,
        exportTitle: translateLocale(useLocale.getState().locale, "export.report.import_title"),
        hint: translateLocale(useLocale.getState().locale, "export.report.import_hint"),
        suggestedBasename: `medoc-import-${base || "report"}`,
        generatedAt,
        summary,
        sections,
    };
}

export async function parseReportFile(file: File): Promise<ReportBundle> {
    const text = await file.text();
    const name = file.name.toLowerCase();
    if (name.endsWith(".xml")) return parseReportBundleXml(text);
    if (name.endsWith(".json")) return parseReportBundleJson(text);
    throw new Error(translateLocale(useLocale.getState().locale, "export.report.import_unsupported"));
}

/** Import → preview (JSON display) or direct re-export. */
export async function importReportAndPreview(file: File, previewFormat: ReportExportFormat = "json"): Promise<void> {
    const bundle = await parseReportFile(file);
    if (previewFormat === "json") {
        openExportPreview({
            format: "json",
            title: bundle.exportTitle,
            hint: bundle.hint,
            suggestedFilename: `${bundle.suggestedBasename}.json`,
            textBody: reportBundleToJson(bundle),
        });
        return;
    }
    await exportReportBundle(bundle, previewFormat);
}
