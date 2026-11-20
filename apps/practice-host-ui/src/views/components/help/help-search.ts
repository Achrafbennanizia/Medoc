/** Case- and accent-insensitive match used by every help section. */
export function normalizeForSearch(s: string): string {
    return s
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
}

export function matchesQuery(query: string, ...fields: (string | undefined | null)[]): boolean {
    const q = normalizeForSearch(query.trim());
    if (!q) return true;
    const hay = normalizeForSearch(fields.filter(Boolean).join(" "));
    return q.split(/\s+/).every((part) => hay.includes(part));
}

export type HelpSectionProps = { query: string };
