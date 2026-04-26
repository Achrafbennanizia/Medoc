/** Lokale Anlagen in der Akte (Vorschau via Blob-URL, nur Sitzung / bis Patient gewechselt wird). */

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
    /** `URL.createObjectURL` — bei Entfernen / Abbruch widerrufen */
    previewUrl: string;
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
    return {
        id: crypto.randomUUID(),
        name: file.name,
        addedAt: new Date().toISOString(),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        previewUrl,
    };
}
