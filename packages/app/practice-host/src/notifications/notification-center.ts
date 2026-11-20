/**
 * Notification center (Mediator + Observer): aggregates all {@link NoticeSource}s, owns unread count,
 * read-state and preferences, and delivers new notices (OS notification / toast) according to
 * Settings → Notifications. Views (bell badge, popover) only read this store.
 */
import { create } from "zustand";
import { loadClientSettings } from "@/lib/client-settings";
import { clockNowMs } from "@/lib/practice-clock";
import { compareNotices, type Notice, type NoticeCategory, type NoticeContext, type NoticeSource } from "./notice";
import { DEFAULT_NOTICE_SOURCES } from "./notice-sources";

const READ_KEY_PREFIX = "medoc-notice-read-v1:";
const SEEN_KEY_PREFIX = "medoc-notice-seen-v1:";
const READ_TTL_MS = 14 * 86_400_000;

type ReadMap = Record<string, number>;

function loadMap(key: string): ReadMap {
    try {
        const raw = localStorage.getItem(key);
        const m = raw ? (JSON.parse(raw) as ReadMap) : {};
        const cutoff = clockNowMs() - READ_TTL_MS;
        for (const k of Object.keys(m)) if ((m[k] ?? 0) < cutoff) delete m[k];
        return m;
    } catch {
        return {};
    }
}

function saveMap(key: string, m: ReadMap): void {
    try {
        localStorage.setItem(key, JSON.stringify(m));
    } catch {
        /* storage full / private mode */
    }
}

export type NotificationDelivery = {
    /** Show a toast for a new notice. */
    toast: (message: string, type: "info" | "warning" | "error") => void;
};

type CenterState = {
    notices: Notice[];
    loading: boolean;
    /** Source ids that failed in the last refresh (shown as a hint, other sources still render). */
    failedSources: string[];
    lastRefreshAt: number;
    unreadCount: number;
    refresh: (ctx: Omit<NoticeContext, "isLocallyRead">, delivery?: NotificationDelivery) => Promise<void>;
    markRead: (notice: Notice) => Promise<void>;
    markAllRead: (category?: NoticeCategory) => Promise<void>;
    reset: () => void;
};

let sources: readonly NoticeSource[] = DEFAULT_NOTICE_SOURCES;
let currentUser = "";
let inflight: Promise<void> | null = null;

/** Test seam / extension point: replace the source list. */
export function setNoticeSources(next: readonly NoticeSource[]): void {
    sources = next;
}

function sendSystemNotification(n: Notice): void {
    if (typeof window === "undefined" || typeof window.Notification === "undefined") return;
    const show = () => {
        try {
            new window.Notification(n.title, { body: n.body, tag: n.id });
        } catch {
            /* webview without Notification support */
        }
    };
    if (window.Notification.permission === "granted") show();
    else if (window.Notification.permission === "default") {
        void window.Notification.requestPermission().then((p) => {
            if (p === "granted") show();
        });
    }
}

/** Deliver notices that appeared since the last refresh, honoring Settings → Notifications. */
function deliverNew(fresh: Notice[], delivery?: NotificationDelivery): void {
    if (!currentUser) return;
    const seenKey = SEEN_KEY_PREFIX + currentUser;
    const seen = loadMap(seenKey);
    const firstRun = Object.keys(seen).length === 0;
    const prefs = loadClientSettings().notifications ?? {};
    const now = clockNowMs();
    for (const n of fresh) {
        if (seen[n.id]) continue;
        seen[n.id] = now;
        if (firstRun || !n.unread) continue; // do not flood on first load / already-read rows
        if (prefs.push !== false && (typeof document === "undefined" || document.visibilityState !== "visible")) {
            sendSystemNotification(n);
        }
        if (n.severity === "critical" && prefs.criticalWarnings !== false) {
            delivery?.toast(`${n.title} — ${n.body}`, "error");
        } else if (prefs.push !== false && n.severity === "warning") {
            delivery?.toast(n.title, "warning");
        }
    }
    saveMap(seenKey, seen);
}

export const useNotificationCenter = create<CenterState>((set, get) => ({
    notices: [],
    loading: false,
    failedSources: [],
    lastRefreshAt: 0,
    unreadCount: 0,

    refresh: async (base, delivery) => {
        if (inflight) return inflight;
        if (base.userId !== currentUser) {
            currentUser = base.userId;
            set({ notices: [], unreadCount: 0 });
        }
        const readMap = loadMap(READ_KEY_PREFIX + base.userId);
        const ctx: NoticeContext = { ...base, isLocallyRead: (id) => readMap[id] != null };
        inflight = (async () => {
            set({ loading: true });
            const active = sources.filter((s) => s.enabled(ctx));
            const results = await Promise.allSettled(active.map((s) => s.load(ctx)));
            const failed: string[] = [];
            const merged = new Map<string, Notice>();
            results.forEach((r, i) => {
                if (r.status === "fulfilled") r.value.forEach((n) => merged.set(n.id, n));
                else failed.push(active[i]!.id);
            });
            const notices = [...merged.values()].sort(compareNotices);
            deliverNew(notices, delivery);
            set({
                notices,
                loading: false,
                failedSources: failed,
                lastRefreshAt: clockNowMs(),
                unreadCount: notices.filter((n) => n.unread).length,
            });
        })().finally(() => {
            inflight = null;
        });
        return inflight;
    },

    markRead: async (notice) => {
        if (!notice.unread) return;
        const src = sources.find((s) => s.id === notice.source);
        if (src?.markRead) {
            await src.markRead(notice);
        } else if (currentUser) {
            const key = READ_KEY_PREFIX + currentUser;
            const m = loadMap(key);
            m[notice.id] = clockNowMs();
            saveMap(key, m);
        }
        const notices = get()
            .notices.map((n) => (n.id === notice.id ? { ...n, unread: false } : n))
            .sort(compareNotices);
        set({ notices, unreadCount: notices.filter((n) => n.unread).length });
    },

    markAllRead: async (category) => {
        const targets = get().notices.filter((n) => n.unread && (!category || n.category === category));
        const remoteSources = new Set(targets.map((n) => n.source));
        for (const src of sources) {
            if (remoteSources.has(src.id) && src.markAllRead && !category) await src.markAllRead();
        }
        if (currentUser) {
            const key = READ_KEY_PREFIX + currentUser;
            const m = loadMap(key);
            for (const n of targets) {
                const src = sources.find((s) => s.id === n.source);
                if (src?.markRead && category) await src.markRead(n);
                else if (!src?.markRead) m[n.id] = clockNowMs();
            }
            saveMap(key, m);
        }
        const ids = new Set(targets.map((n) => n.id));
        const notices = get()
            .notices.map((n) => (ids.has(n.id) ? { ...n, unread: false } : n))
            .sort(compareNotices);
        set({ notices, unreadCount: notices.filter((n) => n.unread).length });
    },

    reset: () => {
        currentUser = "";
        set({ notices: [], unreadCount: 0, failedSources: [], lastRefreshAt: 0 });
    },
}));
