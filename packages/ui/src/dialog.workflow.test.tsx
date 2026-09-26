/// <reference types="vitest" />
/// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
    invoke: vi.fn(async () => undefined),
}));

import { invoke } from "@tauri-apps/api/core";
import { Dialog } from "./dialog";

describe("Dialog workflow logging", () => {
    const invokeMock = vi.mocked(invoke);

    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        invokeMock.mockClear();
        window.history.replaceState({}, "", "/patients/p-123");
    });

    it("logs cancel workflow events when Escape dismisses the dialog", async () => {
        const onClose = vi.fn();

        render(
            <Dialog open onClose={onClose} title="Delete entry">
                <button type="button">Confirm</button>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });

        expect(onClose).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
                payload: expect.objectContaining({
                    step: "primary_action",
                    action: "dialog.dismiss",
                    outcome: "cancel",
                    detail: "escape",
                    route: "/patients/:id",
                }),
            });
        });
    });

    it("logs cancel workflow events when the close button is clicked", async () => {
        const onClose = vi.fn();

        render(
            <Dialog open onClose={onClose} title="Delete entry">
                <button type="button">Confirm</button>
            </Dialog>,
        );

        fireEvent.click(screen.getByRole("button", { name: /close dialog/i }));

        expect(onClose).toHaveBeenCalledTimes(1);
        await waitFor(() => {
            expect(invokeMock).toHaveBeenCalledWith("log_workflow_event", {
                payload: expect.objectContaining({
                    step: "primary_action",
                    action: "dialog.dismiss",
                    outcome: "cancel",
                    detail: "close_button",
                    route: "/patients/:id",
                }),
            });
        });
    });
});
