import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { forwardChartToPhysicians } from "@/systems/practice-host/controllers/chart-workflow.controller";
import {
    createPracticeTask,
    type PracticeTaskKind,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { listPhysicians, listStaff, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { errorMessage } from "@/lib/utils";
import { CANONICAL_TICKET_TITLE_EN } from "@/lib/practice-task-display";
import type { Role } from "@/lib/rbac";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { DOCTOR_CONTEXT } from "@/lib/doctor-context";
import { Select, Textarea } from "./ui/input";

export type PatientChartWorkflowMode = "ticket" | "forward" | "task" | null;

const TASK_KIND_KEYS = [
    "BILLING",
    "APPOINTMENT",
    "PRINT",
    "MASTER_DATA",
    "OTHER",
] as const satisfies readonly PracticeTaskKind[];

type ToastFn = (message: string, variant?: "info" | "error" | "success") => void;

export function PatientChartWorkflowDialogs(props: {
    mode: PatientChartWorkflowMode;
    onClose: () => void;
    patientId: string;
    currentUserId: string;
    role: Role;
    toast: ToastFn;
}) {
    const t = useT();
    const { mode, onClose, patientId, currentUserId, role, toast } = props;
    const [physicians, setPhysicians] = useState<PhysicianSummary[]>([]);
    const [loadErr, setLoadErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [ticketPhysicianId, setTicketPhysicianId] = useState("");
    const [ticketBody, setTicketBody] = useState("");

    const [forwardIds, setForwardIds] = useState<Record<string, boolean>>({});
    const [forwardNote, setForwardNote] = useState("");

    const [taskKind, setTaskKind] = useState<PracticeTaskKind>("OTHER");
    const [taskTitle, setTaskTitle] = useState("");
    const [taskBody, setTaskBody] = useState("");
    const [taskRezId, setTaskRezId] = useState("");
    const [reception, setReception] = useState<{ id: string; name: string }[]>([]);

    const loadPhysicians = useCallback(async () => {
        setLoadErr(null);
        try {
            const [list, staff] = await Promise.all([listPhysicians(), listStaff()]);
            setPhysicians(list);
            const rezList = staff
                .filter((p) => p.role === "RECEPTION")
                .map((p) => ({ id: p.id, name: p.name }));
            setReception(rezList);
            if (list.length > 0) {
                setTicketPhysicianId((prev) => (list.some((a) => a.id === prev) ? prev : list[0]!.id));
            }
            // Single-doctor editions: forwarding goes to the practice's dentist, no choice to make.
            if (!DOCTOR_CONTEXT.showDoctorUi) {
                setForwardIds(Object.fromEntries(list.filter((a) => a.id !== currentUserId).map((a) => [a.id, true])));
            }
            if (rezList.length > 0) {
                setTaskRezId((prev) => (rezList.some((r) => r.id === prev) ? prev : rezList[0]!.id));
            } else {
                setTaskRezId("");
            }
        } catch (e) {
            setLoadErr(errorMessage(e));
            setPhysicians([]);
            setReception([]);
        }
    }, [currentUserId]);

    useEffect(() => {
        if (!mode) return;
        void loadPhysicians();
        setTicketBody("");
        setForwardNote("");
        setForwardIds({});
        setTaskKind("OTHER");
        setTaskTitle("");
        setTaskBody("");
        setTaskRezId("");
    }, [mode, loadPhysicians]);

    const submitTicket = async () => {
        const body = ticketBody.trim();
        if (!ticketPhysicianId || !body) {
            toast(t("patient.chart.workflow.fill_doctor_message"), "error");
            return;
        }
        setBusy(true);
        try {
            // Title is the kind label (English canonical); message lives only in body.
            await createPracticeTask({
                patientId,
                kind: "TICKET",
                title: CANONICAL_TICKET_TITLE_EN,
                body,
                assigneeUserId: ticketPhysicianId,
            });
            toast(t("patient.chart.workflow.ticket_created"), "success");
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const submitTask = async () => {
        const title = taskTitle.trim();
        if (!title) {
            toast(t("patient.chart.workflow.fill_title"), "error");
            return;
        }
        setBusy(true);
        try {
            await createPracticeTask({
                patientId,
                kind: taskKind,
                title,
                body: taskBody.trim() || null,
                assigneeUserId: taskRezId.trim() || null,
                assigneeRole: taskRezId.trim() ? null : "RECEPTION",
            });
            toast(
                taskRezId.trim()
                    ? t("patient.chart.workflow.task_private_sent")
                    : t("patient.chart.workflow.task_pool_created"),
                "success",
            );
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    const submitForward = async () => {
        const ids = Object.entries(forwardIds)
            .filter(([, on]) => on)
            .map(([id]) => id)
            .filter((id) => id && id !== currentUserId);
        if (ids.length === 0) {
            toast(t("patient.chart.workflow.pick_doctor"), "error");
            return;
        }
        setBusy(true);
        try {
            await forwardChartToPhysicians({
                patientId,
                physicianIds: ids,
                message: forwardNote.trim() || null,
            });
            toast(t("patient.chart.workflow.review_requested"), "success");
            onClose();
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (mode === "ticket" && role !== "RECEPTION") return null;
    if (mode === "task" && role !== "PHYSICIAN") return null;
    if (mode === "forward" && role !== "PHYSICIAN" && role !== "RECEPTION") return null;

    return (
        <>
            <Dialog
                open={mode === "ticket"}
                onClose={onClose}
                title={t("patient.chart.workflow.ticket_title")}
                className="modal--form"
                footer={(
                    <>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitTicket()} disabled={busy || !!loadErr}>
                            {busy ? t("common.sending") : t("common.send")}
                        </Button>
                    </>
                )}
            >
                <div className="chart-workflow-form">
                    {loadErr ? <p className="chart-workflow-form__hint" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                    {DOCTOR_CONTEXT.showDoctorUi ? <Select
                        label={t("patient.chart.workflow.recipient")}
                        value={ticketPhysicianId}
                        onChange={(e) => setTicketPhysicianId(e.target.value)}
                        disabled={physicians.length === 0}
                        options={physicians.map((a) => ({ value: a.id, label: a.name }))}
                        menuPortal
                    /> : null}
                    <Textarea
                        label={t("patient.chart.workflow.message")}
                        rows={4}
                        value={ticketBody}
                        onChange={(e) => setTicketBody(e.target.value)}
                        placeholder={t("patient.chart.workflow.message_ph")}
                    />
                    <p className="chart-workflow-form__hint">
                        {t("patient.chart.workflow.message_private")}
                    </p>
                </div>
            </Dialog>

            <Dialog
                open={mode === "task"}
                onClose={onClose}
                title={t("patient.chart.workflow.task_title")}
                className="modal--form"
                footer={(
                    <>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitTask()} disabled={busy}>
                            {busy ? t("common.sending") : t("common.create_task")}
                        </Button>
                    </>
                )}
            >
                <div className="chart-workflow-form">
                    <p className="chart-workflow-form__hint">
                        {t("patient.chart.workflow.pool_hint")}
                    </p>
                    <Select
                        label={t("patient.chart.workflow.recipient")}
                        value={taskRezId || "__pool__"}
                        onChange={(e) => setTaskRezId(e.target.value === "__pool__" ? "" : e.target.value)}
                        options={[
                            { value: "__pool__", label: t("patient.chart.workflow.task_pool") },
                            ...reception.map((r) => ({ value: r.id, label: r.name })),
                        ]}
                        menuPortal
                    />
                    <Select
                        label={t("common.type")}
                        value={taskKind}
                        onChange={(e) => setTaskKind(e.target.value as PracticeTaskKind)}
                        options={TASK_KIND_KEYS.map((value) => ({
                            value,
                            label: t(`patient.chart.workflow.task_kind.${value.toLowerCase()}`),
                        }))}
                        menuPortal
                    />
                    <label className="ui-field-wrap">
                        <span className="ui-field-label">{t("common.title_field")} *</span>
                        <input
                            className="input-edit"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder={t("patient.chart.workflow.subject_ph")}
                        />
                    </label>
                    <Textarea
                        label={t("common.description")}
                        rows={3}
                        value={taskBody}
                        onChange={(e) => setTaskBody(e.target.value)}
                    />
                </div>
            </Dialog>

            <Dialog
                open={mode === "forward"}
                onClose={onClose}
                title={t("patient.chart.workflow.forward_title")}
                className="modal--form"
                footer={(
                    <>
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitForward()} disabled={busy || !!loadErr}>
                            {busy ? t("common.sending") : t("common.notify")}
                        </Button>
                    </>
                )}
            >
                <div className="chart-workflow-form">
                    {loadErr ? <p className="chart-workflow-form__hint" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                    <p className="chart-workflow-form__hint">
                        {t("patient.chart.workflow.forward_hint")}
                    </p>
                    <div className="stack" style={{ gap: "var(--space-2)" }} hidden={!DOCTOR_CONTEXT.showDoctorUi}>
                        {physicians
                            .filter((a) => a.id !== currentUserId)
                            .map((a) => (
                                <label key={a.id} className="row" style={{ gap: "var(--space-2)", alignItems: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(forwardIds[a.id])}
                                        onChange={(e) => setForwardIds((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                                    />
                                    <span>{a.name}</span>
                                </label>
                            ))}
                    </div>
                    <Textarea
                        label={t("patient.chart.workflow.forward_note")}
                        rows={3}
                        value={forwardNote}
                        onChange={(e) => setForwardNote(e.target.value)}
                    />
                </div>
            </Dialog>
        </>
    );
}
