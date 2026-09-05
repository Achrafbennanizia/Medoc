/**
 * Shared list/pagination helpers for large entity screens (finance, patients, appointments).
 * Prefer paged IPC when totals can exceed ~500 rows.
 */

import type { ListParams, ListResponse } from "@/lib/list-params";

/** Default chunk size for infinite / load-more lists. */
export const LAZY_PAGE_SIZE = 100;

/** Soft threshold: pages that can exceed this should use paged APIs. */
export const LAZY_LOAD_ENTITY_THRESHOLD = 500;

export function hasMorePages(resp: Pick<ListResponse<unknown>, "page" | "pageSize" | "total">): boolean {
    return resp.page * resp.pageSize < resp.total;
}

export function nextListPageParams(
    current: ListParams | undefined,
    nextPage: number,
    pageSize: number = LAZY_PAGE_SIZE,
): ListParams {
    return {
        ...current,
        page: nextPage,
        pageSize,
    };
}

/** Merge unique rows by `id` (or custom key), preserving first-seen order then append. */
export function mergeUniqueById<T extends { id: string }>(prev: T[], next: T[]): T[] {
    if (prev.length === 0) return next;
    const seen = new Set(prev.map((r) => r.id));
    const out = prev.slice();
    for (const row of next) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
    }
    return out;
}
