import { useMemo, useState } from "react";
import { Textarea } from "./ui/input";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "./ui/button";
import { DentalChart } from "./DentalChart";
import type { Zahnbefund } from "@/models/types";
import {
    DENTAL_STATUS_KEYS,
    dentalStatusLabel,
    type DentalStatusKey,
} from "@/lib/dental";
import { parseUntersuchungV1, UNTERSUCHUNG_V1_EMPTY, type UntersuchungV1 } from "@/lib/untersuchung";

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
        if (!d.generalNote.trim() && !d.chiefComplaint.trim() && row.beschwerden?.trim()) {
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

function hasExamContent(data: UntersuchungV1): boolean {
    if (data.generalNote.trim() || data.diagnosis.trim()) return true;
    return Object.values(data.toothNotes).some((n) => n.trim());
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
    const [data, setData] = useState<UntersuchungV1>(() =>
        initialFromRecord ? initialDataFromRecord(initialFromRecord) : UNTERSUCHUNG_V1_EMPTY,
    );
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

    const upd = <K extends keyof UntersuchungV1>(key: K, val: UntersuchungV1[K]) =>
        setData((prev) => ({ ...prev, [key]: val }));

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
            const beschwerden = data.generalNote.trim() || data.chiefComplaint.trim() || "";
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
            <Textarea
                id="u-general-note"
                label={t("untersuchung.composer.general_note")}
                value={data.generalNote}
                onChange={(e) => upd("generalNote", e.target.value)}
                rows={3}
                placeholder={t("untersuchung.composer.general_note_ph")}
                disabled={locked}
            />

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
                                        className="anlage-card__menu-item"
                                        style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8 }}
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

            <Textarea
                id="u-diag"
                label={t("untersuchung.composer.diagnosis")}
                value={data.diagnosis}
                onChange={(e) => upd("diagnosis", e.target.value)}
                rows={3}
                placeholder={t("untersuchung.composer.diagnosis_ph")}
                disabled={locked}
            />

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
