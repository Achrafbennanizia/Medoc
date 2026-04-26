import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listDokumentVorlagen, deleteDokumentVorlage } from "../../controllers/praxis.controller";
import { allowed, parseRole } from "../../lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { DokumentVorlage } from "../../models/types";
import { errorMessage } from "../../lib/utils";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungBackButton } from "../components/verwaltung-back-button";
import { EditIcon, TrashIcon } from "@/lib/icons";

function previewPayload(v: DokumentVorlage): string {
    try {
        const p = JSON.parse(v.payload) as Record<string, unknown>;
        if (v.kind === "REZEPT") {
            const items = p.items as Array<{ medikament?: string }> | undefined;
            const first = items?.[0]?.medikament;
            if (first) return first;
            return (p.title as string) || "—";
        }
        const k = (p.krankheiten as string) || "";
        const e = (p.einschraenkung as string) || "";
        return k || (e ? `${e.slice(0, 48)}…` : "—");
    } catch {
        return "—";
    }
}

export function VorlagenRezepteAttestePage() {
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("personal.write", role) : false;

    const [rows, setRows] = useState<DokumentVorlage[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selected, setSelected] = useState<DokumentVorlage | null>(null);

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listDokumentVorlagen();
            setRows(list);
            setSelected((cur) => (cur ? list.find((x) => x.id === cur.id) ?? null : null));
            setStatus("ready");
        } catch (e) {
            setLoadError(errorMessage(e));
            setStatus("error");
        }
    }, []);

    useEffect(() => {
        void reload();
    }, [reload]);

    const doDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDokumentVorlage(deleteId);
            toast("Vorlage gelöscht");
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            await reload();
        } catch (e) {
            toast(`Fehler: ${errorMessage(e)}`, "error");
        }
    };

    const sorted = useMemo(
        () => [...rows].sort((a, b) => a.titel.localeCompare(b.titel, "de")),
        [rows],
    );

    if (status === "loading") return <PageLoading label="Vorlagen werden geladen…" />;
    if (status === "error" && loadError) {
        return (
            <div className="produkte-page animate-fade-in space-y-4">
                <VerwaltungBackButton />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    const readField = (label: string, value: string) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
                style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--fg-4)",
                }}
            >
                {label}
            </span>
            <span style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.45 }}>{value || "—"}</span>
        </div>
    );

    const sidePanel = (() => {
        if (selected) {
            const r = selected;
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={r.titel}
                        subtitle={r.kind === "REZEPT" ? "Rezept-Vorlage" : "Attest-Vorlage"}
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => navigate(`/verwaltung/vorlagen/editor/${r.id}`)}
                                    >
                                        <EditIcon size={14} /> Bearbeiten
                                    </Button>
                                    <Button type="button" variant="danger" size="sm" onClick={() => setDeleteId(r.id)}>
                                        <TrashIcon size={14} /> Löschen
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {readField("Vorschau / Inhalt", previewPayload(r))}
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    Wählen Sie eine Vorlage in der Tabelle. Neu legen Sie über „Rezept einstellen“ oder „Atteste einstellen“ an
                    (Editor öffnet sich separat).
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ConfirmDialog
                open={Boolean(deleteId)}
                title="Löschen bestätigen"
                message="Möchten Sie diese Vorlage wirklich löschen?"
                confirmLabel="Ja, löschen"
                danger
                onConfirm={() => void doDelete()}
                onClose={() => setDeleteId(null)}
            />

            <div>
                <VerwaltungBackButton />
            </div>
            <div className="page-head" style={{ alignItems: "flex-start" }}>
                <div>
                    <h2 className="page-title">Rezepte und Atteste vordefinieren</h2>
                    <p className="page-sub" style={{ maxWidth: 560, marginTop: 4 }}>
                        Vorlagen für die Patientenakte — Liste links, Details und Bearbeiten rechts (wie Produkte).
                    </p>
                </div>
                {canWrite ? (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" onClick={() => navigate("/verwaltung/vorlagen/editor?kind=attest")}>
                            Atteste einstellen
                        </Button>
                        <Button type="button" onClick={() => navigate("/verwaltung/vorlagen/editor?kind=rezept")}>
                            Rezept einstellen
                        </Button>
                    </div>
                ) : null}
            </div>

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="📋"
                                title="Keine Vorlagen"
                                description="Legen Sie eine über die Buttons oben an (öffnet den Editor)."
                            />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card" style={{ overflow: "auto" }}>
                            <table className="tbl produkte-tbl" style={{ minWidth: 480 }}>
                                <thead>
                                    <tr>
                                        <th scope="col">Titel</th>
                                        <th scope="col">Typ</th>
                                        <th scope="col">Behandlung / Medikation</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.map((r) => {
                                        const isSel = selected?.id === r.id;
                                        return (
                                            <tr
                                                key={r.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                onClick={() => setSelected(r)}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.titel}</span>
                                                </td>
                                                <td>{r.kind === "REZEPT" ? "Rezept" : "Attest"}</td>
                                                <td style={{ color: "var(--fg-3)", fontSize: 13 }}>{previewPayload(r)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="produkte-workspace__detail">{sidePanel}</div>
            </div>
        </div>
    );
}
