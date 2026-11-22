/**
 * Status registry — the single, typed definition of every status an item can have in MeDoc and of how the
 * app reacts to it. The status guide (Help → Status guide, `docs/manual/status-guide.*.md`) is generated
 * from this file, so documentation cannot drift from behaviour.
 *
 * Rules:
 * 1. A **status** is one lifecycle state. A **flag** is a derived marker shown next to it ("rescheduled",
 *    "overdue") and never replaces it.
 * 2. Every status has a **phase** (sort + colour semantics): needs attention → to do → in progress →
 *    awaiting review → done → closed. Lists order by phase everywhere.
 * 3. Every status declares its **capabilities** — what the app lets you do in that state. Views ask
 *    `statusAllows(entity, status, "edit")` instead of hard-coding status lists.
 * 4. Transitions mirror the backend (`crates/shared/medoc-core/src/domain/status.rs`,
 *    `domain/services/workflow_transitions.rs`). The backend stays authoritative.
 * 5. `derived` entities are computed by the app (not chosen by a person); their `next` lists describe
 *    what can happen automatically.
 * 6. Adding a status: add it here (phase, tone, next, can), add `status.<entity>.<state>.label|description`
 *    in all four locales, run `npm run manuals`. `status-registry.test.ts` fails when anything is missing.
 */

export const STATUS_PHASES = ["attention", "todo", "active", "review", "done", "closed"] as const;
export type StatusPhase = (typeof STATUS_PHASES)[number];

export type StatusTone = "neutral" | "info" | "progress" | "warning" | "success" | "danger" | "muted";

/** What the app allows while an item is in a status (its reaction to the status). */
export const STATUS_CAPABILITIES = ["edit", "delete", "reschedule", "bill", "print", "remind", "reopen", "hidden"] as const;
export type StatusCapability = (typeof STATUS_CAPABILITIES)[number];

export type StatusDefinition = {
    readonly wire: string;
    readonly phase: StatusPhase;
    readonly tone: StatusTone;
    readonly terminal: boolean;
    readonly next: readonly string[];
    readonly can: readonly StatusCapability[];
};

export type StatusEntityId =
    | "appointment"
    | "patient"
    | "patient_list"
    | "patient_chart"
    | "treatment"
    | "prescription"
    | "certificate"
    | "sick_leave"
    | "payment"
    | "invoice"
    | "purchase_order"
    | "contract"
    | "catalog_item"
    | "day_close"
    | "practice_task"
    | "practice_ticket"
    | "feedback"
    | "device_trust"
    | "device_provisioning"
    | "pairing"
    | "work_session"
    | "connection";

export type StatusEntity = {
    readonly id: StatusEntityId;
    /** Where the value lives (manual + audits). */
    readonly source: string;
    readonly initial: string;
    /** Computed by the app, not picked by a person. */
    readonly derived?: boolean;
    readonly states: readonly StatusDefinition[];
    readonly flags?: readonly string[];
};

function s(
    wire: string,
    phase: StatusPhase,
    tone: StatusTone,
    next: readonly string[] = [],
    can: readonly StatusCapability[] = [],
): StatusDefinition {
    return { wire, phase, tone, terminal: next.length === 0, next, can };
}

export const STATUS_REGISTRY: Readonly<Record<StatusEntityId, StatusEntity>> = {
    appointment: {
        id: "appointment",
        source: "appointment.status · domain/status.rs AppointmentStatus",
        initial: "PLANNED",
        states: [
            s("PLANNED", "todo", "info", ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"], ["edit", "delete", "reschedule", "remind"]),
            s("CONFIRMED", "todo", "progress", ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"], ["edit", "reschedule", "remind"]),
            s("IN_PROGRESS", "active", "progress", ["COMPLETED"], ["edit"]),
            s("COMPLETED", "done", "success", [], ["bill", "print"]),
            s("NO_SHOW", "closed", "warning", ["PLANNED"], ["reopen"]),
            s("CANCELLED", "closed", "muted", ["PLANNED"], ["reopen", "delete"]),
        ],
        flags: ["rescheduled", "emergency"],
    },
    patient: {
        id: "patient",
        source: "patient.status · domain/status.rs PatientStatus",
        initial: "NEW",
        states: [
            s("NEW", "todo", "info", ["ACTIVE", "VALIDATED", "READONLY", "ARCHIVED"], ["edit", "delete"]),
            s("ACTIVE", "active", "progress", ["VALIDATED", "READONLY", "ARCHIVED"], ["edit", "bill"]),
            s("VALIDATED", "done", "success", ["READONLY", "ARCHIVED"], ["edit", "bill", "print"]),
            s("READONLY", "closed", "muted", ["ARCHIVED"], ["print"]),
            s("ARCHIVED", "closed", "muted", ["ACTIVE"], ["reopen", "hidden"]),
        ],
    },
    patient_list: {
        id: "patient_list",
        source: "Patients page tabs · patient_repo::filter_counts / patient-status-filter.ts",
        initial: "NEW_PATIENT",
        derived: true,
        states: [
            s("NEW_PATIENT", "todo", "info", ["IN_TREATMENT"]),
            s("IN_TREATMENT", "active", "progress", ["CLOSED"]),
            s("CLOSED", "done", "success"),
            s("INVOICE_OPEN", "attention", "warning"),
            s("CHART_OPEN", "attention", "info"),
        ],
    },
    patient_chart: {
        id: "patient_chart",
        source: "patient_chart.status · workflow_transitions.rs (forward / validate / decline)",
        initial: "DRAFT",
        states: [
            s("DRAFT", "todo", "neutral", ["IN_PROGRESS", "VALIDATED", "DECLINED"], ["edit"]),
            s("IN_PROGRESS", "review", "progress", ["VALIDATED", "DECLINED"], ["edit"]),
            s("DECLINED", "attention", "danger", ["DRAFT", "IN_PROGRESS"], ["edit"]),
            s("VALIDATED", "done", "success", ["IN_PROGRESS"], ["bill", "print"]),
            s("READONLY", "closed", "muted", [], ["print"]),
        ],
    },
    treatment: {
        id: "treatment",
        source: "treatment.treatment_status",
        initial: "PLANNED",
        states: [
            s("PLANNED", "todo", "info", ["IN_PROGRESS", "COMPLETED", "CANCELLED"], ["edit", "delete", "reschedule"]),
            s("IN_PROGRESS", "active", "progress", ["COMPLETED", "DISCONTINUED"], ["edit"]),
            s("COMPLETED", "done", "success", [], ["bill", "print"]),
            s("DISCONTINUED", "closed", "warning", [], ["bill", "print"]),
            s("CANCELLED", "closed", "muted", [], []),
        ],
    },
    prescription: {
        id: "prescription",
        source: "prescription.status",
        initial: "ISSUED",
        states: [
            s("DRAFT", "todo", "neutral", ["ISSUED"], ["edit", "delete"]),
            s("ISSUED", "done", "success", ["REPLACED"], ["edit", "print"]),
            s("REPLACED", "closed", "muted", [], ["hidden"]),
        ],
    },
    certificate: {
        id: "certificate",
        source: "issued_document.status (certificates, letters, invoices)",
        initial: "ISSUED",
        states: [s("ISSUED", "done", "success", ["CANCELLED"], ["print"]), s("CANCELLED", "closed", "muted", [], ["print"])],
    },
    sick_leave: {
        id: "sick_leave",
        source: "sick_leave_certificate.status",
        initial: "ACTIVE",
        states: [s("ACTIVE", "active", "progress", ["ENDED"], ["edit", "print"]), s("ENDED", "closed", "muted", [], ["print"])],
    },
    payment: {
        id: "payment",
        source: "payment.status · domain/status.rs PaymentStatus",
        initial: "OUTSTANDING",
        states: [
            s("OUTSTANDING", "todo", "warning", ["PARTIALLY_PAID", "PAID", "CANCELLED"], ["edit", "delete", "remind"]),
            s("PARTIALLY_PAID", "active", "progress", ["PAID", "CANCELLED"], ["edit", "delete", "remind"]),
            s("PAID", "done", "success", [], ["print"]),
            s("CANCELLED", "closed", "muted", [], []),
        ],
    },
    invoice: {
        id: "invoice",
        source: "receivables.rs status_row (derived from linked payments and due date)",
        initial: "OPEN",
        derived: true,
        states: [
            s("OVERDUE", "attention", "danger", ["PAID", "CANCELLED"], ["remind", "print"]),
            s("UNLINKED", "attention", "warning", [], ["print"]),
            s("OPEN", "todo", "info", ["PARTIAL", "PAID", "OVERDUE", "CANCELLED"], ["print"]),
            s("PARTIAL", "active", "progress", ["PAID", "OVERDUE", "CANCELLED"], ["print"]),
            s("PAID", "done", "success", [], ["print"]),
            s("CANCELLED", "closed", "muted", [], ["print"]),
            s("CANCELLATION", "closed", "muted", [], ["print"]),
            s("LEGACY", "closed", "muted", [], ["print"]),
        ],
    },
    purchase_order: {
        id: "purchase_order",
        source: "purchase_order.status · workflow_transitions.rs",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "info", ["IN_TRANSIT", "DELIVERED", "CANCELLED"], ["edit", "delete"]),
            s("IN_TRANSIT", "active", "progress", ["DELIVERED", "CANCELLED"], ["edit"]),
            s("DELIVERED", "done", "success", [], ["print"]),
            s("CANCELLED", "closed", "muted", [], []),
        ],
        flags: ["overdue"],
    },
    contract: {
        id: "contract",
        source: "Administration → Contracts (activation + start/end dates)",
        initial: "ACTIVE",
        states: [
            s("NOT_STARTED", "todo", "info", ["ACTIVE", "INACTIVE"], ["edit", "delete"]),
            s("ACTIVE", "active", "success", ["INACTIVE", "EXPIRED"], ["edit"]),
            s("INACTIVE", "closed", "warning", ["ACTIVE"], ["edit", "reopen", "delete"]),
            s("EXPIRED", "closed", "muted", ["ACTIVE"], ["edit", "reopen"]),
        ],
    },
    catalog_item: {
        id: "catalog_item",
        source: "product.active / treatment_catalog.active",
        initial: "ACTIVE",
        states: [s("ACTIVE", "active", "success", ["INACTIVE"], ["edit", "bill"]), s("INACTIVE", "closed", "muted", ["ACTIVE"], ["edit", "reopen", "hidden"])],
    },
    day_close: {
        id: "day_close",
        source: "day_close_protocol",
        initial: "FINAL",
        states: [s("FINAL", "done", "success", ["CORRECTED"], ["print"]), s("CORRECTED", "closed", "info", [], ["print"])],
    },
    practice_task: {
        id: "practice_task",
        source: "practice_task.status · workflow_transitions.rs (verify + simple track)",
        initial: "OPEN",
        states: [
            s("BACK", "attention", "danger", ["OPEN", "IN_PROGRESS"], ["edit"]),
            s("OPEN", "todo", "warning", ["IN_PROGRESS", "VIEWED"], ["edit", "delete"]),
            s("VIEWED", "active", "progress", ["DONE", "OPEN"], ["edit"]),
            s("IN_PROGRESS", "active", "progress", ["DONE_RECEPTION", "OPEN"], ["edit"]),
            s("DONE_RECEPTION", "review", "info", ["VALIDATED", "BACK"], []),
            s("VALIDATED", "done", "success", [], []),
            s("DONE", "done", "success", [], []),
        ],
    },
    practice_ticket: {
        id: "practice_ticket",
        source: "practice_ticket.status (legacy tickets)",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "warning", ["IN_PROGRESS", "DONE"], ["edit"]),
            s("IN_PROGRESS", "active", "progress", ["DONE", "OPEN"], ["edit"]),
            s("DONE", "done", "success", [], []),
        ],
    },
    feedback: {
        id: "feedback",
        source: "feedback.status",
        initial: "OPEN",
        states: [
            s("OPEN", "todo", "warning", ["IN_PROGRESS", "DONE"], ["edit"]),
            s("IN_PROGRESS", "active", "progress", ["DONE", "OPEN"], ["edit"]),
            s("DONE", "done", "success", [], []),
        ],
    },
    device_trust: {
        id: "device_trust",
        source: "device_session trust flags",
        initial: "UNCHECKED",
        states: [
            s("SUSPECTED", "attention", "danger", ["TRUSTED", "UNCHECKED"], ["delete"]),
            s("UNCHECKED", "todo", "warning", ["TRUSTED", "SUSPECTED"], ["delete"]),
            s("TRUSTED", "done", "success", ["SUSPECTED"], ["delete"]),
        ],
    },
    device_provisioning: {
        id: "device_provisioning",
        source: "provisioning_state.device_status",
        initial: "PENDING",
        states: [
            s("PENDING", "todo", "warning", ["ACTIVE", "BLOCKED"]),
            s("ACTIVE", "done", "success", ["REVOKED", "BLOCKED"]),
            s("BLOCKED", "attention", "danger", ["ACTIVE"], ["reopen"]),
            s("REVOKED", "closed", "muted"),
        ],
    },
    pairing: {
        id: "pairing",
        source: "pairing_request.status",
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
        source: "work_time_session.status",
        initial: "RUNNING",
        states: [
            s("RUNNING", "active", "success", ["PAUSED", "ENDED"], ["edit"]),
            s("PAUSED", "todo", "warning", ["RUNNING", "ENDED"], ["edit"]),
            s("ENDED", "closed", "muted", [], ["edit"]),
        ],
    },
    connection: {
        id: "connection",
        source: "Top bar connectivity + replica outbox (connectivity.controller.ts, sync-status-badge.tsx)",
        initial: "ONLINE",
        derived: true,
        states: [
            s("OFFLINE", "attention", "danger", ["ONLINE"]),
            s("SYNC_PENDING", "active", "warning", ["ONLINE", "OFFLINE"]),
            s("ONLINE", "done", "success", ["SYNC_PENDING", "OFFLINE"]),
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
    ABGEBROCHEN: "DISCONTINUED",
    DONE_TREATMENT: "COMPLETED",
};

export function normalizeStatusWire(raw: string | null | undefined): string {
    const up = String(raw ?? "").trim().toUpperCase();
    return LEGACY_WIRE[up] ?? up;
}

export function statusDefinition(entity: StatusEntityId, wire: string | null | undefined): StatusDefinition | null {
    const w = normalizeStatusWire(wire);
    return STATUS_REGISTRY[entity].states.find((st) => st.wire === w) ?? null;
}

export function statusLabelKey(entity: StatusEntityId, wire: string): string {
    return `status.${entity}.${normalizeStatusWire(wire).toLowerCase()}.label`;
}

export function statusDescriptionKey(entity: StatusEntityId, wire: string): string {
    return `status.${entity}.${normalizeStatusWire(wire).toLowerCase()}.description`;
}

export function statusFlagLabelKey(entity: StatusEntityId, flag: string): string {
    return `status.${entity}.flag.${flag}`;
}

export function statusCapabilityLabelKey(cap: StatusCapability): string {
    return `status.capability.${cap}`;
}

/** Does the app allow `cap` while the item is in `wire`? Unknown statuses allow nothing. */
export function statusAllows(entity: StatusEntityId, wire: string | null | undefined, cap: StatusCapability): boolean {
    return statusDefinition(entity, wire)?.can.includes(cap) ?? false;
}

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

export function statusRank(entity: StatusEntityId, wire: string | null | undefined): number {
    const def = statusDefinition(entity, wire);
    if (!def) return STATUS_PHASES.length * 100;
    const phase = STATUS_PHASES.indexOf(def.phase);
    const idx = STATUS_REGISTRY[entity].states.indexOf(def);
    return phase * 100 + idx;
}

export function statusIsOpen(entity: StatusEntityId, wire: string | null | undefined): boolean {
    const def = statusDefinition(entity, wire);
    return def != null && def.phase !== "done" && def.phase !== "closed";
}

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
