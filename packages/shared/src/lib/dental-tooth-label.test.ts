import { describe, expect, it } from "vitest";
import {
    fdiPatientQuadrant,
    fdiQuadrantIndex,
    formatDentalToothLabel,
    formatDentalToothList,
} from "./dental";

const fr: Record<string, string> = {
    "dental.quad.upper_right": "HD",
    "dental.quad.upper_left": "HG",
    "dental.quad.lower_right": "BD",
    "dental.quad.lower_left": "BG",
};

const en: Record<string, string> = {
    "dental.quad.upper_right": "UR",
    "dental.quad.upper_left": "UL",
    "dental.quad.lower_right": "LR",
    "dental.quad.lower_left": "LL",
};

describe("dental tooth orientation labels", () => {
    it("maps FDI quadrants to patient sides", () => {
        expect(fdiPatientQuadrant("11")).toBe("upper_right");
        expect(fdiPatientQuadrant("28")).toBe("upper_left");
        expect(fdiPatientQuadrant("31")).toBe("lower_left");
        expect(fdiPatientQuadrant("48")).toBe("lower_right");
        expect(fdiPatientQuadrant("99")).toBeNull();
    });

    it("maps FDI unit digit to 1–8 from the midline", () => {
        expect(fdiQuadrantIndex("11")).toBe(1);
        expect(fdiQuadrantIndex("18")).toBe(8);
        expect(fdiQuadrantIndex("42")).toBe(2);
        expect(fdiQuadrantIndex("40")).toBeNull();
    });

    it("formats French HD/HG/BD/BG labels", () => {
        const t = (k: string) => fr[k] ?? k;
        expect(formatDentalToothLabel("11", t)).toBe("HD1");
        expect(formatDentalToothLabel("18", t)).toBe("HD8");
        expect(formatDentalToothLabel("21", t)).toBe("HG1");
        expect(formatDentalToothLabel("28", t)).toBe("HG8");
        expect(formatDentalToothLabel("41", t)).toBe("BD1");
        expect(formatDentalToothLabel("48", t)).toBe("BD8");
        expect(formatDentalToothLabel("31", t)).toBe("BG1");
        expect(formatDentalToothLabel("38", t)).toBe("BG8");
    });

    it("formats English UR/UL/LR/LL labels (conventional upper/lower)", () => {
        const t = (k: string) => en[k] ?? k;
        expect(formatDentalToothLabel(15, t)).toBe("UR5");
        expect(formatDentalToothList(["15", "22"], t)).toBe("UR5, UL2");
    });

    it("keeps Arabic quadrant letters from ligating and keeps prefix-then-index order", () => {
        const ar: Record<string, string> = {
            "dental.quad.upper_right": "عي",
            "dental.quad.upper_left": "عش",
            "dental.quad.lower_right": "سي",
            "dental.quad.lower_left": "سش",
        };
        const t = (k: string) => ar[k] ?? k;
        const visible = (fdi: string) => formatDentalToothLabel(fdi, t).replace(/[\u200c\u200e\u2066\u2069]/g, "");
        expect(visible("11")).toBe("عي1");
        expect(visible("28")).toBe("عش8");
        expect(visible("48")).toBe("سي8");
        expect(formatDentalToothLabel("11", t)).toContain("\u200c");
        expect(formatDentalToothLabel("11", t)).toMatch(/^\u2066/);
        expect(formatDentalToothLabel("99", t)).toBe("99");
    });
});
