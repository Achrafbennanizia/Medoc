/**
 * Store-and-forward queue for the LAN web client, which has no local database.
 *
 * A setting write that cannot reach the main device is kept here (one entry per key: the latest
 * edit wins locally) with the time of the edit. When the connection is back, queued writes are
 * replayed in order with `editedAt`; the server keeps whichever write is newer (last writer wins,
 * `app_kv_lww.rs`) and answers 409 for a queued write that is older, which is then dropped.
 */
export type QueuedWrite = {
    id: string;
    command: "set_app_kv" | "delete_app_kv";
    key: string;
    value?: string;
    editedAt: string;
};

export type ReplayResult = "sent" | "superseded" | "offline";

const STORAGE_KEY = "medoc.lan.offline-writes.v1";
export const OFFLINE_QUEUE_EVENT = "medoc:offline-writes-changed";

function read(): QueuedWrite[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const list = raw ? (JSON.parse(raw) as unknown) : [];
        return Array.isArray(list) ? (list as QueuedWrite[]) : [];
    } catch {
        return [];
    }
}

function write(list: QueuedWrite[]): void {
    try {
        if (list.length === 0) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        /* storage unavailable: the write stays only in memory of this call */
    }
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: list.length }));
}

export function queuedWrites(): QueuedWrite[] {
    return read();
}

/** Keep a write for later; an older queued write for the same key is replaced. */
export function enqueueWrite(entry: Omit<QueuedWrite, "id" | "editedAt"> & { editedAt?: string }): QueuedWrite {
    const queued: QueuedWrite = {
        ...entry,
        id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        editedAt: entry.editedAt ?? new Date().toISOString(),
    };
    write([...read().filter((q) => q.key !== queued.key), queued]);
    return queued;
}

/** Read your own offline writes: the queued value for `key`, `null` for a queued delete. */
export function queuedValue(key: string): string | null | undefined {
    const hit = read().find((q) => q.key === key);
    if (!hit) return undefined;
    return hit.command === "delete_app_kv" ? null : (hit.value ?? null);
}

let flushing: Promise<number> | null = null;

/** Replay in order; stops at the first write that still cannot be sent. Returns how many left. */
export function flushQueuedWrites(send: (w: QueuedWrite) => Promise<ReplayResult>): Promise<number> {
    flushing ??= (async () => {
        try {
            for (const w of read()) {
                const result = await send(w);
                if (result === "offline") break;
                write(read().filter((q) => q.id !== w.id));
            }
            return read().length;
        } finally {
            flushing = null;
        }
    })();
    return flushing;
}
