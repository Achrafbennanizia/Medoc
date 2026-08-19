import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { deleteCertificate } from "@/systems/practice-host/controllers/certificate.controller";
import { deletePrescription, updatePrescription } from "@/systems/practice-host/controllers/prescription.controller";
import type { Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import type { Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { listDocumentTemplates } from "@/systems/practice-host/controllers/practice.controller";
import {
    CERTIFICATE_KIND_VALUES,
    certificateGueltigUntilFromFromAndTage,
    defaultIllnessLabel,
    emptyCertificateComposerForm,
    parseCertificateTemplatePayload,
    validateCertificateComposer,
    type CertificateComposerFormFields,
} from "@/lib/certificate-composer";
import {
    bundleCertificateExport,
    bundlePrescriptionExport,
    suggestCertificateExportBasename,
    suggestPrescriptionExportBasename,
} from "@/lib/document-print-html";
import {
    emptyPrescriptionLine,
    findSuggestion,
    parsePrescriptionTemplatePayload,
    templateItemsToLines,
    type PrescriptionLine,
} from "@/lib/medications";
import {
    flushCertificateFinalizeTemplate,
    flushPrescriptionFinalizeTemplate,
    persistPatientCertificate,
    persistPatientPrescriptions,
    refreshDocumentTemplates,
    type PatientDetailPrescriptionActionsCtx,
    type PatientDetailPrescriptionToast,
} from "@/lib/patient-detail-prescription-actions";
import {
    PATIENT_DETAIL_TOAST_UNDO_MS,
    validatePrescriptionLine,
    type ChartSavePending,
    type CertificateWizardStep,
    type PrescriptionWizardStep,
} from "@/lib/patient-detail-utils";
import type { DocumentKind } from "@/lib/document-template-schema";
import type { DocumentTemplate, Patient } from "@/models/types";
import { useToastStore } from "@/views/components/ui/toast-store";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import type { ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { useT, useTParams } from "@/lib/i18n";

export type PatientDetailPrescriptionTabProps = {
    patientId: string;
    patient: Patient;
    prescriptions: Prescription[];
    certificates: Certificate[];
    canWriteMedical: boolean;
    userId: string;
    onReload: () => void | Promise<void>;
    onChartSaveConfirm: (pending: ChartSavePending) => void;
    onHtmlDocExport: (payload: {
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    }) => void;
    ensurePracticeForDocument: (kind: DocumentKind) => boolean;
};

export function usePatientDetailPrescriptionTab({
    patientId,
    patient,
    prescriptions,
    certificates,
    canWriteMedical,
    userId,
    onReload,
    onChartSaveConfirm,
    onHtmlDocExport,
    ensurePracticeForDocument,
}: PatientDetailPrescriptionTabProps) {
    const toast = useToastStore((s) => s.add) as PatientDetailPrescriptionToast;
    const t = useT();
    const tp = useTParams();
    const actionsCtx: PatientDetailPrescriptionActionsCtx = useMemo(
        () => ({ patientId, userId, onReload, toast }),
        [patientId, userId, onReload, toast],
    );

    const [prescriptionCertificateSub, setPrescriptionCertificateSub] = useState<"prescription" | "certificate">("prescription");
    const [prescriptionDeleteId, setPrescriptionDeleteId] = useState<string | null>(null);
    const [certificateDeleteId, setCertificateDeleteId] = useState<string | null>(null);
    const [certificateTemplates, setCertificateTemplates] = useState<DocumentTemplate[]>([]);
    const [certificateWizardStep, setCertificateWizardStep] = useState<CertificateWizardStep>(null);
    const certificateWizardPanelRef = useRef<HTMLDivElement>(null);
    const [certificateComposerKind, setCertificateComposerKind] = useState<"template" | "new">("new");
    const [certificateForm, setCertificateForm] = useState<CertificateComposerFormFields>(() =>
        emptyCertificateComposerForm(new Date().toISOString().slice(0, 10), t));
    const [certificateBaselineJson, setCertificateBaselineJson] = useState<string | null>(null);
    const [certificateComposerBusy, setCertificateComposerBusy] = useState(false);
    const [certificateDraftErr, setCertificateDraftErr] = useState<string | null>(null);
    const [certificatePickQuery, setCertificatePickQuery] = useState("");
    const [certificatePickSelectedId, setCertificatePickSelectedId] = useState("");
    const [certificateNewTemplateTitle, setCertificateNewTemplateTitle] = useState("");
    const [certificatePendingQueue, setCertificatePendingQueue] = useState<CertificateComposerFormFields | null>(null);

    const [prescriptionTemplates, setPrescriptionTemplates] = useState<DocumentTemplate[]>([]);
    const [prescriptionPickQuery, setPrescriptionPickQuery] = useState("");
    const [prescriptionPickSelectedId, setPrescriptionPickSelectedId] = useState("");
    const [prescriptionWizardStep, setPrescriptionWizardStep] = useState<PrescriptionWizardStep>(null);
    const prescriptionWizardPanelRef = useRef<HTMLDivElement>(null);
    const [prescriptionComposerKind, setPrescriptionComposerKind] = useState<"template" | "new">("new");
    const [prescriptionLines, setPrescriptionLines] = useState<PrescriptionLine[]>([]);
    const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionLine>(() => emptyPrescriptionLine());
    const [prescriptionSharedNotes, setPrescriptionSharedNotes] = useState("");
    const [prescriptionBaselineJson, setPrescriptionBaselineJson] = useState<string | null>(null);
    const [prescriptionDraftErr, setPrescriptionDraftErr] = useState<string | null>(null);
    const [prescriptionComposerBusy, setPrescriptionComposerBusy] = useState(false);
    const [prescriptionNewTemplateTitle, setPrescriptionNewTemplateTitle] = useState("");
    const [prescriptionPendingQueue, setPrescriptionPendingQueue] = useState<{ lines: PrescriptionLine[]; shared: string } | null>(null);
    const [prescriptionEdit, setPrescriptionEdit] = useState<Prescription | null>(null);
    const [prescriptionEditUnlocked, setPrescriptionEditUnlocked] = useState(false);
    const [prescriptionEditForm, setPrescriptionEditForm] = useState({
        medication: "",
        active_ingredient: "",
        dosage: "",
        duration: "",
        instructions: "",
    });

    const prescriptionEditId = prescriptionEdit?.id ?? null;
    useEffect(() => {
        if (prescriptionEditId) setPrescriptionEditUnlocked(false);
    }, [prescriptionEditId]);

    const resetPrescriptionWizard = useCallback(() => {
        setPrescriptionWizardStep(null);
        setPrescriptionLines([]);
        setPrescriptionDraft(emptyPrescriptionLine());
        setPrescriptionSharedNotes("");
        setPrescriptionBaselineJson(null);
        setPrescriptionDraftErr(null);
        setPrescriptionComposerKind("new");
        setPrescriptionComposerBusy(false);
        setPrescriptionPickQuery("");
        setPrescriptionPickSelectedId("");
        setPrescriptionPendingQueue(null);
        setPrescriptionNewTemplateTitle("");
    }, []);

    const resetCertificateWizard = useCallback(() => {
        const today = new Date().toISOString().slice(0, 10);
        setCertificateWizardStep(null);
        setCertificateForm(emptyCertificateComposerForm(today, t));
        setCertificateBaselineJson(null);
        setCertificateDraftErr(null);
        setCertificateComposerKind("new");
        setCertificateComposerBusy(false);
        setCertificatePickQuery("");
        setCertificatePickSelectedId("");
        setCertificatePendingQueue(null);
        setCertificateNewTemplateTitle("");
    }, [t]);

    useEffect(() => {
        if (!canWriteMedical) return;
        let cancelled = false;
        void listDocumentTemplates()
            .then((all) => {
                if (!cancelled) {
                    setPrescriptionTemplates(all.filter((version) => version.kind === "PRESCRIPTION"));
                    setCertificateTemplates(all.filter((version) => version.kind === "CERTIFICATE"));
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPrescriptionTemplates([]);
                    setCertificateTemplates([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [canWriteMedical]);

    const prescriptionPickFiltered = useMemo(() => {
        const q = prescriptionPickQuery.trim().toLowerCase();
        if (!q) return prescriptionTemplates;
        return prescriptionTemplates.filter((version) => version.title.toLowerCase().includes(q));
    }, [prescriptionTemplates, prescriptionPickQuery]);

    const prescriptionListeGeaendert = useMemo(() => {
        if (prescriptionComposerKind !== "template" || !prescriptionBaselineJson) return false;
        return JSON.stringify(prescriptionLines) !== prescriptionBaselineJson;
    }, [prescriptionComposerKind, prescriptionBaselineJson, prescriptionLines]);

    const certificatePickFiltered = useMemo(() => {
        const q = certificatePickQuery.trim().toLowerCase();
        if (!q) return certificateTemplates;
        return certificateTemplates.filter((version) => version.title.toLowerCase().includes(q));
    }, [certificateTemplates, certificatePickQuery]);

    const certificateListeGeaendert = useMemo(() => {
        if (certificateComposerKind !== "template" || !certificateBaselineJson) return false;
        return JSON.stringify(certificateForm) !== certificateBaselineJson;
    }, [certificateComposerKind, certificateBaselineJson, certificateForm]);

    const handleDeletePrescription = async () => {
        if (!prescriptionDeleteId) return;
        try {
            await deletePrescription(prescriptionDeleteId);
            toast(t("patient.detail.toast.prescription_deleted"));
            setPrescriptionDeleteId(null);
            await onReload();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteCertificate = async () => {
        if (!certificateDeleteId) return;
        try {
            await deleteCertificate(certificateDeleteId);
            toast(t("patient.detail.toast.certificate_deleted"));
            setCertificateDeleteId(null);
            await onReload();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const buildPrescriptionQueueFromComposer = (): PrescriptionLine[] | null => {
        const hasDraft =
            prescriptionDraft.medication.trim()
            || prescriptionDraft.dosage.trim()
            || prescriptionDraft.duration.trim()
            || prescriptionDraft.active_ingredient.trim()
            || prescriptionDraft.instructions.trim();
        const out = [...prescriptionLines];
        if (hasDraft) {
            const err = validatePrescriptionLine(prescriptionDraft, t);
            if (err) {
                setPrescriptionDraftErr(err);
                return null;
            }
            out.push({ ...prescriptionDraft });
        }
        if (out.length === 0) {
            setPrescriptionDraftErr(t("patient.detail.toast.prescription_line_required"));
            return null;
        }
        setPrescriptionDraftErr(null);
        return out;
    };

    const submitPrescriptionComposer = async () => {
        const queue = buildPrescriptionQueueFromComposer();
        if (!queue) return;
        if (prescriptionComposerKind === "template") {
            void persistPatientPrescriptions(actionsCtx, queue, prescriptionSharedNotes, resetPrescriptionWizard);
            return;
        }
        setPrescriptionPendingQueue({ lines: queue, shared: prescriptionSharedNotes });
        setPrescriptionComposerBusy(false);
        setPrescriptionLines([]);
        setPrescriptionDraft(emptyPrescriptionLine());
        setPrescriptionSharedNotes("");
        setPrescriptionBaselineJson(null);
        setPrescriptionDraftErr(null);
        setPrescriptionWizardStep("ask_template");
    };

    const onPrescriptionAskTemplateNo = () => {
        const p = prescriptionPendingQueue;
        if (!p) return;
        setPrescriptionPendingQueue(null);
        void persistPatientPrescriptions(actionsCtx, p.lines, p.shared, resetPrescriptionWizard);
    };

    const onPrescriptionAskTemplateYes = () => {
        setPrescriptionNewTemplateTitle("");
        setPrescriptionWizardStep("name_template");
    };

    const onPrescriptionNameTemplateSkip = () => {
        const p = prescriptionPendingQueue;
        if (!p) return;
        setPrescriptionPendingQueue(null);
        void persistPatientPrescriptions(actionsCtx, p.lines, p.shared, resetPrescriptionWizard);
    };

    const onPrescriptionNameTemplateSave = () => {
        const title = prescriptionNewTemplateTitle.trim();
        if (!title) {
            toast(t("patient.detail.toast.template_name_required"), "error");
            return;
        }
        const p = prescriptionPendingQueue;
        if (!p) return;
        onChartSaveConfirm({ kind: "prescription_finalize_template", title, lines: p.lines, shared: p.shared });
    };

    const submitCertificateComposer = () => {
        const err = validateCertificateComposer(certificateForm, t);
        if (err) {
            setCertificateDraftErr(err);
            return;
        }
        setCertificateDraftErr(null);
        if (certificateComposerKind === "template") {
            void persistPatientCertificate(actionsCtx, certificateForm, { onAfterSave: resetCertificateWizard });
            return;
        }
        setCertificatePendingQueue({ ...certificateForm });
        setCertificateWizardStep("ask_template");
        setCertificateForm(emptyCertificateComposerForm(new Date().toISOString().slice(0, 10), t));
    };

    const onCertificateAskTemplateNo = () => {
        const p = certificatePendingQueue;
        if (!p) return;
        setCertificatePendingQueue(null);
        void persistPatientCertificate(actionsCtx, p, { onAfterSave: resetCertificateWizard });
    };

    const onCertificateAskTemplateYes = () => {
        setCertificateNewTemplateTitle("");
        setCertificateWizardStep("name_template");
    };

    const onCertificateNameTemplateSkip = () => {
        const p = certificatePendingQueue;
        if (!p) return;
        setCertificatePendingQueue(null);
        void persistPatientCertificate(actionsCtx, p, { onAfterSave: resetCertificateWizard });
    };

    const onCertificateNameTemplateSave = () => {
        const title = certificateNewTemplateTitle.trim();
        if (!title) {
            toast(t("patient.detail.toast.template_name_required"), "error");
            return;
        }
        const p = certificatePendingQueue;
        if (!p) return;
        onChartSaveConfirm({ kind: "certificate_finalize_template", title, fields: p });
    };

    const runSavePrescriptionEdit = async () => {
        if (!prescriptionEdit) return;
        if (!prescriptionEditUnlocked) {
            toast(t("patient.detail.toast.edit_unlock_first"), "info");
            return;
        }
        const rid = prescriptionEdit.id;
        const prevSnap = {
            medication: prescriptionEdit.medication,
            active_ingredient: prescriptionEdit.active_ingredient,
            dosage: prescriptionEdit.dosage,
            duration: prescriptionEdit.duration,
            instructions: prescriptionEdit.instructions,
        };
        try {
            await updatePrescription({
                id: rid,
                medication: prescriptionEditForm.medication.trim(),
                active_ingredient: prescriptionEditForm.active_ingredient.trim() || null,
                dosage: prescriptionEditForm.dosage.trim(),
                duration: prescriptionEditForm.duration.trim(),
                instructions: prescriptionEditForm.instructions.trim() || null,
            });
            toast(t("patient.detail.toast.prescription_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updatePrescription({
                            id: rid,
                            medication: prevSnap.medication,
                            active_ingredient: prevSnap.active_ingredient,
                            dosage: prevSnap.dosage,
                            duration: prevSnap.duration,
                            instructions: prevSnap.instructions,
                        });
                        await onReload();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setPrescriptionEdit(null);
            await onReload();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const openPrescriptionPick = () => {
        setPrescriptionEdit(null);
        setPrescriptionDeleteId(null);
        resetPrescriptionWizard();
        setPrescriptionWizardStep("pick");
    };

    const proceedPrescriptionPick = () => {
        const sel =
            prescriptionPickSelectedId
            || prescriptionTemplates.find((version) => version.title.toLowerCase() === prescriptionPickQuery.trim().toLowerCase())?.id
            || "";
        const version = prescriptionTemplates.find((x) => x.id === sel);
        if (!version) {
            toast(t("patient.detail.toast.template_pick_required"), "error");
            return;
        }
        const lines = templateItemsToLines(parsePrescriptionTemplatePayload(version.payload));
        if (lines.length === 0) {
            toast(t("patient.detail.toast.template_no_meds"), "error");
            return;
        }
        setPrescriptionLines(lines.map((ln) => ({ ...ln })));
        setPrescriptionBaselineJson(JSON.stringify(lines));
        setPrescriptionComposerKind("template");
        setPrescriptionDraft(emptyPrescriptionLine());
        setPrescriptionSharedNotes("");
        setPrescriptionDraftErr(null);
        setPrescriptionWizardStep("compose");
    };

    const openPrescriptionNew = () => {
        setPrescriptionEdit(null);
        setPrescriptionDeleteId(null);
        resetPrescriptionWizard();
        setPrescriptionComposerKind("new");
        setPrescriptionWizardStep("compose");
    };

    const openCertificatePick = () => {
        setCertificateDeleteId(null);
        resetCertificateWizard();
        setCertificateWizardStep("pick");
    };

    const proceedCertificatePick = () => {
        const sel =
            certificatePickSelectedId
            || certificateTemplates.find((version) => version.title.toLowerCase() === certificatePickQuery.trim().toLowerCase())?.id
            || "";
        const version = certificateTemplates.find((x) => x.id === sel);
        if (!version) {
            toast(t("patient.detail.toast.template_pick_required"), "error");
            return;
        }
        const parsed = parseCertificateTemplatePayload(version.payload);
        const rawTage = parsed.tageAnzahl.trim() || "1";
        const n = Number.parseInt(rawTage, 10);
        if (!Number.isFinite(n) || n < 1 || n > 366) {
            toast(t("patient.detail.toast.template_invalid_days"), "error");
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        const krank = parsed.krankheiten.trim() || defaultIllnessLabel(t);
        const nextForm: CertificateComposerFormFields = {
            kind: CERTIFICATE_KIND_VALUES[0],
            krankheiten: krank,
            tageAnzahl: String(n),
            einschraenkung: parsed.einschraenkung.trim(),
            valid_from: today,
            valid_until: certificateGueltigUntilFromFromAndTage(today, String(n)),
            icd10_code: "",
            first_or_follow_up: "FIRST",
            employer: "",
        };
        setCertificateForm(nextForm);
        setCertificateBaselineJson(JSON.stringify(nextForm));
        setCertificateComposerKind("template");
        setCertificateDraftErr(null);
        setCertificateWizardStep("compose");
    };

    const openCertificateNew = () => {
        setCertificateDeleteId(null);
        resetCertificateWizard();
        setCertificateComposerKind("new");
        setCertificateWizardStep("compose");
    };

    const handlePrintCertificate = (a: Certificate) => {
        if (!ensurePracticeForDocument("certificate")) return;
        onHtmlDocExport({
            kind: "certificate",
            bundle: bundleCertificateExport(a, patient),
            suggestedBasename: suggestCertificateExportBasename(a),
            exportPreviewTitle: tp("patient.detail.export.certificate_title", { name: patient.name }),
        });
    };

    const handlePrintPrescription = (r: Prescription) => {
        if (!ensurePracticeForDocument("prescription")) return;
        onHtmlDocExport({
            kind: "prescription",
            bundle: bundlePrescriptionExport(r, patient),
            suggestedBasename: suggestPrescriptionExportBasename(r),
            exportPreviewTitle: tp("patient.detail.export.prescription_title", { name: patient.name }),
        });
    };

    const patchPrescriptionLine = (idx: number, part: Partial<PrescriptionLine>) => {
        setPrescriptionLines((prev) => prev.map((row, j) => (j === idx ? { ...row, ...part } : row)));
    };

    const pickMedForPrescriptionDraft = (label: string) => {
        const sugg = findSuggestion(label);
        setPrescriptionDraft((prev) => ({
            ...prev,
            medication: label,
            active_ingredient: prev.active_ingredient || sugg?.active_ingredient || "",
            dosage: prev.dosage || sugg?.dosage || "",
        }));
    };

    const addPrescriptionDraftLine = () => {
        const err = validatePrescriptionLine(prescriptionDraft, t);
        if (err) {
            setPrescriptionDraftErr(err);
            return;
        }
        setPrescriptionLines((prev) => [...prev, { ...prescriptionDraft }]);
        setPrescriptionDraft(emptyPrescriptionLine());
        setPrescriptionDraftErr(null);
    };

    const flushChartSaveConfirm = useCallback(
        async (p: ChartSavePending): Promise<boolean> => {
            if (p.kind === "prescription_finalize_template") {
                await flushPrescriptionFinalizeTemplate(actionsCtx, p, {
                    setComposerBusy: setPrescriptionComposerBusy,
                    clearPending: () => {
                        setPrescriptionPendingQueue(null);
                        setPrescriptionNewTemplateTitle("");
                        resetPrescriptionWizard();
                    },
                    refreshPrescriptionTemplates: async () => {
                        setPrescriptionTemplates(await refreshDocumentTemplates("PRESCRIPTION"));
                    },
                });
                return true;
            }
            if (p.kind === "certificate_finalize_template") {
                await flushCertificateFinalizeTemplate(actionsCtx, p, {
                    setComposerBusy: setCertificateComposerBusy,
                    clearPending: () => {
                        setCertificatePendingQueue(null);
                        setCertificateNewTemplateTitle("");
                        resetCertificateWizard();
                    },
                    refreshCertificateTemplates: async () => {
                        setCertificateTemplates(await refreshDocumentTemplates("CERTIFICATE"));
                    },
                });
                return true;
            }
            return false;
        },
        [actionsCtx, resetPrescriptionWizard, resetCertificateWizard],
    );

    return {
        id: patientId,
        canWriteMedical,
        prescriptionCertificateSub,
        setPrescriptionCertificateSub,
        resetPrescriptionWizard,
        resetCertificateWizard,
        prescriptions,
        certificates,
        prescriptionDeleteId,
        setPrescriptionDeleteId,
        certificateDeleteId,
        setCertificateDeleteId,
        openPrescriptionPick,
        openPrescriptionNew,
        openCertificatePick,
        openCertificateNew,
        proceedPrescriptionPick,
        proceedCertificatePick,
        handleDeletePrescription,
        handleDeleteCertificate,
        handlePrintPrescription,
        handlePrintCertificate,
        runSavePrescriptionEdit,
        prescriptionEdit,
        setPrescriptionEdit,
        prescriptionEditUnlocked,
        setPrescriptionEditUnlocked,
        prescriptionEditForm,
        setPrescriptionEditForm,
        prescriptionWizardStep,
        prescriptionWizardPanelRef,
        prescriptionComposerKind,
        prescriptionLines,
        prescriptionDraft,
        setPrescriptionDraft,
        prescriptionSharedNotes,
        setPrescriptionSharedNotes,
        prescriptionDraftErr,
        prescriptionComposerBusy,
        prescriptionPickQuery,
        setPrescriptionPickQuery,
        setPrescriptionPickSelectedId,
        prescriptionNewTemplateTitle,
        setPrescriptionNewTemplateTitle,
        prescriptionTemplates,
        prescriptionPickFiltered,
        prescriptionListeGeaendert,
        submitPrescriptionComposer,
        onPrescriptionAskTemplateNo,
        onPrescriptionAskTemplateYes,
        onPrescriptionNameTemplateSkip,
        onPrescriptionNameTemplateSave,
        patchPrescriptionLine,
        pickMedForPrescriptionDraft,
        addPrescriptionDraftLine,
        setPrescriptionLines,
        certificateWizardStep,
        certificateWizardPanelRef,
        certificateComposerKind,
        certificateForm,
        setCertificateForm,
        certificateDraftErr,
        certificateComposerBusy,
        certificatePickQuery,
        setCertificatePickQuery,
        setCertificatePickSelectedId,
        certificateNewTemplateTitle,
        setCertificateNewTemplateTitle,
        certificateTemplates,
        certificatePickFiltered,
        certificateListeGeaendert,
        submitCertificateComposer,
        onCertificateAskTemplateNo,
        onCertificateAskTemplateYes,
        onCertificateNameTemplateSkip,
        onCertificateNameTemplateSave,
        flushChartSaveConfirm,
    };
}
