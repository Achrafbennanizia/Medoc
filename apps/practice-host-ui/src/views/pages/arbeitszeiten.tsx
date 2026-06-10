import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { EditIcon } from "@/lib/icons";
import type { PraxisArbeitszeitenConfig, PraxisDayKey, PraxisDayPlan } from "@/lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig, savePraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import type { PlanValidationIssue } from "@/lib/praxis-arbeitszeiten-validation";
import {
    isValidPauseRange,
    isValidSlotMinutes,
    validatePraxisArbeitsplan,
} from "@/lib/praxis-arbeitszeiten-validation";
import { errorMessage, formatTpl } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";
import { listAerzte, type AerztSummary } from "@/systems/practice-host/controllers/personal.controller";

const DAY_ORDER: readonly PraxisDayKey[] = ["mo", "di", "mi", "do", "fr", "sa", "so"];
const PRACTICE_PROFILE_KEY = "__practice__";

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

function clonePlan(p: ArbeitszeitenPlan): ArbeitszeitenPlan {
    return JSON.parse(JSON.stringify(p)) as ArbeitszeitenPlan;
}

type ScheduleBaseline = {
    plan: ArbeitszeitenPlan;
    pauseVon: string;
    pauseBis: string;
    slotMin: string;
};

function sliceForProfile(cfg: PraxisArbeitszeitenConfig, profile: string): ScheduleBaseline & { hasOwnSavedProfile: boolean } {
    if (profile === PRACTICE_PROFILE_KEY) {
        return {
            plan: cfg.plan,
            pauseVon: cfg.pauseVon,
            pauseBis: cfg.pauseBis,
            slotMin: cfg.slotMin,
            hasOwnSavedProfile: true,
        };
    }
    const o = cfg.arztSchedules?.[profile];
    if (o) {
        return {
            plan: o.plan,
            pauseVon: o.pauseVon,
            pauseBis: o.pauseBis,
            slotMin: o.slotMin,
            hasOwnSavedProfile: true,
        };
    }
    return {
        plan: cfg.plan,
        pauseVon: cfg.pauseVon,
        pauseBis: cfg.pauseBis,
        slotMin: cfg.slotMin,
        hasOwnSavedProfile: false,
    };
}

export function ArbeitszeitenPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const tr = useT();
    const { canWritePraxisplanung } = useRbac();
    const [storedCfg, setStoredCfg] = useState<PraxisArbeitszeitenConfig | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<string>(PRACTICE_PROFILE_KEY);
    const [plan, setPlan] = useState<ArbeitszeitenPlan>(() => clonePlan(defaultPlan));
    const [pauseVon, setPauseVon] = useState("12:30");
    const [pauseBis, setPauseBis] = useState("13:30");
    const [slotMin, setSlotMin] = useState("30");
    const [hasOwnSavedProfile, setHasOwnSavedProfile] = useState(true);
    const [defaultArztId, setDefaultArztId] = useState("");
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const applySliceToForm = useCallback((slice: ScheduleBaseline) => {
        setPlan(clonePlan(slice.plan));
        setPauseVon(slice.pauseVon);
        setPauseBis(slice.pauseBis);
        setSlotMin(slice.slotMin);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadPraxisArbeitszeitenConfig().then((parsed) => {
            if (cancelled) return;
            setStoredCfg(parsed);
            setSelectedProfile(PRACTICE_PROFILE_KEY);
            const s = sliceForProfile(parsed, PRACTICE_PROFILE_KEY);
            applySliceToForm(s);
            setHasOwnSavedProfile(s.hasOwnSavedProfile);
            setDefaultArztId((parsed.defaultArztId ?? "").trim());
            setEditing(false);
        });
        void listAerzte()
            .then((list) => {
                if (!cancelled) setAerzte(list);
            })
            .catch(() => {
                if (!cancelled) setAerzte([]);
            });
        return () => {
            cancelled = true;
        };
    }, [applySliceToForm]);

    const activeDays = useMemo(() => DAY_ORDER.filter((k) => plan[k].aktiv).length, [plan]);

    const weekdays = useMemo(
        () => DAY_ORDER.map((key) => ({ key, label: tr(`page.arbeitszeiten.day.${key}`) })),
        [tr],
    );

    const readStat = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.4 }}>{value || "—"}</span>
        </div>
    );

    const onSelectProfile = (nextId: string) => {
        if (editing) {
            toast(tr("page.arbeitszeiten.profile_switch_blocked"), "info");
            return;
        }
        if (!storedCfg) return;
        setSelectedProfile(nextId);
        const s = sliceForProfile(storedCfg, nextId);
        applySliceToForm(s);
        setHasOwnSavedProfile(s.hasOwnSavedProfile);
    };

    const cancelEdit = () => {
        if (!storedCfg) return;
        const s = sliceForProfile(storedCfg, selectedProfile);
        applySliceToForm(s);
        setDefaultArztId((storedCfg.defaultArztId ?? "").trim());
        setHasOwnSavedProfile(s.hasOwnSavedProfile);
        setEditing(false);
    };

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
            const nextDefault = defaultArztId.trim();
            let nextCfg: PraxisArbeitszeitenConfig;
            if (selectedProfile === PRACTICE_PROFILE_KEY) {
                nextCfg = {
                    ...prev,
                    plan,
                    pauseVon,
                    pauseBis,
                    slotMin,
                    defaultArztId: nextDefault || undefined,
                };
            } else {
                nextCfg = {
                    ...prev,
                    defaultArztId: nextDefault || undefined,
                    arztSchedules: {
                        ...(prev.arztSchedules ?? {}),
                        [selectedProfile]: { plan, pauseVon, pauseBis, slotMin },
                    },
                };
            }
            await savePraxisArbeitszeitenConfig(nextCfg);
            setStoredCfg(nextCfg);
            setHasOwnSavedProfile(true);
            setEditing(false);
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

    const profileLabel =
        selectedProfile === PRACTICE_PROFILE_KEY
            ? tr("page.arbeitszeiten.practice_profile")
            : (aerzte.find((x) => x.id === selectedProfile)?.name ?? selectedProfile);

    return (
        <div className="arbeitszeiten-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={tr("page.arbeitszeiten.title")}
                subtitle={
                    <>
                        <p className="page-sub" style={{ marginTop: 0 }}>
                            {formatTpl(tr("page.arbeitszeiten.active_days"), { count: activeDays })}
                        </p>
                        <p className="page-sub" style={{ marginTop: 4 }}>
                            {editing ? tr("page.arbeitszeiten.subtitle_editing") : tr("page.arbeitszeiten.subtitle_readonly")}
                        </p>
                    </>
                }
                actions={
                    canWritePraxisplanung ? (
                        !editing ? (
                            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                                <EditIcon size={14} />
                                {" "}
                                {tr("page.arbeitszeiten.edit")}
                            </Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>
                                    {tr("page.arbeitszeiten.cancel")}
                                </Button>
                                <Button type="button" onClick={() => void save()} disabled={saving} loading={saving}>
                                    {tr("page.arbeitszeiten.save")}
                                </Button>
                            </>
                        )
                    ) : null
                }
            />

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.behandler_section_title")}</h2>
                <p className="page-sub" style={{ marginTop: 4, marginBottom: 14, maxWidth: 640 }}>
                    {tr("page.arbeitszeiten.behandler_section_hint")}
                </p>
                <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                        <Select
                            id="arbeitszeiten-profile"
                            label={tr("page.arbeitszeiten.behandler_select_label")}
                            value={selectedProfile}
                            disabled={editing}
                            options={[
                                { value: PRACTICE_PROFILE_KEY, label: tr("page.arbeitszeiten.practice_profile") },
                                ...aerzte.map((a) => ({ value: a.id, label: a.name })),
                            ]}
                            onChange={(e) => onSelectProfile(e.target.value)}
                        />
                    </div>
                    {editing ? (
                        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                            <Select
                                id="default-arzt-termin"
                                label={tr("page.arbeitszeiten.default_arzt_label")}
                                value={defaultArztId}
                                options={[
                                    { value: "", label: tr("page.arbeitszeiten.default_arzt_none") },
                                    ...aerzte.map((a) => ({ value: a.id, label: a.name })),
                                ]}
                                onChange={(e) => setDefaultArztId(e.target.value)}
                            />
                            <p style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0 }}>
                                {tr("page.arbeitszeiten.default_arzt_hint")}
                            </p>
                        </div>
                    ) : null}
                </div>
                {!hasOwnSavedProfile && selectedProfile !== PRACTICE_PROFILE_KEY ? (
                    <p style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 12, marginBottom: 0 }}>
                        {tr("page.arbeitszeiten.inherits_practice")}
                    </p>
                ) : null}
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 10, marginBottom: 0 }}>
                    {tr("page.arbeitszeiten.editing_profile_rubric").replace("{name}", profileLabel)}
                </p>
            </div>

            <div className="arbeitszeiten-layout-split">
                <div className="card card-pad">
                    <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.section_hours")}</h2>
                    <div className="arbeitszeiten-week-grid">
                        {weekdays.map((d) => {
                            const row = plan[d.key];
                            const cardClass =
                                `arbeitszeiten-day-card${row.aktiv ? "" : " arbeitszeiten-day-card--inactive"}`;
                            return (
                                <div key={d.key} className={cardClass}>
                                    <div className="arbeitszeiten-day-head">
                                        <span className="arbeitszeiten-day-name">{d.label}</span>
                                        <span className={row.aktiv ? "arbeitszeiten-day-badge arbeitszeiten-day-badge--on" : "arbeitszeiten-day-badge arbeitszeiten-day-badge--off"}>
                                            {row.aktiv ? tr("page.arbeitszeiten.status_active") : tr("page.arbeitszeiten.status_free")}
                                        </span>
                                    </div>
                                    {!editing ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <span className="kpi-label-mini">{tr("page.arbeitszeiten.readonly_hours")}</span>
                                            {row.aktiv ? (
                                                (row.segments ?? []).map((seg, idx) => (
                                                    <span key={`${d.key}-ro-${idx}`} style={{ fontSize: 14, color: "var(--fg-2)" }}>
                                                        {seg.from}
                                                        {" – "}
                                                        {seg.to}
                                                    </span>
                                                ))
                                            ) : (
                                                <span style={{ fontSize: 13, color: "var(--fg-3)" }}>—</span>
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <Select
                                                id={`${d.key}-aktiv`}
                                                label="Status"
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
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="arbeitszeiten-aside-col">
                    <div className="card card-pad">
                        <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.arbeitszeiten.section_defaults")}</h2>
                        {!editing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {readStat(tr("page.arbeitszeiten.pause_from"), pauseVon)}
                                {readStat(tr("page.arbeitszeiten.pause_to"), pauseBis)}
                                {readStat(tr("page.arbeitszeiten.slot_label"), slotMin)}
                                {readStat(
                                    tr("page.arbeitszeiten.default_arzt_label"),
                                    defaultArztId ? (aerzte.find((x) => x.id === defaultArztId)?.name ?? defaultArztId) : "—",
                                )}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <Input id="pause-von" type="time" label={tr("page.arbeitszeiten.pause_from")} value={pauseVon} onChange={(e) => setPauseVon(e.target.value)} />
                                <Input id="pause-bis" type="time" label={tr("page.arbeitszeiten.pause_to")} value={pauseBis} onChange={(e) => setPauseBis(e.target.value)} />
                                <Input id="slot-min" type="number" min={10} step={5} label={tr("page.arbeitszeiten.slot_label")} value={slotMin} onChange={(e) => setSlotMin(e.target.value)} />
                                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>{tr("page.arbeitszeiten.pause_slot_apply_hint").replace("{name}", profileLabel)}</p>
                            </div>
                        )}
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
                </div>
            </div>
        </div>
    );
}
