/** Persistierte Akten-Anlagen (Datei auf Disk) + Vorschau über `convertFileSrc` in Tauri. */

import { convertFileSrc } from "@tauri-apps/api/core";

export const ANLAGE_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".dcm", ".tif", ".tiff"];

const ALLOWED_MIME = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/bmp",
    "image/tiff",
    "application/dicom",
    "application/octet-stream",
]);

export type AkteAnlage = {
    id: string;
    name: string;
    addedAt: string;
    mimeType: string;
    sizeBytes: number;
    /** Vorschau-URL (`blob:` vor dem Speichern oder `convertFileSrc` nach dem Speichern) */
    previewUrl: string;
    /** Nur nach Persistenz: absoluter Pfad auf dem Gerät (Tauri) */
    absPath?: string;
};

export function anlageInputAccept(): string {
    return ".pdf,.jpg,.jpeg,.png,.webp,.dcm,.tif,.tiff,application/pdf,image/*";
}

export function validateAnlageFile(file: File): string | null {
    if (file.size > ANLAGE_MAX_BYTES) {
        return "Datei zu groß (max. 50 MB).";
    }
    const lower = file.name.toLowerCase();
    const okExt = ALLOWED_EXT.some((e) => lower.endsWith(e));
    const okMime = !file.type || ALLOWED_MIME.has(file.type);
    if (!okExt && !okMime) {
        return "Nur PDF, JPG, PNG, DCM und ähnliche Bildformate erlaubt.";
    }
    return null;
}

export function anlageBadgeExt(name: string, mime: string): string {
    const lower = name.toLowerCase();
    if (lower.endsWith(".pdf")) return "PDF";
    if (lower.endsWith(".png")) return "PNG";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPG";
    if (lower.endsWith(".webp")) return "WEBP";
    if (lower.endsWith(".dcm")) return "DCM";
    if (lower.endsWith(".tif") || lower.endsWith(".tiff")) return "TIF";
    if (mime.includes("pdf")) return "PDF";
    if (mime.includes("jpeg")) return "JPG";
    if (mime.includes("png")) return "PNG";
    if (mime.startsWith("image/")) return "IMG";
    return "FILE";
}

export function formatAnlageBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAnlageImagePreview(mime: string, name: string): boolean {
    if (mime.startsWith("image/")) return true;
    const l = name.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tif", ".tiff"].some((e) => l.endsWith(e));
}

export function buildAnlageRowFromFile(file: File): AkteAnlage {
    const previewUrl = URL.createObjectURL(file);
    const id =
        globalThis.crypto?.randomUUID?.() ?? `anlage-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return {
        id,
        name: file.name,
        addedAt: new Date().toISOString(),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        previewUrl,
    };
}

/** Base64 (Standard) für Tauri `create_akte_anlage`. */
export async function fileToBase64ForAnlage(file: File): Promise<string> {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const chunk = 0x8000;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

/** Antwort von `list_akte_anlagen` / `create_akte_anlage` (serde snake_case). */
export type AkteAnlageRowDto = {
    id: string;
    display_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    abs_path: string;
};

export function mapAkteAnlageRowDto(r: AkteAnlageRowDto): AkteAnlage {
    return {
        id: r.id,
        name: r.display_name,
        addedAt: r.created_at,
        mimeType: r.mime_type,
        sizeBytes: Number(r.size_bytes),
        absPath: r.abs_path,
        previewUrl: convertFileSrc(r.abs_path),
    };
}
