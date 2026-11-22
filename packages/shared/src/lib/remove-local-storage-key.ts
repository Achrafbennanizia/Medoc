/** Remove one browser-storage key; ignores missing storage (tests, private windows, blocked site data). */
export function removeLocalStorageKey(key: string): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        /* storage unavailable */
    }
}
