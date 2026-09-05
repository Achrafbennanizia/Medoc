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
import { listAppointmentsPaged, deleteAppointment, updateAppointment } from "@/systems/practice-host/controllers/appointment.controller";
import { useDateFnsLocale, useT, useTParams, useLocale, isRtlLocale } from "@/lib/i18n";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { LAZY_PAGE_SIZE, mergeUniqueById } from "@/lib/lazy-list";
import { listAbsences } from "@/systems/practice-host/controllers/practice.controller";
import { errorMessage } from "@/lib/utils";
import { MEDOC_PENDING_APPOINTMENT_MENU_KEY } from "@/lib/native-go-menu";
import { CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED } from "@/lib/settings-ui-flags";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { appointmentIsEmergencyMarked, parseAppointmentDurationMin } from "@/lib/appointment-domain";
import {
    DEFAULT_CLIENT_SETTINGS,
    loadClientSettings,
    mergeClientSettingsPatch,
    saveClientSettings,
} from "@/lib/client-settings";
import {
    DEFAULT_MONTH_CAL_PATIENT_LOAD,
    loadPracticePreferencesFromKv,
    type MonthCalendarPatientLoadPrefs,
} from "@/lib/practice-preferences-storage";
import {
    loadPracticeWorkHoursConfig,
    readPracticeWorkHoursConfig,
    type PracticeWorkHoursConfig,
} from "@/lib/practice-planning";
import { usePracticeWorkHoursStore } from "@/models/store/practice-work-hours-store";
import { PRACTICE_WORK_HOURS_CHANGED_EVENT } from "@/lib/appointment-calendar-layout";
import { validateAppointmentSchedulingUpdates } from "@/lib/appointment-availability";
import { deriveDayPackingBounds, snapAppointmentDragPosition } from "@/lib/appointment-drag-snap";
import {
    clearAppointmentDragSession,
    findAppointmentDragColumnByIso,
    hitAppointmentDragHourGutter,
    invalidateAppointmentDragColumnCache,
    listAppointmentDragColumns,
    paintAppointmentDragVisual,
    paintAppointmentHourGutterSnap,
    pickAppointmentDragColumn,
    positionAppointmentDragGhost,
    setAppointmentDragNavEdge,
    detectWeekGridDragEdge,
    detectCanvasDragEdge,
    appointmentDragPatchChanged,
    type AppointmentDragPatch,
} from "@/lib/appointment-drag-runtime";
import type { Appointment as TCalEvent, Patient, Absence } from "../../models/types";
import { ConfirmDialog } from "../components/ui/dialog";
// import { Dialog, IosConfirmActions } from "../components/ui/dialog"; — pause/emergency dialogs disabled
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AppointmentContextMenu } from "../components/appointment-context-menu";
import { AppointmentDetailDrawer } from "../components/appointment-detail-drawer";
import { DoctorLegend } from "../components/appointment-doctor-legend";
import { AppointmentMonthCalendar } from "../components/appointment-month-calendar";
import { AppointmentDaySplit, AppointmentWeekGrid } from "../components/appointment-week-day-grid";
import { WorkspacePageHeader } from "../components/administration-page-header";
import {
    // AmbulanceIcon, — calendar: emergency toolbar temporarily disabled
    ChevronLeftIcon,
    ChevronRightIcon,
    FilterIcon,
    // PauseIcon,
    PlusIcon,
    SearchIcon,
    XIcon,
} from "@/lib/icons";
import {
    buildPhysicianToneMap,
    calendarMonthOffsetFromToday,
    computePackedUpdatesAfterMove,
    deriveAppointmentTimelineBounds,
    deriveDayTimelineBounds,
    deriveWeekTimelineBounds,
    minutesToTime,
    appointmentKindLabelFromAppointment,
    appointmentKindFilterOptions,
    appointmentCalendarWeekDays,
    appointmentCountsAsPlanned,
    appointmentTimeToMinutes,
    APPOINTMENT_DEFAULT_DUR_MIN,
    APPOINTMENT_PX_PER_MIN,
    APPOINTMENT_STATUS_BADGE,
} from "@/lib/appointment-calendar-ui";

const statusBadge = APPOINTMENT_STATUS_BADGE;
const PX_PER_MIN = APPOINTMENT_PX_PER_MIN;
/** Day view: dragging left/right beside the grid changes target date (±1 day). */
const DAY_DRAG_EDGE_PX = 40;
/** In-component border zone (px) that triggers week/day navigation while dragging. */
const CANVAS_DRAG_EDGE_ZONE_PX = 36;
/** Week view: extra grab area outside the grid (still supported). */
const WEEK_NAV_EDGE_PX = 48;
/** While dragging: calendar day or week changes at most once every 500 ms (avoids walk-through). */
const DRAG_DATE_NAV_COOLDOWN_MS = 500;
/** After drag: briefly suppress context menu (trackpad/OS often fires "contextmenu" on release). */
const APPT_CTX_SUPPRESS_AFTER_DRAG_MS = 1400;
/** Week view: block first click after drag (browser often fires click right after mouseup on Appointment button). */
const APPT_CLICK_SUPPRESS_AFTER_DROP_MS = 500;
/** Sum of pointer movement (|dx|+|dy|) from drag start — above this threshold counts as drag gesture. */
const APPT_DRAG_TRAVEL_SUPPRESS_CTX_PX = 6;

const timeToMinutes = appointmentTimeToMinutes;

export function AppointmentsPage() {
    const t = useT();
    const tp = useTParams();
    const locale = useLocale((s) => s.locale);
    const rtl = isRtlLocale(locale);
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [appointments, setAppointments] = useState<TCalEvent[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [physicians, setPhysicians] = useState<PhysicianSummary[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [practicePlanCfg, setPracticePlanCfg] = useState<PracticeWorkHoursConfig>(() => readPracticeWorkHoursConfig());
    const storePracticeCfg = usePracticeWorkHoursStore((s) => s.config);
    const [appointmentBufferMin, setAppointmentBufferMin] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [monthCalPatientLoad, setMonthCalPatientLoad] = useState<MonthCalendarPatientLoadPrefs>(() => ({
        ...DEFAULT_MONTH_CAL_PATIENT_LOAD,
    }));
    // const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false);
    // const emergencyTitleId = useId();
    const appointmentFilterKindSelectId = useId();
    const appointmentFilterStatusSelectId = useId();
    const [view, setView] = useState<"day" | "week" | "month">(() => {
        const version = loadClientSettings().workflows?.appointmentsDefaultView;
        if (version === "day" || version === "week" || version === "month") return version;
        const d = DEFAULT_CLIENT_SETTINGS.workflows?.appointmentsDefaultView;
        if (d === "day" || d === "week" || d === "month") return d;
        return "month";
    });
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    const [dayOffset, setDayOffset] = useState(0);
    const [monthOffset, setMonthOffset] = useState(0);
    const [filterKind, setFilterKind] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterPhysicianIds, setFilterPhysicianIds] = useState<string[]>([]);
    const [quickSearch, setQuickSearch] = useState("");
    const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
    const filterPopoverWrapRef = useRef<HTMLDivElement | null>(null);
    const filterPopoverPanelRef = useRef<HTMLDivElement | null>(null);
    const [filterPopoverFixed, setFilterPopoverFixed] = useState<null | { top: number; inlineStart: number; width: number }>(
        null,
    );
    // const [pauseConfirmOpen, setPauseConfirmOpen] = useState(false);
    // const pauseTitleId = useId();
    const [drawerAppointment, setDrawerAppointment] = useState<TCalEvent | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; appointment: TCalEvent } | null>(null);
    const [dragState, setDragState] = useState<null | {
        id: string;
        physicianId: string;
        date: string;
        durMin: number;
        originalDate: string;
        originalStartMin: number;
        currentDate: string;
        currentStartMin: number;
        dropAllowed: boolean;
    }>(null);
    /** Day view: last hour chosen via drag on the hour rail (persists until new interaction). */
    const [appointmentDaySnapLabel, setAppointmentDaySnapLabel] = useState<null | { iso: string; startMin: number }>(null);
    const dragStateRef = useRef(dragState);
    useLayoutEffect(() => {
        dragStateRef.current = dragState;
    }, [dragState]);
    /** Last change of `currentDate` via drag (day column, edge, week ±1). */
    const lastDragDateNavAtRef = useRef(0);
    const suppressApptContextMenuUntilRef = useRef(0);
    /** Week view only: re-allow Appointment tile click after drag-drop (see `APPT_CLICK_SUPPRESS_AFTER_DROP_MS`). */
    const suppressApptClickUntilRef = useRef(0);
    const dragPointerTravelRef = useRef(0);
    const dragLastClientRef = useRef<{ x: number; y: number } | null>(null);
    const dragRafRef = useRef<number | null>(null);
    const dragMoveEventRef = useRef<MouseEvent | null>(null);
    const lastDragPatchRef = useRef<AppointmentDragPatch | null>(null);
    const practicePlanCfgRef = useRef(practicePlanCfg);
    const absencesRef = useRef(absences);
    practicePlanCfgRef.current = practicePlanCfg;
    absencesRef.current = absences;
    const goNewAppointment = useCallback((opts?: {
        date?: string;
        patient_id?: string;
        kind?: string;
        id?: string;
        time?: string;
        physician_id?: string;
    }) => {
        const p = new URLSearchParams();
        if (opts?.id) {
            p.set("id", opts.id);
        } else {
            const aid = opts?.physician_id ?? practicePlanCfg.defaultPhysicianId;
            if (aid) p.set("physician_id", aid);
        }
        if (opts?.date) p.set("date", opts.date);
        if (opts?.patient_id) p.set("patient_id", opts.patient_id);
        if (opts?.kind) p.set("kind", opts.kind);
        if (opts?.time) p.set("time", opts.time);
        const q = p.toString();
        navigate(q ? `/appointments/new?${q}` : "/appointments/new");
    }, [navigate, practicePlanCfg.defaultPhysicianId]);
    const toast = useToastStore((s) => s.add);

    const kindFilterOptions = useMemo(
        () => [{ value: "", label: t("appointments.filter.all_types") }, ...appointmentKindFilterOptions()],
        [t],
    );

    const statusFilterOptions = useMemo(
        () => [
            { value: "", label: t("appointments.filter.all_status") },
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
            // Calendar needs a date window, not the full year seed (8k+ rows).
            const today = new Date();
            const from = new Date(today.getFullYear(), today.getMonth() - 2, 1);
            const to = new Date(today.getFullYear(), today.getMonth() + 3, 0);
            const ymd = (d: Date) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            let page = 1;
            let total = Infinity;
            let appts: Awaited<ReturnType<typeof listAppointmentsPaged>>["items"] = [];
            while (appts.length < total) {
                const resp = await listAppointmentsPaged({
                    page,
                    pageSize: LAZY_PAGE_SIZE,
                    filter: { dateFrom: ymd(from), dateTo: ymd(to) },
                });
                total = resp.total;
                appts = mergeUniqueById(appts, resp.items);
                if (resp.items.length === 0 || page * resp.pageSize >= total) break;
                page += 1;
                if (page > 100) break;
            }
            const patientIds = [...new Set(appts.map((a) => a.patient_id).filter(Boolean))];
            const [p, a] = await Promise.all([
                patientIds.length ? listPatientsByIds(patientIds) : Promise.resolve([]),
                listPhysicians(),
            ]);
            setAppointments(appts);
            setPatients(p);
            setPhysicians(a);
            try {
                setAbsences(await listAbsences());
            } catch {
                setAbsences([]);
            }
            try {
                setPracticePlanCfg(await loadPracticeWorkHoursConfig());
            } catch {
                setPracticePlanCfg(readPracticeWorkHoursConfig());
            }
            try {
                const prefs = await loadPracticePreferencesFromKv();
                setAppointmentBufferMin(Math.max(0, Number.parseInt(String(prefs.bufferMin ?? "0"), 10) || 0));
            } catch {
                setAppointmentBufferMin(0);
            }
        } catch (e) {
            setLoadError(errorMessage(e));
            setAppointments([]);
            setPatients([]);
            setPhysicians([]);
            setAbsences([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        setPracticePlanCfg(storePracticeCfg);
    }, [storePracticeCfg]);

    useEffect(() => {
        const refreshMonthCalPrefs = () => {
            void loadPracticePreferencesFromKv().then((p) => {
                setMonthCalPatientLoad(p.monthCalendarPatientLoad);
                setAppointmentBufferMin(Math.max(0, Number.parseInt(String(p.bufferMin ?? "0"), 10) || 0));
            });
        };
        const refreshPracticePlan = () => {
            void loadPracticeWorkHoursConfig()
                .then(setPracticePlanCfg)
                .catch((e) => toast(tp("appointments.page.toast_work_hours", { message: errorMessage(e) }), "warning"));
            void listAbsences()
                .then(setAbsences)
                .catch(() => setAbsences([]));
        };
        refreshMonthCalPrefs();
        refreshPracticePlan();
        const onVis = () => {
            if (document.visibilityState === "visible") {
                refreshMonthCalPrefs();
                refreshPracticePlan();
            }
        };
        document.addEventListener("visibilitychange", onVis);
        const onCfgChanged = () => {
            void loadPracticeWorkHoursConfig()
                .then(setPracticePlanCfg)
                .catch(() => setPracticePlanCfg(readPracticeWorkHoursConfig()));
        };
        window.addEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
        return () => {
            document.removeEventListener("visibilitychange", onVis);
            window.removeEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
        };
    }, [location.pathname, toast]);

    useEffect(() => {
        const cur = loadClientSettings();
        const w = cur.workflows ?? DEFAULT_CLIENT_SETTINGS.workflows!;
        if (w.appointmentsDefaultView === view) return;
        saveClientSettings(mergeClientSettingsPatch(cur, { workflows: { ...w, appointmentsDefaultView: view } }));
    }, [view]);

    const handleDelete = async () => {
        if (!deleteId) return;
        const id = deleteId;
        await deleteAppointment(id);
        toast(t("appointments.page.toast_deleted"));
        setDeleteId(null);
        setDrawerAppointment((d) => (d?.id === id ? null : d));
        void load();
    };

    const handleStornieren = async (id: string) => {
        try {
            await updateAppointment(id, { status: "CANCELLED" });
            toast(t("appointments.page.toast_storno"));
            setDrawerAppointment((d) => (d?.id === id ? null : d));
            setCtxMenu(null);
            await load();
        } catch (e) {
            toast(errorMessage(e));
        }
    };

    const patientNameById = useMemo(
        () => new Map(patients.map((p) => [p.id, p.name])),
        [patients],
    );

    const patientById = useMemo(
        () => new Map(patients.map((p) => [p.id, p])),
        [patients],
    );

    const physicianToneMap = useMemo(() => buildPhysicianToneMap(physicians), [physicians]);

    const baseFilteredAppointments = useMemo(
        () =>
            appointments.filter((x) => {
                if (filterKind) {
                    if (filterKind === "EMERGENCY" || filterKind === "NOTFALL") {
                        if (!appointmentIsEmergencyMarked(x)) return false;
                    } else if (x.kind !== filterKind) return false;
                }
                if (filterStatus && x.status !== filterStatus) return false;
                if (filterPhysicianIds.length > 0 && !filterPhysicianIds.includes(x.physician_id)) return false;
                return true;
            }),
        [appointments, filterKind, filterStatus, filterPhysicianIds],
    );

    const displayAppointments = useMemo(() => {
        const q = quickSearch.trim().toLowerCase();
        if (!q) return baseFilteredAppointments;
        return baseFilteredAppointments.filter((t) => {
            const hay = `${patientNameById.get(t.patient_id) ?? ""} ${t.kind} ${t.status} ${t.date} ${t.time}`
                .toLowerCase();
            return hay.includes(q);
        });
    }, [baseFilteredAppointments, quickSearch, patientNameById]);

    const selectedDayDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset]);
    const selectedDayIso = format(selectedDayDate, "yyyy-MM-dd");

    const timelineBounds = useMemo(() => {
        if (view === "day") return deriveDayTimelineBounds(practicePlanCfg, selectedDayIso);
        if (view === "week") {
            const anchor = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const days = appointmentCalendarWeekDays(anchor, practicePlanCfg);
            return deriveWeekTimelineBounds(
                practicePlanCfg,
                days.map((d) => format(d, "yyyy-MM-dd")),
            );
        }
        return deriveAppointmentTimelineBounds(practicePlanCfg);
    }, [view, practicePlanCfg, selectedDayIso, weekOffset]);
    const dayStartMin = timelineBounds.startMin;
    const dayEndMin = timelineBounds.endMin;

    useEffect(() => {
        if (view !== "day") return;
        setMonthOffset(calendarMonthOffsetFromToday(addDays(new Date(), dayOffset)));
    }, [view, dayOffset]);

    useEffect(() => {
        setAppointmentDaySnapLabel(null);
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
                setView("day");
            } else if (k === "w") {
                e.preventDefault();
                setView("week");
            } else if (k === "m") {
                e.preventDefault();
                setView("month");
            } else if (k === "t") {
                e.preventDefault();
                setDayOffset(0);
                setWeekOffset(0);
                setMonthOffset(0);
                setView("day");
                toast(t("appointments.page.toast_today"));
            } else if (k === "n") {
                e.preventDefault();
                goNewAppointment({ date: selectedDayIso });
            }
        };
        const onKeyNav = (e: KeyboardEvent) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            if (isTypingTarget(e.target)) return;
            e.preventDefault();
            const dir = e.key === "ArrowLeft" ? -1 : 1;
            if (view === "month") setMonthOffset((o) => o + dir);
            else if (view === "week") setWeekOffset((w) => w + dir);
            else setDayOffset((d) => d + dir);
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("keydown", onKeyNav);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("keydown", onKeyNav);
        };
    }, [view, toast, goNewAppointment, selectedDayIso]);

    useEffect(() => {
        const q = quickSearch.trim().toLowerCase();
        if (q.length < 2) return;
        const match = baseFilteredAppointments.find((term) => {
            const name = (patientNameById.get(term.patient_id) ?? "").toLowerCase();
            const kind = appointmentKindLabelFromAppointment(term).toLowerCase();
            return name.includes(q) || kind.includes(q);
        });
        if (!match) return;
        const d = parseISO(match.date);
        const off = differenceInCalendarDays(d, new Date());
        setDayOffset(off);
    }, [quickSearch, baseFilteredAppointments, patientNameById]);

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
            const inlineStart = rtl
                ? Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
                : Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
            const top = r.bottom + 8;
            setFilterPopoverFixed({ top, inlineStart, width });
        };
        update();
        window.addEventListener("resize", update);
        document.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            document.removeEventListener("scroll", update, true);
        };
    }, [filterPopoverOpen, rtl]);

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
            if (t?.closest?.(".appointment-ctx-menu")) return;
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
            goNewAppointment({ patient_id: patientId, date: selectedDayIso });
            setSearchParams((prev) => {
                const p = new URLSearchParams(prev);
                p.delete("patient_id");
                p.delete("new");
                return p;
            }, { replace: true });
        }
    }, [searchParams, setSearchParams, goNewAppointment, selectedDayIso]);

    const tagAppointments = useMemo(() => {
        const dragFollowId = dragState?.id ?? null;
        return displayAppointments.filter(
            (t) =>
                t.date === selectedDayIso ||
                (view === "day" && dragFollowId != null && dragFollowId === t.id),
        );
    }, [displayAppointments, selectedDayIso, view, dragState?.id]);

    const tagViewHasActiveFilters = useMemo(
        () => Boolean(quickSearch.trim() || filterKind || filterStatus || filterPhysicianIds.length > 0),
        [quickSearch, filterKind, filterStatus, filterPhysicianIds],
    );
    const tagViewEmptyDescription = useMemo(() => {
        const dateStr = format(selectedDayDate, "EEEE, d. MMMM yyyy", { locale: dateFnsLocale });
        if (appointments.length === 0) {
            return t("appointments.page.empty_none");
        }
        if (tagViewHasActiveFilters) {
            return tp("appointments.page.empty_day_filtered", { date: dateStr });
        }
        return tp("appointments.page.empty_day_none", { date: dateStr });
    }, [selectedDayDate, tagViewHasActiveFilters, appointments.length, dateFnsLocale, t, tp]);

    const resetFilters = () => {
        setFilterKind("");
        setFilterStatus("");
        setFilterPhysicianIds([]);
        setQuickSearch("");
    };

    const headlineAnchorDate = useMemo(() => {
        if (view === "month") return addMonths(new Date(), monthOffset);
        if (view === "week") return startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
        return selectedDayDate;
    }, [view, monthOffset, weekOffset, selectedDayDate]);

    const headlineMonthYear = format(headlineAnchorDate, "MMMM yyyy", { locale: dateFnsLocale });
    const plannedCount = useMemo(
        () => baseFilteredAppointments.filter(appointmentCountsAsPlanned).length,
        [baseFilteredAppointments],
    );
    const heuteIso = format(new Date(), "yyyy-MM-dd");
    const heutePlannedCount = useMemo(
        () =>
            baseFilteredAppointments.filter((x) => x.date === heuteIso && appointmentCountsAsPlanned(x)).length,
        [baseFilteredAppointments, heuteIso],
    );

    const activeFilterChips = useMemo(() => {
        const chips: { key: string; label: string }[] = [];
        for (const id of filterPhysicianIds) {
            const name = physicians.find((a) => a.id === id)?.name ?? id;
            chips.push({ key: `physician:${id}`, label: name });
        }
        if (filterKind) chips.push({ key: "kind", label: kindFilterOptions.find((a) => a.value === filterKind)?.label ?? filterKind });
        if (filterStatus) chips.push({ key: "st", label: filterStatus.replace(/_/g, " ") });
        return chips;
    }, [filterPhysicianIds, physicians, filterKind, filterStatus, kindFilterOptions]);

    const toolbarNavLabel = useMemo(() => {
        if (view === "day") return format(selectedDayDate, "EEEE, d. MMMM", { locale: dateFnsLocale });
        if (view === "week") {
            const start = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
            const days = appointmentCalendarWeekDays(start, practicePlanCfg);
            const end = days[days.length - 1] ?? addDays(start, 6);
            const wn = getISOWeek(start);
            return tp("appointments.page.week_label", {
                week: wn,
                start: format(start, "d.", { locale: dateFnsLocale }),
                end: format(end, "d. MMMM", { locale: dateFnsLocale }),
            });
        }
        return format(addMonths(new Date(), monthOffset), "MMMM yyyy", { locale: dateFnsLocale });
    }, [view, weekOffset, monthOffset, selectedDayDate, dateFnsLocale, tp, practicePlanCfg]);

    const jumpToIsoDate = useCallback((iso: string) => {
        const d = parseISO(iso);
        setDayOffset(differenceInCalendarDays(d, new Date()));
    }, []);
    const jumpToIsoDateRef = useRef(jumpToIsoDate);
    useLayoutEffect(() => {
        jumpToIsoDateRef.current = jumpToIsoDate;
    }, [jumpToIsoDate]);

    const commitDrag = useCallback(
        async (id: string, date: string, startMin: number) => {
            const moving = appointments.find((t) => t.id === id);
            const dayBounds =
                moving?.physician_id != null
                    ? (deriveDayPackingBounds(practicePlanCfg, moving.physician_id, date) ?? timelineBounds)
                    : timelineBounds;
            const slotDur = moving
                ? Math.max(5, parseAppointmentDurationMin(moving.notes, APPOINTMENT_DEFAULT_DUR_MIN))
                : APPOINTMENT_DEFAULT_DUR_MIN;
            const { updates, error } = computePackedUpdatesAfterMove(
                appointments,
                id,
                date,
                startMin,
                slotDur,
                appointmentBufferMin,
                dayBounds,
            );
            if (error) {
                toast(error);
                return;
            }
            if (updates.length === 0) return;
            const schedErr = validateAppointmentSchedulingUpdates(
                appointments,
                updates,
                slotDur,
                practicePlanCfg,
                absences,
                t,
            );
            if (schedErr) {
                toast(schedErr, "error");
                return;
            }
            const moved = updates.find((u) => u.id === id);
            let snap: { iso: string; startMin: number } | undefined;
            if (moved?.data.time) {
                const ustr = moved.data.time as string;
                const dstr = (moved.data.date as string | undefined) ?? date;
                snap = { iso: dstr, startMin: timeToMinutes(ustr) };
            }
            try {
                for (const u of updates) {
                    await updateAppointment(u.id, u.data);
                }
                toast(updates.length > 1 ? tp("appointments.page.toast_moved_many", { count: updates.length }) : t("appointments.page.toast_moved"));
                await load();
                if (snap) setAppointmentDaySnapLabel(snap);
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, appointments, practicePlanCfg, absences, appointmentBufferMin, timelineBounds, t, tp],
    );

    const handleApptContextMenu = useCallback((appointment: TCalEvent, e: ReactMouseEvent) => {
        e.preventDefault();
        if (Date.now() < suppressApptContextMenuUntilRef.current) {
            return;
        }
        setCtxMenu({ x: e.clientX, y: e.clientY, appointment });
    }, []);

    useEffect(() => {
        const dragId = dragState?.id;
        if (!dragId) return undefined;
        dragPointerTravelRef.current = 0;
        dragLastClientRef.current = null;
        dragMoveEventRef.current = null;
        lastDragPatchRef.current = null;
        invalidateAppointmentDragColumnCache();
        document.body.classList.add("appointment-calendar-dragging");

        lastDragPatchRef.current = {
            currentDate: dragState.currentDate,
            currentStartMin: dragState.currentStartMin,
            dropAllowed: dragState.dropAllowed,
        };

        const spanMin = dayEndMin - dayStartMin;
        const timelineBoundsLocal = { startMin: dayStartMin, endMin: dayEndMin };
        const weekCanvas = document.querySelector<HTMLElement>("[data-appointment-week-canvas]");
        const dayCanvas = document.querySelector<HTMLElement>("[data-appointment-day-canvas]");
        let weekCanvasRect = weekCanvas?.getBoundingClientRect() ?? null;
        let dayCanvasRect = dayCanvas?.getBoundingClientRect() ?? null;

        const activeDragDate = () =>
            lastDragPatchRef.current?.currentDate ?? dragStateRef.current?.currentDate ?? "";
        const activeDragStartMin = () =>
            lastDragPatchRef.current?.currentStartMin ?? dragStateRef.current?.currentStartMin ?? 0;

        const repaintAfterNav = () => {
            requestAnimationFrame(() => {
                invalidateAppointmentDragColumnCache();
                const patch = lastDragPatchRef.current;
                if (patch) {
                    paintDragVisual(patch.currentDate, patch.currentStartMin, !patch.dropAllowed);
                }
            });
        };

        const pxPerMinForColumn = (height: number) => (height > 8 ? height / spanMin : PX_PER_MIN);

        const paintDragVisual = (finalIso: string, startMin: number, dropAllowed: boolean) => {
            const col = findAppointmentDragColumnByIso(finalIso);
            if (!col) return;
            const topPx = (startMin - dayStartMin) * pxPerMinForColumn(col.height);
            if (view === "week") {
                positionAppointmentDragGhost(col, topPx, startMin, !dropAllowed);
            } else {
                paintAppointmentDragVisual(topPx, startMin, !dropAllowed);
            }
            paintAppointmentHourGutterSnap(topPx, startMin);
        };

        const commitDragPatch = (patch: AppointmentDragPatch) => {
            paintDragVisual(patch.currentDate, patch.currentStartMin, patch.dropAllowed);
            if (!appointmentDragPatchChanged(lastDragPatchRef.current, patch)) return;
            lastDragPatchRef.current = patch;
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return;
            dragStateRef.current = { ...prev, ...patch };
            if (view === "week") return;
            setDragState((p) => (p && p.id === dragId ? { ...p, ...patch } : p));
        };

        const resolveSnapped = (targetIso: string, rawMin: number) => {
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return null;
            return snapAppointmentDragPosition({
                practiceCfg: practicePlanCfgRef.current,
                absences: absencesRef.current,
                physicianId: prev.physicianId,
                isoDate: targetIso,
                rawStartMin: rawMin,
                durMin: prev.durMin,
                timelineBounds: timelineBoundsLocal,
            });
        };

        const clampStartMin = (rawMin: number, durMin: number) => {
            const snapped = Math.round(rawMin / 5) * 5;
            const lo = dayStartMin;
            const hi = dayEndMin - durMin;
            return Math.max(lo, Math.min(snapped, hi));
        };

        const timeFromY = (clientY: number, colTop: number, colHeight: number, durMin: number) => {
            const y = clientY - colTop;
            const minRaw = dayStartMin + y / pxPerMinForColumn(colHeight);
            return clampStartMin(minRaw, durMin);
        };

        const applyDragTimeline = (targetIso: string, rawMin: number, jumpIfDayChanges: boolean) => {
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return;

            const activeDate = lastDragPatchRef.current?.currentDate ?? prev.currentDate;
            if (targetIso !== activeDate) {
                const probe = resolveSnapped(targetIso, rawMin);
                if (!probe?.dayAllowed) return;
                if (view !== "week") {
                    const nowTs = Date.now();
                    if (nowTs - lastDragDateNavAtRef.current < DRAG_DATE_NAV_COOLDOWN_MS) return;
                    lastDragDateNavAtRef.current = nowTs;
                }
            }

            const snap = resolveSnapped(targetIso, rawMin);
            if (!snap) return;
            const finalIso = snap.dayAllowed ? targetIso : activeDate;
            const finalSnap = snap.dayAllowed ? snap : resolveSnapped(activeDate, rawMin);
            if (!finalSnap) return;

            commitDragPatch({
                currentDate: finalIso,
                currentStartMin: finalSnap.startMin,
                dropAllowed: finalSnap.dayAllowed && finalSnap.slotAllowed,
            });

            if (jumpIfDayChanges && view !== "week" && finalIso !== activeDate && snap.dayAllowed) {
                jumpToIsoDateRef.current(finalIso);
            }
        };

        const tryWeekHop = (deltaDays: number, deltaWeekOffset: number, clientX: number, clientY: number) => {
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return false;
            const now = Date.now();
            if (now - lastDragDateNavAtRef.current < DRAG_DATE_NAV_COOLDOWN_MS) return true;
            const date = activeDragDate();
            const startMin = activeDragStartMin();
            const newDate = format(addDays(parseISO(date), deltaDays), "yyyy-MM-dd");
            const refCol =
                findAppointmentDragColumnByIso(date)
                ?? pickAppointmentDragColumn(clientX, clientY)
                ?? listAppointmentDragColumns()[0];
            const rawMin = refCol
                ? timeFromY(clientY, refCol.top, refCol.height, prev.durMin)
                : startMin;
            const snap = resolveSnapped(newDate, rawMin);
            if (!snap?.dayAllowed) return true;
            lastDragDateNavAtRef.current = now;
            setWeekOffset((w) => w + deltaWeekOffset);
            invalidateAppointmentDragColumnCache();
            commitDragPatch({
                currentDate: newDate,
                currentStartMin: snap.startMin,
                dropAllowed: snap.slotAllowed,
            });
            repaintAfterNav();
            return true;
        };

        const tryDayHop = (deltaDays: number, clientY: number) => {
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return false;
            const now = Date.now();
            if (now - lastDragDateNavAtRef.current < DRAG_DATE_NAV_COOLDOWN_MS) return true;
            const date = activeDragDate();
            const col = findAppointmentDragColumnByIso(date) ?? listAppointmentDragColumns()[0];
            const rawMin = col ? timeFromY(clientY, col.top, col.height, prev.durMin) : activeDragStartMin();
            const newDate = format(addDays(parseISO(date), deltaDays), "yyyy-MM-dd");
            const snap = resolveSnapped(newDate, rawMin);
            if (!snap?.dayAllowed || !snap.slotAllowed) return true;
            lastDragDateNavAtRef.current = now;
            commitDragPatch({
                currentDate: newDate,
                currentStartMin: snap.startMin,
                dropAllowed: true,
            });
            jumpToIsoDateRef.current(newDate);
            repaintAfterNav();
            return true;
        };

        const processMove = (e: MouseEvent) => {
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

            if (view === "week" && weekCanvasRect) {
                const edge = detectWeekGridDragEdge(
                    e.clientX,
                    e.clientY,
                    weekCanvasRect,
                    CANVAS_DRAG_EDGE_ZONE_PX,
                );
                const outsideLeft = e.clientX < weekCanvasRect.left - WEEK_NAV_EDGE_PX;
                const outsideRight = e.clientX > weekCanvasRect.right + WEEK_NAV_EDGE_PX;
                setAppointmentDragNavEdge(weekCanvas, edge);
                if (edge === "left" || outsideLeft) {
                    if (tryWeekHop(-7, -1, e.clientX, e.clientY)) return;
                }
                if (edge === "right" || outsideRight) {
                    if (tryWeekHop(7, 1, e.clientX, e.clientY)) return;
                }
            } else if (view === "day" && dayCanvasRect) {
                const edge = detectCanvasDragEdge(
                    e.clientX,
                    e.clientY,
                    dayCanvasRect,
                    CANVAS_DRAG_EDGE_ZONE_PX,
                );
                const outsideLeft = e.clientX < dayCanvasRect.left - DAY_DRAG_EDGE_PX;
                const outsideRight = e.clientX > dayCanvasRect.right + DAY_DRAG_EDGE_PX;
                setAppointmentDragNavEdge(dayCanvas, edge);
                if (edge === "left" || outsideLeft) {
                    if (tryDayHop(-1, e.clientY)) return;
                }
                if (edge === "right" || outsideRight) {
                    if (tryDayHop(1, e.clientY)) return;
                }
            } else {
                setAppointmentDragNavEdge(null, null);
            }

            if (view === "week") {
                const col = pickAppointmentDragColumn(e.clientX, e.clientY);
                if (col) {
                    applyDragTimeline(col.iso, timeFromY(e.clientY, col.top, col.height, ds.durMin), false);
                    return;
                }
                const gutter = hitAppointmentDragHourGutter(e.clientX, e.clientY);
                if (gutter) {
                    const activeDate = lastDragPatchRef.current?.currentDate ?? ds.currentDate;
                    applyDragTimeline(
                        activeDate,
                        timeFromY(e.clientY, gutter.top, gutter.height, ds.durMin),
                        false,
                    );
                }
                return;
            }

            const cols = listAppointmentDragColumns();
            const col = cols[0];
            if (col) {
                if (e.clientX >= col.left && e.clientX <= col.right) {
                    applyDragTimeline(col.iso, timeFromY(e.clientY, col.top, col.height, ds.durMin), false);
                    return;
                }
                const gutter = hitAppointmentDragHourGutter(e.clientX, e.clientY);
                if (gutter) {
                    applyDragTimeline(
                        activeDragDate(),
                        timeFromY(e.clientY, gutter.top, gutter.height, ds.durMin),
                        false,
                    );
                }
            }
        };

        const flushMove = () => {
            dragRafRef.current = null;
            const e = dragMoveEventRef.current;
            if (!e) return;
            processMove(e);
        };

        const onMove = (e: MouseEvent) => {
            dragMoveEventRef.current = e;
            if (dragRafRef.current != null) return;
            dragRafRef.current = requestAnimationFrame(flushMove);
        };

        const onScroll = () => {
            invalidateAppointmentDragColumnCache();
            weekCanvasRect = weekCanvas?.getBoundingClientRect() ?? null;
            dayCanvasRect = dayCanvas?.getBoundingClientRect() ?? null;
        };

        const onUp = () => {
            if (dragRafRef.current != null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }
            const travel = dragPointerTravelRef.current;
            dragPointerTravelRef.current = 0;
            dragLastClientRef.current = null;
            dragMoveEventRef.current = null;
            const prev = dragStateRef.current;
            if (!prev || prev.id !== dragId) return;
            const live = lastDragPatchRef.current;
            const finalDate = live?.currentDate ?? prev.currentDate;
            const finalStart = live?.currentStartMin ?? prev.currentStartMin;
            const finalDrop = live?.dropAllowed ?? prev.dropAllowed;
            lastDragPatchRef.current = null;
            const changed =
                finalDate !== prev.originalDate || finalStart !== prev.originalStartMin;
            if (changed) {
                if (finalDrop) {
                    void commitDrag(prev.id, finalDate, finalStart);
                } else {
                    toast(t("appointments.scheduling.outside_hours"), "error");
                }
            }
            const endedDragGesture = changed || travel >= APPT_DRAG_TRAVEL_SUPPRESS_CTX_PX;
            if (endedDragGesture) {
                suppressApptContextMenuUntilRef.current = Date.now() + APPT_CTX_SUPPRESS_AFTER_DRAG_MS;
                if (view === "week") {
                    suppressApptClickUntilRef.current = Date.now() + APPT_CLICK_SUPPRESS_AFTER_DROP_MS;
                }
            }
            clearAppointmentDragSession();
            document.body.classList.remove("appointment-calendar-dragging");
            setDragState(null);
        };

        window.addEventListener("mousemove", onMove, { passive: true });
        window.addEventListener("mouseup", onUp);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
            if (dragRafRef.current != null) {
                cancelAnimationFrame(dragRafRef.current);
                dragRafRef.current = null;
            }
            clearAppointmentDragSession();
            document.body.classList.remove("appointment-calendar-dragging");
            lastDragDateNavAtRef.current = 0;
        };
    }, [dragState?.id, view, commitDrag, dayStartMin, dayEndMin, t]);

    const openDrawerFor = useCallback(
        (appointment: TCalEvent) => {
            setDrawerAppointment(appointment);
            setCtxMenu(null);
        },
        [],
    );

    const patchAppointmentLocal = useCallback(
        (id: string, patch: Record<string, unknown>) => {
            setAppointments((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } as TCalEvent : x)));
            setDrawerAppointment((dt) => (dt?.id === id ? { ...dt, ...patch } as TCalEvent : dt));
        },
        [],
    );

    const onDrawerStatus = useCallback(
        async (id: string, status: TCalEvent["status"]) => {
            try {
                await updateAppointment(id, { status });
                patchAppointmentLocal(id, { status });
                toast(tp("appointments.page.toast_status", { status: status.replace(/_/g, " ") }));
                await load();
            } catch (e) {
                toast(errorMessage(e));
            }
        },
        [load, toast, patchAppointmentLocal, t, tp],
    );

    useEffect(() => {
        let pending: string | null = null;
        try {
            pending = sessionStorage.getItem(MEDOC_PENDING_APPOINTMENT_MENU_KEY);
            if (pending) sessionStorage.removeItem(MEDOC_PENDING_APPOINTMENT_MENU_KEY);
        } catch {
            /* ignore */
        }

        const onNativeAppointmentMenu = (ev: Event) => {
            const detail = (ev as CustomEvent<string>).detail;
            if (typeof detail !== "string") return;
            switch (detail) {
                case "view_day":
                    setView("day");
                    break;
                case "view_week":
                    setView("week");
                    break;
                case "view_month":
                    setView("month");
                    break;
                case "today":
                    setDayOffset(0);
                    setWeekOffset(0);
                    setMonthOffset(0);
                    setView("day");
                    break;
                case "nav_prev":
                    if (view === "month") setMonthOffset((o) => o - 1);
                    else if (view === "week") setWeekOffset((w) => w - 1);
                    else setDayOffset((d) => d - 1);
                    break;
                case "nav_next":
                    if (view === "month") setMonthOffset((o) => o + 1);
                    else if (view === "week") setWeekOffset((w) => w + 1);
                    else setDayOffset((d) => d + 1);
                    break;
                default:
                    break;
            }
        };
        window.addEventListener("medoc-native-menu-appointment", onNativeAppointmentMenu as EventListener);
        if (pending) {
            onNativeAppointmentMenu(new CustomEvent("medoc-native-menu-appointment", { detail: pending }));
        }
        return () => window.removeEventListener("medoc-native-menu-appointment", onNativeAppointmentMenu as EventListener);
    }, [view]);

    return (
        <div className="animate-fade-in schedule-page appointment-page appointment-page-root">
            <WorkspacePageHeader
                className="fade-up"
                headerClassName="schedule-header appointment-page-head"
                titleLevel="h1"
                title={t("appointments.page.title")}
                subtitle={
                    <div className="page-sub appointment-page-sub">
                        <span>
                            {headlineMonthYear} · {tp("appointments.page.planned_count", { count: plannedCount })}
                            {" · "}
                        </span>
                        <span className="appointment-heute-accent">{tp("appointments.page.heute", { count: heutePlannedCount })}</span>
                    </div>
                }
                actions={
                    <div className="schedule-toolbar">
                        <div className="seg schedule-view-seg">
                            <button type="button" aria-pressed={view === "day"} onClick={() => setView("day")}>{t("appointments.page.view.day")}</button>
                            <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>{t("appointments.page.view.week")}</button>
                            <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>{t("appointments.page.view.month")}</button>
                        </div>
                        <div className="schedule-quick-actions">
                            {CALENDAR_EMERGENCY_TOOLBAR_UI_ENABLED
                            && !loadClientSettings().workflows?.calendarEmergencyToolbarEnabled ? (
                                <DismissibleNotice
                                    className="app-notice--toolbar appointment-cal-banner"
                                    variant="info"
                                    dismissKey="appointment-cal-emergency-toolbar-hint"
                                    title={t("appointments.page.banner_title")}
                                    subtitle={t("appointments.page.banner_sub")}
                                />
                            ) : null}
                            <div className="appointment-filter-anchor" ref={filterPopoverWrapRef}>
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
                                        <span className="appointment-filter-badge">{activeFilterChips.length}</span>
                                    ) : null}
                                </button>
                            </div>
                            {/* DISABLED: Pause / emergency — calendar toolbar (product: re-enable later)
                            <button type="button" className="btn btn-subtle" onClick={() => setPauseConfirmOpen(true)}>
                                <PauseIcon size={16} />
                                Pause
                            </button>
                            <button type="button" className="btn btn-subtle appointment-btn-emergency" onClick={() => setEmergencyConfirmOpen(true)}>
                                <AmbulanceIcon size={18} aria-hidden />
                                Emergency
                            </button>
                            */}
                            <button type="button" className="btn btn-accent schedule-primary-action" onClick={() => goNewAppointment({ date: selectedDayIso })}>
                                <PlusIcon />
                                {t("appointments.page.new")}
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
                              className="appointment-filter-popover appointment-filter-popover--portal"
                              role="dialog"
                              aria-label={t("appointments.filter.aria")}
                              style={{
                                  top: filterPopoverFixed.top,
                                  insetInlineStart: filterPopoverFixed.inlineStart,
                                  width: filterPopoverFixed.width,
                              }}
                          >
                              <div className="appointment-filter-popover-section">
                                  <div className="appointment-filter-popover-label">{t("appointments.filter.doctor")}</div>
                                  {physicians.length === 0 ? (
                                      <div className="appointment-filter-empty">{t("appointments.filter.no_doctors")}</div>
                                  ) : (
                                      physicians.map((a) => (
                                          <label key={a.id} className="menu-item appointment-filter-check-row">
                                              <input
                                                  type="checkbox"
                                                  checked={filterPhysicianIds.includes(a.id)}
                                                  onChange={() =>
                                                      setFilterPhysicianIds((prev) =>
                                                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                                                      )}
                                              />
                                              <span>{a.name}</span>
                                          </label>
                                      ))
                                  )}
                              </div>
                              <div className="menu-sep" />
                              <div className="appointment-filter-popover-fields">
                                  <div className="appointment-filter-popover-field">
                                      <label htmlFor={appointmentFilterKindSelectId} className="appointment-filter-popover-label">
                                          {t("appointments.filter.treatment_type")}
                                      </label>
                                      <select
                                          id={appointmentFilterKindSelectId}
                                          className="input-edit appointment-filter-popover-select"
                                          value={filterKind}
                                          onChange={(e) => setFilterKind(e.target.value)}
                                      >
                                          {kindFilterOptions.map((o) => (
                                              <option key={o.value || "all-kind"} value={o.value}>
                                                  {o.label}
                                              </option>
                                          ))}
                                      </select>
                                  </div>
                                  <div className="appointment-filter-popover-field">
                                      <label htmlFor={appointmentFilterStatusSelectId} className="appointment-filter-popover-label">
                                          {t("appointments.filter.status")}
                                      </label>
                                      <select
                                          id={appointmentFilterStatusSelectId}
                                          className="input-edit appointment-filter-popover-select"
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
                                      {t("appointments.filter.close")}
                                  </button>
                              </div>
                          </div>
                      ),
                      document.body,
                  )
                : null}

            {activeFilterChips.length > 0 ? (
                <div className="appointment-filter-bar fade-up">
                    {activeFilterChips.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            className="pill accent appointment-filter-chip"
                            onClick={() => {
                                if (c.key.startsWith("physician:")) {
                                    const id = c.key.slice(5);
                                    setFilterPhysicianIds((p) => p.filter((x) => x !== id));
                                } else if (c.key === "kind") setFilterKind("");
                                else if (c.key === "st") setFilterStatus("");
                            }}
                        >
                            {c.label}
                            <XIcon size={12} />
                        </button>
                    ))}
                    <button type="button" className="btn btn-ghost appointment-filter-clear-all" onClick={resetFilters}>
                        {t("appointments.filter.clear_all")}
                    </button>
                </div>
            ) : null}

            <div className="card card-pad appointment-toolbar-row fade-up">
                <div className="appointment-nav-controls" dir="ltr">
                    <button
                        type="button"
                        className="icon-btn"
                        title={t("appointments.page.nav_back_title")}
                        aria-label={t("appointments.page.nav_back")}
                        onClick={() => {
                            if (view === "month") setMonthOffset((o) => o - 1);
                            else if (view === "week") setWeekOffset((w) => w - 1);
                            else setDayOffset((d) => d - 1);
                        }}
                    >
                        <ChevronLeftIcon size={18} />
                    </button>
                    <span className="appointment-toolbar-nav-label">{toolbarNavLabel}</span>
                    <button
                        type="button"
                        className="icon-btn"
                        title={t("appointments.page.nav_forward_title")}
                        aria-label={t("appointments.page.nav_forward")}
                        onClick={() => {
                            if (view === "month") setMonthOffset((o) => o + 1);
                            else if (view === "week") setWeekOffset((w) => w + 1);
                            else setDayOffset((d) => d + 1);
                        }}
                    >
                        <ChevronRightIcon size={18} />
                    </button>
                </div>
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
                <div className="appointment-toolbar-search input">
                    <SearchIcon size={16} aria-hidden />
                    <input
                        type="search"
                        placeholder={t("appointments.page.search")}
                        value={quickSearch}
                        onChange={(e) => setQuickSearch(e.target.value)}
                        aria-label={t("appointments.page.search_aria")}
                    />
                    {quickSearch.trim() ? (
                        <button type="button" className="icon-btn appointment-search-clear" aria-label={t("appointments.page.search_clear")} onClick={() => setQuickSearch("")}>
                            <XIcon size={14} />
                        </button>
                    ) : null}
                </div>
                <div className="spacer" />
                <DoctorLegend physicians={physicians} physicianToneMap={physicianToneMap} />
            </div>

            <div className="appointment-content-fill">
            <div className="schedule-main appointment-main-full">
                    {loading ? (
                        <PageLoading label={t("appointments.page.loading")} />
                    ) : loadError ? (
                        <PageLoadError message={loadError} onRetry={() => void load()} />
                    ) : view === "day" ? (
                        <AppointmentDaySplit
                            dayDate={selectedDayDate}
                            onJumpToDay={(d) => setDayOffset(differenceInCalendarDays(d, new Date()))}
                            appointments={tagAppointments}
                            patientNameById={patientNameById}
                            physicianToneMap={physicianToneMap}
                            physicians={physicians}
                            practiceCfg={practicePlanCfg}
                            monthOffset={monthOffset}
                            onMonthOffsetChange={setMonthOffset}
                            daySnapLabel={appointmentDaySnapLabel}
                            onClearDaySnapLabel={() => setAppointmentDaySnapLabel(null)}
                            dragState={dragState}
                            setDragState={setDragState}
                            onOpenDrawer={openDrawerFor}
                            onContextMenu={handleApptContextMenu}
                            onNewAt={(iso, min) => goNewAppointment({ date: iso, time: minutesToTime(min) })}
                            emptyDescription={tagViewEmptyDescription}
                            emptyHasFilters={tagViewHasActiveFilters}
                            onEmptyCreate={() => goNewAppointment({ date: selectedDayIso })}
                            onEmptyResetFilters={tagViewHasActiveFilters ? resetFilters : undefined}
                            nowMin={() => {
                                const n = new Date();
                                return n.getHours() * 60 + n.getMinutes();
                            }}
                        />
                    ) : appointments.length === 0 ? (
                        <EmptyState icon="📅" title={t("appointments.page.empty_title")} description={t("appointments.page.empty_create")} />
                    ) : displayAppointments.length === 0 ? (
                        <div className="card">
                            <EmptyState icon="🔍" title={t("appointments.page.empty_no_match")} description={t("appointments.page.empty_no_match_desc")} />
                            <div style={{ textAlign: "center", paddingBottom: 24 }}>
                                <button type="button" className="btn btn-accent" onClick={resetFilters}>{t("common.reset_filters")}</button>
                            </div>
                        </div>
                    ) : view === "month" ? (
                        <AppointmentMonthCalendar
                            monthOffset={monthOffset}
                            onMonthChange={setMonthOffset}
                            appointments={displayAppointments}
                            physicians={physicians}
                            physicianToneMap={physicianToneMap}
                            patientLoadSettings={monthCalPatientLoad}
                            practiceCfg={practicePlanCfg}
                            onPickDay={(iso) => {
                                jumpToIsoDate(iso);
                                setView("day");
                            }}
                        />
                    ) : (
                        <AppointmentWeekGrid
                            appointments={displayAppointments}
                            weekOffset={weekOffset}
                            patientNameById={patientNameById}
                            physicianToneMap={physicianToneMap}
                            practiceCfg={practicePlanCfg}
                            dragState={dragState}
                            setDragState={setDragState}
                            snapLabel={appointmentDaySnapLabel}
                            onClearSnapLabel={() => setAppointmentDaySnapLabel(null)}
                            clickSuppressUntilRef={suppressApptClickUntilRef}
                            onHeaderDay={(iso) => {
                                jumpToIsoDate(iso);
                                setView("day");
                            }}
                            onOpenDrawer={openDrawerFor}
                            onContextMenu={handleApptContextMenu}
                            onNewAt={(iso, min) => goNewAppointment({ date: iso, time: minutesToTime(min) })}
                            nowMin={() => {
                                const n = new Date();
                                return n.getHours() * 60 + n.getMinutes();
                            }}
                        />
                    )}
            </div>
            </div>

            {/* DISABLED: Emergency confirmation dialog (calendar toolbar)
            <Dialog
                open={emergencyConfirmOpen}
                onClose={() => setEmergencyConfirmOpen(false)}
                title=""
                labelledBy={emergencyTitleId}
                className="modal--ios-confirm emergency-confirm-dialog"
            >
                <div className="ios-confirm">
                    <div className="ios-confirm-body">
                        <div className="confirm-icon" aria-hidden="true">
                            <AmbulanceIcon />
                        </div>
                        <h2 id={emergencyTitleId} className="ios-confirm-title">
                            {t("appointment.calendar.emergency_confirm_title")}
                        </h2>
                        <p className="ios-confirm-message">{t("appointment.calendar.emergency_confirm_message")}</p>
                    </div>
                    <IosConfirmActions
                        cancelLabel={t("appointment.calendar.emergency_confirm_cancel")}
                        confirmLabel={t("appointment.calendar.emergency_confirm_confirm")}
                        onCancel={() => setEmergencyConfirmOpen(false)}
                        destructive
                        onConfirm={() => {
                            const todayIso = format(new Date(), "yyyy-MM-dd");
                            setDayOffset(0);
                            setWeekOffset(0);
                            setMonthOffset(0);
                            setView("day");
                            goNewAppointment({ date: todayIso, kind: "EMERGENCY", time: "11:45" });
                            setEmergencyConfirmOpen(false);
                            toast(t("appointments.page.demo_emergency"));
                        }}
                    />
                </div>
            </Dialog>
            */}

            {/* DISABLED: Pause confirmation dialog (calendar toolbar)
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
                            {t("appointment.calendar.pause_confirm_title")}
                        </h2>
                        <p className="ios-confirm-message">{t("appointments.page.pause_confirm")}</p>
                    </div>
                    <IosConfirmActions
                        cancelLabel={t("appointment.calendar.emergency_confirm_cancel")}
                        confirmLabel={t("appointment.calendar.pause_confirm_insert")}
                        onCancel={() => setPauseConfirmOpen(false)}
                        onConfirm={() => {
                            setPauseConfirmOpen(false);
                            toast(t("appointments.page.demo_pause"));
                        }}
                    />
                </div>
            </Dialog>
            */}

            {drawerAppointment ? (
                <AppointmentDetailDrawer
                    appointment={drawerAppointment}
                    patientName={patientNameById.get(drawerAppointment.patient_id) ?? t("appointment.calendar.patient_fallback")}
                    patientPhone={patientById.get(drawerAppointment.patient_id)?.phone ?? null}
                    doctorLabel={physicians.find((a) => a.id === drawerAppointment.physician_id)?.name ?? "—"}
                    onClose={() => setDrawerAppointment(null)}
                    onEdit={() => goNewAppointment({ id: drawerAppointment.id })}
                    onStornieren={() => void handleStornieren(drawerAppointment.id)}
                    onReminder={() => {
                        const name = patientNameById.get(drawerAppointment.patient_id) ?? t("appointment.calendar.patient_fallback");
                        toast(tp("appointments.page.reminder_prepared", { name }));
                    }}
                    onStatusChange={onDrawerStatus}
                    onPhone={() => {
                        const tel = patientById.get(drawerAppointment.patient_id)?.phone?.trim();
                        toast(tel ? tp("appointments.page.toast_phone", { phone: tel }) : t("appointments.page.toast_no_phone"));
                    }}
                />
            ) : null}

            {ctxMenu ? (
                <AppointmentContextMenu
                    appointment={ctxMenu.appointment}
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    patientName={patientNameById.get(ctxMenu.appointment.patient_id) ?? t("appointment.calendar.patient_fallback")}
                    onClose={() => setCtxMenu(null)}
                    onOpenDetails={() => openDrawerFor(ctxMenu.appointment)}
                    onEdit={() => goNewAppointment({ id: ctxMenu.appointment.id })}
                    onStornieren={() => void handleStornieren(ctxMenu.appointment.id)}
                    onReminder={() => {
                        const name = patientNameById.get(ctxMenu.appointment.patient_id) ?? t("appointment.calendar.patient_fallback");
                        toast(tp("appointments.page.reminder_prepared", { name }));
                    }}
                />
            ) : null}

            <ConfirmDialog
                open={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title={t("appointments.page.delete_title")}
                message={t("appointments.page.delete_confirm")}
                confirmLabel={t("common.delete")}
                danger
            />
        </div>
    );
}

