/**
 * Escape text for HTML or XML (print templates, exports, previews). Also escapes `'`, which is valid in
 * both, so one function serves every export format.
 */
export function escapeHtml(raw: string): string {
    return raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
