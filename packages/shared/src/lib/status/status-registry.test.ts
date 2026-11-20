import { describe, expect, it } from "vitest";
import de from "#shared-locales/de.json";
import en from "#shared-locales/en.json";
import fr from "#shared-locales/fr.json";
import ar from "#shared-locales/ar.json";
import { APPOINTMENT_STATUS_VALUES, CHART_STATUS_VALUES, ORDER_STATUS_VALUES, PATIENT_STATUS_VALUES, PAYMENT_STATUS_VALUES } from "../enums.generated";
import {
    STATUS_ENTITY_IDS,
    STATUS_REGISTRY,
    canTransition,
    nextStatuses,
    statusDescriptionKey,
    statusFlagLabelKey,
    statusLabelKey,
    statusRank,
    type StatusEntityId,
} from "./status-registry";

const LOCALES: Record<string, Record<string, string>> = { en, de, fr, ar };

describe("status registry", () => {
    it("labels and describes every status and flag in all locales", () => {
        for (const [loc, cat] of Object.entries(LOCALES)) {
            for (const id of STATUS_ENTITY_IDS) {
                expect(cat[`status.entity.${id}`], `${loc}:${id}`).toBeTruthy();
                for (const st of STATUS_REGISTRY[id].states) {
                    expect(cat[statusLabelKey(id, st.wire)], `${loc}:${id}.${st.wire}`).toBeTruthy();
                    expect(cat[statusDescriptionKey(id, st.wire)], `${loc}:${id}.${st.wire}`).toBeTruthy();
                }
                for (const f of STATUS_REGISTRY[id].flags ?? []) {
                    expect(cat[statusFlagLabelKey(id, f)], `${loc}:${id} flag ${f}`).toBeTruthy();
                }
            }
        }
    });

    it("only references known statuses in transitions and initial", () => {
        for (const id of STATUS_ENTITY_IDS) {
            const wires = new Set(STATUS_REGISTRY[id].states.map((s) => s.wire));
            expect(wires.has(STATUS_REGISTRY[id].initial), id).toBe(true);
            for (const st of STATUS_REGISTRY[id].states) {
                for (const n of st.next) expect(wires.has(n), `${id}: ${st.wire}→${n}`).toBe(true);
                expect(st.terminal).toBe(st.next.length === 0);
            }
        }
    });

    it("matches the persisted enum values (config/enums.yaml)", () => {
        const sets: [StatusEntityId, readonly string[]][] = [
            ["appointment", APPOINTMENT_STATUS_VALUES],
            ["patient_chart", CHART_STATUS_VALUES],
            ["purchase_order", ORDER_STATUS_VALUES],
            ["patient", PATIENT_STATUS_VALUES],
            ["payment", PAYMENT_STATUS_VALUES],
        ];
        for (const [id, values] of sets) {
            expect(STATUS_REGISTRY[id].states.map((s) => s.wire).sort()).toEqual([...values].sort());
        }
    });

    it("mirrors backend task rules (workflow_transitions.rs)", () => {
        expect(canTransition("practice_task", "OPEN", "DONE_RECEPTION")).toBe(false);
        expect(canTransition("practice_task", "IN_PROGRESS", "DONE_RECEPTION")).toBe(true);
        expect(canTransition("practice_task", "VALIDATED", "OPEN")).toBe(false);
        expect(nextStatuses("practice_task", "DONE_RECEPTION")).toEqual(["DONE_RECEPTION", "BACK", "VALIDATED"]);
        expect(canTransition("appointment", "COMPLETED", "CANCELLED")).toBe(false);
    });

    it("orders lists attention → todo → active → review → done", () => {
        const order = ["VALIDATED", "DONE_RECEPTION", "IN_PROGRESS", "OPEN", "BACK"].sort(
            (a, b) => statusRank("practice_task", a) - statusRank("practice_task", b),
        );
        expect(order).toEqual(["BACK", "OPEN", "IN_PROGRESS", "DONE_RECEPTION", "VALIDATED"]);
    });
});
