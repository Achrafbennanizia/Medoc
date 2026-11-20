/**
 * Error model shared by every MeDoc surface (desktop host, LAN client, web client).
 *
 * Wire format (backend → UI, unchanged for compatibility): `error.<domain>.<name>[|param=value…]`.
 * The UI resolves that token against {@link ERROR_CATALOG} to get a stable support code
 * (`MD-<DOMAIN>-<NNN>`), a kind (what went wrong), a severity (how bad) and whether retrying can help.
 */

/** What category of problem — drives the generic "cause" and "what to do" text in the error manual. */
export type ErrorKind =
    | "validation"
    | "state"
    | "not_found"
    | "conflict"
    | "permission"
    | "auth"
    | "connectivity"
    | "integrity"
    | "system";

export const ERROR_KINDS: readonly ErrorKind[] = [
    "validation",
    "state",
    "not_found",
    "conflict",
    "permission",
    "auth",
    "connectivity",
    "integrity",
    "system",
];

export type ErrorSeverity = "warning" | "error" | "critical";

export type ErrorCatalogEntry = {
    /** Stable support code, e.g. `MD-PAY-004`. Never reused. */
    readonly code: string;
    /** i18n key == wire token, e.g. `error.payment.amount_invalid`. */
    readonly key: string;
    /** Second segment of the key (`payment`). */
    readonly domain: string;
    readonly kind: ErrorKind;
    readonly severity: ErrorSeverity;
    /** Retrying the same action can succeed without changing input (network, transient system errors). */
    readonly retryable: boolean;
};

/** Fully resolved error ready for display. */
export type AppErrorInfo = {
    /** Catalog entry, or the synthetic `MD-APP-UNK` entry for uncoded messages. */
    readonly entry: ErrorCatalogEntry;
    /** Localised, parameter-substituted message. */
    readonly message: string;
    readonly params: Readonly<Record<string, string>>;
    /** Original raw text (never shown to end users for system errors; kept for logs / copy-to-support). */
    readonly raw: string;
    /** Backend correlation id when provided (`|ref=…`). */
    readonly ref?: string;
};
