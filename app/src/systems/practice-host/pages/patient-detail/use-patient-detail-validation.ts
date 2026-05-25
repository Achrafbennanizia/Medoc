import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { SECTION_LABEL as VAL_SECTION_LABEL, type ValidationRecord, type ValidationSection, type ValidationState } from "@/lib/akte-validation";
import {
    clearAkteValidation,
    listAkteValidation,
    migrateLegacyAkteValidationFromLocalStorage,
    rowsToValidationMaps,
    setAkteItemValidated,
    setAkteSectionValidated,
} from "@/controllers/validation.controller";
import { useToastStore } from "@/views/components/ui/toast-store";

export type UsePatientDetailValidationArgs = {
    patientId: string | undefined;
    sessionUserId: string | undefined;
    validation: ValidationState;
    setValidation: Dispatch<SetStateAction<ValidationState>>;
    setItemValidation: Dispatch<SetStateAction<Partial<Record<string, ValidationRecord>>>>;
};

export function usePatientDetailValidation({
    patientId,
    sessionUserId,
    setValidation,
    setItemValidation,
}: UsePatientDetailValidationArgs) {
    const toast = useToastStore((s) => s.add);

    const refreshValidationFromBackend = useCallback(async () => {
        if (!patientId) return;
        const rows = await listAkteValidation(patientId);
        const { sections, items } = rowsToValidationMaps(rows);
        setValidation(sections);
        setItemValidation(items);
    }, [patientId, setValidation, setItemValidation]);

    useEffect(() => {
        if (!patientId) return;
        void (async () => {
            try {
                await migrateLegacyAkteValidationFromLocalStorage(patientId);
                await refreshValidationFromBackend();
            } catch (e) {
                useToastStore.getState().add(
                    `Validierung laden: ${e instanceof Error ? e.message : String(e)}`,
                    "error",
                );
            }
        })();
    }, [patientId, refreshValidationFromBackend]);

    const validateSection = useCallback(
        async (section: ValidationSection) => {
            if (!patientId) return;
            const by = sessionUserId ?? null;
            try {
                if (section === "stamm") {
                    await setAkteSectionValidated(patientId, "stamm", by);
                    await setAkteSectionValidated(patientId, "anam", by);
                    toast("Stammdaten und Anamnese als geprüft markiert.", "success");
                } else {
                    await setAkteSectionValidated(patientId, section, by);
                    toast(`„${VAL_SECTION_LABEL[section]}“ als geprüft markiert.`, "success");
                }
                await refreshValidationFromBackend();
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [patientId, sessionUserId, toast, refreshValidationFromBackend],
    );

    const revokeSectionValidation = useCallback(
        async (section: ValidationSection) => {
            if (!patientId) return;
            try {
                if (section === "stamm") {
                    await clearAkteValidation(patientId, "stamm");
                    await clearAkteValidation(patientId, "anam");
                    toast("Validierung für Stammdaten und Anamnese zurückgesetzt.", "info");
                } else {
                    await clearAkteValidation(patientId, section);
                    toast(`Validierung für „${VAL_SECTION_LABEL[section]}“ zurückgesetzt.`, "info");
                }
                await refreshValidationFromBackend();
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [patientId, toast, refreshValidationFromBackend],
    );

    const requestValidateItem = useCallback(
        async (itemKey: string, label: string) => {
            if (!patientId) return;
            try {
                await setAkteItemValidated(patientId, itemKey, sessionUserId ?? null);
                await refreshValidationFromBackend();
                toast(`„${label}“ als geprüft markiert.`, "success");
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [patientId, sessionUserId, toast, refreshValidationFromBackend],
    );

    const revokeItemValidationRow = useCallback(
        async (itemKey: string, shortLabel: string) => {
            if (!patientId) return;
            try {
                await clearAkteValidation(patientId, itemKey);
                await refreshValidationFromBackend();
                toast(`Validierung für „${shortLabel}“ zurückgesetzt.`, "info");
            } catch (e) {
                toast(`Validierung: ${e instanceof Error ? e.message : String(e)}`, "error");
            }
        },
        [patientId, toast, refreshValidationFromBackend],
    );

    return {
        refreshValidationFromBackend,
        validateSection,
        revokeSectionValidation,
        requestValidateItem,
        revokeItemValidationRow,
    };
}
