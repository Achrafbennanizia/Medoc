import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkSession } from "@/systems/practice-host/controllers/auth.controller";
import { mergeAutocompleteFromPraxisKvIntoLocal } from "@/lib/praxis-search-prefs-sync";
import { useAuthStore } from "@/models/store/auth-store";
import { SessionGate } from "./session-gate";

vi.mock("@/systems/practice-host/controllers/auth.controller", () => ({
    checkSession: vi.fn(),
}));

vi.mock("@/lib/praxis-search-prefs-sync", () => ({
    mergeAutocompleteFromPraxisKvIntoLocal: vi.fn(),
}));

describe("SessionGate behavior", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        useAuthStore.setState({ session: null, sessionChecked: false });
        vi.mocked(mergeAutocompleteFromPraxisKvIntoLocal).mockReset();
        vi.mocked(checkSession).mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("shows children after successful session check", async () => {
        vi.mocked(checkSession).mockResolvedValue(undefined);
        render(
            <SessionGate>
                <div>Ready</div>
            </SessionGate>,
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(screen.getByText("Ready")).toBeInTheDocument();
        expect(mergeAutocompleteFromPraxisKvIntoLocal).toHaveBeenCalledTimes(1);
    });

    it("unblocks the app after timeout when session check hangs", async () => {
        vi.mocked(checkSession).mockImplementation(
            () => new Promise<void>(() => undefined),
        );
        render(
            <SessionGate>
                <div>Ready</div>
            </SessionGate>,
        );

        expect(screen.queryByText("Ready")).toBeNull();
        await act(async () => {
            vi.advanceTimersByTime(7001);
            await Promise.resolve();
        });

        expect(screen.getByText("Ready")).toBeInTheDocument();
    });
});
