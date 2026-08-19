import { useCallback, useEffect, useMemo, useState } from "react";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { loadTaskTeamDirectory } from "./load-task-team";
import {
    countOpenPracticeTasksForMe,
    listPracticeTasksForMe,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import type { Patient, Staff } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { INBOX_POLL_MS } from "@/lib/inbox-config";
import { EmptyState } from "../ui/empty-state";
import { PageLoadError, PageLoading } from "../ui/page-status";
import { taskPatientLabel } from "./constants";
import { dispatchNavBadgeRefresh, userCanViewTask } from "./task-workflow";
import { PracticeTaskDetailDrawer } from "./practice-task-detail-drawer";
import { PracticeTaskInboxRow } from "./practice-task-inbox-row";

type Props = {
    userId: string;
    isPhysician: boolean;
    isReception: boolean;
    active: boolean;
};

export function PracticeTaskInboxPanel({ userId, isPhysician, isReception, active }: Props) {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canAdminStatus = role != null && allowed("task.status.admin", role, session?.permission_overrides);
    const canFulfillStatus = role != null && allowed("task.status.fulfill", role, session?.permission_overrides);
    const [tasks, setTasks] = useState<PracticeTask[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setErr(null);
        try {
            const [tasksList, pats, team] = await Promise.all([
                listPracticeTasksForMe(),
                listPatients(),
                loadTaskTeamDirectory(role, session?.permission_overrides),
            ]);
            setTasks(tasksList);
            setPatients(pats);
            setStaff(team);
            void countOpenPracticeTasksForMe().then((n) => dispatchNavBadgeRefresh(n));
        } catch (e) {
            setErr(errorMessage(e));
            setTasks([]);
        } finally {
            setLoading(false);
        }
    }, [role, session?.permission_overrides]);

    useEffect(() => {
        if (!active) return;
        void load();
        const id = window.setInterval(() => void load(), INBOX_POLL_MS);
        return () => window.clearInterval(id);
    }, [load, active]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const staffMap = useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff]);
    const selected = tasks.find((a) => a.id === selectedId) ?? null;

    const handleUpdated = (updated: PracticeTask) => {
        setTasks((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    };

    if (loading) return <PageLoading label={t("page.practice_tickets.loading")} />;
    if (err) return <PageLoadError message={err} onRetry={() => void load()} />;
    if (tasks.length === 0) {
        return <EmptyState icon="📬" title={t("page.practice_tickets.empty_title")} />;
    }

    return (
        <>
            <div className="practice-tasks-inbox-list">
                {tasks.map((a) => {
                    const canOpen = userCanViewTask(a, userId, { isReception });
                    return (
                        <PracticeTaskInboxRow
                            key={a.id}
                            task={a}
                            patientName={taskPatientLabel(a.patient_id, patientMap, t("common.dash"))}
                            selected={selectedId === a.id}
                            canOpen={canOpen}
                            onOpen={() => {
                                if (!canOpen) return;
                                setSelectedId(a.id);
                            }}
                        />
                    );
                })}
            </div>
            {selected && userCanViewTask(selected, userId, { isReception }) ? (
                <PracticeTaskDetailDrawer
                    task={selected}
                    patientName={taskPatientLabel(selected.patient_id, patientMap, t("common.dash"))}
                    creatorLabel={staffMap.get(selected.created_by)?.name ?? t("common.dash")}
                    staff={staff}
                    userId={userId}
                    isPhysician={isPhysician}
                    isReception={isReception}
                    canAdminStatus={canAdminStatus}
                    canFulfillStatus={canFulfillStatus}
                    onClose={() => setSelectedId(null)}
                    onUpdated={handleUpdated}
                />
            ) : null}
        </>
    );
}

export { dispatchNavBadgeRefresh };
