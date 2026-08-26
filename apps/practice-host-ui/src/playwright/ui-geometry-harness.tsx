import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { initI18n } from "@/lib/i18n";
import { Button } from "@/views/components/ui/button";
import { ConfirmDialog, Dialog } from "@/views/components/ui/dialog";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { EmptyState } from "@/views/components/ui/empty-state";
import { FilterOptionBar } from "@/views/components/ui/filter-option-bar";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { TagInput } from "@/views/components/ui/tag-input";
import { TimeSlotPicker } from "@/views/components/ui/time-slot-picker";
import { ToastContainer } from "@/views/components/ui/toast";
import { useToastStore } from "@/views/components/ui/toast-store";

initI18n("en");

function ToastSeed() {
    const add = useToastStore((s) => s.add);
    useEffect(() => {
        add("Saved successfully", "success", { durationMs: 120_000 });
        add("Action required", "error", { durationMs: 120_000 });
    }, [add]);
    return null;
}

function GeometryHarness() {
    const [role, setRole] = useState("arzt");
    const [tags, setTags] = useState<string[]>(["Recall"]);

    return (
        <main id="ui-geometry-root" className="p-4 grid gap-4">
            <section data-qa="button-row" className="flex gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
            </section>

            <section data-qa="input-grid" className="grid gap-2 max-w-lg">
                <Input label="Patient name" defaultValue="Alice Example" />
                <Select
                    label="Role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    options={[
                        { value: "arzt", label: "Arzt" },
                        { value: "rez", label: "Rezeption" },
                    ]}
                />
                <Textarea label="Notes" defaultValue="Follow-up in 2 weeks." />
            </section>

            <section data-qa="filter-row" className="grid gap-2">
                <FilterOptionBar
                    ariaLabel="Task filter"
                    value="all"
                    onChange={() => {}}
                    options={[
                        { value: "all", label: "All" },
                        { value: "open", label: "Open" },
                        { value: "done", label: "Done" },
                    ]}
                />
            </section>

            <section data-qa="tag-and-slot" className="grid gap-2 max-w-lg">
                <TagInput
                    label="Tags"
                    value={tags}
                    onChange={setTags}
                    suggestions={["Urgent", "Control", "Prophylaxis"]}
                />
                <TimeSlotPicker
                    value=""
                    onChange={() => {}}
                    selectedDate="2026-08-26"
                    slots={["09:00", "09:30", "10:00"]}
                    busyKeys={new Set(["2026-08-26|09:30"])}
                />
            </section>

            <section data-qa="notice-and-empty" className="grid gap-2">
                <DismissibleNotice title="Notice" subtitle="Review required" closable={false} />
                <EmptyState
                    title="No results"
                    description="Adjust your filters."
                    action={{ label: "Refresh", onClick: () => {} }}
                    secondaryAction={{ label: "Reset", onClick: () => {} }}
                />
            </section>

            <section data-qa="dialog-layer">
                <Dialog open onClose={() => {}} title="Geometry dialog">
                    <Input label="Dialog input" defaultValue="Dialog value" />
                </Dialog>
                <ConfirmDialog
                    open
                    onClose={() => {}}
                    onConfirm={() => {}}
                    title="Confirm action"
                    message="Review and confirm."
                    confirmLabel="Confirm"
                    cancelLabel="Cancel"
                />
            </section>

            <ToastSeed />
            <ToastContainer />
        </main>
    );
}

const rootNode = document.getElementById("root");
if (rootNode) {
    createRoot(rootNode).render(<GeometryHarness />);
}
