import { useCallback, useEffect, useMemo, useState } from "react";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { loadAufgabeTeamDirectory } from "./load-aufgabe-team";
import {
    countOpenPraxisAufgabenForMe,
    listPraxisAufgabenForMe,
    type PraxisAufgabe,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Patient, Personal } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "@/models/store/auth-store";
import { POSTEINGANG_POLL_MS } from "@/lib/posteingang-config";
import { EmptyState } from "../ui/empty-state";
import { PageLoadError, PageLoading } from "../ui/page-status";
import { aufgabePatientLabel } from "./constants";
import { dispatchNavBadgeRefresh, userCanViewAufgabe } from "./aufgabe-workflow";
import { PraxisAufgabeDetailDrawer } from "./praxis-aufgabe-detail-drawer";
import { PraxisAufgabeInboxRow } from "./praxis-aufgabe-inbox-row";

type Props = {
    userId: string;
    isArzt: boolean;
    isRezeption: boolean;
    active: boolean;
};

export function PraxisAufgabeInboxPanel({ userId, isArzt, isRezeption, active }: Props) {
    const t = useT();
    const session = useAuthStore((s) => s.session);
    const role = session?.rolle ? parseRole(session.rolle) : null;
    const canAdminStatus = role != null && allowed("aufgabe.status.admin", role, session?.permission_overrides);
    const canFulfillStatus = role != null && allowed("aufgabe.status.fulfill", role, session?.permission_overrides);
    const [aufgaben, setAufgaben] = useState<PraxisAufgabe[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setErr(null);
        try {
            const [aufgabenList, pats, team] = await Promise.all([
                listPraxisAufgabenForMe(),
                listPatienten(),
                loadAufgabeTeamDirectory(role, session?.permission_overrides),
            ]);
            setAufgaben(aufgabenList);
            setPatients(pats);
            setPersonal(team);
            void countOpenPraxisAufgabenForMe().then((n) => dispatchNavBadgeRefresh(n));
        } catch (e) {
            setErr(errorMessage(e));
            setAufgaben([]);
        } finally {
            setLoading(false);
        }
    }, [role, session?.permission_overrides]);

    useEffect(() => {
        if (!active) return;
        void load();
        const id = window.setInterval(() => void load(), POSTEINGANG_POLL_MS);
        return () => window.clearInterval(id);
    }, [load, active]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const personalMap = useMemo(() => new Map(personal.map((p) => [p.id, p])), [personal]);
    const selected = aufgaben.find((a) => a.id === selectedId) ?? null;

    const handleUpdated = (updated: PraxisAufgabe) => {
        setAufgaben((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    };

    if (loading) return <PageLoading label={t("page.praxis_tickets.loading")} />;
    if (err) return <PageLoadError message={err} onRetry={() => void load()} />;
    if (aufgaben.length === 0) {
        return <EmptyState icon="📬" title={t("page.praxis_tickets.empty_title")} />;
    }

    return (
        <>
            <div className="praxis-aufgaben-inbox-list">
                {aufgaben.map((a) => {
                    const canOpen = userCanViewAufgabe(a, userId, { isRezeption });
                    return (
                        <PraxisAufgabeInboxRow
                            key={a.id}
                            aufgabe={a}
                            patientName={aufgabePatientLabel(a.patient_id, patientMap)}
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
            {selected && userCanViewAufgabe(selected, userId, { isRezeption }) ? (
                <PraxisAufgabeDetailDrawer
                    aufgabe={selected}
                    patientName={aufgabePatientLabel(selected.patient_id, patientMap)}
                    creatorLabel={personalMap.get(selected.created_by)?.name ?? "—"}
                    personal={personal}
                    userId={userId}
                    isArzt={isArzt}
                    isRezeption={isRezeption}
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
