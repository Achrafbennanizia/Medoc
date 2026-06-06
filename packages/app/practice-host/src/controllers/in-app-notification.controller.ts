import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
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
