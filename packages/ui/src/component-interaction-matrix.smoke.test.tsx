/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardHeader } from "./card";
import { ConfirmDialog, Dialog } from "./dialog";
import { EmptyState } from "./empty-state";
import { IconButton } from "./icon-button";
import { Input, Select, Textarea } from "./input";
import { PageLoadError, PageLoading } from "./page-status";
import { ToastContainer } from "./toast";
import { useToastStore } from "./toast-store";

afterEach(() => {
    cleanup();
    useToastStore.setState({ toasts: [], toastStackPointerInside: false });
});

describe("UI component interaction matrix", () => {
    it("handles click/disabled states for button-like components", async () => {
        const user = userEvent.setup();
        const onPrimary = vi.fn();
        const onIcon = vi.fn();

        render(
            <div>
                <Button onClick={onPrimary}>Speichern</Button>
                <Button loading>Busy</Button>
                <IconButton aria-label="Filter öffnen" onClick={onIcon}>
                    <span>F</span>
                </IconButton>
            </div>,
        );

        const primary = screen.getByRole("button", { name: "Speichern" });
        await user.click(primary);
        expect(onPrimary).toHaveBeenCalledTimes(1);

        const busy = screen.getByRole("button", { name: "Busy" });
        expect(busy).toBeDisabled();

        const icon = screen.getByRole("button", { name: "Filter öffnen" });
        icon.focus();
        await user.keyboard("{Enter}");
        expect(onIcon).toHaveBeenCalledTimes(1);
    });

    it("handles input/change/submit and disabled field states", async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());
        const onSelect = vi.fn();

        render(
            <form onSubmit={onSubmit}>
                <Input label="Name" name="name" defaultValue="" />
                <Select
                    label="Rolle"
                    name="rolle"
                    options={[
                        { value: "arzt", label: "Arzt" },
                        { value: "rez", label: "Rezeption" },
                    ]}
                    onChange={onSelect}
                />
                <Textarea label="Notiz" defaultValue="" />
                <Input label="Deaktiviert" defaultValue="x" disabled />
                <button type="submit">Absenden</button>
            </form>,
        );

        await user.type(screen.getByLabelText("Name"), "Max");
        expect(screen.getByLabelText("Name")).toHaveValue("Max");

        await user.click(screen.getByRole("button", { name: "Arzt" }));
        await user.click(screen.getByRole("option", { name: "Rezeption" }));
        expect(onSelect).toHaveBeenCalled();

        await user.type(screen.getByLabelText("Notiz"), "ok");
        expect(screen.getByLabelText("Notiz")).toHaveValue("ok");

        expect(screen.getByLabelText("Deaktiviert")).toBeDisabled();

        const nameInput = screen.getByLabelText("Name");
        nameInput.focus();
        await user.keyboard("{Enter}");
        expect(onSubmit).toHaveBeenCalled();
    });

    it("supports dialog keyboard controls (Tab, Escape, Enter)", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onConfirm = vi.fn();

        render(
            <>
                <Dialog open onClose={onClose} title="Workflow-Dialog">
                    <button type="button">Erste</button>
                    <button type="button">Zweite</button>
                </Dialog>
                <ConfirmDialog
                    open
                    onClose={onClose}
                    onConfirm={onConfirm}
                    title="Bestätigen?"
                    message="Aktion ausführen?"
                />
            </>,
        );

        const firstButton = await screen.findByRole("button", { name: "Erste" });
        await waitFor(() => expect(firstButton).toHaveFocus());
        await user.tab();
        expect(screen.getByRole("button", { name: "Zweite" })).toHaveFocus();

        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();

        const confirm = screen.getByRole("button", { name: "Bestätigen" });
        confirm.focus();
        await user.keyboard("{Enter}");
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("renders empty/loading/error states and fires handlers", async () => {
        const user = userEvent.setup();
        const onPrimary = vi.fn();
        const onSecondary = vi.fn();
        const onRetry = vi.fn();

        render(
            <div>
                <Badge>Aktiv</Badge>
                <Card>
                    <CardHeader title="Titel" subtitle="Untertitel" />
                </Card>
                <EmptyState
                    title="Keine Daten"
                    description="Liste ist leer"
                    action={{ label: "Anlegen", onClick: onPrimary }}
                    secondaryAction={{ label: "Abbrechen", onClick: onSecondary }}
                />
                <PageLoadError message="Laden fehlgeschlagen" onRetry={onRetry} />
                <PageLoading label="Bitte warten" />
            </div>,
        );

        expect(screen.getByText("Aktiv")).toBeInTheDocument();
        expect(screen.getByText("Titel")).toBeInTheDocument();
        expect(screen.getByText("Keine Daten")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Laden fehlgeschlagen");
        expect(screen.getByRole("status")).toHaveTextContent("Bitte warten");

        await user.click(screen.getByRole("button", { name: "Anlegen" }));
        await user.click(screen.getByRole("button", { name: "Abbrechen" }));
        await user.click(screen.getByRole("button", { name: "Erneut versuchen" }));

        expect(onPrimary).toHaveBeenCalledTimes(1);
        expect(onSecondary).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("creates success/error toasts with expected behavior metadata", async () => {
        const user = userEvent.setup();
        render(<ToastContainer />);

        useToastStore.getState().add("Erfolg", "success");
        useToastStore.getState().add("Fehler", "error");

        expect(await screen.findByRole("status")).toHaveTextContent("Erfolg");
        expect(screen.getByRole("alert")).toHaveTextContent("Fehler");

        const state = useToastStore.getState().toasts;
        const successToast = state.find((item) => item.type === "success");
        const errorToast = state.find((item) => item.type === "error");
        expect(successToast?.durationMs).toBe(3000);
        expect(errorToast?.durationMs).toBe(6000);

        const dismissButtons = screen.getAllByRole("button", { name: /Benachrichtigung|dismiss/i });
        await user.click(dismissButtons[0]);
        expect(useToastStore.getState().toasts.length).toBeLessThan(2);
    });
});
