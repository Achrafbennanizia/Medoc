/** Parse / stringify delimiter-separated text for export preview & re-export after sorting. */

import { collatorLocale, useLocale } from "./i18n";
import { parseEuroInput } from "./utils";

/**
 * Neutralise spreadsheet formula injection (OWASP "CSV injection"): a cell
 * that starts with = + - @ TAB or CR is prefixed with an apostrophe so Excel /
 * LibreOffice treat it as text. Apply to every exported cell.
 */
export function csvSafeCell(raw: string): string {
    return /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
}

/** RFC 4180 quoting + formula neutralisation. */
export function csvCell(raw: string, delimiter: string): string {
    const v = csvSafeCell(raw);
    if (v.includes(delimiter) || v.includes('"') || v.includes("\n") || v.includes("\r")) {
        return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
}

export function stripBom(text: string): string {
    return text.replace(/^\uFEFF/, "");
}

export function detectDelimiter(firstLine: string): ";" | "," {
    const sc = (firstLine.match(/;/g) || []).length;
    const cc = (firstLine.match(/,/g) || []).length;
    return sc >= cc ? ";" : ",";
}

function parseLine(line: string, delim: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i]!;
        if (inQuotes) {
            if (c === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === delim) {
            out.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    out.push(cur);
    return out;
}

export function parseDelimitedGrid(text: string, delimiter?: ";" | ","): { rows: string[][]; delimiter: ";" | "," } {
    const raw = stripBom(text);
    const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
    if (lines.length === 0) {
        return { rows: [], delimiter: ";" };
    }
    const delim = delimiter ?? detectDelimiter(lines[0]!);
    return {
        rows: lines.map((line) => parseLine(line, delim)),
        delimiter: delim,
    };
}

export function stringifyDelimitedGrid(rows: string[][], delimiter: string): string {
    return `\uFEFF${rows.map((r) => r.map((c) => csvCell(c, delimiter)).join(delimiter)).join("\r\n")}`;
}

export function sortGridRows(rows: string[][], columnIndex: number, direction: "asc" | "desc"): string[][] {
    if (rows.length <= 1) return rows;
    const header = rows[0]!;
    const body = rows.slice(1);
    const mult = direction === "asc" ? 1 : -1;
    const sorted = [...body].sort((a, b) => {
        const va = a[columnIndex] ?? "";
        const vb = b[columnIndex] ?? "";
        const sa = String(va).trim();
        const sb = String(vb).trim();
        const na = parseEuroInput(sa);
        const nb = parseEuroInput(sb);
        const bothNumeric = na != null && nb != null;
        if (bothNumeric && na !== nb) return mult * (na - nb);
        return mult * String(va).localeCompare(String(vb), collatorLocale(useLocale.getState().locale), { numeric: true, sensitivity: "base" });
    });
    return [header, ...sorted];
}
