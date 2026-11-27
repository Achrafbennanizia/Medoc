import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPatientsByIds } from "@/systems/practice-host/controllers/patient.controller";
import { readListSnapshot, writeListSnapshot } from "@/lib/list-snapshot";
import { INBOX_POLL_MS } from "@/lib/inbox-config";
import { loadTaskTeamDirectory } from "./load-task-team";
import {
    listPracticeTasksAdmin,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import type { Patient, Staff } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Input, Select } from "../ui/input";
import { PageLoadError, PageLoading } from "../ui/page-status";
import { FilterIcon, PlusIcon, SearchIcon } from "@/lib/icons";
import { taskPatientLabel, PRACTICE_TASK_STATUSES, PRACTICE_TASK_KINDS } from "./constants";
import { PracticeTaskAdminGrid } from "./practice-task-admin-grid";
import { TaskDoctorFilter, TaskHiddenDoctorsNote } from "./practice-task-doctor";
import { useDoctorList } from "../use-doctor-list";
import { mergeUpdatedTask, sortTasksByFlow } from "./task-flow";
import { PracticeTaskDetailDrawer } from "./practice-task-detail-drawer";
import { WorkspacePageHeader } from "../administration-page-header";

type Props = {
    embedded?: boolean;
    backHref?: string;
};

const CREATE_HREF = "/tickets/new";

export function PracticeTaskAdminPanel({ embedded = false, backHref = "/administration" }: Props) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const userId = session?.user_id ?? "";
    const parsedRole = session?.role ? parseRole(session.role) : null;
    const role = session?.role ?? "";
    const canAdminStatus =
        parsedRole != null && allowed("task.status.admin", parsedRole, session?.permission_overrides);
    const canFulfillStatus =
        parsedRole != null && allowed("task.status.fulfill", parsedRole, session?.permission_overrides);
    const [rows, setRows] = useState<PracticeTask[]>(() => readListSnapshot<PracticeTask[]>("practice-tasks-admin") ?? []);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(() => readListSnapshot<PracticeTask[]>("practice-tasks-admin") === undefined);
    const [err, setErr] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterKind, setFilterKind] = useState("");
    const [filterDoctor, setFilterDoctor] = useState("");
    const [hiddenDoctors, setHiddenDoctors] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const taskDoctors = useDoctorList();

    const load = useCallback(async () => {
        setErr(null);
        try {
            const resp = await listPracticeTasksAdmin(filterDoctor || undefined);
            const tasks = resp.items;
            const patientIds = [...new Set(tasks.map((task) => task.patient_id).filter((id): id is string => Boolean(id)))];
            const [pats, team] = await Promise.all([
                patientIds.length > 0 ? listPatientsByIds(patientIds) : Promise.resolve([] as Patient[]),
                loadTaskTeamDirectory(parsedRole, session?.permission_overrides),
            ]);
            setRows(sortTasksByFlow(tasks));
            setHiddenDoctors(resp.hiddenDoctors ?? []);
            writeListSnapshot("practice-tasks-admin", tasks);
            setPatients(pats);
            setStaff(team.filter((m) => m.available !== false));
        } catch (e) {
            setErr(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [parsedRole, session, filterDoctor]);

    useEffect(() => {
        void load();
        const id = window.setInterval(() => void load(), INBOX_POLL_MS);
        return () => window.clearInterval(id);
    }, [load]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const staffMap = useMemo(() => new Map(staff.map((p) => [p.id, p])), [staff]);
    const selected = rows.find((r) => r.id === selectedId) ?? null;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filterStatus && r.status !== filterStatus) return false;
            if (filterKind && r.kind !== filterKind) return false;
            if (!q) return true;
            const hay = [
                r.title,
                r.body ?? "",
                r.kind,
                r.status,
                taskPatientLabel(r.patient_id, patientMap, t("common.dash")),
            ]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, search, filterStatus, filterKind, patientMap, t]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { "": rows.length };
        for (const s of PRACTICE_TASK_STATUSES) {
            counts[s.value] = rows.filter((r) => r.status === s.value).length;
        }
        return counts;
    }, [rows]);

    const handleUpdated = (updated: PracticeTask) => {
        setRows((prev) => mergeUpdatedTask(prev, updated));
    };

    if (loading && rows.length === 0) return <PageLoading label={t("practice.tasks.admin.loading")} />;
    if (err && rows.length === 0) return <PageLoadError message={err} onRetry={() => void load()} />;

    return (
        <div
            className={[
                "page-administration-tasks",
                embedded ? "page-administration-tasks--embedded" : "page",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {!embedded ? (
                <WorkspacePageHeader
                    titleLevel="h1"
                    title={t("practice.tasks.title")}
                    subtitle={t("practice.tasks.subtitle")}
                    back={{
                        to: backHref,
                        label: backHref === "/tickets" ? t("nav.practice_tickets") : t("nav.administration"),
                    }}
                    actions={
                        <Button type="button" variant="primary" onClick={() => navigate(CREATE_HREF)}>
                            <PlusIcon size={16} />
                            {t("breadcrumb.new_task")}
                        </Button>
                    }
                />
            ) : null}

            <div className="page-toolbar practice-task-admin-toolbar">
                <div className="page-toolbar__search practice-task-admin-toolbar__search">
                    <SearchIcon size={16} aria-hidden />
                    <Input
                        id="tasks-search"
                        placeholder={t("practice.tasks.admin.search_ph")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label={t("practice.tasks.admin.search_aria")}
                    />
                </div>
                <div className="page-toolbar__filters tasks-toolbar-filters">
                    <Select
                        id="tasks-filter-status"
                        aria-label={t("practice.tasks.admin.filter_status_aria")}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        disabled={rows.length === 0}
                        options={[
                            { value: "", label: tp("practice.tasks.admin.all_status", { count: statusCounts[""] ?? 0 }) },
                            ...PRACTICE_TASK_STATUSES.map((s) => ({
                                value: s.value,
                                label: `${t(`practice.tasks.status.${s.value.toLowerCase()}`)} (${statusCounts[s.value] ?? 0})`,
                            })),
                        ]}
                    />
                    <Select
                        id="tasks-filter-kind"
                        aria-label={t("practice.tasks.admin.filter_type_aria")}
                        value={filterKind}
                        onChange={(e) => setFilterKind(e.target.value)}
                        disabled={rows.length === 0}
                        options={[
                            { value: "", label: t("practice.tasks.admin.all_types") },
                            ...PRACTICE_TASK_KINDS.map((row) => ({
                                value: row.value,
                                label: t(`practice.tasks.kind.${row.value.toLowerCase()}`),
                            })),
                        ]}
                    />
                    <TaskDoctorFilter td={taskDoctors} value={filterDoctor} onChange={setFilterDoctor} hidden={hiddenDoctors} />
                </div>
                {(rows.length > 0 || filterDoctor) && (search || filterStatus || filterKind || filterDoctor) ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearch("");
                            setFilterStatus("");
                            setFilterKind("");
                            setFilterDoctor("");
                        }}
                    >
                        {t("common.reset")}
                    </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={() => void load()} title={t("common.refresh")}>
                    <FilterIcon size={16} />
                    {t("common.refresh")}
                </Button>
                {embedded ? (
                    <Button type="button" variant="primary" onClick={() => navigate(CREATE_HREF)}>
                        <PlusIcon size={16} />
                        {t("breadcrumb.new_task")}
                    </Button>
                ) : null}
            </div>

            <TaskHiddenDoctorsNote td={taskDoctors} ids={hiddenDoctors} />
            {filtered.length === 0 ? (
                <EmptyState
                    title={t("practice.tasks.empty")}
                    description={
                        rows.length === 0 && !filterDoctor
                            ? t("practice.tasks.admin.create_first")
                            : t("practice.tasks.admin.no_results")
                    }
                    action={
                        rows.length === 0 && !filterDoctor
                            ? { label: t("practice.tasks.admin.create_new"), onClick: () => navigate(CREATE_HREF) }
                            : undefined
                    }
                />
            ) : (
                <PracticeTaskAdminGrid
                    rows={filtered}
                    patientMap={patientMap}
                    staff={staff}
                    userId={userId}
                    isReception={role === "RECEPTION"}
                    canAdmin
                    compact={embedded}
                    doctors={taskDoctors}
                    onOpen={(row) => setSelectedId(row.id)}
                    onEdit={(row) => navigate(`/tickets/${row.id}/edit`)}
                />
            )}
            {selected ? (
                <PracticeTaskDetailDrawer
                    task={selected}
                    patientName={taskPatientLabel(selected.patient_id, patientMap, t("common.dash"))}
                    creatorLabel={staffMap.get(selected.created_by)?.name ?? t("common.dash")}
                    staff={staff}
                    userId={userId}
                    isPhysician={role === "PHYSICIAN"}
                    isReception={role === "RECEPTION"}
                    canAdmin
                    canAdminStatus={canAdminStatus}
                    canFulfillStatus={canFulfillStatus}
                    onClose={() => setSelectedId(null)}
                    onUpdated={handleUpdated}
                    onEdit={() => navigate(`/tickets/${selected.id}/edit`)}
                />
            ) : null}
        </div>
    );
}
