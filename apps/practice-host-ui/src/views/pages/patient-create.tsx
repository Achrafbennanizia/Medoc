import { useT, useTParams } from "@/lib/i18n";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "@/systems/practice-host/controllers/patient.controller";
import { saveAnamnesebogen } from "@/systems/practice-host/controllers/akte.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

type FormState = {
    nachname: string;
    vorname: string;
    geburtsdatum: string;
    geschlecht: string;
    telefon: string;
    email: string;
    adresse: string;
    versicherungsstatus: string;
    krankenkasse: string;
    versicherungsnummer: string;
    chronisch: string;
    frueherDiagnosen: string;
    operationen: string;
    krankenhaus: string;
    psychisch: string;
    medikamente: string;
    einnahme: string;
    selbstmedikation: string;
    vergessen: string;
    nebenwirkungen: string;
    allergienMed: string;
    allergienLebensmittel: string;
    allergienSonst: string;
    material: string;
    impfreaktionen: string;
};

const initialForm: FormState = {
    nachname: "",
    vorname: "",
    geburtsdatum: "",
    geschlecht: "MAENNLICH",
    telefon: "",
    email: "",
    adresse: "",
    versicherungsstatus: "GKV",
    krankenkasse: "",
    versicherungsnummer: "",
    chronisch: "",
    frueherDiagnosen: "",
    operationen: "",
    krankenhaus: "",
    psychisch: "",
    medikamente: "",
    einnahme: "",
    selbstmedikation: "",
    vergessen: "",
    nebenwirkungen: "",
    allergienMed: "",
    allergienLebensmittel: "",
    allergienSonst: "",
    material: "",
    impfreaktionen: "",
};

type CreateStepKey = "stamm" | "anam" | "save";

export function PatientCreatePage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const { canWriteMedical } = useRbac();
    const createStepKeys = useMemo(
        (): readonly CreateStepKey[] =>
            canWriteMedical ? (["stamm", "anam", "save"] as const) : (["stamm", "save"] as const),
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
        () => Object.values(form).some((v) => (typeof v === "string" ? v.trim() !== "" : false)),
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
        if (!form.nachname.trim()) next.nachname = t("page.patient_create.validation.last_name_required");
        if (!form.vorname.trim()) next.vorname = t("page.patient_create.validation.first_name_required");
        if (!form.geburtsdatum) {
            next.geburtsdatum = t("page.patient_create.validation.birthdate_required");
        } else {
            const today = new Date();
            const gb = new Date(`${form.geburtsdatum}T00:00:00`);
            if (Number.isNaN(gb.getTime())) {
                next.geburtsdatum = t("page.patient_create.validation.invalid_date");
            } else if (gb > today) {
                next.geburtsdatum = t("page.patient_create.validation.birthdate_future");
            }
        }
        if (!form.versicherungsnummer.trim()) {
            next.versicherungsnummer = t("page.patient_create.validation.insurance_number_required");
        } else if (!/^[A-Z0-9-]{5,20}$/i.test(form.versicherungsnummer.trim())) {
            next.versicherungsnummer = t("page.patient_create.validation.insurance_number_format");
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
            next.email = t("page.patient_create.validation.invalid_email");
        }
        if (form.telefon.trim() && !/^[+0-9 ()/-]{4,}$/.test(form.telefon.trim())) {
            next.telefon = t("page.patient_create.validation.invalid_phone");
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleCreate = async () => {
        if (!validate()) return;
        const name = `${form.vorname.trim()} ${form.nachname.trim()}`.trim();
        setBusy(true);
        try {
            const patient = await createPatient({
                name,
                geburtsdatum: form.geburtsdatum,
                geschlecht: form.geschlecht,
                versicherungsnummer: form.versicherungsnummer.trim(),
                telefon: form.telefon.trim() || undefined,
                email: form.email.trim() || undefined,
                adresse: form.adresse.trim() || undefined,
            });

            if (canWriteMedical) {
                const antworten = {
                    version: 1,
                    versicherungsstatus: form.versicherungsstatus,
                    krankenkasse: form.krankenkasse.trim(),
                    vorerkrankungen: {
                        chronisch: form.chronisch.trim(),
                        frueherDiagnosen: form.frueherDiagnosen.trim(),
                        operationen: form.operationen.trim(),
                        krankenhaus: form.krankenhaus.trim(),
                        psychisch: form.psychisch.trim(),
                    },
                    medikation: {
                        regelmaessig: form.medikamente.trim(),
                        einnahme: form.einnahme.trim(),
                        selbst: form.selbstmedikation.trim(),
                        vergessen: form.vergessen.trim(),
                        nebenwirkungen: form.nebenwirkungen.trim(),
                    },
                    allergien: {
                        medikamente: form.allergienMed.trim(),
                        lebensmittel: form.allergienLebensmittel.trim(),
                        sonstige: form.allergienSonst.trim(),
                        material: form.material.trim(),
                        impfreaktionen: form.impfreaktionen.trim(),
                    },
                };

                try {
                    await saveAnamnesebogen({
                        patient_id: patient.id,
                        antworten,
                        unterschrieben: false,
                    });
                } catch (e) {
                    toast(tp("page.patient_create.toast.anam_save_failed", { message: errorMessage(e) }));
                    setDirty(false);
                    navigate("/patienten");
                    return;
                }
            }

            setDirty(false);
            toast(t("page.patient_create.toast.created"));
            navigate("/patienten");
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
        <div className="praxis-workspace-page animate-fade-in">
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
                        else navigate("/patienten");
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
                    navigate("/patienten");
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
                            if (stepKey === "stamm") scrollToSection("pc-person");
                            else if (stepKey === "anam") scrollToSection("pc-anam");
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
                        <Input id="nachname" label={t("page.patient_create.field.last_name")} hint={t("page.patient_create.field.last_name_hint")} value={form.nachname} error={errors.nachname} onChange={(e) => set("nachname", e.target.value)} />
                        <Input id="vorname" label={t("page.patient_create.field.first_name")} hint={t("page.patient_create.field.first_name_hint")} value={form.vorname} error={errors.vorname} onChange={(e) => set("vorname", e.target.value)} />
                        <Input id="geburtsdatum" type="date" label={t("page.patient_create.field.birthdate")} hint={t("page.patient_create.field.birthdate_hint")} value={form.geburtsdatum} error={errors.geburtsdatum} onChange={(e) => set("geburtsdatum", e.target.value)} />
                        <Select
                            id="geschlecht"
                            label={t("page.patient_create.field.gender")}
                            value={form.geschlecht}
                            onChange={(e) => set("geschlecht", e.target.value)}
                            options={[
                                { value: "MAENNLICH", label: t("patient.gender.MAENNLICH") },
                                { value: "WEIBLICH", label: t("patient.gender.WEIBLICH") },
                                { value: "DIVERS", label: t("patient.gender.DIVERS") },
                            ]}
                        />
                        <Input id="telefon" label={t("page.patient_create.field.phone")} value={form.telefon} error={errors.telefon} onChange={(e) => set("telefon", e.target.value)} />
                        <Input id="email" type="email" label={t("common.email")} value={form.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                    <Input id="adresse" label={t("page.patient_create.field.address")} value={form.adresse} onChange={(e) => set("adresse", e.target.value)} />
                </FormSection>

                <FormSection title={t("page.patient_create.section.insurance")}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            id="vstatus"
                            label={t("page.patient_create.field.insurance_status")}
                            value={form.versicherungsstatus}
                            onChange={(e) => set("versicherungsstatus", e.target.value)}
                            options={[
                                { value: "GKV", label: t("page.patient_create.insurance.gkv") },
                                { value: "PKV", label: t("page.patient_create.insurance.pkv") },
                                { value: "SONSTIG", label: t("page.patient_create.insurance.other") },
                            ]}
                        />
                        <Input id="krankenkasse" label={t("page.patient_create.field.insurance_fund")} value={form.krankenkasse} onChange={(e) => set("krankenkasse", e.target.value)} />
                        <Input
                            id="vnr"
                            label={t("page.patient_create.field.insurance_number")}
                            value={form.versicherungsnummer}
                            error={errors.versicherungsnummer}
                            onChange={(e) => set("versicherungsnummer", e.target.value)}
                        />
                    </div>
                </FormSection>

                {canWriteMedical ? (
                <div id="pc-anam">
                    <FormSection title={t("page.patient_create.section.prior_conditions")}>
                        <Textarea id="chronisch" label={t("page.patient_create.field.chronic")} value={form.chronisch} onChange={(e) => set("chronisch", e.target.value)} rows={2} />
                        <Textarea id="diag" label={t("page.patient_create.field.prior_diagnoses")} value={form.frueherDiagnosen} onChange={(e) => set("frueherDiagnosen", e.target.value)} rows={2} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Textarea id="op" label={t("page.patient_create.field.operations")} value={form.operationen} onChange={(e) => set("operationen", e.target.value)} rows={2} />
                            <Textarea id="kh" label={t("page.patient_create.field.hospital")} value={form.krankenhaus} onChange={(e) => set("krankenhaus", e.target.value)} rows={2} />
                        </div>
                        <Textarea id="psy" label={t("page.patient_create.field.psychiatric")} value={form.psychisch} onChange={(e) => set("psychisch", e.target.value)} rows={2} />
                    </FormSection>

                    <details open className="card card-pad" style={{ marginTop: 16, border: "1px solid var(--line)" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, padding: "4px 0" }}>
                            {t("page.patient_create.med_allergies_collapse")}
                        </summary>
                        <div style={{ marginTop: 12 }}>
                            <FormSection title={t("page.patient_create.section.medication")}>
                                <Textarea id="med" label={t("page.patient_create.field.regular_meds")} value={form.medikamente} onChange={(e) => set("medikamente", e.target.value)} rows={2} />
                                <Textarea id="ein" label={t("page.patient_create.field.intake_notes")} value={form.einnahme} onChange={(e) => set("einnahme", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="selbst" label={t("page.patient_create.field.self_medication")} value={form.selbstmedikation} onChange={(e) => set("selbstmedikation", e.target.value)} rows={2} />
                                    <Textarea id="verg" label={t("page.patient_create.field.forgotten_meds")} value={form.vergessen} onChange={(e) => set("vergessen", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="neb" label={t("page.patient_create.field.side_effects")} value={form.nebenwirkungen} onChange={(e) => set("nebenwirkungen", e.target.value)} rows={2} />
                            </FormSection>

                            <FormSection title={t("page.patient_create.allergies_section")}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="allm" label={t("page.patient_create.field.drug_allergies")} value={form.allergienMed} onChange={(e) => set("allergienMed", e.target.value)} rows={2} />
                                    <Textarea id="alll" label={t("page.patient_create.field.food_intolerances")} value={form.allergienLebensmittel} onChange={(e) => set("allergienLebensmittel", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="alls" label={t("page.patient_create.field.other_reactions")} value={form.allergienSonst} onChange={(e) => set("allergienSonst", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="mat" label={t("page.patient_create.field.material_intolerance")} value={form.material} onChange={(e) => set("material", e.target.value)} rows={2} />
                                    <Textarea id="impf" label={t("page.patient_create.field.vaccine_reactions")} value={form.impfreaktionen} onChange={(e) => set("impfreaktionen", e.target.value)} rows={2} />
                                </div>
                            </FormSection>
                        </div>
                    </details>
                </div>
                ) : null}

                <div id="pc-actions" className="patient-create-sticky">
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/patienten")}>
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
