import { PRACTICE_FIELD_OPTIONS, type PracticeFieldKey } from "./document-template-schema";

/** Saved PDF letterhead order. Missing key keeps the official default. */
export const DOCUMENT_HEADER_LAYOUT_KV_KEY = "documents.header_layout.v1" as const;

/**
 * Official letterhead order used when nothing has been saved.
 * Keep in step with `DEFAULT_HEADER_FIELDS` in `practice_profile.rs`.
 */
export const DEFAULT_PDF_HEADER_FIELDS: PracticeFieldKey[] = [
    "name",
    "address",
    "phone",
    "fax",
    "email",
    "web",
    "bsnr",
    "zanr",
];

/** Country of the practice: decides which ids and legal lines its documents carry. */
export type PracticeCountry = "MA" | "DE" | "FR" | "EU";
export const PRACTICE_COUNTRIES: PracticeCountry[] = ["MA", "FR", "DE", "EU"];

/** German practitioner / practice numbers. Printed on German documents only. */
export const GERMAN_ONLY_HEADER_FIELDS: PracticeFieldKey[] = ["zanr", "bsnr", "kv", "kzv", "tax"];

/**
 * The practice's country: the one chosen in Settings, else Morocco for a dirham practice,
 * else Germany (how practices set up before the country existed were printed).
 * Keep in step with `uses_german_ids` / `is_morocco` in `practice_profile.rs`.
 */
export function practiceCountry(practice: { country?: unknown; currency?: unknown } | null | undefined): PracticeCountry {
    const c = typeof practice?.country === "string" ? practice.country.trim().toUpperCase() : "";
    if (c === "MA" || c === "DE" || c === "FR" || c === "EU") return c;
    const cur = typeof practice?.currency === "string" ? practice.currency.trim().toUpperCase() : "";
    return cur === "MAD" ? "MA" : "DE";
}

/** Whether a header field belongs on this country's documents. */
export function headerFieldAllowed(id: PracticeFieldKey, country: PracticeCountry): boolean {
    if (GERMAN_ONLY_HEADER_FIELDS.includes(id)) return country === "DE";
    if (id === "ma_ids") return country === "MA";
    if (id === "fr_ids") return country === "FR";
    return true;
}

/** Official default letterhead for a country. Keep in step with `DEFAULT_HEADER_FIELDS*` in Rust. */
export function defaultPdfHeaderFields(country: PracticeCountry): PracticeFieldKey[] {
    const base: PracticeFieldKey[] = ["name", "address", "phone", "fax", "email", "web"];
    if (country === "DE") return DEFAULT_PDF_HEADER_FIELDS;
    if (country === "MA") return [...base, "ma_ids"];
    if (country === "FR") return [...base, "fr_ids"];
    return base;
}

/** Clinician identity. The rest of the catalog is practice information. */
export const DOCTOR_HEADER_FIELDS: PracticeFieldKey[] = ["clinician", "zanr"];

const HEADER_FIELD_SET = new Set<string>(PRACTICE_FIELD_OPTIONS.map((option) => option.id));

export const PRACTICE_HEADER_FIELDS: PracticeFieldKey[] = PRACTICE_FIELD_OPTIONS.map(
    (option) => option.id,
).filter((id) => !DOCTOR_HEADER_FIELDS.includes(id));

export function isHeaderField(id: string): id is PracticeFieldKey {
    return HEADER_FIELD_SET.has(id);
}

/** `null` when nothing is stored. An empty list is a stored layout with no fields. */
export function parseHeaderLayout(raw: string | null | undefined): PracticeFieldKey[] | null {
    if (raw == null || raw.trim() === "") return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    const fields = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { fields?: unknown }).fields)
          ? (parsed as { fields: unknown[] }).fields
          : null;
    if (!fields) return null;
    const out: PracticeFieldKey[] = [];
    for (const item of fields) {
        if (typeof item === "string" && isHeaderField(item) && !out.includes(item)) {
            out.push(item);
        }
    }
    return out;
}

export function headerLayoutJson(fields: PracticeFieldKey[]): string {
    return JSON.stringify({ fields });
}

/** Header table: two columns, six rows, growing to eight when those are filled. */
export const HEADER_TABLE_COLUMNS = 2;
export const HEADER_TABLE_MIN_ROWS = 6;
export const HEADER_TABLE_MAX_ROWS = 8;

export type HeaderCell = PracticeFieldKey | null;
/** Always `HEADER_TABLE_MAX_ROWS` rows of two cells. Empty cells are `null`. */
export type HeaderTable = HeaderCell[][];

export function emptyHeaderTable(): HeaderTable {
    return Array.from({ length: HEADER_TABLE_MAX_ROWS }, () => [null, null]);
}

/** Pack a flat field list into the table, left to right, top to bottom. */
export function tableFromFieldList(fields: PracticeFieldKey[]): HeaderTable {
    const table = emptyHeaderTable();
    for (let index = 0; index < fields.length && index < HEADER_TABLE_COLUMNS * HEADER_TABLE_MAX_ROWS; index += 1) {
        const row = Math.floor(index / HEADER_TABLE_COLUMNS);
        const col = index % HEADER_TABLE_COLUMNS;
        table[row][col] = fields[index];
    }
    return table;
}

export function defaultHeaderTable(country: PracticeCountry = "DE"): HeaderTable {
    return tableFromFieldList(defaultPdfHeaderFields(country));
}

/**
 * Rows shown in the designer. At least six, and one spare row after the last
 * filled row, up to eight.
 */
export function headerTableRowCount(table: HeaderTable): number {
    let last = 0;
    table.forEach((row, index) => {
        if (row[0] || row[1]) last = index + 1;
    });
    if (last >= HEADER_TABLE_MIN_ROWS && last < HEADER_TABLE_MAX_ROWS) return last + 1;
    return Math.min(HEADER_TABLE_MAX_ROWS, Math.max(HEADER_TABLE_MIN_ROWS, last));
}

/** `null` when nothing is stored. A `rows` table may contain empty cells. */
export function parseHeaderTable(raw: string | null | undefined): HeaderTable | null {
    if (raw == null || raw.trim() === "") return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        const fields = parseHeaderLayout(raw);
        return fields ? tableFromFieldList(fields) : null;
    }
    const rows = (parsed as { rows?: unknown }).rows;
    if (!Array.isArray(rows)) {
        const fields = parseHeaderLayout(raw);
        return fields ? tableFromFieldList(fields) : null;
    }
    const table = emptyHeaderTable();
    const seen = new Set<string>();
    rows.slice(0, HEADER_TABLE_MAX_ROWS).forEach((row, rowIndex) => {
        if (!Array.isArray(row)) return;
        for (let col = 0; col < HEADER_TABLE_COLUMNS; col += 1) {
            const id = row[col];
            if (typeof id === "string" && isHeaderField(id) && !seen.has(id)) {
                table[rowIndex][col] = id;
                seen.add(id);
            }
        }
    });
    return table;
}

/** Drop empty rows after the last placed field. Holes inside the table stay. */
export function headerTableJson(table: HeaderTable): string {
    let last = -1;
    table.forEach((row, index) => {
        if (row[0] || row[1]) last = index;
    });
    const rows = table.slice(0, last + 1).map((row) => [row[0], row[1]]);
    return JSON.stringify({ rows });
}

export function tableHasField(table: HeaderTable): boolean {
    return table.some((row) => row[0] || row[1]);
}

/** Put `id` in the cell, moving it off its old cell. An occupied cell swaps. */
export function placeHeaderField(table: HeaderTable, id: PracticeFieldKey, row: number, col: number): HeaderTable {
    if (row < 0 || row >= table.length || col < 0 || col >= HEADER_TABLE_COLUMNS) return table;
    const next = table.map((cells) => [cells[0], cells[1]] as HeaderCell[]);
    let fromRow = -1;
    let fromCol = -1;
    for (let r = 0; r < next.length; r += 1) {
        for (let c = 0; c < HEADER_TABLE_COLUMNS; c += 1) {
            if (next[r][c] === id) {
                fromRow = r;
                fromCol = c;
            }
        }
    }
    const displaced = next[row][col];
    next[row][col] = id;
    if (fromRow >= 0 && (fromRow !== row || fromCol !== col)) {
        next[fromRow][fromCol] = displaced === id ? null : displaced;
    }
    return next;
}

export function clearHeaderCell(table: HeaderTable, row: number, col: number): HeaderTable {
    if (row < 0 || row >= table.length || col < 0 || col >= HEADER_TABLE_COLUMNS) return table;
    const next = table.map((cells) => [cells[0], cells[1]] as HeaderCell[]);
    next[row][col] = null;
    return next;
}

export function firstEmptyHeaderCell(table: HeaderTable): { row: number; col: number } | null {
    const shown = headerTableRowCount(table);
    for (let row = 0; row < shown; row += 1) {
        for (let col = 0; col < HEADER_TABLE_COLUMNS; col += 1) {
            if (!table[row][col]) return { row, col };
        }
    }
    if (shown < HEADER_TABLE_MAX_ROWS) return { row: shown, col: 0 };
    return null;
}

/** Insert `id` at `at`, moving it when it is already on the header. */
export function insertHeaderField(
    fields: PracticeFieldKey[],
    id: PracticeFieldKey,
    at: number,
): PracticeFieldKey[] {
    const without = fields.filter((field) => field !== id);
    const index = Math.max(0, Math.min(at, without.length));
    without.splice(index, 0, id);
    return without;
}

/** Move the block at `from` so it sits at `to` (index before the move). */
export function moveHeaderField(fields: PracticeFieldKey[], from: number, to: number): PracticeFieldKey[] {
    if (from < 0 || from >= fields.length || from === to) return fields;
    const next = fields.slice();
    const [item] = next.splice(from, 1);
    const dest = Math.max(0, Math.min(from < to ? to - 1 : to, next.length));
    next.splice(dest, 0, item);
    return next;
}
