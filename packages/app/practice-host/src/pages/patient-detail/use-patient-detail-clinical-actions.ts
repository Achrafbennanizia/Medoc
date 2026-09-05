import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";
import { deletePatient, updatePatient } from "@/systems/practice-host/controllers/patient.controller";
import {
    createTreatment,
    createExamination,
    createDentalFinding,
    deleteTreatment,
    deleteExamination,
    saveAnamnesisForm,
    updateTreatment,
    updateExamination,
} from "@/systems/practice-host/controllers/chart.controller";
import { persistPlanNextAppointmentToBackend } from "@/systems/practice-host/controllers/plan-next-appointment.controller";
import { mergeQuickIntoAnamnesisJson, parseAnamnesisV1 } from "@/lib/anamnesis";
import { clearPatientScopedBrowserStorage } from "@/lib/patient-browser-storage";
import {
    treatmentContinueLabel,
    treatmentToUpdatePayload,
    PATIENT_DETAIL_TOAST_UNDO_MS,
    resolveCatalogIdForTreatment,
} from "@/lib/patient-detail-utils";
import {
    buildTreatmentCatalogCategoryOptions,
    DEFAULT_CATALOG_CATEGORIES,
} from "@/lib/treatment-catalog-categories";
import {
    mergeTreatmentFollowupIntoPlan,
    planNextHasContent,
    type PlanNextAppointmentV2,
} from "@/lib/plan-next-appointment";
import { previewNextExaminationNumber, dentalFindingUpsertsFromExamination } from "@/lib/examination";
import type {
    Treatment,
    TreatmentCatalogItem,
    Patient,
    PatientChart,
    Examination,
    DentalFinding,
} from "@/models/types";
import type { TreatmentChartComposerPanelProps } from "@/views/components/treatment-chart-composer-panel";
import {
    treatmentHasBillableServiceItem,
    openPaymentTabAfterBillableTreatment,
    openPaymentTabAfterBillableExamination,
    examinationHasBillableServiceItem,
    type PaymentNewFormState,
} from "@/lib/billing-open-booking";
import type { PatientDetailChartTab } from "@/lib/patient-detail-utils";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { useToastStore } from "@/views/components/ui/toast-store";

export type TreatmentFormState = {
    date: string;
    category: string;
    service_name: string;
    serviceCatalogId: string;
    treatment_number: string;
    session_number: string;
    total_cost: string;
    treatment_status: string;
    appointment_required: string;
    notes: string;
};

export type AnamQuickState = {
    insuranceStatus: string;
    health_insurance: string;
    chronic: string;
    allergiesMed: string;
};

const EMPTY_TREATMENT_FORM = (): TreatmentFormState => ({
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

export type UsePatientDetailClinicalActionsArgs = {
    patientId: string | undefined;
    patient: Patient | null;
    chart: PatientChart | null;
    canViewClinical: boolean;
    editForm: { name: string; phone: string; email: string; address: string };
    setShowEditPatient: (version: boolean) => void;
    treatments: Treatment[];
    examinations: Examination[];
    catalog: TreatmentCatalogItem[];
    findings: DentalFinding[];
    treatmentForm: TreatmentFormState;
    setTreatmentForm: Dispatch<SetStateAction<TreatmentFormState>>;
    selectedTreatmentTooth: string | null;
    setSelectedTreatmentTooth: (version: string | null) => void;
    treatmentEditId: string | null;
    setTreatmentEditId: (version: string | null) => void;
    treatmentFormUnlocked: boolean;
    setTreatmentFormUnlocked: (version: boolean) => void;
    treatmentComposerMode: "new" | "continue" | null;
    setTreatmentComposerMode: (version: "new" | "continue" | null) => void;
    setShowTreatmentComposer: (version: boolean) => void;
    continueFromTreatmentId: string;
    setContinueFromTreatmentId: (version: string) => void;
    treatmentDeleteId: string | null;
    setTreatmentDeleteId: (version: string | null) => void;
    examinationForm: { chief_complaint: string; results: string; diagnosis: string };
    setExaminationForm: Dispatch<SetStateAction<{ chief_complaint: string; results: string; diagnosis: string }>>;
    setShowUnterComposer: (version: boolean) => void;
    unterEdit: Examination | null;
    setUnterEdit: (version: Examination | null) => void;
    unterDeleteId: string | null;
    setUnterDeleteId: (version: string | null) => void;
    anamnesisJson: string;
    setAnamnesisJson: (version: string) => void;
    anamQuick: AnamQuickState;
    setAnamQuick: Dispatch<SetStateAction<AnamQuickState>>;
    anamnesisSign: boolean;
    setAnamEditing: (version: boolean) => void;
    planNext: PlanNextAppointmentV2;
    setPlanNext: Dispatch<SetStateAction<PlanNextAppointmentV2>>;
    setPatientDeleteOpen: (version: boolean) => void;
    setPatientDeleteBusy: (version: boolean) => void;
    load: () => Promise<void>;
    sessionRole: string | undefined;
    goTab: (tab: PatientDetailChartTab) => void;
    setShowPaymentComposer: (version: boolean) => void;
    setPaymentNewForm: (form: PaymentNewFormState) => void;
};

export function usePatientDetailClinicalActions(args: UsePatientDetailClinicalActionsArgs) {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const {
        patientId,
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
        sessionRole,
        goTab,
        setShowPaymentComposer,
        setPaymentNewForm,
    } = args;

    const runSavePatient = async () => {
        if (!patientId || !patient || !editForm.name.trim()) return;
        const prev = {
            name: patient.name,
            phone: patient.phone ?? "",
            email: patient.email ?? "",
            address: patient.address ?? "",
        };
        try {
            await updatePatient(patientId, {
                name: editForm.name,
                phone: editForm.phone || null,
                email: editForm.email || null,
                address: editForm.address || null,
            });
            toast(t("patient.detail.toast.patient_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updatePatient(patientId, {
                            name: prev.name,
                            phone: prev.phone || null,
                            email: prev.email || null,
                            address: prev.address || null,
                        });
                        await load();
                    } catch (err) {
                        toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                    }
                },
            });
            setShowEditPatient(false);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const persistTreatmentAfterConfirm = async () => {
        if (!chart) return;
        const bn = treatmentForm.treatment_number.trim();
        let sessionNumberNum: number | null = null;
        if (treatmentForm.session_number.trim()) {
            const n = Number(treatmentForm.session_number);
            sessionNumberNum = Number.isFinite(n) ? n : null;
        } else if (bn) {
            const same = treatments.filter((b) => (b.treatment_number ?? "").trim() === bn);
            const maxS = same.reduce((acc, b) => Math.max(acc, b.session_number ?? 0), 0);
            sessionNumberNum = maxS + 1;
        }
        const gRaw = treatmentForm.total_cost.trim().replace(",", ".");
        const g = gRaw === "" ? NaN : Number(gRaw);
        const payload = {
            kind: treatmentForm.service_name.trim(),
            description: treatmentForm.service_name.trim(),
            teeth: selectedTreatmentTooth,
            material: null as string | null,
            notes: treatmentForm.notes.trim() || null,
            category: treatmentForm.category.trim(),
            service_name: treatmentForm.service_name.trim(),
            treatment_number: bn || null,
            session_number: sessionNumberNum,
            treatment_status: treatmentForm.treatment_status || null,
            total_cost: Number.isFinite(g) ? g : null,
            appointment_required: treatmentForm.appointment_required === "1",
            treatment_date: treatmentForm.date.trim() || null,
        };
        const prevBh = treatmentEditId ? treatments.find((b) => b.id === treatmentEditId) ?? null : null;
        const billable = treatmentHasBillableServiceItem(
            payload.service_name,
            Number.isFinite(g) ? g : null,
        );
        let savedTreatmentId = treatmentEditId ?? "";
        try {
            if (treatmentEditId) {
                await updateTreatment({ id: treatmentEditId, ...payload });
                toast(t("patient.detail.toast.treatment_updated"), "success", {
                    durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                    onUndo: async () => {
                        if (!prevBh) return;
                        try {
                            await updateTreatment(treatmentToUpdatePayload(prevBh));
                            await load();
                        } catch (err) {
                            toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                        }
                    },
                });
                setTreatmentEditId(null);
            } else {
                const created = await createTreatment({ chart_id: chart.id, ...payload });
                savedTreatmentId = created.id;
                toast(t("patient.detail.toast.treatment_documented"), "success", {
                    durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                    onUndo: async () => {
                        try {
                            await deleteTreatment(created.id);
                            await load();
                        } catch (err) {
                            toast(tp("common.error_with_message", { message: err instanceof Error ? err.message : String(err) }), "error");
                        }
                    },
                });
            }
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
            return;
        }
        if (patientId && payload.appointment_required) {
            const merged = mergeTreatmentFollowupIntoPlan(planNext, {
                service_name: treatmentForm.service_name,
                notes: treatmentForm.notes ?? "",
            });
            if (planNextHasContent(merged)) {
                try {
                    await persistPlanNextAppointmentToBackend(patientId, merged);
                    setPlanNext(merged);
                } catch (err) {
                    toast(
                        tp("patient.detail.toast.followup_hint_failed", {
                            message: err instanceof Error ? err.message : String(err),
                        }),
                        "error",
                    );
                }
            }
        }
        setTreatmentForm(EMPTY_TREATMENT_FORM());
        setSelectedTreatmentTooth(null);
        setShowTreatmentComposer(false);
        setTreatmentComposerMode(null);
        setContinueFromTreatmentId("");
        setTreatmentFormUnlocked(true);
        await load();
        if (sessionRole === "PHYSICIAN" && billable && savedTreatmentId) {
            openPaymentTabAfterBillableTreatment({
                treatmentId: savedTreatmentId,
                total_cost: Number.isFinite(g) ? g : null,
                goTab,
                setShowPaymentComposer,
                setPaymentNewForm,
            });
            toast(t("patient.detail.toast.billing_area_opened"), "info");
        }
    };

    const runSaveTreatment = () => {
        if (!chart) return;
        if (treatmentEditId && !treatmentFormUnlocked) {
            toast(t("patient.detail.toast.edit_unlock_first"), "info");
            return;
        }
        if (!treatmentForm.category.trim() || !treatmentForm.service_name.trim()) {
            toast(t("patient.detail.toast.category_service_item_required"), "error");
            return;
        }
        void persistTreatmentAfterConfirm();
    };

    const syncExaminationTeethToToothStatus = async (resultsJson: string) => {
        if (!chart) return;
        const upserts = dentalFindingUpsertsFromExamination(chart.id, resultsJson, findings);
        for (const row of upserts) {
            await createDentalFinding(row);
        }
    };

    const persistExaminationCreate = async (data: {
        chiefComplaint: string;
        diagnosis: string;
        resultsJson: string;
        category?: string | null;
        serviceName?: string | null;
        totalCost?: number | null;
    }) => {
        if (!chart) return;
        const billable = examinationHasBillableServiceItem(data.serviceName, data.totalCost ?? null);
        try {
            const created = await createExamination({
                chart_id: chart.id,
                chief_complaint: data.chiefComplaint.trim() || null,
                results: data.resultsJson.trim() || null,
                diagnosis: data.diagnosis.trim() || null,
                category: data.category?.trim() || null,
                service_name: data.serviceName?.trim() || null,
                total_cost: data.totalCost ?? null,
            });
            try {
                await syncExaminationTeethToToothStatus(data.resultsJson);
            } catch (e) {
                toast(
                    tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }),
                    "warning",
                );
            }
            toast(t("patient.detail.toast.examination_captured"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await deleteExamination(created.id);
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setShowUnterComposer(false);
            setExaminationForm({ chief_complaint: "", results: "", diagnosis: "" });
            await load();
            if (sessionRole === "PHYSICIAN" && billable) {
                openPaymentTabAfterBillableExamination({
                    examinationId: created.id,
                    total_cost: data.totalCost ?? null,
                    goTab,
                    setShowPaymentComposer,
                    setPaymentNewForm,
                });
                toast(t("patient.detail.toast.billing_area_opened"), "info");
            }
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleCreateExamination = async (payload?: {
        chiefComplaint: string;
        diagnosis: string;
        resultsJson: string;
        category?: string | null;
        serviceName?: string | null;
        totalCost?: number | null;
    }) => {
        const data =
            payload ??
            ({
                chiefComplaint: examinationForm.chief_complaint,
                diagnosis: examinationForm.diagnosis,
                resultsJson: examinationForm.results,
            } as const);
        await persistExaminationCreate(data);
    };

    const runSaveExaminationEdit = async (payload: {
        chiefComplaint: string;
        diagnosis: string;
        resultsJson: string;
    }) => {
        if (!unterEdit) return;
        const uid = unterEdit.id;
        const prevSnap = {
            chiefComplaint: unterEdit.chief_complaint,
            diagnosis: unterEdit.diagnosis,
            results: unterEdit.results,
        };
        try {
            await updateExamination({
                id: uid,
                chief_complaint: payload.chiefComplaint.trim() || null,
                results: payload.resultsJson.trim() || null,
                diagnosis: payload.diagnosis.trim() || null,
                category: unterEdit.category ?? null,
                service_name: unterEdit.service_name ?? null,
                total_cost: unterEdit.total_cost ?? null,
            });
            try {
                await syncExaminationTeethToToothStatus(payload.resultsJson);
            } catch (e) {
                toast(
                    tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }),
                    "warning",
                );
            }
            toast(t("patient.detail.toast.examination_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await updateExamination({
                            id: uid,
                            chief_complaint: prevSnap.chiefComplaint ?? null,
                            results: prevSnap.results ?? null,
                            diagnosis: prevSnap.diagnosis ?? null,
                            category: unterEdit.category ?? null,
                            service_name: unterEdit.service_name ?? null,
                            total_cost: unterEdit.total_cost ?? null,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setUnterEdit(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const cancelAnamnesisEdit = useCallback(() => {
        const p = parseAnamnesisV1(anamnesisJson);
        setAnamQuick({
            insuranceStatus: p?.insuranceStatus ?? "",
            health_insurance: p?.health_insurance ?? "",
            chronic: p?.preExisting?.chronic ?? "",
            allergiesMed: p?.allergies?.medications ?? "",
        });
        setAnamEditing(false);
    }, [anamnesisJson, setAnamQuick, setAnamEditing]);

    const runSaveAnamnesis = async () => {
        if (!patientId) return;
        const merged = mergeQuickIntoAnamnesisJson(anamnesisJson, anamQuick);
        let answers: unknown;
        try {
            answers = JSON.parse(merged || "{}");
        } catch {
            toast(t("patient.detail.toast.anamnesis_invalid"));
            return;
        }
        const rollbackJson = anamnesisJson;
        const rollbackQuick = { ...anamQuick };
        const rollbackSign = anamnesisSign;
        let rollbackParsed: unknown;
        try {
            rollbackParsed = JSON.parse(mergeQuickIntoAnamnesisJson(rollbackJson, rollbackQuick) || "{}");
        } catch {
            toast(t("patient.detail.toast.anamnesis_invalid"));
            return;
        }
        try {
            await saveAnamnesisForm({
                patient_id: patientId,
                answers,
                signed: anamnesisSign,
            });
            toast(t("patient.detail.toast.anamnesis_saved"), "success", {
                durationMs: PATIENT_DETAIL_TOAST_UNDO_MS,
                onUndo: async () => {
                    try {
                        await saveAnamnesisForm({
                            patient_id: patientId,
                            answers: rollbackParsed,
                            signed: rollbackSign,
                        });
                        await load();
                    } catch (e) {
                        toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
                    }
                },
            });
            setAnamnesisJson(JSON.stringify(answers, null, 2));
            setAnamEditing(false);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteTreatmentRow = async () => {
        if (!treatmentDeleteId) return;
        try {
            await deleteTreatment(treatmentDeleteId);
            toast(t("patient.detail.toast.treatment_deleted"));
            setTreatmentDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeleteExaminationRow = async () => {
        if (!unterDeleteId) return;
        try {
            await deleteExamination(unterDeleteId);
            toast(t("patient.detail.toast.examination_deleted"));
            setUnterDeleteId(null);
            await load();
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        }
    };

    const handleDeletePatient = async () => {
        if (!patientId || !canViewClinical) return;
        setPatientDeleteBusy(true);
        try {
            await deletePatient(patientId);
            clearPatientScopedBrowserStorage(patientId);
            toast(t("patient.detail.toast.chart_deleted"));
            setPatientDeleteOpen(false);
            navigate("/patients");
        } catch (e) {
            toast(tp("common.error_with_message", { message: e instanceof Error ? e.message : String(e) }), "error");
        } finally {
            setPatientDeleteBusy(false);
        }
    };

    const categoryOptions = useMemo(() => {
        const values = new Set<string>([...DEFAULT_CATALOG_CATEGORIES, ...catalog.map((k) => k.category)]);
        if (treatmentForm.category) values.add(treatmentForm.category);
        const rest = buildTreatmentCatalogCategoryOptions(t, values, sortLocale);
        return [{ value: "", label: t("patient.detail.treatment.category_pick") }, ...rest];
    }, [catalog, treatmentForm.category, sortLocale, t]);

    const serviceCatalogOptions = useMemo(() => {
        if (!treatmentForm.category) {
            return [{ value: "", label: t("patient.detail.treatment.category_first") }];
        }
        const filtered = catalog.filter((k) => k.category === treatmentForm.category);
        return [{ value: "", label: t("patient.detail.treatment.service_item_pick") }, ...filtered.map((k) => ({ value: k.id, label: k.name }))];
    }, [catalog, treatmentForm.category, t]);

    const treatmentGroups = useMemo(() => {
        const keyOf = (b: Treatment) => {
            const n = (b.treatment_number ?? "").trim();
            return n || `__id_${b.id}`;
        };
        const map = new Map<string, Treatment[]>();
        const order: string[] = [];
        for (const b of treatments) {
            const k = keyOf(b);
            if (!map.has(k)) {
                map.set(k, []);
                order.push(k);
            }
            map.get(k)!.push(b);
        }
        return order.map((key) => map.get(key)!);
    }, [treatments]);

    const generateNewTreatmentNumber = useCallback(() => {
        const year = new Date().getFullYear();
        const prefix = `B-${year}-`;
        let max = 0;
        for (const b of treatments) {
            const n = (b.treatment_number ?? "").trim();
            if (!n.startsWith(prefix)) continue;
            const tail = n.slice(prefix.length);
            const m = /^(\d+)/.exec(tail);
            if (!m) continue;
            const version = Number.parseInt(m[1], 10);
            if (Number.isFinite(version) && version > max) max = version;
        }
        return `${prefix}${String(max + 1).padStart(3, "0")}`;
    }, [treatments]);

    const applyContinueFromTreatment = useCallback(
        (treatmentId: string) => {
            const b = treatments.find((x) => x.id === treatmentId);
            if (!b) return;
            const bn = (b.treatment_number ?? "").trim();
            if (!bn) {
                toast(t("patient.detail.toast.no_b_number"), "info");
                return;
            }
            const same = treatments.filter((x) => (x.treatment_number ?? "").trim() === bn);
            const nextSitz = same.reduce((acc, x) => Math.max(acc, x.session_number ?? 0), 0) + 1;
            const kid = resolveCatalogIdForTreatment(catalog, b);
            setContinueFromTreatmentId(treatmentId);
            setTreatmentForm({
                date: new Date().toISOString().slice(0, 10),
                category: b.category ?? b.kind ?? "",
                service_name: b.service_name ?? b.description ?? b.kind ?? "",
                serviceCatalogId: kid,
                treatment_number: bn,
                session_number: String(nextSitz),
                total_cost: "",
                treatment_status: "COMPLETED",
                appointment_required: "0",
                notes: "",
            });
            setSelectedTreatmentTooth(b.teeth ?? null);
        },
        [treatments, catalog, toast, t, setContinueFromTreatmentId, setTreatmentForm, setSelectedTreatmentTooth],
    );

    const continueTreatmentOptions = useMemo(
        () =>
            treatments.map((b) => ({
                value: b.id,
                label: treatmentContinueLabel(b),
            })),
        [treatments],
    );

    const nextUnterPreview = useMemo(
        () => previewNextExaminationNumber(examinations.map((u) => u.examination_number)),
        [examinations],
    );

    const treatmentFieldsLocked = Boolean(treatmentEditId) && !treatmentFormUnlocked;

    const treatmentComposerCommon = {
        navigate,
        chart,
        findings,
        selectedTreatmentTooth,
        onSelectTooth: setSelectedTreatmentTooth,
        treatmentEditId,
        treatmentComposerMode,
        treatmentFieldsLocked,
        onUnlockFields: () => setTreatmentFormUnlocked(true),
        onCancelComposer: () => {
            setShowTreatmentComposer(false);
            setTreatmentComposerMode(null);
            setTreatmentEditId(null);
            setContinueFromTreatmentId("");
            setTreatmentFormUnlocked(true);
        },
        continueTreatmentOptions,
        continueFromTreatmentId,
        applyContinueFromTreatment,
        treatmentForm,
        setTreatmentForm,
        categoryOptions,
        serviceCatalogOptions,
        catalog,
        planNext,
        runSaveTreatment,
    } satisfies TreatmentChartComposerPanelProps;

    return {
        runSavePatient,
        runSaveTreatment,
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
    };
}
