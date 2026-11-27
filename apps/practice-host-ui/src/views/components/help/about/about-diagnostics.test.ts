import { describe, expect, it } from "vitest";
import { buildDiagnostics, type DiagnosticsInput } from "./about-diagnostics";

const base: DiagnosticsInput = {
    status: {
        version: { state: "ok", value: "1.2.3" },
        license: { state: "denied" },
        cluster: { state: "loading" },
        sync: { state: "error", message: "x" },
        health: { state: "ok", value: { db_ok: true, db_latency_ms: 3, audit_chain_ok: true, audit_broken_at: null, log_dir_writable: true, version: "1" } },
        backups: { state: "ok", value: [] },
        logDir: { state: "ok", value: "/logs" },
        loadedAt: 0,
    },
    version: "1.2.3",
    devBuild: false,
    platform: "windows · Win32",
    screen: { width: 1920, height: 1080 },
    locale: "de",
    textSize: "large",
    zoomPct: 110,
    now: new Date(Date.UTC(2026, 10, 21, 12)),
    timeZone: "Europe/Berlin",
    clockOffsetMs: 3000,
    errors: [{ code: "MD-PAY-004", route: "/finance", at: Date.UTC(2026, 10, 21, 11) }],
};

describe("buildDiagnostics", () => {
    it("lists versions, states and error codes", () => {
        const text = buildDiagnostics(base);
        expect(text).toContain("MeDoc Dentist 1.2.3 (release)");
        expect(text).toContain("synced +3 s");
        expect(text).toContain("Health: db ok 3 ms");
        expect(text).toContain("Backups: 0 · latest none");
        expect(text).toContain("MD-PAY-004 · /finance");
    });
    it("leaves out sources the role may not read", () => {
        expect(buildDiagnostics(base)).not.toContain("Licence:");
        expect(buildDiagnostics(base)).not.toContain("Device:");
    });
    it("says when the device uses its own clock", () => {
        expect(buildDiagnostics({ ...base, clockOffsetMs: null })).toContain("local clock");
    });
});
