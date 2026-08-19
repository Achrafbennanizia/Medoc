/**
 * Atomic save: persist SickLeaveCertificate via IPC, then cancel matching WorkPlan blocks.
 * Rolls back is not possible for IPC after success — WorkPlan snapshot is restored on localStorage failure.
 */
import {
    loadWorkPlanStore,
    saveWorkPlanStore,
    type WorkPlanStore,
} from "./staff-work-plan";

export type SickLeaveCertificateSaveInput = {
    staffId: string;
    note: string;
    documentRef: string;
    dateFrom: string;
    dateTo?: string;
};

export type SickLeaveCertificateSaveResult = {
    recordId: string;
    cancelledBlockCount: number;
};

export function cancelWorkPlanBlocksForDateRange(
    store: WorkPlanStore,
    staffId: string,
    dateFrom: string,
    dateTo?: string,
): { store: WorkPlanStore; cancelledCount: number } {
    const end = dateTo ?? dateFrom;
    const before = store.blocks.length;
    const blocks = store.blocks.filter((b) => {
        if (b.staffId !== staffId) return true;
        if (b.date < dateFrom || b.date > end) return true;
        return false;
    });
    return {
        store: { ...store, blocks },
        cancelledCount: before - blocks.length,
    };
}

export async function saveSickLeaveCertificateAtomic(
    invokeSave: (input: SickLeaveCertificateSaveInput) => Promise<{ id: string }>,
    input: SickLeaveCertificateSaveInput,
): Promise<SickLeaveCertificateSaveResult> {
    const priorStore = loadWorkPlanStore();
    const { store: nextStore, cancelledCount } = cancelWorkPlanBlocksForDateRange(
        priorStore,
        input.staffId,
        input.dateFrom,
        input.dateTo,
    );

    const record = await invokeSave(input);

    try {
        saveWorkPlanStore(nextStore);
    } catch (e) {
        saveWorkPlanStore(priorStore);
        throw e;
    }

    return { recordId: record.id, cancelledBlockCount: cancelledCount };
}
