import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Textarea } from "./ui/input";
import { useT, useTParams } from "@/lib/i18n";
import { resolveDefaultExaminationCatalogItem } from "@/lib/patient-detail-utils";
import {
    treatmentCatalogCategoryLabel,
    EXAMINATION_CATALOG_CATEGORY,
} from "@/lib/treatment-catalog-categories";
import { formatCurrency } from "@/lib/utils";
import { Button } from "./ui/button";
import { DentalChart } from "./DentalChart";
import { TreatmentFindingList } from "./treatment-finding-list";
import { ExamAdvancedFields } from "./examination-advanced-fields";
import { ExamToothCard } from "./exam-tooth-card";
import type { TreatmentCatalogItem, DentalFinding } from "@/models/types";
import {
    DENTAL_STATUS_KEYS,
    dentalStatusLabel,
    findingToStatusKeys,
    findingsForTooth,
    statusKeysToFinding,
    toggleDentalStatus,
    type DentalStatusKey,
} from "@/lib/dental";
import { hasExamContent, parseExaminationV1, EXAMINATION_V1_EMPTY, type ExaminationV1 } from "@/lib/examination";

export interface ExaminationSubmit {
    chiefComplaint: string;
    diagnosis: string;
    resultsJson: string;
    category?: string | null;
    serviceName?: string | null;
    totalCost?: number | null;
}

export type ExaminationComposerInitial = {
    chiefComplaint: string | null;
    results: string | null;
    diagnosis: string | null;
};

function initialDataFromRecord(row: ExaminationComposerInitial): ExaminationV1 {
    const parsed = parseExaminationV1(row.results);
    if (parsed) {
        const d = { ...parsed };
        if (!d.diagnosis.trim() && row.diagnosis?.trim()) d.diagnosis = row.diagnosis.trim();
        if (!d.generalNote.trim() && !d.chiefComplaint.trim() && row.chiefComplaint?.trim()) {
            d.generalNote = row.chiefComplaint.trim();
        }
        return d;
    }
    return {
        ...EXAMINATION_V1_EMPTY,
        generalNote: row.chiefComplaint?.trim() ?? "",
        diagnosis: row.diagnosis?.trim() ?? "",
    };
}

function catalogDefaultCost(item: TreatmentCatalogItem | null): string {
    if (item?.default_cost != null && Number.isFinite(item.default_cost)) {
        return String(item.default_cost);
    }
    return "";
}

interface Props {
    findings: DentalFinding[];
    /** Treatment catalog (`treatment_catalog`) — predefined examination price on create. */
    catalog?: TreatmentCatalogItem[];
    onCancel: () => void;
    onSave: (data: ExaminationSubmit) => Promise<void>;
    initialFromRecord?: ExaminationComposerInitial;
    variant?: "create" | "edit";
    locked?: boolean;
}

export function ExaminationComposer({
    findings,
    catalog = [],
    onCancel,
    onSave,
    initialFromRecord,
    variant = "create",
    locked = false,
}: Props) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const [data, setData] = useState<ExaminationV1>(() =>
        initialFromRecord ? initialDataFromRecord(initialFromRecord) : EXAMINATION_V1_EMPTY,
    );
    const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [totalCost, setTotalCost] = useState("");

    const catalogService = useMemo(
        () => resolveDefaultExaminationCatalogItem(catalog),
        [catalog],
    );

    useEffect(() => {
        if (variant !== "create") return;
        setTotalCost(catalogDefaultCost(catalogService));
    }, [catalogService, variant]);

    const documentedTeeth = useMemo(
        () =>
            Object.entries(data.toothNotes)
                .filter(([, note]) => note.trim())
                .sort(([a], [b]) => Number(a) - Number(b)),
        [data.toothNotes],
    );

    const upd = <K extends keyof ExaminationV1>(key: K, val: ExaminationV1[K]) =>
        setData((prev) => ({ ...prev, [key]: val }));

    const setToothNote = (tooth: string, note: string) => {
        setData((prev) => {
            const next = { ...prev.toothNotes };
            // Do not trim on each keystroke — that blocks spaces between words.
            if (!note) delete next[tooth];
            else next[tooth] = note;
            return { ...prev, toothNotes: next };
        });
    };

    /** Statuses for a tooth: this exam's draft first, else what the chart already holds. */
    const statusKeysFor = (tooth: string): DentalStatusKey[] => {
        const draft = data.toothStatuses[tooth];
        if (draft) return findingToStatusKeys(draft);
        const saved = findingsForTooth(findings, tooth).slice(-1)[0];
        return findingToStatusKeys(saved?.finding);
    };

    /** A tooth can carry several statuses (e.g. crown + caries); rules in `toggleDentalStatus`. */
    const toggleStatus = (tooth: string, key: DentalStatusKey) => {
        const next = toggleDentalStatus(statusKeysFor(tooth), key);
        setData((prev) => ({
            ...prev,
            toothStatuses: { ...prev.toothStatuses, [tooth]: statusKeysToFinding(next) },
        }));
    };

    /** Saved findings with this exam's draft statuses on top, so the chart updates while typing. */
    const chartFindings = useMemo(() => {
        const draftTeeth = Object.keys(data.toothStatuses);
        if (!draftTeeth.length) return findings;
        const rest = findings.filter((f) => !draftTeeth.includes(String(f.tooth_number)));
        const drafts: DentalFinding[] = draftTeeth.map((tooth) => {
            const saved = findingsForTooth(findings, tooth).slice(-1)[0];
            return {
                id: saved?.id ?? `draft-${tooth}`,
                chart_id: saved?.chart_id ?? "",
                tooth_number: Number(tooth),
                finding: data.toothStatuses[tooth],
                diagnosis: saved?.diagnosis ?? null,
                notes: saved?.notes ?? null,
                created_at: saved?.created_at ?? "",
                updated_at: saved?.updated_at ?? "",
            };
        });
        return [...rest, ...drafts];
    }, [findings, data.toothStatuses]);

    const submit = async () => {
        if (busy || locked || !hasExamContent(data)) return;
        setBusy(true);
        try {
            const chiefComplaint = data.generalNote.trim() || data.chiefComplaint.trim() || "";
            const diagnosis = data.diagnosis.trim() || "";
            const gRaw = totalCost.trim().replace(",", ".");
            const gParsed = gRaw ? Number.parseFloat(gRaw) : NaN;
            const totalCostNum = Number.isFinite(gParsed)
                ? gParsed
                : catalogService?.default_cost != null && Number.isFinite(catalogService.default_cost)
                  ? catalogService.default_cost
                  : null;
            await onSave({
                chiefComplaint,
                diagnosis,
                resultsJson: JSON.stringify({
                    ...data,
                    toothNotes: Object.fromEntries(
                        Object.entries(data.toothNotes)
                            .map(([tooth, note]) => [tooth, note.trim()] as const)
                            .filter(([, note]) => note.length > 0),
                    ),
                    toothStatuses: Object.fromEntries(
                        Object.entries(data.toothStatuses)
                            .map(([tooth, status]) => [tooth, status.trim().toLowerCase()] as const)
                            .filter(([, status]) => status.length > 0),
                    ),
                    version: 1,
                }),
                category: catalogService?.category?.trim() || null,
                serviceName: catalogService?.name?.trim() || null,
                totalCost: totalCostNum,
            });
            if (!initialFromRecord) {
                setData(EXAMINATION_V1_EMPTY);
                setSelectedTooth(null);
                setTotalCost(catalogDefaultCost(catalogService));
            }
        } finally {
            setBusy(false);
        }
    };

    const selectedFinding = selectedTooth
        ? findingsForTooth(findings, selectedTooth)
              .slice()
              .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0]
        : undefined;
    const selectedKeys = selectedTooth ? statusKeysFor(selectedTooth) : [];


    return (
        <div className="col examination-composer" style={{ gap: "var(--space-4)" }}>
            <Textarea
                id="u-general-note"
                label={t("examination.composer.general_note")}
                value={data.generalNote}
                onChange={(e) => upd("generalNote", e.target.value)}
                rows={3}
                placeholder={t("examination.composer.general_note_ph")}
                disabled={locked}
            />

            <div className="col" style={{ gap: "var(--space-3)" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t("examination.composer.dental_section_title")}</div>
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>{t("examination.composer.dental_hint")}</p>
                <div className="dental-chart-with-findings">
                    <DentalChart
                        mode="picker"
                        findings={chartFindings}
                        selectedTooth={selectedTooth}
                        onToothSelect={setSelectedTooth}
                        pickerHint={t("examination.composer.dental_pick_hint")}
                        disabled={locked}
                        showDetail={false}
                    />
                    <TreatmentFindingList
                        findings={findings}
                        selectedTooth={selectedTooth}
                        onSelect={setSelectedTooth}
                        disabled={locked}
                    />
                </div>

                {selectedTooth ? (
                    <ExamToothCard tooth={selectedTooth} statusKeys={selectedKeys} updatedAt={selectedFinding?.updated_at}>
                        <div className="row" style={{ gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
                            {DENTAL_STATUS_KEYS.map((k) => (
                                <button
                                    key={k}
                                    type="button"
                                    className={`pill ${selectedKeys.includes(k) ? "accent" : "grey"}`}
                                    aria-pressed={selectedKeys.includes(k)}
                                    disabled={locked}
                                    onClick={() => !locked && toggleStatus(selectedTooth, k)}
                                >
                                    {dentalStatusLabel(t, k)}
                                </button>
                            ))}
                        </div>
                        <Textarea
                            id={`u-tooth-note-${selectedTooth}`}
                            label={t("examination.composer.tooth_note")}
                            value={data.toothNotes[selectedTooth] ?? ""}
                            onChange={(e) => setToothNote(selectedTooth, e.target.value)}
                            rows={3}
                            placeholder={t("examination.composer.tooth_note_ph")}
                            disabled={locked}
                        />
                    </ExamToothCard>
                ) : null}

                {documentedTeeth.length > 0 ? (
                    <div className="col" style={{ gap: "var(--space-2)" }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>
                            {t("examination.composer.documented_teeth")}
                        </div>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                            {documentedTeeth.map(([tooth, note]) => (
                                <li key={tooth}>
                                    <button
                                        type="button"
                                        className="attachment-card__menu-item"
                                        style={{ width: "100%", textAlign: "start", padding: "8px 10px", borderRadius: 8 }}
                                        onClick={() => setSelectedTooth(tooth)}
                                        disabled={locked}
                                    >
                                        <strong>{tp("examination.composer.tooth_label", { tooth })}</strong>
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
                label={t("examination.composer.diagnosis")}
                value={data.diagnosis}
                onChange={(e) => upd("diagnosis", e.target.value)}
                rows={3}
                placeholder={t("examination.composer.diagnosis_ph")}
                disabled={locked}
            />
            <Textarea
                id="u-plan"
                label={t("examination.composer.plan")}
                value={data.plan}
                onChange={(e) => upd("plan", e.target.value)}
                rows={2}
                placeholder={t("examination.composer.plan_ph")}
                disabled={locked}
            />

            <ExamAdvancedFields data={data} setData={setData} locked={locked} />

            {variant === "create" ? (
                <div className="col" style={{ gap: "var(--space-2)" }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                        {t("examination.composer.billing_hint")}
                    </p>
                    {catalogService ? (
                        <div
                            className="card card-pad col"
                            style={{ gap: "var(--space-3)", background: "rgba(0,0,0,0.02)", border: "1px solid var(--line)" }}
                        >
                            <div className="col" style={{ gap: "var(--space-1)" }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>
                                    {t("examination.composer.catalog_service")}
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 600 }}>
                                    {catalogService.name}
                                    <span style={{ fontWeight: 400, color: "var(--fg-3)", marginLeft: 6 }}>
                                        ({treatmentCatalogCategoryLabel(t, catalogService.category)})
                                    </span>
                                </div>
                                {catalogService.default_cost != null && Number.isFinite(catalogService.default_cost) ? (
                                    <div style={{ fontSize: 12.5, color: "var(--fg-2)" }}>
                                        {tp("examination.composer.catalog_standard_price", {
                                            price: formatCurrency(catalogService.default_cost),
                                        })}
                                    </div>
                                ) : null}
                            </div>
                            <Input
                                label={t("examination.composer.cost_confirm")}
                                value={totalCost}
                                disabled={locked}
                                onChange={(e) => setTotalCost(e.target.value)}
                            />
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: 12.5, color: "var(--fg-3)" }}>
                            {tp("examination.composer.no_catalog", {
                                category: treatmentCatalogCategoryLabel(t, EXAMINATION_CATALOG_CATEGORY),
                            })}
                        </p>
                    )}
                    <div>
                        <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate("/administration/treatment-catalog")}
                        >
                            {t("treatment.composer.manage_catalog")}
                        </Button>
                    </div>
                </div>
            ) : null}

            <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-2)", borderTop: "1px solid var(--line)", paddingTop: "var(--space-3)" }}>
                <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
                    {t("common.cancel")}
                </Button>
                <Button
                    type="button"
                    onClick={() => void submit()}
                    disabled={locked || busy || !hasExamContent(data)}
                    loading={busy}
                >
                    {variant === "edit" ? t("examination.composer.save_changes") : t("examination.composer.save")}
                </Button>
            </div>
        </div>
    );
}
