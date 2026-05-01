import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import type { PraxisDayKey, PraxisDayPlan } from "../../lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig, savePraxisArbeitszeitenConfig } from "../../lib/praxis-planning";
import type { PlanValidationIssue } from "../../lib/praxis-arbeitszeiten-validation";
import {
    isValidPauseRange,
    isValidSlotMinutes,
    validatePraxisArbeitsplan,
} from "../../lib/praxis-arbeitszeiten-validation";
import { errorMessage, formatTpl } from "@/lib/utils";
import { useT } from "@/lib/i18n";

const DAY_ORDER: readonly PraxisDayKey[] = ["mo", "di", "mi", "do", "fr", "sa", "so"];

function formatPlanIssue(tr: (key: string) => string, issue: PlanValidationIssue): string {
    const day = tr(`page.arbeitszeiten.day.${issue.day}`);
    return tr(`page.arbeitszeiten.err.${issue.code}`).replace("{day}", day);
}

type ArbeitszeitenPlan = Record<PraxisDayKey, PraxisDayPlan>;

const defaultPlan: ArbeitszeitenPlan = {
    mo: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    di: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    mi: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    do: { aktiv: true, segments: [{ from: "08:00", to: "17:00" }] },
    fr: { aktiv: true, segments: [{ from: "08:00", to: "15:00" }] },
    sa: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
    so: { aktiv: false, segments: [{ from: "09:00", to: "13:00" }] },
};

export function ArbeitszeitenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const tr = useT();
    const [plan, setPlan] = useState<ArbeitszeitenPlan>(defaultPlan);
    const [pauseVon, setPauseVon] = useState("12:30");
    const [pauseBis, setPauseBis] = useState("13:30");
    const [slotMin, setSlotMin] = useState("30");
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void loadPraxisArbeitszeitenConfig().then((parsed) => {
            if (cancelled) return;
            setPlan(parsed.plan);
            setPauseVon(parsed.pauseVon);
            setPauseBis(parsed.pauseBis);
            setSlotMin(parsed.slotMin);
        });
        return () => { cancelled = true; };
    }, []);

    const activeDays = useMemo(() => DAY_ORDER.filter((k) => plan[k].aktiv).length, [plan]);

    const weekdays = useMemo(
        () => DAY_ORDER.map((key) => ({ key, label: tr(`page.arbeitszeiten.day.${key}`) })),
        [tr],
    );

    const save = async () => {
        const issue = validatePraxisArbeitsplan(plan);
        if (issue) {
            toast(formatPlanIssue(tr, issue), "error");
            return;
        }
        if (!isValidPauseRange(pauseVon, pauseBis)) {
            toast(tr("page.arbeitszeiten.err.pause_order"), "error");
            return;
        }
        if (!isValidSlotMinutes(slotMin)) {
            toast(tr("page.arbeitszeiten.err.slot_min"), "error");
            return;
        }
        setSaving(true);
        try {
            const prev = await loadPraxisArbeitszeitenConfig();
            await savePraxisArbeitszeitenConfig({ ...prev, plan, pauseVon, pauseBis, slotMin });
            toast(tr("page.arbeitszeiten.toast_saved"));
        } catch (e) {
            toast(`${tr("page.arbeitszeiten.toast_save_failed")} ${errorMessage(e)}`, "error");
        } finally {
            setSaving(false);
        }
    };

    const addSegment = (dayKey: PraxisDayKey) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: [...prev[dayKey].segments, { from: "14:00", to: "18:00" }],
            },
        }));
    };

    const removeSegment = (dayKey: PraxisDayKey, idx: number) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: prev[dayKey].segments.filter((_, i) => i !== idx),
            },
        }));
    };

    const updateSegment = (dayKey: PraxisDayKey, idx: number, key: "from" | "to", value: string) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: prev[dayKey].segments.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
            },
        }));
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <VerwaltungBackButton />
                <h1 className="page-title" style={{ margin: 0 }}>{tr("page.arbeitszeiten.title")}</h1>
            </div>
            <p className="page-sub" style={{ margin: 0 }}>
                {formatTpl(tr("page.arbeitszeiten.active_days"), { count: activeDays })}
            </p>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.section_hours")}</h2>
                <div className="col" style={{ gap: 10 }}>
                    {weekdays.map((d) => {
                        const row = plan[d.key];
                        return (
                            <div key={d.key} className="col" style={{ gap: 8, border: "1px solid var(--line)", borderRadius: 10, padding: 10 }}>
                                <Select
                                    label={d.label}
                                    value={row.aktiv ? "1" : "0"}
                                    options={[
                                        { value: "1", label: tr("page.arbeitszeiten.status_active") },
                                        { value: "0", label: tr("page.arbeitszeiten.status_free") },
                                    ]}
                                    onChange={(e) => setPlan((prev) => ({ ...prev, [d.key]: { ...prev[d.key], aktiv: e.target.value === "1" } }))}
                                />
                                {(row.segments ?? []).map((seg, idx) => (
                                    <div key={`${d.key}-seg-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                        <Input
                                            id={`${d.key}-from-${idx}`}
                                            type="time"
                                            label={formatTpl(tr("page.arbeitszeiten.label_from"), { n: idx + 1 })}
                                            value={seg.from}
                                            onChange={(e) => updateSegment(d.key, idx, "from", e.target.value)}
                                            disabled={!row.aktiv}
                                        />
                                        <Input
                                            id={`${d.key}-to-${idx}`}
                                            type="time"
                                            label={formatTpl(tr("page.arbeitszeiten.label_to"), { n: idx + 1 })}
                                            value={seg.to}
                                            onChange={(e) => updateSegment(d.key, idx, "to", e.target.value)}
                                            disabled={!row.aktiv}
                                        />
                                        {row.segments.length > 1 ? (
                                            <Button type="button" size="sm" variant="ghost" onClick={() => removeSegment(d.key, idx)} disabled={!row.aktiv}>
                                                {tr("page.arbeitszeiten.remove_segment")}
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                <div>
                                    <Button type="button" size="sm" variant="secondary" onClick={() => addSegment(d.key)} disabled={!row.aktiv}>
                                        {tr("page.arbeitszeiten.add_segment")}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.section_defaults")}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                    <Input id="pause-von" type="time" label={tr("page.arbeitszeiten.pause_from")} value={pauseVon} onChange={(e) => setPauseVon(e.target.value)} />
                    <Input id="pause-bis" type="time" label={tr("page.arbeitszeiten.pause_to")} value={pauseBis} onChange={(e) => setPauseBis(e.target.value)} />
                    <Input id="slot-min" type="number" min={10} step={5} label={tr("page.arbeitszeiten.slot_label")} value={slotMin} onChange={(e) => setSlotMin(e.target.value)} />
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.section_closures")}</h2>
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>
                    {tr("page.arbeitszeiten.closures_hint")}
                </p>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/sonder-sperrzeiten")}>
                    {tr("page.arbeitszeiten.open_closures")}
                </Button>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/praxisplanung")}>{tr("page.arbeitszeiten.back")}</Button>
                <Button type="button" onClick={() => void save()} disabled={saving} loading={saving}>{tr("page.arbeitszeiten.save")}</Button>
            </div>
        </div>
    );
}
