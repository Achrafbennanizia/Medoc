import { useState } from "react";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { FilterOptionBar } from "../components/ui/filter-option-bar";
import { Input } from "../components/ui/input";
import { TagInput } from "../components/ui/tag-input";

type AuditFilter = "all" | "open" | "done";

/**
 * Dedicated surface for Playwright geometry/a11y checks.
 * Keeps spacing assertions deterministic across breakpoints.
 */
export function UiAuditPage() {
    const t = useT();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [name, setName] = useState("");
    const [filter, setFilter] = useState<AuditFilter>("all");
    const [tags, setTags] = useState<string[]>(["Follow-up"]);
    const [emptyActionCount, setEmptyActionCount] = useState(0);

    return (
        <div className="min-h-screen bg-surface-dim p-4 md:p-6 lg:p-8" data-testid="audit-shell">
            <main
                data-testid="audit-panel"
                className="mx-auto max-w-5xl rounded-card border border-slate-300 bg-surface p-4 md:p-6 lg:p-8"
            >
                <header className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-title text-on-surface">{t("help.page_title")}</h1>
                    <Button
                        type="button"
                        className="h-10 px-4"
                        onClick={() => setDialogOpen(true)}
                    >
                        Open dialog
                    </Button>
                </header>

                <section
                    data-testid="audit-stack"
                    className="mt-4 flex flex-col gap-3 md:mt-6 md:gap-4 lg:mt-8 lg:gap-5"
                >
                    <div
                        data-testid="audit-grid"
                        className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:gap-5"
                    >
                        <Input
                            label="Audit name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Jane Doe"
                        />
                        <div data-testid="audit-size-target" className="flex h-10 items-center rounded-md border border-slate-300 px-3 text-body">
                            Size token target
                        </div>
                    </div>

                    <FilterOptionBar
                        ariaLabel="Audit filter"
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: "all", label: "All" },
                            { value: "open", label: "Open" },
                            { value: "done", label: "Done" },
                        ]}
                    />

                    <TagInput
                        label="Checklist"
                        value={tags}
                        onChange={setTags}
                        suggestions={["Spacing", "Keyboard", "WCAG"]}
                    />

                    <EmptyState
                        title="No unresolved violations"
                        description="Create a deliberate issue to verify alerts and toasts."
                        action={{
                            label: "Create sample issue",
                            onClick: () => setEmptyActionCount((count) => count + 1),
                        }}
                        secondaryAction={{
                            label: `Created ${emptyActionCount}`,
                            onClick: () => setEmptyActionCount(0),
                        }}
                    />
                </section>
            </main>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="Audit dialog"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
                    </>
                }
            >
                <p className="text-body text-on-surface-variant">
                    Keyboard checks: Escape closes, Enter confirms, and Tab order remains logical.
                </p>
            </Dialog>
        </div>
    );
}
