import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { SECTION_LABEL as VAL_SECTION_LABEL, type ValidationRecord, type ValidationSection, type ValidationState } from "@/lib/chart-validation";
import {
    clearChartValidation,
    listChartValidation,
    migrateLegacyChartValidationFromLocalStorage,
    rowsToValidationMaps,
    setChartItemValidated,
    setChartSectionValidated,
} from "@/systems/practice-host/controllers/validation.controller";
import { useT, useTParams } from "@/lib/i18n";
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
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);

    const refreshValidationFromBackend = useCallback(async () => {
        if (!patientId) return;
        const rows = await listChartValidation(patientId);
        const { sections, items } = rowsToValidationMaps(rows);
        setValidation(sections);
        setItemValidation(items);
    }, [patientId, setValidation, setItemValidation]);

    useEffect(() => {
        if (!patientId) return;
        void (async () => {
            try {
                await migrateLegacyChartValidationFromLocalStorage(patientId);
                await refreshValidationFromBackend();
            } catch (e) {
                useToastStore.getState().add(
                    tp("patient.validation.load_error", { message: e instanceof Error ? e.message : String(e) }),
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
                if (section === "master") {
                    await setChartSectionValidated(patientId, "master", by);
                    await setChartSectionValidated(patientId, "anamnesis", by);
                    toast(t("patient.validation.master_marked"), "success");
                } else {
                    await setChartSectionValidated(patientId, section, by);
                    toast(tp("patient.validation.section_marked", { section: VAL_SECTION_LABEL[section] }), "success");
                }
                await refreshValidationFromBackend();
            } catch (e) {
                toast(tp("patient.validation.error", { message: e instanceof Error ? e.message : String(e) }), "error");
            }
        },
        [patientId, sessionUserId, toast, refreshValidationFromBackend],
    );

    const revokeSectionValidation = useCallback(
        async (section: ValidationSection) => {
            if (!patientId) return;
            try {
                if (section === "master") {
                    await clearChartValidation(patientId, "master");
                    await clearChartValidation(patientId, "anamnesis");
                    toast(t("patient.validation.master_revoked"), "info");
                } else {
                    await clearChartValidation(patientId, section);
                    toast(tp("patient.validation.section_revoked", { section: VAL_SECTION_LABEL[section] }), "info");
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
                await setChartItemValidated(patientId, itemKey, sessionUserId ?? null);
                await refreshValidationFromBackend();
                toast(tp("patient.validation.item_marked", { label }), "success");
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
                await clearChartValidation(patientId, itemKey);
                await refreshValidationFromBackend();
                toast(tp("patient.validation.item_revoked", { label: shortLabel }), "info");
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
