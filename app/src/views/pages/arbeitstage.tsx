import { useCallback, useEffect, useMemo, useState } from "react";
import {
    listAbwesenheiten,
    createAbwesenheit,
    updateAbwesenheit,
    deleteAbwesenheit,
} from "../../controllers/praxis.controller";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { Abwesenheit } from "../../models/types";
import { errorMessage, formatDate } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ConfirmDialog } from "../components/ui/dialog";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
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

export function ArbeitstagePage() {
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("personal.write", role) : false;

    const [rows, setRows] = useState<Abwesenheit[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);

    const [calYear, setCalYear] = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

    const [typ, setTyp] = useState("Urlaub");
    const [kommentar, setKommentar] = useState("");
    const [vonTag, setVonTag] = useState("");
    const [bisTag, setBisTag] = useState("");
    const [vonUhr, setVonUhr] = useState("");
    const [bisUhr, setBisUhr] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const [deleteId, setDeleteId] = useState<string | null>(null);

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listAbwesenheiten();
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
        () => new Date(calYear, calMonth, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
        [calYear, calMonth],
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
        if (!vonTag || (vonTag && bisTag)) {
            setVonTag(iso);
            setBisTag("");
        } else {
            const a = parseIso(vonTag);
            const b = parseIso(iso);
            if (a && b && b < a) {
                setBisTag(vonTag);
                setVonTag(iso);
            } else {
                setBisTag(iso);
            }
        }
    };

    const resetForm = () => {
        setTyp("Urlaub");
        setKommentar("");
        setVonTag("");
        setBisTag("");
        setVonUhr("");
        setBisUhr("");
        setEditingId(null);
    };

    const startEdit = (r: Abwesenheit) => {
        setEditingId(r.id);
        setTyp(r.typ);
        setKommentar(r.kommentar ?? "");
        setVonTag(r.von_tag);
        setBisTag(r.bis_tag);
        setVonUhr(r.von_uhrzeit ?? "");
        setBisUhr(r.bis_uhrzeit ?? "");
    };

    const submit = async () => {
        if (!canWrite) return;
        if (!typ.trim() || !vonTag || !bisTag) {
            toast("Typ und Zeitraum (von/bis) sind erforderlich.", "error");
            return;
        }
        try {
            if (editingId) {
                await updateAbwesenheit(editingId, {
                    typ: typ.trim(),
                    kommentar: kommentar.trim() || undefined,
                    von_tag: vonTag,
                    bis_tag: bisTag,
                    von_uhrzeit: vonUhr.trim() || undefined,
                    bis_uhrzeit: bisUhr.trim() || undefined,
                });
                toast("Eintrag gespeichert");
            } else {
                await createAbwesenheit({
                    typ: typ.trim(),
                    kommentar: kommentar.trim() || undefined,
                    von_tag: vonTag,
                    bis_tag: bisTag,
                    von_uhrzeit: vonUhr.trim() || undefined,
                    bis_uhrzeit: bisUhr.trim() || undefined,
                });
                toast("Eintrag hinzugefügt");
            }
            resetForm();
            await reload();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    const confirmDelete = async () => {
        if (!deleteId || !canWrite) return;
        try {
            await deleteAbwesenheit(deleteId);
            toast("Eintrag gelöscht");
            setDeleteId(null);
            if (editingId === deleteId) resetForm();
            await reload();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    if (status === "loading") return <PageLoading label="Arbeitstage werden geladen…" />;
    if (status === "error" && loadError) return <PageLoadError message={loadError} onRetry={() => void reload()} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <VerwaltungBackButton />
                <div>
                    <h1 className="page-title" style={{ margin: 0 }}>Arbeitstage verwalten</h1>
                    <p className="page-sub">Urlaub und Abwesenheiten — Kalender und Liste</p>
                </div>
            </div>

            <ConfirmDialog
                open={Boolean(deleteId)}
                title="Löschen bestätigen:"
                message="Möchten Sie dieses Objekt wirklich löschen?"
                confirmLabel="Ja, löschen"
                danger
                onConfirm={() => void confirmDelete()}
                onClose={() => setDeleteId(null)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
                <div className="card card-pad">
                    <h2 className="form-section-title" style={{ marginTop: 0 }}>Kalender</h2>
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
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
                        {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
                            <div key={d}>{d}</div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {calendarCells.map((c) => {
                            const selVon = vonTag === c.iso;
                            const selBis = bisTag === c.iso;
                            const inRange =
                                vonTag &&
                                bisTag &&
                                c.iso >= vonTag &&
                                c.iso <= bisTag &&
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
                                        border: selVon || selBis ? "2px solid var(--accent)" : inRange ? "1px solid var(--accent-soft)" : undefined,
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
                        Erstes Datum setzt „Von“, zweites „Bis“. Erneut wählen setzt neu.
                    </p>
                </div>

                <div className="card card-pad">
                    <h2 className="form-section-title" style={{ marginTop: 0 }}>Urlaub hinzufügen</h2>
                    <Input label="Typ" value={typ} onChange={(e) => setTyp(e.target.value)} disabled={!canWrite} />
                    <Input label="Kommentar" value={kommentar} onChange={(e) => setKommentar(e.target.value)} disabled={!canWrite} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input type="date" label="Von dem Tag" value={vonTag} onChange={(e) => setVonTag(e.target.value)} disabled={!canWrite} />
                        <Input type="date" label="Bis dem Tag" value={bisTag} onChange={(e) => setBisTag(e.target.value)} disabled={!canWrite} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input type="time" label="Von der Uhrzeit" value={vonUhr} onChange={(e) => setVonUhr(e.target.value)} disabled={!canWrite} />
                        <Input type="time" label="Bis der Uhrzeit" value={bisUhr} onChange={(e) => setBisUhr(e.target.value)} disabled={!canWrite} />
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {canWrite ? (
                            <>
                                <Button type="button" onClick={() => void submit()}>{editingId ? "Speichern" : "Hinzufügen"}</Button>
                                {editingId ? (
                                    <Button type="button" variant="ghost" onClick={resetForm}>Abbrechen</Button>
                                ) : null}
                            </>
                        ) : (
                            <span style={{ fontSize: 13, color: "var(--fg-3)" }}>Nur Lesen — keine Berechtigung zum Bearbeiten.</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="card card-pad">
                <h2 className="form-section-title" style={{ marginTop: 0 }}>Einträge</h2>
                <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                                <th style={{ padding: "8px 6px" }}>Von</th>
                                <th style={{ padding: "8px 6px" }}>Bis</th>
                                <th style={{ padding: "8px 6px" }}>Uhrzeit</th>
                                <th style={{ padding: "8px 6px" }}>Typ</th>
                                <th style={{ padding: "8px 6px" }}>Kommentar</th>
                                {canWrite ? <th style={{ padding: "8px 6px", width: 88 }}> </th> : null}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                                    <td style={{ padding: "8px 6px" }}>{formatDate(r.von_tag)}</td>
                                    <td style={{ padding: "8px 6px" }}>{formatDate(r.bis_tag)}</td>
                                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                                        {r.von_uhrzeit || "—"}
                                        {" / "}
                                        {r.bis_uhrzeit || "—"}
                                    </td>
                                    <td style={{ padding: "8px 6px" }}>{r.typ}</td>
                                    <td style={{ padding: "8px 6px", color: "var(--fg-3)" }}>{r.kommentar || "—"}</td>
                                    {canWrite ? (
                                        <td style={{ padding: "8px 6px" }}>
                                            <div className="row" style={{ gap: 6 }}>
                                                <button type="button" className="btn btn-ghost" aria-label="Bearbeiten" onClick={() => startEdit(r)}><EditIcon /></button>
                                                <button type="button" className="btn btn-ghost" aria-label="Löschen" onClick={() => setDeleteId(r.id)}><TrashIcon /></button>
                                            </div>
                                        </td>
                                    ) : null}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {rows.length === 0 ? <p style={{ color: "var(--fg-3)", marginTop: 12 }}>Keine Einträge.</p> : null}
                </div>
            </div>
        </div>
    );
}
