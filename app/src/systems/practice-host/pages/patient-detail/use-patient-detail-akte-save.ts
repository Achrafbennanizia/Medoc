import type { RefObject } from "react";
import { createAkteAnlage, deleteAkteAnlage } from "@/controllers/akte.controller";
import {
    flushAttestFinalizeVorlage,
    flushRezeptFinalizeVorlage,
} from "@/lib/patient-detail-rezept-actions";
import { deriveAnlageDisplayName, fileToBase64ForAnlage } from "@/lib/akte-anlagen";
import type { AkteSavePending } from "@/lib/patient-detail-utils";
import type { Patientenakte } from "@/models/types";
import type { PatientDetailRezeptTabHandle } from "./patient-detail-rezept-tab";
import { useToastStore } from "@/views/components/ui/toast-store";

export type UsePatientDetailAkteSaveArgs = {
    akteSaveConfirm: AkteSavePending | null;
    setAkteSaveConfirm: (v: AkteSavePending | null) => void;
    akteSaveBusy: boolean;
    setAkteSaveBusy: (v: boolean) => void;
    akte: Patientenakte | null;
    patientId: string | undefined;
    sessionUserId: string | undefined;
    rezeptTabRef: RefObject<PatientDetailRezeptTabHandle | null>;
    load: () => Promise<void>;
    refreshAnlagen: (akteId: string) => Promise<void>;
};

export function usePatientDetailAkteSave({
    akteSaveConfirm,
    setAkteSaveConfirm,
    akteSaveBusy,
    setAkteSaveBusy,
    akte,
    patientId,
    sessionUserId,
    rezeptTabRef,
    load,
    refreshAnlagen,
}: UsePatientDetailAkteSaveArgs) {
    const toast = useToastStore((s) => s.add);

    const flushAkteSave = async () => {
        const p = akteSaveConfirm;
        if (!p) return;
        setAkteSaveBusy(true);
        try {
            switch (p.kind) {
                case "rezept_finalize_vorlage":
                case "attest_finalize_vorlage": {
                    if (await rezeptTabRef.current?.flushAkteSaveConfirm(p)) break;
                    if (!patientId || !sessionUserId) break;
                    const ctx = { patientId, userId: sessionUserId, onReload: load, toast };
                    const noop = {
                        setComposerBusy: () => {},
                        clearPending: () => {},
                        refreshRezeptVorlagen: async () => {},
                        refreshAttestVorlagen: async () => {},
                    };
                    if (p.kind === "rezept_finalize_vorlage") {
                        await flushRezeptFinalizeVorlage(ctx, p, noop);
                    } else {
                        await flushAttestFinalizeVorlage(ctx, p, noop);
                    }
                    break;
                }
                case "anlage_add": {
                    if (!akte) break;
                    const displayName = deriveAnlageDisplayName(p.file);
                    const b64 = await fileToBase64ForAnlage(p.file);
                    await createAkteAnlage({
                        akte_id: akte.id,
                        display_name: displayName,
                        mime_type: p.file.type || "application/octet-stream",
                        bytes_base64: b64,
                    });
                    toast("Anlage gespeichert", "success");
                    await refreshAnlagen(akte.id);
                    break;
                }
                case "anlage_remove": {
                    await deleteAkteAnlage(p.id);
                    if (akte) await refreshAnlagen(akte.id);
                    toast("Anlage entfernt", "info");
                    break;
                }
                default:
                    break;
            }
        } catch (e) {
            if (e instanceof Error && (e.message === "invalid-json" || e.message === "invalid-betrag")) {
                /* bereits per Toast gemeldet */
            } else {
                toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        } finally {
            setAkteSaveBusy(false);
            setAkteSaveConfirm(null);
        }
    };

    const cancelAkteSave = () => {
        if (akteSaveBusy) return;
        setAkteSaveConfirm(null);
    };

    return { flushAkteSave, cancelAkteSave };
}
