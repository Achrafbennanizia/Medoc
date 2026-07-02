import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { BestellungDetailDrawer } from "../components/bestellung-detail-drawer";
import { listBestellungen, type Bestellung, type BestellStatus } from "@/systems/practice-host/controllers/bestellung.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed, parseRole } from "@/lib/rbac";
import { errorMessage, formatDate, formatCurrency } from "@/lib/utils";
import { bestellStatusDisplay } from "@/lib/finance-order-labels";
import { useT, useTParams } from "@/lib/i18n";
import { WorkspacePageHeader } from "../components/verwaltung-page-header";

type StatusFilter = "ALL" | BestellStatus;

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: Bestellung): boolean {
    if (!b.erwartet_am) return false;
    if (b.status === "GELIEFERT" || b.status === "STORNIERT") return false;
    return b.erwartet_am < todayISO();
}

function statusBadgeReadonly(status: BestellStatus, overdue: boolean, t: (key: string) => string) {
    const st = bestellStatusDisplay(status, t);
    if (overdue && status !== "GELIEFERT" && status !== "STORNIERT") {
        return (
            <Badge variant="error" title={t("page.bestellungen.overdue_hint")}>
                {t("page.bestellungen.status.ueberfaellig")}
            </Badge>
        );
    }
    if (status === "UNTERWEGS") return <span className="pill blue">{st.label}</span>;
    if (status === "GELIEFERT") return <Badge variant="success">{st.label}</Badge>;
    if (status === "STORNIERT") return <Badge variant="error">{st.label}</Badge>;
    return <Badge>{st.label}</Badge>;
}

export function BestellungenPage() {
    const t = useT();
    const tp = useTParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const toast = useToastStore((s) => s.add);
    const rolleStr = useAuthStore((s) => s.session?.rolle);
    const role = parseRole(rolleStr);
    const canWrite = role != null && allowed("bestellung.write", role);
    const canAddProdukt = role != null && allowed("produkt.write", role);

    const selectedId = searchParams.get("bestellung");

    const [rows, setRows] = useState<Bestellung[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

    const load = useCallback(async (opts?: { initial?: boolean }) => {
        const initial = opts?.initial === true;
        if (initial) {
            setLoading(true);
            setLoadError(null);
        }
        try {
            const list = await listBestellungen();
            setRows(list);
            if (initial) setLoadError(null);
        } catch (e) {
            const msg = errorMessage(e);
            if (initial) setLoadError(msg);
            else toast(tp("common.refresh_failed", { message: msg }));
        } finally {
            if (initial) setLoading(false);
        }
    }, [toast, tp]);

    useEffect(() => {
        void load({ initial: true });
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows
            .filter((r) => {
                if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
                if (!q) return true;
                return (
                    r.lieferant.toLowerCase().includes(q) ||
                    r.artikel.toLowerCase().includes(q) ||
                    (r.bestellnummer ?? "").toLowerCase().includes(q) ||
                    (r.pharmaberater ?? "").toLowerCase().includes(q)
                );
            })
            .sort((a, b) => b.created_at.localeCompare(a.created_at));
    }, [rows, search, statusFilter]);

    const selectedBestellung = useMemo(
        () => (selectedId ? rows.find((r) => r.id === selectedId) ?? null : null),
        [rows, selectedId],
    );

    useEffect(() => {
        if (selectedId && !loading && rows.length > 0 && !selectedBestellung) {
            setSearchParams({}, { replace: true });
        }
    }, [selectedId, loading, rows.length, selectedBestellung, setSearchParams]);

    const openDrawer = (id: string) => {
        setSearchParams({ bestellung: id });
    };

    const closeDrawer = () => {
        setSearchParams({});
    };

    const handleUpdated = (updated: Bestellung) => {
        setRows((list) => list.map((row) => (row.id === updated.id ? updated : row)));
    };

    const handleDeleted = (id: string) => {
        setRows((list) => list.filter((row) => row.id !== id));
    };

    const statusOptions = useMemo(
        () => [
            { value: "ALL" as const, label: tp("page.bestellungen.status.all", { count: rows.length }) },
            { value: "OFFEN" as const, label: t("page.bestellungen.status.offen") },
            { value: "UNTERWEGS" as const, label: t("page.bestellungen.status.unterwegs") },
            { value: "GELIEFERT" as const, label: t("page.bestellungen.status.geliefert") },
            { value: "STORNIERT" as const, label: t("page.bestellungen.status.storniert") },
        ],
        [rows.length, t, tp],
    );

    if (loading) return <PageLoading label={t("page.bestellungen.loading")} />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />;

    return (
        <div className="bestellungen-page praxis-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title={t("page.bestellungen.title")}
                subtitle={t("page.bestellungen.subtitle_v2")}
                actions={
                    canWrite ? (
                        <Button onClick={() => navigate("/bestellungen/neu")}>{t("page.bestellungen.cta_new")}</Button>
                    ) : null
                }
            />

            <div className="page-toolbar">
                <div className="page-toolbar__search">
                    <Input
                        id="best-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("page.bestellungen.search_ph")}
                        disabled={rows.length === 0}
                    />
                </div>
                <div className="page-toolbar__filters" style={{ width: 200, maxWidth: "100%" }}>
                    <Select
                        id="best-status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        disabled={rows.length === 0}
                        options={statusOptions}
                    />
                </div>
                {rows.length > 0 && (search || statusFilter !== "ALL") ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
                        {t("common.reset")}
                    </Button>
                ) : null}
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    icon="📦"
                    title={t("page.bestellungen.empty_title")}
                    description={
                        canWrite ? t("page.bestellungen.empty_write_desc") : t("page.bestellungen.empty_desc")
                    }
                    action={
                        canWrite
                            ? { label: t("page.bestellungen.cta_new"), onClick: () => navigate("/bestellungen/neu") }
                            : undefined
                    }
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon="🔎"
                    title={t("page.bestellungen.empty_filtered_title")}
                    description={t("page.bestellungen.empty_filtered_desc")}
                    action={{
                        label: t("common.reset_filters"),
                        onClick: () => { setSearch(""); setStatusFilter("ALL"); },
                    }}
                />
            ) : (
                <div className="card bestellungen-table-card tbl-data-card card--overflow-visible">
                    <div className="tbl-scroll">
                    <table className="tbl tbl-bestellungen">
                        <colgroup>
                            <col className="bestellungen-col-nr" />
                            <col className="bestellungen-col-lief" />
                            <col className="bestellungen-col-art" />
                            <col className="bestellungen-col-menge" />
                            <col className="bestellungen-col-erw" />
                            <col className="bestellungen-col-preis" />
                            <col className="bestellungen-col-status" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">{t("page.bestellungen.col_bestellnr")}</th>
                                <th scope="col">{t("page.bestellungen.col.supplier")}</th>
                                <th scope="col">{t("page.bestellungen.col_artikel")}</th>
                                <th scope="col">{t("page.bestellungen.col_menge")}</th>
                                <th scope="col">{t("page.bestellungen.col.eta")}</th>
                                <th scope="col">{t("page.bestellungen.col_preis")}</th>
                                <th scope="col">{t("page.bestellungen.col.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const overdue = isOverdue(r);
                                const isSelected = selectedId === r.id;
                                const rowLabel = tp("page.bestellungen.open_row", {
                                    label: r.bestellnummer ?? r.id,
                                });
                                const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        openDrawer(r.id);
                                    }
                                };
                                return (
                                    <tr
                                        key={r.id}
                                        className={[
                                            "bestellungen-row",
                                            "bestellungen-row--clickable",
                                            isSelected ? "bestellungen-row--selected" : "",
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={rowLabel}
                                        aria-pressed={isSelected}
                                        title={t("page.bestellungen.open_details")}
                                        onClick={() => openDrawer(r.id)}
                                        onKeyDown={onRowKeyDown}
                                    >
                                        <td className="bestellungen-td-nr">
                                            <span className="bestellungen-nr">{r.bestellnummer ?? "—"}</span>
                                        </td>
                                        <td className="bestellungen-td-lief">
                                            <span className="bestellungen-lief-name">{r.lieferant}</span>
                                            {r.pharmaberater ? (
                                                <span className="bestellungen-lief-sub">{r.pharmaberater}</span>
                                            ) : null}
                                        </td>
                                        <td className="bestellungen-td-art">
                                            <span className="bestellungen-art">{r.artikel}</span>
                                        </td>
                                        <td className="bestellungen-td-menge">
                                            {r.menge}
                                            {r.einheit ? ` ${r.einheit}` : ""}
                                        </td>
                                        <td className="bestellungen-td-erw">
                                            {r.erwartet_am ? (
                                                <span className={overdue ? "bestellungen-erw--late" : undefined}>
                                                    {formatDate(r.erwartet_am)}
                                                </span>
                                            ) : (
                                                <span className="page-sub">—</span>
                                            )}
                                        </td>
                                        <td className="bestellungen-td-preis">
                                            {r.gesamtbetrag != null && Number.isFinite(r.gesamtbetrag)
                                                ? formatCurrency(r.gesamtbetrag)
                                                : "—"}
                                        </td>
                                        <td className="bestellungen-td-status">
                                            {statusBadgeReadonly(r.status, overdue, t)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            {selectedBestellung ? (
                <BestellungDetailDrawer
                    bestellung={selectedBestellung}
                    canWrite={canWrite}
                    canAddProdukt={canAddProdukt}
                    onClose={closeDrawer}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                />
            ) : null}
        </div>
    );
}
