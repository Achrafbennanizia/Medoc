export * from "./error-types";
export { ERROR_CATALOG } from "./error-catalog";
export { catalogEntryByCode, catalogEntryByKey, errorRawText, extractErrorToken, resolveAppError } from "./error-resolver";
export { clearErrorJournal, codeForMessage, recentErrors, recordError, type JournalEntry } from "./error-journal";

/** i18n keys for the generic manual text of an error kind. */
export function errorKindCauseKey(kind: string): string {
    return `errors.kind.${kind}.cause`;
}
export function errorKindActionKey(kind: string): string {
    return `errors.kind.${kind}.action`;
}
export function errorDomainLabelKey(domain: string): string {
    return `errors.domain.${domain}`;
}
