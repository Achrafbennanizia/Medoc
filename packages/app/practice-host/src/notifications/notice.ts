/**
 * Notification model shared by every notification source (Strategy) and the notification center.
 *
 * A notice is something a person should know or act on. It has a category (what area), a severity
 * (how urgent) and optionally a destination (`href`) that opens the item. Read-state is owned by the
 * source: backend inbox rows are marked read on the server; derived notices (tasks, reminders, stock,
 * security) are remembered locally per user.
 */
export const NOTICE_CATEGORIES = ["task", "appointment", "clinical", "inventory", "security", "system"] as const;
export type NoticeCategory = (typeof NOTICE_CATEGORIES)[number];

export type NoticeSeverity = "info" | "warning" | "critical";

export type Notice = {
    /** Globally unique and stable: `<source>:<entity id>[:<state>]` — a changed state re-notifies. */
    readonly id: string;
    readonly source: string;
    readonly category: NoticeCategory;
    readonly severity: NoticeSeverity;
    readonly title: string;
    readonly body: string;
    readonly at: Date;
    readonly unread: boolean;
    /** In-app route to open the item. */
    readonly href?: string;
};

export type NoticeContext = {
    readonly userId: string;
    readonly role: string;
    readonly t: (key: string) => string;
    readonly tp: (key: string, params: Record<string, string | number>) => string;
    /** Locally remembered read ids for derived notices. */
    readonly isLocallyRead: (id: string) => boolean;
};

/** A pluggable producer of notices (Open/Closed: add a source without touching the center or the view). */
export interface NoticeSource {
    readonly id: string;
    /** Whether this source applies to the current user / deployment. */
    enabled(ctx: NoticeContext): boolean;
    load(ctx: NoticeContext): Promise<Notice[]>;
    /** Persist read state when the source owns it remotely (backend inbox). */
    markRead?(notice: Notice): Promise<void>;
    markAllRead?(): Promise<void>;
}

const SEVERITY_RANK: Record<NoticeSeverity, number> = { critical: 0, warning: 1, info: 2 };

/** Unread first, then severity, then newest. */
export function compareNotices(a: Notice, b: Notice): number {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return b.at.getTime() - a.at.getTime();
}
