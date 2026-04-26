import { useMemo, useState } from "react";
import { Input, Select, Textarea } from "./ui/input";
import { Button } from "./ui/button";
import { DentalChart } from "./DentalChart";
import type { Zahnbefund } from "@/models/types";
import { parseUntersuchungV1, UNTERSUCHUNG_V1_EMPTY, type UntersuchungV1 } from "@/lib/untersuchung";

/**
 * Strukturiertes Untersuchungsschema (Version 1).
 *
 * Sektionen orientieren sich an üblichen zahnärztlichen Untersuchungsabläufen:
 *   1. Anamnese-Update / Beschwerde
 *   2. Extraoraler Befund
 *   3. Intraoraler Weichgewebsbefund
 *   4. Hartsubstanz / Zahnbefund (Chart)
 *   5. Parodontalstatus (PSI je Sextant, BOP, PI, MH)
 *   6. Funktion / Okklusion / CMD
 *   7. Röntgen / Bildgebung
 *   8. Diagnose / Therapieempfehlung
 *
 * Speichert in der Untersuchung-Tabelle:
 *   - beschwerden  ← Beschwerden (Hauptbeschwerde + Schmerzlokalisation)
 *   - diagnose     ← primäre Diagnose-Zeile
 *   - ergebnisse   ← JSON (UntersuchungV1) für Detailansicht / Export
 */

const PSI_OPTS = [
    { value: "", label: "—" },
    { value: "0", label: "0 (gesund)" },
    { value: "1", label: "1 (BOP)" },
    { value: "2", label: "2 (Konkremente)" },
    { value: "3", label: "3 (Sondiertiefe 4–5 mm)" },
    { value: "4", label: "4 (Sondiertiefe ≥ 6 mm)" },
    { value: "*", label: "*-Befund (Furkation/Rezession)" },
];

const SECTIONS = [
    { id: "haupt", label: "Hauptbeschwerde" },
    { id: "extra", label: "Extraoral" },
    { id: "intra", label: "Intraoral" },
    { id: "hart", label: "Zahnbefund" },
    { id: "paro", label: "Parodontal" },
    { id: "funk", label: "Funktion" },
    { id: "rx", label: "Bildgebung" },
    { id: "diag", label: "Diagnose & Plan" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

export interface UntersuchungSubmit {
    beschwerden: string;
    diagnose: string;
    ergebnisseJson: string;
}

export type UntersuchungComposerInitial = {
    beschwerden: string | null;
    ergebnisse: string | null;
    diagnose: string | null;
};

function initialDataFromRecord(row: UntersuchungComposerInitial): UntersuchungV1 {
    const parsed = parseUntersuchungV1(row.ergebnisse);
    if (parsed) {
        const d = { ...parsed };
        if (!d.diagnosis.trim() && row.diagnose?.trim()) d.diagnosis = row.diagnose.trim();
        if (!d.chiefComplaint.trim() && row.beschwerden?.trim()) d.chiefComplaint = row.beschwerden.trim();
        return d;
    }
    return {
        ...UNTERSUCHUNG_V1_EMPTY,
        chiefComplaint: row.beschwerden?.trim() ?? "",
        diagnosis: row.diagnose?.trim() ?? "",
    };
}

interface Props {
    befunde: Zahnbefund[];
    onApplyTooth: (tooth: number, statusKey: string) => Promise<void>;
    onCancel: () => void;
    onSave: (data: UntersuchungSubmit) => Promise<void>;
    /** Load existing DB row (structured JSON + fallback columns). */
    initialFromRecord?: UntersuchungComposerInitial;
    /** `edit`: Speichern-Label; validation matches create. */
    variant?: "create" | "edit";
    /** Nur lesen — Felder und Chart gesperrt, bis die übergeordnete Maske „Bearbeiten“ anbietet. */
    locked?: boolean;
}

export function UntersuchungComposer({
    befunde,
    onApplyTooth,
    onCancel,
    onSave,
    initialFromRecord,
    variant = "create",
    locked = false,
}: Props) {
    const [data, setData] = useState<UntersuchungV1>(() =>
        initialFromRecord ? initialDataFromRecord(initialFromRecord) : UNTERSUCHUNG_V1_EMPTY,
    );
    const [section, setSection] = useState<SectionId>("haupt");
    const [busy, setBusy] = useState(false);

    const completion = useMemo(() => {
        let filled = 0;
        let total = 0;
        const inc = (val: string) => {
            total += 1;
            if (val.trim()) filled += 1;
        };
        inc(data.chiefComplaint);
        inc(data.extraoral.asymmetry + data.extraoral.tmj);
        inc(data.intraoral.mucosa + data.intraoral.gingiva);
        inc(Object.values(data.psi).join(""));
        inc(data.diagnosis);
        inc(data.plan);
        return Math.round((filled / total) * 100);
    }, [data]);

    const upd = <K extends keyof UntersuchungV1>(key: K, val: UntersuchungV1[K]) =>
        setData((prev) => ({ ...prev, [key]: val }));

    const updGroup = <K extends keyof UntersuchungV1>(group: K, patch: Partial<UntersuchungV1[K]>) =>
        setData((prev) => ({ ...prev, [group]: { ...(prev[group] as object), ...patch } as UntersuchungV1[K] }));

    const submit = async () => {
        if (busy || locked) return;
        setBusy(true);
        try {
            const beschwerden =
                [data.chiefComplaint, data.painLocation && `Lokalisation: ${data.painLocation}`, data.painVas && `Schmerz VAS ${data.painVas}/10`]
                    .filter(Boolean)
                    .join(" · ") || "";
            const diagnose = data.diagnosis || "";
            await onSave({ beschwerden, diagnose, ergebnisseJson: JSON.stringify({ ...data, version: 1 }) });
            if (!initialFromRecord) setData(UNTERSUCHUNG_V1_EMPTY);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="col" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="row" role="tablist" aria-label="Untersuchung Sektionen" style={{ gap: 4, flexWrap: "wrap" }}>
                    {SECTIONS.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={section === s.id}
                            className={`btn-chip ${section === s.id ? "is-active" : ""}`}
                            onClick={() => setSection(s.id)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>Erfasst: {completion}%</span>
            </div>

            {section === "haupt" && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Textarea
                        id="u-haupt-bes"
                        label="Hauptbeschwerde *"
                        value={data.chiefComplaint}
                        onChange={(e) => upd("chiefComplaint", e.target.value)}
                        rows={3}
                        placeholder="Schmerz, Druck, Blutung, Ästhetik, Routine…"
                        disabled={locked}
                    />
                    <Input
                        id="u-pain-vas"
                        label="Schmerz (VAS 0–10)"
                        value={data.painVas}
                        onChange={(e) => upd("painVas", e.target.value)}
                        placeholder="0–10"
                        disabled={locked}
                    />
                    <Input
                        id="u-pain-loc"
                        label="Lokalisation"
                        value={data.painLocation}
                        onChange={(e) => upd("painLocation", e.target.value)}
                        placeholder="z. B. Reg. 36 Quadrant III"
                        disabled={locked}
                    />
                </div>
            )}

            {section === "extra" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-extra-asym" label="Asymmetrie / Schwellungen" value={data.extraoral.asymmetry} onChange={(e) => updGroup("extraoral", { asymmetry: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-extra-lymph" label="Lymphknoten (cervico-fazial)" value={data.extraoral.lymphNodes} onChange={(e) => updGroup("extraoral", { lymphNodes: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-extra-tmj" label="Kiefergelenk (TMG)" value={data.extraoral.tmj} onChange={(e) => updGroup("extraoral", { tmj: e.target.value })} rows={2} placeholder="Knacken, Krepitation, Mundöffnung mm" disabled={locked} />
                    <Textarea id="u-extra-musc" label="Muskulatur (M. masseter / temporalis)" value={data.extraoral.muscles} onChange={(e) => updGroup("extraoral", { muscles: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "intra" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-intra-muc" label="Mundschleimhaut" value={data.intraoral.mucosa} onChange={(e) => updGroup("intraoral", { mucosa: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-tng" label="Zunge / Mundboden" value={data.intraoral.tongue} onChange={(e) => updGroup("intraoral", { tongue: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-ging" label="Gingiva (Konsistenz / Farbe)" value={data.intraoral.gingiva} onChange={(e) => updGroup("intraoral", { gingiva: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-sal" label="Speicheldrüsen / Speichelfluss" value={data.intraoral.salivary} onChange={(e) => updGroup("intraoral", { salivary: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "hart" && (
                <div className="col" style={{ gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                        Befund je Zahn: Doppelklick öffnet Statusauswahl. Befunde werden direkt am Patienten gespeichert.
                    </p>
                    <DentalChart befunde={befunde} disabled={locked} onApply={async (tooth, statusKey) => { await onApplyTooth(tooth, statusKey); }} />
                </div>
            )}

            {section === "paro" && (
                <div className="col" style={{ gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>PSI je Sextant (S1 17–14, S2 13–23, S3 24–27, S4 47–44, S5 43–33, S6 34–37).</p>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        {(["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((k, i) => (
                            <Select
                                key={k}
                                label={`Sextant ${i + 1}`}
                                value={data.psi[k]}
                                options={PSI_OPTS}
                                onChange={(e) => updGroup("psi", { [k]: e.target.value } as never)}
                                disabled={locked}
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input id="u-bop" label="BOP %" value={data.bopPercent} onChange={(e) => upd("bopPercent", e.target.value)} placeholder="z. B. 18" disabled={locked} />
                        <Input id="u-plaque" label="Plaque-Index" value={data.plaqueIndex} onChange={(e) => upd("plaqueIndex", e.target.value)} placeholder="0–3" disabled={locked} />
                        <Input id="u-hyg" label="Mundhygiene" value={data.hygieneScore} onChange={(e) => upd("hygieneScore", e.target.value)} placeholder="gut / mittel / schlecht" disabled={locked} />
                    </div>
                </div>
            )}

            {section === "funk" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-fun-cmd" label="CMD-Befund" value={data.function.cmd} onChange={(e) => updGroup("function", { cmd: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-brux" label="Bruxismus / Parafunktion" value={data.function.bruxism} onChange={(e) => updGroup("function", { bruxism: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-splint" label="Schiene / Reha" value={data.function.splint} onChange={(e) => updGroup("function", { splint: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-other" label="Weitere Befunde / Okklusion" value={data.function.notes} onChange={(e) => updGroup("function", { notes: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "rx" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-rx-ord" label="Veranlasste Bildgebung" value={data.imaging.ordered} onChange={(e) => updGroup("imaging", { ordered: e.target.value })} rows={2} placeholder="z. B. OPG, BWL, PA-Status" disabled={locked} />
                    <Textarea id="u-rx-find" label="Röntgen-/Befund-Notiz" value={data.imaging.findings} onChange={(e) => updGroup("imaging", { findings: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "diag" && (
                <div className="col" style={{ gap: 12 }}>
                    <Textarea id="u-diag" label="Diagnose *" value={data.diagnosis} onChange={(e) => upd("diagnosis", e.target.value)} rows={3} placeholder="z. B. K02.1 Karies dentini Reg. 36 distal" disabled={locked} />
                    <Textarea id="u-plan" label="Therapieempfehlung / Plan" value={data.plan} onChange={(e) => upd("plan", e.target.value)} rows={4} placeholder="Empfohlene Behandlungen, Sitzungen, Recall" disabled={locked} />
                </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>Abbrechen</Button>
                <Button
                    type="button"
                    onClick={() => void submit()}
                    disabled={
                        locked ||
                        busy ||
                        (variant === "edit"
                            ? false
                            : !data.chiefComplaint.trim() || !data.diagnosis.trim())
                    }
                    loading={busy}
                >
                    {variant === "edit" ? "Änderungen speichern" : "Untersuchung speichern"}
                </Button>
            </div>
        </div>
    );
}

