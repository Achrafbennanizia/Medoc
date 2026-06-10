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
import { errorMessage, formatDate } from "@/lib/utils";
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

function statusBadgeReadonly(status: BestellStatus, overdue: boolean) {
    if (overdue) return <Badge variant="error">Überfällig</Badge>;
    switch (status) {
        case "OFFEN":
            return <Badge>Offen</Badge>;
        case "UNTERWEGS":
            return <span className="pill blue">Unterwegs</span>;
        case "GELIEFERT":
            return <Badge variant="success">Geliefert</Badge>;
        case "STORNIERT":
            return <Badge variant="error">Storniert</Badge>;
    }
}

export function BestellungenPage() {
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
            else toast(`Aktualisieren fehlgeschlagen: ${msg}`);
        } finally {
            if (initial) setLoading(false);
        }
    }, [toast]);

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

    if (loading) return <PageLoading label="Bestellungen werden geladen…" />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />;

    return (
        <div className="bestellungen-page praxis-workspace-page animate-fade-in--sticky-safe">
            <WorkspacePageHeader
                title="Bestellungen"
                subtitle="Lieferungen und Bestellvorgänge der Praxis im Überblick."
                actions={
                    canWrite ? (
                        <Button onClick={() => navigate("/bestellungen/neu")}>+ Neue Bestellung</Button>
                    ) : null
                }
            />

            <div className="page-toolbar">
                <div className="page-toolbar__search">
                    <Input
                        id="best-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Suchen: Lieferant, Artikel, Bestellnr…"
                        disabled={rows.length === 0}
                    />
                </div>
                <div className="page-toolbar__filters" style={{ width: 200, maxWidth: "100%" }}>
                    <Select
                        id="best-status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                        disabled={rows.length === 0}
                        options={[
                            { value: "ALL", label: `Alle Status (${rows.length})` },
                            { value: "OFFEN", label: "Offen" },
                            { value: "UNTERWEGS", label: "Unterwegs" },
                            { value: "GELIEFERT", label: "Geliefert" },
                            { value: "STORNIERT", label: "Storniert" },
                        ]}
                    />
                </div>
                {rows.length > 0 && (search || statusFilter !== "ALL") ? (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
                        Zurücksetzen
                    </Button>
                ) : null}
            </div>

            {rows.length === 0 ? (
                <EmptyState
                    icon="📦"
                    title="Noch keine Bestellungen"
                    description={canWrite ? "Erfasse deine erste Bestellung." : "Sobald Bestellungen vorhanden sind, erscheinen sie hier."}
                    action={canWrite ? { label: "+ Neue Bestellung", onClick: () => navigate("/bestellungen/neu") } : undefined}
                />
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon="🔎"
                    title="Keine Treffer"
                    description="Kein Eintrag passt zu Suche oder Filter."
                    action={{
                        label: "Filter zurücksetzen",
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
                            <col className="bestellungen-col-status" />
                        </colgroup>
                        <thead>
                            <tr>
                                <th scope="col">Bestellnr.</th>
                                <th scope="col">Lieferant</th>
                                <th scope="col">Artikel</th>
                                <th scope="col">Menge</th>
                                <th scope="col">Erwartet</th>
                                <th scope="col">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const overdue = isOverdue(r);
                                const isSelected = selectedId === r.id;
                                const rowLabel = `Bestellung ${r.bestellnummer ?? r.id} öffnen`;
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
                                        title="Details öffnen"
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
                                        <td className="bestellungen-td-status">
                                            <div className="bestellungen-status-cell">
                                                {statusBadgeReadonly(r.status, overdue)}
                                                {overdue && r.status !== "GELIEFERT" && r.status !== "STORNIERT" ? (
                                                    <span className="bestellungen-overdue-hint" title="Liefertermin liegt in der Vergangenheit">
                                                        Überfällig
                                                    </span>
                                                ) : null}
                                            </div>
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
