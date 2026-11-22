/** True when running inside the Tauri desktop shell (not Vite dev in an external browser). */
export function isTauriApp(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
