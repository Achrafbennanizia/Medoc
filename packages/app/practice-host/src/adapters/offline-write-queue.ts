/**
 * Store-and-forward queue for the LAN client, which has no local database.
 *
 * A setting write that cannot reach the main device is kept here (one entry per key: the latest
 * edit wins locally) with the time of the edit. In the desktop app the queue lives in an
 * encrypted cache file (`offline_cache_*` commands, fsync + atomic rename), so a crash or a hard
 * power-off does not lose it; `enqueueWrite` resolves only once it is on disk. The plain web client
 * keeps it in browser storage. When the connection is back, writes are replayed in order with
 * `editedAt`; the server keeps whichever write is newer (last writer wins, `app_kv_lww.rs`) and
 * answers 409 for an older one, which is dropped. The file is deleted once the queue is empty,
 * that is when every write was answered 2xx.
 */
import { isTauriApp } from "@/lib/is-tauri-app";
import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";

export type QueuedWrite = {
    id: string;
    command: "set_app_kv" | "delete_app_kv";
    key: string;
    value?: string;
    editedAt: string;
};

export type ReplayResult = "sent" | "superseded" | "offline";

const STORAGE_KEY = "medoc.lan.offline-writes.v1";
const CACHE_FILE = "lan-offline-writes";
export const OFFLINE_QUEUE_EVENT = "medoc:offline-writes-changed";

let memory: QueuedWrite[] | null = null;

function readBrowser(): QueuedWrite[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as unknown) : [];
        return Array.isArray(list) ? (list as QueuedWrite[]) : [];
    } catch {
        return [];
    }
}

function list(): QueuedWrite[] {
    memory ??= readBrowser();
    return memory;
}

/** Newest edit per key wins when two copies of the queue are merged. */
function mergeByKey(a: QueuedWrite[], b: QueuedWrite[]): QueuedWrite[] {
    const byKey = new Map<string, QueuedWrite>();
    for (const w of [...a, ...b]) {
        const prev = byKey.get(w.key);
        if (!prev || prev.editedAt <= w.editedAt) byKey.set(w.key, w);
    }
    return [...byKey.values()].sort((x, y) => x.editedAt.localeCompare(y.editedAt));
}

/** Keep the queue on disk (desktop) and in browser storage; delete both when it is empty. */
async function persist(next: QueuedWrite[]): Promise<void> {
    memory = next;
    try {
        if (next.length === 0) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        /* browser storage unavailable */
    }
    if (isTauriApp()) {
        if (next.length === 0) await tauriInvoke("offline_cache_clear", { name: CACHE_FILE });
        else await tauriInvoke("offline_cache_write", { name: CACHE_FILE, value: next });
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: next.length }));
}

/** At start: load the cache file a crash or shutdown left behind. */
export async function hydrateOfflineWrites(): Promise<number> {
    if (isTauriApp()) {
        try {
            const fromFile = await tauriInvoke<QueuedWrite[] | null>("offline_cache_read", { name: CACHE_FILE });
            if (Array.isArray(fromFile) && fromFile.length > 0) await persist(mergeByKey(list(), fromFile));
        } catch {
            /* keep what browser storage had */
        }
    }
    return list().length;
}

export function queuedWrites(): QueuedWrite[] {
    return [...list()];
}

/** Keep a write for later; an older queued write for the same key is replaced. Resolves once stored. */
export async function enqueueWrite(entry: Omit<QueuedWrite, "id" | "editedAt"> & { editedAt?: string }): Promise<QueuedWrite> {
    const queued: QueuedWrite = {
        ...entry,
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        editedAt: entry.editedAt ?? new Date().toISOString(),
    };
    await persist([...list().filter((q) => q.key !== queued.key), queued]);
    return queued;
}

/** Read your own offline writes: the queued value for `key`, `null` for a queued delete. */
export function queuedValue(key: string): string | null | undefined {
    const hit = list().find((q) => q.key === key);
    if (!hit) return undefined;
    return hit.command === "delete_app_kv" ? null : (hit.value ?? null);
}

let flushing: Promise<number> | null = null;

/** Replay in order; stops at the first write that still cannot be sent. Returns how many are left. */
export function flushQueuedWrites(send: (w: QueuedWrite) => Promise<ReplayResult>): Promise<number> {
    flushing ??= (async () => {
        try {
            for (const w of queuedWrites()) {
                const result = await send(w);
                if (result === "offline") break;
                await persist(list().filter((q) => q.id !== w.id));
            }
            return list().length;
        } finally {
            flushing = null;
        }
    })();
    return flushing;
}

/** Tests only. */
export function resetOfflineWritesForTest(): void {
    memory = null;
}
