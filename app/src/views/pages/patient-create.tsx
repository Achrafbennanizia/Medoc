import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPatient } from "../../controllers/patient.controller";
import { saveAnamnesebogen } from "../../controllers/akte.controller";
import { useFormDirtyStore } from "../../models/store/form-dirty-store";
import { errorMessage } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Input, Select, Textarea } from "../components/ui/input";
import { FormSection } from "../components/ui/form-section";
import { Dialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { ChevronLeftIcon } from "@/lib/icons";

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

export function PatientCreatePage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<FormState>(initialForm);
    const [errors, setErrors] = useState<Partial<Record<keyof FormState | "general", string>>>({});
    const [scanOpen, setScanOpen] = useState(false);
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
        if (!form.nachname.trim()) next.nachname = "Bitte Nachnamen eingeben";
        if (!form.vorname.trim()) next.vorname = "Bitte Vornamen eingeben";
        if (!form.geburtsdatum) {
            next.geburtsdatum = "Bitte Geburtsdatum eingeben";
        } else {
            const today = new Date();
            const gb = new Date(`${form.geburtsdatum}T00:00:00`);
            if (Number.isNaN(gb.getTime())) {
                next.geburtsdatum = "Ungültiges Datum";
            } else if (gb > today) {
                next.geburtsdatum = "Geburtsdatum darf nicht in der Zukunft liegen";
            }
        }
        if (!form.versicherungsnummer.trim()) {
            next.versicherungsnummer = "Bitte Versichertennummer eingeben";
        } else if (!/^[A-Z0-9-]{5,20}$/i.test(form.versicherungsnummer.trim())) {
            next.versicherungsnummer = "Versichertennummer: 5–20 Zeichen, nur Buchstaben/Ziffern/Bindestrich";
        }
        if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) {
            next.email = "Ungültige E-Mail-Adresse";
        }
        if (form.telefon.trim() && !/^[+0-9 ()/-]{4,}$/.test(form.telefon.trim())) {
            next.telefon = "Telefon enthält ungültige Zeichen";
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
                toast(`Patient angelegt, Anamnese konnte nicht gespeichert werden: ${errorMessage(e)}`);
                setDirty(false);
                navigate("/patienten");
                return;
            }

            setDirty(false);
            toast("Patient erstellt");
            navigate("/patienten");
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`);
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
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
                <div className="row" style={{ gap: 10 }}>
                    <button type="button" className="btn btn-subtle" onClick={() => navigate("/patienten")}>
                        <ChevronLeftIcon />
                        Zurück
                    </button>
                    <div>
                        <h1 className="page-title">Neue Patientenakte hinzufügen</h1>
                        <div className="page-sub">Stammdaten, Versicherung und Anamnese — gemäß Wireframe</div>
                    </div>
                </div>
                <Button type="button" variant="secondary" onClick={() => setScanOpen(true)}>
                    Scannen
                </Button>
            </div>

            <Dialog
                open={scanOpen}
                onClose={() => setScanOpen(false)}
                title="Meldung"
                presentation="centered"
                footer={
                    <div className="modal-actions" style={{ justifyContent: "center" }}>
                        <Button type="button" onClick={() => setScanOpen(false)}>
                            OK
                        </Button>
                    </div>
                }
            >
                <p className="modal-body" style={{ margin: 0 }}>
                    Die Scannerfunktion ist in der Zeit nicht verfügbar.
                </p>
            </Dialog>

            <div className="patient-create-steps" aria-hidden>
                {(["Stammdaten", "Anamnese", "Speichern"] as const).map((label, i) => (
                    <button
                        key={label}
                        type="button"
                        className={`patient-create-step ${createStep === i ? "is-active" : ""}`}
                        onClick={() => {
                            setCreateStep(i);
                            if (i === 0) scrollToSection("pc-person");
                            if (i === 1) scrollToSection("pc-anam");
                            if (i === 2) scrollToSection("pc-actions");
                        }}
                    >
                        {i + 1}. {label}
                    </button>
                ))}
            </div>

            <div id="pc-person" className="card card-pad" style={{ maxWidth: 1040 }}>
                <FormSection title="Personendaten">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input id="nachname" label="Nachname *" value={form.nachname} error={errors.nachname} onChange={(e) => set("nachname", e.target.value)} />
                        <Input id="vorname" label="Vorname *" value={form.vorname} error={errors.vorname} onChange={(e) => set("vorname", e.target.value)} />
                        <Input id="geburtsdatum" type="date" label="Geburtsdatum *" value={form.geburtsdatum} error={errors.geburtsdatum} onChange={(e) => set("geburtsdatum", e.target.value)} />
                        <Select
                            id="geschlecht"
                            label="Geschlecht"
                            value={form.geschlecht}
                            onChange={(e) => set("geschlecht", e.target.value)}
                            options={[
                                { value: "MAENNLICH", label: "Männlich" },
                                { value: "WEIBLICH", label: "Weiblich" },
                                { value: "DIVERS", label: "Divers" },
                            ]}
                        />
                        <Input id="telefon" label="Telefonnummer" value={form.telefon} error={errors.telefon} onChange={(e) => set("telefon", e.target.value)} />
                        <Input id="email" type="email" label="E-Mail" value={form.email} error={errors.email} onChange={(e) => set("email", e.target.value)} />
                    </div>
                    <Input id="adresse" label="Adresse" value={form.adresse} onChange={(e) => set("adresse", e.target.value)} />
                </FormSection>

                <FormSection title="Versicherungsdaten">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                            id="vstatus"
                            label="Versicherungsstatus"
                            value={form.versicherungsstatus}
                            onChange={(e) => set("versicherungsstatus", e.target.value)}
                            options={[
                                { value: "GKV", label: "Gesetzlich (GKV)" },
                                { value: "PKV", label: "Privat (PKV)" },
                                { value: "SONSTIG", label: "Sonstiges / Selbstzahler" },
                            ]}
                        />
                        <Input id="krankenkasse" label="Krankenversicherung / Kasse" value={form.krankenkasse} onChange={(e) => set("krankenkasse", e.target.value)} />
                        <Input
                            id="vnr"
                            label="Versichertennummer *"
                            value={form.versicherungsnummer}
                            error={errors.versicherungsnummer}
                            onChange={(e) => set("versicherungsnummer", e.target.value)}
                        />
                    </div>
                </FormSection>

                <div id="pc-anam">
                    <FormSection title="Relevante Vorerkrankungen">
                        <Textarea id="chronisch" label="Chronische Erkrankungen" value={form.chronisch} onChange={(e) => set("chronisch", e.target.value)} rows={2} />
                        <Textarea id="diag" label="Frühere Diagnosen" value={form.frueherDiagnosen} onChange={(e) => set("frueherDiagnosen", e.target.value)} rows={2} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Textarea id="op" label="Operationen" value={form.operationen} onChange={(e) => set("operationen", e.target.value)} rows={2} />
                            <Textarea id="kh" label="Krankenhausaufenthalte" value={form.krankenhaus} onChange={(e) => set("krankenhaus", e.target.value)} rows={2} />
                        </div>
                        <Textarea id="psy" label="Psychische Erkrankungen" value={form.psychisch} onChange={(e) => set("psychisch", e.target.value)} rows={2} />
                    </FormSection>

                    <details open className="card card-pad" style={{ marginTop: 16, border: "1px solid var(--line)" }}>
                        <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 15, padding: "4px 0" }}>
                            Medikation & Allergien (einklappen)
                        </summary>
                        <div style={{ marginTop: 12 }}>
                            <FormSection title="Medikation / Behandlungsplan">
                                <Textarea id="med" label="Regelmäßige Medikamente" value={form.medikamente} onChange={(e) => set("medikamente", e.target.value)} rows={2} />
                                <Textarea id="ein" label="Einnahmehinweise / -verhalten" value={form.einnahme} onChange={(e) => set("einnahme", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="selbst" label="Selbstmedikation" value={form.selbstmedikation} onChange={(e) => set("selbstmedikation", e.target.value)} rows={2} />
                                    <Textarea id="verg" label="Vergessene Medikamente" value={form.vergessen} onChange={(e) => set("vergessen", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="neb" label="Nebenwirkungen" value={form.nebenwirkungen} onChange={(e) => set("nebenwirkungen", e.target.value)} rows={2} />
                            </FormSection>

                            <FormSection title="Allergien und Unverträglichkeiten">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="allm" label="Medikamentenallergien" value={form.allergienMed} onChange={(e) => set("allergienMed", e.target.value)} rows={2} />
                                    <Textarea id="alll" label="Lebensmittelunverträglichkeiten" value={form.allergienLebensmittel} onChange={(e) => set("allergienLebensmittel", e.target.value)} rows={2} />
                                </div>
                                <Textarea id="alls" label="Unbekannte / andere Reaktionen" value={form.allergienSonst} onChange={(e) => set("allergienSonst", e.target.value)} rows={2} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Textarea id="mat" label="Materialunverträglichkeit" value={form.material} onChange={(e) => set("material", e.target.value)} rows={2} />
                                    <Textarea id="impf" label="Impfreaktionen" value={form.impfreaktionen} onChange={(e) => set("impfreaktionen", e.target.value)} rows={2} />
                                </div>
                            </FormSection>
                        </div>
                    </details>
                </div>

                <div id="pc-actions" className="patient-create-sticky">
                    <div className="row" style={{ justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/patienten")}>
                            Abbrechen
                        </Button>
                        <Button type="button" onClick={handleCreate} disabled={busy} loading={busy}>
                            Speichern
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
