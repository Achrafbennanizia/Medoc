import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    getChart,
    listDentalFindings,
    createDentalFinding,
    getAnamnesisForm,
    listTreatments,
    listExaminations,
    releaseTreatmentForBilling,
    listChartAttachments,
    renameChartAttachment,
    setChartAttachmentDocumentKind,
    createChartAttachmentFromPath,
    openChartAttachmentExternally,
    duplicateChartAttachment,
} from "@/systems/practice-host/controllers/chart.controller";
import { listTreatmentCatalog } from "@/systems/practice-host/controllers/practice.controller";
import { errorMessage, formatDate } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import type { Patient, PatientChart, DentalFinding, Treatment, Examination, TreatmentCatalogItem } from "@/models/types";
import { useAuthStore } from "@/models/store/auth-store";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT, useTParams } from "@/lib/i18n";
import { PageLoading } from "@/views/components/ui/page-status";
import { EMPTY_ANAMNESIS_V1_JSON, parseAnamnesisV1 } from "@/lib/anamnesis";
import { computeChartCompleteness, type ChartCompletenessGap } from "@/lib/chart-completeness";
import { PatientDetailChartSubnav } from "./patient-detail-chart-subnav";
import { PatientDetailShellHeader } from "./patient-detail-shell-header";
import { WorkspacePageHeader } from "@/views/components/administration-page-header";
import { usePatientDetailChartSave } from "./use-patient-detail-chart-save";
import { usePatientDetailClinicalActions } from "./use-patient-detail-clinical-actions";
import { usePatientDetailValidation } from "./use-patient-detail-validation";
import { usePatientDetailPaymentActions } from "./use-patient-detail-payment-actions";
import { PatientDetailOverlays } from "./patient-detail-overlays";
import type { PatientChartWorkflowMode } from "@/views/components/patient-chart-workflow-dialogs";
import { PatientDetailAnamTab } from "./patient-detail-anamnesis-tab";
import { PatientDetailAttachmentTab } from "./patient-detail-attachment-tab";
import { PatientDetailTreatmentTab } from "./patient-detail-treatment-tab";
import { PatientDetailExaminationTab } from "./patient-detail-examination-tab";
import { PatientDetailPaymentTab } from "./patient-detail-payment-tab";
import { PatientDetailPrescriptionTab, type PatientDetailPrescriptionTabHandle } from "./patient-detail-prescription-tab";
import type { HtmlExportDocumentKind } from "@/views/components/export-picker-dialog";
import { itemValidationKey, type ValidationRecord, type ValidationState } from "@/lib/chart-validation";
import { listPrescriptions, type Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { listCertificates, type Certificate } from "@/systems/practice-host/controllers/certificate.controller";
import { listPaymentsForPatient } from "@/systems/practice-host/controllers/payment.controller";
import type { Payment, PaymentMethod } from "@/models/types";
import {
    emptyPlanNextAppointment,
    planNextHasContent,
    type PlanNextAppointmentV2,
} from "@/lib/plan-next-appointment";
import { loadPlanNextAppointmentWithMigration, persistPlanNextAppointmentToBackend } from "@/systems/practice-host/controllers/plan-next-appointment.controller";
import {
    validateAttachmentFile,
    mapChartAttachmentRowDto,
    CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
    normalizeChartDocumentKind,
    type ChartAttachment,
} from "@/lib/chart-attachments";
import { ChartScannerImportDialog } from "@/views/components/chart-scanner-import-dialog";
import { loadClientSettings } from "@/lib/client-settings";
import { resolveOpenImageWithAppPath } from "@/lib/photo-viewer-apps";
import { type ClinicalDocumentExportBundle } from "@/lib/document-print-html";
import { getInvoicePracticeFromStorage } from "@/lib/invoice-service-item";
import { checkPracticeDocumentReadiness } from "@/lib/practice-completeness";
import type { DocumentKind } from "@/lib/document-template-schema";
import { openSystemScanUtility } from "@/systems/practice-host/controllers/system.controller";
import { buildOpenPaymentLinkSelectOptions } from "@/lib/payment-booking";
import {
    isPatientChartMissingError,
    patientDetailDefaultTab,
    patientDetailTabBlocked,
    resolvePatientDetailTabFromHash,
    resolveCatalogIdForTreatment,
    type ChartSavePending,
    type PatientDetailChartTab,
} from "@/lib/patient-detail-utils";

type ChartTab = PatientDetailChartTab;

export function PatientDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const detailQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const fromAppointmentCreate = detailQuery.get("from") === "appointment-create";
    const draft = detailQuery.get("draft") ?? "";
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canViewClinical = role != null && allowed("patient.read_medical", role);
    const canListPatientDocuments =
        role != null
        && (allowed("patient.read_medical", role) || allowed("patient.read_documents", role));
    const canListTreatmentsForPayment = role != null && allowed("patient.treatments_list_for_payment", role);
    const canWriteMedical = role != null && allowed("patient.write_medical", role);
    const canReadDocuments = role != null && allowed("patient.read_documents", role);
    const canReadFinance = role != null && allowed("finance.read", role);
    const canAuditRead = role != null && allowed("audit.read", role);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [patientLoadError, setPatientLoadError] = useState<string | null>(null);
    const [chartLoadError, setChartLoadError] = useState<string | null>(null);
    const [chart, setChart] = useState<PatientChart | null>(null);
    const [findings, setFindings] = useState<DentalFinding[]>([]);
    const [treatments, setTreatments] = useState<Treatment[]>([]);
    const [examinations, setExaminations] = useState<Examination[]>([]);
    const [anamnesisJson, setAnamnesisJson] = useState("");
    const [anamnesisSign, setAnamnesisSign] = useState(false);
    const [showUnterComposer, setShowUnterComposer] = useState(false);
    const [showTreatmentComposer, setShowTreatmentComposer] = useState(false);
    const [showClinicalPrices, setShowClinicalPrices] = useState(false);
    const [chartExportPickerOpen, setChartExportPickerOpen] = useState(false);
    const [dischargeLeafletOpen, setDischargeLeafletOpen] = useState(false);
    const [chartWorkflowMode, setChartWorkflowMode] = useState<PatientChartWorkflowMode>(null);
    const [practiceGuardKind, setPracticeGuardKind] = useState<DocumentKind | null>(null);

    const ensurePracticeForDocument = (kind: DocumentKind): boolean => {
        const readiness = checkPracticeDocumentReadiness(getInvoicePracticeFromStorage(), kind);
        if (!readiness.ready) {
            setPracticeGuardKind(kind);
            return false;
        }
        return true;
    };

    const [htmlDocExport, setHtmlDocExport] = useState<{
        kind: HtmlExportDocumentKind;
        bundle: ClinicalDocumentExportBundle;
        suggestedBasename: string;
        exportPreviewTitle: string;
        hint?: string;
    } | null>(null);
    const [catalog, setCatalog] = useState<TreatmentCatalogItem[]>([]);
    const [selectedTreatmentTooth, setSelectedTreatmentTooth] = useState<string | null>(null);
    /** Anamnesis: read-only first, fields unlock after edit action. */
    const [anamEditing, setAnamEditing] = useState(false);
    const [anamQuick, setAnamQuick] = useState({
        insuranceStatus: "",
        health_insurance: "",
        chronic: "",
        allergiesMed: "",
    });
    const [treatmentForm, setTreatmentForm] = useState({
        date: new Date().toISOString().slice(0, 10),
        category: "",
        service_name: "",
        serviceCatalogId: "",
        treatment_number: "",
        session_number: "",
        total_cost: "",
        treatment_status: "COMPLETED",
        appointment_required: "0",
        notes: "",
    });
    const [examinationForm, setExaminationForm] = useState({
        chief_complaint: "", results: "", diagnosis: "",
    });
    /** Aufgeklappter Examinations-Eintrag (zeigt strukturierte Detailansicht). */
    const [unterDetailId, setUnterDetailId] = useState<string | null>(null);
    const prescriptionTabRef = useRef<PatientDetailPrescriptionTabHandle>(null);
    const [activeTab, setActiveTab] = useState<ChartTab>(() => patientDetailDefaultTab(canViewClinical));
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    /** Unteransicht auf dem Tab „Prescriptions & Certificates“. */
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [attachments, setAttachments] = useState<ChartAttachment[]>([]);
    const attachmentsRef = useRef<ChartAttachment[]>([]);
    const [scannerImportOpen, setScannerImportOpen] = useState(false);
    const [scannerImportBusy, setScannerImportBusy] = useState(false);
    const attachmentFileInputId = useId();
    const attachmentCameraInputId = useId();
    const [showEditPatient, setShowEditPatient] = useState(false);
    const [chartSaveConfirm, setChartSaveConfirm] = useState<ChartSavePending | null>(null);
    const [chartSaveBusy, setChartSaveBusy] = useState(false);
    /** When save runs via popup (e.g. Examination), unblock composer here. */
    const [patientDeleteOpen, setPatientDeleteOpen] = useState(false);
    const [patientDeleteBusy, setPatientDeleteBusy] = useState(false);
    const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", address: "" });
    const [validation, setValidation] = useState<ValidationState>({});
    const [itemValidation, setItemValidation] = useState<Partial<Record<string, ValidationRecord>>>({});
    /** Physician → Reception: strukturierter Terminplan (SQLite `chart_next_appointment_hint`). */
    const [showPlanTip, setShowPlanTip] = useState(false);
    const [planNext, setPlanNext] = useState<PlanNextAppointmentV2>(() => emptyPlanNextAppointment());

    const appointmentBackLink = useMemo(() => {
        const pid = id ?? "";
        const q = new URLSearchParams();
        q.set("patient_id", pid);
        if (fromAppointmentCreate && draft) q.set("draft", draft);
        if (planNextHasContent(planNext)) q.set("apply_plan", "1");
        return `/appointments/new?${q.toString()}`;
    }, [id, fromAppointmentCreate, draft, planNext]);
    const [treatmentComposerMode, setTreatmentComposerMode] = useState<"new" | "continue" | null>(null);
    const [continueFromTreatmentId, setContinueFromTreatmentId] = useState<string>("");
    const [treatmentEditId, setTreatmentEditId] = useState<string | null>(null);
    /** When editing a row: view first (locked), then edit. New/continue: unlocked immediately. */
    const [treatmentFormUnlocked, setTreatmentFormUnlocked] = useState(true);
    const [treatmentDeleteId, setTreatmentDeleteId] = useState<string | null>(null);
    const [unterEdit, setUnterEdit] = useState<Examination | null>(null);
    const [unterEditUnlocked, setUnterEditUnlocked] = useState(false);
    const [unterDeleteId, setUnterDeleteId] = useState<string | null>(null);
    const [paymentEdit, setPaymentEdit] = useState<Payment | null>(null);
    const [paymentEditUnlocked, setPaymentEditUnlocked] = useState(false);
    const [paymentDeleteId, setPaymentDeleteId] = useState<string | null>(null);
    const [paymentEditForm, setPaymentEditForm] = useState({
        amount: "",
        payment_method: "CASH" as PaymentMethod,
        description: "",
    });
    const [showPaymentComposer, setShowPaymentComposer] = useState(false);
    const [paymentNewForm, setPaymentNewForm] = useState({
        linkKind: "" as "" | "treatment" | "examination",
        linkId: "",
        amount: "",
        payment_method: "CASH" as PaymentMethod,
        description: "",
    });
    const [paymentListenModus, setPaymentListenModus] = useState<"summe" | "historie">("summe");


    const toast = useToastStore((s) => s.add);
    const t = useT();
    const tp = useTParams();
    const canFinanceWrite = (() => {
        const r = parseRole(session?.role);
        return r ? allowed("finance.write", r) : false;
    })();

    const {
        validateSection,
        revokeSectionValidation,
        requestValidateItem,
        revokeItemValidationRow,
    } = usePatientDetailValidation({
        patientId: id,
        sessionUserId: session?.user_id,
        validation,
        setValidation,
        setItemValidation,
    });

    useEffect(() => {
        if (!id) return;
        void loadPlanNextAppointmentWithMigration(id)
            .then(setPlanNext)
            .catch((e: unknown) => {
                setPlanNext(emptyPlanNextAppointment());
                toast(
                    tp("patient.detail.toast.plan_load_failed", {
                        message: e instanceof Error ? e.message : String(e),
                    }),
                    "error",
                );
            });
    }, [id, toast, tp]);

    useEffect(() => {
        attachmentsRef.current = attachments;
    }, [attachments]);

    const persistPlanNext = useCallback(
        (next: PlanNextAppointmentV2) => {
            setPlanNext((prev) => {
                const merged =
                    canViewClinical ? next : { ...next, internalNote: prev.internalNote };
                if (id) {
                    void persistPlanNextAppointmentToBackend(id, merged).catch((e) => {
                        toast(tp("patient.detail.toast.plan_save_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
                    });
                }
                return merged;
            });
        },
        [id, toast, tp, canViewClinical],
    );

    useEffect(() => {
        const rawHash = location.hash.replace(/^#/, "");
        if (rawHash === "master") {
            const tab = patientDetailDefaultTab(canViewClinical);
            setActiveTab(tab);
            navigate({ pathname: location.pathname, search: location.search, hash: tab }, { replace: true });
            return;
        }
        const fromUrl = resolvePatientDetailTabFromHash(location.hash, canViewClinical);
        if (!fromUrl) return;
        if (patientDetailTabBlocked(fromUrl, canViewClinical)) {
            const fallback = patientDetailDefaultTab(canViewClinical);
            setActiveTab(fallback);
            navigate({ pathname: location.pathname, search: location.search, hash: fallback }, { replace: true });
            return;
        }
        setActiveTab(fromUrl);
    }, [location.hash, canViewClinical, navigate, location.pathname, location.search]);

    const goTab = (tab: ChartTab) => {
        setActiveTab(tab);
        navigate({ pathname: location.pathname, search: location.search, hash: tab }, { replace: true });
    };

    const refreshAttachments = useCallback(async (chartId: string) => {
        try {
            const rows = await listChartAttachments(chartId);
            setAttachments(rows.map(mapChartAttachmentRowDto));
        } catch (e) {
            toast(tp("patient.detail.toast.attachment_load_failed", { message: errorMessage(e) }), "error");
        }
    }, [toast, tp]);

    const load = useCallback(async () => {
        if (!id) return;
        setPatientLoadError(null);
        setChartLoadError(null);
        try {
            const p = await getPatient(id);
            setPatient(p);
            setEditForm({ name: p.name, phone: p.phone ?? "", email: p.email ?? "", address: p.address ?? "" });
        } catch (e) {
            setPatient(null);
            setPatientLoadError(e instanceof Error ? e.message : String(e));
            setChart(null);
            setFindings([]);
            setTreatments([]);
            setExaminations([]);
            setCatalog([]);
            return;
        }
        setFindings([]);
        setTreatments([]);
        setExaminations([]);
        setCatalog([]);
        setPrescriptions([]);
        setCertificates([]);
        setPayments([]);
        setAnamnesisJson("");
        setAnamnesisSign(false);
        try {
            const a = await getChart(id);
            setChart(a);
            void refreshAttachments(a.id);
            const [rez, zPat, att, katRows] = await Promise.all([
                canListPatientDocuments ? listPrescriptions(id) : Promise.resolve([] as Prescription[]),
                listPaymentsForPatient(id),
                canListPatientDocuments ? listCertificates(id) : Promise.resolve([] as Certificate[]),
                listTreatmentCatalog().catch((e) => {
                    toast(tp("patient.detail.toast.catalog_load_failed", { message: errorMessage(e) }), "warning");
                    return [] as TreatmentCatalogItem[];
                }),
            ]);
            setPrescriptions(rez);
            setPayments(zPat);
            setCertificates(att);
            setCatalog(katRows);
            if (canViewClinical) {
                const [z, bh, u, am] = await Promise.all([
                    listDentalFindings(a.id),
                    listTreatments(a.id),
                    listExaminations(a.id),
                    getAnamnesisForm(id),
                ]);
                setFindings(z);
                setTreatments(bh);
                setExaminations(u);
                if (am) {
                    try {
                        setAnamnesisJson(JSON.stringify(JSON.parse(am.answers), null, 2));
                    } catch {
                        setAnamnesisJson(am.answers);
                    }
                    setAnamnesisSign(am.signed);
                } else {
                    setAnamnesisJson(EMPTY_ANAMNESIS_V1_JSON);
                    setAnamnesisSign(false);
                }
            } else if (canListTreatmentsForPayment) {
                const [bh, u] = await Promise.all([listTreatments(a.id), listExaminations(a.id)]);
                setTreatments(bh);
                setExaminations(u);
            }
        } catch (e) {
            setChart(null);
            setFindings([]);
            setTreatments([]);
            setExaminations([]);
            setCatalog([]);
            setAttachments([]);
            if (isPatientChartMissingError(e)) {
                setChartLoadError(null);
            } else {
                setChartLoadError(e instanceof Error ? e.message : String(e));
            }
        }
    }, [id, canViewClinical, canListPatientDocuments, canListTreatmentsForPayment, refreshAttachments, toast]);

    useEffect(() => { load(); }, [load]);

    const {
        runSavePatient,
        handleCreateExamination,
        runSaveExaminationEdit,
        cancelAnamnesisEdit,
        runSaveAnamnesis,
        handleDeleteTreatmentRow,
        handleDeleteExaminationRow,
        handleDeletePatient,
        treatmentGroups,
        generateNewTreatmentNumber,
        nextUnterPreview,
        treatmentComposerCommon,
    } = usePatientDetailClinicalActions({
        patientId: id,
        patient,
        chart,
        canViewClinical,
        editForm,
        setShowEditPatient,
        treatments,
        examinations,
        catalog,
        findings,
        treatmentForm,
        setTreatmentForm,
        selectedTreatmentTooth,
        setSelectedTreatmentTooth,
        treatmentEditId,
        setTreatmentEditId,
        treatmentFormUnlocked,
        setTreatmentFormUnlocked,
        treatmentComposerMode,
        setTreatmentComposerMode,
        setShowTreatmentComposer,
        continueFromTreatmentId,
        setContinueFromTreatmentId,
        treatmentDeleteId,
        setTreatmentDeleteId,
        examinationForm,
        setExaminationForm,
        setShowUnterComposer,
        unterEdit,
        setUnterEdit,
        unterDeleteId,
        setUnterDeleteId,
        anamnesisJson,
        setAnamnesisJson,
        anamQuick,
        setAnamQuick,
        anamnesisSign,
        setAnamEditing,
        planNext,
        setPlanNext,
        setPatientDeleteOpen,
        setPatientDeleteBusy,
        load,
        sessionRole: session?.role,
        goTab,
        setShowPaymentComposer,
        setPaymentNewForm,
    });

    const {
        paymentLinkSelectOptionsOpen,
        paymentZuordnungSummaries,
        paymentsHistorisch,
        paymentNewMaxAmountEur,
        paymentEditMaxAmountEur,
        runSavePaymentEdit,
        submitSavePaymentNew,
        handleDeletePaymentRow,
        handlePrintReceipt,
        handlePrintReceiptFromSummeRow,
    } = usePatientDetailPaymentActions({
        patientId: id,
        patient,
        treatments,
        examinations,
        payments,
        paymentNewForm,
        setPaymentNewForm,
        setShowPaymentComposer,
        paymentEdit,
        setPaymentEdit,
        paymentEditUnlocked,
        paymentEditForm,
        paymentDeleteId,
        setPaymentDeleteId,
        load,
        ensurePracticeForDocument,
        setHtmlDocExport,
    });

    const { flushChartSave, cancelChartSave } = usePatientDetailChartSave({
        chartSaveConfirm,
        setChartSaveConfirm,
        chartSaveBusy,
        setChartSaveBusy,
        chart,
        patientId: id,
        sessionUserId: session?.user_id,
        prescriptionTabRef,
        load,
        refreshAttachments,
    });

    useEffect(() => () => {
        for (const a of attachmentsRef.current) {
            if (a.previewUrl.startsWith("blob:")) {
                try {
                    URL.revokeObjectURL(a.previewUrl);
                } catch {
                    /* ignore */
                }
            }
        }
    }, []);

    /* Unlock state only when switching to another row id, not on every field mutation. */
    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (unterEdit) setUnterEditUnlocked(false);
    }, [unterEdit?.id]);

    useEffect(() => {
        if (paymentEdit) setPaymentEditUnlocked(false);
    }, [paymentEdit?.id]);
    /* eslint-enable react-hooks/exhaustive-deps */

    useEffect(() => {
        if (!id) return;
        const version =
            paymentNewForm.linkKind && paymentNewForm.linkId
                ? `${paymentNewForm.linkKind}:${paymentNewForm.linkId}`
                : "";
        if (!version) return;
        const openOpts = buildOpenPaymentLinkSelectOptions(payments, id, treatments, examinations, t, tp);
        if (!openOpts.some((o) => o.value === version)) {
            setPaymentNewForm((p) => ({ ...p, linkKind: "", linkId: "" }));
        }
    }, [id, payments, treatments, examinations, paymentNewForm.linkKind, paymentNewForm.linkId, t, tp]);

    useEffect(() => {
        setAttachments((prev) => {
            for (const a of prev) {
                if (a.previewUrl.startsWith("blob:")) {
                    try {
                        URL.revokeObjectURL(a.previewUrl);
                    } catch {
                        /* ignore */
                    }
                }
            }
            return [];
        });
    }, [id]);

    useEffect(() => {
        if (activeTab !== "anamnesis") return;
        const p = parseAnamnesisV1(anamnesisJson);
        const next = {
            insuranceStatus: p?.insuranceStatus ?? "",
            health_insurance: p?.health_insurance ?? "",
            chronic: p?.preExisting?.chronic ?? "",
            allergiesMed: p?.allergies?.medications ?? "",
        };
        setAnamQuick((prev) =>
            prev.insuranceStatus === next.insuranceStatus &&
            prev.health_insurance === next.health_insurance &&
            prev.chronic === next.chronic &&
            prev.allergiesMed === next.allergiesMed
                ? prev
                : next,
        );
    }, [activeTab, id, anamnesisJson]);

    useEffect(() => {
        if (activeTab !== "anamnesis") setAnamEditing(false);
    }, [activeTab]);


    const chartCompleteness = useMemo(() => {
        if (!patient || !chart) return { gaps: [] as ChartCompletenessGap[] };
        return computeChartCompleteness({
            patientInsuranceNumber: patient.insurance_number,
            anamnesisJson,
            dentalFindingsCount: findings.length,
            examinationsCount: examinations.length,
            patientStatus: patient.status,
            includeClinicalGaps: canViewClinical,
        });
    }, [patient, chart, anamnesisJson, findings.length, examinations.length, canViewClinical]);

    if (!id) {
        return (
            <div className="animate-fade-in">
                <WorkspacePageHeader
                    title={t("patient.detail.title")}
                    back={{ to: "/patients", label: t("patient.detail.back") }}
                />
                <p className="text-body text-on-surface-variant mt-4">{t("patient.detail.no_selection")}</p>
            </div>
        );
    }

    if (patientLoadError) {
        return (
            <div className="practice-workspace-page animate-fade-in">
                <WorkspacePageHeader
                    title={t("patient.detail.title")}
                    back={{ to: "/patients", label: t("patient.detail.back") }}
                />
                <div className="rounded-lg bg-error-container text-error px-4 py-3 text-body max-w-xl">
                    {patientLoadError}
                </div>
                <Button onClick={() => load()}>{t("common.retry")}</Button>
            </div>
        );
    }

    if (!patient) return <PageLoading label={t("patient.detail.loading")} />;

    /** Welche Sektionen enthalten Daten? */
    const hasSectionData = {
        anam: anamnesisJson.trim().length > 0,
        attachment: attachments.length > 0,
        payment: payments.length > 0,
    } as const;
    const anlPending = attachments.filter((a) => !itemValidation[itemValidationKey("anl", a.id)]).length;
    const paymentPending = payments.filter((z) => !itemValidation[itemValidationKey("payment", z.id)]).length;
    const validationPendingTotal = canViewClinical
        ? ((!validation.master ? 1 : 0) + anlPending + paymentPending)
        : 0;


    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <PatientDetailShellHeader
                patient={patient}
                validationPendingTotal={validationPendingTotal}
                completenessGaps={chartCompleteness.gaps}
                validationMaster={validation.master}
                canWriteMedical={canWriteMedical}
                showPlanTip={showPlanTip}
                planNext={planNext}
                canViewClinical={canViewClinical}
                role={role}
                patientId={id}
                chart={chart}
                findings={findings}
                treatments={treatments}
                examinations={examinations}
                payments={payments}
                patientDeleteOpen={patientDeleteOpen}
                patientDeleteBusy={patientDeleteBusy}
                showEditPatient={showEditPatient}
                editForm={editForm}
                onEditFormChange={(patch) => setEditForm((f) => ({ ...f, ...patch }))}
                onOpenEdit={() => {
                    setPatientDeleteOpen(false);
                    setShowEditPatient(true);
                }}
                onOpenDelete={() => {
                    setShowEditPatient(false);
                    setPatientDeleteOpen(true);
                }}
                onCloseDelete={() => setPatientDeleteOpen(false)}
                onConfirmDelete={handleDeletePatient}
                onCloseEdit={() => setShowEditPatient(false)}
                onSavePatient={runSavePatient}
                onValidateMaster={() => validateSection("master")}
                onRevokeMasterValidation={() => revokeSectionValidation("master")}
                onNavigateBack={() => navigate("/patients")}
                onTogglePlanTip={() => setShowPlanTip((version) => !version)}
                onPersistPlanNext={persistPlanNext}
                onOpenExport={() => setChartExportPickerOpen(true)}
                onOpenTicket={() => setChartWorkflowMode("ticket")}
                onOpenTask={() => setChartWorkflowMode("task")}
                onOpenForward={() => setChartWorkflowMode("forward")}
                onOpenDischargeLeaflet={() => setDischargeLeafletOpen(true)}
                onOpenAppointment={() => navigate(appointmentBackLink)}
                onGoTab={goTab}
            />

            <div className="chart-workspace" style={{ display: "grid", gridTemplateColumns: "minmax(200px, 220px) 1fr", gap: 20 }}>
                <PatientDetailChartSubnav
                    activeTab={activeTab}
                    canViewClinical={canViewClinical}
                    validation={validation}
                    attachments={attachments}
                    payments={payments}
                    itemValidation={itemValidation}
                    onSelectTab={goTab}
                />
                <div className="col" style={{ gap: 16, minWidth: 0 }}>
                    {chartLoadError ? (
                        <DismissibleNotice variant="error" role="alert" title={t("patient.detail.chart_load_error")}>
                            {chartLoadError}
                        </DismissibleNotice>
                    ) : null}

            {activeTab === "anamnesis" && canViewClinical ? (
                <PatientDetailAnamTab
                    validationMaster={validation.master}
                    anamEditing={anamEditing}
                    anamQuick={anamQuick}
                    anamnesisSigned={anamnesisSign}
                    anamnesisJson={anamnesisJson}
                    onAnamEditingChange={setAnamEditing}
                    onAnamQuickChange={(patch) => setAnamQuick((q) => ({ ...q, ...patch }))}
                    onAnamnesisSignChange={setAnamnesisSign}
                    onCancelEdit={cancelAnamnesisEdit}
                    onSave={runSaveAnamnesis}
                />
            ) : null}

            {activeTab === "examination" && canViewClinical ? (
                <PatientDetailExaminationTab
                    chart={chart}
                    findings={findings}
                    catalog={catalog}
                    examinations={examinations}
                    showExaminationComposer={showUnterComposer}
                    nextExaminationPreview={nextUnterPreview}
                    examinationDetailId={unterDetailId}
                    examinationEdit={unterEdit}
                    examinationEditUnlocked={unterEditUnlocked}
                    examinationDeleteId={unterDeleteId}
                    canViewClinical={canViewClinical}
                    onStartNewExamination={() => {
                        setUnterEdit(null);
                        setUnterDeleteId(null);
                        setShowUnterComposer(true);
                    }}
                    onToggleDetail={(id, open) => setUnterDetailId(open ? null : id)}
                    onStartEdit={(u) => {
                        setUnterDeleteId(null);
                        setShowUnterComposer(false);
                        setUnterEditUnlocked(false);
                        setUnterEdit({ ...u });
                    }}
                    onRequestDelete={(examinationId) => {
                        setUnterEdit(null);
                        setUnterDeleteId(examinationId);
                    }}
                    onUnlockEdit={() => setUnterEditUnlocked(true)}
                    onCloseEdit={() => setUnterEdit(null)}
                    onCancelDelete={() => setUnterDeleteId(null)}
                    onConfirmDelete={handleDeleteExaminationRow}
                    onCloseComposer={() => setShowUnterComposer(false)}
                    onApplyTooth={async (tooth: number, statusKey: string) => {
                        if (!chart) return;
                        await createDentalFinding({ chart_id: chart.id, tooth_number: tooth, finding: statusKey });
                        await load();
                    }}
                    onSaveEdit={runSaveExaminationEdit}
                    onCreateExamination={handleCreateExamination}
                />
            ) : null}

            {activeTab === "treatment" && canViewClinical ? (
                <PatientDetailTreatmentTab
                    treatmentComposerCommon={treatmentComposerCommon}
                    treatments={treatments}
                    treatmentGroups={treatmentGroups}
                    showTreatmentComposer={showTreatmentComposer}
                    treatmentEditId={treatmentEditId}
                    treatmentDeleteId={treatmentDeleteId}
                    canViewClinical={canViewClinical}
                    showClinicalPrices={showClinicalPrices}
                    onToggleClinicalPrices={() => setShowClinicalPrices((version) => !version)}
                    onStartNewTreatment={() => {
                        const nextNr = generateNewTreatmentNumber();
                        setTreatmentDeleteId(null);
                        setTreatmentEditId(null);
                        setTreatmentFormUnlocked(true);
                        setContinueFromTreatmentId("");
                        setTreatmentForm({
                            date: new Date().toISOString().slice(0, 10),
                            category: "",
                            service_name: "",
                            serviceCatalogId: "",
                            treatment_number: nextNr,
                            session_number: "1",
                            total_cost: "",
                            treatment_status: "COMPLETED",
                            appointment_required: "0",
                            notes: "",
                        });
                        setSelectedTreatmentTooth(null);
                        setTreatmentComposerMode("new");
                        setShowTreatmentComposer(true);
                        toast(tp("patient.detail.toast.treatment_new_started", { number: nextNr }), "success");
                    }}
                    onContinueTreatment={() => {
                        const firstId = treatments[0]?.id;
                        if (!firstId) {
                            toast(t("patient.detail.toast.no_treatment_continue"), "info");
                            return;
                        }
                        setTreatmentDeleteId(null);
                        setTreatmentEditId(null);
                        setTreatmentFormUnlocked(true);
                        setTreatmentComposerMode("continue");
                        setShowTreatmentComposer(true);
                        treatmentComposerCommon.applyContinueFromTreatment(firstId);
                        toast(t("patient.detail.toast.treatment_continue"), "success");
                    }}
                    onReleaseForBilling={async (treatmentId: string) => {
                        try {
                            const upd = await releaseTreatmentForBilling(treatmentId);
                            setTreatments((prev) => prev.map((x) => (x.id === treatmentId ? upd : x)));
                            toast(t("patient.detail.toast.released_billing"), "success");
                        } catch (e) {
                            toast(e instanceof Error ? e.message : String(e), "error");
                        }
                    }}
                    onOpenEditTreatment={(b: Treatment) => {
                        setTreatmentDeleteId(null);
                        setTreatmentEditId(b.id);
                        setTreatmentFormUnlocked(false);
                        setTreatmentComposerMode(null);
                        setContinueFromTreatmentId("");
                        const kid = resolveCatalogIdForTreatment(catalog, b);
                        setTreatmentForm({
                            date: (b.treatment_date ?? b.created_at).slice(0, 10),
                            category: b.category ?? b.kind ?? "",
                            service_name: b.service_name ?? b.description ?? b.kind ?? "",
                            serviceCatalogId: kid,
                            treatment_number: (b.treatment_number ?? "").trim(),
                            session_number: b.session_number != null ? String(b.session_number) : "",
                            total_cost: b.total_cost != null ? String(b.total_cost) : "",
                            treatment_status: b.treatment_status ?? "COMPLETED",
                            appointment_required: b.appointment_required === 1 ? "1" : "0",
                            notes: b.notes ?? "",
                        });
                        setSelectedTreatmentTooth(b.teeth ?? null);
                        setShowTreatmentComposer(true);
                    }}
                    onRequestDeleteTreatment={(treatmentId: string) => {
                        setShowTreatmentComposer(false);
                        setTreatmentComposerMode(null);
                        setTreatmentEditId(null);
                        setTreatmentFormUnlocked(true);
                        setContinueFromTreatmentId("");
                        setTreatmentDeleteId(treatmentId);
                    }}
                    onCancelDeleteTreatment={() => setTreatmentDeleteId(null)}
                    onConfirmDeleteTreatment={handleDeleteTreatmentRow}
                />
            ) : null}

            {activeTab === "prescription" && id && session?.user_id && (
                <PatientDetailPrescriptionTab
                    ref={prescriptionTabRef}
                    patientId={id}
                    patient={patient}
                    prescriptions={prescriptions}
                    certificates={certificates}
                    canWriteMedical={canWriteMedical}
                    userId={session.user_id}
                    onReload={load}
                    onChartSaveConfirm={setChartSaveConfirm}
                    onHtmlDocExport={setHtmlDocExport}
                    ensurePracticeForDocument={ensurePracticeForDocument}
                />
            )}
            {activeTab === "attachment" ? (
                <PatientDetailAttachmentTab
                    hasAttachments={hasSectionData.attachment}
                    attachments={attachments}
                    fileInputId={attachmentFileInputId}
                    cameraInputId={attachmentCameraInputId}
                    canManageAttachments={canWriteMedical}
                    canValidate={canViewClinical}
                    onPickFile={(file) => {
                        const err = validateAttachmentFile(t, file);
                        if (err) {
                            toast(err, "error");
                            return;
                        }
                        setChartSaveConfirm({
                            kind: "attachment_add",
                            file,
                            documentKind: CHART_ATTACHMENT_DOCUMENT_KIND_DEFAULT,
                        });
                    }}
                    onSetDocumentKind={(idx, kind) => {
                        const row = attachments[idx];
                        if (!row) return;
                        const normalized = normalizeChartDocumentKind(kind);
                        setAttachments((prev) =>
                            prev.map((x, i) => (i === idx ? { ...x, documentKind: normalized } : x)),
                        );
                        void (async () => {
                            try {
                                await setChartAttachmentDocumentKind(row.id, normalized);
                            } catch (e) {
                                toast(
                                    tp("patient.detail.toast.attachment_kind_failed", {
                                        message: e instanceof Error ? e.message : String(e),
                                    }),
                                    "error",
                                );
                                if (chart) await refreshAttachments(chart.id);
                            }
                        })();
                    }}
                    onRename={(idx, name) => {
                        const row = attachments[idx];
                        if (!row) return;
                        setAttachments((prev) => prev.map((x, i) => (i === idx ? { ...x, name } : x)));
                        void (async () => {
                            try {
                                await renameChartAttachment(row.id, name);
                            } catch (e) {
                                toast(tp("patient.detail.toast.attachment_rename_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
                                if (chart) await refreshAttachments(chart.id);
                            }
                        })();
                    }}
                    onRequestRemove={(idx, name) => {
                        const row = attachments[idx];
                        if (!row) return;
                        setChartSaveConfirm({ kind: "attachment_remove", id: row.id, name });
                    }}
                    onOpenExternal={(idx) => {
                        const row = attachments[idx];
                        if (!row?.absPath) return;
                        void (async () => {
                            try {
                                const withApp = await resolveOpenImageWithAppPath(
                                    loadClientSettings().chart?.openImagesWithApp,
                                );
                                await openChartAttachmentExternally(row.id, withApp);
                            } catch (e) {
                                toast(tp("patient.detail.toast.attachment_open_failed", { message: e instanceof Error ? e.message : String(e) }), "error");
                            }
                        })();
                    }}
                    onDuplicate={
                        canWriteMedical
                            ? (idx) => {
                                  const row = attachments[idx];
                                  if (!row || !chart) return;
                                  void (async () => {
                                      try {
                                          await duplicateChartAttachment(row.id);
                                          toast(t("patient.detail.toast.attachment_copy"), "success");
                                          await refreshAttachments(chart.id);
                                      } catch (e) {
                                          toast(
                                              tp("patient.detail.toast.attachment_duplicate_failed", {
                                                  message: e instanceof Error ? e.message : String(e),
                                              }),
                                              "error",
                                          );
                                      }
                                  })();
                              }
                            : undefined
                    }
                    isValidated={(attachmentId) => Boolean(itemValidation[itemValidationKey("anl", attachmentId)])}
                    onRequestValidate={(attachmentId, label) => void requestValidateItem(itemValidationKey("anl", attachmentId), label)}
                    onRevokeValidation={(attachmentId, shortLabel) =>
                        void revokeItemValidationRow(itemValidationKey("anl", attachmentId), shortLabel)}
                    formatAddedAt={formatDate}
                    onScannerClick={() => {
                        void (async () => {
                            try {
                                await openSystemScanUtility();
                                setScannerImportOpen(true);
                            } catch (e) {
                                toast(tp("patient.detail.toast.scanner_failed", { message: errorMessage(e) }), "error");
                            }
                        })();
                    }}
                />
            ) : null}
            {chart && scannerImportOpen ? (
                <ChartScannerImportDialog
                    open={scannerImportOpen}
                    busy={scannerImportBusy}
                    onClose={() => setScannerImportOpen(false)}
                    onImport={async (srcPath, documentKind) => {
                        if (!chart) return;
                        setScannerImportBusy(true);
                        try {
                            await createChartAttachmentFromPath({
                                chart_id: chart.id,
                                src_path: srcPath,
                                document_kind: normalizeChartDocumentKind(documentKind),
                            });
                            toast(t("patient.detail.toast.attachment_saved"), "success");
                            await refreshAttachments(chart.id);
                            setScannerImportOpen(false);
                        } catch (e) {
                            toast(tp("common.error_with_message", { message: errorMessage(e) }), "error");
                        } finally {
                            setScannerImportBusy(false);
                        }
                    }}
                />
            ) : null}
            {activeTab === "payment" && (
                <PatientDetailPaymentTab
                    patientId={id}
                    hasPaymentData={hasSectionData.payment}
                    paymentListenModus={paymentListenModus}
                    onPaymentListenModusChange={setPaymentListenModus}
                    canFinanceWrite={canFinanceWrite}
                    canViewClinical={canViewClinical}
                    showPaymentComposer={showPaymentComposer}
                    onOpenPaymentComposer={() => {
                        setPaymentEdit(null);
                        setPaymentDeleteId(null);
                        setPaymentNewForm({
                            linkKind: "",
                            linkId: "",
                            amount: "",
                            payment_method: "CASH",
                            description: "",
                        });
                        setShowPaymentComposer(true);
                    }}
                    onClosePaymentComposer={() => setShowPaymentComposer(false)}
                    treatments={treatments}
                    examinations={examinations}
                    payments={payments}
                    paymentNewForm={paymentNewForm}
                    setPaymentNewForm={setPaymentNewForm}
                    paymentLinkSelectOptionsOpen={paymentLinkSelectOptionsOpen}
                    paymentNewMaxAmountEur={paymentNewMaxAmountEur}
                    paymentZuordnungSummaries={paymentZuordnungSummaries}
                    paymentsHistorisch={paymentsHistorisch}
                    paymentEdit={paymentEdit}
                    paymentEditUnlocked={paymentEditUnlocked}
                    paymentEditForm={paymentEditForm}
                    setPaymentEditForm={setPaymentEditForm}
                    paymentEditMaxAmountEur={paymentEditMaxAmountEur}
                    paymentDeleteId={paymentDeleteId}
                    itemValidation={itemValidation}
                    onPrintReceipt={handlePrintReceipt}
                    onPrintReceiptFromSummeRow={handlePrintReceiptFromSummeRow}
                    onSubmitSavePaymentNew={submitSavePaymentNew}
                    onSavePaymentEdit={runSavePaymentEdit}
                    onDeletePayment={handleDeletePaymentRow}
                    onCancelDeletePayment={() => setPaymentDeleteId(null)}
                    onClosePaymentEdit={() => setPaymentEdit(null)}
                    onUnlockPaymentEdit={() => setPaymentEditUnlocked(true)}
                    onStartEditPayment={(z) => {
                        setPaymentDeleteId(null);
                        setPaymentEditUnlocked(false);
                        setPaymentEditForm({
                            amount: String(z.amount),
                            payment_method: z.payment_method,
                            description: z.description ?? "",
                        });
                        setPaymentEdit(z);
                    }}
                    onRequestDeletePayment={(paymentId) => {
                        setPaymentEdit(null);
                        setPaymentDeleteId(paymentId);
                    }}
                    onRequestValidateItem={requestValidateItem}
                    onRevokeItemValidation={revokeItemValidationRow}
                    toast={toast}
                />
            )}
                </div>
            </div>
            {patient && session && role ? (
                <PatientDetailOverlays
                    patientId={id}
                    patient={patient}
                    sessionUserId={session.user_id}
                    role={role}
                    canViewClinical={canViewClinical}
                    canReadDocuments={canReadDocuments}
                    canReadFinance={canReadFinance}
                    canAuditRead={canAuditRead}
                    chartSaveConfirm={chartSaveConfirm}
                    chartSaveBusy={chartSaveBusy}
                    onCloseChartSave={cancelChartSave}
                    onConfirmChartSave={() => void flushChartSave()}
                    onPatchChartSaveConfirm={(patch) =>
                        setChartSaveConfirm((p) =>
                            p?.kind === "attachment_add" ? { ...p, ...patch } : p,
                        )
                    }
                    chartExportPickerOpen={chartExportPickerOpen}
                    onCloseChartExport={() => setChartExportPickerOpen(false)}
                    dischargeLeafletOpen={dischargeLeafletOpen}
                    onCloseDischargeLeaflet={() => setDischargeLeafletOpen(false)}
                    practiceGuardKind={practiceGuardKind}
                    onClosePracticeGuard={() => setPracticeGuardKind(null)}
                    htmlDocExport={htmlDocExport}
                    onCloseHtmlDocExport={() => setHtmlDocExport(null)}
                    chartWorkflowMode={chartWorkflowMode}
                    onCloseChartWorkflow={() => setChartWorkflowMode(null)}
                    toast={toast}
                />
            ) : null}
        </div>
    );
}
