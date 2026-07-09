import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

import { useToastStore } from "@/views/components/ui/toast-store";

describe("toast policy compliance", () => {
    beforeEach(() => {
        useToastStore.setState({
            toasts: [],
            toastStackPointerInside: false,
        });
    });

    it("uses success/error defaults and keeps action-required toasts persistent", () => {
        const { add } = useToastStore.getState();
        add("Saved", "success");
        add("Failed", "error");
        add("Action required", "info", { onUndo: () => {} });

        const [successToast, errorToast, actionToast] = useToastStore.getState().toasts;
        expect(successToast.durationMs).toBe(3000);
        expect(errorToast.durationMs).toBe(5000);
        expect(actionToast.durationMs).toBe(0);
    });

    it("anchors toast stack to the bottom-right corner", () => {
        const cssPath = path.join(process.cwd(), "src/index.css");
        const css = readFileSync(cssPath, "utf8");
        const block = css.match(/\.toast-stack\s*\{[^}]+\}/m)?.[0] ?? "";

        expect(block).toContain(".toast-stack");
        expect(block).toMatch(/right:\s*max\(12px,\s*env\(safe-area-inset-right,\s*0px\)\)/);
        expect(block).toMatch(/bottom:\s*max\(12px,\s*env\(safe-area-inset-bottom,\s*0px\)\)/);
        expect(block).not.toMatch(/\btop:/);
    });
});
