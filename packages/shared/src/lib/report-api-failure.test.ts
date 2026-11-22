import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setClientLogSink, type ClientLogEvent } from "./client-log";
import { reportApiFailure, resetApiFailureThrottle } from "./report-api-failure";

let events: ClientLogEvent[] = [];
beforeEach(() => {
    events = [];
    resetApiFailureThrottle();
    setClientLogSink((e) => void events.push(e));
});
afterEach(() => setClientLogSink(null));

describe("reportApiFailure", () => {
    it("logs command, code and request id, never error parameters", () => {
        reportApiFailure("lan", "set_app_kv", new Error("error.prescription.allergy_conflict|substance=Amoxicillin|allergen=Penicillin"), {
            status: 400,
            requestId: "AB12CD34",
        });
        expect(events).toHaveLength(1);
        const e = events[0]!;
        expect(e.code).toBe("MD-RXP-001");
        expect(e.level).toBe("info");
        expect(e.message).not.toContain("Amoxicillin");
        expect(e.context).toMatchObject({ event: "API_CALL_FAILED", transport: "lan", command: "set_app_kv", status: 400, request_id: "AB12CD34" });
    });

    it("writes connectivity failures of one command once a minute", () => {
        for (let i = 0; i < 5; i++) reportApiFailure("ipc", `sync_probe_master`, new Error(`error.app.network|detail=refused ${i}`));
        expect(events).toHaveLength(1);
        expect(events[0]!.level).not.toBe("info");
    });

    it("never reports the logging command itself", () => {
        reportApiFailure("ipc", "log_client_event", new Error("error.app.internal"));
        expect(events).toHaveLength(0);
    });
});
