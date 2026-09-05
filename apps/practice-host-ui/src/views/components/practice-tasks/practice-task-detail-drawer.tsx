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
    transitionPracticeTask,
    updatePracticeTaskAdmin,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { errorMessage } from "@/lib/utils";
import { useDateFnsLocale, useT } from "@/lib/i18n";
import {
    BoltIcon,
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
import {
    TASK_WORKFLOW_STEPS,
    taskDrawerText,
    taskStatusLabel,
    taskStatusPillClass,
    taskKindLabel,
    taskWorkflowActiveStep,
    taskWorkflowStepLabel,
} from "./task-workflow-ui";
import { PracticeTaskComments } from "./practice-task-comments";

const WORKFLOW_ICONS = [CheckIcon, BoltIcon, EyeIcon, ShieldCheckIcon] as const;

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

    const showRezFulfill = isReception && canFulfillAsReception(task, userId);
    const showPhysicianFulfill = isPhysician && canFulfillAsPhysician(task, userId);
    const showPhysicianValidate = isPhysician && canValidateAsPhysician(task, userId);
    const showRezValidate = isReception && canValidateAsReception(task, userId);
    const canFulfillWorkflow =
        canAdminStatus || canFulfillStatus || showRezFulfill || showPhysicianFulfill;
    const canTake =
        canFulfillWorkflow &&
        (task.status === "OPEN" || (canAdminStatus && task.status === "BACK"));
    const canComplete =
        canFulfillWorkflow &&
        (task.status === "IN_PROGRESS" ||
            task.status === "BACK" ||
            (canAdminStatus && task.status === "OPEN"));
    const canValidate = showPhysicianValidate || showRezValidate;
    const active = taskWorkflowActiveStep(task.status);
    const canComment = canAdmin || userCanViewTask(task, userId, { isReception });

    const canClickWorkflowStep = (stepIndex: number): boolean => {
        const target = TASK_WORKFLOW_STEPS[stepIndex]?.status;
        if (!target || target === task.status) return false;
        if (canAdminStatus) return true;
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
            if (status === "BACK" || status === "DONE_RECEPTION") {
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
        const target = TASK_WORKFLOW_STEPS[stepIndex]?.status;
        if (!target || target === task.status) return;
        if (canAdminStatus) {
            void applyStatus(target);
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
                        <h2 id={titleId} className="appointment-drawer-title">
                            {task.title}
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
                        <div className="appointment-workflow-simple">
                            {TASK_WORKFLOW_STEPS.map((step, i) => {
                                const Icon = WORKFLOW_ICONS[i] ?? CheckIcon;
                                const isNext =
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
                                    {task.service_name ?? t("page.practice_tickets.service_item_fallback")}
                                    {task.total_cost != null ? ` · ${task.total_cost.toFixed(2)} €` : ""}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    <PracticeTaskComments task={task} staff={staff} active canComment={canComment} />

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
                </div>

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
            </div>
        </div>
    );

    return createPortal(layer, document.body);
}