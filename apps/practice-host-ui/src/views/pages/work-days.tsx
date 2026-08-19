import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
    listAbsences,
    createAbsence,
    updateAbsence,
    deleteAbsence,
} from "@/systems/practice-host/controllers/practice.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Absence } from "../../models/types";
import { errorMessage, formatDate } from "@/lib/utils";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { EditIcon, TrashIcon } from "@/lib/icons";

function pad2(n: number) {
    return String(n).padStart(2, "0");
}

function toIsoDate(d: Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseIso(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const da = Number(m[3]);
    const dt = new Date(y, mo, da);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

const WEEKDAY_KEYS = [
    "page.work_plan.day_short.mo",
    "page.work_plan.day_short.di",
    "page.work_plan.day_short.mi",
    "page.work_plan.day_short.do",
    "page.work_plan.day_short.fr",
    "page.work_plan.day_short.sa",
    "page.work_plan.day_short.so",
] as const;

export function WorkDaysPage() {
    const t = useT();
    const dateFnsLocale = useDateFnsLocale();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWrite = role ? allowed("administration.practice_planning.write", role) : false;

    const [rows, setRows] = useState<Absence[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);

    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

    const [kind, setKind] = useState("Urlaub");
    const [comment, setComment] = useState("");
    const [fromDay, setFromTag] = useState("");
    const [toDay, setUntilTag] = useState("");
    const [fromUhr, setFromUhr] = useState("");
    const [untilUhr, setUntilUhr] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listAbsences();
            setRows(list);
            setStatus("ready");
        } catch (e) {
            setLoadError(errorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const monthLabel = useMemo(
        () => format(new Date(calYear, calMonth, 1), "LLLL yyyy", { locale: dateFnsLocale }),
        [calYear, calMonth, dateFnsLocale],
    );

    const calendarCells = useMemo(() => {
        const first = new Date(calYear, calMonth, 1);
        const startPad = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const cells: Array<{ d: number; iso: string; inMonth: boolean }> = [];
        const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
        for (let i = 0; i < startPad; i++) {
            const day = prevMonthDays - startPad + i + 1;
            const dt = new Date(calYear, calMonth - 1, day);
            cells.push({ d: day, iso: toIsoDate(dt), inMonth: false });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ d, iso: toIsoDate(new Date(calYear, calMonth, d)), inMonth: true });
        }
        while (cells.length % 7 !== 0 || cells.length < 42) {
            const next = cells.length - (startPad + daysInMonth);
            const day = next + 1;
            const dt = new Date(calYear, calMonth + 1, day);
            cells.push({ d: day, iso: toIsoDate(dt), inMonth: false });
        }
        return cells.slice(0, 42);
    }, [calYear, calMonth]);

    const pickDay = (iso: string) => {
        if (!fromDay || (fromDay && toDay)) {
            setFromTag(iso);
            setUntilTag("");
        } else {
            const a = parseIso(fromDay);
            const b = parseIso(iso);
            if (a && b && b < a) {
                setUntilTag(fromDay);
                setFromTag(iso);
            } else {
                setUntilTag(iso);
            }
        }
    };

    const resetForm = () => {
        setKind("Urlaub");
        setComment("");
        setFromTag("");
        setUntilTag("");
        setFromUhr("");
        setUntilUhr("");
        setEditingId(null);
    };

    const startEdit = (r: Absence) => {
        setEditingId(r.id);
        setKind(r.kind);
        setComment(r.comment ?? "");
        setFromTag(r.from_day);
        setUntilTag(r.to_day);
        setFromUhr(r.from_time ?? "");
        setUntilUhr(r.to_time ?? "");
    };

    const submit = async () => {
        if (!canWrite) return;
        if (!kind.trim() || !fromDay || !toDay) {
            toast(t("page.workDays.toast.validation"), "error");
            return;
        }
        try {
            if (editingId) {
                await updateAbsence(editingId, {
                    kind: kind.trim(),
                    comment: comment.trim() || undefined,
                    from_day: fromDay,
                    to_day: toDay,
                    from_time: fromUhr.trim() || undefined,
                    to_time: untilUhr.trim() || undefined,
                });
                toast(t("page.workDays.toast.saved"));
            } else {
                await createAbsence({
                    kind: kind.trim(),
                    comment: comment.trim() || undefined,
                    from_day: fromDay,
                    to_day: toDay,
                    from_time: fromUhr.trim() || undefined,
                    to_time: untilUhr.trim() || undefined,
                });
                toast(t("page.work_plan.toast.compose_entry_added"));
            }
            resetForm();
            await reload();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    const confirmDelete = async () => {
        if (!deleteId || !canWrite) return;
        try {
            await deleteAbsence(deleteId);
            toast(t("page.workDays.toast.deleted"));
            setDeleteId(null);
            if (editingId === deleteId) resetForm();
            await reload();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    if (status === "loading") return <PageLoading label={t("page.workDays.loading")} />;
    if (status === "error" && loadError) return <PageLoadError message={loadError} onRetry={() => void reload()} />;

    return (
        <div className="practice-workspace-page animate-fade-in">
            <AdministrationPageHeader
                titleLevel="h1"
                title={t("page.workDays.title")}
                subtitle={t("page.workDays.subtitle")}
            />

            <ConfirmDialog
                open={Boolean(deleteId)}
                title={t("patient.detail.header.delete_confirm.title")}
                message={t("page.workDays.delete.message")}
                confirmLabel={t("common.yes_delete")}
                danger
                onConfirm={() => void confirmDelete()}
                onClose={() => setDeleteId(null)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <div className="card card-pad">
                    <h2 className="form-section-title" style={{ marginTop: 0 }}>{t("page.workDays.calendar")}</h2>
                    <div className="row appointment-nav-controls" dir="ltr" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                            if (calMonth === 0) {
                                setCalMonth(11);
                                setCalYear((y) => y - 1);
                            } else setCalMonth((m) => m - 1);
                        }}
                        >
                            ‹
                        </Button>
                        <span style={{ fontWeight: 600 }}>{monthLabel}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                            if (calMonth === 11) {
                                setCalMonth(0);
                                setCalYear((y) => y + 1);
                            } else setCalMonth((m) => m + 1);
                        }}
                        >
                            ›
                        </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center" style={{ fontSize: 11, color: "var(--fg-3)", marginBottom: 4 }}>
                        {WEEKDAY_KEYS.map((key) => (
                            <div key={key}>{t(key)}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((c) => {
                            const selFrom = fromDay === c.iso;
                            const selUntil = toDay === c.iso;
                            const inRange =
                                fromDay &&
                                toDay &&
                                c.iso >= fromDay &&
                                c.iso <= toDay &&
                                c.inMonth;
                            return (
                                <button
                                    key={`${c.iso}-${c.d}-${c.inMonth}`}
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{
                                        minHeight: 36,
                                        padding: 4,
                                        fontSize: 12,
                                        opacity: c.inMonth ? 1 : 0.35,
                                        border: selFrom || selUntil ? "2px solid var(--accent)" : inRange ? "1px solid var(--accent-soft)" : undefined,
                                        background: inRange ? "var(--accent-soft)" : undefined,
                                    }}
                                    onClick={() => pickDay(c.iso)}
                                >
                                    {c.d}
                                </button>
                            );
                        })}
                    </div>
                    <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 10, marginBottom: 0 }}>
                        {t("page.workDays.calendar.hint")}
                    </p>
                </div>

                <div className="card card-pad">
                    <h2 className="form-section-title" style={{ marginTop: 0 }}>{t("page.workDays.add_title")}</h2>
                    <Input label={t("common.type")} value={kind} onChange={(e) => setKind(e.target.value)} disabled={!canWrite} />
                    <Input label={t("page.workDays.field.comment")} value={comment} onChange={(e) => setComment(e.target.value)} disabled={!canWrite} />
                    <div className="workDays-range-grid" role="group" aria-label={t("page.workDays.range_aria")}>
                        <div className="workDays-range-grid__field">
                            <label htmlFor="workDays-from-tag" className="workDays-range-grid__l">{t("page.workDays.field.from_day")}</label>
                            <input
                                id="workDays-from-tag"
                                type="date"
                                className="workDays-range-grid__in"
                                value={fromDay}
                                onChange={(e) => setFromTag(e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="workDays-range-grid__field">
                            <label htmlFor="workDays-until-tag" className="workDays-range-grid__l">{t("page.workDays.field.to_day")}</label>
                            <input
                                id="workDays-until-tag"
                                type="date"
                                className="workDays-range-grid__in"
                                value={toDay}
                                onChange={(e) => setUntilTag(e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="workDays-range-grid__field">
                            <label htmlFor="workDays-from-uhr" className="workDays-range-grid__l">{t("page.workDays.field.from_time")}</label>
                            <input
                                id="workDays-from-uhr"
                                type="time"
                                className="workDays-range-grid__in"
                                value={fromUhr}
                                onChange={(e) => setFromUhr(e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>
                        <div className="workDays-range-grid__field">
                            <label htmlFor="workDays-until-uhr" className="workDays-range-grid__l">{t("page.workDays.field.to_time")}</label>
                            <input
                                id="workDays-until-uhr"
                                type="time"
                                className="workDays-range-grid__in"
                                value={untilUhr}
                                onChange={(e) => setUntilUhr(e.target.value)}
                                disabled={!canWrite}
                            />
                        </div>
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {canWrite ? (
                            <>
                                <Button type="button" onClick={() => void submit()}>{editingId ? t("common.save") : t("common.add")}</Button>
                                {editingId ? (
                                    <Button type="button" variant="ghost" onClick={resetForm}>{t("common.cancel")}</Button>
                                ) : null}
                            </>
                        ) : (
                            <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{t("page.workDays.read_only")}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="form-section-title" style={{ marginTop: 0 }}>{t("page.workDays.entries")}</h2>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                <th style={{ padding: "8px 6px" }}>{t("page.work_plan.label.from")}</th>
                                <th style={{ padding: "8px 6px" }}>{t("page.work_plan.label.to")}</th>
                                <th style={{ padding: "8px 6px" }}>{t("page.workDays.col.time")}</th>
                                <th style={{ padding: "8px 6px" }}>{t("common.type")}</th>
                                <th style={{ padding: "8px 6px" }}>{t("page.workDays.field.comment")}</th>
                                {canWrite ? <th style={{ padding: "8px 6px", width: 88 }}> </th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                    <td style={{ padding: "8px 6px" }}>{formatDate(r.from_day)}</td>
                                    <td style={{ padding: "8px 6px" }}>{formatDate(r.to_day)}</td>
                                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                                        {r.from_time || "—"}
                                        {" / "}
                                        {r.to_time || "—"}
                                    </td>
                                    <td style={{ padding: "8px 6px" }}>{r.kind}</td>
                                    <td style={{ padding: "8px 6px", color: "var(--fg-3)" }}>{r.comment || "—"}</td>
                                    {canWrite ? (
                                        <td style={{ padding: "8px 6px" }}>
                                            <div className="row" style={{ gap: 6 }}>
                                                <button type="button" className="btn btn-ghost" aria-label={t("page.workDays.a11y.edit")} onClick={() => startEdit(r)}><EditIcon /></button>
                                                <button type="button" className="btn btn-ghost" aria-label={t("page.workDays.a11y.delete")} onClick={() => setDeleteId(r.id)}><TrashIcon /></button>
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 ? <p style={{ color: "var(--fg-3)", marginTop: 12 }}>{t("page.workDays.empty")}</p> : null}
                </div>
            </div>
        </div>
    );
}
