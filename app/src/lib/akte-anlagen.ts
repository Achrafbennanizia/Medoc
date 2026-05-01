/** Persistierte Akten-Anlagen (Datei auf Disk) + Vorschau über `convertFileSrc` in Tauri. */

import { convertFileSrc } from "@tauri-apps/api/core";

export const ANLAGE_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".dcm", ".tif", ".tiff", ".heic", ".heif"];

const ALLOWED_MIME = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
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
    return ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.dcm,.tif,.tiff,application/pdf,image/*";
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
    if (lower.endsWith(".heic")) return "HEIC";
    if (lower.endsWith(".heif")) return "HEIF";
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
    return [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tif", ".tiff"].some((e) => l.endsWith(e));
}

export function deriveAnlageDisplayName(file: File): string {
    const raw = file.name?.trim() ?? "";
    if (raw.length > 0) return raw;
    const t = (file.type || "").toLowerCase();
    const ext =
        t.includes("png") ? "png"
        : t.includes("heic") ? "heic"
        : t.includes("heif") ? "heif"
        : t.includes("webp") ? "webp"
        : t.includes("tiff") ? "tif"
        : "jpg";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `Foto-${stamp}.${ext}`;
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

/** Base64 (Standard) für Tauri `create_akte_anlage`. FileReader für große Dateien ohne Call-Stack-Grenzen. */
export function fileToBase64ForAnlage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => {
            const s = fr.result;
            if (typeof s !== "string") {
                reject(new Error("FileReader"));
                return;
            }
            const comma = s.indexOf(",");
            resolve(comma >= 0 ? s.slice(comma + 1) : s);
        };
        fr.onerror = () => reject(fr.error ?? new Error("FileReader"));
        fr.readAsDataURL(file);
    });
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
