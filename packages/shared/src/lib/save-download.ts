import { tauriInvoke } from "@/services/tauri.service";
import { isTauriApp } from "./is-tauri-app";
export { isTauriApp } from "./is-tauri-app";

/**
 * What is being exported. Sent with every save so the backend can write the
 * audit entry (kind, format, size, SHA-256) — files leaving the encrypted
 * database must be traceable (§ 630f BGB, Art. 30/32 DSGVO).
 */
export type ExportContext = {
    /** e.g. "chart", "receipt", "certificate", "patients_csv", "report:statistics" */
    kind: string;
    format: "pdf" | "csv" | "json" | "xml" | "zip" | "html";
    entityId?: string | null;
    documentNumber?: string | null;
};

function triggerBrowserDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/** Base64-encode binary for `save_export_file` (IPC). */
export function uint8ToBase64(bytes: Uint8Array): string {
    const chunk = 0x8000;
    const parts: string[] = [];
    for (let i = 0; i < bytes.length; i += chunk) {
        parts.push(String.fromCharCode(...bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(""));
}

/**
 * Desktop: opens "Save as…" and writes the file. Browser / plain Vite: `<a download>`.
 * @returns `true` if a file was written or browser download triggered; `false` if the user cancelled the save dialog (desktop only).
 */
export async function saveOrDownloadBytes(
    filename: string,
    bytes: Uint8Array,
    mime = "application/octet-stream",
    context?: ExportContext,
): Promise<boolean> {
    if (!isTauriApp()) {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        triggerBrowserDownload(new Blob([copy], { type: mime }), filename);
        return true;
    }
    const path = await tauriInvoke<string | null>("save_export_file", {
        defaultFileName: filename,
        contentsBase64: uint8ToBase64(bytes),
        context: context ?? null,
    });
    return path != null;
}

export async function saveOrDownloadText(
    filename: string,
    text: string,
    mime?: string,
    context?: ExportContext,
): Promise<boolean> {
    return saveOrDownloadBytes(filename, new TextEncoder().encode(text), mime ?? "text/plain;charset=utf-8", context);
}

/** `number[]` from Tauri byte responses (e.g. audit CSV). */
export async function saveOrDownloadNumberBytes(
    filename: string,
    bytes: number[],
    mime = "application/octet-stream",
    context?: ExportContext,
): Promise<boolean> {
    return saveOrDownloadBytes(filename, new Uint8Array(bytes), mime, context);
}
