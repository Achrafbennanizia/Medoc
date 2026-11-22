/**
 * Atomic save: persist SickLeaveCertificate via IPC, then cancel matching WorkPlan blocks.
 * The IPC save cannot be rolled back after success; when it fails, the staff member's synced work-plan slice is restored.
 */
import {
    hydrateWorkPlanStore,
    persistWorkPlanSlice,
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
    const priorStore = await hydrateWorkPlanStore([input.staffId], { cache: false });
    const { store: nextStore, cancelledCount } = cancelWorkPlanBlocksForDateRange(
        priorStore,
        input.staffId,
        input.dateFrom,
        input.dateTo,
    );

    await persistWorkPlanSlice(nextStore, input.staffId);

    try {
        const record = await invokeSave(input);
        return { recordId: record.id, cancelledBlockCount: cancelledCount };
    } catch (e) {
        await persistWorkPlanSlice(priorStore, input.staffId);
        throw e;
    }
}
