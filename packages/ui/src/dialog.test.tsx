/** @vitest-environment jsdom */
import { fireEvent, render } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "./dialog";

vi.mock("@/services/workflow-log", () => ({
    emitWorkflowEvent: vi.fn().mockResolvedValue(undefined),
}));

import { emitWorkflowEvent } from "@/services/workflow-log";

describe("Dialog workflow events", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        cleanup();
    });

    it("emits cancel event for close button", () => {
        const onClose = vi.fn();
        const view = render(
            <Dialog open onClose={onClose} title="Patient export" presentation="centered">
                <p>Body</p>
            </Dialog>,
        );

        const closeButton = document.body.querySelector(".modal-close-corner");
        expect(closeButton).toBeTruthy();

        fireEvent.click(closeButton!);

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(vi.mocked(emitWorkflowEvent)).toHaveBeenCalledWith({
            step: "cancel",
            action: "dialog_close",
            outcome: "close_button",
            detail: "Patient export",
        });
    });

    it("emits cancel event for Escape key", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Akte details">
                <p>Body</p>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(vi.mocked(emitWorkflowEvent)).toHaveBeenCalledWith({
            step: "cancel",
            action: "dialog_close",
            outcome: "escape",
            detail: "Akte details",
        });
    });

    it("emits cancel event for backdrop click", () => {
        const onClose = vi.fn();
        const view = render(
            <Dialog open onClose={onClose} title="Termin">
                <p>Body</p>
            </Dialog>,
        );

        const backdrop = document.body.querySelector(".modal-backdrop");
        expect(backdrop).toBeTruthy();

        fireEvent.click(backdrop!);

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(vi.mocked(emitWorkflowEvent)).toHaveBeenCalledWith({
            step: "cancel",
            action: "dialog_close",
            outcome: "backdrop",
            detail: "Termin",
        });
    });
});
