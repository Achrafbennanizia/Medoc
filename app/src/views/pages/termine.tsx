import { type CSSProperties, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import {
    addDays,
    addMonths,
    addWeeks,
    differenceInCalendarDays,
    format,
    getISOWeek,
    parseISO,
    startOfWeek,
} from "date-fns";
import { de } from "date-fns/locale";
import { listTermine, deleteTermin, updateTermin } from "../../controllers/termin.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { listAerzte, type AerztSummary } from "../../controllers/personal.controller";
import { errorMessage } from "../../lib/utils";
import { MEDOC_PENDING_TERMIN_MENU_KEY } from "@/lib/native-go-menu";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
} from "@/lib/client-settings";
import type { Termin, Patient } from "../../models/types";
import { Button } from "../components/ui/button";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import {
    AmbulanceIcon,
    BoltIcon,
    CalendarIcon,
    CheckIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    EditIcon,
    EyeIcon,
    FilterIcon,
    MailIcon,
    PauseIcon,
    PhoneIcon,
    PlusIcon,
    SearchIcon,
    ShieldCheckIcon,
    XIcon,
} from "@/lib/icons";

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

const EVENT_TONE_BY_ART: Record<string, "blue" | "accent" | "orange" | "purple" | "green"> = {
    KONTROLLE: "green",
    BEHANDLUNG: "accent",
    NOTFALL: "orange",
    BERATUNG: "purple",
};

type BlockTone = "green" | "blue" | "accent" | "orange" | "purple";

const DOCTOR_TONE_CYCLE = ["green", "blue", "purple", "accent"] as const;
type DoctorTone = (typeof DOCTOR_TONE_CYCLE)[number];

const PX_PER_MIN = 1.4;
const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 19 * 60;
const HOUR_PX = 84;
const TERMIN_DEFAULT_DUR_MIN = 45;
/** Tag-Ansicht: Ziehen links/rechts neben dem Raster wechselt das Zieldatum (±1 Tag). */
const DAY_DRAG_EDGE_PX = 40;
/** Tag-Ansicht: linker/rechter Rand innerhalb der Tagesspalte wechselt den Kalendertag */
const DAY_INNER_EDGE_PX = 36;
/** Wochenansicht: Ziehen links/rechts außerhalb des Rasters wechselt die Woche. */
const WEEK_NAV_EDGE_PX = 48;
/** Beim Drag: Kalender-Tag oder Woche höchstens einmal alle 500 ms wechseln (vermeidet “Durchwandern”). */
const DRAG_DATUM_NAV_COOLDOWN_MS = 500;

function useDayTimelineLayout() {
    const hostRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState(() => ({ hourPx: HOUR_PX, pxPerMin: PX_PER_MIN }));
    useLayoutEffect(() => {
        const el = hostRef.current;
        if (!el) return;
        const apply = () => {
            const h = el.clientHeight;
            const slots = (DAY_END_MIN - DAY_START_MIN) / 60;
            if (h < 40) return;
            const hourPx = h / slots;
            setLayout({ hourPx, pxPerMin: hourPx / 60 });
        };
        apply();
        const ro = new ResizeObserver(apply);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return { hostRef, layout };
}

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

/** Kalender-Karte Tag/Woche: Pille wie UI-Referenz („In Behandlung“ für BESTAETIGT). */
function terminCalendarStatusPill(t: Termin): { label: string; tone: "active" | "planned" | "done" | "cancel" | "edit" } {
    if (t.status === "ABGESAGT" || t.status === "NICHT_ERSCHIENEN") {
        return { label: "Abgesagt", tone: "cancel" };
    }
    if (t.status === "DURCHGEFUEHRT") {
        return { label: "Erledigt", tone: "done" };
    }
    const editedMs = new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
    if (editedMs > 60_000 && (t.status === "GEPLANT" || t.status === "BESTAETIGT")) {
        return { label: "Geändert", tone: "edit" };
    }
    if (t.status === "BESTAETIGT") {
        return { label: "In Behandlung", tone: "active" };
    }
    return { label: "Geplant", tone: "planned" };
}

function uhrzeitToMinutes(u: string): number {
    const p = u.slice(0, 5).split(":");
    const h = Number(p[0]);
    const m = Number(p[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) return DAY_START_MIN;
    return h * 60 + m;
}

function minutesToUhrzeit(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildArztToneMap(aerzte: AerztSummary[]): Map<string, DoctorTone> {
    const m = new Map<string, DoctorTone>();
    aerzte.forEach((a, i) => m.set(a.id, DOCTOR_TONE_CYCLE[i % DOCTOR_TONE_CYCLE.length]!));
    return m;
}

function blockToneForTermin(art: string, doctorTone: DoctorTone): BlockTone {
    const fromArt = EVENT_TONE_BY_ART[art];
    if (fromArt) return fromArt;
    return doctorTone;
}

function doctorStripeVar(tone: DoctorTone): string {
    if (tone === "green") return "var(--green)";
    if (tone === "blue") return "var(--blue)";
    if (tone === "purple") return "var(--purple)";
    return "var(--accent)";
}

function terminCountsAsPlanned(t: Termin): boolean {
    return t.status !== "ABGESAGT" && t.status !== "NICHT_ERSCHIENEN";
}

/**
 * Gleicher Kalendertag + gleicher Behandler: nach dem Verschieben geplante Termine so
 * nach hinten schieben, dass sich Zeiten nicht überschneiden (einheitliche Slot-Dauer).
 */
function computePackedUpdatesAfterMove(
    all: Termin[],
    movingId: string,
    targetDatum: string,
    desiredStartMin: number,
    slotDur: number,
): { updates: { id: string; data: Record<string, unknown> }[]; error?: string } {
    const moving = all.find((t) => t.id === movingId);
    if (!moving) return { updates: [] };

    const arztId = moving.arzt_id;
    const step = 5;
    let start = Math.round(desiredStartMin / step) * step;
    start = Math.max(DAY_START_MIN, Math.min(start, DAY_END_MIN - slotDur));

    type Bl = { id: string; start: number };
    const blocks: Bl[] = all
        .filter(
            (t) =>
                t.datum === targetDatum &&
                t.arzt_id === arztId &&
                terminCountsAsPlanned(t) &&
                t.id !== movingId,
        )
        .map((t) => ({ id: t.id, start: uhrzeitToMinutes(t.uhrzeit) }));

    blocks.push({ id: movingId, start });

    const endOf = (s: number) => s + slotDur;

    let guard = 0;
    let changed = true;
    while (changed && guard++ < 80) {
        changed = false;
        blocks.sort((a, b) => a.start - b.start);
        for (let i = 0; i < blocks.length - 1; i++) {
            const endI = endOf(blocks[i]!.start);
            if (endI > blocks[i + 1]!.start) {
                let ns = endI;
                ns = Math.ceil(ns / step) * step;
                if (ns < endI) ns += step;
                blocks[i + 1]!.start = ns;
                changed = true;
            }
        }
    }

    for (const b of blocks) {
        if (b.start + slotDur > DAY_END_MIN) {
            return {
                updates: [],
                error: "Am Tagesende ist kein freier Platz ohne Überschneidung.",
            };
        }
    }

    const updates: { id: string; data: Record<string, unknown> }[] = [];
    for (const b of blocks) {
        const t = all.find((x) => x.id === b.id);
        if (!t) continue;
        const newU = minutesToUhrzeit(b.start);
        const uCmp = t.uhrzeit.slice(0, 5);
        const newUCmp = newU.slice(0, 5);
        if (b.id === movingId) {
            if (t.datum !== targetDatum || uCmp !== newUCmp) {
                updates.push({ id: b.id, data: { datum: targetDatum, uhrzeit: newU } });
            }
        } else if (uCmp !== newUCmp) {
            updates.push({ id: b.id, data: { uhrzeit: newU } });
        }
    }

    return { updates };
}

/** Month index offset from the current wall-clock month (for mini + month pickers). */
function calendarMonthOffsetFromToday(d: Date): number {
    const now = new Date();
    return (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth());
}

export function TerminePage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [termine, setTermine] = useState<Termin[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notfallConfirmOpen, setNotfallConfirmOpen] = useState(false);
    const notfallTitleId = useId();
    const terminFilterArtSelectId = useId();
    const terminFilterStatusSelectId = useId();
    const [view, setView] = useState<"tag" | "woche" | "monat">(() => {
        const v = loadClientSettings().workflows?.termineDefaultView;
        if (v === "tag" || v === "woche" || v === "monat") return v;
        return "woche";
    });
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [filterArt, setFilterArt] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterArztIds, setFilterArztIds] = useState<string[]>([]);
    const [quickSearch, setQuickSearch] = useState("");
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
    const filterPopoverWrapRef = useRef<HTMLDivElement | null>(null);
    const filterPopoverPanelRef = useRef<HTMLDivElement | null>(null);
    const [filterPopoverFixed, setFilterPopoverFixed] = useState<null | { top: number; left: number; width: number }>(
        null,
    );
    const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
    const pauseTitleId = useId();
    const [drawerTermin, setDrawerTermin] = useState<Termin | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; termin: Termin } | null>(null);
    const [dragState, setDragState] = useState<null | {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    }>(null);
    /** Tagesansicht: zuletzt per Drag gewählte Uhrzeit an der Stundenleiste (bleibt bis neue Interaktion). */
    const [terminDaySnapLabel, setTerminDaySnapLabel] = useState<null | { iso: string; startMin: number }>(null);
    const dragStateRef = useRef(dragState);
    useLayoutEffect(() => {
        dragStateRef.current = dragState;
    }, [dragState]);
    /** Letzter Wechsel von `currentDatum` per Drag (Tagsspalte, Rand, Woche ±1). */
    const lastDragDatumNavAtRef = useRef(0);
    const goNeuerTermin = useCallback((opts?: { datum?: string; patient_id?: string; art?: string; id?: string; uhrzeit?: string }) => {
        const p = new URLSearchParams();
        if (opts?.id) p.set("id", opts.id);
        if (opts?.datum) p.set("datum", opts.datum);
        if (opts?.patient_id) p.set("patient_id", opts.patient_id);
        if (opts?.art) p.set("art", opts.art);
        if (opts?.uhrzeit) p.set("uhrzeit", opts.uhrzeit);
        const q = p.toString();
        navigate(q ? `/termine/neu?${q}` : "/termine/neu");
    }, [navigate]);
    const toast = useToastStore((s) => s.add);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [t, p, a] = await Promise.all([listTermine(), listPatienten(), listAerzte()]);
            setTermine(t);
            setPatienten(p);
            setAerzte(a);
        } catch (e) {
            setLoadError(errorMessage(e));
            setTermine([]);
            setPatienten([]);
            setAerzte([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const cur = loadClientSettings();
        const w = cur.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
        if (w.termineDefaultView === view) return;
        saveClientSettings(mergeClientSettingsPatch(cur, { workflows: { ...w, termineDefaultView: view } }));
    }, [view]);

    const handleDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;
        await deleteTermin(id);
        toast("Termin gelöscht");
        setDeleteId(null);
        setDrawerTermin((d) => (d?.id === id ? null : d));
        void load();
    };

    const handleStornieren = async (id: string) => {
        try {
            await updateTermin(id, { status: "ABGESAGT" });
            toast("Termin storniert");
            setDrawerTermin((d) => (d?.id === id ? null : d));
            setCtxMenu(null);
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

    const arztToneMap = useMemo(() => buildArztToneMap(aerzte), [aerzte]);

    const baseFilteredTermine = useMemo(
        () =>
            termine.filter((x) => {
                if (filterArt && x.art !== filterArt) return false;
                if (filterStatus && x.status !== filterStatus) return false;
                if (filterArztIds.length > 0 && !filterArztIds.includes(x.arzt_id)) return false;
                return true;
            }),
        [termine, filterArt, filterStatus, filterArztIds],
    );

    const displayTermine = useMemo(() => {
        const q = quickSearch.trim().toLowerCase();
        if (!q) return baseFilteredTermine;
        return baseFilteredTermine.filter((t) => {
            const hay = `${patientNameById.get(t.patient_id) ?? ""} ${t.art} ${t.status} ${t.datum} ${t.uhrzeit}`
                .toLowerCase();
            return hay.includes(q);
        });
    }, [baseFilteredTermine, quickSearch, patientNameById]);

    const selectedDayDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
    const selectedDayIso = format(selectedDayDate, "yyyy-MM-dd");

    useEffect(() => {
        if (view !== "tag") return;
        setMonthOffset(calendarMonthOffsetFromToday(addDays(new Date(), dayOffset)));
    }, [view, dayOffset]);

    useEffect(() => {
        setTerminDaySnapLabel(null);
    }, [dayOffset, view]);

    useEffect(() => {
        const isTypingTarget = (el: EventTarget | null) => {
            if (!(el instanceof HTMLElement)) return false;
            const tag = el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
            if (el.isContentEditable) return true;
            return Boolean(el.closest("[role=\"dialog\"]"));
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.altKey) return;
            if (isTypingTarget(e.target)) return;
            const cmdOrCtrl = e.metaKey || e.ctrlKey;
            if (cmdOrCtrl && e.shiftKey) return;
            if (cmdOrCtrl && e.key.length !== 1) return;

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
            } else if (k === "t") {
                e.preventDefault();
                setDayOffset(0);
                setWeekOffset(0);
                setMonthOffset(0);
                setView("tag");
                toast("Heute (Tagesansicht).");
            } else if (k === "n") {
                e.preventDefault();
                goNeuerTermin({ datum: selectedDayIso });
            }
        };
        const onKeyNav = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            const dir = e.key === "ArrowLeft" ? -1 : 1;
            if (view === "monat") setMonthOffset((o) => o + dir);
            else if (view === "woche") setWeekOffset((w) => w + dir);
            else setDayOffset((d) => d + dir);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("keydown", onKeyNav);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keydown", onKeyNav);
        };
    }, [view, toast, goNeuerTermin, selectedDayIso]);

    useEffect(() => {
        const q = quickSearch.trim().toLowerCase();
        if (q.length < 2) return;
        const match = baseFilteredTermine.find((term) => {
            const name = (patientNameById.get(term.patient_id) ?? "").toLowerCase();
            const art = terminArtLabel(term.art).toLowerCase();
            return name.includes(q) || art.includes(q);
        });
        if (!match) return;
        const d = parseISO(match.datum);
        const off = differenceInCalendarDays(d, new Date());
        setDayOffset(off);
    }, [quickSearch, baseFilteredTermine, patientNameById]);

    useLayoutEffect(() => {
        if (!filterPopoverOpen) {
            setFilterPopoverFixed(null);
            return undefined;
        }
        const update = () => {
            const anchor = filterPopoverWrapRef.current;
            if (!anchor) return;
            const r = anchor.getBoundingClientRect();
            const width = Math.min(320, window.innerWidth * 0.94);
            const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
            const top = r.bottom + 8;
            setFilterPopoverFixed({ top, left, width });
        };
        update();
        window.addEventListener("resize", update);
        document.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            document.removeEventListener("scroll", update, true);
        };
    }, [filterPopoverOpen]);

    useEffect(() => {
        if (!filterPopoverOpen) return undefined;
        const onDown = (e: MouseEvent) => {
            const t = e.target;
            if (!(t instanceof Node)) return;
            const anchor = filterPopoverWrapRef.current;
            const panel = filterPopoverPanelRef.current;
            if (anchor?.contains(t) || panel?.contains(t)) return;
            setFilterPopoverOpen(false);
        };
        const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener("mousedown", onDown);
        };
    }, [filterPopoverOpen]);

    useEffect(() => {
        if (!filterPopoverOpen) return undefined;
        const onEsc = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            setFilterPopoverOpen(false);
        };
        window.addEventListener("keydown", onEsc);
        return () => window.removeEventListener("keydown", onEsc);
    }, [filterPopoverOpen]);

    useEffect(() => {
        if (!ctxMenu) return undefined;
        const onDown = (e: MouseEvent) => {
            const t = e.target as HTMLElement | null;
            if (t?.closest?.(".termin-ctx-menu")) return;
            setCtxMenu(null);
        };
        const onEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setCtxMenu(null);
        };
        setTimeout(() => document.addEventListener("mousedown", onDown), 0);
        window.addEventListener("keydown", onEsc);
        return () => {
            document.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onEsc);
        };
    }, [ctxMenu]);

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
        () =>
            displayTermine.filter(
                (t) =>
                    t.datum === selectedDayIso ||
                    (view === "tag" && dragState != null && dragState.id === t.id),
            ),
        [displayTermine, selectedDayIso, view, dragState],
    );

    const tagViewHasActiveFilters = useMemo(
        () => Boolean(quickSearch.trim() || filterArt || filterStatus || filterArztIds.length > 0),
        [quickSearch, filterArt, filterStatus, filterArztIds],
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
        setFilterArztIds([]);
        setQuickSearch("");
    };

    const headlineAnchorDate = useMemo(() => {
        if (view === "monat") return addMonths(new Date(), monthOffset);
        if (view === "woche") return startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
        return selectedDayDate;
    }, [view, monthOffset, weekOffset, selectedDayDate]);

    const headlineMonthYear = format(headlineAnchorDate, "MMMM yyyy", { locale: de });
    const geplantCount = useMemo(
        () => baseFilteredTermine.filter(terminCountsAsPlanned).length,
        [baseFilteredTermine],
    );
    const heuteIso = format(new Date(), "yyyy-MM-dd");
    const heuteGeplantCount = useMemo(
        () =>
            baseFilteredTermine.filter((x) => x.datum === heuteIso && terminCountsAsPlanned(x)).length,
        [baseFilteredTermine, heuteIso],
    );

    const activeFilterChips = useMemo(() => {
        const chips: { key: string; label: string }[] = [];
        for (const id of filterArztIds) {
            const name = aerzte.find((a) => a.id === id)?.name ?? id;
            chips.push({ key: `arzt:${id}`, label: name });
        }
        if (filterArt) chips.push({ key: "art", label: terminArten.find((a) => a.value === filterArt)?.label ?? filterArt });
        if (filterStatus) chips.push({ key: "st", label: filterStatus.replace(/_/g, " ") });
        return chips;
    }, [filterArztIds, aerzte, filterArt, filterStatus]);

    const toolbarNavLabel = useMemo(() => {
        if (view === "tag") return format(selectedDayDate, "EEEE, d. MMMM", { locale: de });
        if (view === "woche") {
            const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const end = addDays(start, 6);
            const wn = getISOWeek(start);
            return `Woche ${wn} · ${format(start, "d.", { locale: de })}–${format(end, "d. MMMM", { locale: de })}`;
        }
        return format(addMonths(new Date(), monthOffset), "MMMM yyyy", { locale: de });
    }, [view, weekOffset, monthOffset, selectedDayDate]);

    const jumpToIsoDate = useCallback((iso: string) => {
        const d = parseISO(iso);
        setDayOffset(differenceInCalendarDays(d, new Date()));
    }, []);
    const jumpToIsoDateRef = useRef(jumpToIsoDate);
    useLayoutEffect(() => {
        jumpToIsoDateRef.current = jumpToIsoDate;
    }, [jumpToIsoDate]);

    const commitDrag = useCallback(
        async (id: string, datum: string, startMin: number) => {
            const { updates, error } = computePackedUpdatesAfterMove(termine, id, datum, startMin, TERMIN_DEFAULT_DUR_MIN);
            if (error) {
                toast(error);
                return;
            }
            if (updates.length === 0) return;
            const moved = updates.find((u) => u.id === id);
            let snap: { iso: string; startMin: number } | undefined;
            if (moved?.data.uhrzeit) {
                const ustr = moved.data.uhrzeit as string;
                const dstr = (moved.data.datum as string | undefined) ?? datum;
                snap = { iso: dstr, startMin: uhrzeitToMinutes(ustr) };
            }
            try {
                for (const u of updates) {
                    await updateTermin(u.id, u.data);
                }
                toast(updates.length > 1 ? `${updates.length} Termine angepasst (ohne Überschneidung)` : "Termin verschoben");
                await load();
                if (snap) setTerminDaySnapLabel(snap);
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, termine],
    );

    useEffect(() => {
        const dragId = dragState?.id;
        if (!dragId) return undefined;
        const spanMin = DAY_END_MIN - DAY_START_MIN;
        const clampStartMin = (rawMin: number, durMin: number) => {
            const snapped = Math.round(rawMin / 5) * 5;
            const lo = DAY_START_MIN;
            const hi = DAY_END_MIN - durMin;
            return Math.max(lo, Math.min(snapped, hi));
        };
        const onMove = (e: MouseEvent) => {
            const ds = dragStateRef.current;
            if (!ds || ds.id !== dragId) return;

            /** Neues Zieldatum im Drag nur alle `DRAG_DATUM_NAV_COOLDOWN_MS` (gleicher Tag → Uhrzeit ohne Cooldown). */
            const applyDragTimeline = (targetIso: string, clamped: number, jumpIfDayChanges: boolean) => {
                const prev = dragStateRef.current;
                if (!prev || prev.id !== dragId) return;
                if (targetIso === prev.currentDatum) {
                    setDragState((p) => (p && p.id === dragId ? { ...p, currentStartMin: clamped } : p));
                    return;
                }
                const nowTs = Date.now();
                if (nowTs - lastDragDatumNavAtRef.current < DRAG_DATUM_NAV_COOLDOWN_MS) return;
                lastDragDatumNavAtRef.current = nowTs;
                setDragState((p) =>
                    p && p.id === dragId ? { ...p, currentDatum: targetIso, currentStartMin: clamped } : p,
                );
                if (jumpIfDayChanges && targetIso !== prev.currentDatum) {
                    jumpToIsoDateRef.current(targetIso);
                }
            };

            if (view === "woche") {
                const canvas = document.querySelector<HTMLElement>("[data-termin-week-canvas]");
                if (canvas) {
                    const br = canvas.getBoundingClientRect();
                    if (e.clientY >= br.top && e.clientY <= br.bottom) {
                        const tryWeekHop = (deltaDays: number, deltaWeekOffset: number) => {
                            const t = Date.now();
                            if (t - lastDragDatumNavAtRef.current < DRAG_DATUM_NAV_COOLDOWN_MS) return;
                            lastDragDatumNavAtRef.current = t;
                            setWeekOffset((w) => w + deltaWeekOffset);
                            setDragState((prev) => {
                                if (!prev || prev.id !== dragId) return prev;
                                return {
                                    ...prev,
                                    currentDatum: format(addDays(parseISO(prev.currentDatum), deltaDays), "yyyy-MM-dd"),
                                };
                            });
                        };
                        if (e.clientX < br.left - WEEK_NAV_EDGE_PX) {
                            tryWeekHop(-7, -1);
                            return;
                        }
                        if (e.clientX > br.right + WEEK_NAV_EDGE_PX) {
                            tryWeekHop(7, 1);
                            return;
                        }
                    }
                }
            }

            const cols = document.querySelectorAll<HTMLElement>("[data-termin-day-col]");
            const timeFromY = (clientY: number, r: DOMRect) => {
                const y = clientY - r.top;
                const pxPerMinCol = r.height > 8 ? r.height / spanMin : PX_PER_MIN;
                const minRaw = DAY_START_MIN + y / pxPerMinCol;
                return clampStartMin(minRaw, ds.durMin);
            };

            let hit = false;
            for (const col of cols) {
                const r = col.getBoundingClientRect();
                const iso = col.dataset.terminDayCol;
                if (!iso) continue;
                if (e.clientY < r.top || e.clientY > r.bottom) continue;

                if (view === "tag" && cols.length === 1) {
                    if (e.clientX >= r.left && e.clientX <= r.left + DAY_INNER_EDGE_PX) {
                        const targetIso = format(addDays(parseISO(iso), -1), "yyyy-MM-dd");
                        const clamped = timeFromY(e.clientY, r);
                        applyDragTimeline(targetIso, clamped, true);
                        hit = true;
                        break;
                    }
                    if (e.clientX >= r.right - DAY_INNER_EDGE_PX && e.clientX <= r.right) {
                        const targetIso = format(addDays(parseISO(iso), 1), "yyyy-MM-dd");
                        const clamped = timeFromY(e.clientY, r);
                        applyDragTimeline(targetIso, clamped, true);
                        hit = true;
                        break;
                    }
                }

                if (e.clientX >= r.left && e.clientX <= r.right) {
                    const clamped = timeFromY(e.clientY, r);
                    applyDragTimeline(iso, clamped, false);
                    hit = true;
                    break;
                }
            }
            if (!hit) {
                for (const g of document.querySelectorAll<HTMLElement>("[data-termin-hour-gutter]")) {
                    const r = g.getBoundingClientRect();
                    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
                        const clamped = timeFromY(e.clientY, r);
                        setDragState((prev) => (prev && prev.id === dragId ? { ...prev, currentStartMin: clamped } : prev));
                        hit = true;
                        break;
                    }
                }
            }
            if (!hit && view === "tag" && cols.length === 1) {
                const col = cols[0]!;
                const iso0 = col.dataset.terminDayCol;
                if (!iso0) return;
                const r = col.getBoundingClientRect();
                if (e.clientY < r.top || e.clientY > r.bottom) return;
                let targetIso: string | null = null;
                if (e.clientX < r.left - DAY_DRAG_EDGE_PX) {
                    targetIso = format(addDays(parseISO(iso0), -1), "yyyy-MM-dd");
                } else if (e.clientX > r.right + DAY_DRAG_EDGE_PX) {
                    targetIso = format(addDays(parseISO(iso0), 1), "yyyy-MM-dd");
                }
                if (targetIso) {
                    const clamped = timeFromY(e.clientY, r);
                    applyDragTimeline(targetIso, clamped, true);
                }
            }
        };
        const onUp = () => {
            setDragState((prev) => {
                if (!prev) return null;
                if (prev.currentDatum !== prev.originalDatum || prev.currentStartMin !== prev.originalStartMin) {
                    void commitDrag(prev.id, prev.currentDatum, prev.currentStartMin);
                }
                return null;
            });
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            lastDragDatumNavAtRef.current = 0;
        };
    }, [dragState?.id, view, commitDrag]);

    const openDrawerFor = useCallback(
        (termin: Termin) => {
            setDrawerTermin(termin);
            setCtxMenu(null);
        },
        [],
    );

    const patchTerminLocal = useCallback(
        (id: string, patch: Record<string, unknown>) => {
            setTermine((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } as Termin : x)));
            setDrawerTermin((dt) => (dt?.id === id ? { ...dt, ...patch } as Termin : dt));
        },
        [],
    );

    const onDrawerStatus = useCallback(
        async (id: string, status: Termin["status"]) => {
            try {
                await updateTermin(id, { status });
                patchTerminLocal(id, { status });
                toast(`Status: ${status.replace(/_/g, " ")}`);
                await load();
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, patchTerminLocal],
    );

    useEffect(() => {
        let pending: string | null = null;
        try {
            pending = sessionStorage.getItem(MEDOC_PENDING_TERMIN_MENU_KEY);
            if (pending) sessionStorage.removeItem(MEDOC_PENDING_TERMIN_MENU_KEY);
        } catch {
            /* ignore */
        }

        const onNativeTerminMenu = (ev: Event) => {
            const detail = (ev as CustomEvent<string>).detail;
            if (typeof detail !== "string") return;
            switch (detail) {
                case "view_tag":
                    setView("tag");
                    break;
                case "view_woche":
                    setView("woche");
                    break;
                case "view_monat":
                    setView("monat");
                    break;
                case "today":
                    setDayOffset(0);
                    setWeekOffset(0);
                    setMonthOffset(0);
                    setView("tag");
                    break;
                case "nav_prev":
                    if (view === "monat") setMonthOffset((o) => o - 1);
                    else if (view === "woche") setWeekOffset((w) => w - 1);
                    else setDayOffset((d) => d - 1);
                    break;
                case "nav_next":
                    if (view === "monat") setMonthOffset((o) => o + 1);
                    else if (view === "woche") setWeekOffset((w) => w + 1);
                    else setDayOffset((d) => d + 1);
                    break;
                default:
                    break;
            }
        };
        window.addEventListener("medoc-native-menu-termin", onNativeTerminMenu as EventListener);
        if (pending) {
            onNativeTerminMenu(new CustomEvent("medoc-native-menu-termin", { detail: pending }));
        }
        return () => window.removeEventListener("medoc-native-menu-termin", onNativeTerminMenu as EventListener);
    }, [view]);

    return (
        <div className="animate-fade-in schedule-page termin-page termin-page-root">
            <div className="page-head schedule-header termin-page-head fade-up">
                <div>
                    <h1 className="page-title">Terminübersicht</h1>
                    <div className="page-sub termin-page-sub">
                        <span>
                            {headlineMonthYear} · {geplantCount} Termine geplant
                            {" · "}
                        </span>
                        <span className="termin-heute-accent">Heute {heuteGeplantCount}</span>
                    </div>
                </div>
                <div className="schedule-toolbar">
                    <div className="seg schedule-view-seg">
                        <button type="button" aria-pressed={view === "tag"} onClick={() => setView("tag")}>Tag</button>
                        <button type="button" aria-pressed={view === "woche"} onClick={() => setView("woche")}>Woche</button>
                        <button type="button" aria-pressed={view === "monat"} onClick={() => setView("monat")}>Monat</button>
                    </div>
                    <div className="schedule-quick-actions">
                        <div className="termin-filter-anchor" ref={filterPopoverWrapRef}>
                            <button
                                type="button"
                                className="btn btn-subtle"
                                aria-expanded={filterPopoverOpen}
                                aria-haspopup="dialog"
                                onClick={() => setFilterPopoverOpen((o) => !o)}
                            >
                                <FilterIcon size={14} />
                                Filter
                                {activeFilterChips.length > 0 ? (
                                    <span className="termin-filter-badge">{activeFilterChips.length}</span>
                                ) : null}
                            </button>
                        </div>
                        <button type="button" className="btn btn-subtle" onClick={() => setPauseConfirmOpen(true)}>
                            <PauseIcon size={16} />
                            Pause
                        </button>
                        <button type="button" className="btn btn-subtle termin-btn-notfall" onClick={() => setNotfallConfirmOpen(true)}>
                            <AmbulanceIcon size={18} aria-hidden />
                            Notfall
                        </button>
                        <button type="button" className="btn btn-accent schedule-primary-action" onClick={() => goNeuerTermin({ datum: selectedDayIso })}>
                            <PlusIcon />
                            Neuer Termin
                        </button>
                    </div>
                </div>
            </div>

            {filterPopoverOpen && filterPopoverFixed
                ? createPortal(
                      (
                          <div
                              ref={filterPopoverPanelRef}
                              className="termin-filter-popover termin-filter-popover--portal"
                              role="dialog"
                              aria-label="Terminfilter"
                              style={{
                                  top: filterPopoverFixed.top,
                                  left: filterPopoverFixed.left,
                                  width: filterPopoverFixed.width,
                              }}
                          >
                              <div className="termin-filter-popover-section">
                                  <div className="termin-filter-popover-label">Behandler</div>
                                  {aerzte.length === 0 ? (
                                      <div className="termin-filter-empty">Keine Ärzte geladen</div>
                                  ) : (
                                      aerzte.map((a) => (
                                          <label key={a.id} className="menu-item termin-filter-check-row">
                                              <input
                                                  type="checkbox"
                                                  checked={filterArztIds.includes(a.id)}
                                                  onChange={() =>
                                                      setFilterArztIds((prev) =>
                                                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                                                      )}
                                              />
                                              <span>{a.name}</span>
                                          </label>
                                      ))
                                  )}
                              </div>
                              <div className="menu-sep" />
                              <div className="termin-filter-popover-fields">
                                  <div className="termin-filter-popover-field">
                                      <label htmlFor={terminFilterArtSelectId} className="termin-filter-popover-label">
                                          Behandlungsart
                                      </label>
                                      <select
                                          id={terminFilterArtSelectId}
                                          className="input-edit termin-filter-popover-select"
                                          value={filterArt}
                                          onChange={(e) => setFilterArt(e.target.value)}
                                      >
                                          {ART_FILTER_OPTIONS.map((o) => (
                                              <option key={o.value || "all-art"} value={o.value}>
                                                  {o.label}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="termin-filter-popover-field">
                                      <label htmlFor={terminFilterStatusSelectId} className="termin-filter-popover-label">
                                          Status
                                      </label>
                                      <select
                                          id={terminFilterStatusSelectId}
                                          className="input-edit termin-filter-popover-select"
                                          value={filterStatus}
                                          onChange={(e) => setFilterStatus(e.target.value)}
                                      >
                                          {STATUS_FILTER_OPTIONS.map((o) => (
                                              <option key={o.value || "all-st"} value={o.value}>
                                                  {o.label}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                              </div>
                              <div className="menu-sep" />
                              <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                                  <button type="button" className="btn btn-ghost" onClick={() => resetFilters()}>
                                      Zurücksetzen
                                  </button>
                                  <button type="button" className="btn btn-accent" onClick={() => setFilterPopoverOpen(false)}>
                                      Schließen
                                  </button>
                              </div>
                          </div>
                      ),
                      document.body,
                  )
                : null}

            {activeFilterChips.length > 0 ? (
                <div className="termin-filter-bar fade-up">
                    {activeFilterChips.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className="pill accent termin-filter-chip"
                            onClick={() => {
                                if (c.key.startsWith("arzt:")) {
                                    const id = c.key.slice(5);
                                    setFilterArztIds((p) => p.filter((x) => x !== id));
                                } else if (c.key === "art") setFilterArt("");
                                else if (c.key === "st") setFilterStatus("");
                            }}
                        >
                            {c.label}
                            <XIcon size={12} />
                        </button>
                    ))}
                    <button type="button" className="btn btn-ghost termin-filter-clear-all" onClick={resetFilters}>
                        Alle entfernen
                    </button>
                </div>
            ) : null}

            <div className="card card-pad termin-toolbar-row fade-up">
                <button
                    type="button"
                    className="icon-btn"
                    title="Zurück (←)"
                    aria-label="Zurück"
                    onClick={() => {
                        if (view === "monat") setMonthOffset((o) => o - 1);
                        else if (view === "woche") setWeekOffset((w) => w - 1);
                        else setDayOffset((d) => d - 1);
                    }}
                >
                    <ChevronLeftIcon size={18} />
                </button>
                <span className="termin-toolbar-nav-label">{toolbarNavLabel}</span>
                <button
                    type="button"
                    className="icon-btn"
                    title="Vor (→)"
                    aria-label="Vor"
                    onClick={() => {
                        if (view === "monat") setMonthOffset((o) => o + 1);
                        else if (view === "woche") setWeekOffset((w) => w + 1);
                        else setDayOffset((d) => d + 1);
                    }}
                >
                    <ChevronRightIcon size={18} />
                </button>
                <button
                    type="button"
                    className="btn btn-subtle"
                    onClick={() => {
                        setDayOffset(0);
                        setWeekOffset(0);
                        setMonthOffset(0);
                    }}
                >
                    Heute
                </button>
                <div className="termin-toolbar-search input">
                    <SearchIcon size={16} aria-hidden />
                    <input
                        type="search"
                        placeholder="In Terminen suchen…"
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                        aria-label="In Terminen suchen"
                    />
                    {quickSearch.trim() ? (
                        <button type="button" className="icon-btn termin-search-clear" aria-label="Suche leeren" onClick={() => setQuickSearch("")}>
                            <XIcon size={14} />
                        </button>
                    ) : null}
                </div>
                <div className="spacer" />
                <DoctorLegend aerzte={aerzte} arztToneMap={arztToneMap} />
            </div>

            <div className="termin-content-fill">
            <div className="schedule-main termin-main-full">
                    {loading ? (
                        <PageLoading label="Termine werden geladen…" />
                    ) : loadError ? (
                        <PageLoadError message={loadError} onRetry={() => void load()} />
                    ) : view === "tag" ? (
                        <TerminDaySplit
                            dayDate={selectedDayDate}
                            onJumpToDay={(d) => setDayOffset(differenceInCalendarDays(d, new Date()))}
                            termine={tagTermine}
                            patientNameById={patientNameById}
                            arztToneMap={arztToneMap}
                            aerzte={aerzte}
                            monthOffset={monthOffset}
                            onMonthOffsetChange={setMonthOffset}
                            daySnapLabel={terminDaySnapLabel}
                            onClearDaySnapLabel={() => setTerminDaySnapLabel(null)}
                            dragState={dragState}
                            setDragState={setDragState}
                            onOpenDrawer={openDrawerFor}
                            onContextMenu={(termin, e) => {
                                e.preventDefault();
                                setCtxMenu({ x: e.clientX, y: e.clientY, termin });
                            }}
                            onNewAt={(iso, min) => goNeuerTermin({ datum: iso, uhrzeit: minutesToUhrzeit(min) })}
                            emptyDescription={tagViewEmptyDescription}
                            emptyHasFilters={tagViewHasActiveFilters}
                            onEmptyCreate={() => goNeuerTermin({ datum: selectedDayIso })}
                            onEmptyResetFilters={tagViewHasActiveFilters ? resetFilters : undefined}
                            nowMin={() => {
                                const n = new Date();
                                return n.getHours() * 60 + n.getMinutes();
                            }}
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
                            aerzte={aerzte}
                            arztToneMap={arztToneMap}
                            onPickDay={(iso) => {
                                jumpToIsoDate(iso);
                                setView("tag");
                            }}
                        />
                    ) : (
                        <TerminWeekGrid
                            termine={displayTermine}
                            weekOffset={weekOffset}
                            patientNameById={patientNameById}
                            arztToneMap={arztToneMap}
                            dragState={dragState}
                            setDragState={setDragState}
                            snapLabel={terminDaySnapLabel}
                            onClearSnapLabel={() => setTerminDaySnapLabel(null)}
                            onHeaderDay={(iso) => {
                                jumpToIsoDate(iso);
                                setView("tag");
                            }}
                            onOpenDrawer={openDrawerFor}
                            onContextMenu={(termin, e) => {
                                e.preventDefault();
                                setCtxMenu({ x: e.clientX, y: e.clientY, termin });
                            }}
                            onNewAt={(iso, min) => goNeuerTermin({ datum: iso, uhrzeit: minutesToUhrzeit(min) })}
                            nowMin={() => {
                                const n = new Date();
                                return n.getHours() * 60 + n.getMinutes();
                            }}
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
                footer={(
                    <>
                        <button type="button" onClick={() => setNotfallConfirmOpen(false)}>Abbrechen</button>
                        <button
                            type="button"
                            className="destructive"
                            onClick={() => {
                                const todayIso = format(new Date(), "yyyy-MM-dd");
                                setDayOffset(0);
                                setWeekOffset(0);
                                setMonthOffset(0);
                                setView("tag");
                                goNeuerTermin({ datum: todayIso, art: "NOTFALL", uhrzeit: "11:45" });
                                setNotfallConfirmOpen(false);
                                toast("Notfall-Termin um 11:45 vorbereitet");
                            }}
                        >
                            Notfall einplanen
                        </button>
                    </>
                )}
            >
                <div className="modal-body">
                    <div className="confirm-icon" aria-hidden="true">
                        <AmbulanceIcon />
                    </div>
                    <h3 id={notfallTitleId}>{NOTFALL_CONFIRM_TITLE}</h3>
                    <p>{NOTFALL_CONFIRM_MESSAGE}</p>
                </div>
            </Dialog>

            <Dialog
                open={pauseConfirmOpen}
                onClose={() => setPauseConfirmOpen(false)}
                title=""
                presentation="centered"
                labelledBy={pauseTitleId}
                footer={(
                    <>
                        <button type="button" onClick={() => setPauseConfirmOpen(false)}>Abbrechen</button>
                        <button
                            type="button"
                            className="btn btn-accent"
                            onClick={() => {
                                setPauseConfirmOpen(false);
                                toast("Pause-Block 12:30–13:15 eingetragen (Demonstration).");
                            }}
                        >
                            Einfügen
                        </button>
                    </>
                )}
            >
                <div className="modal-body">
                    <h3 id={pauseTitleId}>Pause einfügen?</h3>
                    <p>Möchten Sie einen Pause-Block 12:30–13:15 in den Kalender eintragen?</p>
                </div>
            </Dialog>

            {drawerTermin ? (
                <TerminDetailDrawer
                    termin={drawerTermin}
                    patientName={patientNameById.get(drawerTermin.patient_id) ?? "Patient"}
                    patientPhone={patientById.get(drawerTermin.patient_id)?.telefon ?? null}
                    doctorLabel={aerzte.find((a) => a.id === drawerTermin.arzt_id)?.name ?? "—"}
                    onClose={() => setDrawerTermin(null)}
                    onBearbeiten={() => goNeuerTermin({ id: drawerTermin.id })}
                    onStornieren={() => void handleStornieren(drawerTermin.id)}
                    onReminder={() => {
                        const name = patientNameById.get(drawerTermin.patient_id) ?? "Patient";
                        toast(`Erinnerung an ${name} vorbereitet (Versand folgt mit TI-Konnektor).`);
                    }}
                    onStatusChange={onDrawerStatus}
                    onPhone={() => {
                        const tel = patientById.get(drawerTermin.patient_id)?.telefon?.trim();
                        toast(tel ? `Anruf: ${tel}` : "Keine Telefonnummer hinterlegt.");
                    }}
                />
            ) : null}

            {ctxMenu ? (
                <TerminContextMenu
                    termin={ctxMenu.termin}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    patientName={patientNameById.get(ctxMenu.termin.patient_id) ?? "Patient"}
                    onClose={() => setCtxMenu(null)}
                    onOpenDetails={() => openDrawerFor(ctxMenu.termin)}
                    onBearbeiten={() => goNeuerTermin({ id: ctxMenu.termin.id })}
                    onStornieren={() => void handleStornieren(ctxMenu.termin.id)}
                    onReminder={() => {
                        const name = patientNameById.get(ctxMenu.termin.patient_id) ?? "Patient";
                        toast(`Erinnerung an ${name} vorbereitet (Versand folgt mit TI-Konnektor).`);
                    }}
                />
            ) : null}

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

function TerminHourGutterSnap(props: {
    startMin: number | null;
    pxPerMin: number;
    phase: "drag" | "placed" | null;
}) {
    const { startMin, pxPerMin, phase } = props;
    if (startMin == null || phase == null) return null;
    return (
        <div
            className={`termin-hour-gutter-snap termin-hour-gutter-snap--${phase}`}
            style={{ top: (startMin - DAY_START_MIN) * pxPerMin }}
            aria-hidden
        >
            <span className="termin-hour-gutter-snap__time">{minutesToUhrzeit(startMin)}</span>
        </div>
    );
}

function DoctorLegend({ aerzte, arztToneMap }: { aerzte: AerztSummary[]; arztToneMap: Map<string, DoctorTone> }) {
    if (aerzte.length === 0) return null;
    return (
        <div className="termin-doctor-legend">
            {aerzte.slice(0, 8).map((a) => {
                const tone = arztToneMap.get(a.id) ?? "accent";
                return (
                    <span key={a.id} className="termin-legend-item">
                        <span className={`termin-legend-dot termin-legend-dot--${tone}`} aria-hidden />
                        {a.name}
                    </span>
                );
            })}
        </div>
    );
}

function TerminApptBlockView({
    termin,
    patientName,
    doctorTone,
    dayColumn,
    daySlotDurationMin,
    dragPreviewUhrzeit,
    dragging,
    dragTargetDatumHint,
    style,
    onClick,
    onMouseDown,
    onContextMenu,
}: {
    termin: Termin;
    patientName: string;
    doctorTone: DoctorTone;
    doctorName?: string;
    compact?: boolean;
    dayColumn?: boolean;
    dragPreviewUhrzeit?: string;
    daySlotDurationMin?: number;
    dragging?: boolean;
    /** Tagesansicht: Kurzdatum des Ziels wenn per Drag ein anderer Tag gewählt wird */
    dragTargetDatumHint?: string;
    style?: CSSProperties;
    onClick: () => void;
    onMouseDown: (e: ReactMouseEvent) => void;
    onContextMenu: (e: ReactMouseEvent) => void;
}) {
    const blockTone = blockToneForTermin(termin.art, doctorTone);
    const cancelled = termin.status === "ABGESAGT" || termin.status === "NICHT_ERSCHIENEN";
    const durMin = daySlotDurationMin ?? TERMIN_DEFAULT_DUR_MIN;
    const timeStr = (dragPreviewUhrzeit ?? termin.uhrzeit).slice(0, 5);
    const pill = terminCalendarStatusPill(termin);
    const stripeColor = doctorStripeVar(doctorTone);
    return (
        <button
            type="button"
            className={`termin-appt-block termin-appt-block--calendar-row ${dayColumn ? "termin-appt-block--day-tall" : "termin-appt-block--week-compact"} termin-appt-block--${blockTone}${cancelled ? " termin-appt-block--cancelled" : ""}${dragging ? " termin-appt-block--dragging" : ""}`}
            style={{
                ...style,
            }}
            onClick={onClick}
            onMouseDown={onMouseDown}
            onContextMenu={onContextMenu}
        >
            <span className="termin-appt-block-time-col">
                <span className={`termin-appt-block-time${dragPreviewUhrzeit ? " termin-appt-block-time--drag-live" : ""}`}>{timeStr}</span>
                <span className="termin-appt-block-duration">{durMin} min</span>
            </span>
            <span className="termin-appt-block-stripe" style={{ background: stripeColor }} aria-hidden />
            <span className="termin-appt-block-body-col">
                <span className="termin-appt-block-name-row">
                    {termin.art === "NOTFALL" ? (
                        <span className="termin-appt-block-notfall-ic" aria-hidden>
                            <BoltIcon size={12} />
                        </span>
                    ) : null}
                    <span className="termin-appt-block-name">{patientName}</span>
                </span>
                <span className="termin-appt-block-type">{terminArtLabel(termin.art)}</span>
                {dragTargetDatumHint ? (
                    <span className="termin-appt-block-target-day">{dragTargetDatumHint}</span>
                ) : null}
            </span>
            <span className={`termin-appt-status-pill termin-appt-status-pill--${pill.tone}`}>{pill.label}</span>
        </button>
    );
}

function TerminTimeColumnBody({
    iso,
    termine,
    patientNameById,
    arztToneMap,
    arztNameById,
    dragState,
    setDragState,
    onBeginAppointmentDrag,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    nowMin,
    singleDay,
    axisLayout,
}: {
    iso: string;
    termine: Termin[];
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, DoctorTone>;
    arztNameById?: Map<string, string>;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    /** Tagesansicht: Stunden-Snap zurücksetzen wenn ein Termin-Block zum Ziehen gegriffen wird */
    onBeginAppointmentDrag?: () => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (isoDay: string, startMin: number) => void;
    nowMin: () => number;
    singleDay: boolean;
    /** Tag- und Wochenansicht: Stundenhöhe aus verfügbarem Raster (ResizeObserver) */
    axisLayout?: { hourPx: number; pxPerMin: number };
}) {
    const hourPx = axisLayout?.hourPx ?? HOUR_PX;
    const pxPerMin = axisLayout?.pxPerMin ?? PX_PER_MIN;
    const axisHeightPx = ((DAY_END_MIN - DAY_START_MIN) / 60) * hourPx;
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const isTodayCol = iso === todayIso;
    const isWeekend = [0, 6].includes(parseISO(iso).getDay());
    const dayList = useMemo(() => [...termine].sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit)), [termine]);
    const nMin = nowMin();

    const onColDblClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const y = e.clientY - r.top;
        const raw = DAY_START_MIN + y / pxPerMin;
        const snapped = Math.round(raw / 15) * 15;
        const lo = DAY_START_MIN;
        const hi = DAY_END_MIN - 15;
        const start = Math.max(lo, Math.min(snapped, hi));
        onNewAt(iso, start);
    };

    return (
        <div
            className={`termin-day-col ${isTodayCol ? "termin-day-col--today" : ""} ${isWeekend ? "termin-day-col--weekend" : ""}`}
            data-termin-day-col={iso}
            data-single-day={singleDay ? "1" : undefined}
            style={{ minHeight: axisHeightPx }}
            onDoubleClick={onColDblClick}
            role="presentation"
        >
            {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }).map((_, i) => (
                <div key={i} className="termin-hour-line" style={{ top: i * hourPx }} />
            ))}
            {isTodayCol && nMin >= DAY_START_MIN && nMin <= DAY_END_MIN ? (
                <div className="termin-now-line" style={{ top: (nMin - DAY_START_MIN) * pxPerMin }}>
                    <span className="termin-now-dot" />
                    {!singleDay ? null : (
                        <span className="termin-now-pill">
                            {minutesToUhrzeit(nMin)} jetzt
                        </span>
                    )}
                </div>
            ) : null}
            {dayList.map((ap) => {
                if (!singleDay && dragState && dragState.id === ap.id && dragState.currentDatum !== iso) return null;
                const st = uhrzeitToMinutes(ap.uhrzeit);
                const docTone = arztToneMap.get(ap.arzt_id) ?? "accent";
                const isDragThis = dragState?.id === ap.id;
                const dispStart = isDragThis ? dragState!.currentStartMin : st;
                const top = (dispStart - DAY_START_MIN) * pxPerMin;
                const dur = TERMIN_DEFAULT_DUR_MIN;
                const minDayBlockPx = singleDay ? Math.max(56, pxPerMin * 24) : 0;
                const minWeekBlockPx = singleDay ? 0 : 48;
                const blockHeight = Math.max(dur * pxPerMin - 2, singleDay ? minDayBlockPx : minWeekBlockPx);
                const targetDayHint =
                    singleDay && isDragThis && dragState && dragState.currentDatum !== iso
                        ? `→ ${format(parseISO(dragState.currentDatum), "EEE d. MMM", { locale: de })}`
                        : undefined;
                return (
                    <TerminApptBlockView
                        key={ap.id}
                        termin={ap}
                        patientName={patientNameById.get(ap.patient_id) ?? "Patient"}
                        doctorName={arztNameById?.get(ap.arzt_id)}
                        doctorTone={docTone}
                        compact={!singleDay}
                        dayColumn={singleDay}
                        daySlotDurationMin={dur}
                        dragPreviewUhrzeit={isDragThis ? minutesToUhrzeit(dispStart) : undefined}
                        dragging={isDragThis}
                        dragTargetDatumHint={targetDayHint}
                        style={{
                            top,
                            height: blockHeight,
                            left: 4,
                            right: 4,
                        }}
                        onClick={() => onOpenDrawer(ap)}
                        onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            onBeginAppointmentDrag?.();
                            setDragState({
                                id: ap.id,
                                datum: iso,
                                durMin: dur,
                                originalDatum: ap.datum,
                                originalStartMin: st,
                                currentDatum: ap.datum,
                                currentStartMin: st,
                            });
                        }}
                        onContextMenu={(e) => onContextMenu(ap, e)}
                    />
                );
            })}
        </div>
    );
}

function TerminWeekGrid({
    termine,
    weekOffset,
    patientNameById,
    arztToneMap,
    dragState,
    setDragState,
    snapLabel,
    onClearSnapLabel,
    onHeaderDay,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    nowMin,
}: {
    termine: Termin[];
    weekOffset: number;
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, DoctorTone>;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    snapLabel: { iso: string; startMin: number } | null;
    onClearSnapLabel: () => void;
    onHeaderDay: (iso: string) => void;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    nowMin: () => number;
}) {
    const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
    const byDate = useMemo(() => {
        const acc: Record<string, Termin[]> = {};
        for (const t of termine) {
            (acc[t.datum] ??= []).push(t);
        }
        return acc;
    }, [termine]);

    const { hostRef: weekTimelineRef, layout: weekAxisLayout } = useDayTimelineLayout();
    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : snapLabel?.startMin ?? null;
    const hourGutterPhase: "drag" | "placed" | null = dragState != null ? "drag" : snapLabel != null ? "placed" : null;

    return (
        <div className="card card-pad termin-week-card fade-up">
            <div className="termin-week-head-grid">
                <div className="termin-week-corner" aria-hidden />
                {days.map((d) => {
                    const iso = format(d, "yyyy-MM-dd");
                    const isToday = iso === format(new Date(), "yyyy-MM-dd");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const dow = format(d, "EEEEE", { locale: de }).toUpperCase();
                    return (
                        <button
                            key={iso}
                            type="button"
                            className={`termin-week-dow ${isToday ? "today" : ""} ${isWeekend ? "weekend" : ""}`}
                            onClick={() => onHeaderDay(iso)}
                        >
                            <span className="termin-week-dow-short">{dow}</span>
                            <span className="termin-week-dow-num">{format(d, "d", { locale: de })}</span>
                        </button>
                    );
                })}
            </div>
            <div className="termin-week-body" ref={weekTimelineRef}>
                <div className="termin-week-body-grid" data-termin-week-canvas="1">
                    <div className="termin-week-hours">
                        <div className="termin-week-hours-stack" data-termin-hour-gutter="1">
                            {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => {
                                const h = 8 + i;
                                return (
                                    <div key={h} className="termin-hour-label" style={{ height: weekAxisLayout.hourPx }}>
                                        {`${String(h).padStart(2, "0")}:00`}
                                    </div>
                                );
                            })}
                            <TerminHourGutterSnap startMin={hourGutterSnapMin} pxPerMin={weekAxisLayout.pxPerMin} phase={hourGutterPhase} />
                        </div>
                    </div>
                    {days.map((d) => {
                        const iso = format(d, "yyyy-MM-dd");
                        const baseList = byDate[iso] ?? [];
                        const columnTermine =
                            dragState != null && dragState.currentDatum === iso && !baseList.some((x) => x.id === dragState.id)
                                ? (() => {
                                      const ghost = termine.find((x) => x.id === dragState.id);
                                      return ghost ? [...baseList, ghost] : baseList;
                                  })()
                                : baseList;
                        return (
                            <TerminTimeColumnBody
                                key={iso}
                                iso={iso}
                                termine={columnTermine}
                                patientNameById={patientNameById}
                                arztToneMap={arztToneMap}
                                dragState={dragState}
                                setDragState={setDragState}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay={false}
                                axisLayout={weekAxisLayout}
                                onBeginAppointmentDrag={onClearSnapLabel}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function TerminDaySplit({
    dayDate,
    onJumpToDay,
    termine,
    patientNameById,
    arztToneMap,
    aerzte,
    monthOffset,
    onMonthOffsetChange,
    daySnapLabel,
    onClearDaySnapLabel,
    dragState,
    setDragState,
    onOpenDrawer,
    onContextMenu,
    onNewAt,
    emptyDescription,
    emptyHasFilters,
    onEmptyCreate,
    onEmptyResetFilters,
    nowMin,
}: {
    dayDate: Date;
    onJumpToDay: (d: Date) => void;
    termine: Termin[];
    patientNameById: Map<string, string>;
    arztToneMap: Map<string, DoctorTone>;
    aerzte: AerztSummary[];
    monthOffset: number;
    onMonthOffsetChange: Dispatch<SetStateAction<number>>;
    daySnapLabel: { iso: string; startMin: number } | null;
    onClearDaySnapLabel: () => void;
    dragState: {
        id: string;
        datum: string;
        durMin: number;
        originalDatum: string;
        originalStartMin: number;
        currentDatum: string;
        currentStartMin: number;
    } | null;
    setDragState: Dispatch<
        SetStateAction<{
            id: string;
            datum: string;
            durMin: number;
            originalDatum: string;
            originalStartMin: number;
            currentDatum: string;
            currentStartMin: number;
        } | null>
    >;
    onOpenDrawer: (t: Termin) => void;
    onContextMenu: (t: Termin, e: ReactMouseEvent) => void;
    onNewAt: (iso: string, min: number) => void;
    emptyDescription: string;
    emptyHasFilters: boolean;
    onEmptyCreate: () => void;
    onEmptyResetFilters?: () => void;
    nowMin: () => number;
}) {
    const iso = format(dayDate, "yyyy-MM-dd");
    const { hostRef: dayTimelineRef, layout: dayAxisLayout } = useDayTimelineLayout();
    const arztNameById = useMemo(() => new Map(aerzte.map((a) => [a.id, a.name])), [aerzte]);
    const planned = termine.filter(terminCountsAsPlanned);
    const bestaetigt = termine.filter((t) => t.status === "BESTAETIGT").length;
    const slotMin = (DAY_END_MIN - DAY_START_MIN);
    const bookedMin = planned.length * TERMIN_DEFAULT_DUR_MIN;
    const auslastung = slotMin > 0 ? Math.min(100, Math.round((bookedMin / slotMin) * 100)) : 0;
    const freiH = Math.max(0, Math.round(((slotMin - bookedMin) / 60) * 10) / 10);
    const nMin = nowMin();
    const sortedToday = useMemo(
        () => [...termine].filter(terminCountsAsPlanned).sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit)),
        [termine],
    );
    const nextAppt = sortedToday.find((t) => uhrzeitToMinutes(t.uhrzeit) >= nMin);

    const miniAnchor = addMonths(new Date(), monthOffset);
    const y = miniAnchor.getFullYear();
    const m = miniAnchor.getMonth();
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const selectedIso = iso;

    const hourGutterSnapMin = dragState != null ? dragState.currentStartMin : daySnapLabel != null ? daySnapLabel.startMin : null;
    const hourGutterPhase: "drag" | "placed" | null =
        dragState != null ? "drag" : daySnapLabel != null ? "placed" : null;

    return (
        <div className="termin-day-split fade-up">
            <div className="card card-pad termin-day-main">
                <div className="termin-day-split-head">
                    <div>
                        <div className="card-title">{format(dayDate, "EEEE, d. MMMM yyyy", { locale: de })}</div>
                        <div className="card-sub">
                            {planned.length} Termine · {bestaetigt} bestätigt
                        </div>
                    </div>
                    <DoctorLegend aerzte={aerzte} arztToneMap={arztToneMap} />
                </div>
                {sortedToday.length === 0 ? (
                    <div className="termin-day-empty">
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
                ) : (
                    <div className="termin-day-timeline-host" ref={dayTimelineRef}>
                        <div className="termin-week-body-grid termin-day-body-grid">
                            <div className="termin-week-hours termin-day-hours">
                                <div className="termin-day-hours-stack" data-termin-hour-gutter="1">
                                    {Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 }, (_, i) => {
                                        const h = 8 + i;
                                        return (
                                            <div key={h} className="termin-hour-label termin-day-hour-label" style={{ height: dayAxisLayout.hourPx }}>
                                                {`${String(h).padStart(2, "0")}:00`}
                                            </div>
                                        );
                                    })}
                                    <TerminHourGutterSnap startMin={hourGutterSnapMin} pxPerMin={dayAxisLayout.pxPerMin} phase={hourGutterPhase} />
                                </div>
                            </div>
                            <TerminTimeColumnBody
                                iso={iso}
                                termine={termine}
                                patientNameById={patientNameById}
                                arztToneMap={arztToneMap}
                                arztNameById={arztNameById}
                                dragState={dragState}
                                setDragState={setDragState}
                                onBeginAppointmentDrag={onClearDaySnapLabel}
                                onOpenDrawer={onOpenDrawer}
                                onContextMenu={onContextMenu}
                                onNewAt={onNewAt}
                                nowMin={nowMin}
                                singleDay
                                axisLayout={dayAxisLayout}
                            />
                        </div>
                    </div>
                )}
            </div>
            <div className="termin-day-sidebar">
                <div className="card card-pad termin-mini-month-card">
                    <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                        <button type="button" className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onMonthOffsetChange((o) => o - 1)}>
                            <ChevronLeftIcon size={16} />
                        </button>
                        <span className="termin-mini-month-title">{format(first, "MMMM yyyy", { locale: de })}</span>
                        <button type="button" className="icon-btn" aria-label="Nächster Monat" onClick={() => onMonthOffsetChange((o) => o + 1)}>
                            <ChevronRightIcon size={16} />
                        </button>
                    </div>
                    <div className="termin-mini-cal">
                        {["MO", "DI", "MI", "DO", "FR", "SA", "SO"].map((d, i) => (
                            <div key={`${d}-${i}`} className="termin-mini-cal-head">{d}</div>
                        ))}
                        {Array.from({ length: 42 }).map((_, idx) => {
                            const dayN = idx - startOffset + 1;
                            const inMonth = dayN > 0 && dayN <= daysInMonth;
                            const date = inMonth ? new Date(y, m, dayN) : undefined;
                            const cellIso = date ? format(date, "yyyy-MM-dd") : "";
                            const isToday = Boolean(inMonth && cellIso === todayIso);
                            const isSel = Boolean(inMonth && cellIso === selectedIso);
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={!inMonth}
                                    className={`termin-mini-cal-cell ${!inMonth ? "dim" : ""} ${isToday ? "today" : ""} ${isSel ? "selected" : ""}`}
                                    onClick={() => {
                                        if (!date) return;
                                        onJumpToDay(date);
                                        onMonthOffsetChange(calendarMonthOffsetFromToday(date));
                                    }}
                                >
                                    {inMonth ? dayN : ""}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="card card-pad">
                    <div className="termin-side-h3">Tagesübersicht</div>
                    <div className="termin-stat-big">{planned.length}</div>
                    <div className="termin-stat-big-label">Termine geplant</div>
                    <div className="termin-stat-row termin-stat-row--day">
                        <span>
                            <span className="termin-stat-line-label">Auslastung</span>
                            <b className="termin-stat-line-val">{auslastung}%</b>
                        </span>
                        <span>
                            <span className="termin-stat-line-label">Eingecheckt</span>
                            <b className="termin-stat-line-val">{termine.filter((t) => t.status === "BESTAETIGT").length}</b>
                        </span>
                        <span>
                            <span className="termin-stat-line-label">Frei</span>
                            <b className="termin-stat-line-val">{freiH}h</b>
                        </span>
                    </div>
                </div>
                <div className="card card-pad termin-next-card">
                    <div className="termin-side-h3">Nächster Termin</div>
                    {nextAppt ? (
                        <>
                            <div className="termin-next-time">{nextAppt.uhrzeit.slice(0, 5)}</div>
                            <div className="termin-next-name">{patientNameById.get(nextAppt.patient_id) ?? "Patient"}</div>
                            <div className="termin-next-meta">
                                {terminArtLabel(nextAppt.art)} · {aerzte.find((a) => a.id === nextAppt.arzt_id)?.name ?? ""}
                            </div>
                        </>
                    ) : sortedToday.length > 0 ? (
                        <p className="termin-next-empty">Kein weiterer Termin ab der aktuellen Uhrzeit.</p>
                    ) : (
                        <p className="termin-next-empty">Heute sind keine Termine in der Liste.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function terminDrawerActiveStep(status: Termin["status"]): number {
    if (status === "DURCHGEFUEHRT") return 3;
    if (status === "BESTAETIGT") return 1;
    if (status === "GEPLANT") return 0;
    if (status === "ABGESAGT" || status === "NICHT_ERSCHIENEN") return -1;
    return 0;
}

function TerminDetailDrawer({
    termin,
    patientName,
    patientPhone,
    doctorLabel,
    onClose,
    onBearbeiten,
    onStornieren,
    onReminder,
    onStatusChange,
    onPhone,
}: {
    termin: Termin;
    patientName: string;
    patientPhone: string | null;
    doctorLabel: string;
    onClose: () => void;
    onBearbeiten: () => void;
    onStornieren: () => void;
    onReminder: () => void;
    onStatusChange: (id: string, s: Termin["status"]) => void;
    onPhone: () => void;
}) {
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const st = appointmentStateDisplay(termin);
    const active = terminDrawerActiveStep(termin.status);
    const dauer = TERMIN_DEFAULT_DUR_MIN;

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            const closeBtn = panelRef.current?.querySelector<HTMLButtonElement>(".termin-drawer-head .icon-btn");
            closeBtn?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const layer = (
        <div className="termin-drawer-root" role="presentation">
            <button type="button" className="termin-drawer-backdrop" aria-label="Schließen" onClick={onClose} />
            <div
                ref={panelRef}
                className="termin-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="termin-drawer-body-scroll">
                    <div className="termin-drawer-head">
                        <span className={`pill ${stateSoftPillClass(termin)}`}>{st.label}</span>
                        <button type="button" className="icon-btn" aria-label="Schließen" onClick={onClose}>
                            <XIcon size={18} />
                        </button>
                    </div>
                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">Termin</div>
                        <h2 id={titleId} className="termin-drawer-title">{patientName}</h2>
                        <div className="termin-drawer-sub">{terminArtLabel(termin.art)}</div>
                    </div>
                    <div className="termin-drawer-meta-row">
                        <div>
                            <div className="termin-drawer-eyebrow">Datum</div>
                            <div className="termin-drawer-meta-val">{format(parseISO(termin.datum), "d. MMMM yyyy", { locale: de })}</div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">Zeit</div>
                            <div className="termin-drawer-meta-val">
                                {termin.uhrzeit.slice(0, 5)} – {minutesToUhrzeit(uhrzeitToMinutes(termin.uhrzeit) + dauer)}
                            </div>
                        </div>
                        <div>
                            <div className="termin-drawer-eyebrow">Dauer</div>
                            <div className="termin-drawer-meta-val">{dauer} Min.</div>
                        </div>
                    </div>
                    <div className="termin-drawer-section">
                        <div className="termin-drawer-eyebrow">Workflow</div>
                        <div className="termin-workflow-simple">
                            {(["Geplant", "Bestätigt", "Aktiv", "Fertig"] as const).map((label, i) => (
                                <button
                                    key={label}
                                    type="button"
                                    className={`termin-workflow-node ${i <= active ? "on" : ""} ${i === active ? "current" : ""}`}
                                    title={label}
                                    onClick={() => {
                                        const map: Termin["status"][] = ["GEPLANT", "BESTAETIGT", "BESTAETIGT", "DURCHGEFUEHRT"];
                                        onStatusChange(termin.id, map[i]!);
                                    }}
                                >
                                    {i === 0 ? <CheckIcon size={14} /> : i === 1 ? <EyeIcon size={14} /> : i === 2 ? <BoltIcon size={14} /> : <ShieldCheckIcon size={14} />}
                                </button>
                            ))}
                        </div>
                        <div className="termin-workflow-captions">
                            {(["Geplant", "Bestätigt", "Aktiv", "Fertig"] as const).map((label) => (
                                <span key={label} className="termin-workflow-label">{label}</span>
                            ))}
                        </div>
                    </div>
                    <div className="ios-list">
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Behandler</div>
                            <div className="termin-drawer-meta-val">{doctorLabel}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Patient-Telefon</div>
                            <div className="termin-drawer-meta-val">{patientPhone ?? "—"}</div>
                        </div>
                        <div className="ios-row">
                            <div className="termin-drawer-eyebrow">Behandlungsart</div>
                            <div className="termin-drawer-meta-val">{terminArtLabel(termin.art)}</div>
                        </div>
                    </div>
                    {termin.notizen?.trim() ? (
                        <div className="termin-drawer-note">
                            <div className="termin-drawer-note-title">Notiz</div>
                            <p>{termin.notizen}</p>
                        </div>
                    ) : null}
                    <div className="termin-drawer-actions row">
                        <button type="button" className="btn btn-subtle" onClick={onPhone}>
                            <PhoneIcon size={14} />
                            Anrufen
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onReminder}>
                            <MailIcon size={14} />
                            Erinnerung
                        </button>
                        <button type="button" className="btn btn-subtle" onClick={onBearbeiten}>
                            <EditIcon size={14} />
                            Bearbeiten
                        </button>
                    </div>
                </div>
                <div className="termin-drawer-panel-foot">
                    <div className="termin-drawer-footer row">
                        {termin.status === "GEPLANT" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(termin.id, "BESTAETIGT")}>Bestätigen</button>
                        ) : null}
                        {termin.status === "BESTAETIGT" ? (
                            <button type="button" className="btn btn-accent" onClick={() => onStatusChange(termin.id, "DURCHGEFUEHRT")}>Abschließen</button>
                        ) : null}
                        <button type="button" className="btn btn-subtle danger" onClick={onStornieren}>Absagen</button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}

function TerminContextMenu({
    termin,
    x,
    y,
    patientName,
    onClose,
    onOpenDetails,
    onBearbeiten,
    onStornieren,
    onReminder,
}: {
    termin: Termin;
    x: number;
    y: number;
    patientName: string;
    onClose: () => void;
    onOpenDetails: () => void;
    onBearbeiten: () => void;
    onStornieren: () => void;
    onReminder: () => void;
}) {
    const maxX = typeof window !== "undefined" ? window.innerWidth - 240 : x;
    const maxY = typeof window !== "undefined" ? window.innerHeight - 320 : y;
    const left = Math.max(8, Math.min(x, maxX));
    const top = Math.max(8, Math.min(y, maxY));
    return (
        <div className="menu termin-ctx-menu" style={{ position: "fixed", left, top }}>
            <div className="termin-ctx-title">{patientName}</div>
            <div className="termin-ctx-sub">
                {termin.uhrzeit.slice(0, 5)} · {terminArtLabel(termin.art)}
            </div>
            <button type="button" className="menu-item" onClick={() => { onOpenDetails(); onClose(); }}>Details öffnen</button>
            <div className="menu-sep" />
            <button type="button" className="menu-item" onClick={() => { onBearbeiten(); onClose(); }}>Termin bearbeiten</button>
            <button type="button" className="menu-item" onClick={() => { onReminder(); onClose(); }}>Erinnerung senden</button>
            <button type="button" className="menu-item danger" onClick={() => { onStornieren(); onClose(); }}>Absagen</button>
        </div>
    );
}

function MonthCalendar({
    monthOffset,
    onMonthChange,
    termine,
    patientNameById,
    aerzte,
    arztToneMap,
    onPickDay,
}: {
    monthOffset: number;
    onMonthChange: Dispatch<SetStateAction<number>>;
    termine: Termin[];
    patientNameById: Map<string, string>;
    aerzte: AerztSummary[];
    arztToneMap: Map<string, DoctorTone>;
    onPickDay: (iso: string) => void;
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
        <div className="card card-pad termin-month-view">
            <div className="month-view-topbar">
                <div className="row month-view-period" style={{ gap: 8, fontWeight: 600, alignItems: "center" }}>
                    <button type="button" className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onMonthChange((o) => o - 1)}><ChevronLeftIcon size={16} /></button>
                    <span className="month-view-period-label">{format(first, "MMMM yyyy", { locale: de })}</span>
                    <button type="button" className="icon-btn" aria-label="Nächster Monat" onClick={() => onMonthChange((o) => o + 1)}><ChevronRightIcon size={16} /></button>
                </div>
                <button type="button" className="btn btn-subtle" onClick={() => onMonthChange(0)}>Heute</button>
                <DoctorLegend aerzte={aerzte} arztToneMap={arztToneMap} />
            </div>
            <div className="cal termine-month-cal">
                {["MO", "DI", "MI", "DO", "FR", "SA", "SO"].map((d) => <div className="cal-head" key={d}>{d}</div>)}
                {Array.from({ length: total }).map((_, idx) => {
                    const day = idx - startOffset + 1;
                    const inMonth = day > 0 && day <= daysInMonth;
                    const date = new Date(y, m, day);
                    const iso = format(date, "yyyy-MM-dd");
                    const events = [...(byDate[iso] ?? [])].sort((a, b) => a.uhrzeit.localeCompare(b.uhrzeit));
                    const isTodayCell = iso === todayIso;
                    const visible = events.slice(0, 3);
                    const more = events.length - visible.length;
                    return (
                        <div
                            key={idx}
                            role="button"
                            tabIndex={0}
                            className={`cal-cell ${inMonth ? "" : "dim"} ${isTodayCell ? "today" : ""}`}
                            onClick={() => onPickDay(iso)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    onPickDay(iso);
                                }
                            }}
                        >
                            <div className="cal-num">{date.getDate()}</div>
                            {visible.map((ev) => (
                                <div
                                    key={ev.id}
                                    className={`cal-evt ${EVENT_TONE_BY_ART[ev.art] ?? "green"}`}
                                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPickDay(iso);
                                    }}
                                >
                                    <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{ev.uhrzeit.slice(0, 5)}</span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                                        {patientNameById.get(ev.patient_id) ?? "Patient"}
                                    </span>
                                </div>
                            ))}
                            {more > 0 ? (
                                <div style={{ fontSize: 11, color: "var(--fg-3)", fontWeight: 600, padding: "2px 4px" }}>
                                    +{more} weitere
                                </div>
                            ) : null}
                            {inMonth && events.length === 0 ? (
                                <div style={{ fontSize: 11, color: "var(--fg-4)", padding: "2px 4px" }}>—</div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
