import { StrictMode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { BellIcon } from "@/lib/icons";
import { initI18n } from "@/lib/i18n";
import {
    Badge,
    Button,
    Card,
    CardHeader,
    EmptyState,
    IconButton,
    Input,
    Select,
    Separator,
    Textarea,
    ToastContainer,
    useToastStore,
} from "@medoc/ui";
import "./index.css";

function UiAuditHarness() {
    const addToast = useToastStore((s) => s.add);
    const seededRef = useRef(false);

    useEffect(() => {
        if (seededRef.current) return;
        seededRef.current = true;
        addToast("Action required", "warning", { persistent: true });
    }, [addToast]);

    return (
        <main className="min-h-screen bg-surface p-4 md:p-6">
            <section
                data-testid="spacing-stack"
                className="mx-auto flex w-full max-w-5xl flex-col gap-4"
            >
                <Card className="card-pad" elevated>
                    <CardHeader
                        title="UI geometry harness"
                        subtitle="Spacing + a11y checks"
                        action={
                            <div data-testid="spacing-inline" className="flex items-center gap-3">
                                <Badge variant="success">ready</Badge>
                                <IconButton aria-label="notifications">
                                    <BellIcon size={16} />
                                </IconButton>
                            </div>
                        }
                    />
                    <Separator />
                    <div data-testid="spacing-card" className="mt-4 grid gap-3 md:grid-cols-2">
                        <Input
                            label="Patient"
                            defaultValue="Max Mustermann"
                            hint="Audit harness field"
                        />
                        <Select
                            label="Role"
                            defaultValue="arzt"
                            options={[
                                { value: "arzt", label: "Arzt" },
                                { value: "rezeption", label: "Rezeption" },
                            ]}
                        />
                        <Textarea
                            label="Reason"
                            defaultValue="Follow-up call required"
                            className="md:col-span-2"
                        />
                    </div>
                    <div data-testid="action-row" className="mt-4 flex flex-wrap items-center gap-3">
                        <Button variant="primary">Save</Button>
                        <Button variant="secondary">Cancel</Button>
                        <Button variant="ghost">Preview</Button>
                    </div>
                </Card>

                <Card className="card-pad">
                    <EmptyState
                        title="No pending items"
                        description="This block helps visual-regression checks."
                        action={{ label: "Create", onClick: () => {} }}
                        secondaryAction={{ label: "Dismiss", onClick: () => {} }}
                    />
                </Card>
            </section>
            <ToastContainer />
        </main>
    );
}

initI18n("en");

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <UiAuditHarness />
    </StrictMode>,
);
