import { beforeEach, describe, expect, it } from "vitest";
import { enqueueWrite, flushQueuedWrites, queuedValue, queuedWrites, type QueuedWrite } from "./offline-write-queue";

const store = new Map<string, string>();
beforeEach(() => {
    store.clear();
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
    it("keeps only the latest write per key and reads it back", () => {
        enqueueWrite({ command: "set_app_kv", key: "a", value: "1" });
        enqueueWrite({ command: "set_app_kv", key: "a", value: "2" });
        enqueueWrite({ command: "delete_app_kv", key: "b" });
        expect(queuedWrites()).toHaveLength(2);
        expect(queuedValue("a")).toBe("2");
        expect(queuedValue("b")).toBeNull();
        expect(queuedValue("c")).toBeUndefined();
    });

    it("replays in order, drops superseded writes and stops while offline", async () => {
        enqueueWrite({ command: "set_app_kv", key: "a", value: "1" });
        enqueueWrite({ command: "set_app_kv", key: "b", value: "2" });
        enqueueWrite({ command: "set_app_kv", key: "c", value: "3" });
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
});
