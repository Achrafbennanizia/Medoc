import type { z } from "zod";
import { practiceSystem } from "@/systems/practice-host/adapters/practice-transport";
import type { FeedbackCategory, FeedbackStatus } from "@/models/types";
import { CreateFeedbackSchema, parseOrThrow } from "@/lib/schemas";

export type { FeedbackCategory, FeedbackStatus };

export interface FeedbackEntry {
    id: string;
    user_id: string;
    category: FeedbackCategory;
    subject: string;
    message: string;
    reference: string | null;
    status: FeedbackStatus;
    created_at: string;
    updated_at: string;
}

export type CreateFeedback = z.input<typeof CreateFeedbackSchema>;

export const submitFeedback = (data: CreateFeedback) => {
    const safe = parseOrThrow(CreateFeedbackSchema, data);
    return practiceSystem.invoke<FeedbackEntry>("submit_feedback", { data: safe });
};

export const listFeedback = () =>
    practiceSystem.invoke<FeedbackEntry[]>("list_feedback");
