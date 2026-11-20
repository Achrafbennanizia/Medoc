import { describe, expect, it } from "vitest";
import { translateLocale, translateLocaleParams, type Locale } from "./i18n";
import { localizeInAppNotification } from "./in-app-notification-display";

const LOCALES: Locale[] = ["en", "de", "fr", "ar"];

function tFor(loc: Locale) {
    return (key: string) => translateLocale(loc, key);
}
function tpFor(loc: Locale) {
    return (key: string, params: Record<string, string | number>) =>
        translateLocaleParams(loc, key, params);
}

describe("localizeInAppNotification", () => {
    it("localizes every known kind in all four locales without falling back to the key", () => {
        const samples = [
            {
                kind: "PRACTICE_TASK_ASSIGNED",
                title: "New task: Ada",
                body: "Please call the lab",
                payload_json: JSON.stringify({
                    taskId: "t1",
                    patient_name: "Ada Lovelace",
                    task_title: "Call lab",
                }),
            },
            {
                kind: "PRACTICE_TASK_DONE",
                title: "Task completed: Ada",
                body: "Reception marked the task as completed.",
                payload_json: JSON.stringify({ patient_name: "Ada Lovelace", task_title: "Call lab" }),
            },
            {
                kind: "PRACTICE_TASK_BACK",
                title: "Task returned: Ada",
                body: "Please process again.",
                payload_json: JSON.stringify({ patient_name: "Ada Lovelace", task_title: "Call lab" }),
            },
            {
                kind: "plan_hint_fulfilled",
                title: "Appointment hint fulfilled",
                body: "Ada: appointment on 2026-11-21 at 09:30",
                payload_json: JSON.stringify({
                    patient_name: "Ada Lovelace",
                    date: "2026-11-21",
                    time: "09:30",
                }),
            },
            {
                kind: "CHART_FORWARD",
                title: "Chart — review requested",
                body: "Dr X requests a chart review (Ada).",
                payload_json: JSON.stringify({
                    fromName: "Dr X",
                    patient_name: "Ada Lovelace",
                    note: "",
                }),
            },
            {
                kind: "PRACTICE_TICKET",
                title: "Ticket: Ada",
                body: "Please check the chart",
                payload_json: JSON.stringify({ patient_name: "Ada Lovelace" }),
            },
            {
                kind: "APPOINTMENT_OUTSIDE_HOURS",
                title: "Outside hours: Ada",
                body: "2026-11-21 at 12:15 — during the break",
                payload_json: JSON.stringify({
                    patient_name: "Ada Lovelace",
                    date: "2026-11-21",
                    time: "12:15",
                    reason: "break",
                }),
            },
            {
                kind: "APPOINTMENT_OUTSIDE_HOURS_SUMMARY",
                title: "2 appointments need a new time",
                body: "Open the calendar",
                payload_json: JSON.stringify({ count: 2 }),
            },
            {
                kind: "STOCK",
                title: "Low stock alert",
                body: "Nitrile gloves",
                payload_json: "{}",
            },
            {
                kind: "SYSTEM",
                title: "Day close reminder",
                body: "Please complete",
                payload_json: "{}",
            },
        ];

        for (const loc of LOCALES) {
            const t = tFor(loc);
            const tp = tpFor(loc);
            for (const sample of samples) {
                const out = localizeInAppNotification(sample, t, tp);
                expect(out.title.trim().length, `${loc}:${sample.kind} title`).toBeGreaterThan(0);
                expect(out.sub.trim().length, `${loc}:${sample.kind} body`).toBeGreaterThan(0);
                expect(out.title, `${loc}:${sample.kind} title is key`).not.toMatch(/^app\.notifications\./);
                expect(out.sub, `${loc}:${sample.kind} body is key`).not.toMatch(/^app\.notifications\./);
            }
        }
    });

    it("uses German wording for task assigned when locale is de", () => {
        const out = localizeInAppNotification(
            {
                kind: "PRACTICE_TASK_ASSIGNED",
                title: "New task: Ada",
                body: "Lab",
                payload_json: JSON.stringify({ patient_name: "Ada" }),
            },
            tFor("de"),
            tpFor("de"),
        );
        expect(out.title).toContain("Neue Aufgabe");
        expect(out.title).toContain("Ada");
    });

    it("uses Arabic script for seed stock alerts", () => {
        const out = localizeInAppNotification(
            {
                kind: "STOCK",
                title: "Low stock alert",
                body: "Nitrile",
                payload_json: "{}",
            },
            tFor("ar"),
            tpFor("ar"),
        );
        expect(out.title).toMatch(/[\u0600-\u06FF]/);
        expect(out.sub).toMatch(/[\u0600-\u06FF]/);
    });
});
