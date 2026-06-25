/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { Input } from "./input";

describe("ui component event contracts", () => {
    afterEach(() => {
        cleanup();
    });

    it("button handles click and keyboard activation", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(<Button onClick={onClick}>Speichern</Button>);

        const button = screen.getByRole("button", { name: "Speichern" });
        await user.click(button);
        button.focus();
        await user.keyboard("{Enter}");

        expect(onClick).toHaveBeenCalledTimes(2);
    });

    it("button loading state is disabled", async () => {
        const onClick = vi.fn();
        const user = userEvent.setup();
        render(
            <Button onClick={onClick} loading>
                Speichern
            </Button>,
        );

        const button = screen.getByRole("button", { name: "Speichern" });
        expect(button).toBeDisabled();
        await user.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it("input emits change and renders error state", async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <Input
                label="E-Mail"
                error="Pflichtfeld"
                onChange={onChange}
                placeholder="name@praxis.de"
            />,
        );

        const input = screen.getByLabelText("E-Mail");
        await user.type(input, "a");

        expect(onChange).toHaveBeenCalled();
        expect(screen.getByText("Pflichtfeld")).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("dialog handles escape and backdrop cancel", () => {
        const onClose = vi.fn();
        render(
            <Dialog open onClose={onClose} title="Bestätigung">
                <p>Inhalt</p>
            </Dialog>,
        );

        fireEvent.keyDown(document, { key: "Escape" });
        fireEvent.click(screen.getByRole("presentation"));
        expect(onClose).toHaveBeenCalledTimes(2);
    });
});
