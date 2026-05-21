import { createAttest, deleteAttest } from "@/controllers/attest.controller";
import { createDokumentVorlage, listDokumentVorlagen } from "@/controllers/praxis.controller";
import { createRezept, deleteRezept } from "@/controllers/rezept.controller";
import type { DokumentVorlage } from "@/models/types";
import {
    buildAttestInhalt,
    validateAttestComposer,
    type AttestComposerFormFields,
} from "@/lib/attest-composer";
import type { RezeptLine } from "@/lib/medikamente";
import { rezeptLinesToVorlageItems } from "@/lib/medikamente";
import { PATIENT_DETAIL_TOAST_UNDO_MS, type AkteSavePending } from "@/lib/patient-detail-utils";

export type PatientDetailRezeptToast = (
    message: string,
    variant?: "success" | "error" | "info",
    opts?: { durationMs?: number; onUndo?: () => void | Promise<void> },
) => void;

export type PatientDetailRezeptActionsCtx = {
    patientId: string;
    userId: string;
    onReload: () => void | Promise<void>;
    toast: PatientDetailRezeptToast;
};

export async function persistPatientRezepte(
    ctx: PatientDetailRezeptActionsCtx,
    queue: RezeptLine[],
    shared: string,
    onAfterSave?: () => void,
): Promise<void> {
    const createdIds: string[] = [];
    try {
        for (const line of queue) {
            const merged = [line.hinweise, shared].filter((s) => s.trim()).join(" · ");
            const mengeN = Number.parseInt(line.menge.trim(), 10);
            const r = await createRezept({
                patient_id: ctx.patientId,
                arzt_id: ctx.userId,
                medikament: line.medikament.trim(),
                wirkstoff: line.wirkstoff.trim() || null,
                dosierung: line.dosierung.trim(),
                dauer: line.dauer.trim(),
                hinweise: merged.trim() || null,
                pzn: line.pzn.trim() || null,
                darreichungsform: line.darreichungsform.trim() || null,
                packungsgroesse: line.packungsgroesse.trim() || null,
                menge: Number.isFinite(mengeN) && mengeN > 0 ? mengeN : null,
                aut_idem: line.aut_idem,
                rezept_typ: line.rezept_typ,
                icd10_code: line.icd10_code.trim() || null,
                verordnender_arzt_id: ctx.userId,
            });
            createdIds.push(r.id);
        }
        ctx.toast(`${queue.length} Rezept${queue.length === 1 ? "" : "e"} gespeichert`, "success", {
            durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
            onUndo: async () => {
                try {
                    for (const rid of createdIds) {
                        await deleteRezept(rid);
                    }
                    await ctx.onReload();
                } catch (e) {
                    ctx.toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                }
            },
        });
        onAfterSave?.();
        await ctx.onReload();
    } catch (e) {
        ctx.toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
}

export async function persistPatientAttest(
    ctx: PatientDetailRezeptActionsCtx,
    fields: AttestComposerFormFields,
    options?: { silent?: boolean; onAfterSave?: () => void },
): Promise<string | null> {
    const vErr = validateAttestComposer(fields);
    if (vErr) {
        ctx.toast(vErr, "error");
        return null;
    }
    const inhalt = buildAttestInhalt(fields);
    try {
        const created = await createAttest({
            patient_id: ctx.patientId,
            arzt_id: ctx.userId,
            typ: fields.typ.trim(),
            inhalt,
            gueltig_von: fields.gueltig_von.slice(0, 10),
            gueltig_bis: fields.gueltig_bis.slice(0, 10),
            icd10_code: fields.icd10_code.trim() || null,
            erst_oder_folge: fields.erst_oder_folge,
            arbeitgeber:
                fields.typ.includes("Arbeitsunfähig") && fields.arbeitgeber.trim()
                    ? fields.arbeitgeber.trim()
                    : null,
            ausstellender_arzt_id: ctx.userId,
        });
        if (!options?.silent) {
            ctx.toast("Attest gespeichert", "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteAttest(created.id);
                        await ctx.onReload();
                    } catch (e) {
                        ctx.toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
        }
        options?.onAfterSave?.();
        await ctx.onReload();
        return created.id;
    } catch (e) {
        ctx.toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        return null;
    }
}

export async function flushRezeptFinalizeVorlage(
    ctx: PatientDetailRezeptActionsCtx,
    p: Extract<AkteSavePending, { kind: "rezept_finalize_vorlage" }>,
    hooks: {
        setComposerBusy: (busy: boolean) => void;
        clearPending: () => void;
        refreshRezeptVorlagen: () => Promise<void>;
    },
): Promise<void> {
    hooks.setComposerBusy(true);
    try {
        await createDokumentVorlage({
            kind: "REZEPT",
            titel: p.titel,
            payload: { items: rezeptLinesToVorlageItems(p.lines) },
        });
        ctx.toast("Vorlage für die Praxis gespeichert", "success");
        await hooks.refreshRezeptVorlagen();
        hooks.clearPending();
        await persistPatientRezepte(ctx, p.lines, p.shared);
    } finally {
        hooks.setComposerBusy(false);
    }
}

export async function flushAttestFinalizeVorlage(
    ctx: PatientDetailRezeptActionsCtx,
    p: Extract<AkteSavePending, { kind: "attest_finalize_vorlage" }>,
    hooks: {
        setComposerBusy: (busy: boolean) => void;
        clearPending: () => void;
        refreshAttestVorlagen: () => Promise<void>;
    },
): Promise<void> {
    hooks.setComposerBusy(true);
    try {
        const n = Number.parseInt(p.fields.tageAnzahl.trim(), 10);
        await createDokumentVorlage({
            kind: "ATTEST",
            titel: p.titel,
            payload: {
                krankheiten: p.fields.krankheiten.trim(),
                tage_anzahl: Number.isFinite(n) ? n : p.fields.tageAnzahl.trim(),
                einschraenkung: p.fields.einschraenkung.trim(),
            },
        });
        await hooks.refreshAttestVorlagen();
        hooks.clearPending();
        const attestId = await persistPatientAttest(ctx, p.fields, { silent: true });
        if (attestId) {
            ctx.toast("Vorlage angelegt und Attest gespeichert", "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteAttest(attestId);
                        await ctx.onReload();
                    } catch (e) {
                        ctx.toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
        }
    } finally {
        hooks.setComposerBusy(false);
    }
}

export async function refreshDokumentVorlagen(kind: "REZEPT" | "ATTEST"): Promise<DokumentVorlage[]> {
    const all = await listDokumentVorlagen();
    return all.filter((v) => v.kind === kind);
}
