/**
 * Atomic save: persist Krankenbescheinigung via IPC, then cancel matching Arbeitsplan blocks.
 * Rolls back is not possible for IPC after success — Arbeitsplan snapshot is restored on localStorage failure.
 */
import {
    loadArbeitsplanStore,
    saveArbeitsplanStore,
    type ArbeitsplanStore,
} from "./personal-arbeitsplan";

export type KrankenbescheinigungSaveInput = {
    personalId: string;
    note: string;
    documentRef: string;
    dateFrom: string;
    dateTo?: string;
};

export type KrankenbescheinigungSaveResult = {
    recordId: string;
    cancelledBlockCount: number;
};

export function cancelArbeitsplanBlocksForDateRange(
    store: ArbeitsplanStore,
    personalId: string,
    dateFrom: string,
    dateTo?: string,
): { store: ArbeitsplanStore; cancelledCount: number } {
    const end = dateTo ?? dateFrom;
    const before = store.blocks.length;
    const blocks = store.blocks.filter((b) => {
        if (b.personalId !== personalId) return true;
        if (b.date < dateFrom || b.date > end) return true;
        return false;
    });
    return {
        store: { ...store, blocks },
        cancelledCount: before - blocks.length,
    };
}

export async function saveKrankenbescheinigungAtomic(
    invokeSave: (input: KrankenbescheinigungSaveInput) => Promise<{ id: string }>,
    input: KrankenbescheinigungSaveInput,
): Promise<KrankenbescheinigungSaveResult> {
    const priorStore = loadArbeitsplanStore();
    const { store: nextStore, cancelledCount } = cancelArbeitsplanBlocksForDateRange(
        priorStore,
        input.personalId,
        input.dateFrom,
        input.dateTo,
    );

    const record = await invokeSave(input);

    try {
        saveArbeitsplanStore(nextStore);
    } catch (e) {
        saveArbeitsplanStore(priorStore);
        throw e;
    }

    return { recordId: record.id, cancelledBlockCount: cancelledCount };
}
