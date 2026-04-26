import { type Dispatch, type SetStateAction, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDays, addMonths, addWeeks, differenceInYears, format, parseISO, startOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { listTermine, deleteTermin, updateTermin } from "../../controllers/termin.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { errorMessage } from "../../lib/utils";
import { useT } from "@/lib/i18n";
import type { Termin, Patient } from "../../models/types";
import { Button } from "../components/ui/button";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { Input, Select } from "../components/ui/input";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AmbulanceIcon, CalendarIcon, ChevronLeftIcon, ChevronRightIcon, FilterIcon, MoreIcon, PlusIcon } from "@/lib/icons";

type BadgeVariant = "primary" | "success" | "default" | "error" | "warning";

const statusBadge: Record<string, BadgeVariant> = {
    GEPLANT: "primary",
    BESTAETIGT: "success",
    DURCHGEFUEHRT: "default",
    NICHT_ERSCHIENEN: "error",
    ABGESAGT: "warning",
};

const terminArten = [
    { value: "KONTROLLE", label: "Kontrolle" },
    { value: "BEHANDLUNG", label: "Behandlung" },
    { value: "NOTFALL", label: "Notfall" },
    { value: "BERATUNG", label: "Beratung" },
];

const EVENT_TONE_BY_ART: Record<string, "blue" | "accent" | "orange" | "purple"> = {
    KONTROLLE: "blue",
    BEHANDLUNG: "accent",
    NOTFALL: "orange",
    BERATUNG: "purple",
};

const ART_FILTER_OPTIONS = [{ value: "", label: "Alle Arten" }, ...terminArten];

const STATUS_FILTER_OPTIONS = [
    { value: "", label: "Alle Stati" },
    ...Object.keys(statusBadge).map((k) => ({ value: k, label: k.replace(/_/g, " ") })),
];

const NOTFALL_CONFIRM_TITLE = "Notfall-Termin einplanen?";
const NOTFALL_CONFIRM_MESSAGE =
    "Der Notfall-Slot wird direkt vor dem nächsten freien Termin eingeordnet. Der aktuell laufende Patient erhält 8 Minuten Restzeit. Alle später beginnenden Termine verschieben sich automatisch.";

const TERMIN_ART_LABEL: Record<string, string> = {
    KONTROLLE: "Kontrolle",
    BEHANDLUNG: "Behandlung",
    BERATUNG: "Beratung",
    ERSTBESUCH: "Erstbesuch",
    UNTERSUCHUNG: "Untersuchung",
    NOTFALL: "Notfall",
};

function terminArtLabel(art: string): string {
    return TERMIN_ART_LABEL[art] ?? art.replace(/_/g, " ");
}

/** Dringlichkeit — nicht im Backend modelliert; aus Art abgeleitet. */
function severityForTermin(t: Termin): "low" | "medium" | "high" {
    if (t.art === "NOTFALL" || t.art === "BEHANDLUNG") return "high";
    if (t.art === "UNTERSUCHUNG" || t.art === "ERSTBESUCH" || t.art === "BERATUNG") return "medium";
    return "low";
}

function severityDe(s: "low" | "medium" | "high"): string {
    if (s === "high") return "Hoch";
    if (s === "medium") return "Mittel";
    return "Niedrig";
}

function severitySoftPillClass(s: "low" | "medium" | "high"): string {
    if (s === "low") return "green";
    if (s === "medium") return "yellow";
    return "orange";
}

/** Anzeige-Status: Durchgeführt / Geändert / Storniert / Bestätigt / Geplant (letztere wenn noch offen). */
function appointmentStateDisplay(t: Termin): { label: string; variant: BadgeVariant } {
    if (t.status === "ABGESAGT" || t.status === "NICHT_ERSCHIENEN") {
        return { label: "Storniert", variant: "error" };
    }
    if (t.status === "DURCHGEFUEHRT") {
        return { label: "Durchgeführt", variant: "success" };
    }
    const editedMs = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
    const edited = editedMs > 60_000;
    if (edited && (t.status === "GEPLANT" || t.status === "BESTAETIGT")) {
        return { label: "Geändert", variant: "warning" };
    }
    if (t.status === "BESTAETIGT") {
        return { label: "Bestätigt", variant: "success" };
    }
    return { label: "Geplant", variant: "primary" };
}

/** Weiche Status-Pille (Tagesliste im Stil der UI-Referenz). */
function stateSoftPillClass(t: Termin): string {
    const { label } = appointmentStateDisplay(t);
    if (label === "Storniert") return "red";
    if (label === "Durchgeführt") return "accent";
    if (label === "Geändert") return "yellow";
    if (label === "Bestätigt") return "blue";
    return "grey";
}

function patientAlterJahre(p: Patient | undefined, refDate: Date): number | null {
    if (!p?.geburtsdatum) return null;
    const raw = p.geburtsdatum.slice(0, 10);
    try {
        return differenceInYears(parseISO(raw), refDate);
    } catch {
        return null;
    }
}

function countTermineInMonth(termine: Termin[], year: number, monthIndex: number): number {
    const mm = String(monthIndex + 1).padStart(2, "0");
    const prefix = `${year}-${mm}`;
    return termine.filter((t) => t.datum.startsWith(prefix)).length;
}

function countTermineInYear(termine: Termin[], year: number): number {
    const prefix = `${year}-`;
    return termine.filter((t) => t.datum.startsWith(prefix)).length;
}

export function TerminePage() {
    const t = useT();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [termine, setTermine] = useState<Termin[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notfallConfirmOpen, setNotfallConfirmOpen] = useState(false);
    const notfallTitleId = useId();
    const [view, setView] = useState<"tag" | "woche" | "monat">("monat");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [filterArt, setFilterArt] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [quickSearch, setQuickSearch] = useState("");
    const [quickPickerMode, setQuickPickerMode] = useState<"month" | "year">("month");
    const [quickAnchorDate, setQuickAnchorDate] = useState<Date>(new Date());
    const goNeuerTermin = useCallback((opts?: { datum?: string; patient_id?: string; art?: string; id?: string }) => {
        const p = new URLSearchParams();
        if (opts?.id) p.set("id", opts.id);
        if (opts?.datum) p.set("datum", opts.datum);
        if (opts?.patient_id) p.set("patient_id", opts.patient_id);
        if (opts?.art) p.set("art", opts.art);
        const q = p.toString();
        navigate(q ? `/termine/neu?${q}` : "/termine/neu");
    }, [navigate]);
    const toast = useToastStore((s) => s.add);
    const sidepanelRef = useRef<HTMLElement | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [t, p] = await Promise.all([listTermine(), listPatienten()]);
            setTermine(t);
            setPatienten(p);
        } catch (e) {
            setLoadError(errorMessage(e));
            setTermine([]);
            setPatienten([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const isTypingTarget = (el: EventTarget | null) => {
            if (!(el instanceof HTMLElement)) return false;
            const tag = el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (el.isContentEditable) return true;
            return Boolean(el.closest("[role=\"dialog\"]"));
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey || e.metaKey || e.ctrlKey) return;
            if (isTypingTarget(e.target)) return;
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (k === "d") {
                e.preventDefault();
                setView("tag");
            } else if (k === "w") {
                e.preventDefault();
                setView("woche");
            } else if (k === "m") {
                e.preventDefault();
                setView("monat");
            } else if (k === "h") {
                e.preventDefault();
                setDayOffset(0);
                setWeekOffset(0);
                setMonthOffset(0);
                setQuickAnchorDate(new Date());
                toast("Heute angezeigt.");
            } else if (k === "n" && view === "monat") {
                e.preventDefault();
                setMonthOffset((o) => o + 1);
            } else if (k === "p" && view === "monat") {
                e.preventDefault();
                setMonthOffset((o) => o - 1);
            }
        };
        const onKeyNav = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft" || (!e.ctrlKey && !e.altKey)) return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            if (view === "monat") setMonthOffset((o) => o - 1);
            else if (view === "woche") setWeekOffset((w) => w - 1);
            else setDayOffset((d) => d - 1);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("keydown", onKeyNav);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keydown", onKeyNav);
        };
    }, [view, toast]);

    const handleDelete = async () => {
        if (!deleteId) return;
        await deleteTermin(deleteId);
        toast("Termin gelöscht");
        setDeleteId(null);
        load();
    };

    const handleStornieren = async (id: string) => {
        try {
            await updateTermin(id, { status: "ABGESAGT" });
            toast("Termin storniert");
            await load();
        } catch (e) {
            toast(errorMessage(e));
        }
    };

    const patientNameById = useMemo(
        () => new Map(patienten.map((p) => [p.id, p.name])),
        [patienten],
    );

    const patientById = useMemo(
        () => new Map(patienten.map((p) => [p.id, p])),
        [patienten],
    );

    const displayTermine = useMemo(() => {
        const q = quickSearch.trim().toLowerCase();
        return termine.filter((t) => {
            if (filterArt && t.art !== filterArt) return false;
            if (filterStatus && t.status !== filterStatus) return false;
            if (q) {
                const hay = `${patientNameById.get(t.patient_id) ?? ""} ${t.art} ${t.status} ${t.datum} ${t.uhrzeit}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [termine, filterArt, filterStatus, quickSearch, patientNameById]);

    const selectedDayDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
    const selectedDayIso = format(selectedDayDate, "yyyy-MM-dd");

    useEffect(() => {
        const patientId = searchParams.get("patient_id");
        const openNew = searchParams.get("new");
        if (patientId && openNew === "1") {
            goNeuerTermin({ patient_id: patientId, datum: selectedDayIso });
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.delete("patient_id");
                p.delete("new");
                return p;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams, goNeuerTermin, selectedDayIso]);

    const tagTermine = useMemo(
        () => displayTermine.filter((t) => t.datum === selectedDayIso),
        [displayTermine, selectedDayIso],
    );

    const tagViewHasActiveFilters = useMemo(
        () => Boolean(quickSearch.trim() || filterArt || filterStatus),
        [quickSearch, filterArt, filterStatus],
    );
    const tagViewEmptyDescription = useMemo(() => {
        const dateStr = format(selectedDayDate, "EEEE, d. MMMM yyyy", { locale: de });
        if (termine.length === 0) {
            return "Es sind noch keine Termine im System. Legen Sie den ersten Termin an oder wechseln Sie mit den Pfeilen den Tag.";
        }
        if (tagViewHasActiveFilters) {
            return `Am ${dateStr} können Termine vorhanden sein, die durch die aktiven Schnellfilter ausgeblendet werden. Filter anpassen oder zurücksetzen.`;
        }
        return `Am ${dateStr} ist kein Termin eingetragen. Legen Sie einen Termin an oder wechseln Sie mit den Pfeilen in der Tagesansicht den Tag.`;
    }, [selectedDayDate, tagViewHasActiveFilters, termine.length]);

    const resetFilters = () => {
        setFilterArt("");
        setFilterStatus("");
        setQuickSearch("");
    };

    const periodLabel = useMemo(() => {
        if (view === "tag") return format(selectedDayDate, "EEEE, d. MMMM yyyy", { locale: de });
        if (view === "woche") {
            const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const end = addDays(start, 6);
            return `${format(start, "d. MMM", { locale: de })} – ${format(end, "d. MMM yyyy", { locale: de })}`;
        }
        return format(addMonths(new Date(), monthOffset), "MMMM yyyy", { locale: de });
    }, [view, weekOffset, monthOffset, selectedDayDate]);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="animate-fade-in schedule-page">
            <div className="page-head schedule-header">
                <div>
                    <h1 className="page-title">Terminübersicht</h1>
                    <div className="page-sub">
                        {periodLabel} · {displayTermine.length} Termine geplant
                    </div>
                </div>
                <div className="schedule-toolbar">
                    <div className="seg schedule-view-seg">
                        <button type="button" aria-pressed={view === "tag"} onClick={() => setView("tag")}>Tag</button>
                        <button type="button" aria-pressed={view === "woche"} onClick={() => setView("woche")}>Woche</button>
                        <button type="button" aria-pressed={view === "monat"} onClick={() => setView("monat")}>Monat</button>
                    </div>
                    <div className="schedule-quick-actions">
                        <span className="schedule-kbd-hint" title={t("termin.keyboard.hint")} style={{ fontSize: 11, color: "var(--fg-4)", alignSelf: "center", maxWidth: 200 }}>
                            {t("termin.keyboard.hint")}
                        </span>
                        <button type="button" className="btn btn-subtle" onClick={() => navigate("/verwaltung/praxisplanung")}>
                            Arbeitszeiten & Präferenzen
                        </button>
                        <button type="button" className="btn btn-danger" onClick={() => setNotfallConfirmOpen(true)}>
                            <AmbulanceIcon size={18} aria-hidden />
                            Notfall-Termin
                        </button>
                        <button
                            type="button"
                            className="btn btn-subtle"
                            onClick={() => sidepanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        >
                            <FilterIcon size={14} />
                            Filter
                        </button>
                    </div>
                    <button type="button" className="btn btn-accent schedule-primary-action" onClick={() => goNeuerTermin({ datum: selectedDayIso })}><PlusIcon />Neuer Termin</button>
                </div>
            </div>

            <div className="schedule-workspace">
                <aside ref={sidepanelRef} className="card schedule-sidepanel card-pad">
                    <div className="schedule-sidepanel-title">Schnellfilter</div>
                    <div className="schedule-sidepanel-sub">Arzt, Art und Status auf einen Blick.</div>
                    <Input
                        id="quick-search"
                        className="schedule-search-input"
                        placeholder="Termin suchen…"
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                    />
                    <div className="schedule-sidepanel-grid">
                        <Select
                            id="flt-art-side"
                            label="Art"
                            value={filterArt}
                            onChange={(e) => setFilterArt(e.target.value)}
                            options={ART_FILTER_OPTIONS}
                        />
                        <Select
                            id="flt-st-side"
                            label="Status"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            options={STATUS_FILTER_OPTIONS}
                        />
                    </div>
                    <QuickCalendarPicker
                        mode={quickPickerMode}
                        setMode={setQuickPickerMode}
                        anchor={quickAnchorDate}
                        setAnchor={setQuickAnchorDate}
                        termine={termine}
                        onNavError={() => toast(t("calendar.nav_error"), "error")}
                        onJumpMonth={(date) => {
                            const now = new Date();
                            const targetOffset = (date.getFullYear() - now.getFullYear()) * 12 + (date.getMonth() - now.getMonth());
                            setMonthOffset(targetOffset);
                            setView("monat");
                        }}
                    />
                    {(quickSearch.trim().length > 0 || filterArt || filterStatus) ? (
                        <button type="button" className="btn btn-ghost schedule-reset-btn" onClick={resetFilters}>Filter zurücksetzen</button>
                    ) : null}
                </aside>
                <div className="schedule-main">
                    {loading ? (
                        <PageLoading label="Termine werden geladen…" />
                    ) : loadError ? (
                        <PageLoadError message={loadError} onRetry={() => void load()} />
                    ) : view === "tag" ? (
                        <DayTimeline
                            dayDate={selectedDayDate}
                            onDayChange={(delta) => setDayOffset((d) => d + delta)}
                            termine={tagTermine}
                            patientById={patientById}
                            onDelete={(id) => setDeleteId(id)}
                            onStornieren={(id) => void handleStornieren(id)}
                            onBearbeiten={(id) => goNeuerTermin({ id })}
                            onMitteilen={(id) => {
                                const t = displayTermine.find((x) => x.id === id);
                                const name = t ? (patientById.get(t.patient_id)?.name ?? "Patient") : "Patient";
                                toast(`Erinnerung an ${name} vorbereitet (Versand folgt mit TI-Konnektor).`);
                            }}
                            emptyDescription={tagViewEmptyDescription}
                            emptyHasFilters={tagViewHasActiveFilters}
                            onEmptyCreate={() => goNeuerTermin({ datum: selectedDayIso })}
                            onEmptyResetFilters={tagViewHasActiveFilters ? resetFilters : undefined}
                        />
                    ) : termine.length === 0 ? (
                        <EmptyState icon="📅" title="Keine Termine vorhanden" description="Erstellen Sie einen neuen Termin." />
                    ) : displayTermine.length === 0 ? (
                        <div className="card">
                            <EmptyState icon="🔍" title="Keine Treffer für diese Filter" description="Filter anpassen oder zurücksetzen." />
                            <div style={{ textAlign: "center", paddingBottom: 24 }}>
                                <button type="button" className="btn btn-accent" onClick={resetFilters}>Filter zurücksetzen</button>
                            </div>
                        </div>
                    ) : view === "monat" ? (
                        <MonthCalendar
                            monthOffset={monthOffset}
                            onMonthChange={setMonthOffset}
                            termine={displayTermine}
                            patientNameById={patientNameById}
                            onCreate={(date, apptCount) => {
                                if (apptCount === 0) toast("Keine Termine an diesem Tag.");
                                goNeuerTermin({ datum: date });
                            }}
                        />
                    ) : (
                        <WeekCalendar
                            termine={displayTermine}
                            weekOffset={weekOffset}
                            onWeekChange={setWeekOffset}
                            patientNameById={patientNameById}
                            onPickDay={(iso) => goNeuerTermin({ datum: iso })}
                        />
                    )}
                </div>
            </div>

            <Dialog
                open={notfallConfirmOpen}
                onClose={() => setNotfallConfirmOpen(false)}
                title=""
                presentation="centered"
                className="notfall-confirm-dialog"
                labelledBy={notfallTitleId}
                footer={
                    <>
                        <button type="button" onClick={() => setNotfallConfirmOpen(false)}>Abbrechen</button>
                        <button
                            type="button"
                            className="destructive"
                            onClick={() => {
                                goNeuerTermin({ datum: selectedDayIso, art: "NOTFALL" });
                                setNotfallConfirmOpen(false);
                            }}
                        >
                            Notfall einplanen
                        </button>
                    </>
                }
            >
                <div className="modal-body">
                    <div className="confirm-icon" aria-hidden="true">
                        <AmbulanceIcon />
                    </div>
                    <h3 id={notfallTitleId}>{NOTFALL_CONFIRM_TITLE}</h3>
                    <p>{NOTFALL_CONFIRM_MESSAGE}</p>
                </div>
            </Dialog>

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Termin löschen"
                message="Möchten Sie diesen Termin wirklich löschen?"
                confirmLabel="Löschen"
                danger
            />
        </div>
    );
}

function QuickCalendarPicker({
    mode,
    setMode,
    anchor,
    setAnchor,
    onJumpMonth,
    termine,
    onNavError,
}: {
    mode: "month" | "year";
    setMode: Dispatch<SetStateAction<"month" | "year">>;
    anchor: Date;
    setAnchor: Dispatch<SetStateAction<Date>>;
    onJumpMonth: (date: Date) => void;
    termine: Termin[];
    onNavError: () => void;
}) {
    const today = new Date();
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const yearStart = Math.floor(y / 12) * 12;
    const monthLabels = Array.from({ length: 12 }, (_, idx) => format(new Date(2020, idx, 1), "LLL", { locale: de }));
    const isAtCurrentMonthYear = y === today.getFullYear() && m === today.getMonth();
    const resetToToday = () => {
        try {
            setAnchor(today);
            setMode("month");
            onJumpMonth(today);
        } catch {
            onNavError();
        }
    };

    return (
        <div className="quick-calendar">
            <div className="quick-calendar-nav">
                <button
                    type="button"
                    className="icon-btn"
                    aria-label="Vorheriger Zeitraum"
                    onClick={() => {
                        try {
                            if (mode === "month") setAnchor((d) => new Date(d.getFullYear() - 1, d.getMonth(), 1));
                            else setAnchor((d) => new Date(d.getFullYear() - 12, d.getMonth(), 1));
                        } catch {
                            onNavError();
                        }
                    }}
                >
                    <ChevronLeftIcon size={16} />
                </button>
                <button
                    type="button"
                    className={`quick-calendar-mode ${mode === "month" ? "active" : ""}`}
                    onClick={() => {
                        setMode("month");
                        onJumpMonth(anchor);
                    }}
                >
                    Monat
                </button>
                <button type="button" className={`quick-calendar-mode ${mode === "year" ? "active" : ""}`} onClick={() => setMode("year")}>Jahr</button>
                <button
                    type="button"
                    className="icon-btn"
                    aria-label="Nächster Zeitraum"
                    onClick={() => {
                        try {
                            if (mode === "month") setAnchor((d) => new Date(d.getFullYear() + 1, d.getMonth(), 1));
                            else setAnchor((d) => new Date(d.getFullYear() + 12, d.getMonth(), 1));
                        } catch {
                            onNavError();
                        }
                    }}
                >
                    <ChevronRightIcon size={16} />
                </button>
            </div>
            {mode === "month" ? (
                <div className="quick-grid-3">
                    {monthLabels.map((label, idx) => {
                        const cnt = countTermineInMonth(termine, y, idx);
                        const empty = cnt === 0;
                        return (
                        <button
                            key={label}
                            type="button"
                            className={`quick-grid-item ${idx === m ? "active" : ""} ${empty ? "is-empty" : ""}`}
                            onClick={() => {
                                try {
                                    const next = new Date(y, idx, 1);
                                    setAnchor(next);
                                    onJumpMonth(next);
                                } catch {
                                    onNavError();
                                }
                            }}
                        >
                            {label}
                        </button>
                    );})}
                </div>
            ) : (
                <div className="quick-grid-3">
                    {Array.from({ length: 12 }).map((_, idx) => {
                        const year = yearStart + idx;
                        const cnt = countTermineInYear(termine, year);
                        const empty = cnt === 0;
                        return (
                            <button
                                key={year}
                                type="button"
                                className={`quick-grid-item ${year === y ? "active" : ""} ${empty ? "is-empty" : ""}`}
                                onClick={() => {
                                    try {
                                        setAnchor(new Date(year, m, 1));
                                        setMode("month");
                                    } catch {
                                        onNavError();
                                    }
                                }}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            )}
            {!isAtCurrentMonthYear ? (
                <button type="button" className="btn btn-subtle quick-calendar-reset" onClick={resetToToday}>
                    Heute (Monat & Jahr)
                </button>
            ) : null}
        </div>
    );
}

function WeekCalendar({
    termine,
    weekOffset,
    onWeekChange,
    onPickDay,
    patientNameById,
}: {
    termine: Termin[];
    weekOffset: number;
    onWeekChange: Dispatch<SetStateAction<number>>;
    onPickDay: (iso: string) => void;
    patientNameById: Map<string, string>;
}) {
    const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const slots = useMemo(() => {
        const result: string[] = [];
        for (let h = 8; h <= 17; h += 1) {
            result.push(`${String(h).padStart(2, "0")}:00`);
            result.push(`${String(h).padStart(2, "0")}:30`);
        }
        return result;
    }, []);
    const byDate = termine.reduce<Record<string, Termin[]>>((acc, t) => {
        (acc[t.datum] ||= []).push(t);
        return acc;
    }, {});
    return (
        <div className="card card-pad">
            <div className="row" style={{ marginBottom: 14, justifyContent: "space-between", alignItems: "center" }}>
                <button type="button" className="btn btn-subtle" onClick={() => onWeekChange((w) => w - 1)} aria-label="Vorherige Woche">
                    <ChevronLeftIcon size={16} />
                </button>
                <span style={{ fontWeight: 600 }}>
                    Woche · {format(days[0], "d. MMM", { locale: de })} – {format(days[6], "d. MMM yyyy", { locale: de })}
                </span>
                <button type="button" className="btn btn-subtle" onClick={() => onWeekChange((w) => w + 1)} aria-label="Nächste Woche">
                    <ChevronRightIcon size={16} />
                </button>
            </div>
            <div className="week-board-head">
                <button type="button" className="icon-btn" aria-label="Vorherige Woche" onClick={() => onWeekChange((w) => w - 1)}><ChevronLeftIcon size={16} /></button>
                <div className="week-board-days">
                    {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const isToday = iso === format(new Date(), "yyyy-MM-dd");
                        const weekday = format(d, "EEE", { locale: de });
                        return (
                            <button
                                key={iso}
                                type="button"
                                className={`week-board-day ${isToday ? "today" : ""}`}
                                aria-label={`${format(d, "EEEE d. MMMM", { locale: de })}`}
                                onClick={() => onPickDay(iso)}
                            >
                                <span className="week-board-day-week">{weekday}</span>
                                <span className="week-board-day-num">{format(d, "d", { locale: de })}</span>
                            </button>
                        );
                    })}
                </div>
                <button type="button" className="icon-btn" aria-label="Nächste Woche" onClick={() => onWeekChange((w) => w + 1)}><ChevronRightIcon size={16} /></button>
            </div>
            <div className="week-board-scroll">
                <div className="week-board-grid">
                    {slots.map((slot) => (
                        <div key={slot} className="week-board-row">
                            <div className="day-timeline-time">{slot}</div>
                            {days.map((d) => {
                                const iso = format(d, "yyyy-MM-dd");
                                const events = (byDate[iso] ?? []).filter((ev) => ev.uhrzeit.slice(0, 5) === slot);
                                return (
                                    <div key={`${iso}-${slot}`} className="week-board-cell">
                                        {events.map((ev) => {
                                            const name = patientNameById.get(ev.patient_id) ?? "Patient";
                                            const detail = `${terminArtLabel(ev.art)} · ${ev.uhrzeit.slice(0, 5)}`;
                                            return (
                                                <div
                                                    key={ev.id}
                                                    className={`cal-evt ${EVENT_TONE_BY_ART[ev.art] ?? "blue"} week-event-pill`}
                                                    title={`${name} — ${detail}`}
                                                >
                                                    {name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                            <div />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function DayTimeline({
    dayDate,
    onDayChange,
    termine,
    patientById,
    onDelete,
    onStornieren,
    onBearbeiten,
    onMitteilen,
    emptyDescription,
    emptyHasFilters,
    onEmptyCreate,
    onEmptyResetFilters,
}: {
    dayDate: Date;
    onDayChange: (delta: number) => void;
    termine: Termin[];
    patientById: Map<string, Patient>;
    onDelete: (id: string) => void;
    onStornieren: (id: string) => void;
    onBearbeiten: (id: string) => void;
    onMitteilen: (id: string) => void;
    emptyDescription: string;
    emptyHasFilters: boolean;
    onEmptyCreate: () => void;
    onEmptyResetFilters?: () => void;
}) {
    const [menuId, setMenuId] = useState<string | null>(null);
    const sorted = useMemo(
        () => [...termine].sort((a, b) => (a.uhrzeit ?? "").localeCompare(b.uhrzeit ?? "", "de")),
        [termine],
    );

    useEffect(() => {
        if (!menuId) return undefined;
        const onPointerDown = (e: PointerEvent) => {
            const el = e.target as HTMLElement | null;
            if (!el?.closest?.(`[data-appt-menu-root="${menuId}"]`)) setMenuId(null);
        };
        document.addEventListener("pointerdown", onPointerDown, true);
        return () => document.removeEventListener("pointerdown", onPointerDown, true);
    }, [menuId]);

    return (
        <div className="card schedule-day-view-card dashboard-card-fill">
            <div className="card-head schedule-day-view-head">
                <button type="button" className="icon-btn" aria-label="Vorheriger Tag" onClick={() => onDayChange(-1)}>
                    <ChevronLeftIcon size={18} />
                </button>
                <div className="schedule-day-view-titles">
                    <div className="card-title">{format(dayDate, "EEEE", { locale: de })}</div>
                    <div className="card-sub">{format(dayDate, "d. MMMM yyyy", { locale: de })}</div>
                </div>
                <span className="pill blue">{sorted.length} Termine</span>
                <button type="button" className="icon-btn" aria-label="Nächster Tag" onClick={() => onDayChange(1)}>
                    <ChevronRightIcon size={18} />
                </button>
            </div>
            <div className="dashboard-card-list schedule-day-pill-list schedule-day-list">
                {sorted.length === 0 ? (
                    <div className="schedule-day-empty-inline">
                        <EmptyState
                            graphic={(
                                <span className="empty-state-icon-calendar" aria-hidden>
                                    <CalendarIcon size={34} />
                                </span>
                            )}
                            title="Keine Termine an diesem Tag"
                            description={emptyDescription}
                        />
                        <div className="schedule-day-empty-actions">
                            <Button type="button" onClick={onEmptyCreate}>Termin anlegen</Button>
                            {emptyHasFilters && onEmptyResetFilters ? (
                                <Button type="button" variant="ghost" onClick={onEmptyResetFilters}>Filter zurücksetzen</Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                {sorted.map((entry) => {
                    const patient = patientById.get(entry.patient_id);
                    const name = patient?.name ?? "Unbekannter Patient";
                    const alter = patientAlterJahre(patient, dayDate);
                    const state = appointmentStateDisplay(entry);
                    const storniert = entry.status === "ABGESAGT" || entry.status === "NICHT_ERSCHIENEN";
                    const timeLabel = entry.uhrzeit?.slice(0, 5) ?? "—:—";
                    const besch = entry.beschwerden?.trim() ?? "";
                    const artLabel = terminArtLabel(entry.art);
                    const beschShort = besch
                        ? `${besch.slice(0, 44)}${besch.length > 44 ? "…" : ""}`
                        : "";
                    const metaLine = besch
                        ? `${beschShort} · ${artLabel}${alter != null ? ` · ${alter} J.` : ""}`
                        : `${artLabel}${alter != null ? ` · ${alter} J.` : ""}`;
                    const sev = severityForTermin(entry);
                    const artTone = EVENT_TONE_BY_ART[entry.art] ?? "blue";
                    return (
                        <div key={entry.id} className="schedule-day-pill-slot" data-appt-menu-root={entry.id}>
                            <div
                                className={`day-appt-list-row day-appt-list-row--art-${artTone}`}
                                title={`${timeLabel} · ${artLabel} · ${severityDe(sev)}`}
                            >
                                <div className="day-appt-list-time">
                                    <span className="day-appt-list-time-start">{timeLabel}</span>
                                    <span className="day-appt-list-time-dur">45 min</span>
                                </div>
                                <div className={`day-appt-strip day-appt-strip--${artTone}`} aria-hidden />
                                <div className="day-appt-list-main">
                                    <div className="day-appt-list-name">{name}</div>
                                    <div className="day-appt-list-meta">{metaLine}</div>
                                </div>
                                <div className="day-appt-list-aside">
                                    <div className="day-appt-list-badges">
                                        <span className={`pill day-appt-severity-pill ${severitySoftPillClass(sev)}`}>{severityDe(sev)}</span>
                                        <span className={`pill day-appt-list-status ${stateSoftPillClass(entry)}`}>{state.label}</span>
                                    </div>
                                    <div className="day-appt-pill-actions">
                                        <button
                                            type="button"
                                            className="icon-btn day-appt-pill-more"
                                            aria-expanded={menuId === entry.id}
                                            aria-haspopup="menu"
                                            aria-label={`Aktionen für ${name}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMenuId((v) => (v === entry.id ? null : entry.id));
                                            }}
                                        >
                                            <MoreIcon size={16} />
                                        </button>
                                        {menuId === entry.id ? (
                                            <div className="day-appt-pill-menu" role="menu">
                                                <button type="button" role="menuitem" onClick={() => { onBearbeiten(entry.id); setMenuId(null); }}>Bearbeiten</button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    disabled={storniert}
                                                    onClick={() => {
                                                        onStornieren(entry.id);
                                                        setMenuId(null);
                                                    }}
                                                >
                                                    Stornieren
                                                </button>
                                                <button type="button" role="menuitem" onClick={() => { onMitteilen(entry.id); setMenuId(null); }}>Mitteilen</button>
                                                <button
                                                    type="button"
                                                    role="menuitem"
                                                    className="attention-hover"
                                                    onClick={() => {
                                                        onDelete(entry.id);
                                                        setMenuId(null);
                                                    }}
                                                >
                                                    Löschen
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MonthCalendar({
    monthOffset,
    onMonthChange,
    termine,
    patientNameById,
    onCreate,
}: {
    monthOffset: number;
    onMonthChange: Dispatch<SetStateAction<number>>;
    termine: Termin[];
    patientNameById: Map<string, string>;
    onCreate: (date: string, appointmentCount: number) => void;
}) {
    const anchor = addMonths(new Date(), monthOffset);
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const total = 42;
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const byDate = termine.reduce<Record<string, Termin[]>>((acc, t) => {
        (acc[t.datum] ||= []).push(t);
        return acc;
    }, {});
    return (
        <div className="card card-pad">
            <div className="month-view-topbar">
                <div className="row month-view-period" style={{ gap: 8, fontWeight: 600, alignItems: "center" }}>
                    <button type="button" className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onMonthChange((o) => o - 1)}><ChevronLeftIcon size={16} /></button>
                    <span className="month-view-period-label">{format(first, "MMMM yyyy", { locale: de })}</span>
                    <button type="button" className="icon-btn" aria-label="Nächster Monat" onClick={() => onMonthChange((o) => o + 1)}><ChevronRightIcon size={16} /></button>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => onMonthChange(0)}>Heute</button>
                <div className="row" style={{ gap: 6, color: "var(--fg-3)", fontSize: 12 }}>
                    <span className="pill blue">Kontrolle</span>
                    <span className="pill accent">Behandlung</span>
                    <span className="pill orange">Notfall</span>
                    <span className="pill purple">Beratung</span>
                </div>
            </div>
            <div className="cal">
                {["MO", "DI", "MI", "DO", "FR", "SA", "SO"].map((d) => <div className="cal-head" key={d}>{d}</div>)}
                {Array.from({ length: total }).map((_, idx) => {
                    const day = idx - startOffset + 1;
                    const inMonth = day > 0 && day <= daysInMonth;
                    const date = new Date(y, m, day);
                    const iso = format(date, "yyyy-MM-dd");
                    const events = byDate[iso] ?? [];
                    const isToday = iso === todayIso;
                    return (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            className={`cal-cell ${inMonth ? "" : "dim"} ${isToday ? "today" : ""}`}
                            onClick={() => onCreate(iso, events.length)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onCreate(iso, events.length);
                                }
                            }}
                        >
                            <div className="cal-num">{date.getDate()}</div>
                            {events.length === 0 ? null : isToday ? (
                                <>
                                    {events.slice(0, 2).map((ev) => (
                                        <div key={ev.id} className={`cal-evt ${EVENT_TONE_BY_ART[ev.art] ?? "blue"}`}>
                                            {(patientNameById.get(ev.patient_id) ?? "Patient")} {ev.uhrzeit.slice(0, 5)}
                                        </div>
                                    ))}
                                    {events.length > 2 ? <div className="cal-evt grey">+{events.length - 2} weitere</div> : null}
                                </>
                            ) : (
                                <div className={`cal-evt ${events.length >= 8 ? "orange" : events.length >= 5 ? "blue" : "green"}`}>
                                    {events.length} Termine
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
