import { openExportPreview, type ExportFormat } from "@/models/store/export-preview-store";
import { loadExportPathConfig } from "@/lib/export-settings";
import { isTauriApp } from "@/lib/save-download";
import { saveExportBytesToFolder } from "@/controllers/document-template.controller";

export type FinishExportWithSettingsInput = {
    format: ExportFormat;
    title: string;
    hint?: string;
    suggestedFilename: string;
    mime: string;
    /** PDF, ZIP, … */
    binaryBody?: Uint8Array;
    textBody?: string;
    /** Einmaliger Zielordner (Dialog „Anderen Speicherort“) */
    folderOverride?: string | null;
};

/**
 * Speichert in konfigurierten benutzerdefinierten Ordner (Tauri), sonst Öffnen der Export-Vorschau
 * (Download / Druck wie bisher).
 */
export async function finishExportWithSettings(opts: FinishExportWithSettingsInput): Promise<void> {
    const pathCfg = await loadExportPathConfig();
    const custom = pathCfg.mode === "custom" ? pathCfg.customPath?.trim() ?? "" : "";
    const folder = (opts.folderOverride?.trim() || custom).trim();

    if (isTauriApp() && folder) {
        if (opts.binaryBody && opts.binaryBody.length > 0) {
            await saveExportBytesToFolder(folder, opts.suggestedFilename, opts.binaryBody);
            return;
        }
        if (opts.textBody !== undefined) {
            const enc = new TextEncoder().encode(opts.textBody);
            await saveExportBytesToFolder(folder, opts.suggestedFilename, enc);
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
    });
}

/**
 * Zentrale Export-Fassade (Phase 4 wird hier weiter verdichtet: Picker, Audit, Kennnummern, …).
 */
export async function exportFile(
    _kind: string,
    _data: unknown,
    _opts?: Record<string, unknown>,
): Promise<void> {
    void _kind;
    void _data;
    void _opts;
    throw new Error("exportFile: noch nicht angebunden — finishExportWithSettings oder Modul-Export nutzen.");
}
