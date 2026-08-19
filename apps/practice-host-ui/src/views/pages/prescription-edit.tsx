import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getPatient } from "@/systems/practice-host/controllers/patient.controller";
import { listPrescriptions, updatePrescription, type Prescription } from "@/systems/practice-host/controllers/prescription.controller";
import { errorMessage } from "@/lib/utils";
import type { Patient } from "../../models/types";
import { useAuthStore } from "../../models/store/auth-store";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { WorkspacePageHeader } from "../components/administration-page-header";
import {
    DOSAGE_FORM_OPTIONS,
    DENTAL_ICD10_SUGGESTIONS,
    PACK_SIZE_OPTIONS,
    PRESCRIPTION_KIND_OPTIONS,
    type PrescriptionLine,
} from "@/lib/medications";

export function PrescriptionEditPage() {
    const t = useT();
    const { id: patientId, prescriptionId } = useParams<{ id: string; prescriptionId: string }>();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);

    const [patient, setPatient] = useState<Patient | null>(null);
    const [prescription, setPrescription] = useState<Prescription | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [medication, setMedication] = useState("");
    const [active_ingredient, setActiveIngredient] = useState("");
    const [dosage, setDosage] = useState("");
    const [duration, setDuration] = useState("");
    const [instructions, setInstructions] = useState("");
    const [pzn, setPzn] = useState("");
    const [dosage_form, setDosageForm] = useState("");
    const [pack_size, setPackSize] = useState("");
    const [quantity, setQuantity] = useState("");
    const [prescriptionType, setPrescriptionKind] = useState<PrescriptionLine["prescription_type"]>("PRIVAT");
    const [icd10Code, setIcd10Code] = useState("");
    const [autIdem, setAutIdem] = useState(true);

    const load = useCallback(async () => {
        if (!patientId || !prescriptionId) return;
        setLoading(true);
        setLoadError(null);
        try {
            const [p, all] = await Promise.all([getPatient(patientId), listPrescriptions(patientId)]);
            setPatient(p);
            const r = all.find((x) => x.id === prescriptionId) ?? null;
            setPrescription(r);
            if (r) {
                setMedication(r.medication);
                setActiveIngredient(r.active_ingredient ?? "");
                setDosage(r.dosage);
                setDuration(r.duration);
                setInstructions(r.instructions ?? "");
                setPzn(r.pzn ?? "");
                setDosageForm(r.dosage_form ?? "");
                setPackSize(r.pack_size ?? "");
                setQuantity(r.quantity != null ? String(r.quantity) : "");
                setPrescriptionKind((r.prescription_type as PrescriptionLine["prescription_type"]) ?? "PRIVAT");
                setIcd10Code(r.icd10_code ?? "");
                setAutIdem(r.aut_idem ?? true);
            }
        } catch (e) {
            setLoadError(errorMessage(e));
            setPatient(null);
            setPrescription(null);
        } finally {
            setLoading(false);
        }
    }, [patientId, prescriptionId]);

    useEffect(() => {
        void load();
    }, [load]);

    const handleSave = async () => {
        if (!prescription || !session) return;
        if (!medication.trim() || !dosage.trim() || !duration.trim()) {
            toast(t("prescription.edit.validation"), "error");
            return;
        }
        const quantityN = Number.parseInt(quantity.trim(), 10);
        setSaving(true);
        try {
            await updatePrescription({
                id: prescription.id,
                medication: medication.trim(),
                active_ingredient: active_ingredient.trim() || null,
                dosage: dosage.trim(),
                duration: duration.trim(),
                instructions: instructions.trim() || null,
                pzn: pzn.trim() || null,
                dosage_form: dosage_form.trim() || null,
                pack_size: pack_size.trim() || null,
                quantity: Number.isFinite(quantityN) && quantityN > 0 ? quantityN : null,
                aut_idem: autIdem,
                prescription_type: prescriptionType,
                icd10_code: icd10Code.trim() || null,
                prescribing_physician_id: prescription.prescribing_physician_id ?? session.user_id,
            });
            toast(t("prescription.edit.saved"), "success");
            navigate(`/patients/${patientId}#prescription`);
        } catch (e) {
            toast(`${t("common.error")}: ${errorMessage(e)}`, "error");
        } finally {
            setSaving(false);
        }
    };

    if (!patientId || !prescriptionId) {
        return (
            <div className="animate-fade-in p-4">
                <p className="text-body text-on-surface-variant">{t("common.invalid_request")}</p>
            </div>
        );
    }

    if (loading) return <PageLoading label={t("common.loading")} />;
    if (loadError || !patient) {
        return <PageLoadError message={loadError ?? t("common.data_not_found")} onRetry={() => void load()} />;
    }

    if (!prescription) {
        return (
            <div className="practice-workspace-page animate-fade-in" style={{ maxWidth: 560 }}>
                <WorkspacePageHeader
                    title={t("prescription.edit.title")}
                    back={{ to: `/patients/${patientId}#prescription`, label: t("patient.detail.title") }}
                />
                <PageLoadError message={t("prescription.edit.not_found")} onRetry={() => void load()} />
            </div>
        );
    }

    const emDash = t("common.em_dash");

    return (
        <div className="practice-workspace-page animate-fade-in" style={{ maxWidth: 720 }}>
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("prescription.edit.title")}
                eyebrow={patient.name}
                back={{ to: `/patients/${patientId}#prescription`, label: t("patient.detail.title") }}
            />

            <Card>
                <CardHeader
                    title={t("page.prescriptions.section.medication")}
                    subtitle={t("prescription.edit.subtitle")}
                />
                <div style={{ padding: "0 16px 16px" }}>
                    <Input
                        id="re-edit-med"
                        label={t("page.prescriptions.field.medication")}
                        value={medication}
                        onChange={(e) => setMedication(e.target.value)}
                    />
                    <Input
                        id="re-edit-wirk"
                        label={t("page.prescriptions.field.active_ingredient")}
                        value={active_ingredient}
                        onChange={(e) => setActiveIngredient(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            id="re-edit-dos"
                            label={t("page.prescriptions.field.dosage")}
                            value={dosage}
                            onChange={(e) => setDosage(e.target.value)}
                            placeholder={t("page.prescriptions.field.dosage_ph")}
                        />
                        <Input
                            id="re-edit-duration"
                            label={t("page.prescriptions.field.duration")}
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder={t("page.prescriptions.field.duration_ph")}
                        />
                    </div>
                    <Textarea
                        id="re-edit-hin"
                        label={t("common.notes")}
                        rows={3}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ marginTop: 8 }}>
                        <Input
                            id="re-edit-pzn"
                            label={t("page.prescriptions.col.pzn")}
                            value={pzn}
                            onChange={(e) => setPzn(e.target.value)}
                        />
                        <Select
                            id="re-edit-dar"
                            label={t("page.prescriptions.field.dosage_form")}
                            value={dosage_form}
                            options={[
                                { value: "", label: emDash },
                                ...DOSAGE_FORM_OPTIONS.map((d) => ({ value: d, label: d })),
                            ]}
                            onChange={(e) => setDosageForm(e.target.value)}
                        />
                        <Select
                            id="re-edit-pack"
                            label={t("page.prescriptions.field.pack_size")}
                            value={pack_size}
                            options={[
                                { value: "", label: emDash },
                                ...PACK_SIZE_OPTIONS.map((p) => ({ value: p, label: p })),
                            ]}
                            onChange={(e) => setPackSize(e.target.value)}
                        />
                        <Input
                            id="re-edit-quantity"
                            label={t("page.prescriptions.field.quantity")}
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                        <Select
                            id="re-edit-kind"
                            label={t("page.prescriptions.field.prescription_kind")}
                            value={prescriptionType}
                            options={PRESCRIPTION_KIND_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                            onChange={(e) => setPrescriptionKind(e.target.value as PrescriptionLine["prescription_type"])}
                        />
                        <Input
                            id="re-edit-icd"
                            label={t("page.prescriptions.field.icd10")}
                            list="re-edit-icd-suggestions"
                            value={icd10Code}
                            onChange={(e) => setIcd10Code(e.target.value)}
                        />
                    </div>
                    <datalist id="re-edit-icd-suggestions">
                        {DENTAL_ICD10_SUGGESTIONS.map((c) => (
                            <option key={c} value={c} />
                        ))}
                    </datalist>
                    <label className="row" style={{ gap: 8, alignItems: "center", marginTop: 8, fontSize: 13 }}>
                        <input
                            type="checkbox"
                            checked={autIdem}
                            onChange={(e) => setAutIdem(e.target.checked)}
                        />
                        {t("page.prescriptions.field.aut_idem_no_subst")}
                    </label>
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                        <Button variant="ghost" onClick={() => navigate(`/patients/${patientId}#prescription`)} disabled={saving}>
                            {t("common.cancel")}
                        </Button>
                        <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
                            {t("common.save")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
