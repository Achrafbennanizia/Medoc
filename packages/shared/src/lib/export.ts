import { openExportPreview, type ExportFormat } from "@/models/store/export-preview-store";
import { loadExportPathConfig } from "@/lib/export-settings";
import { isTauriApp, type ExportContext } from "@/lib/save-download";
import { saveExportBytesToFolder } from "@/systems/practice-host/controllers/document-template.controller";

export type FinishExportWithSettingsInput = {
    format: ExportFormat;
    title: string;
    hint?: string;
    suggestedFilename: string;
    mime: string;
    /** PDF, ZIP, … */
    binaryBody?: Uint8Array;
    textBody?: string;
    /** One-off target folder ("Another location" in the dialog). */
    folderOverride?: string | null;
    /** What is exported — required so the backend can audit the file. */
    context: ExportContext;
};

/**
 * Saves into the configured custom folder (Tauri) or opens the export
 * preview (save dialog / print). Both save paths send `context`, and the
 * backend writes an `EXPORT_FILE` audit entry with size and SHA-256.
 */
export async function finishExportWithSettings(opts: FinishExportWithSettingsInput): Promise<void> {
    const pathCfg = await loadExportPathConfig();
    const custom = pathCfg.mode === "custom" ? pathCfg.customPath?.trim() ?? "" : "";
    const folder = (opts.folderOverride?.trim() || custom).trim();

    if (isTauriApp() && folder) {
        if (opts.binaryBody && opts.binaryBody.length > 0) {
            await saveExportBytesToFolder(folder, opts.suggestedFilename, opts.binaryBody, opts.context);
            return;
        }
        if (opts.textBody !== undefined) {
            const enc = new TextEncoder().encode(opts.textBody);
            await saveExportBytesToFolder(folder, opts.suggestedFilename, enc, opts.context);
            return;
        }
    }

    openExportPreview({
        format: opts.format,
        title: opts.title,
        hint: opts.hint,
        suggestedFilename: opts.suggestedFilename,
        binaryBody: opts.binaryBody,
        textBody: opts.textBody,
        context: opts.context,
    });
}
