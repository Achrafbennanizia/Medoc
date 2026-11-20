import { afterEach, describe, expect, it, vi } from "vitest";
import type { NoticeSource } from "./notice";
import { setNoticeSources, useNotificationCenter } from "./notification-center";
import { DEFAULT_NOTICE_SOURCES } from "./notice-sources";

const ctx = { userId: "u1", role: "RECEPTION", t: (k: string) => k, tp: (k: string) => k };

function src(id: string, impl: NoticeSource["load"]): NoticeSource {
    return { id, enabled: () => true, load: impl };
}

afterEach(() => {
    setNoticeSources(DEFAULT_NOTICE_SOURCES);
    useNotificationCenter.getState().reset();
    localStorage.clear();
});

describe("notification center", () => {
    it("aggregates sources, isolates failures and counts unread", async () => {
        setNoticeSources([
            src("a", async (c) => [
                { id: "a:1", source: "a", category: "task", severity: "info", title: "t", body: "b", at: new Date(1), unread: !c.isLocallyRead("a:1") },
            ]),
            src("broken", async () => {
                throw new Error("offline");
            }),
        ]);
        await useNotificationCenter.getState().refresh(ctx);
        const st = useNotificationCenter.getState();
        expect(st.notices).toHaveLength(1);
        expect(st.unreadCount).toBe(1);
        expect(st.failedSources).toEqual(["broken"]);
    });

    it("remembers local read state for derived notices", async () => {
        const load = vi.fn(async (c: Parameters<NoticeSource["load"]>[0]) => [
            { id: "a:1", source: "a", category: "task" as const, severity: "info" as const, title: "t", body: "b", at: new Date(1), unread: !c.isLocallyRead("a:1") },
        ]);
        setNoticeSources([src("a", load)]);
        await useNotificationCenter.getState().refresh(ctx);
        await useNotificationCenter.getState().markRead(useNotificationCenter.getState().notices[0]!);
        expect(useNotificationCenter.getState().unreadCount).toBe(0);
        await useNotificationCenter.getState().refresh(ctx);
        expect(useNotificationCenter.getState().unreadCount).toBe(0);
    });

    it("toasts new critical notices after the first load", async () => {
        let round = 0;
        setNoticeSources([
            src("s", async () => {
                round += 1;
                return round === 1
                    ? []
                    : [{ id: "s:x", source: "s", category: "security", severity: "critical", title: "Alert", body: "dev", at: new Date(2), unread: true }];
            }),
        ]);
        const toast = vi.fn();
        await useNotificationCenter.getState().refresh(ctx, { toast });
        // first run seeds "seen" only when something exists; seed with a marker notice
        localStorage.setItem("medoc-notice-seen-v1:u1", JSON.stringify({ seed: Date.now() }));
        await useNotificationCenter.getState().refresh(ctx, { toast });
        expect(toast).toHaveBeenCalledWith("Alert — dev", "error");
    });
});
