import type { z } from "zod";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { ServiceItem } from "@/models/types";
import { CreateServiceItemSchema, UpdateServiceItemSchema, parseOrThrow } from "@/lib/schemas";

export async function listServices(): Promise<ServiceItem[]> {
    return practiceSystem.invoke<ServiceItem[]>("list_services");
}

export async function createServiceItem(
    data: z.input<typeof CreateServiceItemSchema>,
): Promise<ServiceItem> {
    const safe = parseOrThrow(CreateServiceItemSchema, data);
    return practiceSystem.invoke<ServiceItem>("create_service_item", { data: safe });
}

/** Fields follow `UpdateServiceItemSchema` — all optional, merged with the existing row. */
export async function updateServiceItem(
    id: string,
    data: z.input<typeof UpdateServiceItemSchema>,
): Promise<ServiceItem> {
    const safe = parseOrThrow(UpdateServiceItemSchema, data);
    return practiceSystem.invoke<ServiceItem>("update_service_item", { id, data: safe });
}

export async function deleteServiceItem(id: string): Promise<void> {
    return practiceSystem.invoke("delete_service_item", { id });
}
