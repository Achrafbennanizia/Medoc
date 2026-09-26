// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const loginMock = vi.fn();
const postLoginPathMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
    return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/systems/practice-host/controllers/auth.controller", () => ({
    login: (...args: unknown[]) => loginMock(...args),
    postLoginPath: (...args: unknown[]) => postLoginPathMock(...args),
}));

import { LoginPage } from "./login";

describe("LoginPage events", () => {
    afterEach(() => {
        cleanup();
    });

    beforeEach(() => {
        loginMock.mockReset();
        postLoginPathMock.mockReset();
        navigateMock.mockReset();
    });

    it("submits with Enter and navigates on success", async () => {
        const user = userEvent.setup();
        loginMock.mockResolvedValueOnce({
            user_id: "u1",
            name: "Dr. House",
            email: "doctor@practice.de",
            role: "PHYSICIAN",
        });
        postLoginPathMock.mockResolvedValueOnce("/");

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText("Email"), "doctor@practice.de");
        await user.type(screen.getByLabelText("Password"), "password123{Enter}");

        await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
        expect(navigateMock).toHaveBeenCalledWith("/");
    });

    it("renders unauthorized errors", async () => {
        const user = userEvent.setup();
        loginMock.mockRejectedValueOnce(new Error("Unauthorized"));

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText("Email"), "doctor@practice.de");
        await user.type(screen.getByLabelText("Password"), "wrong-password");
        await user.click(screen.getByRole("button", { name: "Sign in" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password.");
        });
    });

    it("disables submit while loading", async () => {
        const user = userEvent.setup();
        let resolveLogin: (() => void) | null = null;
        loginMock.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveLogin = () =>
                    resolve({
                        user_id: "u1",
                        name: "Dr. House",
                        email: "doctor@practice.de",
                        role: "PHYSICIAN",
                    });
            }),
        );
        postLoginPathMock.mockResolvedValueOnce("/");

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>,
        );

        await user.type(screen.getByLabelText("Email"), "doctor@practice.de");
        await user.type(screen.getByLabelText("Password"), "password123");
        const submit = screen.getByRole("button", { name: "Sign in" });
        await user.click(submit);
        expect(submit).toBeDisabled();

        resolveLogin?.();
        await waitFor(() => expect(submit).not.toBeDisabled());
    });
});
