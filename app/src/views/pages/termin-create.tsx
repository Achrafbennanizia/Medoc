import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { de } from "date-fns/locale";
import { createTermin, getTermin, listTermine, updateTermin } from "../../controllers/termin.controller";
import { listPatienten } from "../../controllers/patient.controller";
import { getAkte, listZahnbefunde } from "../../controllers/akte.controller";
import { listAerzte, type AerztSummary } from "../../controllers/personal.controller";
import { listAbwesenheiten } from "../../controllers/praxis.controller";
import { useAuthStore } from "../../models/store/auth-store";
import { errorMessage } from "../../lib/utils";
import { loadClientSettings } from "@/lib/client-settings";
import {
    hasAnyAvailableSlot,
    isSlotBlockedByPraxisConfig,
    loadPraxisArbeitszeitenConfig,
    readPraxisArbeitszeitenConfig,
    resolveEffectiveArbeitszeitenForArzt,
    type PraxisArbeitszeitenConfig,
} from "../../lib/praxis-planning";
import {
    formatAlternativeSlotsDe,
    isTerminConflictErrorMessage,
    suggestAlternativeTerminSlots,
    terminSchedulingBlockReason,
    uhrzeitToMinutes,
} from "@/lib/termin-availability";
import { parseZahnschmerzTeethFromBeschwerdenPart, sortFdiTeeth, splitBeschwerdenParts } from "@/lib/dental";
import { TERMIN_ART_VALUES, type Patient, type Termin, type Abwesenheit, type Zahnbefund } from "../../models/types";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Input, Select, Textarea } from "../components/ui/input";
import { TagInput } from "../components/ui/tag-input";
import { TimeSlotPicker } from "../components/ui/time-slot-picker";
import { DentalToothPickerMini } from "../components/dental-tooth-picker-mini";
import { useToastStore } from "../components/ui/toast-store";
import { useDismissibleLayer } from "../components/ui/use-dismissible-layer";
import { ChevronLeftIcon, ChevronRightIcon } from "@/lib/icons";
import {
    planNextAutofillNote,
    planNextHasContent,
    planNextReceptionTeaser,
    planNextTerminSummary,
    type PlanNextTerminV2,
} from "@/lib/plan-next-termin";
import { loadPlanNextTerminWithMigration } from "@/controllers/plan-next-termin.controller";
import {
    clearTerminDraftFromBackend,
    loadTerminDraftWithMigration,
    persistTerminDraftToBackend,
    stripLegacyTerminDraftLocalStorage,
    type TerminDraft,
} from "@/controllers/termin-draft.controller";

const BEHANDLUNG_OPTIONS = [
    { value: "KONTROLLE", label: "Kontrolluntersuchung" },
    { value: "BEHANDLUNG", label: "Füllungstherapie / Behandlung" },
    { value: "UNTERSUCHUNG", label: "Parodontologie / Untersuchung" },
    { value: "BERATUNG", label: "Beratung / Prothetik-Planung" },
    { value: "ERSTBESUCH", label: "Erstbesuch" },
];

const STATUS_OPTIONS = [
    { value: "GEPLANT", label: "Geplant" },
    { value: "BESTAETIGT", label: "Bestätigt" },
];

const DURATION_OPTIONS = [
    { value: "", label: "—" },
    { value: "15", label: "15 min" },
    { value: "30", label: "30 min" },
    { value: "45", label: "45 min" },
    { value: "60", label: "60 min" },
];

const BESCHWERDEN_SUG = ["Zahnschmerzen", "Kiefergelenk", "Blutung", "Empfindlichkeit", "Notfall", "Kontrolle", "Ästhetik"];
const ZAHNSCHMERZ_TAG = "Zahnschmerzen";

function normalizeBeschwerdenTagsFromStored(raw: string): { tags: string[]; teeth: string[] } {
    const parts = splitBeschwerdenParts(raw);
    let teeth: string[] = [];
    const tags: string[] = [];
    for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const z = parseZahnschmerzTeethFromBeschwerdenPart(p);
        if (z) {
            teeth = z;
            if (!tags.includes(ZAHNSCHMERZ_TAG)) tags.push(ZAHNSCHMERZ_TAG);
            continue;
        }
        if (p === ZAHNSCHMERZ_TAG) {
            if (!tags.includes(ZAHNSCHMERZ_TAG)) tags.push(ZAHNSCHMERZ_TAG);
            continue;
        }
        tags.push(p);
    }
    return { tags, teeth };
}

function buildBeschwerdenPayload(tags: string[], zahnschmerzTeeth: string[]): string {
    const zSorted = sortFdiTeeth(zahnschmerzTeeth);
    return tags
        .map((t) => {
            if (t !== ZAHNSCHMERZ_TAG) return t;
            if (zSorted.length === 0) return t;
            if (zSorted.length === 1) return `${ZAHNSCHMERZ_TAG} (Zahn ${zSorted[0]})`;
            return `${ZAHNSCHMERZ_TAG} (Zähne ${zSorted.join(", ")})`;
        })
        .join("; ");
}

function normalizeArt(raw: string | null): string {
    if (!raw) return "KONTROLLE";
    if (raw === "NOTFALL") return "BEHANDLUNG";
    if (raw === "ROUTINE") return "KONTROLLE";
    const allowed = TERMIN_ART_VALUES as readonly string[];
    if (allowed.includes(raw)) return raw;
    return "KONTROLLE";
}

export function TerminCreatePage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const session = useAuthStore((s) => s.session);
    const toast = useToastStore((s) => s.add);
    const [patienten, setPatienten] = useState<Patient[]>([]);
    const [aerzte, setAerzte] = useState<AerztSummary[]>([]);
    const [termine, setTermine] = useState<Termin[]>([]);
    const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
    const [busy, setBusy] = useState(false);
    const [patientQuery, setPatientQuery] = useState("");
    const [calendarMonth, setCalendarMonth] = useState(() => new Date());

    const editId = searchParams.get("id");
    const isEdit = Boolean(editId);
    const hasDatumParam = searchParams.has("datum");
    const hasArztParam = searchParams.has("arzt_id");
    const arztInit = searchParams.get("arzt_id")?.trim() ?? "";
    const hasPatientParam = searchParams.has("patient_id");
    const hasArtParam = searchParams.has("art");
    const hasUhrzeitParam = searchParams.has("uhrzeit");
    const datumInit = searchParams.get("datum") ?? format(new Date(), "yyyy-MM-dd");
    const patientInit = searchParams.get("patient_id") ?? "";
    const artInit = searchParams.get("art") ?? "";
    const uhrzeitInitRaw = searchParams.get("uhrzeit");
    const uhrzeitInit =
        uhrzeitInitRaw && /^\d{2}:\d{2}$/.test(uhrzeitInitRaw) ? uhrzeitInitRaw : null;
    const draftFromQuery = searchParams.get("draft");
    const applyPlanFromQuery = searchParams.get("apply_plan") === "1";
    const [draftId] = useState(() => draftFromQuery ?? crypto.randomUUID());
    const [editLoaded, setEditLoaded] = useState<boolean>(!isEdit);
    const [editError, setEditError] = useState<string | null>(null);
    const [draftHydrated, setDraftHydrated] = useState(false);
    const draftRestoredRef = useRef(false);
    const applyPlanConsumedRef = useRef(false);
    const patientPickerRef = useRef<HTMLDivElement>(null);

    const [datum, setDatum] = useState(datumInit);
    const [uhrzeit, setUhrzeit] = useState(() => uhrzeitInit ?? "09:00");
    const [patientId, setPatientId] = useState(patientInit);
    const [arztId, setArztId] = useState("");
    const [art, setArt] = useState(() => normalizeArt(artInit));
    const [beschwerdenTags, setBeschwerdenTags] = useState<string[]>([]);
    const [zahnschmerzenTeeth, setZahnschmerzenTeeth] = useState<string[]>([]);
    const [chartBefunde, setChartBefunde] = useState<Zahnbefund[]>([]);
    const [notizen, setNotizen] = useState("");
    const [dauerMin, setDauerMin] = useState(() => {
        const n = loadClientSettings().workflows?.defaultTerminDauerMin ?? 30;
        return String(Number.isFinite(n) && n > 0 ? n : 30);
    });
    const [statusWunsch, setStatusWunsch] = useState("GEPLANT");
    const [patientError, setPatientError] = useState("");
    const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
    /** Strukturierter Plan aus der Akte („Plan nächsten Termin“). */
    const [doctorPlan, setDoctorPlan] = useState<PlanNextTerminV2 | null>(null);
    const [praxisCfg, setPraxisCfg] = useState<PraxisArbeitszeitenConfig>(() => readPraxisArbeitszeitenConfig());

    useEffect(() => {
        let cancelled = false;
        void loadPraxisArbeitszeitenConfig().then((cfg) => {
            if (!cancelled) setPraxisCfg(cfg);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const effectivePraxisCfg = useMemo(
        () => resolveEffectiveArbeitszeitenForArzt(praxisCfg, arztId || null),
        [praxisCfg, arztId],
    );

    useEffect(() => {
        if (!patientId) {
            setDoctorPlan(null);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const p = await loadPlanNextTerminWithMigration(patientId);
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
        const artH = doctorPlan.terminArtHint.trim();
        if (artH && (TERMIN_ART_VALUES as readonly string[]).includes(artH)) {
            setArt(normalizeArt(artH));
        }
        const dm = doctorPlan.durationMin.trim();
        if (dm && /^\d+$/.test(dm)) setDauerMin(dm);
        const note = planNextAutofillNote(doctorPlan);
        if (note.trim()) setNotizen(note.trim());
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.delete("apply_plan");
            return p;
        }, { replace: true });
    }, [applyPlanFromQuery, isEdit, draftHydrated, doctorPlan, setSearchParams]);

    function formatPlanForNotes(p: PlanNextTerminV2): string {
        const parts: string[] = [];
        const summary = planNextTerminSummary(p);
        if (summary) parts.push(summary);
        if (p.terminArtHint.trim()) parts.push(`Terminart (Vorschlag): ${p.terminArtHint}`);
        if (p.durationMin.trim()) parts.push(`Dauer ca. ${p.durationMin} Min.`);
        if (p.preferredWeekdays.trim()) parts.push(`Wunsch-Tage: ${p.preferredWeekdays}`);
        if (p.internalNote.trim()) parts.push(`Intern: ${p.internalNote}`);
        return parts.join("\n");
    }

    useEffect(() => {
        if (draftRestoredRef.current) {
            setDraftHydrated(true);
            return;
        }
        draftRestoredRef.current = true;
        if (isEdit) {
            // Im Bearbeiten-Modus übernimmt ein eigener useEffect die Datenlast,
            // der lokale Entwurf wird ignoriert.
            setDraftHydrated(true);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const d = await loadTerminDraftWithMigration(draftId);
                if (cancelled || !d) return;
                if (hasDatumParam) {
                    setDatum(datumInit);
                } else if (d.datum) {
                    setDatum(d.datum);
                }
                if (hasPatientParam && patientInit.trim()) {
                    setPatientId(patientInit.trim());
                } else if (d.patientId) {
                    setPatientId(d.patientId);
                }
                if (!hasPatientParam && d.patientQuery) {
                    setPatientQuery(d.patientQuery);
                }
                if (hasUhrzeitParam && uhrzeitInit) {
                    setUhrzeit(uhrzeitInit);
                } else if (d.uhrzeit) {
                    setUhrzeit(d.uhrzeit);
                }
                if (!hasArztParam && d.arztId) setArztId(d.arztId);
                if (hasArtParam) {
                    setArt(normalizeArt(artInit));
                } else if (d.art) {
                    setArt(d.art);
                }
                if (Array.isArray(d.beschwerdenTags)) setBeschwerdenTags(d.beschwerdenTags);
                if (Array.isArray(d.zahnschmerzenTeeth)) {
                    setZahnschmerzenTeeth(sortFdiTeeth(d.zahnschmerzenTeeth.filter((x) => typeof x === "string")));
                } else if (typeof d.zahnschmerzenTooth === "string" && d.zahnschmerzenTooth.trim()) {
                    setZahnschmerzenTeeth(sortFdiTeeth([d.zahnschmerzenTooth.trim()]));
                }
                if (d.notizen) setNotizen(d.notizen);
                if (d.dauerMin) setDauerMin(d.dauerMin);
                if (d.statusWunsch) setStatusWunsch(d.statusWunsch);
            } catch {
                /* ignore */
            } finally {
                if (!cancelled) setDraftHydrated(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [draftId, hasDatumParam, hasPatientParam, hasArtParam, hasUhrzeitParam, hasArztParam, datumInit, patientInit, artInit, uhrzeitInit, isEdit]);

    useEffect(() => {
        if (!isEdit || !editId) return;
        let cancelled = false;
        setEditLoaded(false);
        setEditError(null);
        void getTermin(editId)
            .then((t) => {
                if (cancelled) return;
                setDatum(t.datum);
                setUhrzeit(t.uhrzeit.length >= 5 ? t.uhrzeit.slice(0, 5) : t.uhrzeit);
                setPatientId(t.patient_id);
                setArztId(t.arzt_id);
                setArt(normalizeArt(t.art));
                const { tags: bTags, teeth: bTeeth } = normalizeBeschwerdenTagsFromStored(t.beschwerden ?? "");
                setBeschwerdenTags(bTags);
                setZahnschmerzenTeeth(bTeeth);
                const notesRaw = t.notizen ?? "";
                const dauerMatch = /Dauer:\s*(\d+)\s*min/.exec(notesRaw);
                if (dauerMatch && dauerMatch[1]) {
                    setDauerMin(dauerMatch[1]);
                }
                const cleanedNotes = notesRaw
                    .split("·")
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0 && !/^Dauer:/i.test(s) && !/^Priorität:/i.test(s))
                    .join(" · ");
                setNotizen(cleanedNotes);
                setStatusWunsch(t.status === "BESTAETIGT" ? "BESTAETIGT" : "GEPLANT");
                setEditLoaded(true);
            })
            .catch((e: unknown) => {
                if (cancelled) return;
                setEditError(errorMessage(e));
                setEditLoaded(true);
            });
        return () => { cancelled = true; };
    }, [isEdit, editId]);

    const searchKeyForDraft = searchParams.toString();

    useEffect(() => {
        if (isEdit) return;
        if (draftFromQuery) return;
        const next = new URLSearchParams(searchKeyForDraft);
        next.set("draft", draftId);
        const qs = next.toString();
        navigate({ pathname: "/termine/neu", search: qs ? `?${qs}` : "" }, { replace: true });
    }, [draftFromQuery, draftId, navigate, searchKeyForDraft, isEdit]);

    useEffect(() => {
        if (!draftHydrated) return;
        if (isEdit) return;
        const snap: TerminDraft = {
            datum,
            uhrzeit,
            patientId,
            patientQuery,
            arztId,
            art,
            beschwerdenTags,
            zahnschmerzenTeeth,
            notizen,
            dauerMin,
            statusWunsch,
        };
        const timer = window.setTimeout(() => {
            void persistTerminDraftToBackend(draftId, snap).catch(() => {
                /* offline — legacy row may be stale until next save */
            });
        }, 400);
        return () => window.clearTimeout(timer);
    }, [datum, uhrzeit, patientId, patientQuery, arztId, art, beschwerdenTags, zahnschmerzenTeeth, notizen, dauerMin, statusWunsch, draftId, draftHydrated, isEdit]);

    useEffect(() => {
        if (!beschwerdenTags.includes(ZAHNSCHMERZ_TAG)) setZahnschmerzenTeeth([]);
    }, [beschwerdenTags]);

    useEffect(() => {
        if (!patientId || session?.rolle !== "ARZT") {
            setChartBefunde([]);
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const akte = await getAkte(patientId);
                const bf = await listZahnbefunde(akte.id);
                if (!cancelled) setChartBefunde(bf);
            } catch {
                if (!cancelled) setChartBefunde([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [patientId, session?.rolle]);

    const load = useCallback(async () => {
        try {
            const [p, t] = await Promise.all([listPatienten(), listTermine()]);
            setPatienten(p);
            setTermine(t);
            try {
                setAerzte(await listAerzte());
            } catch {
                setAerzte([]);
            }
            try {
                setAbwesenheiten(await listAbwesenheiten());
            } catch {
                setAbwesenheiten([]);
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        }
    }, [toast]);

    useEffect(() => {
        void load();
    }, [load]);

    useDismissibleLayer({
        open: patientDropdownOpen,
        rootRef: patientPickerRef,
        onDismiss: () => setPatientDropdownOpen(false),
    });

    useEffect(() => {
        if (!hasArztParam || !arztInit) return;
        if (!aerzte.some((a) => a.id === arztInit)) return;
        setArztId(arztInit);
    }, [hasArztParam, arztInit, aerzte]);

    useEffect(() => {
        if (!session) return;
        if (hasArztParam && arztInit && aerzte.some((a) => a.id === arztInit)) return;
        setArztId((prev) => {
            if (prev) return prev;
            if (session.rolle === "ARZT") return session.user_id;
            const def = (praxisCfg.defaultArztId ?? "").trim();
            if (def && aerzte.some((a) => a.id === def)) return def;
            return aerzte[0]?.id ?? "";
        });
    }, [session, aerzte, hasArztParam, arztInit, praxisCfg.defaultArztId]);

    const busyKeys = useMemo(() => {
        const s = new Set<string>();
        for (const t of termine) {
            if (isEdit && editId && t.id === editId) continue;
            const time = t.uhrzeit.length >= 5 ? t.uhrzeit.slice(0, 5) : t.uhrzeit;
            s.add(`${t.datum}|${time}`);
        }
        return s;
    }, [termine, isEdit, editId]);

    const slotStep = useMemo(() => Math.max(5, Number(effectivePraxisCfg.slotMin) || 30), [effectivePraxisCfg.slotMin]);

    const blockedKeys = useMemo(() => {
        const s = new Set<string>();
        for (let h = 6; h <= 21; h += 1) {
            for (let m = 0; m < 60; m += slotStep) {
                if (h === 21 && m > 0) break;
                const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                if (isSlotBlockedByPraxisConfig(effectivePraxisCfg, datum, hm)) {
                    s.add(`${datum}|${hm}`);
                }
            }
        }
        return s;
    }, [datum, effectivePraxisCfg, slotStep]);

    const combinedBusyKeys = useMemo(() => {
        const all = new Set<string>(busyKeys);
        blockedKeys.forEach((k) => all.add(k));
        return all;
    }, [busyKeys, blockedKeys]);

    const toggleZahnschmerzZahn = useCallback((fdi: string) => {
        setZahnschmerzenTeeth((prev) => {
            const next = new Set(prev);
            if (next.has(fdi)) next.delete(fdi);
            else next.add(fdi);
            return sortFdiTeeth([...next]);
        });
    }, []);

    useEffect(() => {
        const current = uhrzeit.slice(0, 5);
        if (!isSlotBlockedByPraxisConfig(effectivePraxisCfg, datum, current) && !busyKeys.has(`${datum}|${current}`)) return;
        for (let h = 6; h <= 21; h += 1) {
            for (let m = 0; m < 60; m += slotStep) {
                if (h === 21 && m > 0) break;
                const hm = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                if (!isSlotBlockedByPraxisConfig(effectivePraxisCfg, datum, hm) && !busyKeys.has(`${datum}|${hm}`)) {
                    setUhrzeit(hm);
                    return;
                }
            }
        }
    }, [datum, uhrzeit, effectivePraxisCfg, slotStep, busyKeys]);

    const filteredPatients = useMemo(() => {
        const q = patientQuery.trim().toLowerCase();
        if (!q) return patienten.slice(0, 12);
        return patienten.filter((p) => p.name.toLowerCase().includes(q) || p.versicherungsnummer.toLowerCase().includes(q)).slice(0, 20);
    }, [patientQuery, patienten]);

    const selectedPatient = patienten.find((p) => p.id === patientId);

    useEffect(() => {
        if (!patientInit) return;
        setPatientId(patientInit);
    }, [patientInit]);

    useEffect(() => {
        if (!patientId) return;
        if (patientQuery.trim()) return;
        const p = patienten.find((x) => x.id === patientId);
        if (p) setPatientQuery(p.name);
    }, [patientId, patienten, patientQuery]);

    const calendarDays = useMemo(() => {
        const start = startOfMonth(calendarMonth);
        const end = endOfMonth(calendarMonth);
        const gridStart = startOfWeek(start, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [calendarMonth]);

    const beschwerdenStr = beschwerdenTags.length ? buildBeschwerdenPayload(beschwerdenTags, zahnschmerzenTeeth) : "";

    const submit = async () => {
        setPatientError("");
        if (!patientId) {
            setPatientError("Bitte einen Patienten auswählen.");
            return;
        }
        if (!arztId || !datum || !uhrzeit) {
            toast("Datum, Uhrzeit und Behandler sind Pflichtfelder.", "error");
            return;
        }
        const durMin = Math.max(5, Number(dauerMin) || 30);
        const startM = uhrzeitToMinutes(uhrzeit);
        const blockReason = terminSchedulingBlockReason(effectivePraxisCfg, abwesenheiten, datum, startM, startM + durMin);
        if (blockReason) {
            toast(blockReason, "error");
            return;
        }
        const parts: string[] = [];
        if (dauerMin) parts.push(`Dauer: ${dauerMin} min`);
        if (notizen.trim()) parts.push(notizen.trim());
        if (searchParams.get("art") === "NOTFALL") parts.push("Priorität: Notfall (über Kalender markiert)");
        const notizenPayload = parts.length ? parts.join(" · ") : undefined;
        let artSend = art;
        if (searchParams.get("art") === "NOTFALL") artSend = "BEHANDLUNG";
        setBusy(true);
        try {
            const timeNorm = uhrzeit.length === 5 ? `${uhrzeit}:00` : uhrzeit;
            if (isEdit && editId) {
                await updateTermin(editId, {
                    patient_id: patientId,
                    arzt_id: arztId,
                    datum,
                    uhrzeit: timeNorm,
                    art: artSend,
                    beschwerden: beschwerdenStr || null,
                    notizen: notizenPayload ?? null,
                    status: statusWunsch || "GEPLANT",
                });
                toast("Termin aktualisiert");
                navigate("/termine");
                return;
            }
            const created = await createTermin({
                patient_id: patientId,
                arzt_id: arztId,
                datum,
                uhrzeit: timeNorm,
                art: artSend,
                beschwerden: beschwerdenStr || null,
                notizen: notizenPayload ?? null,
            });
            if (statusWunsch && statusWunsch !== "GEPLANT") {
                try {
                    await updateTermin(created.id, { status: statusWunsch });
                } catch {
                    /* optional */
                }
            }
            toast("Termin gespeichert");
            await clearTerminDraftFromBackend(draftId);
            stripLegacyTerminDraftLocalStorage(draftId);
            navigate("/termine");
        } catch (e) {
            const msg = errorMessage(e);
            if (isTerminConflictErrorMessage(msg) && arztId && datum && uhrzeit) {
                const alts = suggestAlternativeTerminSlots({
                    datum,
                    arztId,
                    preferredUhrzeit: uhrzeit,
                    durMin,
                    slotStep,
                    termine,
                    praxisCfg: effectivePraxisCfg,
                    abwesenheiten,
                    excludeTerminId: isEdit && editId ? editId : undefined,
                });
                const hint = formatAlternativeSlotsDe(alts);
                toast(
                    hint
                        ? `Terminkonflikt. Freie Alternativen: ${hint}`
                        : `Terminkonflikt: ${msg}`,
                    "error",
                );
            } else {
                toast(`Fehler: ${msg}`, "error");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in">
            <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="btn btn-subtle" onClick={() => navigate("/termine")}>
                    <ChevronLeftIcon /> Zurück
                </button>
                <h1 className="page-title" style={{ margin: 0 }}>{isEdit ? "Termin bearbeiten" : "Neuer Termin"}</h1>
                {isEdit && !editLoaded ? (
                    <span className="pill blue">Wird geladen…</span>
                ) : null}
                {isEdit && editError ? (
                    <span className="pill red">{editError}</span>
                ) : null}
            </div>

            {doctorPlan ? (
                <div
                    role="note"
                    aria-label="Terminplanung vom Arzt"
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
                        <div style={{ fontWeight: 700, fontSize: 12.5 }}>Kurzhinweis aus der Akte</div>
                        <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--fg-2)", fontWeight: 500 }}>
                            {planNextReceptionTeaser(doctorPlan) || planNextAutofillNote(doctorPlan) || "—"}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-subtle btn-sm"
                        onClick={() => {
                            const block = formatPlanForNotes(doctorPlan);
                            if (!notizen.trim()) setNotizen(block);
                            else setNotizen((prev) => `${prev.trim()}\n\n${block}`);
                        }}
                    >
                        In Notizen
                    </button>
                </div>
            ) : null}

            <Card>
                <div style={{ padding: 16 }}>
                    <CardHeader title={isEdit ? "Termin bearbeiten" : "Termin planen"} />
                    <div className="termin-create-split" style={{ marginTop: 12 }}>
                        <div className="col" style={{ gap: 14 }}>
                            <div>
                                <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-3)" }}>Kalender</span>
                                    <div className="row" style={{ gap: 6 }}>
                                        <button type="button" className="icon-btn" aria-label="Vorheriger Monat" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                                            <ChevronLeftIcon size={14} />
                                        </button>
                                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 140, textAlign: "center" }}>{format(calendarMonth, "LLLL yyyy", { locale: de })}</span>
                                        <button type="button" className="icon-btn" aria-label="Nächster Monat" onClick={() => setCalendarMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                                            <ChevronRightIcon size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 11, color: "var(--fg-4)", textAlign: "center", marginBottom: 4 }}>
                                    {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => <span key={d}>{d}</span>)}
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                                    {calendarDays.map((day) => {
                                        const iso = format(day, "yyyy-MM-dd");
                                        const inM = isSameMonth(day, calendarMonth);
                                        const sel = iso === datum;
                                        const isToday = isSameDay(day, new Date());
                                        const blockedDay = inM && !hasAnyAvailableSlot(effectivePraxisCfg, iso);
                                        return (
                                            <button
                                                key={iso}
                                                type="button"
                                                disabled={!inM || blockedDay}
                                                onClick={() => inM && !blockedDay && setDatum(iso)}
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
                                                title={blockedDay ? "Kein freier Termin (Praxisplanung)" : undefined}
                                            >
                                                {format(day, "d")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="col" style={{ gap: 12 }}>
                                <Input id="tc-datum" type="date" label="Datum" value={datum} onChange={(e) => setDatum(e.target.value)} />
                                <div>
                                    <span className="form-label form-label--mb-8">Zeit</span>
                                    <TimeSlotPicker value={uhrzeit.slice(0, 5)} onChange={(t) => setUhrzeit(t)} busyKeys={combinedBusyKeys} selectedDate={datum} stepMinutes={slotStep} />
                                    <p style={{ marginTop: 8, marginBottom: 0, fontSize: 12, color: "var(--fg-3)" }}>
                                        Ausgegraute Zeiten sind durch bestehende Termine oder Praxisplanung (Urlaub, halbe Tage, Notfall-Schließung) gesperrt.
                                    </p>
                                </div>
                                <Select id="tc-dauer" label="Dauer" value={dauerMin} onChange={(e) => setDauerMin(e.target.value)} options={DURATION_OPTIONS} />
                            </div>
                        </div>

                        <div className="col" style={{ gap: 14 }}>
                            <div>
                                <span className="form-label">Patient</span>
                                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                    <div ref={patientPickerRef} style={{ position: "relative", flex: "1 1 240px", minWidth: 180 }}>
                                        <input
                                            className="input-edit"
                                            style={{ width: "100%" }}
                                            placeholder="Patient suchen…"
                                            value={patientQuery}
                                            onFocus={() => setPatientDropdownOpen(true)}
                                            onChange={(e) => { setPatientQuery(e.target.value); setPatientDropdownOpen(true); }}
                                            aria-label="Patient suchen"
                                        />
                                        {patientDropdownOpen ? (
                                            <div
                                                role="listbox"
                                                aria-label="Patient Treffer"
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
                                                        onClick={() => navigate(`/patienten?from=termin-create&draft=${encodeURIComponent(draftId)}`)}
                                                        style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--fg-3)" }}
                                                    >
                                                        Keine Treffer - In Akten suchen
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
                                                            setZahnschmerzenTeeth([]);
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
                                                        <span style={{ color: "var(--fg-3)", marginLeft: 8 }}>{p.versicherungsnummer}</span>
                                                    </button>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/patienten?from=termin-create&draft=${encodeURIComponent(draftId)}`)}
                                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", border: "none", borderTop: "1px solid var(--line)", background: "var(--bg-elev)", cursor: "pointer", fontSize: 13, color: "var(--accent)" }}
                                                >
                                                    In Akten suchen...
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                    <Button type="button" variant="secondary" onClick={() => navigate("/patienten/neu")}>Neuer Patient</Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => navigate(`/patienten?from=termin-create&draft=${encodeURIComponent(draftId)}`)}
                                    >
                                        In Akten suchen
                                    </Button>
                                </div>
                                {patientError ? <p className="text-error" style={{ fontSize: 12, marginTop: 6 }}>{patientError}</p> : null}
                                {selectedPatient ? (
                                    <p style={{ fontSize: 12, color: "var(--fg-3)", marginTop: 6 }}>Ausgewählt: <b>{selectedPatient.name}</b></p>
                                ) : null}
                            </div>

                            <Select
                                id="tc-arzt"
                                label="Behandler (Arzt)"
                                value={arztId}
                                onChange={(e) => setArztId(e.target.value)}
                                options={[{ value: "", label: aerzte.length ? "— wählen —" : "Kein Arzt" }, ...aerzte.map((a) => ({ value: a.id, label: a.name }))]}
                            />
                            <Select id="tc-art" label="Behandlungstyp" value={art} onChange={(e) => setArt(e.target.value)} options={BEHANDLUNG_OPTIONS} />
                            <Select id="tc-status" label="Status" value={statusWunsch} onChange={(e) => setStatusWunsch(e.target.value)} options={STATUS_OPTIONS} />
                            <TagInput label="Beschwerden" value={beschwerdenTags} onChange={setBeschwerdenTags} suggestions={BESCHWERDEN_SUG} />
                            {beschwerdenTags.includes(ZAHNSCHMERZ_TAG) ? (
                                <DentalToothPickerMini
                                    befunde={chartBefunde}
                                    selectedTeeth={zahnschmerzenTeeth}
                                    onToggleTooth={toggleZahnschmerzZahn}
                                />
                            ) : null}
                            <Textarea id="tc-notes" label="Notizen / Bemerkungen" value={notizen} onChange={(e) => setNotizen(e.target.value)} style={{ minHeight: 88 }} />
                        </div>
                    </div>

                    <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Button type="button" variant="danger" onClick={() => navigate("/termine")}>Abbrechen</Button>
                        <Button
                            type="button"
                            onClick={() => void submit()}
                            disabled={busy || (isEdit && !editLoaded)}
                            loading={busy}
                        >
                            {isEdit ? "Änderungen speichern" : "Speichern"}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
