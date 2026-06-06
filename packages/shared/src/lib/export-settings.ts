import { getAppKv, type AppKvKey } from "@/systems/practice-host/controllers/app-kv.controller";
import { isTauriApp } from "@/lib/save-download";
import type { DocumentKind } from "@/lib/document-template-schema";

export type ExportPathMode = "documents" | "custom";

export interface ExportPathConfigV1 {
    mode: ExportPathMode;
    /** Absolute path when mode === custom */
    customPath?: string;
}

export type ExportFileFormat = "pdf" | "csv" | "json" | "xml";

export interface ExportFormatsConfigV1 {
    defaultFormat: ExportFileFormat;
    perKind: Partial<Record<DocumentKind | "default", ExportFileFormat>>;
}

const KEY_PATH = "export.path.v1" satisfies AppKvKey;
const KEY_FORMATS = "export.formats.v1" satisfies AppKvKey;

const DEFAULT_PATH: ExportPathConfigV1 = { mode: "documents", customPath: "" };

const DEFAULT_FORMATS: ExportFormatsConfigV1 = {
    defaultFormat: "pdf",
    perKind: {
        akte: "pdf",
        audit_list: "csv",
        rechnung: "pdf",
    },
};

export function parseExportPathJson(raw: string | null): ExportPathConfigV1 {
    if (!raw?.trim()) return { ...DEFAULT_PATH };
    try {
        const j = JSON.parse(raw) as ExportPathConfigV1;
        if (j.mode !== "custom" && j.mode !== "documents") return { ...DEFAULT_PATH };
        return {
            mode: j.mode,
            customPath: typeof j.customPath === "string" ? j.customPath : "",
        };
    } catch {
        return { ...DEFAULT_PATH };
    }
}

export function parseExportFormatsJson(raw: string | null): ExportFormatsConfigV1 {
    if (!raw?.trim()) return structuredClone(DEFAULT_FORMATS);
    try {
        const j = JSON.parse(raw) as ExportFormatsConfigV1;
        return {
            defaultFormat: j.defaultFormat ?? "pdf",
            perKind: typeof j.perKind === "object" && j.perKind ? j.perKind : {},
        };
    } catch {
        return structuredClone(DEFAULT_FORMATS);
    }
}

/** Resolved directory for display (best effort; browser: „Download“). */
export function describeResolvedExportPath(cfg: ExportPathConfigV1): string {
    if (!isTauriApp()) return "Browser: Standard-Download des Browsers";
    if (cfg.mode === "documents") {
        return "Standard: Ordner „Dokumente“ (vom Betriebssystem) — genauer Pfad wird beim Speichern aufgelöst";
    }
    return (cfg.customPath?.trim() && cfg.customPath) || "(kein eigener Pfad gewählt)";
}

export async function loadExportPathConfig(): Promise<ExportPathConfigV1> {
    const raw = await getAppKv(KEY_PATH);
    return parseExportPathJson(raw);
}

export async function loadExportFormatsConfig(): Promise<ExportFormatsConfigV1> {
    const raw = await getAppKv(KEY_FORMATS);
    return parseExportFormatsJson(raw);
}

export function defaultFormatForKind(formats: ExportFormatsConfigV1, kind: DocumentKind): ExportFileFormat {
    if (kind === "rechnung") return "pdf";
    return formats.perKind[kind] ?? formats.defaultFormat;
}
