/**
 * Shared list/pagination/sort/filter shape for backend `list_*` commands.
 *
 * Tauri v2 transforms snake_case Rust arg names to camelCase at the IPC boundary.
 * This module defines the canonical FE-side TypeScript contract; matching Rust
 * structs live in `app/src-tauri/src/commands/list_params.rs`.
 */

export interface ListParams {
    /** 1-based page index (default 1). */
    page?: number;
    /** Page size, capped server-side at 200 (default 50). */
    pageSize?: number;
    /** Optional free-text search (server decides which columns to match). */
    search?: string;
    /** Field name to sort on (whitelisted server-side). */
    sortBy?: string;
    /** Sort direction. */
    sortDir?: "asc" | "desc";
    /** Optional, command-specific filter (e.g. status = "AKTIV"). Always typed. */
    filter?: Record<string, string | number | boolean | null>;
}

export interface ListResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

/** Helper to compute total pages for UI pagination. */
export function totalPages<T>(resp: ListResponse<T>): number {
    if (resp.pageSize <= 0) return 1;
    return Math.max(1, Math.ceil(resp.total / resp.pageSize));
}
