/** Tauri window chrome — keep `@tauri-apps/api/window` out of views. */

async function currentWindow() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
}

export async function setDesktopWindowTitle(title: string): Promise<void> {
    try {
        await (await currentWindow()).setTitle(title);
    } catch {
        /* browser / tests */
    }
}

export async function minimizeDesktopWindow(): Promise<void> {
    try {
        await (await currentWindow()).minimize();
    } catch {
        /* noop */
    }
}

export async function toggleDesktopWindowMaximize(): Promise<boolean | null> {
    try {
        const w = await currentWindow();
        await w.toggleMaximize();
        return await w.isMaximized();
    } catch {
        return null;
    }
}

export async function closeDesktopWindow(): Promise<void> {
    try {
        await (await currentWindow()).close();
    } catch {
        /* noop */
    }
}

/** Subscribe to maximize state in frameless mode. Returns cleanup when resize listener is active. */
export function subscribeDesktopWindowMaximized(onChange: (maximized: boolean) => void): () => void {
    let cancelled = false;
    let unlistenResize: (() => void) | undefined;

    void (async () => {
        try {
            const w = await currentWindow();
            if (cancelled) return;
            onChange(await w.isMaximized());
            unlistenResize = await w.onResized(() => {
                void w.isMaximized().then(onChange);
            });
        } catch {
            /* API unavailable (e.g. tests) */
        }
    })();

    return () => {
        cancelled = true;
        unlistenResize?.();
    };
}
