import { useCallback, useEffect, useMemo, useState } from "react";
import { useT, useTParams } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
import { useToastStore } from "../components/ui/toast-store";
import type { PraxisClosureMode, PraxisClosureRule } from "@/lib/praxis-planning";
import { loadPraxisArbeitszeitenConfig, savePraxisArbeitszeitenConfig } from "@/lib/praxis-planning";
import { errorMessage } from "@/lib/utils";
import { useRbac } from "@/lib/use-rbac";
import { EditIcon, TrashIcon } from "@/lib/icons";

export function SonderSperrzeitenPage() {
    const t = useT();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const { canWritePraxisplanung } = useRbac();
    const [closures, setClosures] = useState<PraxisClosureRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [closureDate, setClosureDate] = useState("");
    const [closureMode, setClosureMode] = useState<PraxisClosureMode>("FULL_DAY");
    const [closurePeriods, setClosurePeriods] = useState<Array<{ from: string; to: string }>>([{ from: "08:00", to: "12:00" }]);
    const [closureReason, setClosureReason] = useState("");
    const [creating, setCreating] = useState(false);
    const [sperrEdit, setSperrEdit] = useState(false);
    const [selected, setSelected] = useState<PraxisClosureRule | null>(null);

    const loadClosures = useCallback(() => {
        let cancelled = false;
        setLoading(true);
        setLoadError(null);
        void loadPraxisArbeitszeitenConfig()
            .then((parsed) => {
                if (!cancelled) setClosures(parsed.closures ?? []);
            })
            .catch((e: unknown) => {
                if (!cancelled) {
                    setClosures([]);
                    setLoadError(errorMessage(e));
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const cleanup = loadClosures();
        return cleanup;
    }, [loadClosures]);

    const saveClosures = async (next: PraxisClosureRule[]) => {
        const previous = closures;
        setClosures(next);
        setSelected((s) => (s ? next.find((x) => x.id === s.id) ?? null : null));
        try {
            const cfg = await loadPraxisArbeitszeitenConfig();
            await savePraxisArbeitszeitenConfig({ ...cfg, closures: next });
        } catch (e) {
            setClosures(previous);
            toast(tp("common.save_failed", { message: errorMessage(e) }), "error");
        }
    };

    const openForm = () => {
        setCreating(true);
        setSperrEdit(false);
        setSelected(null);
    };

    const closeForm = () => {
        setCreating(false);
    };

    const fillFormFrom = (r: PraxisClosureRule) => {
        setClosureDate(r.date);
        setClosureMode(r.mode);
        setClosurePeriods(r.periods?.length ? r.periods.map((p) => ({ ...p })) : [{ from: "08:00", to: "12:00" }]);
        setClosureReason(r.reason ?? "");
    };

    const startEditSelected = () => {
        if (!selected) return;
        setCreating(false);
        setSperrEdit(true);
        fillFormFrom(selected);
    };

    const cancelSperrEdit = () => {
        setSperrEdit(false);
        if (selected) fillFormFrom(selected);
    };

    const saveSperrEdit = () => {
        if (!selected) return;
        if (!closureDate) {
            toast(t("common.please_pick_date"), "error");
            return;
        }
        if (closureMode === "CUSTOM" && closurePeriods.some((p) => !p.from || !p.to || p.from >= p.to)) {
            toast(t("page.sonder_sperrzeiten.custom_periods_error"), "error");
            return;
        }
        const updated: PraxisClosureRule = {
            ...selected,
            date: closureDate,
            mode: closureMode,
            periods: closureMode === "CUSTOM" ? closurePeriods : [],
            reason: closureReason.trim() || undefined,
        };
        const next = closures
            .map((c) => (c.id === selected.id ? updated : c))
            .sort((a, b) => b.date.localeCompare(a.date));
        void saveClosures(next);
        setSperrEdit(false);
        setSelected(updated);
        toast(t("page.sonder_sperrzeiten.toast.saved"));
    };

    const selectRow = (r: PraxisClosureRule) => {
        setSelected(r);
        setCreating(false);
        setSperrEdit(false);
    };

    const addClosure = () => {
        if (!closureDate) {
            toast(t("common.please_pick_date"), "error");
            return;
        }
        if (closureMode === "CUSTOM" && closurePeriods.some((p) => !p.from || !p.to || p.from >= p.to)) {
            toast(t("page.sonder_sperrzeiten.custom_periods_error"), "error");
            return;
        }
        const row: PraxisClosureRule = {
            id: crypto.randomUUID(),
            date: closureDate,
            mode: closureMode,
            periods: closureMode === "CUSTOM" ? closurePeriods : [],
            reason: closureReason.trim() || undefined,
        };
        const next = [row, ...closures].sort((a, b) => a.date.localeCompare(b.date));
        void saveClosures(next);
        setClosureReason("");
        setClosurePeriods([{ from: "08:00", to: "12:00" }]);
        setSelected(row);
        setCreating(false);
        toast(t("page.sonder_sperrzeiten.toast.added"));
    };

    const addNextDayEmergencyClose = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const row: PraxisClosureRule = {
            id: crypto.randomUUID(),
            date: iso,
            mode: "FULL_DAY",
            periods: [],
            reason: t("page.sonder_sperrzeiten.emergency_reason"),
        };
        const next = [row, ...closures].sort((a, b) => a.date.localeCompare(b.date));
        void saveClosures(next);
        setSelected(row);
        setCreating(false);
        toast(t("page.sonder_sperrzeiten.toast.next_day"));
    };

    const removeClosure = (id: string) => {
        const next = closures.filter((r) => r.id !== id);
        void saveClosures(next);
        setSelected((s) => (s?.id === id ? null : s));
    };

    const addPeriod = () => setClosurePeriods((prev) => [...prev, { from: "14:00", to: "18:00" }]);
    const removePeriod = (idx: number) => setClosurePeriods((prev) => prev.filter((_, i) => i !== idx));
    const updatePeriod = (idx: number, key: "from" | "to", value: string) =>
        setClosurePeriods((prev) => prev.map((p, i) => (i === idx ? { ...p, [key]: value } : p)));

    const sorted = useMemo(
        () => [...closures].sort((a, b) => b.date.localeCompare(a.date)),
        [closures],
    );

    const timeLabel = (r: PraxisClosureRule) =>
        r.mode === "CUSTOM" ? (r.periods ?? []).map((p) => `${p.from}–${p.to}`).join(", ") : "—";

    const modeLabel = (mode: PraxisClosureMode, short = false) =>
        mode === "FULL_DAY"
            ? t(short ? "page.sonder_sperrzeiten.mode.full_day_short" : "page.sonder_sperrzeiten.mode.full_day")
            : t(short ? "page.sonder_sperrzeiten.mode.custom_short" : "page.sonder_sperrzeiten.mode.custom");

    const readField = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="kpi-label-mini">{label}</span>
            <span style={{ fontSize: 14, color: "var(--fg-2)" }}>{value || "—"}</span>
        </div>
    );

    const closureFormFields = (idPrefix: string) => (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input id={`${idPrefix}-date`} type="date" label={t("common.date")} value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
                <Select
                    id={`${idPrefix}-mode`}
                    label={t("common.type")}
                    value={closureMode}
                    onChange={(e) => setClosureMode(e.target.value as PraxisClosureMode)}
                    options={[
                        { value: "FULL_DAY", label: t("page.sonder_sperrzeiten.mode.full_day") },
                        { value: "CUSTOM", label: t("page.sonder_sperrzeiten.mode.custom") },
                    ]}
                />
                <Input id={`${idPrefix}-reason`} label={t("common.reason_optional")} value={closureReason} onChange={(e) => setClosureReason(e.target.value)} />
                {closureMode === "CUSTOM" ? (
                    <div className="col" style={{ gap: 8, gridColumn: "1 / -1" }}>
                        {closurePeriods.map((p, idx) => (
                            <div key={`period-${idPrefix}-${idx}`} className="row" style={{ gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                                <Input
                                    id={`${idPrefix}-from-${idx}`}
                                    type="time"
                                    label={tp("page.sonder_sperrzeiten.from_period", { n: idx + 1 })}
                                    value={p.from}
                                    onChange={(e) => updatePeriod(idx, "from", e.target.value)}
                                />
                                <Input
                                    id={`${idPrefix}-to-${idx}`}
                                    type="time"
                                    label={tp("page.sonder_sperrzeiten.to_period", { n: idx + 1 })}
                                    value={p.to}
                                    onChange={(e) => updatePeriod(idx, "to", e.target.value)}
                                />
                                {closurePeriods.length > 1 ? (
                                    <Button type="button" size="sm" variant="ghost" onClick={() => removePeriod(idx)}>
                                        {t("common.remove")}
                                    </Button>
                                ) : null}
                            </div>
                        ))}
                        <div>
                            <Button type="button" size="sm" variant="secondary" onClick={addPeriod}>
                                {t("page.sonder_sperrzeiten.add_period")}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    );

    const sidePanel = (() => {
        if (creating) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.sonder_sperrzeiten.new_rule.title")}
                        subtitle={t("page.sonder_sperrzeiten.new_rule.subtitle")}
                        action={
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="danger" onClick={addNextDayEmergencyClose}>
                                    {t("page.sonder_sperrzeiten.close_practice_tomorrow")}
                                </Button>
                                <Button type="button" size="sm" variant="ghost" onClick={closeForm}>
                                    {t("common.close")}
                                </Button>
                            </div>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>{t("page.sonder_sperrzeiten.form.hint")}</p>
                        {closureFormFields("closure")}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                            <Button type="button" variant="secondary" onClick={() => void addClosure()}>
                                {t("page.sonder_sperrzeiten.add_closure")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected && sperrEdit) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={t("page.sonder_sperrzeiten.edit.title")}
                        subtitle={t("page.sonder_sperrzeiten.edit.subtitle")}
                        action={
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button type="button" size="sm" variant="ghost" onClick={cancelSperrEdit}>
                                    {t("common.cancel")}
                                </Button>
                            </div>
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {closureFormFields("closure-ed")}
                        <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                            <Button type="button" variant="secondary" onClick={() => void saveSperrEdit()}>
                                {t("common.save")}
                            </Button>
                        </div>
                    </div>
                </Card>
            );
        }
        if (selected) {
            const r = selected;
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={r.date}
                        subtitle={modeLabel(r.mode)}
                        action={
                            canWritePraxisplanung ? (
                            <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                <Button type="button" size="sm" variant="secondary" onClick={startEditSelected}>
                                    <EditIcon size={14} /> {t("common.edit")}
                                </Button>
                                <Button type="button" size="sm" variant="danger" onClick={() => removeClosure(r.id)}>
                                    <TrashIcon size={14} /> {t("common.remove")}
                                </Button>
                            </div>
                            ) : undefined
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="produkte-read-grid">
                            {readField(t("common.date"), r.date)}
                            {readField(t("common.type"), modeLabel(r.mode, true))}
                            <div style={{ gridColumn: "1 / -1" }}>{readField(t("common.time"), timeLabel(r))}</div>
                            <div style={{ gridColumn: "1 / -1" }}>{readField(t("common.reason"), r.reason ?? "—")}</div>
                        </div>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {t("page.sonder_sperrzeiten.empty.hint")}
                </p>
            </Card>
        );
    })();

    if (loading) return <PageLoading label={t("page.sonder_sperrzeiten.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void loadClosures()} />;

    return (
        <div className="produkte-page praxis-workspace-page animate-fade-in">
            <VerwaltungPageHeader
                title={t("page.sonder_sperrzeiten.title")}
                subtitle={t("page.sonder_sperrzeiten.subtitle")}
                actions={
                    canWritePraxisplanung ? (
                        <Button type="button" variant={creating ? "secondary" : "primary"} onClick={creating ? closeForm : openForm}>
                            {creating ? t("page.sonder_sperrzeiten.close_form") : t("page.sonder_sperrzeiten.new_rule")}
                        </Button>
                    ) : null
                }
            />

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState icon="🚫" title={t("page.sonder_sperrzeiten.empty.title")} description={t("page.sonder_sperrzeiten.empty.desc")} />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card tbl-data-card tbl-scroll">
                            <table className="tbl tbl-fluid">
                                <thead>
                                    <tr>
                                        <th scope="col">{t("common.date")}</th>
                                        <th scope="col">{t("common.type")}</th>
                                        <th scope="col">{t("common.time")}</th>
                                        <th scope="col">{t("common.reason")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r) => {
                                        const isSel = !creating && selected?.id === r.id;
                                        return (
                                            <tr
                                                key={r.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                onClick={() => selectRow(r)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.date}</td>
                                                <td>{modeLabel(r.mode, true)}</td>
                                                <td className="page-sub" style={{ fontSize: 13 }}>{timeLabel(r)}</td>
                                                <td className="page-sub" style={{ fontSize: 13, color: "var(--fg-3)" }}>{r.reason ?? "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="produkte-workspace__detail">{sidePanel}</div>
            </div>
        </div>
    );
}
