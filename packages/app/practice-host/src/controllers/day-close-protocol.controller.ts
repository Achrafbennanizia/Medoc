import type { IssuedPdf } from "@/systems/practice-host/controllers/document.controller";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";

export interface DayCloseProtocol {
    id: string;
    as_of_date: string;
    counted_eur: number | null;
    system_cash_eur: number;
    system_income_eur: number;
    variance_eur: number | null;
    cash_matches: number;
    day_payment_count: number;
    cash_verified_count: number;
    all_payments_verified: number;
    note: string | null;
    recorded_at: string;
}

export const listDayCloseProtocols = () =>
    practiceSystem.invoke<DayCloseProtocol[]>("list_day_close_protocols");

export const getDayCloseProtocol = (id: string) =>
    practiceSystem.invoke<DayCloseProtocol>("get_day_close_protocol", { id });

// ---------------------------------------------------------------------------
// Server-computed day close (Kassenabschluss) and cash book
// ---------------------------------------------------------------------------


/** Fields added by the server-side closing (null on older protocols). */
export interface DayCloseProtocolExt extends DayCloseProtocol {
    status?: "FINAL" | "CORRECTED";
    period_from?: string | null;
    opening_cents?: number | null;
    cash_receipts_cents?: number | null;
    cash_movements_cents?: number | null;
    expected_cents?: number | null;
    counted_cents?: number | null;
    variance_cents?: number | null;
    card_cents?: number | null;
    card_terminal_cents?: number | null;
    transfer_cents?: number | null;
    receipt_count?: number | null;
    closed_by_name?: string | null;
    document_number?: string | null;
    corrects_id?: string | null;
}

export interface JournalLine {
    id: string;
    paymentId: string;
    patientId: string;
    patientName: string | null;
    amountCents: number;
    method: "CASH" | "CARD" | "BANK_TRANSFER" | "INVOICE" | string;
    kind: "RECEIPT" | "REVERSAL" | "CORRECTION" | "BACKFILL";
    /** UTC `YYYY-MM-DD HH:MM:SS`. */
    receivedAt: string;
    localDay: string;
    receiptNumber: string | null;
}

export type CashMovementKind = "OPENING_FLOAT" | "DEPOSIT" | "WITHDRAWAL" | "BANK_DEPOSIT" | "EXPENSE" | "REVERSAL";

export interface CashMovement {
    id: string;
    kind: CashMovementKind;
    amountCents: number;
    direction: 1 | -1;
    reason: string;
    receiptRef: string | null;
    reversesId: string | null;
    occurredAt: string;
    localDay: string;
    createdBy: string;
    dayCloseId: string | null;
}

export interface DayCloseDraft {
    asOfDate: string;
    periodFrom: string;
    lastClose: { id: string; asOfDate: string; closingCents: number; documentNumber: string | null } | null;
    alreadyClosed: boolean;
    openingCents: number;
    cashReceiptsCents: number;
    cashMovementsCents: number;
    expectedCents: number;
    cardCents: number;
    transferCents: number;
    otherCents: number;
    receiptCount: number;
    unverifiedCount: number;
    lateCount: number;
    receipts: JournalLine[];
    movements: CashMovement[];
}

export interface CloseDayInput {
    asOfDate: string;
    /** Counted cash in cents; ignored when `denominations` is set. */
    countedCents?: number | null;
    /** Count per denomination, keys in cents: `{ "5000": 3 }`. */
    denominations?: Record<string, number> | null;
    cardTerminalCents?: number | null;
    note?: string | null;
}

export interface DayCloseResult {
    protocolId: string;
    draft: DayCloseDraft;
    countedCents: number;
    varianceCents: number;
    report: IssuedPdf;
}

/** Euro denominations in cents, largest first (matches the server). */
export const EURO_DENOMINATIONS = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1] as const;

export const prepareDayClose = (asOfDate: string) =>
    practiceSystem.invoke<DayCloseDraft>("prepare_day_close", { asOfDate });

export const closeDay = (args: CloseDayInput) =>
    practiceSystem.invoke<DayCloseResult>("close_day", { args });

export const correctDayClose = (protocolId: string, args: Omit<CloseDayInput, "asOfDate">) =>
    practiceSystem.invoke<DayCloseResult>("correct_day_close", { args: { protocolId, asOfDate: "", ...args } });

export const dayCloseReportCopy = (protocolId: string) =>
    practiceSystem.invoke<IssuedPdf>("day_close_report_copy", { protocolId });

export const recordCashMovement = (args: {
    kind: Exclude<CashMovementKind, "REVERSAL">;
    amountCents: number;
    reason: string;
    receiptRef?: string | null;
}) => practiceSystem.invoke<CashMovement>("record_cash_movement", { args });

export const reverseCashMovement = (id: string, reason: string) =>
    practiceSystem.invoke<CashMovement>("reverse_cash_movement", { id, reason });

export const listCashMovements = (from: string, to: string) =>
    practiceSystem.invoke<CashMovement[]>("list_cash_movements", { from, to });

/** Signed amount of a movement (in → +, out → −). */
export const movementSignedCents = (m: CashMovement) => m.amountCents * m.direction;
