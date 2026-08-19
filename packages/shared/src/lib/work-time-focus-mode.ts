/** Broadcast when WorkTime „Fokusmodus“ toggles so the shell sidebar updates immediately. */
export const WORK_TIME_FOCUS_MODE_EVENT = "medoc-work-time-focus-mode";

export function dispatchWorkTimeFocusMode(focusMode: boolean): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(WORK_TIME_FOCUS_MODE_EVENT, { detail: focusMode }));
}

export function subscribeWorkTimeFocusMode(onChange: (focusMode: boolean) => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (e: Event) => {
        const detail = (e as CustomEvent<boolean>).detail;
        if (typeof detail === "boolean") onChange(detail);
    };
    window.addEventListener(WORK_TIME_FOCUS_MODE_EVENT, handler);
    return () => window.removeEventListener(WORK_TIME_FOCUS_MODE_EVENT, handler);
}
