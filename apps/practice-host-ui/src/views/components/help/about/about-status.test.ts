import { describe, expect, it } from "vitest";
import { backupTakenAt, dataTone, latestBackup, licenseTone, networkTone, settle, shortId } from "./about-status";

const NOW = Date.UTC(2026, 10, 21, 12, 0, 0);
const health = { db_ok: true, db_latency_ms: 2, audit_chain_ok: true, audit_broken_at: null, log_dir_writable: true, version: "1" };
const backup = (stamp: string, signature_ok: boolean | null = true) => ({ path: `/b/medoc-${stamp}.db`, size_bytes: 10, signature_ok });

describe("about-status helpers", () => {
    it("reads the timestamp from a backup file name", () => {
        expect(backupTakenAt("/x/medoc-20261121T130359Z.db")).toBe(Date.UTC(2026, 10, 21, 13, 3, 59));
        expect(backupTakenAt("/x/medoc-20261121T130359Z-2.db")).toBe(Date.UTC(2026, 10, 21, 13, 3, 59));
        expect(backupTakenAt("/x/other.db")).toBeNull();
    });
    it("picks the newest backup", () => {
        expect(latestBackup([backup("20261101T000000Z"), backup("20261120T000000Z")])?.info.path).toContain("20261120");
        expect(latestBackup([])).toBeNull();
    });
    it("rates data: problem on failing checks, warn on old or missing backups", () => {
        expect(dataTone({ ...health, db_ok: false }, [], NOW)).toBe("problem");
        expect(dataTone(health, [], NOW)).toBe("warn");
        expect(dataTone(health, [backup("20261101T000000Z")], NOW)).toBe("warn");
        expect(dataTone(health, [backup("20261120T000000Z", false)], NOW)).toBe("problem");
        expect(dataTone(health, [backup("20261120T000000Z")], NOW)).toBe("ok");
        expect(dataTone(null, null, NOW)).toBe("unknown");
    });
    it("rates licence and network", () => {
        expect(licenseTone({ valid: false, reason: "x", license: null, daysUntilExpiry: null })).toBe("problem");
        expect(licenseTone({ valid: true, reason: null, license: null, daysUntilExpiry: 10 })).toBe("warn");
        expect(licenseTone({ valid: true, reason: null, license: null, daysUntilExpiry: 200 })).toBe("ok");
        const sync = (lastSeenAt: string | null, pendingOutbox = 0) =>
            ({ peers: [{ deviceId: "d", displayName: "", role: "REPLICA", peerBaseUrl: null, lastSeenAt }], pendingOutbox }) as never;
        expect(networkTone(sync(new Date(NOW - 60_000).toISOString()), NOW)).toBe("ok");
        expect(networkTone(sync(null), NOW)).toBe("warn");
        expect(networkTone(sync(new Date(NOW).toISOString(), 900), NOW)).toBe("problem");
    });
    it("treats permission failures as denied, other failures as errors", () => {
        expect(settle({ status: "rejected", reason: new Error("forbidden: ops.system") })).toEqual({ state: "denied" });
        expect(settle({ status: "rejected", reason: new Error("boom") })).toEqual({ state: "error", message: "boom" });
        expect(settle({ status: "fulfilled", value: 1 })).toEqual({ state: "ok", value: 1 });
    });
    it("shortens long ids", () => {
        expect(shortId("0123456789abcdef")).toBe("01234567…cdef");
        expect(shortId(null)).toBe("—");
    });
});
