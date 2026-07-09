import { useState } from "react";
import { useT } from "@/lib/i18n";
import { BellIcon } from "@/lib/icons";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { Dialog, ConfirmDialog } from "../components/ui/dialog";
import { DismissibleNotice } from "../components/ui/dismissible-notice";
import { EmptyState } from "../components/ui/empty-state";
import { FilterOptionBar, type FilterOption } from "../components/ui/filter-option-bar";
import { FormSection } from "../components/ui/form-section";
import { IconButton } from "../components/ui/icon-button";
import { Input, Select, Textarea } from "../components/ui/input";
import { PageLoading } from "../components/ui/page-status";
import { Separator } from "../components/ui/separator";
import { Skeleton } from "../components/ui/skeleton";
import { Spinner } from "../components/ui/spinner";
import { TagInput } from "../components/ui/tag-input";
import { TimeSlotPicker } from "../components/ui/time-slot-picker";
import { ToastContainer } from "../components/ui/toast";
import { useToastStore } from "../components/ui/toast-store";

type WorkflowMode = "start" | "success" | "error";

const WORKFLOW_OPTIONS: readonly FilterOption<WorkflowMode>[] = [
    { value: "start", label: "Start" },
    { value: "success", label: "Success" },
    { value: "error", label: "Error" },
];

export function QaUiAuditPage() {
    const t = useT();
    const addToast = useToastStore((s) => s.add);
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("start");
    const [tags, setTags] = useState<string[]>(["urgent"]);
    const [slot, setSlot] = useState("08:30");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [confirmCount, setConfirmCount] = useState(0);
    const [loadingDemo, setLoadingDemo] = useState(false);

    return (
        <div className="min-h-screen bg-surface-dim p-4 md:p-6">
            <div className="mx-auto max-w-5xl space-y-4" data-testid="qa-root">
                <div className="m-4 rounded-card bg-surface p-4" data-testid="spacing-box">
                    <h1 className="text-title" data-testid="qa-title">UI audit harness</h1>
                    <p className="text-body text-on-surface-variant">
                        {t("app.page_loading")} / workflow QA for spacing, behavior and accessibility checks.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2" data-testid="spacing-grid">
                    <div>
                        <Card className="card-pad">
                            <CardHeader title="Inputs & actions" subtitle="Interaction matrix" />
                            <FormSection title="Entry form">
                                <Input
                                    id="qa-name"
                                    label="Name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Jane Doe"
                                />
                                <Textarea
                                    id="qa-notes"
                                    label="Notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                />
                                <Select
                                    id="qa-mode"
                                    label="Workflow mode"
                                    value={workflowMode}
                                    onChange={(e) => setWorkflowMode(e.target.value as WorkflowMode)}
                                    options={[...WORKFLOW_OPTIONS]}
                                />
                                <FilterOptionBar
                                    ariaLabel="Workflow mode options"
                                    value={workflowMode}
                                    options={WORKFLOW_OPTIONS}
                                    onChange={setWorkflowMode}
                                />
                            </FormSection>
                            <Separator />
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <Button
                                    data-testid="button-primary"
                                    onClick={() => setLoadingDemo((v) => !v)}
                                >
                                    Toggle loading state
                                </Button>
                                <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                                    Open dialog
                                </Button>
                                <Button variant="danger" onClick={() => setConfirmOpen(true)}>
                                    Open confirm
                                </Button>
                                <IconButton
                                    aria-label="Open notifications"
                                    data-testid="qa-icon-button"
                                    onClick={() => addToast("Info ping", "info")}
                                >
                                    <BellIcon size={16} />
                                </IconButton>
                            </div>
                            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                <Button
                                    variant="secondary"
                                    data-testid="toast-success-btn"
                                    onClick={() => addToast("Saved successfully", "success")}
                                >
                                    Success toast
                                </Button>
                                <Button
                                    variant="secondary"
                                    data-testid="toast-error-btn"
                                    onClick={() => addToast("Save failed", "error")}
                                >
                                    Error toast
                                </Button>
                                <Button
                                    variant="secondary"
                                    data-testid="toast-action-required-btn"
                                    onClick={() =>
                                        addToast("Action required: review and confirm", "warning", {
                                            persistent: true,
                                        })
                                    }
                                >
                                    Action-required toast
                                </Button>
                            </div>
                            <div className="row" style={{ gap: 8, marginTop: 8 }}>
                                <Badge variant="primary">primary</Badge>
                                <Badge variant="success">success</Badge>
                                <Badge variant="warning">warning</Badge>
                            </div>
                        </Card>
                    </div>

                    <div>
                        <Card className="card-pad">
                            <CardHeader title="States" subtitle="Loading / empty / keyboard" />
                            {loadingDemo ? <PageLoading label="Loading demo" /> : null}
                            <div className="col" style={{ gap: 10 }}>
                                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                                    <Spinner size="sm" />
                                    <Spinner size="md" />
                                    <Spinner size="lg" />
                                </div>
                                <Skeleton style={{ width: "100%", height: 14 }} />
                                <Skeleton style={{ width: "60%", height: 14 }} />
                            </div>
                            <TagInput
                                label="Tags"
                                value={tags}
                                onChange={setTags}
                                suggestions={["follow-up", "billing", "x-ray", "urgent"]}
                            />
                            <TimeSlotPicker
                                value={slot}
                                onChange={setSlot}
                                selectedDate="2026-07-09"
                                busyKeys={new Set(["2026-07-09|09:00"])}
                                startHour={8}
                                endHour={10}
                                stepMinutes={30}
                            />
                            <DismissibleNotice
                                title="Keyboard checks"
                                subtitle="Use Tab, Enter, Escape on this page."
                                dismissKey="qa-ui-audit-notice"
                            />
                            <EmptyState
                                title="No records"
                                description="This empty state is used for accessibility checks."
                                action={{ label: "Create", onClick: () => setDialogOpen(true) }}
                                secondaryAction={{
                                    label: "Dismiss",
                                    onClick: () => addToast("Dismissed", "info"),
                                }}
                            />
                        </Card>
                    </div>
                </div>

                <p data-testid="confirm-count">Confirm count: {confirmCount}</p>
            </div>

            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                title="Audit dialog"
                footer={(
                    <Button
                        variant="secondary"
                        onClick={() => setDialogOpen(false)}
                        data-testid="dialog-close-btn"
                    >
                        Close
                    </Button>
                )}
            >
                <p data-testid="dialog-body">Dialog body for Escape/Tab checks.</p>
            </Dialog>

            <ConfirmDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={() => {
                    setConfirmCount((count) => count + 1);
                    setConfirmOpen(false);
                }}
                title="Confirm primary action"
                message="Press Enter on the confirm button to increase the counter."
                confirmLabel="Confirm"
                cancelLabel="Cancel"
            />

            <ToastContainer />
        </div>
    );
}
