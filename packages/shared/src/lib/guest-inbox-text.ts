/**
 * Title and description of a guest proposal for the inbox (editions-plan.md §4.2): what the admin
 * needs to decide, in the admin's language, built from the proposal's own arguments.
 */

export type ProposalForText = { command: string; argsJson: string };

export type ProposalTextContext = {
    tp: (key: string, params: Record<string, string | number>) => string;
    t: (key: string) => string;
    patientName: (patientId: string | undefined) => string;
    date: (isoDate: string) => string;
    money: (amount: number) => string;
};

export type ProposalText = { title: string; description: string };

const PAYMENT_METHOD_KEYS: Record<string, string> = {
    CASH: "enum.payment_method.cash",
    CARD: "enum.payment_method.card",
    BANK_TRANSFER: "enum.payment_method.bankTransfer",
    INVOICE: "enum.payment_method.invoice",
};

const PATIENT_FIELDS = ["name", "date_of_birth", "phone", "email", "address", "insurance_number", "sex"] as const;

type Obj = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const hhmm = (time: unknown): string => str(time).slice(0, 5);

function parse(argsJson: string): Obj {
    try {
        const v: unknown = JSON.parse(argsJson);
        return v && typeof v === "object" ? (v as Obj) : {};
    } catch {
        return {};
    }
}

export function describeProposal(p: ProposalForText, c: ProposalTextContext): ProposalText {
    const args = parse(p.argsJson);
    const data = (args.data && typeof args.data === "object" ? args.data : {}) as Obj;
    const join = (parts: string[]) => parts.filter(Boolean).join(" · ");
    const kindLabel = data.kind ? c.t(`appointment.kind.${str(data.kind)}`) : "";
    const duration = data.duration_minutes ? c.tp("guest.inbox.minutes", { n: Number(data.duration_minutes) }) : "";

    switch (p.command) {
        case "create_appointment":
        case "update_appointment":
            return {
                title: c.tp(`guest.inbox.kind.${p.command}`, {
                    patient: c.patientName(str(data.patient_id) || undefined),
                    date: data.date ? c.date(str(data.date)) : "",
                    time: hhmm(data.time),
                }),
                description: join([kindLabel, duration, str(data.chief_complaint)]),
            };
        case "move_appointments": {
            const changes = Array.isArray(args.changes) ? (args.changes as Obj[]) : [];
            return {
                title: c.tp("guest.inbox.kind.move_appointments", { count: changes.length }),
                description: changes.map((m) => `${c.date(str(m.date))} ${hhmm(m.time)}`).join(", "),
            };
        }
        case "create_patient":
            return {
                title: c.tp("guest.inbox.kind.create_patient", { name: str(data.name) }),
                description: join([
                    data.date_of_birth ? c.tp("guest.inbox.born", { date: c.date(str(data.date_of_birth)) }) : "",
                    str(data.phone),
                    str(data.email),
                ]),
            };
        case "update_patient":
            return {
                title: c.tp("guest.inbox.kind.update_patient", { name: c.patientName(str(args.id)) }),
                description: join(
                    PATIENT_FIELDS.filter((f) => data[f] != null && data[f] !== "").map(
                        (f) => `${c.t(`guest.inbox.field.${f}`)}: ${f === "date_of_birth" ? c.date(str(data[f])) : str(data[f])}`,
                    ),
                ),
            };
        case "create_payment":
            return {
                title: c.tp("guest.inbox.kind.create_payment", {
                    amount: c.money(Number(data.amount) || 0),
                    patient: c.patientName(str(data.patient_id) || undefined),
                }),
                description: join([
                    PAYMENT_METHOD_KEYS[str(data.payment_method)] ? c.t(PAYMENT_METHOD_KEYS[str(data.payment_method)]) : "",
                    str(data.description),
                ]),
            };
        default:
            return { title: c.t("guest.inbox.kind.unknown"), description: p.command };
    }
}
