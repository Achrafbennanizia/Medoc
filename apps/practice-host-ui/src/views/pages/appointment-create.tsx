import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { createAppointment, getAppointment, listAppointments, updateAppointment } from "@/systems/practice-host/controllers/appointment.controller";
import { useDateFnsLocale, useT, useTParams } from "@/lib/i18n";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { getChart, listDentalFindings } from "@/systems/practice-host/controllers/chart.controller";
import { listPhysicians, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { listAbsences } from "@/systems/practice-host/controllers/practice.controller";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage } from "@/lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import { loadPracticePreferencesFromKv } from "@/lib/practice-preferences-storage";
import {
    isCalendarDaySelectable,
    loadPracticeWorkHoursConfig,
    readPracticeWorkHoursConfig,
    resolveBookingWorkHoursForPhysician,
    type PracticeWorkHoursConfig,
} from "@/lib/practice-planning";
import { usePracticeWorkHoursStore } from "@/models/store/practice-work-hours-store";
import { PRACTICE_WORK_HOURS_CHANGED_EVENT } from "@/lib/appointment-calendar-layout";
import {
    formatAlternativeSlots,
    isAppointmentConflictErrorMessage,
    suggestAlternativeAppointmentSlots,
    appointmentSchedulingBlockReason,
    timeToMinutes,
} from "@/lib/appointment-availability";
import { parseAppointmentDurationMin } from "@/lib/appointment-domain";
import {
    buildAppointmentSlotGrid,
    durationOptionsForSlotMin,
    firstBookableAppointmentSlot,
} from "@/lib/appointment-slot-grid";
import { parseToothacheTeethFromChiefComplaintPart, sortFdiTeeth, splitChiefComplaintParts } from "@/lib/dental";
import { APPOINTMENT_KIND_VALUES, type Patient, type Appointment, type Absence, type DentalFinding } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { TagInput } from "../components/ui/tag-input";
import { TimeSlotPicker } from "../components/ui/time-slot-picker";
import { DentalToothPickerMini } from "../components/dental-tooth-picker-mini";
import { useToastStore } from "../components/ui/toast-store";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "../components/administration-page-header";
import {
    planNextAutofillNote,
    planNextHasContent,
    planNextReceptionTeaser,
    planNextAppointmentSummary,
    type PlanNextAppointmentV2,
} from "@/lib/plan-next-appointment";
import { loadPlanNextAppointmentWithMigration } from "@/systems/practice-host/controllers/plan-next-appointment.controller";
import {
    clearAppointmentDraftFromBackend,
    loadAppointmentDraftWithMigration,
    persistAppointmentDraftToBackend,
    stripLegacyAppointmentDraftLocalStorage,
    type AppointmentDraft,
} from "@/systems/practice-host/controllers/appointment-draft.controller";

const TREATMENT_OPTION_KEYS = [
    { value: "CHECKUP", labelKey: "appointment.create.kind.CHECKUP" },
    { value: "TREATMENT", labelKey: "appointment.create.kind.TREATMENT" },
    { value: "EXAMINATION", labelKey: "appointment.create.kind.EXAMINATION" },
    { value: "CONSULTATION", labelKey: "appointment.create.kind.CONSULTATION" },
    { value: "FIRST_VISIT", labelKey: "appointment.create.kind.FIRST_VISIT" },
] as const;

const STATUS_OPTION_KEYS = [
    { value: "PLANNED", labelKey: "appointment.create.status.PLANNED" },
    { value: "CONFIRMED", labelKey: "appointment.create.status.CONFIRMED" },
] as const;

const CHIEF_COMPLAINT_SUG_KEYS = [
    "appointment.create.chief_complaint.TOOTHACHE",
    "appointment.create.chief_complaint.TMJ",
    "appointment.create.chief_complaint.BLEEDING",
    "appointment.create.chief_complaint.SENSITIVITY",
    "appointment.create.chief_complaint.EMERGENCY",
    "appointment.create.chief_complaint.CHECKUP",
    "appointment.create.chief_complaint.AESTHETICS",
] as const;
const TOOTHACHE_TAG = "Toothache";
const TOOTHACHE_TAG_LEGACY = "Zahnschmerzen";

function normalizeChiefComplaintTagsFromStored(raw: string): { tags: string[]; teeth: string[] } {
    const parts = splitChiefComplaintParts(raw);
    let teeth: string[] = [];
    const tags: string[] = [];
    for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const z = parseToothacheTeethFromChiefComplaintPart(p);
        if (z) {
            teeth = z;
            if (!tags.includes(TOOTHACHE_TAG)) tags.push(TOOTHACHE_TAG);
            continue;
        }
        if (p === TOOTHACHE_TAG || p === TOOTHACHE_TAG_LEGACY) {
            if (!tags.includes(TOOTHACHE_TAG)) tags.push(TOOTHACHE_TAG);
            continue;
        }
        tags.push(p);
    }
    return { tags, teeth };
}

function buildChiefComplaintPayload(tags: string[], toothacheTeeth: string[]): string {
    const zSorted = sortFdiTeeth(toothacheTeeth);
    return tags
        .map((t) => {
            if (t !== TOOTHACHE_TAG && t !== TOOTHACHE_TAG_LEGACY) return t;
            if (zSorted.length === 0) return TOOTHACHE_TAG;
            if (zSorted.length === 1) return `${TOOTHACHE_TAG} (tooth ${zSorted[0]})`;
            return `${TOOTHACHE_TAG} (teeth ${zSorted.join(", ")})`;
        })
        .join("; ");
}

function normalizeKind(raw: string | null): string {
    if (!raw) return "CHECKUP";
    if (raw === "NOTFALL" || raw === "EMERGENCY") return "TREATMENT";
    if (raw === "ROUTINE") return "CHECKUP";
    const allowed = APPOINTMENT_KIND_VALUES as readonly string[];
    if (allowed.includes(raw)) return raw;
    return "CHECKUP";
}

export function AppointmentCreatePage() {
    const t = useT();
    const tp = useTParams();
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [physicians, setPhysicians] = useState<PhysicianSummary[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [appointmentBufferMin, setAppointmentBufferMin] = useState(0);
    const [busy, setBusy] = useState(false);
    const [patientQuery, setPatientQuery] = useState("");
    const [calendarMonth, setCalendarMonth] = useState(() => new Date());

    const editId = searchParams.get("id");
    const isEdit = Boolean(editId);
    const hasDateParam = searchParams.has("date");
    const hasPhysicianParam = searchParams.has("physician_id");
    const physicianInit = searchParams.get("physician_id")?.trim() ?? "";
    const hasPatientParam = searchParams.has("patient_id");
    const hasKindParam = searchParams.has("kind");
    const hasTimeParam = searchParams.has("time");
    const dateInit = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
    const patientInit = searchParams.get("patient_id") ?? "";
    const kindInit = searchParams.get("kind") ?? "";
    const timeInitRaw = searchParams.get("time");
    const timeInit =
        timeInitRaw && /^\d{2}:\d{2}$/.test(timeInitRaw) ? timeInitRaw : null;
    const draftFromQuery = searchParams.get("draft");
    const applyPlanFromQuery = searchParams.get("apply_plan") === "1";
    const [draftId] = useState(() => draftFromQuery ?? crypto.randomUUID());
    const [editLoaded, setEditLoaded] = useState<boolean>(!isEdit);
    const [editError, setEditError] = useState<string | null>(null);
    const [draftHydrated, setDraftHydrated] = useState(false);
    const draftRestoredRef = useRef(false);
    const applyPlanConsumedRef = useRef(false);
    const patientPickerRef = useRef<HTMLDivElement>(null);

    const [date, setDate] = useState(dateInit);
    const [time, setTime] = useState(() => timeInit ?? "");
    const [patientId, setPatientId] = useState(patientInit);
    const [physicianId, setPhysicianId] = useState("");
    const [kind, setKind] = useState(() => normalizeKind(kindInit));
    const [chiefComplaintTags, setChiefComplaintTags] = useState<string[]>([]);
    const [toothacheTeeth, setToothacheTeeth] = useState<string[]>([]);
    const [chartFindings, setChartFindings] = useState<DentalFinding[]>([]);
    const [notes, setNotes] = useState("");
    const [durationMin, setDurationMin] = useState(() => {
        const n = loadClientSettings().workflows?.defaultAppointmentDurationMin;
        return typeof n === "number" && Number.isFinite(n) && n > 0 ? String(n) : "";
    });
    const [statusPreference, setStatusPreference] = useState("PLANNED");
    const [patientError, setPatientError] = useState("");
    const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
    /** Structured plan from the patient record (plan-next-appointment workflow). */
    const [doctorPlan, setDoctorPlan] = useState<PlanNextAppointmentV2 | null>(null);
    const [practiceCfg, setPracticeCfg] = useState<PracticeWorkHoursConfig>(() => readPracticeWorkHoursConfig());
    const storePracticeCfg = usePracticeWorkHoursStore((s) => s.config);

    useEffect(() => {
        setPracticeCfg(storePracticeCfg);
    }, [storePracticeCfg]);

    useEffect(() => {
        let cancelled = false;
        void usePracticeWorkHoursStore.getState().hydrate().then((cfg) => {
            if (!cancelled) setPracticeCfg(cfg);
        });
        const onCfgChanged = () => {
            void loadPracticeWorkHoursConfig()
                .then((cfg) => {
                    if (!cancelled) setPracticeCfg(cfg);
                })
                .catch(() => {
                    if (!cancelled) setPracticeCfg(readPracticeWorkHoursConfig());
                });
        };
        window.addEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
        return () => {
            cancelled = true;
            window.removeEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
        };
    }, []);

    const effectivePracticeCfg = useMemo(
        () => resolveBookingWorkHoursForPhysician(practiceCfg, physicianId || null),
        [practiceCfg, physicianId],
    );

    const slotStep = useMemo(() => Math.max(5, Number(effectivePracticeCfg.slotMin) || 30), [effectivePracticeCfg.slotMin]);

    const durMinNum = useMemo(() => Math.max(5, Number(durationMin) || slotStep), [durationMin, slotStep]);

    const slotGrid = useMemo(
        () =>
            buildAppointmentSlotGrid({
                practiceCfg,
                absences,
                date,
                physicianId,
                appointments,
                durMin: durMinNum,
                bufferMin: appointmentBufferMin,
                excludeAppointmentId: isEdit && editId ? editId : undefined,
                defaultAppointmentDurMin: slotStep,
            }),
        [practiceCfg, absences, date, physicianId, appointments, durMinNum, appointmentBufferMin, isEdit, editId, slotStep],
    );

    const timeSlotBusyKeys = useMemo(() => {
        const busy = new Set<string>();
        for (const hm of slotGrid.slots) {
            const key = `${date}|${hm}`;
            if (!slotGrid.bookableKeys.has(key)) busy.add(key);
        }
        return busy;
    }, [slotGrid, date]);

    useEffect(() => {
        if (!patientId) {
            setDoctorPlan(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const p = await loadPlanNextAppointmentWithMigration(patientId);
                if (!cancelled) {
                    setDoctorPlan(planNextHasContent(p) ? p : null);
                }
            } catch {
                if (!cancelled) setDoctorPlan(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId]);

    useEffect(() => {
        applyPlanConsumedRef.current = false;
    }, [patientId]);

    useEffect(() => {
        if (!applyPlanFromQuery || isEdit || !draftHydrated) return;
        if (!doctorPlan || !planNextHasContent(doctorPlan)) return;
        if (applyPlanConsumedRef.current) return;
        applyPlanConsumedRef.current = true;
        const kindH = doctorPlan.appointmentKindHint.trim();
        if (kindH && (APPOINTMENT_KIND_VALUES as readonly string[]).includes(kindH)) {
            setKind(normalizeKind(kindH));
        }
        const dm = doctorPlan.durationMin.trim();
        if (dm && /^\d+$/.test(dm)) setDurationMin(dm);
        const note = planNextAutofillNote(doctorPlan);
        if (note.trim()) setNotes(note.trim());
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete("apply_plan");
            return p;
        }, { replace: true });
    }, [applyPlanFromQuery, isEdit, draftHydrated, doctorPlan, setSearchParams]);

    function formatPlanForNotes(p: PlanNextAppointmentV2): string {
        const parts: string[] = [];
        const summary = planNextAppointmentSummary(p);
        if (summary) parts.push(summary);
        if (p.appointmentKindHint.trim()) parts.push(tp("appointment.create.plan_note.kind", { kind: p.appointmentKindHint }));
        if (p.durationMin.trim()) parts.push(tp("appointment.create.plan_note.duration", { min: p.durationMin }));
        if (p.preferredWeekdays.trim()) parts.push(tp("appointment.create.plan_note.weekdays", { days: p.preferredWeekdays }));
        if (p.internalNote.trim()) parts.push(tp("appointment.create.plan_note.internal", { note: p.internalNote }));
        return parts.join("\n");
    }

    useEffect(() => {
        if (draftRestoredRef.current) {
            setDraftHydrated(true);
            return;
        }
        draftRestoredRef.current = true;
        if (isEdit) {
            // In edit mode a dedicated useEffect handles data loading,
            // local draft is ignored.
            setDraftHydrated(true);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const d = await loadAppointmentDraftWithMigration(draftId);
                if (cancelled || !d) return;
                if (hasDateParam) {
                    setDate(dateInit);
                } else if (d.date) {
                    setDate(d.date);
                }
                if (hasPatientParam && patientInit.trim()) {
                    setPatientId(patientInit.trim());
                } else if (d.patientId) {
                    setPatientId(d.patientId);
                }
                if (!hasPatientParam && d.patientQuery) {
                    setPatientQuery(d.patientQuery);
                }
                if (hasTimeParam && timeInit) {
                    setTime(timeInit);
                } else if (d.time) {
                    setTime(d.time);
                }
                if (!hasPhysicianParam && d.physicianId) setPhysicianId(d.physicianId);
                if (hasKindParam) {
                    setKind(normalizeKind(kindInit));
                } else if (d.kind) {
                    setKind(d.kind);
                }
                if (Array.isArray(d.chiefComplaintTags)) setChiefComplaintTags(d.chiefComplaintTags);
                if (Array.isArray(d.toothacheTeeth)) {
                    setToothacheTeeth(sortFdiTeeth(d.toothacheTeeth.filter((x) => typeof x === "string")));
                } else if (Array.isArray(d.zahnschmerzenTeeth)) {
                    setToothacheTeeth(sortFdiTeeth(d.zahnschmerzenTeeth.filter((x) => typeof x === "string")));
                } else if (typeof d.toothacheTooth === "string" && d.toothacheTooth.trim()) {
                    setToothacheTeeth(sortFdiTeeth([d.toothacheTooth.trim()]));
                } else if (typeof d.zahnschmerzenTooth === "string" && d.zahnschmerzenTooth.trim()) {
                    setToothacheTeeth(sortFdiTeeth([d.zahnschmerzenTooth.trim()]));
                }
                if (d.notes) setNotes(d.notes);
                if (d.durationMin) setDurationMin(d.durationMin);
                if (d.statusPreference) setStatusPreference(d.statusPreference);
                else if (d.statusWunsch) setStatusPreference(d.statusWunsch);
            } catch {
                /* ignore */
            } finally {
                if (!cancelled) setDraftHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [draftId, hasDateParam, hasPatientParam, hasKindParam, hasTimeParam, hasPhysicianParam, dateInit, patientInit, kindInit, timeInit, isEdit]);

    useEffect(() => {
        if (!isEdit || !editId) return;
        let cancelled = false;
        setEditLoaded(false);
        setEditError(null);
        void getAppointment(editId)
            .then((t) => {
                if (cancelled) return;
                setDate(t.date);
                setTime(t.time.length >= 5 ? t.time.slice(0, 5) : t.time);
                setPatientId(t.patient_id);
                setPhysicianId(t.physician_id);
                setKind(normalizeKind(t.kind));
                const { tags: bTags, teeth: bTeeth } = normalizeChiefComplaintTagsFromStored(t.chief_complaint ?? "");
                setChiefComplaintTags(bTags);
                setToothacheTeeth(bTeeth);
                const notesRaw = t.notes ?? "";
                const durationMatch = /(?:Duration|Dauer):\s*(\d+)\s*min/.exec(notesRaw);
                if (durationMatch && durationMatch[1]) {
                    setDurationMin(durationMatch[1]);
                } else {
                    setDurationMin(String(parseAppointmentDurationMin(notesRaw, slotStep)));
                }
                const cleanedNotes = notesRaw
                    .split("·")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0 && !/^(?:Duration|Dauer):/i.test(s) && !/^(?:Priority|Priorität):/i.test(s))
                    .join(" · ");
                setNotes(cleanedNotes);
                setStatusPreference(t.status === "CONFIRMED" ? "CONFIRMED" : "PLANNED");
                setEditLoaded(true);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setEditError(errorMessage(e));
                setEditLoaded(true);
            });
        return () => { cancelled = true; };
    }, [isEdit, editId, slotStep]);

    const searchKeyForDraft = searchParams.toString();

    useEffect(() => {
        if (isEdit) return;
        if (draftFromQuery) return;
        const next = new URLSearchParams(searchKeyForDraft);
        next.set("draft", draftId);
        const qs = next.toString();
        navigate({ pathname: "/appointments/new", search: qs ? `?${qs}` : "" }, { replace: true });
    }, [draftFromQuery, draftId, navigate, searchKeyForDraft, isEdit]);

    useEffect(() => {
        if (!draftHydrated) return;
        if (isEdit) return;
        const snap: AppointmentDraft = {
            date,
            time,
            patientId,
            patientQuery,
            physicianId,
            kind,
            chiefComplaintTags,
            toothacheTeeth,
            notes,
            durationMin,
            statusPreference,
        };
        const timer = window.setTimeout(() => {
            void persistAppointmentDraftToBackend(draftId, snap).catch(() => {
                /* offline — legacy row may be stale until next save */
            });
        }, 400);
        return () => window.clearTimeout(timer);
    }, [date, time, patientId, patientQuery, physicianId, kind, chiefComplaintTags, toothacheTeeth, notes, durationMin, statusPreference, draftId, draftHydrated, isEdit]);

    useEffect(() => {
        if (!chiefComplaintTags.includes(TOOTHACHE_TAG) && !chiefComplaintTags.includes(TOOTHACHE_TAG_LEGACY)) setToothacheTeeth([]);
    }, [chiefComplaintTags]);

    useEffect(() => {
        if (!patientId || session?.role !== "PHYSICIAN") {
            setChartFindings([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const chart = await getChart(patientId);
                const bf = await listDentalFindings(chart.id);
                if (!cancelled) setChartFindings(bf);
            } catch {
                if (!cancelled) setChartFindings([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId, session?.role]);

    const load = useCallback(async () => {
        try {
            const [p, t] = await Promise.all([listPatients(), listAppointments()]);
            setPatients(p);
            setAppointments(t);
            try {
                setPhysicians(await listPhysicians());
            } catch {
                setPhysicians([]);
            }
            try {
                setAbsences(await listAbsences());
            } catch {
                setAbsences([]);
            }
            try {
                const prefs = await loadPracticePreferencesFromKv();
                setAppointmentBufferMin(Math.max(0, Number.parseInt(String(prefs.bufferMin ?? "0"), 10) || 0));
            } catch {
                setAppointmentBufferMin(0);
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }, [toast]);

    useEffect(() => {
        void load();
        const onCfgChanged = () => {
            void load();
        };
        window.addEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
        const onVis = () => {
            if (document.visibilityState === "visible") void load();
        };
        document.addEventListener("visibilitychange", onVis);
        return () => {
            window.removeEventListener(PRACTICE_WORK_HOURS_CHANGED_EVENT, onCfgChanged);
            document.removeEventListener("visibilitychange", onVis);
        };
    }, [load]);

    useDismissibleLayer({
        open: patientDropdownOpen,
        rootRef: patientPickerRef,
        onDismiss: () => setPatientDropdownOpen(false),
    });

    useEffect(() => {
        if (!hasPhysicianParam || !physicianInit) return;
        if (!physicians.some((a) => a.id === physicianInit)) return;
        setPhysicianId(physicianInit);
    }, [hasPhysicianParam, physicianInit, physicians]);

    useEffect(() => {
        if (!session) return;
        if (hasPhysicianParam && physicianInit && physicians.some((a) => a.id === physicianInit)) return;
        setPhysicianId((prev) => {
            if (prev) return prev;
            if (session.role === "PHYSICIAN") return session.user_id;
            const def = (practiceCfg.defaultPhysicianId ?? "").trim();
            if (def && physicians.some((a) => a.id === def)) return def;
            return physicians[0]?.id ?? "";
        });
    }, [session, physicians, hasPhysicianParam, physicianInit, practiceCfg.defaultPhysicianId]);

    useEffect(() => {
        setDurationMin((prev) => {
            const n = Number(prev);
            if (prev && Number.isFinite(n) && n >= 5) return prev;
            return String(slotStep);
        });
    }, [slotStep]);

    useEffect(() => {
        const current = time.slice(0, 5);
        const key = current ? `${date}|${current}` : "";
        if (key && slotGrid.bookableKeys.has(key)) return;
        const next = firstBookableAppointmentSlot(slotGrid, date);
        if (next && next !== current) setTime(next);
        else if (!next && current) setTime("");
    }, [date, time, slotGrid]);

    const toggleToothacheTooth = useCallback((fdi: string) => {
        setToothacheTeeth((prev) => {
            const next = new Set(prev);
            if (next.has(fdi)) next.delete(fdi);
            else next.add(fdi);
            return sortFdiTeeth([...next]);
        });
    }, []);

    const filteredPatients = useMemo(() => {
        const q = patientQuery.trim().toLowerCase();
        if (!q) return patients.slice(0, 12);
        return patients.filter((p) => p.name.toLowerCase().includes(q) || p.insurance_number.toLowerCase().includes(q)).slice(0, 20);
    }, [patientQuery, patients]);

    const selectedPatient = patients.find((p) => p.id === patientId);

    useEffect(() => {
        if (!patientInit) return;
        setPatientId(patientInit);
    }, [patientInit]);

    useEffect(() => {
        if (!patientId) return;
        if (patientQuery.trim()) return;
        const p = patients.find((x) => x.id === patientId);
        if (p) setPatientQuery(p.name);
    }, [patientId, patients, patientQuery]);

    const calendarDays = useMemo(() => {
        const start = startOfMonth(calendarMonth);
        const end = endOfMonth(calendarMonth);
        const gridStart = startOfWeek(start, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [calendarMonth]);

    const chiefComplaintStr = chiefComplaintTags.length ? buildChiefComplaintPayload(chiefComplaintTags, toothacheTeeth) : "";

    const chiefComplaintSuggestions = useMemo(() => CHIEF_COMPLAINT_SUG_KEYS.map((k) => t(k)), [t]);
    const treatmentOptions = useMemo(() => TREATMENT_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);
    const statusOptions = useMemo(() => STATUS_OPTION_KEYS.map((o) => ({ value: o.value, label: t(o.labelKey) })), [t]);
    const durationOptions = useMemo(
        () => durationOptionsForSlotMin(slotStep).map((version) => ({ value: version, label: tp("appointment.create.duration_min", { min: version }) })),
        [slotStep, tp],
    );
    const weekdayLabels = useMemo(
        () => [
            t("appointment.calendar.weekday.mon"),
            t("appointment.calendar.weekday.tue"),
            t("appointment.calendar.weekday.wed"),
            t("appointment.calendar.weekday.thu"),
            t("appointment.calendar.weekday.fri"),
            t("appointment.calendar.weekday.sat"),
            t("appointment.calendar.weekday.sun"),
        ],
        [t],
    );

    const submit = async () => {
        setPatientError("");
        if (!patientId) {
            setPatientError(t("appointment.create.error_patient"));
            return;
        }
        if (!physicianId || !date || !time) {
            toast(t("appointment.create.error_required"), "error");
            return;
        }
        const durMin = durMinNum;
        const startM = timeToMinutes(time);
        const blockReason = appointmentSchedulingBlockReason(effectivePracticeCfg, absences, date, startM, startM + durMin, t);
        if (blockReason) {
            toast(blockReason, "error");
            return;
        }
        const parts: string[] = [];
        if (durationMin) parts.push(`Duration: ${durationMin} min`);
        if (notes.trim()) parts.push(notes.trim());
        if (searchParams.get("kind") === "NOTFALL" || searchParams.get("kind") === "EMERGENCY") {
            parts.push(t("appointment.create.priority_emergency"));
        }
        const notesPayload = parts.length ? parts.join(" · ") : undefined;
        let kindSend = kind;
        if (searchParams.get("kind") === "NOTFALL" || searchParams.get("kind") === "EMERGENCY") kindSend = "TREATMENT";
        setBusy(true);
        try {
            const timeNorm = time.length === 5 ? `${time}:00` : time;
            if (isEdit && editId) {
                await updateAppointment(editId, {
                    patient_id: patientId,
                    physician_id: physicianId,
                    date,
                    time: timeNorm,
                    kind: kindSend,
                    chief_complaint: chiefComplaintStr || null,
                    notes: notesPayload ?? null,
                    status: statusPreference || "PLANNED",
                });
                toast(t("appointment.create.toast_updated"));
                navigate("/appointments");
                return;
            }
            const created = await createAppointment({
                patient_id: patientId,
                physician_id: physicianId,
                date,
                time: timeNorm,
                kind: kindSend,
                chief_complaint: chiefComplaintStr || null,
                notes: notesPayload ?? null,
            });
            if (statusPreference && statusPreference !== "PLANNED") {
                try {
                    await updateAppointment(created.id, { status: statusPreference });
                } catch {
                    /* optional */
                }
            }
            toast(t("appointment.create.toast_saved"));
            await clearAppointmentDraftFromBackend(draftId);
            stripLegacyAppointmentDraftLocalStorage(draftId);
            navigate("/appointments");
        } catch (e) {
            const msg = errorMessage(e);
            if (isAppointmentConflictErrorMessage(msg) && physicianId && date && time) {
                const alts = suggestAlternativeAppointmentSlots({
                    date,
                    physicianId,
                    preferredTime: time,
                    durMin,
                    slotStep,
                    appointments,
                    practiceCfg,
                    absences,
                    excludeAppointmentId: isEdit && editId ? editId : undefined,
                    t,
                });
                const hint = formatAlternativeSlots(alts, tp);
                toast(
                    hint
                        ? tp("appointment.create.toast_conflict_alts", { alts: hint })
                        : tp("appointment.create.toast_conflict", { message: msg }),
                    "error",
                );
            } else {
                toast(`${t("common.error")}: ${msg}`, "error");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="practice-workspace-page animate-fade-in">
            <WorkspacePageHeader
                titleLevel="h1"
                title={isEdit ? t("appointment.create.title_edit") : t("appointment.create.title_new")}
                back={{ to: "/appointments", label: t("appointment.create.back") }}
                actions={
                    <>
                        {isEdit && !editLoaded ? <span className="pill blue">{t("appointment.create.loading")}</span> : null}
                        {isEdit && editError ? <span className="pill red">{editError}</span> : null}
                    </>
                }
            />

            {doctorPlan ? (
                <div
                    role="note"
                    aria-label={t("appointment.create.hint_plan_aria")}
                    style={{
                        display: "flex",
                        gap: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--accent)",
                        background: "var(--accent-soft)",
                        color: "var(--accent-ink)",
                        alignItems: "center",
                    }}
                >
                    <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>💡</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>{t("appointment.create.hint_plan_body")}</div>
                        <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--fg-2)", fontWeight: 500 }}>
                            {planNextReceptionTeaser(doctorPlan) || planNextAutofillNote(doctorPlan) || "—"}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-subtle btn-sm"
                        onClick={() => {
                            const block = formatPlanForNotes(doctorPlan);
                            if (!notes.trim()) setNotes(block);
                            else setNotes((prev) => `${prev.trim()}\n\n${block}`);
                        }}
                    >
                        {t("appointment.create.hint_plan_to_notes")}
                    </button>
                </div>
            ) : null}

            <Card>
                <div style={{ padding: 16 }}>
                    <CardHeader title={isEdit ? t("appointment.create.card_edit") : t("appointment.create.card_new")} />
                    <div className="appointment-create-split" style={{ marginTop: 12 }}>
                        <div className="col" style={{ gap: 14 }}>
                            <div>
                                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>{t("appointment.create.calendar")}</span>
                                    <div className="row appointment-nav-controls" dir="ltr" style={{ gap: 6 }}>
                                        <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_prev")} onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                                            <ChevronLeftIcon size={14} />
                                        </button>
                                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 140, textAlign: "center" }}>{format(calendarMonth, "LLLL yyyy", { locale: dateFnsLocale })}</span>
                                        <button type="button" className="icon-btn" aria-label={t("appointment.calendar.month_next")} onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                                            <ChevronRightIcon size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "var(--fg-4)", textAlign: "center", marginBottom: 4 }}>
                                    {weekdayLabels.map((d) => <span key={d}>{d}</span>)}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                                    {calendarDays.map((day) => {
                                        const iso = format(day, "yyyy-MM-dd");
                                        const inM = isSameMonth(day, calendarMonth);
                                        const sel = iso === date;
                                        const isToday = isSameDay(day, new Date());
                                        const blockedDay = inM && !isCalendarDaySelectable(practiceCfg, iso, physicianId);
                                        return (
                                            <button
                                                key={iso}
                                                type="button"
                                                disabled={!inM || blockedDay}
                                                onClick={() => inM && !blockedDay && setDate(iso)}
                                                style={{
                                                    padding: "8px 0",
                                                    borderRadius: 8,
                                                    border: sel ? "2px solid var(--accent)" : "1px solid var(--line)",
                                                    background: sel ? "var(--accent-soft)" : isToday ? "color-mix(in oklab, var(--accent) 10%, transparent)" : "var(--bg-elev)",
                                                    color: inM && !blockedDay ? "var(--fg)" : "var(--fg-4)",
                                                    fontSize: 13,
                                                    fontWeight: sel ? 700 : 500,
                                                    cursor: inM && !blockedDay ? "pointer" : "not-allowed",
                                                    opacity: blockedDay ? 0.45 : 1,
                                                }}
                                                title={blockedDay ? t("appointment.create.calendar_blocked") : undefined}
                                            >
                                                {format(day, "d")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="col" style={{ gap: 12 }}>
                                <Input id="tc-date" type="date" label={t("appointment.create.date")} hint={t("appointment.create.date_hint")} value={date} onChange={(e) => setDate(e.target.value)} />
                                <div>
                                    <span className="form-label form-label--mb-8">{t("appointment.create.time")}</span>
                                    <TimeSlotPicker
                                        value={time.slice(0, 5)}
                                        onChange={(t) => setTime(t)}
                                        busyKeys={timeSlotBusyKeys}
                                        slots={slotGrid.slots}
                                        selectedDate={date}
                                        stepMinutes={slotStep}
                                        emptyLabel={!physicianId ? t("appointment.create.doctor_pick") : undefined}
                                    />
                                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--fg-3)" }}>
                                        {t("appointment.create.time_hint")}
                                    </p>
                                </div>
                                <Select id="tc-duration" label={t("appointment.create.duration")} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} options={durationOptions} />
                            </div>
                        </div>

                        <div className="col" style={{ gap: 14 }}>
                            <div>
                                <span className="form-label">{t("appointment.create.patient")}</span>
                                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                    <div ref={patientPickerRef} style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
                                        <input
                                            className="input-edit"
                                            style={{ width: "100%" }}
                                            placeholder={t("appointment.create.patient_search")}
                                            value={patientQuery}
                                            onFocus={() => setPatientDropdownOpen(true)}
                                            onChange={(e) => { setPatientQuery(e.target.value); setPatientDropdownOpen(true); }}
                                            aria-label={t("appointment.create.patient_search")}
                                        />
                                        {patientDropdownOpen ? (
                                            <div
                                                role="listbox"
                                                aria-label={t("appointment.create.patient_matches_aria")}
                                                style={{
                                                    position: "absolute",
                                                    zIndex: 40,
                                                    top: "calc(100% + 6px)",
                                                    left: 0,
                                                    right: 0,
                                                    maxHeight: 240,
                                                    overflowY: "auto",
                                                    border: "1px solid var(--line)",
                                                    borderRadius: 10,
                                                    background: "var(--bg-elev)",
                                                    boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
                                                }}
                                            >
                                                {filteredPatients.length === 0 && patientQuery.trim() ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/patients?from=appointment-create&draft=${encodeURIComponent(draftId)}`)}
                                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--fg-3)" }}
                                                    >
                                                        {t("appointment.create.patient_no_match")}
                                                    </button>
                                                ) : filteredPatients.slice(0, patientQuery.trim() ? 20 : 8).map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={patientId === p.id}
                                                        onClick={() => {
                                                            setPatientId(p.id);
                                                            setPatientQuery(p.name);
                                                            setPatientDropdownOpen(false);
                                                            setToothacheTeeth([]);
                                                        }}
                                                        style={{
                                                            display: "block",
                                                            width: "100%",
                                                            textAlign: "left",
                                                            padding: "10px 12px",
                                                            border: "none",
                                                            borderBottom: "1px solid var(--line)",
                                                            background: patientId === p.id ? "var(--accent-soft)" : "transparent",
                                                            cursor: "pointer",
                                                            fontSize: 13,
                                                        }}
                                                    >
                                                        <b>{p.name}</b>
                                                        <span style={{ color: "var(--fg-3)", marginInlineStart: 8 }}>{p.insurance_number}</span>
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/patients?from=appointment-create&draft=${encodeURIComponent(draftId)}`)}
                                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderTop: "1px solid var(--line)", background: "var(--bg-elev)", cursor: "pointer", fontSize: 13, color: "var(--accent)" }}
                                                >
                                                    {t("appointment.create.patient_search_records_more")}
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button type="button" variant="secondary" onClick={() => navigate("/patients/new")}>{t("appointment.create.patient_new")}</Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => navigate(`/patients?from=appointment-create&draft=${encodeURIComponent(draftId)}`)}
                                    >
                                        {t("appointment.create.patient_search_records")}
                                    </Button>
                                </div>
                                {patientError ? <p className="text-error" style={{ fontSize: 12, marginTop: 6 }}>{patientError}</p> : null}
                                {selectedPatient ? (
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>{t("appointment.create.patient_selected")} <b>{selectedPatient.name}</b></p>
                                ) : null}
                            </div>

                            <Select
                                id="tc-physician"
                                label={t("appointment.create.doctor")}
                                value={physicianId}
                                onChange={(e) => setPhysicianId(e.target.value)}
                                options={[{ value: "", label: physicians.length ? t("appointment.create.doctor_pick") : t("appointment.create.doctor_empty") }, ...physicians.map((a) => ({ value: a.id, label: a.name }))]}
                            />
                            <Select id="tc-kind" label={t("appointment.create.treatment_type")} value={kind} onChange={(e) => setKind(e.target.value)} options={treatmentOptions} />
                            <Select id="tc-status" label={t("appointment.create.status")} value={statusPreference} onChange={(e) => setStatusPreference(e.target.value)} options={statusOptions} />
                            <TagInput label={t("appointment.create.complaints")} value={chiefComplaintTags} onChange={setChiefComplaintTags} suggestions={chiefComplaintSuggestions} />
                            {chiefComplaintTags.includes(TOOTHACHE_TAG) || chiefComplaintTags.includes(TOOTHACHE_TAG_LEGACY) ? (
                                <DentalToothPickerMini
                                    findings={chartFindings}
                                    selectedTeeth={toothacheTeeth}
                                    onToggleTooth={toggleToothacheTooth}
                                />
                            ) : null}
                            <Textarea id="tc-notes" label={t("appointment.create.notes")} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 88 }} />
                        </div>
                    </div>

                    <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/appointments")}>{t("common.cancel")}</Button>
                        <Button
                            type="button"
                            onClick={() => void submit()}
                            disabled={busy || (isEdit && !editLoaded)}
                            loading={busy}
                        >
                            {isEdit ? t("appointment.create.save_changes") : t("appointment.create.save")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
