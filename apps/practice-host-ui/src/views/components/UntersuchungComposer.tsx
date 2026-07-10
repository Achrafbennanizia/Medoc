import { useMemo, useState } from "react";
import { Input, Select, Textarea } from "./ui/input";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "./ui/button";
import { DentalChart } from "./DentalChart";
import type { Zahnbefund } from "@/models/types";
import {
    DENTAL_STATUS_KEYS,
    dentalStatusLabel,
    type DentalStatusKey,
} from "@/lib/dental";
import {
    hasExamContent,
    parseUntersuchungV1,
    UNTERSUCHUNG_V1_EMPTY,
    type UntersuchungV1,
} from "@/lib/untersuchung";

/**
 * Structured examination schema (UntersuchungV1) — persisted as JSON in `ergebnisse`,
 * with `beschwerden` / `diagnose` columns for list views and legacy export.
 */

type SectionId = "haupt" | "extra" | "intra" | "hart" | "paro" | "funk" | "rx" | "diag";

export interface UntersuchungSubmit {
    beschwerden: string;
    diagnose: string;
    ergebnisseJson: string;
    kategorie?: string | null;
    leistungsname?: string | null;
    gesamtkosten?: number | null;
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
        if (!d.chiefComplaint.trim() && !d.generalNote.trim() && row.beschwerden?.trim()) {
            d.generalNote = row.beschwerden.trim();
        }
        return d;
    }
    return {
        ...UNTERSUCHUNG_V1_EMPTY,
        generalNote: row.beschwerden?.trim() ?? "",
        diagnosis: row.diagnose?.trim() ?? "",
    };
}

interface Props {
    befunde: Zahnbefund[];
    onApplyTooth: (tooth: number, statusKey: string) => Promise<void>;
    onCancel: () => void;
    onSave: (data: UntersuchungSubmit) => Promise<void>;
    initialFromRecord?: UntersuchungComposerInitial;
    variant?: "create" | "edit";
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
    const t = useT();
    const tp = useTParams();
    const psiOpts = useMemo(
        () => [
            { value: "", label: t("untersuchung.composer.psi_empty") },
            { value: "0", label: t("untersuchung.composer.psi_0") },
            { value: "1", label: t("untersuchung.composer.psi_1") },
            { value: "2", label: t("untersuchung.composer.psi_2") },
            { value: "3", label: t("untersuchung.composer.psi_3") },
            { value: "4", label: t("untersuchung.composer.psi_4") },
            { value: "*", label: t("untersuchung.composer.psi_star") },
        ],
        [t],
    );
    const sections = useMemo(
        () =>
            [
                { id: "haupt" as const, label: t("untersuchung.composer.section_haupt") },
                { id: "extra" as const, label: t("untersuchung.composer.section_extra") },
                { id: "intra" as const, label: t("untersuchung.composer.section_intra") },
                { id: "hart" as const, label: t("untersuchung.composer.section_hart") },
                { id: "paro" as const, label: t("untersuchung.composer.section_paro") },
                { id: "funk" as const, label: t("untersuchung.composer.section_funk") },
                { id: "rx" as const, label: t("untersuchung.composer.section_rx") },
                { id: "diag" as const, label: t("untersuchung.composer.section_diag") },
            ],
        [t],
    );
    const [data, setData] = useState<UntersuchungV1>(() =>
        initialFromRecord ? initialDataFromRecord(initialFromRecord) : UNTERSUCHUNG_V1_EMPTY,
    );
    const [section, setSection] = useState<SectionId>("haupt");
    const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
    const [statusBrush, setStatusBrush] = useState<DentalStatusKey>("healthy");
    const [statusBusy, setStatusBusy] = useState(false);
    const [busy, setBusy] = useState(false);

    const documentedTeeth = useMemo(
        () =>
            Object.entries(data.toothNotes)
                .filter(([, note]) => note.trim())
                .sort(([a], [b]) => Number(a) - Number(b)),
        [data.toothNotes],
    );

    const completion = useMemo(() => {
        let filled = 0;
        let total = 0;
        const inc = (val: string) => {
            total += 1;
            if (val.trim()) filled += 1;
        };
        inc(data.generalNote);
        inc(data.chiefComplaint);
        inc(data.extraoral.asymmetry + data.extraoral.tmj);
        inc(data.intraoral.mucosa + data.intraoral.gingiva);
        inc(Object.values(data.psi).join(""));
        inc(Object.values(data.toothNotes).join(""));
        inc(data.diagnosis);
        inc(data.plan);
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [data]);

    const upd = <K extends keyof UntersuchungV1>(key: K, val: UntersuchungV1[K]) =>
        setData((prev) => ({ ...prev, [key]: val }));

    const updGroup = <K extends keyof UntersuchungV1>(group: K, patch: Partial<UntersuchungV1[K]>) =>
        setData((prev) => ({ ...prev, [group]: { ...(prev[group] as object), ...patch } as UntersuchungV1[K] }));

    const setToothNote = (tooth: string, note: string) => {
        setData((prev) => {
            const next = { ...prev.toothNotes };
            const trimmed = note.trim();
            if (!trimmed) delete next[tooth];
            else next[tooth] = trimmed;
            return { ...prev, toothNotes: next };
        });
    };

    const applyStatusToSelected = async () => {
        if (!selectedTooth || locked || statusBusy) return;
        setStatusBusy(true);
        try {
            await onApplyTooth(Number(selectedTooth), statusBrush);
        } finally {
            setStatusBusy(false);
        }
    };

    const submit = async () => {
        if (busy || locked || !hasExamContent(data)) return;
        setBusy(true);
        try {
            const beschwerden =
                [
                    data.generalNote.trim(),
                    data.chiefComplaint.trim(),
                    data.painLocation.trim() &&
                        tp("untersuchung.composer.pain_location_prefix", { location: data.painLocation.trim() }),
                    data.painVas.trim() && tp("untersuchung.composer.pain_vas_prefix", { vas: data.painVas.trim() }),
                ]
                    .filter(Boolean)
                    .join(" · ") || "";
            const diagnose = data.diagnosis.trim() || "";
            await onSave({ beschwerden, diagnose, ergebnisseJson: JSON.stringify({ ...data, version: 1 }) });
            if (!initialFromRecord) {
                setData(UNTERSUCHUNG_V1_EMPTY);
                setSelectedTooth(null);
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="col untersuchung-composer" style={{ gap: 16 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <div className="seg seg--wrap" role="tablist" aria-label={t("untersuchung.composer.sections_aria")}>
                    {sections.map((s) => (
                        <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={section === s.id}
                            onClick={() => setSection(s.id)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: "var(--fg-3)" }}>
                    {tp("untersuchung.composer.captured", { pct: completion })}
                </span>
            </div>

            {section === "haupt" && (
                <div className="col" style={{ gap: 12 }}>
                    <Textarea
                        id="u-general-note"
                        label={t("untersuchung.composer.general_note")}
                        value={data.generalNote}
                        onChange={(e) => upd("generalNote", e.target.value)}
                        rows={2}
                        placeholder={t("untersuchung.composer.general_note_ph")}
                        disabled={locked}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Textarea
                            id="u-haupt-bes"
                            label={t("untersuchung.composer.chief")}
                            value={data.chiefComplaint}
                            onChange={(e) => upd("chiefComplaint", e.target.value)}
                            rows={3}
                            placeholder={t("untersuchung.composer.chief_ph")}
                            disabled={locked}
                        />
                        <Input
                            id="u-pain-vas"
                            label={t("untersuchung.composer.pain_vas")}
                            value={data.painVas}
                            onChange={(e) => upd("painVas", e.target.value)}
                            placeholder={t("untersuchung.composer.pain_vas_ph")}
                            disabled={locked}
                        />
                        <Input
                            id="u-pain-loc"
                            label={t("untersuchung.composer.pain_location")}
                            value={data.painLocation}
                            onChange={(e) => upd("painLocation", e.target.value)}
                            placeholder={t("untersuchung.composer.pain_location_ph")}
                            disabled={locked}
                        />
                    </div>
                </div>
            )}

            {section === "extra" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-extra-asym" label={t("untersuchung.composer.asymmetry")} value={data.extraoral.asymmetry} onChange={(e) => updGroup("extraoral", { asymmetry: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-extra-lymph" label={t("untersuchung.composer.lymph")} value={data.extraoral.lymphNodes} onChange={(e) => updGroup("extraoral", { lymphNodes: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-extra-tmj" label={t("untersuchung.composer.tmj")} value={data.extraoral.tmj} onChange={(e) => updGroup("extraoral", { tmj: e.target.value })} rows={2} placeholder={t("untersuchung.composer.tmj_ph")} disabled={locked} />
                    <Textarea id="u-extra-musc" label={t("untersuchung.composer.muscles")} value={data.extraoral.muscles} onChange={(e) => updGroup("extraoral", { muscles: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "intra" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-intra-muc" label={t("untersuchung.composer.mucosa")} value={data.intraoral.mucosa} onChange={(e) => updGroup("intraoral", { mucosa: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-tng" label={t("untersuchung.composer.tongue")} value={data.intraoral.tongue} onChange={(e) => updGroup("intraoral", { tongue: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-ging" label={t("untersuchung.composer.gingiva")} value={data.intraoral.gingiva} onChange={(e) => updGroup("intraoral", { gingiva: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-intra-sal" label={t("untersuchung.composer.salivary")} value={data.intraoral.salivary} onChange={(e) => updGroup("intraoral", { salivary: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "hart" && (
                <div className="col" style={{ gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t("untersuchung.composer.dental_section_title")}</div>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>{t("untersuchung.composer.dental_hint")}</p>
                    <DentalChart
                        mode="picker"
                        befunde={befunde}
                        selectedTooth={selectedTooth}
                        onToothSelect={setSelectedTooth}
                        pickerHint={t("untersuchung.composer.dental_pick_hint")}
                        disabled={locked}
                    />
                    {selectedTooth ? (
                        <div
                            className="card card-pad col"
                            style={{ gap: 12, background: "rgba(0,0,0,0.02)", border: "1px solid var(--line)" }}
                        >
                            <div style={{ fontWeight: 600, fontSize: 13.5 }}>
                                {tp("untersuchung.composer.tooth_panel_title", { tooth: selectedTooth })}
                            </div>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                {DENTAL_STATUS_KEYS.map((k) => (
                                    <button
                                        key={k}
                                        type="button"
                                        className={`pill ${statusBrush === k ? "accent" : "grey"}`}
                                        aria-pressed={statusBrush === k}
                                        disabled={locked}
                                        onClick={() => !locked && setStatusBrush(k)}
                                    >
                                        {dentalStatusLabel(t, k)}
                                    </button>
                                ))}
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    disabled={locked || statusBusy}
                                    loading={statusBusy}
                                    onClick={() => void applyStatusToSelected()}
                                >
                                    {t("untersuchung.composer.apply_status")}
                                </Button>
                            </div>
                            <Textarea
                                id={`u-tooth-note-${selectedTooth}`}
                                label={t("untersuchung.composer.tooth_note")}
                                value={data.toothNotes[selectedTooth] ?? ""}
                                onChange={(e) => setToothNote(selectedTooth, e.target.value)}
                                rows={3}
                                placeholder={t("untersuchung.composer.tooth_note_ph")}
                                disabled={locked}
                            />
                        </div>
                    ) : null}
                    {documentedTeeth.length > 0 ? (
                        <div className="col" style={{ gap: 6 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>
                                {t("untersuchung.composer.documented_teeth")}
                            </div>
                            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                                {documentedTeeth.map(([tooth, note]) => (
                                    <li key={tooth}>
                                        <button
                                            type="button"
                                            className="anlage-card__menu-item untersuchung-doc-tooth-btn"
                                            onClick={() => setSelectedTooth(tooth)}
                                            disabled={locked}
                                        >
                                            <strong>{tp("untersuchung.composer.tooth_label", { tooth })}</strong>
                                            <span style={{ display: "block", fontSize: 12.5, color: "var(--fg-3)", marginTop: 2 }}>
                                                {note}
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            )}

            {section === "paro" && (
                <div className="col" style={{ gap: 12 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>{t("untersuchung.composer.psi_hint")}</p>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                        {(["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((k, i) => (
                            <Select
                                key={k}
                                label={tp("untersuchung.composer.sextant", { n: i + 1 })}
                                value={data.psi[k]}
                                options={psiOpts}
                                onChange={(e) => updGroup("psi", { [k]: e.target.value } as never)}
                                disabled={locked}
                            />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input id="u-bop" label={t("untersuchung.composer.bop")} value={data.bopPercent} onChange={(e) => upd("bopPercent", e.target.value)} placeholder={t("untersuchung.composer.bop_ph")} disabled={locked} />
                        <Input id="u-plaque" label={t("untersuchung.composer.plaque")} value={data.plaqueIndex} onChange={(e) => upd("plaqueIndex", e.target.value)} placeholder={t("untersuchung.composer.plaque_ph")} disabled={locked} />
                        <Input id="u-hyg" label={t("untersuchung.composer.hygiene")} value={data.hygieneScore} onChange={(e) => upd("hygieneScore", e.target.value)} placeholder={t("untersuchung.composer.hygiene_ph")} disabled={locked} />
                    </div>
                </div>
            )}

            {section === "funk" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-fun-cmd" label={t("untersuchung.composer.cmd")} value={data.function.cmd} onChange={(e) => updGroup("function", { cmd: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-brux" label={t("untersuchung.composer.bruxism")} value={data.function.bruxism} onChange={(e) => updGroup("function", { bruxism: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-splint" label={t("untersuchung.composer.splint")} value={data.function.splint} onChange={(e) => updGroup("function", { splint: e.target.value })} rows={2} disabled={locked} />
                    <Textarea id="u-fun-other" label={t("untersuchung.composer.function_notes")} value={data.function.notes} onChange={(e) => updGroup("function", { notes: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "rx" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Textarea id="u-rx-ord" label={t("untersuchung.composer.imaging_ordered")} value={data.imaging.ordered} onChange={(e) => updGroup("imaging", { ordered: e.target.value })} rows={2} placeholder={t("untersuchung.composer.imaging_ordered_ph")} disabled={locked} />
                    <Textarea id="u-rx-find" label={t("untersuchung.composer.imaging_note")} value={data.imaging.findings} onChange={(e) => updGroup("imaging", { findings: e.target.value })} rows={2} disabled={locked} />
                </div>
            )}

            {section === "diag" && (
                <div className="col" style={{ gap: 12 }}>
                    <Textarea id="u-diag" label={t("untersuchung.composer.diagnosis")} value={data.diagnosis} onChange={(e) => upd("diagnosis", e.target.value)} rows={3} placeholder={t("untersuchung.composer.diagnosis_ph")} disabled={locked} />
                    <Textarea id="u-plan" label={t("untersuchung.composer.plan")} value={data.plan} onChange={(e) => upd("plan", e.target.value)} rows={4} placeholder={t("untersuchung.composer.plan_ph")} disabled={locked} />
                </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 8, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                    {t("common.cancel")}
                </Button>
                <Button
                    type="button"
                    onClick={() => void submit()}
                    disabled={locked || busy || !hasExamContent(data)}
                    loading={busy}
                >
                    {variant === "edit" ? t("untersuchung.composer.save_changes") : t("untersuchung.composer.save")}
                </Button>
            </div>
        </div>
    );
}
