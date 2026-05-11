import { tauriInvoke } from "@/services/tauri.service";
import type { InAppNotification } from "@/models/types";

export async function listInAppNotifications(): Promise<InAppNotification[]> {
    return tauriInvoke<InAppNotification[]>("list_in_app_notifications");
}

export async function countUnreadInAppNotifications(): Promise<number> {
    const n = await tauriInvoke<number>("count_unread_in_app_notifications");
    return typeof n === "number" ? n : 0;
}

export async function markInAppNotificationRead(id: string): Promise<void> {
    await tauriInvoke<void>("mark_in_app_notification_read", { id });
}

export async function markAllInAppNotificationsRead(): Promise<void> {
    await tauriInvoke<void>("mark_all_in_app_notifications_read");
}
