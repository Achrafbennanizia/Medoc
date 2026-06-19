import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { parseRole } from "@/lib/rbac";
import { loadAufgabeTeamDirectory } from "../components/praxis-aufgaben/load-aufgabe-team";
import { createPraxisAufgabeAdmin } from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Patient, Personal } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { ChevronLeftIcon } from "@/lib/icons";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";
import { emptyPraxisAufgabeForm, type PraxisAufgabeTaskForm } from "../components/praxis-aufgaben/constants";
import { PraxisAufgabeFormFields } from "../components/praxis-aufgaben/praxis-aufgabe-form-fields";

const BACK_HREF = "/tickets?tab=verwalten";

export function PraxisAufgabeCreatePage() {
    const t = useT();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const [patients, setPatients] = useState<Patient[]>([]);
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState<PraxisAufgabeTaskForm>(emptyPraxisAufgabeForm);

    const load = useCallback(async () => {
        setLoadError(null);
        try {
            const [pats, team] = await Promise.all([
                listPatienten(),
                loadAufgabeTeamDirectory(role, session?.permission_overrides),
            ]);
            setPatients(pats);
            setPersonal(team.filter((m) => m.verfuegbar !== false));
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
        if (!form.titel.trim()) {
            toast(t("common.title_required"), "error");
            return;
        }
        setBusy(true);
        try {
            await createPraxisAufgabeAdmin({
                patientId: form.patientId.trim() || null,
                typ: form.typ,
                titel: form.titel.trim(),
                body: form.body.trim() || null,
                assigneeRole: form.assigneeMode === "rezeption" ? "REZEPTION" : null,
                assigneeUserId: form.assigneeMode === "user" ? form.assigneeUserId || null : null,
            });
            toast(t("praxis.aufgaben.toast.created"), "success");
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
        <div className="praxis-aufgabe-create-page praxis-workspace-page praxis-workspace-page--form animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                titleLevel="h1"
                title={t("praxis.aufgaben.create.title")}
                subtitle={t("praxis.aufgaben.create.subtitle")}
                back={{ to: BACK_HREF, label: t("praxis.aufgaben.title") }}
            />

            <Card className="card-elevated praxis-aufgabe-create-page__card">
                <CardHeader title={t("praxis.aufgaben.create.card_title")} />
                <div className="card-pad">
                    <PraxisAufgabeFormFields
                        mode="create"
                        form={form}
                        patients={patients}
                        personal={personal}
                        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
                    />
                    <div className="row" style={{ gap: 8, marginTop: 16 }}>
                        <Button type="button" variant="primary" disabled={busy} onClick={() => void save()}>
                            {t("praxis.aufgaben.create.btn")}
                        </Button>
                        <Button type="button" variant="ghost" disabled={busy} onClick={() => navigate(BACK_HREF)}>
                            <ChevronLeftIcon size={16} />
                            {t("common.cancel")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
