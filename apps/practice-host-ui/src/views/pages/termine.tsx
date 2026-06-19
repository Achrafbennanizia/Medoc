import {
    type MouseEvent as ReactMouseEvent,
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
import { listTermine, deleteTermin, updateTermin } from "@/systems/practice-host/controllers/termin.controller";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { listAerzte, type AerztSummary } from "@/systems/practice-host/controllers/personal.controller";
import { listAbwesenheiten } from "@/systems/practice-host/controllers/praxis.controller";
import { errorMessage } from "@/lib/utils";
import { MEDOC_PENDING_TERMIN_MENU_KEY } from "@/lib/native-go-menu";
import { CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED } from "@/lib/settings-ui-flags";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { terminIstNotfallMarkiert } from "@/lib/termin-domain";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
} from "@/lib/client-settings";
import {
    DEFAULT_MONTH_CAL_PATIENT_LOAD,
    loadPraxisPraeferenzenFromKv,
    type MonthCalendarPatientLoadPrefs,
} from "@/lib/praxis-praeferenzen-storage";
import {
    loadPraxisArbeitszeitenConfig,
    readPraxisArbeitszeitenConfig,
    type PraxisArbeitszeitenConfig,
} from "@/lib/praxis-planning";
import { validateTerminSchedulingUpdates } from "@/lib/termin-availability";
import type { Termin as TCalEvent, Patient, Abwesenheit } from "../../models/types";
import { ConfirmDialog } from "../components/ui/dialog";
// import { Dialog, IosConfirmActions } from "../components/ui/dialog"; — Pause/Notfall-Dialoge deaktiviert
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { TerminContextMenu } from "../components/termin-context-menu";
import { TerminDetailDrawer } from "../components/termin-detail-drawer";
import { DoctorLegend } from "../components/termin-doctor-legend";
import { TerminMonthCalendar } from "../components/termin-month-calendar";
import { TerminDaySplit, TerminWeekGrid } from "../components/termin-week-day-grid";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import {
    // AmbulanceIcon, — Kalender: Notfall-Toolbar vorübergehend deaktiviert
    ChevronLeftIcon,
    ChevronRightIcon,
    FilterIcon,
    // PauseIcon,
    PlusIcon,
    SearchIcon,
    XIcon,
} from "@/lib/icons";
import {
    buildArztToneMap,
    calendarMonthOffsetFromToday,
    computePackedUpdatesAfterMove,
    minutesToUhrzeit,
    terminArtLabelFromTermin,
    terminArtFilterOptions,
    terminCountsAsPlanned,
    terminUhrzeitToMinutes,
    TERMIN_DAY_END_MIN,
    TERMIN_DAY_START_MIN,
    TERMIN_DEFAULT_DUR_MIN,
    TERMIN_PX_PER_MIN,
    TERMIN_STATUS_BADGE,
} from "@/lib/termin-calendar-ui";

const statusBadge = TERMIN_STATUS_BADGE;
const PX_PER_MIN = TERMIN_PX_PER_MIN;
const DAY_START_MIN = TERMIN_DAY_START_MIN;
const DAY_END_MIN = TERMIN_DAY_END_MIN;
/** Tag-Ansicht: Ziehen links/rechts neben dem Raster wechselt das Zieldatum (±1 Tag). */
const DAY_DRAG_EDGE_PX = 40;
/** Tag-Ansicht: linker/rechter Rand innerhalb der Tagesspalte wechselt den Kalendertag */
const DAY_INNER_EDGE_PX = 36;
/** Wochenansicht: Ziehen links/rechts außerhalb des Rasters wechselt die Woche. */
const WEEK_NAV_EDGE_PX = 48;
/** Beim Drag: Kalender-Tag oder Woche höchstens einmal alle 500 ms wechseln (vermeidet “Durchwandern”). */
const DRAG_DATUM_NAV_COOLDOWN_MS = 500;
/** Nach Drag: Kontextmenü kurz unterdrücken (Trackpad/OS feuert oft „contextmenu“ nach dem Loslassen). */
const APPT_CTX_SUPPRESS_AFTER_DRAG_MS = 1400;
/** Wochenansicht: Nach Ziehen ersten „click“ blocken (Browser feuert oft click direkt nach mouseup auf dem Termin-Button). */
const APPT_CLICK_SUPPRESS_AFTER_DROP_MS = 500;
/** Summe der Zeigerbewegung (|dx|+|dy|) ab der Drag-Zeit – ab diesem Wert als Zieh-Geste werten. */
const APPT_DRAG_TRAVEL_SUPPRESS_CTX_PX = 6;

const uhrzeitToMinutes = terminUhrzeitToMinutes;

export function TerminePage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [termine, setTermine] = useState<TCalEvent[]>([]);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
    const [praxisPlanCfg, setPraxisPlanCfg] = useState<PraxisArbeitszeitenConfig>(() => readPraxisArbeitszeitenConfig());
    const [terminPufferMin, setTerminPufferMin] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [monthCalPatientLoad, setMonthCalPatientLoad] = useState<MonthCalendarPatientLoadPrefs>(() => ({
        ...DEFAULT_MONTH_CAL_PATIENT_LOAD,
    }));
    // const [notfallConfirmOpen, setNotfallConfirmOpen] = useState(false);
    // const notfallTitleId = useId();
    const terminFilterArtSelectId = useId();
    const terminFilterStatusSelectId = useId();
    const [view, setView] = useState<"tag" | "woche" | "monat">(() => {
        const v = loadClientSettings().workflows?.termineDefaultView;
        if (v === "tag" || v === "woche" || v === "monat") return v;
        const d = DEFAULT_CLIENT_SETTINGS.workflows?.termineDefaultView;
        if (d === "tag" || d === "woche" || d === "monat") return d;
        return "monat";
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
    // const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
    // const pauseTitleId = useId();
    const [drawerTermin, setDrawerTermin] = useState<TCalEvent | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; termin: TCalEvent } | null>(null);
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
    const suppressApptContextMenuUntilRef = useRef(0);
    /** Nur Wochenansicht: Klick auf Termin-Kachel nach Drag-Drop erst wieder zulassen (s. `APPT_CLICK_SUPPRESS_AFTER_DROP_MS`). */
    const suppressApptClickUntilRef = useRef(0);
    const dragPointerTravelRef = useRef(0);
    const dragLastClientRef = useRef<{ x: number; y: number } | null>(null);
    const goNeuerTermin = useCallback((opts?: {
        datum?: string;
        patient_id?: string;
        art?: string;
        id?: string;
        uhrzeit?: string;
        arzt_id?: string;
    }) => {
        const p = new URLSearchParams();
        if (opts?.id) {
            p.set("id", opts.id);
        } else {
            const aid = opts?.arzt_id ?? praxisPlanCfg.defaultArztId;
            if (aid) p.set("arzt_id", aid);
        }
        if (opts?.datum) p.set("datum", opts.datum);
        if (opts?.patient_id) p.set("patient_id", opts.patient_id);
        if (opts?.art) p.set("art", opts.art);
        if (opts?.uhrzeit) p.set("uhrzeit", opts.uhrzeit);
        const q = p.toString();
        navigate(q ? `/termine/neu?${q}` : "/termine/neu");
    }, [navigate, praxisPlanCfg.defaultArztId]);
    const toast = useToastStore((s) => s.add);

    const artFilterOptions = useMemo(
        () => [{ value: "", label: t("termine.filter.all_types") }, ...terminArtFilterOptions()],
        [t],
    );

    const statusFilterOptions = useMemo(
        () => [
            { value: "", label: t("termine.filter.all_status") },
            ...Object.keys(statusBadge).map((k) => ({
                value: k,
                label: t(`dashboard.status.${k}`) !== `dashboard.status.${k}` ? t(`dashboard.status.${k}`) : k.replace(/_/g, " "),
            })),
        ],
        [t],
    );

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const [t, p, a] = await Promise.all([listTermine(), listPatienten(), listAerzte()]);
            setTermine(t);
            setPatienten(p);
            setAerzte(a);
            try {
                setAbwesenheiten(await listAbwesenheiten());
            } catch {
                setAbwesenheiten([]);
            }
            try {
                setPraxisPlanCfg(await loadPraxisArbeitszeitenConfig());
            } catch {
                setPraxisPlanCfg(readPraxisArbeitszeitenConfig());
            }
            try {
                const praef = await loadPraxisPraeferenzenFromKv();
                setTerminPufferMin(Math.max(0, Number.parseInt(String(praef.pufferMin ?? "0"), 10) || 0));
            } catch {
                setTerminPufferMin(0);
            }
        } catch (e) {
            setLoadError(errorMessage(e));
            setTermine([]);
            setPatienten([]);
            setAerzte([]);
            setAbwesenheiten([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const refreshMonthCalPrefs = () => {
            void loadPraxisPraeferenzenFromKv().then((p) => {
                setMonthCalPatientLoad(p.monthCalendarPatientLoad);
                setTerminPufferMin(Math.max(0, Number.parseInt(String(p.pufferMin ?? "0"), 10) || 0));
            });
        };
        const refreshPraxisPlan = () => {
            void loadPraxisArbeitszeitenConfig()
                .then(setPraxisPlanCfg)
                .catch((e) => toast(tp("termine.page.toast_work_hours", { message: errorMessage(e) }), "warning"));
            void listAbwesenheiten()
                .then(setAbwesenheiten)
                .catch(() => setAbwesenheiten([]));
        };
        refreshMonthCalPrefs();
        refreshPraxisPlan();
        const onVis = () => {
            if (document.visibilityState === "visible") {
                refreshMonthCalPrefs();
                refreshPraxisPlan();
            }
        };
        document.addEventListener("visibilitychange", onVis);
        return () => document.removeEventListener("visibilitychange", onVis);
    }, [location.pathname, toast]);

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
        toast(t("termine.page.toast_deleted"));
        setDeleteId(null);
        setDrawerTermin((d) => (d?.id === id ? null : d));
        void load();
    };

    const handleStornieren = async (id: string) => {
        try {
            await updateTermin(id, { status: "ABGESAGT" });
            toast(t("termine.page.toast_storno"));
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
                if (filterArt) {
                    if (filterArt === "NOTFALL") {
                        if (!terminIstNotfallMarkiert(x)) return false;
                    } else if (x.art !== filterArt) return false;
                }
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
                toast(t("termine.page.toast_today"));
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
            const art = terminArtLabelFromTermin(term).toLowerCase();
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
        const dateStr = format(selectedDayDate, "EEEE, d. MMMM yyyy", { locale: dateFnsLocale });
        if (termine.length === 0) {
            return t("termine.page.empty_none");
        }
        if (tagViewHasActiveFilters) {
            return tp("termine.page.empty_day_filtered", { date: dateStr });
        }
        return tp("termine.page.empty_day_none", { date: dateStr });
    }, [selectedDayDate, tagViewHasActiveFilters, termine.length, dateFnsLocale, t, tp]);

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

    const headlineMonthYear = format(headlineAnchorDate, "MMMM yyyy", { locale: dateFnsLocale });
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
        if (filterArt) chips.push({ key: "art", label: artFilterOptions.find((a) => a.value === filterArt)?.label ?? filterArt });
        if (filterStatus) chips.push({ key: "st", label: filterStatus.replace(/_/g, " ") });
        return chips;
    }, [filterArztIds, aerzte, filterArt, filterStatus, artFilterOptions]);

    const toolbarNavLabel = useMemo(() => {
        if (view === "tag") return format(selectedDayDate, "EEEE, d. MMMM", { locale: dateFnsLocale });
        if (view === "woche") {
            const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const end = addDays(start, 6);
            const wn = getISOWeek(start);
            return tp("termine.page.week_label", {
                week: wn,
                start: format(start, "d.", { locale: dateFnsLocale }),
                end: format(end, "d. MMMM", { locale: dateFnsLocale }),
            });
        }
        return format(addMonths(new Date(), monthOffset), "MMMM yyyy", { locale: dateFnsLocale });
    }, [view, weekOffset, monthOffset, selectedDayDate, dateFnsLocale, tp]);

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
            const { updates, error } = computePackedUpdatesAfterMove(
                termine,
                id,
                datum,
                startMin,
                TERMIN_DEFAULT_DUR_MIN,
                terminPufferMin,
            );
            if (error) {
                toast(error);
                return;
            }
            if (updates.length === 0) return;
            const schedErr = validateTerminSchedulingUpdates(
                termine,
                updates,
                TERMIN_DEFAULT_DUR_MIN,
                praxisPlanCfg,
                abwesenheiten,
            );
            if (schedErr) {
                toast(schedErr, "error");
                return;
            }
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
                toast(updates.length > 1 ? tp("termine.page.toast_moved_many", { count: updates.length }) : t("termine.page.toast_moved"));
                await load();
                if (snap) setTerminDaySnapLabel(snap);
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, termine, praxisPlanCfg, abwesenheiten, terminPufferMin, t, tp],
    );

    const handleApptContextMenu = useCallback((termin: TCalEvent, e: ReactMouseEvent) => {
        e.preventDefault();
        if (Date.now() < suppressApptContextMenuUntilRef.current) {
            return;
        }
        setCtxMenu({ x: e.clientX, y: e.clientY, termin });
    }, []);

    useEffect(() => {
        const dragId = dragState?.id;
        if (!dragId) return undefined;
        dragPointerTravelRef.current = 0;
        dragLastClientRef.current = null;
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

            if (dragLastClientRef.current === null) {
                dragLastClientRef.current = { x: e.clientX, y: e.clientY };
            } else {
                const lx = dragLastClientRef.current.x;
                const ly = dragLastClientRef.current.y;
                dragPointerTravelRef.current += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
                dragLastClientRef.current = { x: e.clientX, y: e.clientY };
            }

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
            const travel = dragPointerTravelRef.current;
            dragPointerTravelRef.current = 0;
            dragLastClientRef.current = null;
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return;
            const changed = prev.currentDatum !== prev.originalDatum || prev.currentStartMin !== prev.originalStartMin;
            if (changed) {
                void commitDrag(prev.id, prev.currentDatum, prev.currentStartMin);
            }
            const endedDragGesture = changed || travel >= APPT_DRAG_TRAVEL_SUPPRESS_CTX_PX;
            if (endedDragGesture) {
                suppressApptContextMenuUntilRef.current = Date.now() + APPT_CTX_SUPPRESS_AFTER_DRAG_MS;
                if (view === "woche") {
                    suppressApptClickUntilRef.current = Date.now() + APPT_CLICK_SUPPRESS_AFTER_DROP_MS;
                }
            }
            setDragState(null);
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
        (termin: TCalEvent) => {
            setDrawerTermin(termin);
            setCtxMenu(null);
        },
        [],
    );

    const patchTerminLocal = useCallback(
        (id: string, patch: Record<string, unknown>) => {
            setTermine((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } as TCalEvent : x)));
            setDrawerTermin((dt) => (dt?.id === id ? { ...dt, ...patch } as TCalEvent : dt));
        },
        [],
    );

    const onDrawerStatus = useCallback(
        async (id: string, status: TCalEvent["status"]) => {
            try {
                await updateTermin(id, { status });
                patchTerminLocal(id, { status });
                toast(tp("termine.page.toast_status", { status: status.replace(/_/g, " ") }));
                await load();
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, patchTerminLocal, t, tp],
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
            <WorkspacePageHeader
                className="fade-up"
                headerClassName="schedule-header termin-page-head"
                titleLevel="h1"
                title={t("termine.page.title")}
                subtitle={
                    <div className="page-sub termin-page-sub">
                        <span>
                            {headlineMonthYear} · {tp("termine.page.planned_count", { count: geplantCount })}
                            {" · "}
                        </span>
                        <span className="termin-heute-accent">{tp("termine.page.heute", { count: heuteGeplantCount })}</span>
                    </div>
                }
                actions={
                    <div className="schedule-toolbar">
                        <div className="seg schedule-view-seg">
                            <button type="button" aria-pressed={view === "tag"} onClick={() => setView("tag")}>{t("termine.page.view.day")}</button>
                            <button type="button" aria-pressed={view === "woche"} onClick={() => setView("woche")}>{t("termine.page.view.week")}</button>
                            <button type="button" aria-pressed={view === "monat"} onClick={() => setView("monat")}>{t("termine.page.view.month")}</button>
                        </div>
                        <div className="schedule-quick-actions">
                            {CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED
                            && !loadClientSettings().workflows?.calendarEmergencyToolbarEnabled ? (
                                <DismissibleNotice
                                    className="app-notice--toolbar termin-cal-banner"
                                    variant="info"
                                    dismissKey="termin-cal-emergency-toolbar-hint"
                                    title={t("termine.page.banner_title")}
                                    subtitle={t("termine.page.banner_sub")}
                                />
                            ) : null}
                            <div className="termin-filter-anchor" ref={filterPopoverWrapRef}>
                                <button
                                    type="button"
                                    className="btn btn-subtle"
                                    aria-expanded={filterPopoverOpen}
                                    aria-haspopup="dialog"
                                    onClick={() => setFilterPopoverOpen((o) => !o)}
                                >
                                    <FilterIcon size={14} />
                                    {t("common.filter")}
                                    {activeFilterChips.length > 0 ? (
                                        <span className="termin-filter-badge">{activeFilterChips.length}</span>
                                    ) : null}
                                </button>
                            </div>
                            {/* DISABLED: Pause / Notfall — Kalender-Toolbar (Produkt: später reaktivieren)
                            <button type="button" className="btn btn-subtle" onClick={() => setPauseConfirmOpen(true)}>
                                <PauseIcon size={16} />
                                Pause
                            </button>
                            <button type="button" className="btn btn-subtle termin-btn-notfall" onClick={() => setNotfallConfirmOpen(true)}>
                                <AmbulanceIcon size={18} aria-hidden />
                                Notfall
                            </button>
                            */}
                            <button type="button" className="btn btn-accent schedule-primary-action" onClick={() => goNeuerTermin({ datum: selectedDayIso })}>
                                <PlusIcon />
                                {t("termine.page.new")}
                            </button>
                        </div>
                    </div>
                }
            />

            {filterPopoverOpen && filterPopoverFixed
                ? createPortal(
                      (
                          <div
                              ref={filterPopoverPanelRef}
                              className="termin-filter-popover termin-filter-popover--portal"
                              role="dialog"
                              aria-label={t("termine.filter.aria")}
                              style={{
                                  top: filterPopoverFixed.top,
                                  left: filterPopoverFixed.left,
                                  width: filterPopoverFixed.width,
                              }}
                          >
                              <div className="termin-filter-popover-section">
                                  <div className="termin-filter-popover-label">{t("termine.filter.doctor")}</div>
                                  {aerzte.length === 0 ? (
                                      <div className="termin-filter-empty">{t("termine.filter.no_doctors")}</div>
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
                                          {t("termine.filter.treatment_type")}
                                      </label>
                                      <select
                                          id={terminFilterArtSelectId}
                                          className="input-edit termin-filter-popover-select"
                                          value={filterArt}
                                          onChange={(e) => setFilterArt(e.target.value)}
                                      >
                                          {artFilterOptions.map((o) => (
                                              <option key={o.value || "all-art"} value={o.value}>
                                                  {o.label}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="termin-filter-popover-field">
                                      <label htmlFor={terminFilterStatusSelectId} className="termin-filter-popover-label">
                                          {t("termine.filter.status")}
                                      </label>
                                      <select
                                          id={terminFilterStatusSelectId}
                                          className="input-edit termin-filter-popover-select"
                                          value={filterStatus}
                                          onChange={(e) => setFilterStatus(e.target.value)}
                                      >
                                          {statusFilterOptions.map((o) => (
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
                                      {t("common.reset")}
                                  </button>
                                  <button type="button" className="btn btn-accent" onClick={() => setFilterPopoverOpen(false)}>
                                      {t("termine.filter.close")}
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
                        {t("termine.filter.clear_all")}
                    </button>
                </div>
            ) : null}

            <div className="card card-pad termin-toolbar-row fade-up">
                <button
                    type="button"
                    className="icon-btn"
                    title={t("termine.page.nav_back_title")}
                    aria-label={t("termine.page.nav_back")}
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
                    title={t("termine.page.nav_forward_title")}
                    aria-label={t("termine.page.nav_forward")}
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
                    {t("common.today")}
                </button>
                <div className="termin-toolbar-search input">
                    <SearchIcon size={16} aria-hidden />
                    <input
                        type="search"
                        placeholder={t("termine.page.search")}
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                        aria-label={t("termine.page.search_aria")}
                    />
                    {quickSearch.trim() ? (
                        <button type="button" className="icon-btn termin-search-clear" aria-label={t("termine.page.search_clear")} onClick={() => setQuickSearch("")}>
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
                        <PageLoading label={t("termine.page.loading")} />
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
                            onContextMenu={handleApptContextMenu}
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
                        <EmptyState icon="📅" title={t("termine.page.empty_title")} description={t("termine.page.empty_create")} />
                    ) : displayTermine.length === 0 ? (
                        <div className="card">
                            <EmptyState icon="🔍" title={t("termine.page.empty_no_match")} description={t("termine.page.empty_no_match_desc")} />
                            <div style={{ textAlign: "center", paddingBottom: 24 }}>
                                <button type="button" className="btn btn-accent" onClick={resetFilters}>{t("common.reset_filters")}</button>
                            </div>
                        </div>
                    ) : view === "monat" ? (
                        <TerminMonthCalendar
                            monthOffset={monthOffset}
                            onMonthChange={setMonthOffset}
                            termine={displayTermine}
                            aerzte={aerzte}
                            arztToneMap={arztToneMap}
                            patientLoadSettings={monthCalPatientLoad}
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
                            clickSuppressUntilRef={suppressApptClickUntilRef}
                            onHeaderDay={(iso) => {
                                jumpToIsoDate(iso);
                                setView("tag");
                            }}
                            onOpenDrawer={openDrawerFor}
                            onContextMenu={handleApptContextMenu}
                            onNewAt={(iso, min) => goNeuerTermin({ datum: iso, uhrzeit: minutesToUhrzeit(min) })}
                            nowMin={() => {
                                const n = new Date();
                                return n.getHours() * 60 + n.getMinutes();
                            }}
                        />
                    )}
            </div>
            </div>

            {/* DISABLED: Notfall-Bestätigungsdialog (Kalender-Toolbar)
            <Dialog
                open={notfallConfirmOpen}
                onClose={() => setNotfallConfirmOpen(false)}
                title=""
                labelledBy={notfallTitleId}
                className="modal--ios-confirm notfall-confirm-dialog"
            >
                <div className="ios-confirm">
                    <div className="ios-confirm-body">
                        <div className="confirm-icon" aria-hidden="true">
                            <AmbulanceIcon />
                        </div>
                        <h2 id={notfallTitleId} className="ios-confirm-title">
                            {t("termin.calendar.notfall_confirm_title")}
                        </h2>
                        <p className="ios-confirm-message">{t("termin.calendar.notfall_confirm_message")}</p>
                    </div>
                    <IosConfirmActions
                        cancelLabel="Abbrechen"
                        confirmLabel="Notfall einplanen"
                        onCancel={() => setNotfallConfirmOpen(false)}
                        destructive
                        onConfirm={() => {
                            const todayIso = format(new Date(), "yyyy-MM-dd");
                            setDayOffset(0);
                            setWeekOffset(0);
                            setMonthOffset(0);
                            setView("tag");
                            goNeuerTermin({ datum: todayIso, art: "NOTFALL", uhrzeit: "11:45" });
                            setNotfallConfirmOpen(false);
                            toast(t("termine.page.demo_emergency"));
                        }}
                    />
                </div>
            </Dialog>
            */}

            {/* DISABLED: Pause-Bestätigungsdialog (Kalender-Toolbar)
            <Dialog
                open={pauseConfirmOpen}
                onClose={() => setPauseConfirmOpen(false)}
                title=""
                labelledBy={pauseTitleId}
                className="modal--ios-confirm"
            >
                <div className="ios-confirm">
                    <div className="ios-confirm-body">
                        <h2 id={pauseTitleId} className="ios-confirm-title">
                            Pause einfügen?
                        </h2>
                        <p className="ios-confirm-message">{t("termine.page.pause_confirm")}</p>
                    </div>
                    <IosConfirmActions
                        cancelLabel="Abbrechen"
                        confirmLabel="Einfügen"
                        onCancel={() => setPauseConfirmOpen(false)}
                        onConfirm={() => {
                            setPauseConfirmOpen(false);
                            toast(t("termine.page.demo_pause"));
                        }}
                    />
                </div>
            </Dialog>
            */}

            {drawerTermin ? (
                <TerminDetailDrawer
                    termin={drawerTermin}
                    patientName={patientNameById.get(drawerTermin.patient_id) ?? t("termin.calendar.patient_fallback")}
                    patientPhone={patientById.get(drawerTermin.patient_id)?.telefon ?? null}
                    doctorLabel={aerzte.find((a) => a.id === drawerTermin.arzt_id)?.name ?? "—"}
                    onClose={() => setDrawerTermin(null)}
                    onBearbeiten={() => goNeuerTermin({ id: drawerTermin.id })}
                    onStornieren={() => void handleStornieren(drawerTermin.id)}
                    onReminder={() => {
                        const name = patientNameById.get(drawerTermin.patient_id) ?? t("termin.calendar.patient_fallback");
                        toast(tp("termine.page.reminder_prepared", { name }));
                    }}
                    onStatusChange={onDrawerStatus}
                    onPhone={() => {
                        const tel = patientById.get(drawerTermin.patient_id)?.telefon?.trim();
                        toast(tel ? tp("termine.page.toast_phone", { phone: tel }) : t("termine.page.toast_no_phone"));
                    }}
                />
            ) : null}

            {ctxMenu ? (
                <TerminContextMenu
                    termin={ctxMenu.termin}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    patientName={patientNameById.get(ctxMenu.termin.patient_id) ?? t("termin.calendar.patient_fallback")}
                    onClose={() => setCtxMenu(null)}
                    onOpenDetails={() => openDrawerFor(ctxMenu.termin)}
                    onBearbeiten={() => goNeuerTermin({ id: ctxMenu.termin.id })}
                    onStornieren={() => void handleStornieren(ctxMenu.termin.id)}
                    onReminder={() => {
                        const name = patientNameById.get(ctxMenu.termin.patient_id) ?? t("termin.calendar.patient_fallback");
                        toast(tp("termine.page.reminder_prepared", { name }));
                    }}
                />
            ) : null}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t("termine.page.delete_title")}
                message={t("termine.page.delete_confirm")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}

