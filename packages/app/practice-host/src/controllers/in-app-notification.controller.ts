import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { InAppNotification } from "@/models/types";

export async function listInAppNotifications(): Promise<InAppNotification[]> {
    return practiceSystem.invoke<InAppNotification[]>("list_in_app_notifications");
}

export async function countUnreadInAppNotifications(): Promise<number> {
    const n = await practiceSystem.invoke<number>("count_unread_in_app_notifications");
    return typeof n === "number" ? n : 0;
}

export async function markInAppNotificationRead(id: string): Promise<void> {
    await practiceSystem.invoke<void>("mark_in_app_notification_read", { id });
}

export async function markAllInAppNotificationsRead(): Promise<void> {
    await practiceSystem.invoke<void>("mark_all_in_app_notifications_read");
}

export async function createInAppNotification(opts: {
    kind: string;
    title: string;
    body: string;
    payloadJson?: string;
    alsoNotifyUserIds?: string[];
}): Promise<number> {
    return practiceSystem.invoke<number>("create_in_app_notification", {
        args: {
            kind: opts.kind,
            title: opts.title,
            body: opts.body,
            payloadJson: opts.payloadJson ?? null,
            alsoNotifyUserIds: opts.alsoNotifyUserIds ?? [],
        },
    });
}

export async function dismissUnreadInAppNotificationsByKind(kinds: string[]): Promise<number> {
    const n = await practiceSystem.invoke<number>("dismiss_unread_in_app_notifications_by_kind", {
        kinds,
    });
    return typeof n === "number" ? n : 0;
}
