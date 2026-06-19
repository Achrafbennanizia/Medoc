import { useT, useTParams } from "@/lib/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPatienten } from "@/systems/practice-host/controllers/patient.controller";
import { loadAufgabeTeamDirectory } from "./load-aufgabe-team";
import {
    listPraxisAufgabenAdmin,
    type PraxisAufgabe,
} from "@/systems/practice-host/controllers/praxis-aufgabe.controller";
import type { Patient, Personal } from "@/models/types";
import { errorMessage } from "@/lib/utils";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { Input, Select } from "../ui/input";
import { PageLoadError, PageLoading } from "../ui/page-status";
import { FilterIcon, PlusIcon, SearchIcon } from "@/lib/icons";
import { aufgabePatientLabel, PRAXIS_AUFGABE_STATUSES, PRAXIS_AUFGABE_TYPS } from "./constants";
import { PraxisAufgabeAdminGrid } from "./praxis-aufgabe-admin-grid";
import { PraxisAufgabeDetailDrawer } from "./praxis-aufgabe-detail-drawer";
import { WorkspacePageHeader } from "../verwaltung-page-header";

type Props = {
    embedded?: boolean;
    backHref?: string;
};

const CREATE_HREF = "/tickets/neu";

export function PraxisAufgabeAdminPanel({ embedded = false, backHref = "/verwaltung" }: Props) {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const session = useAuthStore((s) => s.session);
    const userId = session?.user_id ?? "";
    const parsedRole = session?.rolle ? parseRole(session.rolle) : null;
    const role = session?.rolle ?? "";
    const canAdminStatus =
        parsedRole != null && allowed("aufgabe.status.admin", parsedRole, session?.permission_overrides);
    const canFulfillStatus =
        parsedRole != null && allowed("aufgabe.status.fulfill", parsedRole, session?.permission_overrides);
    const [rows, setRows] = useState<PraxisAufgabe[]>([]);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [personal, setPersonal] = useState<Personal[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("");
    const [filterTyp, setFilterTyp] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setErr(null);
        try {
            const [tasks, pats, team] = await Promise.all([
                listPraxisAufgabenAdmin(),
                listPatienten(),
                loadAufgabeTeamDirectory(parsedRole, session?.permission_overrides),
            ]);
            setRows(tasks);
            setPatients(pats);
            setPersonal(team.filter((m) => m.verfuegbar !== false));
        } catch (e) {
            setErr(errorMessage(e));
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [parsedRole, session?.permission_overrides]);

    useEffect(() => {
        void load();
    }, [load]);

    const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
    const personalMap = useMemo(() => new Map(personal.map((p) => [p.id, p])), [personal]);
    const selected = rows.find((r) => r.id === selectedId) ?? null;

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filterStatus && r.status !== filterStatus) return false;
            if (filterTyp && r.typ !== filterTyp) return false;
            if (!q) return true;
            const hay = [r.titel, r.body ?? "", r.typ, r.status, aufgabePatientLabel(r.patient_id, patientMap)]
                .join(" ")
                .toLowerCase();
            return hay.includes(q);
        });
    }, [rows, search, filterStatus, filterTyp, patientMap]);

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { "": rows.length };
        for (const s of PRAXIS_AUFGABE_STATUSES) {
            counts[s.value] = rows.filter((r) => r.status === s.value).length;
        }
        return counts;
    }, [rows]);

    const handleUpdated = (updated: PraxisAufgabe) => {
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    };

    if (loading) return <PageLoading label={t("praxis.aufgaben.admin.loading")} />;
    if (err) return <PageLoadError message={err} onRetry={() => void load()} />;

    return (
        <div
            className={[
                "page-verwaltung-aufgaben",
                embedded ? "page-verwaltung-aufgaben--embedded" : "page",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {!embedded ? (
                <WorkspacePageHeader
                    titleLevel="h1"
                    title={t("praxis.aufgaben.title")}
                    subtitle={t("praxis.aufgaben.subtitle")}
                    back={{
                        to: backHref,
                        label: backHref === "/tickets" ? t("nav.praxis_tickets") : t("nav.verwaltung"),
                    }}
                    actions={
                        <Button type="button" variant="primary" onClick={() => navigate(CREATE_HREF)}>
                            <PlusIcon size={16} />
                            {t("breadcrumb.new_task")}
                        </Button>
                    }
                />
            ) : null}

            <div className="page-toolbar praxis-aufgabe-admin-toolbar">
                <div className="page-toolbar__search praxis-aufgabe-admin-toolbar__search">
                    <SearchIcon size={16} aria-hidden />
                    <Input
                        id="aufgaben-search"
                        placeholder={t("praxis.aufgaben.admin.search_ph")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        aria-label={t("praxis.aufgaben.admin.search_aria")}
                    />
                </div>
                <div className="page-toolbar__filters aufgaben-toolbar-filters">
                    <Select
                        id="aufgaben-filter-status"
                        aria-label={t("praxis.aufgaben.admin.filter_status_aria")}
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        disabled={rows.length === 0}
                        options={[
                            { value: "", label: tp("praxis.aufgaben.admin.all_status", { count: statusCounts[""] ?? 0 }) },
                            ...PRAXIS_AUFGABE_STATUSES.map((s) => ({
                                value: s.value,
                                label: `${t(`praxis.aufgaben.status.${s.value.toLowerCase()}`)} (${statusCounts[s.value] ?? 0})`,
                            })),
                        ]}
                    />
                    <Select
                        id="aufgaben-filter-typ"
                        aria-label={t("praxis.aufgaben.admin.filter_type_aria")}
                        value={filterTyp}
                        onChange={(e) => setFilterTyp(e.target.value)}
                        disabled={rows.length === 0}
                        options={[
                            { value: "", label: t("praxis.aufgaben.admin.all_types") },
                            ...PRAXIS_AUFGABE_TYPS.map((row) => ({
                                value: row.value,
                                label: t(`praxis.aufgaben.typ.${row.value.toLowerCase()}`),
                            })),
                        ]}
                    />
                </div>
                {rows.length > 0 && (search || filterStatus || filterTyp) ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setSearch("");
                            setFilterStatus("");
                            setFilterTyp("");
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
                        Neue Aufgabe
                    </Button>
                ) : null}
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    title={t("praxis.aufgaben.empty")}
                    description={
                        rows.length === 0
                            ? t("praxis.aufgaben.admin.create_first")
                            : t("praxis.aufgaben.admin.no_results")
                    }
                    action={
                        rows.length === 0
                            ? { label: t("praxis.aufgaben.admin.create_new"), onClick: () => navigate(CREATE_HREF) }
                            : undefined
                    }
                />
            ) : (
                <PraxisAufgabeAdminGrid
                    rows={filtered}
                    patientMap={patientMap}
                    personal={personal}
                    userId={userId}
                    isRezeption={role === "REZEPTION"}
                    canAdmin
                    compact={embedded}
                    onOpen={(row) => setSelectedId(row.id)}
                    onEdit={(row) => navigate(`/tickets/${row.id}/bearbeiten`)}
                />
            )}
            {selected ? (
                <PraxisAufgabeDetailDrawer
                    aufgabe={selected}
                    patientName={aufgabePatientLabel(selected.patient_id, patientMap)}
                    creatorLabel={personalMap.get(selected.created_by)?.name ?? t("common.dash")}
                    personal={personal}
                    userId={userId}
                    isArzt={role === "ARZT"}
                    isRezeption={role === "REZEPTION"}
                    canAdmin
                    canAdminStatus={canAdminStatus}
                    canFulfillStatus={canFulfillStatus}
                    onClose={() => setSelectedId(null)}
                    onUpdated={handleUpdated}
                    onEdit={() => navigate(`/tickets/${selected.id}/bearbeiten`)}
                />
            ) : null}
        </div>
    );
}
