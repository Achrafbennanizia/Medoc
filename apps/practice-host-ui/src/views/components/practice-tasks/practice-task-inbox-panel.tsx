import { useCallback, useEffect, useMemo, useState } from "react";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";
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
import {
    practiceTaskMatchesInboxKind,
    practiceTaskMatchesInboxView,
    type PracticeTaskInboxView,
} from "@/lib/practice-task-display";
import { EmptyState } from "../ui/empty-state";
import { PageLoadError, PageLoading } from "../ui/page-status";
import { Select } from "../ui/input";
import { PRACTICE_TASK_KINDS, taskPatientLabel } from "./constants";
import { dispatchNavBadgeRefresh } from "./task-workflow";
import { PracticeTaskDetailDrawer } from "./practice-task-detail-drawer";
import { PracticeTaskInboxRow } from "./practice-task-inbox-row";
import { mergeUpdatedTask, sortTasksByFlow, taskBelongsInInbox } from "./task-flow";

type Props = {
    userId: string;
    isPhysician: boolean;
    isReception: boolean;
    active: boolean;
};

const INBOX_VIEWS: readonly { value: PracticeTaskInboxView; labelKey: string }[] = [
    { value: "all", labelKey: "practice.tasks.inbox.filter.view_all" },
    { value: "open", labelKey: "practice.tasks.inbox.filter.view_open" },
    { value: "done", labelKey: "practice.tasks.inbox.filter.view_done" },
    { value: "verify", labelKey: "practice.tasks.inbox.filter.view_verify" },
];

export function PracticeTaskInboxPanel({ userId, isPhysician, isReception, active }: Props) {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canAdminStatus = role != null && allowed("task.status.admin", role, session?.permission_overrides);
    const canFulfillStatus = role != null && allowed("task.status.fulfill", role, session?.permission_overrides);
    const [tasks, setTasks] = useState<PracticeTask[]>(() => readListSnapshot<PracticeTask[]>("practice-tasks-inbox") ?? []);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(() => readListSnapshot<PracticeTask[]>("practice-tasks-inbox") === undefined);
    const [err, setErr] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [filterKind, setFilterKind] = useState("");
    const [filterView, setFilterView] = useState<PracticeTaskInboxView>("all");

    useEffect(() => {
        if (!active) return;
        try {
            const taskId = new URLSearchParams(window.location.search).get("task");
            if (taskId?.trim()) setSelectedId(taskId.trim());
        } catch {
            /* ignore */
        }
    }, [active]);

    const load = useCallback(async () => {
        setErr(null);
        try {
            const tasksList = await listPracticeTasksForMe();
            const patientIds = [...new Set(tasksList.map((task) => task.patient_id).filter((id): id is string => Boolean(id)))];
            const [pats, team] = await Promise.all([
                patientIds.length > 0 ? listPatientsByIds(patientIds) : Promise.resolve([] as Patient[]),
                loadTaskTeamDirectory(role, session?.permission_overrides),
            ]);
            setTasks(sortTasksByFlow(tasksList.filter(taskBelongsInInbox)));
            writeListSnapshot("practice-tasks-inbox", tasksList);
            setPatients(pats);
            setStaff(team);
            void countOpenPracticeTasksForMe().then((n) => dispatchNavBadgeRefresh(n));
        } catch (e) {
            setErr(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [role, session]);

    useEffect(() => {
        if (!active) return;
        void load();
        const id = window.setInterval(() => void load(), INBOX_POLL_MS);
        return () => window.clearInterval(id);
    }, [load, active]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const staffMap = useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff]);

    const filtered = useMemo(
        () =>
            tasks.filter(
                (row) =>
                    practiceTaskMatchesInboxKind(row.kind, filterKind) &&
                    practiceTaskMatchesInboxView(row.status, filterView),
            ),
        [tasks, filterKind, filterView],
    );

    const selected = filtered.find((a) => a.id === selectedId) ?? tasks.find((a) => a.id === selectedId) ?? null;

    const handleUpdated = (updated: PracticeTask) => {
        setTasks((prev) => mergeUpdatedTask(prev, updated, taskBelongsInInbox));
        if (!taskBelongsInInbox(updated)) setSelectedId(null);
        void countOpenPracticeTasksForMe().then((n) => dispatchNavBadgeRefresh(n));
    };

    if (loading && tasks.length === 0) return <PageLoading label={t("page.practice_tickets.loading")} />;
    if (err && tasks.length === 0) return <PageLoadError message={err} onRetry={() => void load()} />;
    if (tasks.length === 0) {
        return <EmptyState icon="📬" title={t("page.practice_tickets.empty_title")} />;
    }

    return (
        <>
            <div className="page-toolbar practice-task-inbox-toolbar">
                <div className="page-toolbar__filters tasks-toolbar-filters">
                    <Select
                        id="inbox-filter-kind"
                        aria-label={t("practice.tasks.inbox.filter.type_aria")}
                        value={filterKind}
                        onChange={(e) => setFilterKind(e.target.value)}
                        options={[
                            { value: "", label: t("practice.tasks.inbox.filter.all_types") },
                            ...PRACTICE_TASK_KINDS.map((row) => ({
                                value: row.value,
                                label: t(`practice.tasks.kind.${row.value.toLowerCase()}`),
                            })),
                        ]}
                    />
                    <Select
                        id="inbox-filter-view"
                        aria-label={t("practice.tasks.inbox.filter.view_aria")}
                        value={filterView}
                        onChange={(e) => setFilterView(e.target.value as PracticeTaskInboxView)}
                        options={INBOX_VIEWS.map((row) => ({
                            value: row.value,
                            label: t(row.labelKey),
                        }))}
                    />
                </div>
            </div>
            {filtered.length === 0 ? (
                <EmptyState icon="🔎" title={t("practice.tasks.inbox.filter.empty")} />
            ) : (
                <div className="practice-tasks-inbox-list">
                    {filtered.map((a) => (
                        <PracticeTaskInboxRow
                            key={a.id}
                            task={a}
                            patientName={taskPatientLabel(a.patient_id, patientMap, t("common.dash"))}
                            selected={selectedId === a.id}
                            canOpen
                            onOpen={() => setSelectedId(a.id)}
                        />
                    ))}
                </div>
            )}
            {selected ? (
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

export { dispatchNavBadgeRefresh }; // eslint-disable-line react-refresh/only-export-components -- shared badge helper
