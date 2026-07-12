import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Textarea } from "./ui/input";
import { useT, useTParams } from "@/lib/i18n";
import { resolveDefaultUntersuchungKatalogItem } from "@/lib/patient-detail-utils";
import {
    behandlungsKatalogCategoryLabel,
    EXAMINATION_CATALOG_CATEGORY,
} from "@/lib/behandlungs-katalog-categories";
import { formatCurrency } from "@/lib/utils";
import { Button } from "./ui/button";
import { DentalChart } from "./DentalChart";
import type { BehandlungsKatalogItem, Zahnbefund } from "@/models/types";
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

function catalogDefaultCost(item: BehandlungsKatalogItem | null): string {
    if (item?.default_kosten != null && Number.isFinite(item.default_kosten)) {
        return String(item.default_kosten);
    }
    return "";
}

interface Props {
    befunde: Zahnbefund[];
    /** Treatment catalog (`behandlungs_katalog`) — predefined examination price on create. */
    katalog?: BehandlungsKatalogItem[];
    onApplyTooth: (tooth: number, statusKey: string) => Promise<void>;
    onCancel: () => void;
    onSave: (data: UntersuchungSubmit) => Promise<void>;
    initialFromRecord?: UntersuchungComposerInitial;
    variant?: "create" | "edit";
    locked?: boolean;
}

export function UntersuchungComposer({
    befunde,
    katalog = [],
    onApplyTooth,
    onCancel,
    onSave,
    initialFromRecord,
    variant = "create",
    locked = false,
}: Props) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const [data, setData] = useState<UntersuchungV1>(() =>
        initialFromRecord ? initialDataFromRecord(initialFromRecord) : UNTERSUCHUNG_V1_EMPTY,
    );
    const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
    const [statusBrush, setStatusBrush] = useState<DentalStatusKey>("healthy");
    const [statusBusy, setStatusBusy] = useState(false);
    const [busy, setBusy] = useState(false);
    const [gesamtkosten, setGesamtkosten] = useState("");

    const catalogService = useMemo(
        () => resolveDefaultUntersuchungKatalogItem(katalog),
        [katalog],
    );

    useEffect(() => {
        if (variant !== "create") return;
        setGesamtkosten(catalogDefaultCost(catalogService));
    }, [catalogService, variant]);

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
            const gRaw = gesamtkosten.trim().replace(",", ".");
            const gParsed = gRaw ? Number.parseFloat(gRaw) : NaN;
            const gesamtkostenNum = Number.isFinite(gParsed)
                ? gParsed
                : catalogService?.default_kosten != null && Number.isFinite(catalogService.default_kosten)
                  ? catalogService.default_kosten
                  : null;
            await onSave({
                beschwerden,
                diagnose,
                ergebnisseJson: JSON.stringify({ ...data, version: 1 }),
                kategorie: catalogService?.kategorie?.trim() || null,
                leistungsname: catalogService?.name?.trim() || null,
                gesamtkosten: gesamtkostenNum,
            });
            if (!initialFromRecord) {
                setData(UNTERSUCHUNG_V1_EMPTY);
                setSelectedTooth(null);
                setGesamtkosten(catalogDefaultCost(catalogService));
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

            {variant === "create" ? (
                <div className="col" style={{ gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                        {t("untersuchung.composer.billing_hint")}
                    </p>
                    {catalogService ? (
                        <div
                            className="card card-pad col"
                            style={{ gap: 10, background: "rgba(0,0,0,0.02)", border: "1px solid var(--line)" }}
                        >
                            <div className="col" style={{ gap: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>
                                    {t("untersuchung.composer.catalog_service")}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                    {catalogService.name}
                                    <span style={{ fontWeight: 400, color: "var(--fg-3)", marginLeft: 6 }}>
                                        ({behandlungsKatalogCategoryLabel(t, catalogService.kategorie)})
                                    </span>
                                </div>
                                {catalogService.default_kosten != null && Number.isFinite(catalogService.default_kosten) ? (
                                    <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>
                                        {tp("untersuchung.composer.catalog_standard_price", {
                                            price: formatCurrency(catalogService.default_kosten),
                                        })}
                                    </div>
                                ) : null}
                            </div>
                            <Input
                                label={t("untersuchung.composer.cost_confirm")}
                                value={gesamtkosten}
                                disabled={locked}
                                onChange={(e) => setGesamtkosten(e.target.value)}
                            />
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                            {tp("untersuchung.composer.no_catalog", {
                                category: behandlungsKatalogCategoryLabel(t, EXAMINATION_CATALOG_CATEGORY),
                            })}
                        </p>
                    )}
                    <div>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate("/verwaltung/behandlungs-katalog")}
                        >
                            {t("behandlung.composer.manage_catalog")}
                        </Button>
                    </div>
                </div>
            ) : null}

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
