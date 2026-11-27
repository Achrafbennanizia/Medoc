import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import type { Staff } from "@/models/types";
import type {
    PracticeTask,
    PracticeTaskStatus,
} from "@/systems/practice-host/controllers/practice-task.controller";
import {
    taskWorkflowTrack,
    transitionPracticeTask,
    updatePracticeTaskAdmin,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { errorMessage, formatCurrency } from "@/lib/utils";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import { practiceTaskHeadline } from "@/lib/practice-task-display";
import { clinicalServiceLabel } from "@/lib/clinical-service-label";
import { practiceTodayYmd } from "@/lib/practice-timezone";
import {
    BoltIcon,
    CalendarIcon,
    CheckIcon,
    EditIcon,
    EyeIcon,
    ShieldCheckIcon,
    XIcon,
} from "@/lib/icons";
import { Input, Textarea } from "../ui/input";
import { useToastStore } from "../ui/toast-store";
import {
    assigneeLabel,
    canFulfillAsPhysician,
    canFulfillAsReception,
    canValidateAsPhysician,
    canValidateAsReception,
    dispatchNavBadgeRefresh,
    userCanViewTask,
} from "./task-workflow";
import { countOpenPracticeTasksForMe } from "@/systems/practice-host/controllers/practice-task.controller";
import { PracticeTaskPrivacy } from "./practice-task-privacy";
import {
    SIMPLE_TASK_WORKFLOW_STEPS,
    TASK_WORKFLOW_STEPS,
    taskDrawerText,
    taskStatusLabel,
    taskStatusPillClass,
    taskKindLabel,
    taskWorkflowActiveStep,
    simpleTaskWorkflowActiveStep,
    taskWorkflowStepLabel,
} from "./task-workflow-ui";
import { PracticeTaskComments } from "./practice-task-comments";
import { PracticeTaskTicketForm } from "./practice-task-ticket-form";
import { PracticeTaskAppointmentNoteForm } from "./practice-task-appointment-note-form";
import { RecordHistory } from "../history/record-history";

const WORKFLOW_ICONS = [CheckIcon, BoltIcon, EyeIcon, ShieldCheckIcon] as const;
const SIMPLE_WORKFLOW_ICONS = [CheckIcon, EyeIcon, ShieldCheckIcon] as const;

export type PracticeTaskDetailDrawerProps = {
    task: PracticeTask;
    patientName: string;
    creatorLabel: string;
    staff: Staff[];
    userId: string;
    isPhysician: boolean;
    isReception: boolean;
    canAdmin?: boolean;
    canAdminStatus?: boolean;
    canFulfillStatus?: boolean;
    busy?: boolean;
    onClose: () => void;
    onUpdated: (task: PracticeTask) => void;
    onEdit?: () => void;
};

export function PracticeTaskDetailDrawer({
    task,
    patientName,
    creatorLabel,
    staff,
    userId,
    isPhysician,
    isReception,
    canAdmin = false,
    canAdminStatus = false,
    canFulfillStatus = false,
    busy: busyExternal = false,
    onClose,
    onUpdated,
    onEdit,
}: PracticeTaskDetailDrawerProps) {
    const t = useT();
    const dateFnsLocale = useDateFnsLocale();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const titleId = useId();
    const panelRef = useRef<HTMLDivElement>(null);
    const [busyLocal, setBusyLocal] = useState(false);
    const [completeNote, setCompleteNote] = useState("");
    const [returnReason, setReturnReason] = useState("");
    const [showReturnForm, setShowReturnForm] = useState(false);
    const busy = busyExternal || busyLocal;
    const tx = (key: string) => taskDrawerText(t, key);
    const headline = practiceTaskHeadline(task, t);

    const track = taskWorkflowTrack(task.kind);
    const isSimple = track === "simple";
    const showRezFulfill = isReception && canFulfillAsReception(task, userId);
    const showPhysicianFulfill = isPhysician && canFulfillAsPhysician(task, userId);
    const showPhysicianValidate = isPhysician && canValidateAsPhysician(task, userId);
    const showRezValidate = isReception && canValidateAsReception(task, userId);
    const canFulfillWorkflow =
        canAdminStatus || canFulfillStatus || showRezFulfill || showPhysicianFulfill;

    const canMarkViewed =
        isSimple &&
        canFulfillWorkflow &&
        (task.status === "OPEN" || (canAdminStatus && task.status !== "DONE"));
    const canMarkDone =
        isSimple &&
        canFulfillWorkflow &&
        (task.status === "VIEWED" || (canAdminStatus && task.status === "OPEN"));

    const canTake =
        !isSimple &&
        canFulfillWorkflow &&
        (task.status === "OPEN" || (canAdminStatus && task.status === "BACK"));
    const canComplete =
        !isSimple &&
        canFulfillWorkflow &&
        (task.status === "IN_PROGRESS" ||
            task.status === "BACK" ||
            (canAdminStatus && task.status === "OPEN"));
    const canValidate = !isSimple && (showPhysicianValidate || showRezValidate);
    const active = isSimple
        ? simpleTaskWorkflowActiveStep(task.status)
        : taskWorkflowActiveStep(task.status);
    const workflowSteps = isSimple ? SIMPLE_TASK_WORKFLOW_STEPS : TASK_WORKFLOW_STEPS;
    const canComment = canAdmin || userCanViewTask(task, userId, { isReception });

    const canClickWorkflowStep = (stepIndex: number): boolean => {
        const target = workflowSteps[stepIndex]?.status;
        if (!target || target === task.status) return false;
        if (canAdminStatus) return true;
        if (isSimple) {
            if (target === "VIEWED" && canMarkViewed) return true;
            if (target === "DONE" && canMarkDone) return true;
            if (target === "OPEN" && task.status === "VIEWED") {
                return canAdminStatus || showRezFulfill || showPhysicianFulfill;
            }
            return false;
        }
        if (target === "IN_PROGRESS" && canTake) return true;
        if (target === "DONE_RECEPTION" && canComplete) return true;
        if (target === "VALIDATED" && canValidate) return true;
        if (target === "OPEN" && task.status === "IN_PROGRESS") {
            return canAdminStatus || showRezFulfill || showPhysicianFulfill;
        }
        return false;
    };

    useEffect(() => {
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
        };
        document.addEventListener("keydown", onKey, true);
        queueMicrotask(() => {
            panelRef.current?.querySelector<HTMLButtonElement>(".appointment-drawer-head .icon-btn")?.focus();
        });
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.body.style.overflow = prevOverflow;
        };
    }, [onClose]);

    const applyStatus = async (
        status: PracticeTaskStatus,
        extra?: { doneNote?: string; returnReason?: string },
    ) => {
        if (busy) return;
        setBusyLocal(true);
        try {
            const updated = canAdminStatus
                ? await updatePracticeTaskAdmin({ id: task.id, status })
                : await transitionPracticeTask({ id: task.id, status, ...extra });
            toast(t("page.practice_tickets.task_updated_toast"), "success");
            onUpdated(updated);
            if (status === "BACK" || status === "DONE_RECEPTION" || status === "DONE" || status === "VIEWED") {
                setShowReturnForm(false);
                setReturnReason("");
                void countOpenPracticeTasksForMe().then((n) => dispatchNavBadgeRefresh(n));
                window.dispatchEvent(new CustomEvent("medoc-in-app-notifications-refresh"));
            } else {
                setShowReturnForm(false);
                setReturnReason("");
            }
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusyLocal(false);
        }
    };

    const onWorkflowStep = (stepIndex: number) => {
        if (!canClickWorkflowStep(stepIndex)) return;
        const target = workflowSteps[stepIndex]?.status;
        if (!target || target === task.status) return;
        if (canAdminStatus) {
            void applyStatus(target);
            return;
        }
        if (isSimple) {
            if (target === "VIEWED" && canMarkViewed) {
                void applyStatus("VIEWED");
                return;
            }
            if (target === "DONE" && canMarkDone) {
                void applyStatus("DONE");
                return;
            }
            if (target === "OPEN" && task.status === "VIEWED" && (showRezFulfill || showPhysicianFulfill)) {
                void applyStatus("OPEN");
            }
            return;
        }
        if (target === "IN_PROGRESS" && canTake) {
            void applyStatus("IN_PROGRESS");
            return;
        }
        if (target === "DONE_RECEPTION" && canComplete) {
            const note = completeNote.trim() || (task.body ?? task.title).trim();
            void applyStatus("DONE_RECEPTION", { doneNote: note || undefined });
            return;
        }
        if (target === "VALIDATED" && canValidate) {
            void applyStatus("VALIDATED");
            return;
        }
        if (target === "OPEN" && task.status === "IN_PROGRESS" && (showRezFulfill || showPhysicianFulfill)) {
            void applyStatus("OPEN");
        }
    };

    const openWeekCalendar = () => {
        const date = practiceTodayYmd();
        navigate(`/appointments?view=week&date=${encodeURIComponent(date)}`);
        onClose();
    };

    const icons = isSimple ? SIMPLE_WORKFLOW_ICONS : WORKFLOW_ICONS;

    const layer = (
        <div className="appointment-drawer-root" role="presentation">
            <button type="button" className="appointment-drawer-backdrop" aria-label={t("common.close")} onClick={onClose} />
            <div
                ref={panelRef}
                className="appointment-drawer-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
            >
                <div className="appointment-drawer-body-scroll">
                    <div className="appointment-drawer-head">
                        <span className={`pill ${taskStatusPillClass(task.status)}`}>
                            {taskStatusLabel(t, task.status)}
                        </span>
                        <button type="button" className="icon-btn" aria-label={t("common.close")} onClick={onClose}>
                            <XIcon size={18} />
                        </button>
                    </div>

                    <div className="appointment-drawer-section">
                        <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_eyebrow")}</div>
                        <h2 id={titleId} className="appointment-drawer-title" dir="auto">
                            {headline}
                        </h2>
                        <div className="appointment-drawer-sub">
                            {patientName} · {taskKindLabel(t, task.kind)}
                        </div>
                    </div>

                    <div className="appointment-drawer-meta-row">
                        <div>
                            <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_created")}</div>
                            <div className="appointment-drawer-meta-val">
                                {format(parseISO(task.created_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div>
                            <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_updated")}</div>
                            <div className="appointment-drawer-meta-val">
                                {format(parseISO(task.updated_at), "d. MMM yyyy", { locale: dateFnsLocale })}
                            </div>
                        </div>
                        <div>
                            <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_assignee")}</div>
                            <div className="appointment-drawer-meta-val">{assigneeLabel(task, staff, t)}</div>
                        </div>
                    </div>

                    <div className="appointment-drawer-section">
                        <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_workflow")}</div>
                        <div
                            className={[
                                "appointment-workflow-simple",
                                `appointment-workflow-simple--${workflowSteps.length}`,
                            ].join(" ")}
                        >
                            {workflowSteps.map((step, i) => {
                                const Icon = icons[i] ?? CheckIcon;
                                const isNext =
                                    !isSimple &&
                                    canValidate &&
                                    task.status === "DONE_RECEPTION" &&
                                    step.status === "VALIDATED";
                                const label = taskWorkflowStepLabel(t, step);
                                return (
                                    <div key={step.status} className="appointment-workflow-step">
                                        <button
                                            type="button"
                                            className={[
                                                "appointment-workflow-node",
                                                i <= active ? "on" : "",
                                                i === active ? "current" : "",
                                                isNext ? "appointment-workflow-node--next" : "",
                                            ]
                                                .filter(Boolean)
                                                .join(" ")}
                                            title={label}
                                            disabled={busy || !canClickWorkflowStep(i)}
                                            onClick={() => onWorkflowStep(i)}
                                        >
                                            <Icon size={14} />
                                        </button>
                                        <span className="appointment-workflow-label">{label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {task.kind === "TICKET" ? (
                        <PracticeTaskTicketForm
                            task={task}
                            patientName={patientName}
                            creatorLabel={creatorLabel}
                        />
                    ) : null}

                    {task.kind === "APPOINTMENT" ? (
                        <PracticeTaskAppointmentNoteForm
                            task={task}
                            patientName={patientName}
                            creatorLabel={creatorLabel}
                        />
                    ) : null}

                    {!isSimple ? (
                        <>
                            <div className="ios-list">
                                <div className="ios-row">
                                    <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_patient")}</div>
                                    <div className="appointment-drawer-meta-val">{patientName}</div>
                                </div>
                                <div className="ios-row">
                                    <div className="appointment-drawer-eyebrow">{tx("page.practice_tickets.drawer_creator")}</div>
                                    <div className="appointment-drawer-meta-val">{creatorLabel}</div>
                                </div>
                                {task.service_name || task.total_cost != null ? (
                                    <div className="ios-row">
                                        <div className="appointment-drawer-eyebrow">{t("page.practice_tickets.service_item_fallback")}</div>
                                        <div className="appointment-drawer-meta-val">
                                            {task.service_name
                                                ? clinicalServiceLabel(task.service_name)
                                                : t("page.practice_tickets.service_item_fallback")}
                                            {task.total_cost != null ? ` · ${formatCurrency(task.total_cost)}` : ""}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            <PracticeTaskPrivacy task={task} />

                            <PracticeTaskComments task={task} staff={staff} active canComment={canComment} />
                            {__CAP_MULTI_STAFF__ ? <RecordHistory table="practice_task" entityId={task.id} /> : null}

                            {canComplete ? (
                                <div className="practice-task-drawer-inline">
                                    <Input
                                        label={t("page.practice_tickets.task_note_label")}
                                        value={completeNote}
                                        onChange={(e) => setCompleteNote(e.target.value)}
                                        placeholder={t("page.practice_tickets.task_note_placeholder")}
                                    />
                                </div>
                            ) : null}

                            {showReturnForm ? (
                                <div className="practice-task-drawer-inline">
                                    <Textarea
                                        label={t("page.practice_tickets.task_return_reason")}
                                        value={returnReason}
                                        onChange={(e) => setReturnReason(e.target.value)}
                                    />
                                </div>
                            ) : null}

                            <div className="appointment-drawer-actions row">
                                {task.patient_id?.trim() ? (
                                    <button
                                        type="button"
                                        className="btn btn-subtle"
                                        onClick={() => navigate(`/patients/${task.patient_id}`)}
                                    >
                                        {t("page.practice_tickets.open_chart")}
                                    </button>
                                ) : null}
                                {onEdit ? (
                                    <button type="button" className="btn btn-subtle" onClick={onEdit}>
                                        <EditIcon size={14} />
                                        {tx("page.practice_tickets.drawer_edit")}
                                    </button>
                                ) : null}
                            </div>
                        </>
                    ) : (
                        <>
                            <PracticeTaskComments task={task} staff={staff} active canComment={canComment} />
                            <div className="appointment-drawer-actions row">
                                {task.patient_id?.trim() ? (
                                    <button
                                        type="button"
                                        className="btn btn-subtle"
                                        onClick={() => navigate(`/patients/${task.patient_id}`)}
                                    >
                                        {t("page.practice_tickets.open_chart")}
                                    </button>
                                ) : null}
                                {onEdit ? (
                                    <button type="button" className="btn btn-subtle" onClick={onEdit}>
                                        <EditIcon size={14} />
                                        {tx("page.practice_tickets.drawer_edit")}
                                    </button>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>

                {isSimple ? (
                    <div className="appointment-drawer-panel-foot">
                        <div className="appointment-drawer-footer row" style={{ flexWrap: "wrap" }}>
                            {task.kind === "APPOINTMENT" ? (
                                <button
                                    type="button"
                                    className="btn btn-accent"
                                    disabled={busy}
                                    onClick={openWeekCalendar}
                                >
                                    <CalendarIcon size={14} />
                                    {t("practice.tasks.drawer.open_calendar")}
                                </button>
                            ) : null}
                            {canMarkViewed ? (
                                <button
                                    type="button"
                                    className={task.kind === "APPOINTMENT" ? "btn btn-subtle" : "btn btn-accent"}
                                    disabled={busy}
                                    onClick={() => void applyStatus("VIEWED")}
                                >
                                    <EyeIcon size={14} />
                                    {t("practice.tasks.drawer.mark_viewed")}
                                </button>
                            ) : null}
                            {canMarkDone ? (
                                <button
                                    type="button"
                                    className={
                                        task.kind === "APPOINTMENT" || canMarkViewed
                                            ? "btn btn-subtle"
                                            : "btn btn-accent"
                                    }
                                    disabled={busy}
                                    onClick={() => void applyStatus("DONE")}
                                >
                                    <CheckIcon size={14} />
                                    {t("practice.tasks.drawer.mark_done")}
                                </button>
                            ) : null}
                        </div>
                    </div>
                ) : (
                    <div className="appointment-drawer-panel-foot">
                        <div className="appointment-drawer-footer row">
                            {canTake ? (
                                <button
                                    type="button"
                                    className="btn btn-accent"
                                    disabled={busy}
                                    onClick={() => void applyStatus("IN_PROGRESS")}
                                >
                                    {t("page.practice_tickets.task_take")}
                                </button>
                            ) : null}
                            {canComplete ? (
                                <button
                                    type="button"
                                    className="btn btn-accent"
                                    disabled={busy}
                                    onClick={() => {
                                        const note = completeNote.trim() || (task.body ?? task.title).trim();
                                        void applyStatus("DONE_RECEPTION", { doneNote: note || undefined });
                                    }}
                                >
                                    {t("page.practice_tickets.task_done")}
                                </button>
                            ) : null}
                            {canValidate ? (
                                <button
                                    type="button"
                                    className="btn btn-accent"
                                    disabled={busy}
                                    onClick={() => void applyStatus("VALIDATED")}
                                >
                                    {t("page.practice_tickets.task_validate")}
                                </button>
                            ) : null}
                            {canValidate ? (
                                showReturnForm ? (
                                    <>
                                        <button
                                            type="button"
                                            className="btn btn-subtle"
                                            disabled={busy}
                                            onClick={() => {
                                                setShowReturnForm(false);
                                                setReturnReason("");
                                            }}
                                        >
                                            {t("page.practice_tickets.cancel")}
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-subtle danger"
                                            disabled={busy || !returnReason.trim()}
                                            onClick={() => {
                                                void applyStatus("BACK", {
                                                    returnReason: returnReason.trim(),
                                                });
                                            }}
                                        >
                                            {showRezValidate
                                                ? t("page.practice_tickets.task_return_physician")
                                                : t("page.practice_tickets.task_return_send")}
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="btn btn-subtle danger"
                                        disabled={busy}
                                        onClick={() => setShowReturnForm(true)}
                                    >
                                        {showRezValidate
                                            ? t("page.practice_tickets.task_return_physician")
                                            : t("page.practice_tickets.task_return")}
                                    </button>
                                )
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}
