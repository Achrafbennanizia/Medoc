import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./login";

const loginMock = vi.fn();
const postLoginPathMock = vi.fn();
const startTotpEnrollmentLoginMock = vi.fn();
const confirmTotpEnrollmentLoginMock = vi.fn();

vi.mock("@/systems/practice-host/controllers/auth.controller", () => ({
    login: (...args: unknown[]) => loginMock(...args),
    postLoginPath: (...args: unknown[]) => postLoginPathMock(...args),
}));

vi.mock("@/systems/practice-host/controllers/totp.controller", () => ({
    startTotpEnrollmentLogin: (...args: unknown[]) => startTotpEnrollmentLoginMock(...args),
    confirmTotpEnrollmentLogin: (...args: unknown[]) => confirmTotpEnrollmentLoginMock(...args),
}));

describe("Login page events", () => {
    beforeEach(() => {
        loginMock.mockReset();
        postLoginPathMock.mockReset();
        startTotpEnrollmentLoginMock.mockReset();
        confirmTotpEnrollmentLoginMock.mockReset();
    });

    afterEach(() => {
        cleanup();
    });

    it("handles input/change + submit + loading state", async () => {
        let resolveLogin: ((value: unknown) => void) | null = null;
        const pendingLogin = new Promise((resolve) => {
            resolveLogin = resolve;
        });
        loginMock.mockReturnValue(pendingLogin);
        postLoginPathMock.mockResolvedValue("/");

        render(
            <MemoryRouter initialEntries={["/login"]}>
                <LoginPage />
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByLabelText(/^E-Mail$/i, { selector: 'input[type="email"]' }), {
            target: { value: "ahmed@praxis.de" },
        });
        fireEvent.change(screen.getByLabelText(/^Passwort$/i), { target: { value: "passwort123" } });
        fireEvent.click(screen.getByRole("button", { name: /Anmelden|Login/i }));

        expect(screen.getByRole("button", { name: /Anmelden|Login/i })).toBeDisabled();
        expect(loginMock).toHaveBeenCalledTimes(1);

        resolveLogin?.({
            user_id: "u-1",
            rolle: "ARZT",
            name: "Ahmed",
            email: "ahmed@praxis.de",
        });

        await waitFor(() => {
            expect(postLoginPathMock).toHaveBeenCalledTimes(1);
        });
    });

    it("shows error banner when login rejects", async () => {
        loginMock.mockRejectedValue(new Error("Ungültige Anmeldedaten"));

        render(
            <MemoryRouter initialEntries={["/login"]}>
                <LoginPage />
            </MemoryRouter>,
        );

        fireEvent.change(screen.getByLabelText(/^E-Mail$/i, { selector: 'input[type="email"]' }), {
            target: { value: "wrong@praxis.de" },
        });
        fireEvent.change(screen.getByLabelText(/^Passwort$/i), { target: { value: "bad" } });
        fireEvent.submit(screen.getByRole("button", { name: /Anmelden|Login/i }).closest("form")!);

        expect(await screen.findByRole("alert")).toHaveTextContent("Ungültige Anmeldedaten");
    });
});
