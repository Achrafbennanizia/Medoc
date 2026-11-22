import { beforeEach, describe, expect, it } from "vitest";
import { enqueueWrite, flushQueuedWrites, queuedValue, queuedWrites, resetOfflineWritesForTest, type QueuedWrite } from "./offline-write-queue";

const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
    resetOfflineWritesForTest();
    (globalThis as { localStorage?: Storage }).localStorage = {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
        clear: () => store.clear(),
        key: () => null,
        length: 0,
    } as Storage;
});

describe("offline write queue", () => {
    it("keeps only the latest write per key and reads it back", async () => {
        await enqueueWrite({ command: "set_app_kv", key: "a", value: "1" });
        await enqueueWrite({ command: "set_app_kv", key: "a", value: "2" });
        await enqueueWrite({ command: "delete_app_kv", key: "b" });
        expect(queuedWrites()).toHaveLength(2);
        expect(queuedValue("a")).toBe("2");
        expect(queuedValue("b")).toBeNull();
        expect(queuedValue("c")).toBeUndefined();
    });

    it("replays in order, drops superseded writes and stops while offline", async () => {
        await enqueueWrite({ command: "set_app_kv", key: "a", value: "1" });
        await enqueueWrite({ command: "set_app_kv", key: "b", value: "2" });
        await enqueueWrite({ command: "set_app_kv", key: "c", value: "3" });
        const seen: string[] = [];
        const left = await flushQueuedWrites(async (w: QueuedWrite) => {
            seen.push(w.key);
            if (w.key === "a") return "sent";
            if (w.key === "b") return "superseded";
            return "offline";
        });
        expect(seen).toEqual(["a", "b", "c"]);
        expect(left).toBe(1);
        expect(queuedWrites().map((w) => w.key)).toEqual(["c"]);
    });

    it("survives a restart through storage and is removed once everything was sent", async () => {
        await enqueueWrite({ command: "set_app_kv", key: "a", value: "1" });
        resetOfflineWritesForTest(); // process restart: memory gone, storage kept
        expect(queuedValue("a")).toBe("1");
        await flushQueuedWrites(async () => "sent");
        expect(queuedWrites()).toEqual([]);
        expect(store.size).toBe(0);
    });
});
