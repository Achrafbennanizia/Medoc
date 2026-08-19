import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { useToastStore } from "../components/ui/toast-store";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon } from "@/lib/icons";
import type { PracticeWorkHoursConfig, PracticeDayKey, PracticeDayPlan } from "@/lib/practice-planning";
import { loadPracticeWorkHoursConfig, savePracticeWorkHoursConfig } from "@/lib/practice-planning";
import { usePracticeWorkHoursStore } from "@/models/store/practice-work-hours-store";
import type { PlanValidationIssue } from "@/lib/practice-work-hours-validation";
import {
    isValidPauseRange,
    isValidSlotMinutes,
    validatePracticeWorkPlan,
} from "@/lib/practice-work-hours-validation";
import { errorMessage, formatTpl } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { useRbac } from "@/lib/use-rbac";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";

const DAY_ORDER: readonly PracticeDayKey[] = ["mo", "di", "mi", "do", "fr", "sa", "so"];
const PRACTICE_PROFILE_KEY = "__practice__";

function formatPlanIssue(tr: (key: string) => string, issue: PlanValidationIssue): string {
    const day = tr(`page.work_hours.day.${issue.day}`);
    return tr(`page.work_hours.err.${issue.code}`).replace("{day}", day);
}

type WorkHoursPlan = Record<PracticeDayKey, PracticeDayPlan>;

const defaultPlan: WorkHoursPlan = {
    mo: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    di: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    mi: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    do: { active: true, segments: [{ from: "08:00", to: "17:00" }] },
    fr: { active: true, segments: [{ from: "08:00", to: "15:00" }] },
    sa: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
    so: { active: false, segments: [{ from: "09:00", to: "13:00" }] },
};

function clonePlan(p: WorkHoursPlan): WorkHoursPlan {
    return JSON.parse(JSON.stringify(p)) as WorkHoursPlan;
}

type ScheduleBaseline = {
    plan: WorkHoursPlan;
    breakFrom: string;
    breakUntil: string;
    slotMin: string;
};

function sliceForProfile(cfg: PracticeWorkHoursConfig, profile: string): ScheduleBaseline & { hasOwnSavedProfile: boolean } {
    if (profile === PRACTICE_PROFILE_KEY) {
        return {
            plan: cfg.plan,
            breakFrom: cfg.breakFrom,
            breakUntil: cfg.breakUntil,
            slotMin: cfg.slotMin,
            hasOwnSavedProfile: true,
        };
    }
    const o = cfg.physicianSchedules?.[profile];
    if (o) {
        return {
            plan: o.plan,
            breakFrom: o.breakFrom,
            breakUntil: o.breakUntil,
            slotMin: o.slotMin,
            hasOwnSavedProfile: true,
        };
    }
    return {
        plan: cfg.plan,
        breakFrom: cfg.breakFrom,
        breakUntil: cfg.breakUntil,
        slotMin: cfg.slotMin,
        hasOwnSavedProfile: false,
    };
}

export function WorkHoursPage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const tr = useT();
    const { canWritePracticePlanning } = useRbac();
    const [storedCfg, setStoredCfg] = useState<PracticeWorkHoursConfig | null>(null);
    const [selectedProfile, setSelectedProfile] = useState<string>(PRACTICE_PROFILE_KEY);
    const [plan, setPlan] = useState<WorkHoursPlan>(() => clonePlan(defaultPlan));
    const [breakFrom, setPauseFrom] = useState("12:30");
    const [breakUntil, setPauseUntil] = useState("13:30");
    const [slotMin, setSlotMin] = useState("30");
    const [hasOwnSavedProfile, setHasOwnSavedProfile] = useState(true);
    const [defaultPhysicianId, setDefaultPhysicianId] = useState("");
    const [physicians, setPhysicians] = useState<PhysicianSummary[]>([]);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const applySliceToForm = useCallback((slice: ScheduleBaseline) => {
        setPlan(clonePlan(slice.plan));
        setPauseFrom(slice.breakFrom);
        setPauseUntil(slice.breakUntil);
        setSlotMin(slice.slotMin);
    }, []);

    useEffect(() => {
        let cancelled = false;
        void loadPracticeWorkHoursConfig().then((parsed) => {
            if (cancelled) return;
            setStoredCfg(parsed);
            setSelectedProfile(PRACTICE_PROFILE_KEY);
            const s = sliceForProfile(parsed, PRACTICE_PROFILE_KEY);
            applySliceToForm(s);
            setHasOwnSavedProfile(s.hasOwnSavedProfile);
            setDefaultPhysicianId((parsed.defaultPhysicianId ?? "").trim());
            setEditing(false);
        });
        void listPhysicians()
            .then((list) => {
                if (!cancelled) setPhysicians(list);
            })
            .catch(() => {
                if (!cancelled) setPhysicians([]);
            });
        return () => {
            cancelled = true;
        };
    }, [applySliceToForm]);

    const activeDays = useMemo(() => DAY_ORDER.filter((k) => plan[k].active).length, [plan]);

    const weekdays = useMemo(
        () => DAY_ORDER.map((key) => ({ key, label: tr(`page.work_hours.day.${key}`) })),
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
            toast(tr("page.work_hours.profile_switch_blocked"), "info");
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
        setDefaultPhysicianId((storedCfg.defaultPhysicianId ?? "").trim());
        setHasOwnSavedProfile(s.hasOwnSavedProfile);
        setEditing(false);
    };

    const save = async () => {
        const issue = validatePracticeWorkPlan(plan);
        if (issue) {
            toast(formatPlanIssue(tr, issue), "error");
            return;
        }
        if (!isValidPauseRange(breakFrom, breakUntil)) {
            toast(tr("page.work_hours.err.pause_order"), "error");
            return;
        }
        if (!isValidSlotMinutes(slotMin)) {
            toast(tr("page.work_hours.err.slot_min"), "error");
            return;
        }
        setSaving(true);
        try {
            const prev = await loadPracticeWorkHoursConfig();
            const nextDefault = defaultPhysicianId.trim();
            let nextCfg: PracticeWorkHoursConfig;
            if (selectedProfile === PRACTICE_PROFILE_KEY) {
                nextCfg = {
                    ...prev,
                    plan,
                    breakFrom,
                    breakUntil,
                    slotMin,
                    defaultPhysicianId: nextDefault || undefined,
                };
            } else {
                nextCfg = {
                    ...prev,
                    defaultPhysicianId: nextDefault || undefined,
                    physicianSchedules: {
                        ...(prev.physicianSchedules ?? {}),
                        [selectedProfile]: { plan, breakFrom, breakUntil, slotMin },
                    },
                };
            }
            await savePracticeWorkHoursConfig(nextCfg);
            usePracticeWorkHoursStore.getState().setConfig(nextCfg);
            setStoredCfg(nextCfg);
            setHasOwnSavedProfile(true);
            setEditing(false);
            toast(tr("page.work_hours.toast_saved"));
        } catch (e) {
            toast(`${tr("page.work_hours.toast_save_failed")} ${errorMessage(e)}`, "error");
        } finally {
            setSaving(false);
        }
    };

    const addSegment = (dayKey: PracticeDayKey) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: [...prev[dayKey].segments, { from: "14:00", to: "18:00" }],
            },
        }));
    };

    const removeSegment = (dayKey: PracticeDayKey, idx: number) => {
        setPlan((prev) => ({
            ...prev,
            [dayKey]: {
                ...prev[dayKey],
                segments: prev[dayKey].segments.filter((_, i) => i !== idx),
            },
        }));
    };

    const updateSegment = (dayKey: PracticeDayKey, idx: number, key: "from" | "to", value: string) => {
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
            ? tr("page.work_hours.practice_profile")
            : (physicians.find((x) => x.id === selectedProfile)?.name ?? selectedProfile);

    return (
        <div className="work_hours-page practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                title={tr("page.work_hours.title")}
                subtitle={
                    <>
                        <p className="page-sub" style={{ marginTop: 0 }}>
                            {formatTpl(tr("page.work_hours.active_days"), { count: activeDays })}
                        </p>
                        <p className="page-sub" style={{ marginTop: 4 }}>
                            {editing ? tr("page.work_hours.subtitle_editing") : tr("page.work_hours.subtitle_readonly")}
                        </p>
                    </>
                }
                actions={
                    canWritePracticePlanning ? (
                        !editing ? (
                            <Button type="button" variant="secondary" onClick={() => setEditing(true)}>
                                <EditIcon size={14} />
                                {" "}
                                {tr("page.work_hours.edit")}
                            </Button>
                        ) : (
                            <>
                                <Button type="button" variant="ghost" onClick={cancelEdit} disabled={saving}>
                                    {tr("page.work_hours.cancel")}
                                </Button>
                                <Button type="button" onClick={() => void save()} disabled={saving} loading={saving}>
                                    {tr("page.work_hours.save")}
                                </Button>
                            </>
                        )
                    ) : null
                }
            />

            <div className="card card-pad">
                <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.work_hours.clinician_section_title")}</h2>
                <p className="page-sub" style={{ marginTop: 4, marginBottom: 14, maxWidth: 640 }}>
                    {tr("page.work_hours.clinician_section_hint")}
                </p>
                <div className="row" style={{ gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                        <Select
                            id="work_hours-profile"
                            label={tr("page.work_hours.clinician_select_label")}
                            value={selectedProfile}
                            disabled={editing}
                            options={[
                                { value: PRACTICE_PROFILE_KEY, label: tr("page.work_hours.practice_profile") },
                                ...physicians.map((a) => ({ value: a.id, label: a.name })),
                            ]}
                            onChange={(e) => onSelectProfile(e.target.value)}
                        />
                    </div>
                    {editing ? (
                        <div style={{ flex: "1 1 220px", minWidth: 200 }}>
                            <Select
                                id="default-physician-appointment"
                                label={tr("page.work_hours.default_physician_label")}
                                value={defaultPhysicianId}
                                options={[
                                    { value: "", label: tr("page.work_hours.default_physician_none") },
                                    ...physicians.map((a) => ({ value: a.id, label: a.name })),
                                ]}
                                onChange={(e) => setDefaultPhysicianId(e.target.value)}
                            />
                            <p style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 6, marginBottom: 0 }}>
                                {tr("page.work_hours.default_physician_hint")}
                            </p>
                        </div>
                    ) : null}
                </div>
                {!hasOwnSavedProfile && selectedProfile !== PRACTICE_PROFILE_KEY ? (
                    <p style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 12, marginBottom: 0 }}>
                        {tr("page.work_hours.inherits_practice")}
                    </p>
                ) : null}
                <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 10, marginBottom: 0 }}>
                    {tr("page.work_hours.editing_profile_rubric").replace("{name}", profileLabel)}
                </p>
            </div>

            <div className="work_hours-layout-split">
                <div className="card card-pad">
                    <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.work_hours.section_hours")}</h2>
                    <div className="work_hours-week-grid">
                        {weekdays.map((d) => {
                            const row = plan[d.key];
                            const cardClass =
                                `work_hours-day-card${row.active ? "" : " work_hours-day-card--inactive"}`;
                            return (
                                <div key={d.key} className={cardClass}>
                                    <div className="work_hours-day-head">
                                        <span className="work_hours-day-name">{d.label}</span>
                                        <span className={row.active ? "work_hours-day-badge work_hours-day-badge--on" : "work_hours-day-badge work_hours-day-badge--off"}>
                                            {row.active ? tr("page.work_hours.status_active") : tr("page.work_hours.status_free")}
                                        </span>
                                    </div>
                                    {!editing ? (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                            <span className="kpi-label-mini">{tr("page.work_hours.readonly_hours")}</span>
                                            {row.active ? (
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
                                                id={`${d.key}-active`}
                                                label={tr("common.status")}
                                                value={row.active ? "1" : "0"}
                                                options={[
                                                    { value: "1", label: tr("page.work_hours.status_active") },
                                                    { value: "0", label: tr("page.work_hours.status_free") },
                                                ]}
                                                onChange={(e) => setPlan((prev) => ({ ...prev, [d.key]: { ...prev[d.key], active: e.target.value === "1" } }))}
                                            />
                                            {(row.segments ?? []).map((seg, idx) => (
                                                <div key={`${d.key}-seg-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                                    <Input
                                                        id={`${d.key}-from-${idx}`}
                                                        type="time"
                                                        label={formatTpl(tr("page.work_hours.label_from"), { n: idx + 1 })}
                                                        value={seg.from}
                                                        onChange={(e) => updateSegment(d.key, idx, "from", e.target.value)}
                                                        disabled={!row.active}
                                                    />
                                                    <Input
                                                        id={`${d.key}-to-${idx}`}
                                                        type="time"
                                                        label={formatTpl(tr("page.work_hours.label_to"), { n: idx + 1 })}
                                                        value={seg.to}
                                                        onChange={(e) => updateSegment(d.key, idx, "to", e.target.value)}
                                                        disabled={!row.active}
                                                    />
                                                    {row.segments.length > 1 ? (
                                                        <Button type="button" size="sm" variant="ghost" onClick={() => removeSegment(d.key, idx)} disabled={!row.active}>
                                                            {tr("page.work_hours.remove_segment")}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            ))}
                                            <div>
                                                <Button type="button" size="sm" variant="secondary" onClick={() => addSegment(d.key)} disabled={!row.active}>
                                                    {tr("page.work_hours.add_segment")}
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="work_hours-aside-col">
                    <div className="card card-pad">
                        <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.work_hours.section_defaults")}</h2>
                        {!editing ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                {readStat(tr("page.work_hours.pause_from"), breakFrom)}
                                {readStat(tr("page.work_hours.pause_to"), breakUntil)}
                                {readStat(tr("page.work_hours.slot_label"), slotMin)}
                                {readStat(
                                    tr("page.work_hours.default_physician_label"),
                                    defaultPhysicianId ? (physicians.find((x) => x.id === defaultPhysicianId)?.name ?? defaultPhysicianId) : "—",
                                )}
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                <Input id="pause-from" type="time" label={tr("page.work_hours.pause_from")} value={breakFrom} onChange={(e) => setPauseFrom(e.target.value)} />
                                <Input id="pause-until" type="time" label={tr("page.work_hours.pause_to")} value={breakUntil} onChange={(e) => setPauseUntil(e.target.value)} />
                                <Input id="slot-min" type="number" min={10} step={5} label={tr("page.work_hours.slot_label")} value={slotMin} onChange={(e) => setSlotMin(e.target.value)} />
                                <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>{tr("page.work_hours.pause_slot_apply_hint").replace("{name}", profileLabel)}</p>
                            </div>
                        )}
                    </div>

                    <div className="card card-pad">
                        <h2 className="text-title" style={{ marginTop: 0 }}>{tr("page.work_hours.section_closures")}</h2>
                        <p style={{ fontSize: 12.5, color: "var(--fg-3)", marginTop: 8 }}>
                            {tr("page.work_hours.closures_hint")}
                        </p>
                        <Button type="button" variant="secondary" onClick={() => navigate("/administration/special-blocked-times")}>
                            {tr("page.work_hours.open_closures")}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
