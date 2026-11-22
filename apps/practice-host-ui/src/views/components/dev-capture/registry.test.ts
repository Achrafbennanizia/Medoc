import { describe, expect, it } from "vitest";
import { CAPTURE_COMMANDS, runCaptureCommand } from "./registry";

describe("capture command registry", () => {
    it("keeps every command the screenshot scripts use", () => {
        const used = ["snapshot", "fillLogin", "submitLogin", "logout", "forceLogout", "confirmLogout", "clickSidebar", "navigate", "clickText",
            "clickSelector", "fill", "resize", "zoom", "nativeZoomTest", "devChrome", "setLocale", "setTheme", "appearanceProbe", "pageText",
            "layoutReport", "ancestors", "targetAudit"];
        for (const op of used) expect(CAPTURE_COMMANDS[op], op).toBeTypeOf("function");
    });
    it("reports unknown commands and handler errors instead of throwing", async () => {
        expect(await runCaptureCommand({ op: "nope" })).toMatchObject({ ok: false, op: "nope" });
        const boom = { boom: () => { throw new Error("x"); } };
        expect(await runCaptureCommand({ op: "boom" }, boom)).toMatchObject({ ok: false, error: "Error: x" });
    });
    it("adds op and ok to a handler's result", async () => {
        expect(await runCaptureCommand({ op: "a" }, { a: () => ({ n: 1 }) })).toEqual({ ok: true, op: "a", n: 1 });
    });
    it("rejects commands missing their required field", async () => {
        expect(await runCaptureCommand({ op: "navigate" })).toMatchObject({ ok: false, error: "missing path" });
    });
});
