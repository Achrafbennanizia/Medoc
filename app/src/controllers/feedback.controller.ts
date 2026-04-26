import { tauriInvoke } from "@/services/tauri.service";
import { CreateFeedbackSchema, parseOrThrow } from "@/lib/schemas";

export type FeedbackKategorie = "feedback" | "vigilance" | "technical";
export type FeedbackStatus = "OFFEN" | "BEARBEITUNG" | "ERLEDIGT";

export interface FeedbackEntry {
    id: string;
    user_id: string;
    kategorie: FeedbackKategorie;
    betreff: string;
    nachricht: string;
    referenz: string | null;
    status: FeedbackStatus;
    created_at: string;
    updated_at: string;
}

export interface CreateFeedback {
    kategorie: FeedbackKategorie;
    betreff: string;
    nachricht: string;
    referenz?: string | null;
}

export const submitFeedback = (data: CreateFeedback) => {
    const safe = parseOrThrow(CreateFeedbackSchema, data);
    return tauriInvoke<FeedbackEntry>("submit_feedback", { data: safe });
};

export const listFeedback = () =>
    tauriInvoke<FeedbackEntry[]>("list_feedback");
