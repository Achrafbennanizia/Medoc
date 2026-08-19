import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { ServiceItem } from "@/models/types";
import { CreateServiceItemSchema, UpdateServiceItemSchema, parseOrThrow, type UpdateServiceItemInput } from "@/lib/schemas";

export async function listServices(): Promise<ServiceItem[]> {
    return practiceSystem.invoke<ServiceItem[]>("list_services");
}

export async function createServiceItem(data: {
    name: string;
    description?: string;
    category: string;
    price: number;
}): Promise<ServiceItem> {
    const safe = parseOrThrow(CreateServiceItemSchema, data);
    return practiceSystem.invoke<ServiceItem>("create_service_item", { data: safe });
}

/** Fields mirror Tauri `UpdateServiceItem` — all optional, merged with existing row. */
export type UpdateServiceItemPayload = UpdateServiceItemInput;

export async function updateServiceItem(id: string, data: UpdateServiceItemPayload): Promise<ServiceItem> {
    const safe = parseOrThrow(UpdateServiceItemSchema, data);
    return practiceSystem.invoke<ServiceItem>("update_service_item", { id, data: safe });
}

export async function deleteServiceItem(id: string): Promise<void> {
    return practiceSystem.invoke("delete_service_item", { id });
}
