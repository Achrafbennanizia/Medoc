import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { BalanceSheet, Payment, PaymentMethod, PaymentStatus } from "@/models/types";
import { CreatePaymentSchema, UpdatePaymentSchema, parseOrThrow } from "@/lib/schemas";
import type { ListParams, ListResponse } from "@/lib/list-params";

export type PaymentFinanceKpis = {
    incomeMtd: number;
    incomePrevMtd: number;
    cancelledMtd: number;
    cancelledPrevMtd: number;
    openCount: number;
    openSum: number;
};

export type PaymentMonthBucket = {
    yearMonth: string;
    income: number;
    outstanding: number;
    cancelled: number;
};

export async function listPayments(): Promise<Payment[]> {
    return practiceSystem.invoke<Payment[]>("list_payments");
}

/** Paginated payments — use for finance / cash / day-close when totals can exceed ~500. */
export async function listPaymentsPaged(params?: ListParams): Promise<ListResponse<Payment>> {
    return practiceSystem.invoke<ListResponse<Payment>>("list_payments_paged", { params });
}

export async function paymentFinanceKpis(): Promise<PaymentFinanceKpis> {
    return practiceSystem.invoke<PaymentFinanceKpis>("payment_finance_kpis");
}

export async function paymentMonthlyBreakdown(months = 12): Promise<PaymentMonthBucket[]> {
    return practiceSystem.invoke<PaymentMonthBucket[]>("payment_monthly_breakdown", { months });
}

/** Bookings for one Patient only (same right as `list_payments`; less data transfer). */
export async function listPaymentsForPatient(patient_id: string): Promise<Payment[]> {
    return practiceSystem.invoke<Payment[]>("list_payments_for_patient", { patient_id });
}

/** For patient list: IDs with at least one booking status `outstanding` or `partiallyPaid` (wire values). */
export async function listPatientIdsOpenInvoice(): Promise<string[]> {
    return practiceSystem.invoke<string[]>("list_patient_ids_open_invoice");
}

export async function getBalanceSheet(): Promise<BalanceSheet> {
    return practiceSystem.invoke<BalanceSheet>("get_balance_sheet");
}

export async function createPayment(data: {
    patient_id: string;
    amount: number;
    payment_method: string;
    service_item_id?: string;
    description?: string;
    treatment_id?: string | null;
    examination_id?: string | null;
    amount_expected?: number | null;
}): Promise<Payment> {
    const safe = parseOrThrow(CreatePaymentSchema, data);
    return practiceSystem.invoke<Payment>("create_payment", { data: safe });
}

export async function updatePaymentStatus(id: string, status: PaymentStatus): Promise<Payment> {
    return practiceSystem.invoke<Payment>("update_payment_status", { id, status });
}

export async function updatePayment(data: {
    id: string;
    amount: number;
    payment_method: PaymentMethod;
    service_item_id?: string | null;
    description?: string | null;
}): Promise<Payment> {
    const safe = parseOrThrow(UpdatePaymentSchema, data);
    return practiceSystem.invoke<Payment>("update_payment", { data: safe });
}

export async function deletePayment(id: string): Promise<void> {
    return practiceSystem.invoke<void>("delete_payment", { id });
}

/** Day-end close: marks selected payments as cash-verified (or reverts). */
export async function setPaymentsCashVerified(ids: string[], cashVerified: boolean): Promise<number> {
    return practiceSystem.invoke<number>("set_payments_cash_verified", { ids, cash_verified: cashVerified });
}
