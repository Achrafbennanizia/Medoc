import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { ContractItem } from "@/lib/contract-domain";

export type ContractDto = {
    id: string;
    designation: string;
    partner: string;
    amount: number;
    interval: string;
    unlimited: boolean;
    period_from: string | null;
    period_until: string | null;
    created_at: string;
    document_path?: string | null;
};

function dtoToItem(d: ContractDto): ContractItem {
    return {
        id: d.id,
        designation: d.designation,
        partner: d.partner,
        amount: d.amount,
        interval: d.interval as ContractItem["interval"],
        unlimited: d.unlimited,
        periodFrom: d.period_from,
        periodUntil: d.period_until,
        createdAt: d.created_at,
        documentPath: d.document_path ?? null,
    };
}

function itemToDto(version: ContractItem): ContractDto {
    return {
        id: version.id,
        designation: version.designation,
        partner: version.partner,
        amount: version.amount,
        interval: version.interval,
        unlimited: version.unlimited,
        period_from: version.periodFrom,
        period_until: version.periodUntil,
        created_at: version.createdAt,
        document_path: version.documentPath,
    };
}

export async function listContractsFromBackend(): Promise<ContractItem[]> {
    const rows = await practiceSystem.invoke<ContractDto[]>("list_contracts");
    return rows.map(dtoToItem);
}

export async function upsertContractOnBackend(version: ContractItem): Promise<void> {
    await practiceSystem.invoke<void>("upsert_contract", { data: itemToDto(version) });
}

export async function deleteContractOnBackend(id: string): Promise<void> {
    await practiceSystem.invoke<void>("delete_contract", { id });
}

const LEGACY_LS_KEY = "medoc-contracts-v1";

/** One-time migration from local demo storage. */
export async function migrateLegacyContractsFromLocalStorageOnce(): Promise<void> {
    if (typeof window === "undefined" || !window.localStorage) return;
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(LEGACY_LS_KEY);
    } catch {
        return;
    }
    if (!raw?.trim()) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    const backend = await listContractsFromBackend();
    if (backend.length > 0) {
        try {
            localStorage.removeItem(LEGACY_LS_KEY);
        } catch {
            /* ignore */
        }
        return;
    }
    for (const x of parsed) {
        if (x == null || typeof x !== "object") continue;
        const o = x as Record<string, unknown>;
        if (typeof o.id !== "string" || typeof o.designation !== "string") continue;
        const item: ContractItem = {
            id: o.id,
            designation: o.designation,
            partner: typeof o.partner === "string" ? o.partner : "",
            amount: typeof o.amount === "number" ? o.amount : 0,
            interval: (typeof o.interval === "string" ? o.interval : "MONTH") as ContractItem["interval"],
            unlimited: Boolean(o.unlimited),
            periodFrom: typeof o.periodFrom === "string" ? o.periodFrom : null,
            periodUntil: typeof o.periodUntil === "string" ? o.periodUntil : null,
            createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
            documentPath: typeof o.documentPath === "string" ? o.documentPath : null,
        };
        try {
            await upsertContractOnBackend(item);
        } catch {
            return;
        }
    }
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}

export async function openContractDocument(contractId: string): Promise<void> {
    return practiceSystem.invoke<void>("open_contract_document", { contractId });
}

export function stripLegacyContractsLocalStorage(): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
        localStorage.removeItem(LEGACY_LS_KEY);
    } catch {
        /* ignore */
    }
}
