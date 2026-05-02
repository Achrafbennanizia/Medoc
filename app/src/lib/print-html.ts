/**
 * Print HTML without relying on `window.open` (often blocked or ineffective in Tauri WebView).
 */
export function printHtmlDocument(html: string): void {
    if (typeof document === "undefined") return;
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    const win = iframe.contentWindow;
    const cleanup = () => {
        try {
            iframe.remove();
        } catch {
            /* ignore */
        }
    };
    if (!doc || !win) {
        cleanup();
        return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const runPrint = () => {
        try {
            win.focus();
            win.print();
        } finally {
            window.setTimeout(cleanup, 800);
        }
    };
    window.requestAnimationFrame(() => {
        window.setTimeout(runPrint, 0);
    });
}
