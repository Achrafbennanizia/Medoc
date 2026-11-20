/**
 * Status registry — the single, typed definition of every status an item can have in MeDoc.
 *
 * Design rules (see docs/manual/status-manual.md, generated from this file):
 * 1. A **status** is a persisted lifecycle state with a wire value stored in SQLite. Nothing else is a status.
 * 2. A **flag** is a derived, non-exclusive marker (e.g. "rescheduled", "overdue"). Flags are shown *next to*
 *    the status, never instead of it (the old calendar replaced CONFIRMED with "Changed" / "In treatment").
 * 3. Each status belongs to exactly one **phase** — the sort and colour semantics are derived from it, so
 *    lists order consistently everywhere: action needed → in progress → awaiting review → done → closed.
 * 4. Transitions mirror `crates/shared/medoc-core/src/domain/services/workflow_transitions.rs`. The UI must
 *    only offer transitions listed here; the backend stays authoritative.
 * 5. Adding a status: add the wire value to `config/enums.yaml` (when backend-enforced), add it here with
 *    phase + transitions, add `status.<entity>.<state>.label|description` in all four locales, run
 *    `node scripts/generate-manuals.mjs`. The registry test fails when any of that is missing.
 */

/** Lifecycle phase — drives ordering and colour. Order of this list == list sort order. */
export const STATUS_PHASES = ["attention", "todo", "active", "review", "done", "closed"] as const;
export type StatusPhase = (typeof STATUS_PHASES)[number];

/** Visual tone (maps to `.pill` colour classes and badge variants). */
export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger" | "muted";

export type StatusDefinition = {
    /** Persisted wire value (UPPER_SNAKE). */
    readonly wire: string;
    readonly phase: StatusPhase;
    readonly tone: StatusTone;
    /** No further transitions possible. */
    readonly terminal: boolean;
    /** Wire values reachable from here (business rule, RBAC applied separately). */
    readonly next: readonly string[];
};

export type StatusEntity = {
    readonly id: StatusEntityId;
    /** Where the value lives (manual + audits). */
    readonly source: string;
    /** First state of a newly created item. */
    readonly initial: string;
    readonly states: readonly StatusDefinition[];
    /** Derived markers that are NOT statuses. */
    readonly flags?: readonly string[];
};

export type StatusEntityId =
    | "appointment"
    | "patient"
    | "patient_chart"
    | "payment"
    | "purchase_order"
    | "practice_task"
    | "practice_ticket"
    | "feedback"
    | "prescription"
    | "device_trust"
    | "pairing"
    | "work_session";

function s(wire: string, phase: StatusPhase, tone: StatusTone, next: readonly string[] = []): StatusDefinition {
    return { wire, phase, tone, terminal: next.length === 0, next };
}

export const STATUS_REGISTRY: Readonly<Record<StatusEntityId, StatusEntity>> = {
    appointment: {
        id: "appointment",
        source: "appointment.status (config/enums.yaml · AppointmentStatus)",
        initial: "PLANNED",
        states: [
            s("PLANNED", "todo", "info", ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
            s("CONFIRMED", "active", "progress", ["COMPLETED", "CANCELLED", "NO_SHOW"]),
            s("COMPLETED", "done", "success"),
            s("NO_SHOW", "closed", "warning"),
            s("CANCELLED", "closed", "muted"),
        ],
        flags: ["rescheduled", "emergency"],
    },
    patient: {
        id: "patient",
        source: "patient.status (config/enums.yaml · PatientStatus)",
        initial: "NEW",
        states: [
            s("NEW", "todo", "info", ["ACTIVE", "VALIDATED", "READONLY"]),
            s("ACTIVE", "active", "progress", ["VALIDATED", "READONLY"]),
            s("VALIDATED", "done", "success", ["ACTIVE", "READONLY"]),
            s("READONLY", "closed", "muted"),
        ],
    },
    patient_chart: {
        id: "patient_chart",
        source: "patient_chart.status (config/enums.yaml · ChartStatus)",
        initial: "DRAFT",
        states: [
            s("DRAFT", "todo", "neutral", ["IN_PROGRESS", "VALIDATED", "DECLINED"]),
            s("IN_PROGRESS", "review", "progress", ["VALIDATED", "DECLINED"]),
            s("DECLINED", "attention", "danger", ["IN_PROGRESS", "VALIDATED"]),
            s("VALIDATED", "done", "success", ["IN_PROGRESS"]),
            s("READONLY", "closed", "muted"),
        ],
    },
    payment: {
        id: "payment",
        source: "payment.status (config/enums.yaml · PaymentStatus)",
        initial: "OUTSTANDING",
        states: [
            s("OUTSTANDING", "todo", "warning", ["PARTIALLY_PAID", "PAID", "CANCELLED"]),
            s("PARTIALLY_PAID", "active", "progress", ["PAID", "CANCELLED"]),
            s("PAID", "done", "success"),
            s("CANCELLED", "closed", "muted"),
        ],
    },
    purchase_order: {
        id: "purchase_order",
        source: "purchase_order.status (config/enums.yaml · OrderStatus)",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "info", ["IN_TRANSIT", "DELIVERED", "CANCELLED"]),
            s("IN_TRANSIT", "active", "progress", ["DELIVERED", "CANCELLED"]),
            s("DELIVERED", "done", "success"),
            s("CANCELLED", "closed", "muted"),
        ],
        flags: ["overdue"],
    },
    practice_task: {
        id: "practice_task",
        source: "practice_task.status (workflow_transitions.rs · TASK_STATUSES)",
        initial: "OPEN",
        states: [
            s("BACK", "attention", "danger", ["OPEN", "IN_PROGRESS"]),
            s("OPEN", "todo", "warning", ["IN_PROGRESS"]),
            s("IN_PROGRESS", "active", "progress", ["DONE_RECEPTION", "OPEN"]),
            s("DONE_RECEPTION", "review", "info", ["VALIDATED", "BACK"]),
            s("VALIDATED", "done", "success"),
        ],
    },
    practice_ticket: {
        id: "practice_ticket",
        source: "practice_ticket.status (workflow_transitions.rs)",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "warning", ["IN_PROGRESS", "DONE"]),
            s("IN_PROGRESS", "active", "progress", ["DONE", "OPEN"]),
            s("DONE", "done", "success"),
        ],
    },
    feedback: {
        id: "feedback",
        source: "feedback.status (config/enums.yaml · FeedbackStatus)",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "warning", ["IN_PROGRESS", "DONE"]),
            s("IN_PROGRESS", "active", "progress", ["DONE", "OPEN"]),
            s("DONE", "done", "success"),
        ],
    },
    prescription: {
        id: "prescription",
        source: "prescription.status",
        initial: "DRAFT",
        states: [s("DRAFT", "todo", "neutral", ["ISSUED"]), s("ISSUED", "done", "success")],
    },
    device_trust: {
        id: "device_trust",
        source: "device_session.trust_status",
        initial: "UNCHECKED",
        states: [
            s("SUSPECTED", "attention", "danger", ["TRUSTED", "UNCHECKED"]),
            s("UNCHECKED", "todo", "warning", ["TRUSTED", "SUSPECTED"]),
            s("TRUSTED", "done", "success", ["SUSPECTED"]),
        ],
    },
    pairing: {
        id: "pairing",
        source: "pairing_request.status (sync_tables.rs CHECK)",
        initial: "PENDING",
        states: [
            s("PENDING", "todo", "warning", ["ACCEPTED", "REJECTED"]),
            s("ACCEPTED", "done", "success", ["REVOKED"]),
            s("REJECTED", "closed", "danger"),
            s("REVOKED", "closed", "muted"),
        ],
        flags: ["awaiting_code"],
    },
    work_session: {
        id: "work_session",
        source: "work_time_session.status (rust_only.rs CHECK)",
        initial: "RUNNING",
        states: [
            s("RUNNING", "active", "success", ["PAUSED", "ENDED"]),
            s("PAUSED", "todo", "warning", ["RUNNING", "ENDED"]),
            s("ENDED", "closed", "muted"),
        ],
    },
};

export const STATUS_ENTITY_IDS = Object.keys(STATUS_REGISTRY) as StatusEntityId[];

/** Normalise legacy / German wire values to the canonical English wire (inbound only). */
const LEGACY_WIRE: Readonly<Record<string, string>> = {
    NICHTERSCHIENEN: "NO_SHOW",
    GEPLANT: "PLANNED",
    BESTAETIGT: "CONFIRMED",
    ABGESCHLOSSEN: "COMPLETED",
    STORNIERT: "CANCELLED",
};

export function normalizeStatusWire(raw: string | null | undefined): string {
    const up = String(raw ?? "").trim().toUpperCase();
    return LEGACY_WIRE[up] ?? up;
}

export function statusDefinition(entity: StatusEntityId, wire: string | null | undefined): StatusDefinition | null {
    const w = normalizeStatusWire(wire);
    return STATUS_REGISTRY[entity].states.find((st) => st.wire === w) ?? null;
}

/** i18n key for the short label, e.g. `status.appointment.no_show.label`. */
export function statusLabelKey(entity: StatusEntityId, wire: string): string {
    return `status.${entity}.${normalizeStatusWire(wire).toLowerCase()}.label`;
}

/** i18n key for the one-sentence meaning (tooltips, status manual). */
export function statusDescriptionKey(entity: StatusEntityId, wire: string): string {
    return `status.${entity}.${normalizeStatusWire(wire).toLowerCase()}.description`;
}

export function statusFlagLabelKey(entity: StatusEntityId, flag: string): string {
    return `status.${entity}.flag.${flag}`;
}

/** Can the item move from `from` to `to`? (same → same is a no-op and allowed). */
export function canTransition(entity: StatusEntityId, from: string, to: string): boolean {
    const a = normalizeStatusWire(from);
    const b = normalizeStatusWire(to);
    if (a === b) return true;
    return statusDefinition(entity, a)?.next.includes(b) ?? false;
}

/** Statuses a user may pick next (current first, then allowed transitions in registry order). */
export function nextStatuses(entity: StatusEntityId, current: string): string[] {
    const cur = normalizeStatusWire(current);
    const def = statusDefinition(entity, cur);
    const order = STATUS_REGISTRY[entity].states.map((st) => st.wire);
    const reachable = new Set(def?.next ?? []);
    return [cur, ...order.filter((w) => reachable.has(w))];
}

/** Sort rank: phase first, then registry order within the phase. Unknown statuses sink to the end. */
export function statusRank(entity: StatusEntityId, wire: string | null | undefined): number {
    const def = statusDefinition(entity, wire);
    if (!def) return STATUS_PHASES.length * 100;
    const phase = STATUS_PHASES.indexOf(def.phase);
    const idx = STATUS_REGISTRY[entity].states.indexOf(def);
    return phase * 100 + idx;
}

/** Does this status still need someone to act? (attention / todo / active / review) */
export function statusIsOpen(entity: StatusEntityId, wire: string | null | undefined): boolean {
    const def = statusDefinition(entity, wire);
    return def != null && def.phase !== "done" && def.phase !== "closed";
}

/** Legacy pill colour class used across tables (`.pill.<class>`). */
export function statusPillClass(tone: StatusTone): string {
    switch (tone) {
        case "success":
            return "green";
        case "danger":
            return "red";
        case "warning":
            return "yellow";
        case "progress":
            return "blue";
        case "info":
            return "accent";
        default:
            return "grey";
    }
}

/** Badge variant for `<Badge>` (packages/ui). */
export function statusBadgeVariant(tone: StatusTone): "default" | "primary" | "warning" | "success" | "error" {
    switch (tone) {
        case "success":
            return "success";
        case "danger":
            return "error";
        case "warning":
            return "warning";
        case "progress":
        case "info":
            return "primary";
        default:
            return "default";
    }
}
