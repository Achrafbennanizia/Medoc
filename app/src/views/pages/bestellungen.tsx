import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/empty-state";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { PageLoading, PageLoadError } from "../components/ui/page-status";
import { useToastStore } from "../components/ui/toast-store";
import { listBestellungen, updateBestellungStatus, type Bestellung, type BestellStatus } from "../../controllers/bestellung.controller";
import { useAuthStore } from "@/models/store/auth-store";
import { allowed } from "@/lib/rbac";
import { errorMessage, formatDate } from "@/lib/utils";

type StatusFilter = "ALL" | BestellStatus;

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function isOverdue(b: Bestellung): boolean {
    if (!b.erwartet_am) return false;
    if (b.status === "GELIEFERT" || b.status === "STORNIERT") return false;
    return b.erwartet_am < todayISO();
}

const BESTELL_STATUS_OPTIONS: readonly { value: BestellStatus; label: string }[] = [
    { value: "OFFEN", label: "Offen" },
    { value: "UNTERWEGS", label: "Unterwegs" },
    { value: "GELIEFERT", label: "Geliefert" },
    { value: "STORNIERT", label: "Storniert" },
];

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
    const toast = useToastStore((s) => s.add);
    const role = useAuthStore((s) => s.session?.rolle ?? null);
    const canWrite = role != null && allowed("finanzen.write", role);

    const [rows, setRows] = useState<Bestellung[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

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

    const handleStatusChange = async (b: Bestellung, status: BestellStatus) => {
        if (status === b.status) return;
        setStatusUpdatingId(b.id);
        try {
            const updated = await updateBestellungStatus(b.id, status);
            setRows((list) => list.map((row) => (row.id === updated.id ? updated : row)));
            toast("Status aktualisiert", "success");
        } catch (e) {
            toast(`Status konnte nicht geändert werden: ${errorMessage(e)}`, "error");
        } finally {
            setStatusUpdatingId(null);
        }
    };

    if (loading) return <PageLoading label="Bestellungen werden geladen…" />;
    if (loadError) return <PageLoadError message={loadError} onRetry={() => void load({ initial: true })} />;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="animate-fade-in--sticky-safe">
            {/* Header — same minimalist style as Produkte */}
            <div className="page-head">
                <div>
                    <h2 className="page-title">Bestellungen</h2>
                    <p className="page-sub" style={{ marginTop: 4 }}>
                        Lieferungen und Bestellvorgänge der Praxis im Überblick.
                    </p>
                </div>
                {canWrite ? <Button onClick={() => navigate("/bestellungen/neu")}>+ Neue Bestellung</Button> : null}
            </div>

            {/* Toolbar — single line, search + status filter; no overload */}
            {rows.length > 0 ? (
                <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 280px", minWidth: 220 }}>
                        <Input
                            id="best-search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Suchen: Lieferant, Artikel, Bestellnr…"
                        />
                    </div>
                    <div style={{ width: 200 }}>
                        <Select
                            id="best-status"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                            options={[
                                { value: "ALL", label: `Alle Status (${rows.length})` },
                                { value: "OFFEN", label: "Offen" },
                                { value: "UNTERWEGS", label: "Unterwegs" },
                                { value: "GELIEFERT", label: "Geliefert" },
                                { value: "STORNIERT", label: "Storniert" },
                            ]}
                        />
                    </div>
                    {(search || statusFilter !== "ALL") ? (
                        <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>
                            Zurücksetzen
                        </Button>
                    ) : null}
                </div>
            ) : null}

            {/* Table — minimalist Produkte style */}
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
                <div className="card">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Bestellnr.</th>
                                <th>Lieferant</th>
                                <th>Artikel</th>
                                <th>Menge</th>
                                <th>Erwartet</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((r) => {
                                const overdue = isOverdue(r);
                                const go = () => navigate(`/bestellungen/${r.id}`);
                                const onRowKeyDown = (e: KeyboardEvent) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        go();
                                    }
                                };
                                return (
                                    <tr
                                        key={r.id}
                                        className="bestellungen-row bestellungen-row--clickable"
                                        tabIndex={0}
                                        onClick={go}
                                        onKeyDown={onRowKeyDown}
                                        title="Details öffnen"
                                        aria-label={`Bestellung ${r.bestellnummer ?? r.id} öffnen`}
                                    >
                                        <td>
                                            <span
                                                style={{
                                                    color: "var(--accent-ink)",
                                                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                                                    fontSize: 12.5,
                                                }}
                                            >
                                                {r.bestellnummer ?? "—"}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{r.lieferant}</div>
                                            {r.pharmaberater ? (
                                                <div className="page-sub" style={{ fontSize: 11.5 }}>{r.pharmaberater}</div>
                                            ) : null}
                                        </td>
                                        <td style={{ maxWidth: 320 }}>{r.artikel}</td>
                                        <td>{r.menge}{r.einheit ? ` ${r.einheit}` : ""}</td>
                                        <td>
                                            {r.erwartet_am ? (
                                                <span style={{
                                                    color: overdue ? "var(--red)" : undefined,
                                                    fontWeight: overdue ? 600 : 400,
                                                    fontVariantNumeric: "tabular-nums",
                                                }}>
                                                    {formatDate(r.erwartet_am)}
                                                </span>
                                            ) : (
                                                <span className="page-sub">—</span>
                                            )}
                                        </td>
                                        <td
                                            onClick={(e) => e.stopPropagation()}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <div className="bestellungen-status-cell">
                                                {canWrite ? (
                                                    <Select
                                                        id={`best-status-${r.id}`}
                                                        className="bestellungen-status-select w-full min-w-0 max-w-[200px]"
                                                        aria-label={`Status: ${r.bestellnummer ?? r.artikel}`}
                                                        value={r.status}
                                                        disabled={statusUpdatingId === r.id}
                                                        onChange={(e) =>
                                                            handleStatusChange(r, e.target.value as BestellStatus)
                                                        }
                                                        options={BESTELL_STATUS_OPTIONS.map((o) => ({
                                                            value: o.value,
                                                            label: o.label,
                                                        }))}
                                                    />
                                                ) : (
                                                    statusBadgeReadonly(r.status, overdue)
                                                )}
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
            )}

        </div>
    );
}
