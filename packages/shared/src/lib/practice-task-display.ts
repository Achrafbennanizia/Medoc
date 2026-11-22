/**
 * Practice-task list/drawer copy: store English (canonical), display via device locale.
 *
 * Flow: stored (possibly legacy translated) → English markers → `t` / `tp` for device locale.
 * Tickets: title is always the kind label — never the free-text message.
 */
import { clinicalServiceLabel } from "./clinical-service-label";
import { displayPracticeTaskTitle, type PracticeTaskCopy } from "./finance-order-labels";

type TFn = (key: string) => string;
type TParamsFn = (key: string, params: Record<string, string | number>) => string;

/** Stored title for new TICKET rows (not the message). */
export const CANONICAL_TICKET_TITLE_EN = "Ticket";

/** English fallback title for plan-next appointment tasks. */
export const PLAN_NEXT_TITLE_EN = "Plan next appointment";

export type PracticeTaskListCopy = PracticeTaskCopy & {
    body?: string | null;
    status?: string | null;
};

/** True when the stored title is (or was) just the ticket message. */
export function ticketTitleIsMessage(task: PracticeTaskListCopy): boolean {
    if ((task.kind ?? "").trim() !== "TICKET") return false;
    const title = (task.title ?? "").trim();
    const body = (task.body ?? "").trim();
    if (!title) return true;
    if (title === CANONICAL_TICKET_TITLE_EN) return false;
    if (!body) return false;
    const bare = title.replace(/…$/u, "").trim();
    return body === title || body.startsWith(bare);
}

/**
 * List / drawer headline.
 * Tickets always show the translated kind — never the message body.
 */
export function practiceTaskHeadline(task: PracticeTaskListCopy, t: TFn): string {
    const kind = (task.kind ?? "").trim();
    if (kind === "TICKET" || ticketTitleIsMessage(task)) {
        return t("practice.tasks.kind.ticket");
    }
    const title = canonicalizePracticeTaskLineToEn((task.title ?? "").trim());
    if (title === CANONICAL_TICKET_TITLE_EN) {
        return t("practice.tasks.kind.ticket");
    }
    if (title === PLAN_NEXT_TITLE_EN) {
        return t("patient.detail.plan_next.task_title_fallback");
    }
    return displayPracticeTaskTitle(title, t, task);
}

/** Preview under the headline — omit when it would repeat the title. */
export function practiceTaskPreview(task: PracticeTaskListCopy, t: TFn, tp?: TParamsFn): string {
    const body = (task.body ?? "").trim();
    if (!body) return "";
    const kind = (task.kind ?? "").trim();
    if (kind === "TICKET" || ticketTitleIsMessage(task)) {
        // Free-text message: show as written (dir=auto in UI). Do not invent catalog translations.
        return body;
    }
    const headline = practiceTaskHeadline(task, t);
    const shown = displayPracticeTaskBody(body, t, tp);
    if (!shown) return "";
    // Single-line preview: newlines collapse in CSS; join with a middle dot.
    const compact = shown.replace(/\n+/g, " · ");
    if (compact === headline) return "";
    const title = canonicalizePracticeTaskLineToEn((task.title ?? "").trim());
    if (title && (body === title || compact === displayPracticeTaskTitle(title, t, task))) return "";
    return compact;
}

const DURATION_EN = /^Duration:\s*(.+)\s*min$/iu;
const INTERVAL_EN = /^Interval:\s*about\s*(.+)\s*weeks$/iu;
const WEEKDAYS_EN = /^Preferred weekdays:\s*(.+)$/iu;
const INTERNAL_EN = /^Internal:\s*(.+)$/iu;

/** Legacy locale duration / interval / weekdays / internal → English markers. */
const DURATION_LOCALE = [
    /^Duration:\s*(.+)\s*min$/iu,
    /^Dauer:\s*(.+)\s*Min\.?$/iu,
    /^Durée\s*:\s*(.+)\s*min$/iu,
    /^المدة:\s*(.+)\s*دقيقة$/u,
];
const INTERVAL_LOCALE = [
    /^Interval:\s*about\s*(.+)\s*weeks$/iu,
    /^Abstand:\s*ca\.\s*(.+)\s*Wochen$/iu,
    /^Intervalle\s*:\s*environ\s*(.+)\s*semaines$/iu,
    /^الفترة:\s*حوالي\s*(.+)\s*أسابيع$/u,
];
const WEEKDAYS_LOCALE = [
    /^Preferred weekdays:\s*(.+)$/iu,
    /^Bevorzugte Wochentage:\s*(.+)$/iu,
    /^Jours préférés\s*:\s*(.+)$/iu,
    /^أيام الأسبوع المفضلة:\s*(.+)$/u,
];
const INTERNAL_LOCALE = [
    /^Internal:\s*(.+)$/iu,
    /^Intern:\s*(.+)$/iu,
    /^Interne\s*:\s*(.+)$/iu,
    /^داخلي:\s*(.+)$/u,
];

const EXACT_TO_EN: ReadonlyMap<string, string> = new Map([
    [PLAN_NEXT_TITLE_EN, PLAN_NEXT_TITLE_EN],
    ["Nächsten Termin planen", PLAN_NEXT_TITLE_EN],
    ["Planifier le prochain rendez-vous", PLAN_NEXT_TITLE_EN],
    ["تخطيط الموعد التالي", PLAN_NEXT_TITLE_EN],
    ["Urgent", "Urgent"],
    ["Dringend", "Urgent"],
    ["عاجل", "Urgent"],
    ["Soon", "Soon"],
    ["Zeitnah", "Soon"],
    ["Prochainement", "Soon"],
    ["قريبًا", "Soon"],
    ["قريبا", "Soon"],
    ["Routine", "Routine"],
    ["روتيني", "Routine"],
    // Appointment kind labels → enum codes (stored by old UI as translated labels).
    ["Check-up", "CHECKUP"],
    ["Kontrolle", "CHECKUP"],
    ["Contrôle", "CHECKUP"],
    ["متابعة", "CHECKUP"],
    ["Treatment", "TREATMENT"],
    ["Behandlung", "TREATMENT"],
    ["Traitement", "TREATMENT"],
    ["علاج", "TREATMENT"],
    ["Examination", "EXAMINATION"],
    ["Untersuchung", "EXAMINATION"],
    ["Examen", "EXAMINATION"],
    ["فحص", "EXAMINATION"],
    ["Consultation", "CONSULTATION"],
    ["Beratung", "CONSULTATION"],
    ["استشارة", "CONSULTATION"],
    ["First visit", "FIRST_VISIT"],
    ["Erstbesuch", "FIRST_VISIT"],
    ["Première visite", "FIRST_VISIT"],
    ["الزيارة الأولى", "FIRST_VISIT"],
    ["CHECKUP", "CHECKUP"],
    ["TREATMENT", "TREATMENT"],
    ["EXAMINATION", "EXAMINATION"],
    ["CONSULTATION", "CONSULTATION"],
    ["FIRST_VISIT", "FIRST_VISIT"],
]);

/**
 * Map one stored line (English or legacy DE/FR/AR) to the English canonical form.
 */
export function canonicalizePracticeTaskLineToEn(line: string): string {
    const raw = line.trim();
    if (!raw) return "";
    const exact = EXACT_TO_EN.get(raw);
    if (exact) return exact;

    for (const re of DURATION_LOCALE) {
        const m = re.exec(raw);
        if (m) return `Duration: ${m[1]!.trim()} min`;
    }
    for (const re of INTERVAL_LOCALE) {
        const m = re.exec(raw);
        if (m) return `Interval: about ${m[1]!.trim()} weeks`;
    }
    for (const re of WEEKDAYS_LOCALE) {
        const m = re.exec(raw);
        if (m) return `Preferred weekdays: ${m[1]!.trim()}`;
    }
    for (const re of INTERNAL_LOCALE) {
        const m = re.exec(raw);
        if (m) return `Internal: ${m[1]!.trim()}`;
    }
    return raw;
}

/**
 * Translate a stored English (or mixed) task body line-by-line into the device locale.
 * Unknown free text is passed through `clinicalServiceLabel` for catalog phrases only.
 */
export function displayPracticeTaskBody(body: string, t: TFn, tp?: TParamsFn): string {
    const raw = body.trim();
    if (!raw) return "";
    return raw
        .split(/\n/)
        .map((line) => translatePracticeTaskBodyLine(canonicalizePracticeTaskLineToEn(line.trim()), t, tp))
        .filter(Boolean)
        .join("\n");
}

function translatePracticeTaskBodyLine(line: string, t: TFn, tp?: TParamsFn): string {
    if (!line) return "";
    if (line === PLAN_NEXT_TITLE_EN) return t("patient.detail.plan_next.task_title_fallback");
    if (line === "Urgent") return t("patient.detail.plan_next.urgency.urgent");
    if (line === "Soon") return t("patient.detail.plan_next.urgency.soon");
    if (line === "Routine") return t("patient.detail.plan_next.urgency.routine");

    const duration = DURATION_EN.exec(line);
    if (duration && tp) {
        return tp("patient.detail.plan_next.task_duration", { min: duration[1]!.trim() });
    }
    const interval = INTERVAL_EN.exec(line);
    if (interval && tp) {
        return tp("patient.detail.plan_next.task_interval", { weeks: interval[1]!.trim() });
    }
    const weekdays = WEEKDAYS_EN.exec(line);
    if (weekdays && tp) {
        return tp("patient.detail.plan_next.task_weekdays", { days: weekdays[1]!.trim() });
    }
    const internal = INTERNAL_EN.exec(line);
    if (internal && tp) {
        return tp("patient.detail.plan_next.task_internal", { note: internal[1]!.trim() });
    }

    // Appointment kind enums stored as English codes.
    const kindKey = `appointment.kind.${line}`;
    const kindLabel = t(kindKey);
    if (kindLabel !== kindKey) return kindLabel;

    return clinicalServiceLabel(line);
}

/** Inbox status buckets. */
export type PracticeTaskInboxView = "all" | "open" | "done" | "verify";

export function practiceTaskMatchesInboxView(
    status: string | null | undefined,
    view: PracticeTaskInboxView,
): boolean {
    const s = (status ?? "").trim();
    if (view === "all") return true;
    if (view === "verify") return s === "DONE_RECEPTION";
    if (view === "done") return s === "DONE" || s === "VALIDATED";
    // open = not finished
    return s !== "DONE" && s !== "VALIDATED" && s !== "DONE_RECEPTION";
}

export function practiceTaskMatchesInboxKind(
    kind: string | null | undefined,
    filterKind: string,
): boolean {
    const k = filterKind.trim();
    if (!k) return true;
    return (kind ?? "").trim() === k;
}
