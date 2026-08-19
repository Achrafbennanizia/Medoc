import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

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

export interface CreateDayCloseProtocol {
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
}

export const listDayCloseProtocols = () =>
    practiceSystem.invoke<DayCloseProtocol[]>("list_day_close_protocols");

export const getDayCloseProtocol = (id: string) =>
    practiceSystem.invoke<DayCloseProtocol>("get_day_close_protocol", { id });

export const createDayCloseProtocol = (data: CreateDayCloseProtocol) =>
    practiceSystem.invoke<DayCloseProtocol>("create_day_close_protocol", { data });

export const deleteDayCloseProtocol = (id: string) =>
    practiceSystem.invoke<void>("delete_day_close_protocol", { id });
