import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { loadTaskTeamDirectory } from "../components/practice-tasks/load-task-team";
import {
    listPracticeTasksAdmin,
    updatePracticeTaskAdmin,
    type PracticeTask,
} from "@/systems/practice-host/controllers/practice-task.controller";
import type { Patient, Staff } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { ChevronLeftIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { type PracticeTaskTaskForm } from "../components/practice-tasks/constants";
import { PracticeTaskFormFields } from "../components/practice-tasks/practice-task-form-fields";

const BACK_HREF = "/tickets?tab=verwalten";

function rowToForm(row: PracticeTask): PracticeTaskTaskForm {
    return {
        patientId: row.patient_id ?? "",
        kind: row.kind,
        title: row.title,
        body: row.body ?? "",
        assigneeMode: row.assignee_role === "RECEPTION" ? "reception" : "user",
        assigneeUserId: row.assignee_user_id ?? "",
        status: row.status,
    };
}

export function PracticeTaskEditPage() {
    const t = useT();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const canAdminStatus = role != null && allowed("task.status.admin", role, session?.permission_overrides);
    const canFulfillStatus = role != null && allowed("task.status.fulfill", role, session?.permission_overrides);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [notFound, setNotFound] = useState(false);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<PracticeTaskTaskForm | null>(null);

    const load = useCallback(async () => {
        if (!id) {
            setNotFound(true);
            setLoading(false);
            return;
        }
        setLoadError(null);
        setNotFound(false);
        try {
            const [tasks, pats, team] = await Promise.all([
                listPracticeTasksAdmin(),
                listPatients(),
                loadTaskTeamDirectory(role, session?.permission_overrides),
            ]);
            const row = tasks.find((task) => task.id === id);
            if (!row) {
                setNotFound(true);
                return;
            }
            setForm(rowToForm(row));
            setPatients(pats);
            setStaff(team.filter((m) => m.available !== false));
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [id, role, session?.permission_overrides]);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async () => {
        if (!id || !form || !form.title.trim()) {
            toast(t("common.title_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await updatePracticeTaskAdmin({
                id,
                title: form.title.trim(),
                body: form.body.trim() || null,
                kind: form.kind,
                status: form.status,
                assigneeRole: form.assigneeMode === "reception" ? "RECEPTION" : null,
                assigneeUserId: form.assigneeMode === "user" ? form.assigneeUserId || null : null,
            });
            toast(t("practice.tasks.toast.saved"), "success");
            navigate(BACK_HREF);
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <PageLoading label={t("practice.tasks.edit.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;
    if (notFound || !form) {
        return (
            <EmptyState
                title={t("practice.tasks.edit.not_found_title")}
                description={t("practice.tasks.edit.not_found_desc")}
                action={{ label: t("common.back"), onClick: () => navigate(BACK_HREF) }}
            />
        );
    }

    return (
        <div className="practice-task-edit-page practice-workspace-page practice-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("practice.tasks.edit.title")}
                subtitle={form.title}
                back={{ to: BACK_HREF, label: t("practice.tasks.title") }}
            />

            <Card className="card-elevated practice-task-edit-page__card">
                <CardHeader title={t("practice.tasks.create.card_title")} />
                <div className="card-pad">
                    <PracticeTaskFormFields
                        mode="edit"
                        form={form}
                        patients={patients}
                        staff={staff}
                        canAdminStatus={canAdminStatus}
                        canFulfillStatus={canFulfillStatus}
                        onChange={(patch) => setForm((f) => (f ? { ...f, ...patch } : f))}
                    />
                    <div className="row" style={{ gap: 8, marginTop: 16 }}>
                        <Button type="button" variant="primary" disabled={busy} onClick={() => void save()}>
                            {t("common.save")}
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy} className="btn-nav-back" onClick={() => navigate(BACK_HREF)}>
                            <ChevronLeftIcon size={16} />
                            {t("common.cancel")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
