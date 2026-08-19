/** Patient record attachments — validation, display helpers, DTO mapping (no Tauri). */

export const ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export const LS_CHART_SCAN_FOLDER = "medoc-chart-scan-folder";

/** Persisted keys — must match `chart_attachment_commands::ALLOWED_DOCUMENT_KINDS`. */
export const CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT = "OTHER";

export const CHART_ATTACHMENT_DOCUMENT_KINDS: readonly { id: string; labelKey: string }[] = [
    { id: "MRT", labelKey: "attachment.kind.mrt" },
    { id: "CT", labelKey: "attachment.kind.ct" },
    { id: "XRAY", labelKey: "attachment.kind.xray" },
    { id: "LAB", labelKey: "attachment.kind.lab" },
    { id: "REFERRAL", labelKey: "attachment.kind.referral" },
    { id: "CONSENT", labelKey: "attachment.kind.consent" },
    { id: "OTHER", labelKey: "attachment.kind.other" },
];

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

export function normalizeChartDocumentKind(raw: string | undefined | null): string {
    const u = (raw ?? CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT).trim().toUpperCase();
    return CHART_ATTACHMENT_DOCUMENT_KINDS.some((k) => k.id === u) ? u : CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT;
}

export function labelForChartDocumentKind(t: (key: string) => string, id: string): string {
    const kind = CHART_ATTACHMENT_DOCUMENT_KINDS.find((k) => k.id === normalizeChartDocumentKind(id));
    return kind ? t(kind.labelKey) : id;
}

export function validateAttachmentFile(t: (key: string) => string, file: File): string | null {
    if (file.size > ATTACHMENT_MAX_BYTES) {
        return t("attachment.error.file_too_large");
    }
    const lower = file.name.toLowerCase();
    const okExt = ALLOWED_EXT.some((e) => lower.endsWith(e));
    const okMime = !file.type || ALLOWED_MIME.has(file.type);
    if (!okExt && !okMime) {
        return t("attachment.error.invalid_format");
    }
    return null;
}

export type ChartAttachment = {
    id: string;
    name: string;
    addedAt: string;
    mimeType: string;
    sizeBytes: number;
    /** Predefined document type (MRT, Labor, …). */
    documentKind: string;
    /** Preview URL (`blob:` before save or platform `convertFileSrc` after save). */
    previewUrl: string;
    /** Only after persistence: absolute path on device (Tauri). */
    absPath?: string;
};

/** Main file picker: allowed extensions only (browser filters the dialog accordingly). */
export function attachmentInputAccept(): string {
    return ALLOWED_EXT.join(",");
}

/** Camera / photo capture: image types only that we are allowed to persist. */
export function attachmentCameraInputAccept(): string {
    return ".jpg,.jpeg,.png,.webp,.heic,.heif";
}

export function attachmentBadgeExt(name: string, mime: string): string {
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

export function formatAttachmentBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isAttachmentImagePreview(mime: string, name: string): boolean {
    if (mime.startsWith("image/")) return true;
    const l = name.toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".gif", ".bmp", ".tif", ".tiff"].some((e) =>
        l.endsWith(e),
    );
}

const UUID_FILENAME_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]+)?$/i;

function extensionFromFileOrMime(file: File): string {
    const raw = file.name?.trim() ?? "";
    const dot = raw.lastIndexOf(".");
    if (dot >= 0 && dot < raw.length - 1) {
        const ext = raw.slice(dot).toLowerCase();
        if (ALLOWED_EXT.some((e) => e === ext)) return ext;
    }
    const t = (file.type || "").toLowerCase();
    if (t.includes("pdf")) return ".pdf";
    if (t.includes("png")) return ".png";
    if (t.includes("jpeg")) return ".jpg";
    if (t.includes("webp")) return ".webp";
    if (t.includes("heic")) return ".heic";
    if (t.includes("heif")) return ".heif";
    if (t.includes("dicom")) return ".dcm";
    if (t.includes("tiff")) return ".tif";
    return ".jpg";
}

/** Human-readable suggested label (never raw UUID filename for users). */
export function deriveAttachmentDisplayName(file: File): string {
    const raw = file.name?.trim() ?? "";
    const stamp = new Date().toISOString().slice(0, 10);
    const ext = extensionFromFileOrMime(file);

    if (!raw.length) {
        const stampIso = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        return `Foto-${stampIso}${ext}`;
    }

    if (UUID_FILENAME_RE.test(raw)) {
        return `Attachment-${stamp}${ext}`;
    }

    const base = raw.includes(".") ? raw.slice(0, raw.lastIndexOf(".")) : raw;
    if (base.length === 0) {
        return `Attachment-${stamp}${ext}`;
    }

    return raw;
}

/** Appends the original extension when the user enters a title without ".xyz" (backend/OCR fallback). */
export function ensureAttachmentDisplayNameExtension(displayName: string, file: File): string {
    const t = displayName.trim();
    if (!t) return t;
    if (/\.[a-z0-9]{2,8}$/i.test(t)) return t;
    return `${t}${extensionFromFileOrMime(file)}`;
}

export function buildAttachmentRowFromFile(file: File): ChartAttachment {
    const previewUrl = URL.createObjectURL(file);
    const id =
        globalThis.crypto?.randomUUID?.() ?? `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    return {
        id,
        name: deriveAttachmentDisplayName(file),
        addedAt: new Date().toISOString(),
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        documentKind: CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
        previewUrl,
    };
}

/** Base64 (standard) for Tauri `create_chart_attachment`. FileReader avoids call-stack limits on large files. */
export function fileToBase64ForAttachment(file: File): Promise<string> {
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

/** Response from `list_chart_attachments` / `create_chart_attachment` (serde snake_case). */
export type ChartAttachmentRowDto = {
    id: string;
    display_name: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
    abs_path: string;
    document_kind?: string;
};

export function mapChartAttachmentRowFromDto(r: ChartAttachmentRowDto, previewUrl: string): ChartAttachment {
    return {
        id: r.id,
        name: r.display_name,
        addedAt: r.created_at,
        mimeType: r.mime_type,
        sizeBytes: Number(r.size_bytes),
        documentKind: normalizeChartDocumentKind(r.document_kind),
        absPath: r.abs_path,
        previewUrl,
    };
}
