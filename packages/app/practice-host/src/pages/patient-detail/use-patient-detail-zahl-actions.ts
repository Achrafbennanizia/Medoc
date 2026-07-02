import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Behandlung, Patient, Untersuchung, Zahlung, ZahlungsArt } from "@/models/types";
import { createZahlung, deleteZahlung, updateZahlung } from "@/systems/practice-host/controllers/zahlung.controller";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { buildQuittungExportForZahlung } from "@/lib/quittung-export-flow";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { PATIENT_DETAIL_TOAST_UNDO_MS } from "@/lib/patient-detail-utils";
import {
    ZAHL_EUR_EPS,
    aggregateZahlungenByZuordnung,
    buildOpenZahlLinkSelectOptions,
    latestZahlungForZuordnungRow,
    maxEditZahlungBehandlung,
    maxNeuZahlungBehandlung,
    maxNeuZahlungUntersuchung,
    maxEditZahlungUntersuchung,
    roundMoney2,
    sumZahlungenForBehandlung,
    type ZahlZuordnungSummaryRow,
} from "@/lib/zahlung-buchung";
import { formatCurrency } from "@/lib/utils";
import { useT, useTParams } from "@/lib/i18n";
import { useToastStore } from "@/views/components/ui/toast-store";

export type ZahlNewFormState = {
    linkKind: "" | "behand" | "unter";
    linkId: string;
    betrag: string;
    zahlungsart: ZahlungsArt;
    beschreibung: string;
};

export type ZahlEditFormState = {
    betrag: string;
    zahlungsart: ZahlungsArt;
    beschreibung: string;
};

export type UsePatientDetailZahlActionsArgs = {
    patientId: string | undefined;
    patient: Patient | null;
    behandlungen: Behandlung[];
    untersuchungen: Untersuchung[];
    zahlungen: Zahlung[];
    zahlNewForm: ZahlNewFormState;
    setZahlNewForm: Dispatch<SetStateAction<ZahlNewFormState>>;
    setShowZahlComposer: (v: boolean) => void;
    zahlEdit: Zahlung | null;
    setZahlEdit: (z: Zahlung | null) => void;
    zahlEditUnlocked: boolean;
    zahlEditForm: ZahlEditFormState;
    zahlDeleteId: string | null;
    setZahlDeleteId: (id: string | null) => void;
    load: () => Promise<void>;
    ensurePraxisForDocument: (kind: DocumentKind) => boolean;
    setHtmlDocExport: (v: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null) => void;
};

export function usePatientDetailZahlActions(args: UsePatientDetailZahlActionsArgs) {
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const {
        patientId,
        patient,
        behandlungen,
        untersuchungen,
        zahlungen,
        zahlNewForm,
        setZahlNewForm,
        setShowZahlComposer,
        zahlEdit,
        setZahlEdit,
        zahlEditUnlocked,
        zahlEditForm,
        zahlDeleteId,
        setZahlDeleteId,
        load,
        ensurePraxisForDocument,
        setHtmlDocExport,
    } = args;

    const zahlLinkSelectOptionsOpen = useMemo(() => {
        if (!patientId) return [{ value: "", label: "—" }];
        return buildOpenZahlLinkSelectOptions(zahlungen, patientId, behandlungen, untersuchungen, t, tp);
    }, [patientId, zahlungen, behandlungen, untersuchungen, t, tp]);

    const zahlZuordnungSummaries = useMemo(
        () => (patientId ? aggregateZahlungenByZuordnung(zahlungen, patientId, behandlungen, untersuchungen, t, tp) : []),
        [patientId, zahlungen, behandlungen, untersuchungen, t, tp],
    );

    const zahlungenHistorisch = useMemo(
        () => [...zahlungen].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))),
        [zahlungen],
    );

    const zahlNeuMaxBetragEur = useMemo(() => {
        if (!patientId || !zahlNewForm.linkId) return null;
        if (zahlNewForm.linkKind === "behand") {
            const selBh = behandlungen.find((b) => b.id === zahlNewForm.linkId);
            const gesamt =
                selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
            return maxNeuZahlungBehandlung(zahlungen, patientId, zahlNewForm.linkId, gesamt);
        }
        if (zahlNewForm.linkKind === "unter") {
            const selU = untersuchungen.find((u) => u.id === zahlNewForm.linkId);
            const gesamt =
                selU?.gesamtkosten != null && Number.isFinite(selU.gesamtkosten) ? selU.gesamtkosten : null;
            return maxNeuZahlungUntersuchung(zahlungen, patientId, zahlNewForm.linkId, gesamt);
        }
        return null;
    }, [patientId, zahlNewForm.linkKind, zahlNewForm.linkId, behandlungen, untersuchungen, zahlungen]);

    const zahlEditMaxBetragEur = (() => {
        if (!patientId || !zahlEdit) return null;
        if (zahlEdit.behandlung_id) {
            const bRow = behandlungen.find((x) => x.id === zahlEdit.behandlung_id);
            const gesamt =
                bRow?.gesamtkosten != null && Number.isFinite(bRow.gesamtkosten) ? bRow.gesamtkosten : null;
            return maxEditZahlungBehandlung(zahlungen, patientId, zahlEdit.behandlung_id, zahlEdit.id, gesamt);
        }
        if (zahlEdit.untersuchung_id) {
            const uRow = untersuchungen.find((x) => x.id === zahlEdit.untersuchung_id);
            const gesamt =
                uRow?.gesamtkosten != null && Number.isFinite(uRow.gesamtkosten) ? uRow.gesamtkosten : null;
            return maxEditZahlungUntersuchung(zahlungen, patientId, zahlEdit.untersuchung_id, zahlEdit.id, gesamt);
        }
        return null;
    })();

    const runSaveZahlEdit = async () => {
        if (!zahlEdit) return;
        if (!zahlEditUnlocked) {
            toast(t("patient.detail.toast.edit_unlock_first"), "info");
            return;
        }
        const betrag = Number(String(zahlEditForm.betrag).replace(",", "."));
        if (!Number.isFinite(betrag) || betrag <= 0) {
            toast(t("patient.detail.toast.valid_amount_required"), "error");
            return;
        }
        if (zahlEdit.behandlung_id && patientId && zahlEditMaxBetragEur != null && betrag > zahlEditMaxBetragEur + ZAHL_EUR_EPS) {
            toast(
                tp("patient.detail.toast.payment_max_amount", { amount: formatCurrency(zahlEditMaxBetragEur) }),
                "error",
            );
            return;
        }
        const prevRow = zahlungen.find((z) => z.id === zahlEdit.id);
        if (!prevRow) {
            toast(t("patient.detail.toast.payment_not_loaded"), "error");
            return;
        }
        try {
            await updateZahlung({
                id: zahlEdit.id,
                betrag,
                zahlungsart: zahlEditForm.zahlungsart,
                leistung_id: zahlEdit.leistung_id,
                beschreibung: zahlEditForm.beschreibung.trim() || null,
            });
            toast(t("patient.detail.toast.payment_updated"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateZahlung({
                            id: prevRow.id,
                            betrag: prevRow.betrag,
                            zahlungsart: prevRow.zahlungsart,
                            leistung_id: prevRow.leistung_id,
                            beschreibung: prevRow.beschreibung,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setZahlEdit(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const submitSaveZahlNew = async () => {
        if (!patientId) return;
        if (!zahlNewForm.linkKind || !zahlNewForm.linkId.trim()) {
            toast(t("patient.detail.toast.payment_link_required"), "error");
            return;
        }
        const betrag = Number(String(zahlNewForm.betrag).replace(",", "."));
        if (!Number.isFinite(betrag) || betrag <= 0) {
            toast(t("patient.detail.toast.payment_amount_invalid"), "error");
            return;
        }
        const selBh =
            zahlNewForm.linkKind === "behand" ? behandlungen.find((b) => b.id === zahlNewForm.linkId) : undefined;
        const gesamt =
            selBh?.gesamtkosten != null && Number.isFinite(selBh.gesamtkosten) ? selBh.gesamtkosten : null;
        const paidSoFar =
            zahlNewForm.linkKind === "behand" && zahlNewForm.linkId
                ? sumZahlungenForBehandlung(zahlungen, patientId, zahlNewForm.linkId)
                : 0;
        let openBefore: number | undefined;
        if (zahlNewForm.linkKind === "behand" && zahlNewForm.linkId && gesamt != null && Number.isFinite(gesamt)) {
            openBefore = Math.max(0, roundMoney2(gesamt - paidSoFar));
        }
        if (zahlNewForm.linkKind === "behand" && openBefore != null && betrag > openBefore + ZAHL_EUR_EPS) {
            toast(
                tp("patient.detail.toast.payment_exceeds_open", { amount: formatCurrency(openBefore) }),
                "error",
            );
            return;
        }
        try {
            await createZahlung({
                patient_id: patientId,
                betrag,
                zahlungsart: zahlNewForm.zahlungsart,
                beschreibung: zahlNewForm.beschreibung.trim() || undefined,
                behandlung_id: zahlNewForm.linkKind === "behand" ? zahlNewForm.linkId : undefined,
                untersuchung_id: zahlNewForm.linkKind === "unter" ? zahlNewForm.linkId : undefined,
                betrag_erwartet: openBefore,
            });
            toast(t("patient.detail.toast.payment_captured"), "success");
            setShowZahlComposer(false);
            setZahlNewForm({
                linkKind: "",
                linkId: "",
                betrag: "",
                zahlungsart: "BAR",
                beschreibung: "",
            });
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteZahlungRow = async () => {
        if (!zahlDeleteId) return;
        try {
            await deleteZahlung(zahlDeleteId);
            toast(t("patient.detail.toast.payment_deleted"));
            setZahlDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handlePrintQuittung = async (z: Zahlung) => {
        if (!ensurePraxisForDocument("quittung") || !patient) return;
        try {
            setHtmlDocExport(await buildQuittungExportForZahlung(z));
        } catch (e) {
            toast(tp("patient.detail.toast.quittung_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handlePrintQuittungFromSummeRow = (row: ZahlZuordnungSummaryRow) => {
        if (!patientId) return;
        const z = latestZahlungForZuordnungRow(row, zahlungen, patientId);
        if (!z) {
            toast(t("patient.detail.toast.no_printable_booking"), "info");
            return;
        }
        void handlePrintQuittung(z);
    };

    return {
        zahlLinkSelectOptionsOpen,
        zahlZuordnungSummaries,
        zahlungenHistorisch,
        zahlNeuMaxBetragEur,
        zahlEditMaxBetragEur,
        runSaveZahlEdit,
        submitSaveZahlNew,
        handleDeleteZahlungRow,
        handlePrintQuittung,
        handlePrintQuittungFromSummeRow,
    };
}
