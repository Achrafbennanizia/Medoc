/** Plan-next tip card in the patient header (split from `patient-detail-shell-header.tsx`). */
import { buildPlanNextPracticeTask, emptyPlanNextAppointment, planNextHasContent, type PlanNextAppointmentV2 } from "@/lib/plan-next-appointment";
import { errorMessage } from "@/lib/utils";
import { Button } from "@/views/components/ui/button";
import { DismissibleNotice } from "@/views/components/ui/dismissible-notice";
import { Input, Select, Textarea } from "@/views/components/ui/input";
import { useToastStore } from "@/views/components/ui/toast-store";
import { useT } from "@/lib/i18n";
import { createPracticeTask } from "@/systems/practice-host/controllers/practice-task.controller";
import { useState } from "react";

/** Physician → reception: structured note; Send creates an APPOINTMENT practice task (simple track). */
export function PlanNextTipCard({
    planNext,
    patientId,
    canViewClinical,
    onPersistPlanNext,
    onClose,
}: {
    planNext: PlanNextAppointmentV2;
    patientId: string;
    canViewClinical: boolean;
    onPersistPlanNext: (next: PlanNextAppointmentV2) => void;
    onClose: () => void;
}) {
    const t = useT();
    const toast = useToastStore((s) => s.add);
    const [sendBusy, setSendBusy] = useState(false);

    const sendAsReceptionTask = async () => {
        // One-person editions have no reception to hand the task to (no tasks module).
        if (!__CAP_TASKS__ || sendBusy) return;
        // Store English canonical copy; list/drawer translate EN → device locale.
        const draft = buildPlanNextPracticeTask(planNext);
        if (!draft) {
            toast(t("patient.detail.plan_next.toast.empty"), "error");
            return;
        }
        setSendBusy(true);
        try {
            await createPracticeTask({
                patientId,
                kind: "APPOINTMENT",
                title: draft.title,
                body: draft.body || null,
                assigneeRole: "RECEPTION",
                assigneeUserId: null,
            });
            onPersistPlanNext(emptyPlanNextAppointment());
            onClose();
            toast(t("patient.detail.plan_next.toast.sent"), "success");
            window.dispatchEvent(new Event("medoc-nav-badges-refresh"));
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setSendBusy(false);
        }
    };

    return (
        <DismissibleNotice
            variant="accent"
            role="region"
            ariaLabel={t("patient.detail.plan_next.aria")}
            title={t("patient.detail.plan_next.title")}
            subtitle={t("patient.detail.plan_next.subtitle")}
            onDismiss={onClose}
        >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                    id="plan-urgency"
                    label={t("patient.detail.plan_next.urgency")}
                    value={planNext.urgency}
                    onChange={(e) =>
                        onPersistPlanNext({
                            ...planNext,
                            urgency: e.target.value as PlanNextAppointmentV2["urgency"],
                        })
                    }
                    options={[
                        { value: "routine", label: t("patient.detail.plan_next.urgency.routine") },
                        { value: "bald", label: t("patient.detail.plan_next.urgency.soon") },
                        { value: "dringend", label: t("patient.detail.plan_next.urgency.urgent") },
                    ]}
                />
                <Select
                    id="plan-kind"
                    label={t("patient.detail.plan_next.kind_hint")}
                    value={planNext.appointmentKindHint}
                    onChange={(e) => onPersistPlanNext({ ...planNext, appointmentKindHint: e.target.value })}
                    options={[
                        { value: "", label: t("patient.detail.plan_next.kind_open") },
                        { value: "CHECKUP", label: t("appointment.kind.CHECKUP") },
                        { value: "TREATMENT", label: t("appointment.kind.TREATMENT") },
                        { value: "EXAMINATION", label: t("appointment.kind.EXAMINATION") },
                        { value: "CONSULTATION", label: t("appointment.kind.CONSULTATION") },
                        { value: "FIRST_VISIT", label: t("appointment.kind.FIRST_VISIT") },
                    ]}
                />
                <Input
                    id="plan-dur"
                    type="number"
                    min={5}
                    step={5}
                    label={t("patient.detail.plan_next.duration")}
                    value={planNext.durationMin}
                    onChange={(e) => onPersistPlanNext({ ...planNext, durationMin: e.target.value })}
                    placeholder={t("patient.detail.plan_next.duration_ph")}
                />
            </div>
            <Input
                id="patient-plan-freetext"
                label={t("patient.detail.plan_next.freetext")}
                value={planNext.freeText}
                onChange={(e) => onPersistPlanNext({ ...planNext, freeText: e.target.value.slice(0, 140) })}
                placeholder={t("patient.detail.plan_next.freetext_ph")}
                style={{ marginTop: "var(--space-3)" }}
            />
            <details style={{ marginTop: "var(--space-4)" }}>
                <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--fg-2)" }}>
                    {t("patient.detail.plan_next.more_details")}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ marginTop: "var(--space-3)" }}>
                    <Select
                        id="plan-interval"
                        label={t("patient.detail.plan_next.interval")}
                        value={planNext.intervalWeeks}
                        onChange={(e) => onPersistPlanNext({ ...planNext, intervalWeeks: e.target.value })}
                        options={[
                            { value: "", label: t("patient.detail.plan_next.interval.empty") },
                            { value: "2", label: t("patient.detail.plan_next.interval.2w") },
                            { value: "4", label: t("patient.detail.plan_next.interval.4w") },
                            { value: "6", label: t("patient.detail.plan_next.interval.6w") },
                            { value: "12", label: t("patient.detail.plan_next.interval.12w") },
                            { value: "26", label: t("patient.detail.plan_next.interval.26w") },
                        ]}
                    />
                    <Input
                        id="plan-days"
                        label={t("patient.detail.plan_next.weekdays")}
                        value={planNext.preferredWeekdays}
                        onChange={(e) => onPersistPlanNext({ ...planNext, preferredWeekdays: e.target.value })}
                        placeholder={t("patient.detail.plan_next.weekdays_ph")}
                    />
                </div>
                {canViewClinical ? (
                    <Textarea
                        id="patient-plan-internal"
                        label={t("patient.detail.plan_next.internal")}
                        rows={2}
                        value={planNext.internalNote}
                        onChange={(e) => onPersistPlanNext({ ...planNext, internalNote: e.target.value })}
                        placeholder={t("patient.detail.plan_next.internal_ph")}
                        style={{ marginTop: "var(--space-3)" }}
                    />
                ) : null}
            </details>
            <div className="row" style={{ justifyContent: "flex-end", gap: "var(--space-2)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
                {planNextHasContent(planNext) ? (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onPersistPlanNext(emptyPlanNextAppointment())}
                        disabled={sendBusy}
                    >
                        {t("patient.detail.plan_next.clear")}
                    </Button>
                ) : null}
                {__CAP_TASKS__ ? (
                    <Button
                        size="sm"
                        variant="primary"
                        disabled={!planNextHasContent(planNext) || sendBusy || !patientId}
                        onClick={() => void sendAsReceptionTask()}
                        title={t("patient.detail.plan_next.send_hint")}
                    >
                        {sendBusy ? t("common.sending") : t("common.send")}
                    </Button>
                ) : null}
            </div>
        </DismissibleNotice>
    );
}
