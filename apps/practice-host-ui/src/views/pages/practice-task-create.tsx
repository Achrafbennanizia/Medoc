import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPatients } from "@/systems/practice-host/controllers/patient.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { parseRole } from "@/lib/rbac";
import { loadTaskTeamDirectory } from "../components/practice-tasks/load-task-team";
import { createPracticeTaskAdmin } from "@/systems/practice-host/controllers/practice-task.controller";
import type { Patient, Staff } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { ChevronLeftIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "../components/administration-page-header";
import { emptyPracticeTaskForm, type PracticeTaskTaskForm } from "../components/practice-tasks/constants";
import { PracticeTaskFormFields } from "../components/practice-tasks/practice-task-form-fields";

const BACK_HREF = "/tickets?tab=verwalten";

export function PracticeTaskCreatePage() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.role ? parseRole(session.role) : null;
    const [patients, setPatients] = useState<Patient[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<PracticeTaskTaskForm>(emptyPracticeTaskForm);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const [pats, team] = await Promise.all([
                listPatients(),
                loadTaskTeamDirectory(role, session?.permission_overrides),
            ]);
            setPatients(pats);
            setStaff(team.filter((m) => m.available !== false));
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }, [role, session?.permission_overrides]);

    useEffect(() => {
        void load();
    }, [load]);

    const save = async () => {
        if (!form.title.trim()) {
            toast(t("common.title_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await createPracticeTaskAdmin({
                patientId: form.patientId.trim() || null,
                kind: form.kind,
                title: form.title.trim(),
                body: form.body.trim() || null,
                assigneeRole: form.assigneeMode === "reception" ? "RECEPTION" : null,
                assigneeUserId: form.assigneeMode === "user" ? form.assigneeUserId || null : null,
            });
            toast(t("practice.tasks.toast.created"), "success");
            navigate(BACK_HREF);
        } catch (e) {
            toast(errorMessage(e), "error");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return <PageLoading label={t("common.loading_form")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load()} />;

    return (
        <div className="practice-task-create-page practice-workspace-page practice-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("practice.tasks.create.title")}
                subtitle={t("practice.tasks.create.subtitle")}
                back={{ to: BACK_HREF, label: t("practice.tasks.title") }}
            />

            <Card className="card-elevated practice-task-create-page__card">
                <CardHeader title={t("practice.tasks.create.card_title")} />
                <div className="card-pad">
                    <PracticeTaskFormFields
                        mode="create"
                        form={form}
                        patients={patients}
                        staff={staff}
                        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    />
                    <div className="row" style={{ gap: 8, marginTop: 16 }}>
                        <Button type="button" variant="primary" disabled={busy} onClick={() => void save()}>
                            {t("practice.tasks.create.btn")}
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
