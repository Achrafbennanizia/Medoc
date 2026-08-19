import { useT } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import { forwardChartToPhysicians } from "@/systems/practice-host/controllers/chart-workflow.controller";
import {
    createPracticeTask,
    type PracticeTaskKind,
} from "@/systems/practice-host/controllers/practice-task.controller";
import { listPhysicians, listStaff, type PhysicianSummary } from "@/systems/practice-host/controllers/staff.controller";
import { errorMessage } from "@/lib/utils";
import type { Role } from "@/lib/rbac";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
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
    }, []);

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
            const title = body.length > 80 ? `${body.slice(0, 77)}…` : body;
            await createPracticeTask({
                patientId,
                kind: "OTHER",
                title,
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
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitTicket()} disabled={busy || !!loadErr}>
                            {busy ? t("common.sending") : t("common.send")}
                        </Button>
                    </div>
                )}
            >
                {loadErr ? <p className="page-sub" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("patient.chart.workflow.recipient")}</span>
                        <Select
                            value={ticketPhysicianId}
                            onChange={(e) => setTicketPhysicianId(e.target.value)}
                            disabled={physicians.length === 0}
                            options={physicians.map((a) => ({ value: a.id, label: a.name }))}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("patient.chart.workflow.message")}</span>
                        <Textarea
                            rows={4}
                            value={ticketBody}
                            onChange={(e) => setTicketBody(e.target.value)}
                            placeholder={t("patient.chart.workflow.message_ph")}
                        />
                    </label>
                    <p className="page-sub" style={{ margin: 0 }}>
                        {t("patient.chart.workflow.message_private")}
                    </p>
                </div>
            </Dialog>

            <Dialog
                open={mode === "task"}
                onClose={onClose}
                title={t("patient.chart.workflow.task_title")}
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitTask()} disabled={busy}>
                            {busy ? t("common.sending") : t("common.create_task")}
                        </Button>
                    </div>
                )}
            >
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p className="page-sub" style={{ margin: 0 }}>
                        {t("patient.chart.workflow.pool_hint")}
                    </p>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("patient.chart.workflow.recipient")}</span>
                        <Select
                            value={taskRezId || "__pool__"}
                            onChange={(e) => setTaskRezId(e.target.value === "__pool__" ? "" : e.target.value)}
                            options={[
                                { value: "__pool__", label: t("patient.chart.workflow.task_pool") },
                                ...reception.map((r) => ({ value: r.id, label: r.name })),
                            ]}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("common.type")}</span>
                        <Select
                            value={taskKind}
                            onChange={(e) => setTaskKind(e.target.value as PracticeTaskKind)}
                            options={TASK_KIND_KEYS.map((value) => ({
                                value,
                                label: t(`patient.chart.workflow.task_kind.${value.toLowerCase()}`),
                            }))}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("common.title_field")} *</span>
                        <input
                            className="input"
                            value={taskTitle}
                            onChange={(e) => setTaskTitle(e.target.value)}
                            placeholder={t("patient.chart.workflow.subject_ph")}
                        />
                    </label>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("common.description")}</span>
                        <Textarea
                            rows={3}
                            value={taskBody}
                            onChange={(e) => setTaskBody(e.target.value)}
                        />
                    </label>
                </div>
            </Dialog>

            <Dialog
                open={mode === "forward"}
                onClose={onClose}
                title={t("patient.chart.workflow.forward_title")}
                footer={(
                    <div className="modal-actions">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" variant="primary" onClick={() => void submitForward()} disabled={busy || !!loadErr}>
                            {busy ? t("common.sending") : t("common.notify")}
                        </Button>
                    </div>
                )}
            >
                {loadErr ? <p className="page-sub" style={{ color: "var(--danger)" }}>{loadErr}</p> : null}
                <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <p className="page-sub" style={{ margin: 0 }}>
                        {t("patient.chart.workflow.forward_hint")}
                    </p>
                    <div className="stack" style={{ gap: 8 }}>
                        {physicians
                            .filter((a) => a.id !== currentUserId)
                            .map((a) => (
                                <label key={a.id} className="row" style={{ gap: 8, alignItems: "center" }}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(forwardIds[a.id])}
                                        onChange={(e) => setForwardIds((prev) => ({ ...prev, [a.id]: e.target.checked }))}
                                    />
                                    <span>{a.name}</span>
                                </label>
                            ))}
                    </div>
                    <label className="stack" style={{ gap: 6 }}>
                        <span className="text-sm text-muted">{t("patient.chart.workflow.forward_note")}</span>
                        <Textarea rows={3} value={forwardNote} onChange={(e) => setForwardNote(e.target.value)} />
                    </label>
                </div>
            </Dialog>
        </>
    );
}
