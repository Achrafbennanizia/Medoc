import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteAttest } from "@/controllers/attest.controller";
import { deleteRezept, updateRezept } from "@/controllers/rezept.controller";
import type { Attest } from "@/controllers/attest.controller";
import type { Rezept } from "@/controllers/rezept.controller";
import { listDokumentVorlagen } from "@/controllers/praxis.controller";
import {
    ATTEST_TYP_OPTIONS,
    KRANKHEITEN_SUGGESTIONS,
    attestGueltigBisFromVonAndTage,
    emptyAttestComposerForm,
    parseAttestVorlagePayload,
    validateAttestComposer,
    type AttestComposerFormFields,
} from "@/lib/attest-composer";
import {
    bundleAttestExport,
    bundleRezeptExport,
    suggestAttestExportBasename,
    suggestRezeptExportBasename,
} from "@/lib/document-print-html";
import {
    emptyRezeptLine,
    findSuggestion,
    parseRezeptVorlagePayload,
    vorlageItemsToLines,
    type RezeptLine,
} from "@/lib/medikamente";
import {
    flushAttestFinalizeVorlage,
    flushRezeptFinalizeVorlage,
    persistPatientAttest,
    persistPatientRezepte,
    refreshDokumentVorlagen,
    type PatientDetailRezeptActionsCtx,
    type PatientDetailRezeptToast,
} from "@/lib/patient-detail-rezept-actions";
import {
    PATIENT_DETAIL_TOAST_UNDO_MS,
    validateRezeptLine,
    type AkteSavePending,
    type AttestWizardStep,
    type RezeptWizardStep,
} from "@/lib/patient-detail-utils";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { DokumentVorlage, Patient } from "@/models/types";
import { useToastStore } from "@/views/components/ui/toast-store";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";

export type PatientDetailRezeptTabProps = {
    patientId: string;
    patient: Patient;
    rezepte: Rezept[];
    atteste: Attest[];
    canWriteMedical: boolean;
    userId: string;
    onReload: () => void | Promise<void>;
    onAkteSaveConfirm: (pending: AkteSavePending) => void;
    onHtmlDocExport: (payload: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    }) => void;
    ensurePraxisForDocument: (kind: DocumentKind) => boolean;
};

export function usePatientDetailRezeptTab({
    patientId,
    patient,
    rezepte,
    atteste,
    canWriteMedical,
    userId,
    onReload,
    onAkteSaveConfirm,
    onHtmlDocExport,
    ensurePraxisForDocument,
}: PatientDetailRezeptTabProps) {
    const toast = useToastStore((s) => s.add) as PatientDetailRezeptToast;
    const actionsCtx: PatientDetailRezeptActionsCtx = useMemo(
        () => ({ patientId, userId, onReload, toast }),
        [patientId, userId, onReload, toast],
    );

    const [rezeptAttestSub, setRezeptAttestSub] = useState<"rezept" | "attest">("rezept");
    const [rezeptDeleteId, setRezeptDeleteId] = useState<string | null>(null);
    const [attestDeleteId, setAttestDeleteId] = useState<string | null>(null);
    const [attestVorlagen, setAttestVorlagen] = useState<DokumentVorlage[]>([]);
    const [attestWizardStep, setAttestWizardStep] = useState<AttestWizardStep>(null);
    const attestWizardPanelRef = useRef<HTMLDivElement>(null);
    const [attestComposerKind, setAttestComposerKind] = useState<"vorlage" | "neu">("neu");
    const [attestForm, setAttestForm] = useState<AttestComposerFormFields>(() =>
        emptyAttestComposerForm(new Date().toISOString().slice(0, 10)));
    const [attestBaselineJson, setAttestBaselineJson] = useState<string | null>(null);
    const [attestComposerBusy, setAttestComposerBusy] = useState(false);
    const [attestDraftErr, setAttestDraftErr] = useState<string | null>(null);
    const [attestPickQuery, setAttestPickQuery] = useState("");
    const [attestPickSelectedId, setAttestPickSelectedId] = useState("");
    const [attestNewVorlageTitel, setAttestNewVorlageTitel] = useState("");
    const [attestPendingQueue, setAttestPendingQueue] = useState<AttestComposerFormFields | null>(null);

    const [rezeptVorlagen, setRezeptVorlagen] = useState<DokumentVorlage[]>([]);
    const [rezeptPickQuery, setRezeptPickQuery] = useState("");
    const [rezeptPickSelectedId, setRezeptPickSelectedId] = useState("");
    const [rezeptWizardStep, setRezeptWizardStep] = useState<RezeptWizardStep>(null);
    const rezeptWizardPanelRef = useRef<HTMLDivElement>(null);
    const [rezeptComposerKind, setRezeptComposerKind] = useState<"vorlage" | "neu">("neu");
    const [rezeptLines, setRezeptLines] = useState<RezeptLine[]>([]);
    const [rezeptDraft, setRezeptDraft] = useState<RezeptLine>(() => emptyRezeptLine());
    const [rezeptSharedNotes, setRezeptSharedNotes] = useState("");
    const [rezeptBaselineJson, setRezeptBaselineJson] = useState<string | null>(null);
    const [rezeptDraftErr, setRezeptDraftErr] = useState<string | null>(null);
    const [rezeptComposerBusy, setRezeptComposerBusy] = useState(false);
    const [rezeptNewVorlageTitel, setRezeptNewVorlageTitel] = useState("");
    const [rezeptPendingQueue, setRezeptPendingQueue] = useState<{ lines: RezeptLine[]; shared: string } | null>(null);
    const [rezeptEdit, setRezeptEdit] = useState<Rezept | null>(null);
    const [rezeptEditUnlocked, setRezeptEditUnlocked] = useState(false);
    const [rezeptEditForm, setRezeptEditForm] = useState({
        medikament: "",
        wirkstoff: "",
        dosierung: "",
        dauer: "",
        hinweise: "",
    });

    useEffect(() => {
        if (rezeptEdit) setRezeptEditUnlocked(false);
    }, [rezeptEdit?.id]);

    const resetRezeptWizard = useCallback(() => {
        setRezeptWizardStep(null);
        setRezeptLines([]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptBaselineJson(null);
        setRezeptDraftErr(null);
        setRezeptComposerKind("neu");
        setRezeptComposerBusy(false);
        setRezeptPickQuery("");
        setRezeptPickSelectedId("");
        setRezeptPendingQueue(null);
        setRezeptNewVorlageTitel("");
    }, []);

    const resetAttestWizard = useCallback(() => {
        const t = new Date().toISOString().slice(0, 10);
        setAttestWizardStep(null);
        setAttestForm(emptyAttestComposerForm(t));
        setAttestBaselineJson(null);
        setAttestDraftErr(null);
        setAttestComposerKind("neu");
        setAttestComposerBusy(false);
        setAttestPickQuery("");
        setAttestPickSelectedId("");
        setAttestPendingQueue(null);
        setAttestNewVorlageTitel("");
    }, []);

    useEffect(() => {
        if (!canWriteMedical) return;
        let cancelled = false;
        void listDokumentVorlagen()
            .then((all) => {
                if (!cancelled) {
                    setRezeptVorlagen(all.filter((v) => v.kind === "REZEPT"));
                    setAttestVorlagen(all.filter((v) => v.kind === "ATTEST"));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setRezeptVorlagen([]);
                    setAttestVorlagen([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [canWriteMedical]);

    const rezeptPickFiltered = useMemo(() => {
        const q = rezeptPickQuery.trim().toLowerCase();
        if (!q) return rezeptVorlagen;
        return rezeptVorlagen.filter((v) => v.titel.toLowerCase().includes(q));
    }, [rezeptVorlagen, rezeptPickQuery]);

    const rezeptListeGeaendert = useMemo(() => {
        if (rezeptComposerKind !== "vorlage" || !rezeptBaselineJson) return false;
        return JSON.stringify(rezeptLines) !== rezeptBaselineJson;
    }, [rezeptComposerKind, rezeptBaselineJson, rezeptLines]);

    const attestPickFiltered = useMemo(() => {
        const q = attestPickQuery.trim().toLowerCase();
        if (!q) return attestVorlagen;
        return attestVorlagen.filter((v) => v.titel.toLowerCase().includes(q));
    }, [attestVorlagen, attestPickQuery]);

    const attestListeGeaendert = useMemo(() => {
        if (attestComposerKind !== "vorlage" || !attestBaselineJson) return false;
        return JSON.stringify(attestForm) !== attestBaselineJson;
    }, [attestComposerKind, attestBaselineJson, attestForm]);

    const handleDeleteRezept = async () => {
        if (!rezeptDeleteId) return;
        try {
            await deleteRezept(rezeptDeleteId);
            toast("Rezept gelöscht");
            setRezeptDeleteId(null);
            await onReload();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const handleDeleteAttest = async () => {
        if (!attestDeleteId) return;
        try {
            await deleteAttest(attestDeleteId);
            toast("Attest gelöscht");
            setAttestDeleteId(null);
            await onReload();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const buildRezeptQueueFromComposer = (): RezeptLine[] | null => {
        const hasDraft =
            rezeptDraft.medikament.trim()
            || rezeptDraft.dosierung.trim()
            || rezeptDraft.dauer.trim()
            || rezeptDraft.wirkstoff.trim()
            || rezeptDraft.hinweise.trim();
        const out = [...rezeptLines];
        if (hasDraft) {
            const err = validateRezeptLine(rezeptDraft);
            if (err) {
                setRezeptDraftErr(err);
                return null;
            }
            out.push({ ...rezeptDraft });
        }
        if (out.length === 0) {
            setRezeptDraftErr("Mindestens eine vollständige Medikamentenzeile erforderlich.");
            return null;
        }
        setRezeptDraftErr(null);
        return out;
    };

    const submitRezeptComposer = async () => {
        const queue = buildRezeptQueueFromComposer();
        if (!queue) return;
        if (rezeptComposerKind === "vorlage") {
            void persistPatientRezepte(actionsCtx, queue, rezeptSharedNotes, resetRezeptWizard);
            return;
        }
        setRezeptPendingQueue({ lines: queue, shared: rezeptSharedNotes });
        setRezeptComposerBusy(false);
        setRezeptLines([]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptBaselineJson(null);
        setRezeptDraftErr(null);
        setRezeptWizardStep("ask_vorlage");
    };

    const onRezeptAskVorlageNo = () => {
        const p = rezeptPendingQueue;
        if (!p) return;
        setRezeptPendingQueue(null);
        void persistPatientRezepte(actionsCtx, p.lines, p.shared, resetRezeptWizard);
    };

    const onRezeptAskVorlageYes = () => {
        setRezeptNewVorlageTitel("");
        setRezeptWizardStep("name_vorlage");
    };

    const onRezeptNameVorlageSkip = () => {
        const p = rezeptPendingQueue;
        if (!p) return;
        setRezeptPendingQueue(null);
        void persistPatientRezepte(actionsCtx, p.lines, p.shared, resetRezeptWizard);
    };

    const onRezeptNameVorlageSave = () => {
        const titel = rezeptNewVorlageTitel.trim();
        if (!titel) {
            toast("Bitte einen Namen für die Vorlage eingeben.", "error");
            return;
        }
        const p = rezeptPendingQueue;
        if (!p) return;
        onAkteSaveConfirm({ kind: "rezept_finalize_vorlage", titel, lines: p.lines, shared: p.shared });
    };

    const submitAttestComposer = () => {
        const err = validateAttestComposer(attestForm);
        if (err) {
            setAttestDraftErr(err);
            return;
        }
        setAttestDraftErr(null);
        if (attestComposerKind === "vorlage") {
            void persistPatientAttest(actionsCtx, attestForm, { onAfterSave: resetAttestWizard });
            return;
        }
        setAttestPendingQueue({ ...attestForm });
        setAttestWizardStep("ask_vorlage");
        setAttestForm(emptyAttestComposerForm(new Date().toISOString().slice(0, 10)));
    };

    const onAttestAskVorlageNo = () => {
        const p = attestPendingQueue;
        if (!p) return;
        setAttestPendingQueue(null);
        void persistPatientAttest(actionsCtx, p, { onAfterSave: resetAttestWizard });
    };

    const onAttestAskVorlageYes = () => {
        setAttestNewVorlageTitel("");
        setAttestWizardStep("name_vorlage");
    };

    const onAttestNameVorlageSkip = () => {
        const p = attestPendingQueue;
        if (!p) return;
        setAttestPendingQueue(null);
        void persistPatientAttest(actionsCtx, p, { onAfterSave: resetAttestWizard });
    };

    const onAttestNameVorlageSave = () => {
        const titel = attestNewVorlageTitel.trim();
        if (!titel) {
            toast("Bitte einen Namen für die Vorlage eingeben.", "error");
            return;
        }
        const p = attestPendingQueue;
        if (!p) return;
        onAkteSaveConfirm({ kind: "attest_finalize_vorlage", titel, fields: p });
    };

    const runSaveRezeptEdit = async () => {
        if (!rezeptEdit) return;
        if (!rezeptEditUnlocked) {
            toast("Zum Bearbeiten zuerst „Bearbeiten“ wählen.", "info");
            return;
        }
        const rid = rezeptEdit.id;
        const prevSnap = {
            medikament: rezeptEdit.medikament,
            wirkstoff: rezeptEdit.wirkstoff,
            dosierung: rezeptEdit.dosierung,
            dauer: rezeptEdit.dauer,
            hinweise: rezeptEdit.hinweise,
        };
        try {
            await updateRezept({
                id: rid,
                medikament: rezeptEditForm.medikament.trim(),
                wirkstoff: rezeptEditForm.wirkstoff.trim() || null,
                dosierung: rezeptEditForm.dosierung.trim(),
                dauer: rezeptEditForm.dauer.trim(),
                hinweise: rezeptEditForm.hinweise.trim() || null,
            });
            toast("Rezept gespeichert", "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateRezept({
                            id: rid,
                            medikament: prevSnap.medikament,
                            wirkstoff: prevSnap.wirkstoff,
                            dosierung: prevSnap.dosierung,
                            dauer: prevSnap.dauer,
                            hinweise: prevSnap.hinweise,
                        });
                        await onReload();
                    } catch (e) {
                        toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
                    }
                },
            });
            setRezeptEdit(null);
            await onReload();
        } catch (e) {
            toast(`Fehler: ${e instanceof Error ? e.message : String(e)}`, "error");
        }
    };

    const openRezeptPick = () => {
        setRezeptEdit(null);
        setRezeptDeleteId(null);
        resetRezeptWizard();
        setRezeptWizardStep("pick");
    };

    const proceedRezeptPick = () => {
        const sel =
            rezeptPickSelectedId
            || rezeptVorlagen.find((v) => v.titel.toLowerCase() === rezeptPickQuery.trim().toLowerCase())?.id
            || "";
        const v = rezeptVorlagen.find((x) => x.id === sel);
        if (!v) {
            toast("Bitte eine Vorlage aus der Liste wählen oder den Namen exakt eingeben.", "error");
            return;
        }
        const lines = vorlageItemsToLines(parseRezeptVorlagePayload(v.payload));
        if (lines.length === 0) {
            toast("Diese Vorlage enthält keine Medikamente.", "error");
            return;
        }
        setRezeptLines(lines.map((ln) => ({ ...ln })));
        setRezeptBaselineJson(JSON.stringify(lines));
        setRezeptComposerKind("vorlage");
        setRezeptDraft(emptyRezeptLine());
        setRezeptSharedNotes("");
        setRezeptDraftErr(null);
        setRezeptWizardStep("compose");
    };

    const openRezeptNeu = () => {
        setRezeptEdit(null);
        setRezeptDeleteId(null);
        resetRezeptWizard();
        setRezeptComposerKind("neu");
        setRezeptWizardStep("compose");
    };

    const openAttestPick = () => {
        setAttestDeleteId(null);
        resetAttestWizard();
        setAttestWizardStep("pick");
    };

    const proceedAttestPick = () => {
        const sel =
            attestPickSelectedId
            || attestVorlagen.find((v) => v.titel.toLowerCase() === attestPickQuery.trim().toLowerCase())?.id
            || "";
        const v = attestVorlagen.find((x) => x.id === sel);
        if (!v) {
            toast("Bitte eine Vorlage aus der Liste wählen oder den Namen exakt eingeben.", "error");
            return;
        }
        const parsed = parseAttestVorlagePayload(v.payload);
        const rawTage = parsed.tageAnzahl.trim() || "1";
        const n = Number.parseInt(rawTage, 10);
        if (!Number.isFinite(n) || n < 1 || n > 366) {
            toast("Diese Vorlage enthält keine gültige Tagesanzahl (1–366).", "error");
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const krank = parsed.krankheiten.trim() || (KRANKHEITEN_SUGGESTIONS[0] ?? "");
        const nextForm: AttestComposerFormFields = {
            typ: ATTEST_TYP_OPTIONS[0]!.value,
            krankheiten: krank,
            tageAnzahl: String(n),
            einschraenkung: parsed.einschraenkung.trim(),
            gueltig_von: today,
            gueltig_bis: attestGueltigBisFromVonAndTage(today, String(n)),
            icd10_code: "",
            erst_oder_folge: "ERST",
            arbeitgeber: "",
        };
        setAttestForm(nextForm);
        setAttestBaselineJson(JSON.stringify(nextForm));
        setAttestComposerKind("vorlage");
        setAttestDraftErr(null);
        setAttestWizardStep("compose");
    };

    const openAttestNeu = () => {
        setAttestDeleteId(null);
        resetAttestWizard();
        setAttestComposerKind("neu");
        setAttestWizardStep("compose");
    };

    const handlePrintAttest = (a: Attest) => {
        if (!ensurePraxisForDocument("attest")) return;
        onHtmlDocExport({
            kind: "attest",
            bundle: bundleAttestExport(a, patient),
            suggestedBasename: suggestAttestExportBasename(a),
            exportPreviewTitle: `Attest — ${patient.name}`,
        });
    };

    const handlePrintRezept = (r: Rezept) => {
        if (!ensurePraxisForDocument("rezept")) return;
        onHtmlDocExport({
            kind: "rezept",
            bundle: bundleRezeptExport(r, patient),
            suggestedBasename: suggestRezeptExportBasename(r),
            exportPreviewTitle: `Rezept — ${patient.name}`,
        });
    };

    const patchRezeptLine = (idx: number, part: Partial<RezeptLine>) => {
        setRezeptLines((prev) => prev.map((row, j) => (j === idx ? { ...row, ...part } : row)));
    };

    const pickMedForRezeptDraft = (label: string) => {
        const sugg = findSuggestion(label);
        setRezeptDraft((prev) => ({
            ...prev,
            medikament: label,
            wirkstoff: prev.wirkstoff || sugg?.wirkstoff || "",
            dosierung: prev.dosierung || sugg?.dosierung || "",
        }));
    };

    const addRezeptDraftLine = () => {
        const err = validateRezeptLine(rezeptDraft);
        if (err) {
            setRezeptDraftErr(err);
            return;
        }
        setRezeptLines((prev) => [...prev, { ...rezeptDraft }]);
        setRezeptDraft(emptyRezeptLine());
        setRezeptDraftErr(null);
    };

    const flushAkteSaveConfirm = useCallback(
        async (p: AkteSavePending): Promise<boolean> => {
            if (p.kind === "rezept_finalize_vorlage") {
                await flushRezeptFinalizeVorlage(actionsCtx, p, {
                    setComposerBusy: setRezeptComposerBusy,
                    clearPending: () => {
                        setRezeptPendingQueue(null);
                        setRezeptNewVorlageTitel("");
                        resetRezeptWizard();
                    },
                    refreshRezeptVorlagen: async () => {
                        setRezeptVorlagen(await refreshDokumentVorlagen("REZEPT"));
                    },
                });
                return true;
            }
            if (p.kind === "attest_finalize_vorlage") {
                await flushAttestFinalizeVorlage(actionsCtx, p, {
                    setComposerBusy: setAttestComposerBusy,
                    clearPending: () => {
                        setAttestPendingQueue(null);
                        setAttestNewVorlageTitel("");
                        resetAttestWizard();
                    },
                    refreshAttestVorlagen: async () => {
                        setAttestVorlagen(await refreshDokumentVorlagen("ATTEST"));
                    },
                });
                return true;
            }
            return false;
        },
        [actionsCtx, resetRezeptWizard, resetAttestWizard],
    );

    return {
        id: patientId,
        canWriteMedical,
        rezeptAttestSub,
        setRezeptAttestSub,
        resetRezeptWizard,
        resetAttestWizard,
        rezepte,
        atteste,
        rezeptDeleteId,
        setRezeptDeleteId,
        attestDeleteId,
        setAttestDeleteId,
        openRezeptPick,
        openRezeptNeu,
        openAttestPick,
        openAttestNeu,
        proceedRezeptPick,
        proceedAttestPick,
        handleDeleteRezept,
        handleDeleteAttest,
        handlePrintRezept,
        handlePrintAttest,
        runSaveRezeptEdit,
        rezeptEdit,
        setRezeptEdit,
        rezeptEditUnlocked,
        setRezeptEditUnlocked,
        rezeptEditForm,
        setRezeptEditForm,
        rezeptWizardStep,
        rezeptWizardPanelRef,
        rezeptComposerKind,
        rezeptLines,
        rezeptDraft,
        setRezeptDraft,
        rezeptSharedNotes,
        setRezeptSharedNotes,
        rezeptDraftErr,
        rezeptComposerBusy,
        rezeptPickQuery,
        setRezeptPickQuery,
        setRezeptPickSelectedId,
        rezeptNewVorlageTitel,
        setRezeptNewVorlageTitel,
        rezeptVorlagen,
        rezeptPickFiltered,
        rezeptListeGeaendert,
        submitRezeptComposer,
        onRezeptAskVorlageNo,
        onRezeptAskVorlageYes,
        onRezeptNameVorlageSkip,
        onRezeptNameVorlageSave,
        patchRezeptLine,
        pickMedForRezeptDraft,
        addRezeptDraftLine,
        setRezeptLines,
        attestWizardStep,
        attestWizardPanelRef,
        attestComposerKind,
        attestForm,
        setAttestForm,
        attestDraftErr,
        attestComposerBusy,
        attestPickQuery,
        setAttestPickQuery,
        setAttestPickSelectedId,
        attestNewVorlageTitel,
        setAttestNewVorlageTitel,
        attestVorlagen,
        attestPickFiltered,
        attestListeGeaendert,
        submitAttestComposer,
        onAttestAskVorlageNo,
        onAttestAskVorlageYes,
        onAttestNameVorlageSkip,
        onAttestNameVorlageSave,
        flushAkteSaveConfirm,
    };
}
