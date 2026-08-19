import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "@/systems/practice-host/controllers/patient.controller";
import { saveAnamnesisForm } from "@/systems/practice-host/controllers/chart.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { WorkspacePageHeader } from "../components/administration-page-header";

type FormState = {
    last_name: string;
    first_name: string;
    date_of_birth: string;
    sex: string;
    phone: string;
    email: string;
    address: string;
    insuranceStatus: string;
    health_insurance: string;
    insurance_number: string;
    chronic: string;
    previousDiagnoses: string;
    surgeries: string;
    hospital: string;
    mental: string;
    medications: string;
    dosing: string;
    selbstmedikation: string;
    vergessen: string;
    sideEffects: string;
    allergiesMed: string;
    allergiesFoods: string;
    allergiesSonst: string;
    material: string;
    vaccineReactions: string;
};

const initialForm: FormState = {
    last_name: "",
    first_name: "",
    date_of_birth: "",
    sex: "MALE",
    phone: "",
    email: "",
    address: "",
    insuranceStatus: "GKV",
    health_insurance: "",
    insurance_number: "",
    chronic: "",
    previousDiagnoses: "",
    surgeries: "",
    hospital: "",
    mental: "",
    medications: "",
    dosing: "",
    selbstmedikation: "",
    vergessen: "",
    sideEffects: "",
    allergiesMed: "",
    allergiesFoods: "",
    allergiesSonst: "",
    material: "",
    vaccineReactions: "",
};

type CreateStepKey = "master" | "anamnesis" | "save";

export function PatientCreatePage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const { canWriteMedical } = useRbac();
    const createStepKeys = useMemo(
        (): readonly CreateStepKey[] =>
            canWriteMedical ? (["master", "anamnesis", "save"] as const) : (["master", "save"] as const),
        [canWriteMedical],
    );
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<FormState>(initialForm);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState | "general", string>>>({});
    const [scanOpen, setScanOpen] = useState(false);
    const [abandonOpen, setAbandonOpen] = useState(false);
    const [createStep, setCreateStep] = useState(0);
    const setDirty = useFormDirtyStore((s) => s.setDirty);

    const scrollToSection = useCallback((id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, []);

    const formTouched = useMemo(
        () => Object.values(form).some((version) => (typeof version === "string" ? version.trim() !== "" : false)),
        [form],
    );

    useEffect(() => {
        setDirty(formTouched);
        return () => setDirty(false);
    }, [formTouched, setDirty]);

    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (useFormDirtyStore.getState().dirty) e.preventDefault();
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    const validate = (): boolean => {
        const next: Partial<Record<keyof FormState | "general", string>> = {};
        if (!form.last_name.trim()) next.last_name = t("page.patient_create.validation.last_name_required");
        if (!form.first_name.trim()) next.first_name = t("page.patient_create.validation.first_name_required");
        if (!form.date_of_birth) {
            next.date_of_birth = t("page.patient_create.validation.birthdate_required");
        } else {
            const today = new Date();
            const gb = new Date(`${form.date_of_birth}T00:00:00`);
            if (Number.isNaN(gb.getTime())) {
                next.date_of_birth = t("page.patient_create.validation.invalid_date");
            } else if (gb > today) {
                next.date_of_birth = t("page.patient_create.validation.birthdate_future");
            }
        }
        if (!form.insurance_number.trim()) {
            next.insurance_number = t("page.patient_create.validation.insurance_number_required");
        } else if (!/^[A-Z0-9-]{5,20}$/i.test(form.insurance_number.trim())) {
            next.insurance_number = t("page.patient_create.validation.insurance_number_format");
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
            next.email = t("page.patient_create.validation.invalid_email");
        }
        if (form.phone.trim() && !/^[+0-9 ()/-]{4,}$/.test(form.phone.trim())) {
            next.phone = t("page.patient_create.validation.invalid_phone");
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        const name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
        setBusy(true);
        try {
            const patient = await createPatient({
                name,
                date_of_birth: form.date_of_birth,
                sex: form.sex,
                insurance_number: form.insurance_number.trim(),
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                address: form.address.trim() || undefined,
            });

            if (canWriteMedical) {
                const answers = {
                    version: 1,
                    insuranceStatus: form.insuranceStatus,
                    health_insurance: form.health_insurance.trim(),
                    preExisting: {
                        chronic: form.chronic.trim(),
                        previousDiagnoses: form.previousDiagnoses.trim(),
                        surgeries: form.surgeries.trim(),
                        hospital: form.hospital.trim(),
                        mental: form.mental.trim(),
                    },
                    medication: {
                        regular: form.medications.trim(),
                        dosing: form.dosing.trim(),
                        selbst: form.selbstmedikation.trim(),
                        vergessen: form.vergessen.trim(),
                        sideEffects: form.sideEffects.trim(),
                    },
                    allergies: {
                        medications: form.allergiesMed.trim(),
                        foods: form.allergiesFoods.trim(),
                        other: form.allergiesSonst.trim(),
                        material: form.material.trim(),
                        vaccineReactions: form.vaccineReactions.trim(),
                    },
                };

                try {
                    await saveAnamnesisForm({
                        patient_id: patient.id,
                        answers,
                        signed: false,
                    });
                } catch (e) {
                    toast(tp("page.patient_create.toast.anam_save_failed", { message: errorMessage(e) }));
                    setDirty(false);
                    navigate("/patients");
                    return;
                }
            }

            setDirty(false);
            toast(t("page.patient_create.toast.created"));
            navigate("/patients");
        } catch (e) {
            toast(tp("page.patient_create.toast.error", { message: errorMessage(e) }));
        } finally {
            setBusy(false);
        }
    };

    const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
        setForm((f) => ({ ...f, [key]: value }));
        setErrors((e) => {
            if (!(key in e)) return e;
            const rest = { ...e };
            delete rest[key];
            return rest;
        });
    };

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("page.patient_create.title")}
                subtitle={
                    canWriteMedical
                        ? t("page.patient_create.subtitle.medical")
                        : t("page.patient_create.subtitle.reception")
                }
                back={{
                    onClick: () => {
                        if (formTouched) setAbandonOpen(true);
                        else navigate("/patients");
                    },
                    label: t("patient.detail.back"),
                }}
                actions={
                    <Button type="button" variant="secondary" onClick={() => setScanOpen(true)}>
                        {t("page.patient_create.scan")}
                    </Button>
                }
            />

            <Dialog
                open={scanOpen}
                onClose={() => setScanOpen(false)}
                title={t("page.patient_create.scan_dialog_title")}
                presentation="centered"
                footer={
                    <div className="modal-actions" style={{ justifyContent: "center" }}>
                        <Button type="button" onClick={() => setScanOpen(false)}>
                            {t("common.ok")}
                        </Button>
                    </div>
                }
            >
                <p className="modal-body" style={{ margin: 0 }}>
                    {t("page.patient_create.scan_unavailable")}
                </p>
            </Dialog>

            <ConfirmDialog
                open={abandonOpen}
                onClose={() => setAbandonOpen(false)}
                title={t("page.patient_create.abandon_title")}
                message={t("page.patient_create.abandon_message")}
                confirmLabel={t("page.patient_create.abandon_confirm")}
                danger
                onConfirm={() => {
                    setDirty(false);
                    setAbandonOpen(false);
                    navigate("/patients");
                }}
            />

            <div className="patient-create-steps" aria-hidden>
                {createStepKeys.map((stepKey, i) => (
                    <button
                        key={stepKey}
                        type="button"
                        className={`patient-create-step ${createStep === i ? "is-active" : ""}`}
                        onClick={() => {
                            setCreateStep(i);
                            if (stepKey === "master") scrollToSection("pc-person");
                            else if (stepKey === "anamnesis") scrollToSection("pc-anam");
                            else scrollToSection("pc-actions");
                        }}
                    >
                        {i + 1}. {t(`page.patient_create.step.${stepKey}`)}
                    </button>
                ))}
            </div>

            <div id="pc-person" className="card card-pad card--overflow-visible" style={{ maxWidth: 1040 }}>
                <FormSection title={t("page.patient_create.section.person")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input id="last_name" label={t("page.patient_create.field.last_name")} hint={t("page.patient_create.field.last_name_hint")} value={form.last_name} error={errors.last_name} onChange={(e) => set("last_name", e.target.value)} />
                        <Input id="first_name" label={t("page.patient_create.field.first_name")} hint={t("page.patient_create.field.first_name_hint")} value={form.first_name} error={errors.first_name} onChange={(e) => set("first_name", e.target.value)} />
                        <Input id="date_of_birth" type="date" label={t("page.patient_create.field.birthdate")} hint={t("page.patient_create.field.birthdate_hint")} value={form.date_of_birth} error={errors.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
                        <Select
                            id="sex"
                            label={t("page.patient_create.field.gender")}
                            value={form.sex}
                            onChange={(e) => set("sex", e.target.value)}
                            options={[
                                { value: "MALE", label: t("patient.gender.MALE") },
                                { value: "FEMALE", label: t("patient.gender.FEMALE") },
                                { value: "DIVERSE", label: t("patient.gender.DIVERSE") },
                            ]}
                        />
                        <Input id="phone" label={t("page.patient_create.field.phone")} value={form.phone} error={errors.phone} onChange={(e) => set("phone", e.target.value)} />
                        <Input id="email" type="email" label={t("common.email")} value={form.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                    <Input id="address" label={t("page.patient_create.field.address")} value={form.address} onChange={(e) => set("address", e.target.value)} />
                </FormSection>

                <FormSection title={t("page.patient_create.section.insurance")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            id="vstatus"
                            label={t("page.patient_create.field.insurance_status")}
                            value={form.insuranceStatus}
                            onChange={(e) => set("insuranceStatus", e.target.value)}
                            options={[
                                { value: "GKV", label: t("page.patient_create.insurance.gkv") },
                                { value: "PKV", label: t("page.patient_create.insurance.pkv") },
                                { value: "SONSTIG", label: t("page.patient_create.insurance.other") },
                            ]}
                        />
                        <Input id="health_insurance" label={t("page.patient_create.field.insurance_fund")} value={form.health_insurance} onChange={(e) => set("health_insurance", e.target.value)} />
                        <Input
                            id="vnr"
                            label={t("page.patient_create.field.insurance_number")}
                            value={form.insurance_number}
                            error={errors.insurance_number}
                            onChange={(e) => set("insurance_number", e.target.value)}
                        />
                    </div>
                </FormSection>

                {canWriteMedical ? (
                <div id="pc-anam">
                    <FormSection title={t("page.patient_create.section.prior_conditions")}>
                        <Textarea id="chronic" label={t("page.patient_create.field.chronic")} value={form.chronic} onChange={(e) => set("chronic", e.target.value)} rows={2} />
                        <Textarea id="diag" label={t("page.patient_create.field.prior_diagnoses")} value={form.previousDiagnoses} onChange={(e) => set("previousDiagnoses", e.target.value)} rows={2} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Textarea id="op" label={t("page.patient_create.field.operations")} value={form.surgeries} onChange={(e) => set("surgeries", e.target.value)} rows={2} />
                            <Textarea id="kh" label={t("page.patient_create.field.hospital")} value={form.hospital} onChange={(e) => set("hospital", e.target.value)} rows={2} />
                        </div>
                        <Textarea id="psy" label={t("page.patient_create.field.psychiatric")} value={form.mental} onChange={(e) => set("mental", e.target.value)} rows={2} />
                    </FormSection>

                    <details open className="card card-pad" style={{ marginTop: 16, border: "1px solid var(--line)" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, padding: "4px 0" }}>
                            {t("page.patient_create.med_allergies_collapse")}
                        </summary>
                        <div style={{ marginTop: 12 }}>
                            <FormSection title={t("page.patient_create.section.medication")}>
                                <Textarea id="med" label={t("page.patient_create.field.regular_meds")} value={form.medications} onChange={(e) => set("medications", e.target.value)} rows={2} />
                                <Textarea id="ein" label={t("page.patient_create.field.intake_notes")} value={form.dosing} onChange={(e) => set("dosing", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="selbst" label={t("page.patient_create.field.self_medication")} value={form.selbstmedikation} onChange={(e) => set("selbstmedikation", e.target.value)} rows={2} />
                                    <Textarea id="verg" label={t("page.patient_create.field.forgotten_meds")} value={form.vergessen} onChange={(e) => set("vergessen", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="neb" label={t("page.patient_create.field.side_effects")} value={form.sideEffects} onChange={(e) => set("sideEffects", e.target.value)} rows={2} />
                            </FormSection>

                            <FormSection title={t("page.patient_create.allergies_section")}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="allm" label={t("page.patient_create.field.drug_allergies")} value={form.allergiesMed} onChange={(e) => set("allergiesMed", e.target.value)} rows={2} />
                                    <Textarea id="alll" label={t("page.patient_create.field.food_intolerances")} value={form.allergiesFoods} onChange={(e) => set("allergiesFoods", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="alls" label={t("page.patient_create.field.other_reactions")} value={form.allergiesSonst} onChange={(e) => set("allergiesSonst", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="mat" label={t("page.patient_create.field.material_intolerance")} value={form.material} onChange={(e) => set("material", e.target.value)} rows={2} />
                                    <Textarea id="impf" label={t("page.patient_create.field.vaccine_reactions")} value={form.vaccineReactions} onChange={(e) => set("vaccineReactions", e.target.value)} rows={2} />
                                </div>
                            </FormSection>
                        </div>
                    </details>
                </div>
                ) : null}

                <div id="pc-actions" className="patient-create-sticky">
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/patients")}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" onClick={handleCreate} disabled={busy} loading={busy}>
                            {t("common.save")}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
