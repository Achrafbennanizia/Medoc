import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { VerwaltungReadField } from "../components/verwaltung-read-field";
import { VorlageEditorPanel } from "./vorlage-editor";
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
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.rolle);
    const canWrite = role ? allowed("vorlagen.write", role) : false;

    const [rows, setRows] = useState<DokumentVorlage[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selected, setSelected] = useState<DokumentVorlage | null>(null);

    const neu = searchParams.get("neu");
    const bearbeiten = searchParams.get("bearbeiten");

    const editorSpec = useMemo(() => {
        if (bearbeiten) return { type: "edit" as const, id: bearbeiten };
        if (neu === "rezept") return { type: "new" as const, kind: "REZEPT" as const };
        if (neu === "attest") return { type: "new" as const, kind: "ATTEST" as const };
        return null;
    }, [neu, bearbeiten]);

    const closeEditor = useCallback(() => {
        setSearchParams({}, { replace: true });
    }, [setSearchParams]);

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

    useEffect(() => {
        if (!bearbeiten || rows.length === 0) return;
        const r = rows.find((x) => x.id === bearbeiten);
        if (r) setSelected(r);
    }, [bearbeiten, rows]);

    const onEditorSaved = useCallback(async () => {
        await reload();
        navigate("/verwaltung/vorlagen", { replace: true });
    }, [reload, navigate]);

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

    const openNewRezept = () => {
        if (!canWrite) return;
        setSearchParams({ neu: "rezept" }, { replace: false });
    };
    const openNewAttest = () => {
        if (!canWrite) return;
        setSearchParams({ neu: "attest" }, { replace: false });
    };
    const openEdit = (r: DokumentVorlage) => {
        if (!canWrite) return;
        setSelected(r);
        setSearchParams({ bearbeiten: r.id }, { replace: false });
    };

    const editorTitle =
        editorSpec?.type === "new"
            ? (editorSpec.kind === "REZEPT" ? "Neues Rezept" : "Neues Attest")
            : editorSpec
              ? (() => {
                    const r = rows.find((x) => x.id === editorSpec.id);
                    if (!r) return "Vorlage bearbeiten";
                    return r.kind === "REZEPT" ? "Rezept-Vorlage bearbeiten" : "Attest-Vorlage bearbeiten";
                })()
              : "";

    const sidePanel = (() => {
        if (editorSpec && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={editorTitle}
                        subtitle="Eingebettet auf dieser Seite (gleiches Prinzip wie „Neues Rezept“ hier — kein separater Editor-Pfad nötig)"
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {editorSpec.type === "new" ? (
                            <VorlageEditorPanel
                                editingId={null}
                                newTemplateKind={editorSpec.kind}
                                canWrite
                                onClose={closeEditor}
                                onSaved={onEditorSaved}
                            />
                        ) : (
                            <VorlageEditorPanel
                                key={editorSpec.id}
                                editingId={editorSpec.id}
                                canWrite
                                onClose={closeEditor}
                                onSaved={onEditorSaved}
                            />
                        )}
                    </div>
                </Card>
            );
        }
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
                                        onClick={() => openEdit(r)}
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
                        <VerwaltungReadField label="Vorschau / Inhalt" value={previewPayload(r)} />
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    Wählen Sie eine Vorlage in der Tabelle, oder legen Sie mit <strong>Rezept einstellen</strong> bzw.{" "}
                    <strong>Atteste einstellen</strong> eine neue Vorlage in diesem Bereich an.
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
                        Vorlagen für die Patientenakte — Liste links, Rechts: Details oder <strong>Neues Rezept / Attest</strong> in dieser Ansicht (wie Produkte, ohne Extra-Route).
                    </p>
                </div>
                {canWrite ? (
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <Button type="button" variant="secondary" onClick={openNewAttest}>
                            Atteste einstellen
                        </Button>
                        <Button type="button" onClick={openNewRezept}>
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
                                description="Legen Sie eine über die Buttons oben an (öffnet den Editor rechts auf dieser Seite)."
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
                                        const pickRow = () => {
                                            setSelected(r);
                                            closeEditor();
                                        };
                                        const rowKeyDown = (e: KeyboardEvent) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                pickRow();
                                            }
                                        };
                                        return (
                                            <tr
                                                key={r.id}
                                                className={isSel ? "produkte-row--selected" : undefined}
                                                tabIndex={0}
                                                onClick={() => pickRow()}
                                                onKeyDown={rowKeyDown}
                                                style={{ cursor: "pointer" }}
                                                aria-label={`Vorlage ${r.titel} anzeigen`}
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
