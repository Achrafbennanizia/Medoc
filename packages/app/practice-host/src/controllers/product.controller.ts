import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { Product } from "@/models/types";

export async function listProducts(): Promise<Product[]> {
    return practiceSystem.invoke<Product[]>("list_products");
}

export async function createProduct(data: {
    name: string;
    description?: string;
    category: string;
    price: number;
    stock: number;
    min_stock: number;
}): Promise<Product> {
    return practiceSystem.invoke<Product>("create_product", { data });
}

export type UpdateProductPayload = {
    name?: string;
    description?: string | null;
    category?: string;
    price?: number;
    stock?: number;
    min_stock?: number;
    active?: boolean;
};

export async function updateProduct(id: string, data: UpdateProductPayload): Promise<Product> {
    return practiceSystem.invoke<Product>("update_product", { id, data });
}

export async function deleteProduct(id: string): Promise<void> {
    return practiceSystem.invoke("delete_product", { id });
}
