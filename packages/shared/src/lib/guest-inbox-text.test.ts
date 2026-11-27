import { describe, expect, it } from "vitest";
import { describeProposal, type ProposalTextContext } from "./guest-inbox-text";

const ctx: ProposalTextContext = {
    t: (k) => k,
    tp: (k, p) => `${k} ${JSON.stringify(p)}`,
    patientName: (id) => (id === "p1" ? "Salma B." : "?"),
    date: (d) => `D(${d})`,
    money: (n) => `${n} MAD`,
};

describe("describeProposal", () => {
    it("names patient, date and time of a new appointment", () => {
        const r = describeProposal(
            {
                command: "create_appointment",
                argsJson: JSON.stringify({ data: { patient_id: "p1", date: "2026-12-03", time: "10:30:00", kind: "CHECKUP", duration_minutes: 30 } }),
            },
            ctx,
        );
        expect(r.title).toBe('guest.inbox.kind.create_appointment {"patient":"Salma B.","date":"D(2026-12-03)","time":"10:30"}');
        expect(r.description).toContain("appointment.kind.CHECKUP");
    });

    it("gives amount, patient and method of a cash payment", () => {
        const r = describeProposal(
            { command: "create_payment", argsJson: JSON.stringify({ data: { patient_id: "p1", amount: 300, payment_method: "CASH" } }) },
            ctx,
        );
        expect(r.title).toContain('"amount":"300 MAD"');
        expect(r.description).toBe("enum.payment_method.cash");
    });

    it("lists the changed patient fields", () => {
        const r = describeProposal(
            { command: "update_patient", argsJson: JSON.stringify({ id: "p1", data: { phone: "0600", email: null } }) },
            ctx,
        );
        expect(r.description).toBe("guest.inbox.field.phone: 0600");
    });

    it("survives broken arguments", () => {
        expect(describeProposal({ command: "create_patient", argsJson: "{" }, ctx).title).toContain("create_patient");
        expect(describeProposal({ command: "nope", argsJson: "{}" }, ctx).title).toBe("guest.inbox.kind.unknown");
    });
});
