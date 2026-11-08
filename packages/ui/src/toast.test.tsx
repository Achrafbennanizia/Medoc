import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { url: "http://127.0.0.1" });
function installDomGlobal(key: string, value: unknown) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
installDomGlobal("window", dom.window);
installDomGlobal("document", dom.window.document);
installDomGlobal("HTMLElement", dom.window.HTMLElement);
installDomGlobal("Node", dom.window.Node);
installDomGlobal("IS_REACT_ACT_ENVIRONMENT", true);

describe("ToastContainer", () => {
    beforeEach(() => {
        cleanup();
        localStorage.clear();
        useToastStore.setState({ toasts: [], toastStackPointerInside: false });
    });

    it("closes from the leading button without undoing, and Undo runs the activity rollback", () => {
        const undo = vi.fn();
        const view = render(<ToastContainer />);
        act(() => {
            useToastStore.getState().add("Patient saved", "success", { onUndo: undo, durationMs: 60_000 });
        });

        expect(view.getByRole("status")).toHaveTextContent("Patient saved");
        fireEvent.click(view.getByRole("button", { name: "Dismiss notification" }));
        expect(undo).not.toHaveBeenCalled();
        expect(view.queryByText("Patient saved")).not.toBeInTheDocument();

        act(() => {
            useToastStore.getState().add("Patient saved", "success", { onUndo: undo, durationMs: 60_000 });
        });
        fireEvent.click(view.getByRole("button", { name: "Undo" }));
        expect(undo).toHaveBeenCalledOnce();
        expect(view.queryByText("Patient saved")).not.toBeInTheDocument();
    });

    it("pauses the dismiss timer while the pointer is over the snackbar", () => {
        vi.useFakeTimers();
        try {
            const view = render(<ToastContainer />);
            act(() => {
                useToastStore.getState().add("Opening hours saved", "success", {
                    onUndo: () => {},
                    durationMs: 1000,
                });
            });
            fireEvent.pointerEnter(view.getByRole("region", { name: "Notifications" }));
            act(() => {
                vi.advanceTimersByTime(5000);
            });
            expect(view.getByText("Opening hours saved")).toBeInTheDocument();
            fireEvent.pointerLeave(view.getByRole("region", { name: "Notifications" }));
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(view.queryByText("Opening hours saved")).not.toBeInTheDocument();
        } finally {
            vi.useRealTimers();
        }
    });
});
