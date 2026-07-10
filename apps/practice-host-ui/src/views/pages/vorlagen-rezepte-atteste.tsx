import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listDokumentVorlagen, deleteDokumentVorlage } from "@/systems/practice-host/controllers/praxis.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { DokumentVorlage } from "../../models/types";
import { errorMessage } from "@/lib/utils";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { VerwaltungPageHeader } from "../components/verwaltung-page-header";
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
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
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
            toast(t("page.vorlagen.toast.deleted"));
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            await reload();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    const sorted = useMemo(
        () => [...rows].sort((a, b) => a.titel.localeCompare(b.titel, sortLocale)),
        [rows],
    );

    const editorTitle = useMemo(() => {
        if (editorSpec?.type === "new") {
            return editorSpec.kind === "REZEPT"
                ? t("page.vorlagen.editor.new_rezept")
                : t("page.vorlagen.editor.new_attest");
        }
        if (editorSpec) {
            const r = rows.find((x) => x.id === editorSpec.id);
            if (!r) return t("page.vorlagen.editor.edit");
            return r.kind === "REZEPT"
                ? t("page.vorlagen.editor.edit_rezept")
                : t("page.vorlagen.editor.edit_attest");
        }
        return "";
    }, [editorSpec, rows, t]);

    if (status === "loading") return <PageLoading label={t("page.vorlagen.loading")} />;
    if (status === "error" && loadError) {
        return (
            <div className="produkte-page praxis-workspace-page animate-fade-in">
                <VerwaltungPageHeader title={t("page.vorlagen.title")} />
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

    const sidePanel = (() => {
        if (editorSpec && canWrite) {
            return (
                <Card className="produkte-detail-card">
                    <CardHeader
                        title={editorTitle}
                        subtitle={t("page.vorlagen.editor.subtitle")}
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
                        subtitle={r.kind === "REZEPT" ? t("page.vorlagen.detail.rezept") : t("page.vorlagen.detail.attest")}
                        action={
                            canWrite ? (
                                <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => openEdit(r)}
                                    >
                                        <EditIcon size={14} /> {t("common.edit")}
                                    </Button>
                                    <Button type="button" variant="danger" size="sm" onClick={() => setDeleteId(r.id)}>
                                        <TrashIcon size={14} /> {t("common.delete")}
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        <VerwaltungReadField label={t("page.vorlagen.preview")} value={previewPayload(r)} />
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad produkte-detail-card produkte-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {t("page.vorlagen.pick_hint")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="produkte-page praxis-workspace-page animate-fade-in">
            <ConfirmDialog
                open={Boolean(deleteId)}
                title={t("page.vorlagen.delete.title")}
                message={t("page.vorlagen.delete.message")}
                confirmLabel={t("common.yes_delete")}
                danger
                onConfirm={() => void doDelete()}
                onClose={() => setDeleteId(null)}
            />

            <VerwaltungPageHeader
                title={t("page.vorlagen.title")}
                subtitle={t("page.vorlagen.subtitle")}
                actions={
                    canWrite ? (
                        <>
                            <Button type="button" variant="secondary" onClick={openNewAttest}>
                                {t("page.vorlagen.new_attest")}
                            </Button>
                            <Button type="button" onClick={openNewRezept}>
                                {t("page.vorlagen.new_rezept")}
                            </Button>
                        </>
                    ) : null
                }
            />

            <div className="produkte-workspace">
                <div className="produkte-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="📋"
                                title={t("page.vorlagen.empty.title")}
                                description={t("page.vorlagen.empty.desc")}
                            />
                        </Card>
                    ) : (
                        <div className="card produkte-table-card tbl-data-card tbl-scroll">
                            <table className="tbl produkte-tbl">
                                <thead>
                                    <tr>
                                        <th scope="col">{t("page.vorlagen.col.title")}</th>
                                        <th scope="col">{t("page.vorlagen.col.type")}</th>
                                        <th scope="col">{t("page.vorlagen.col.content")}</th>
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
                                                aria-label={tp("page.vorlagen.aria.show", { title: r.titel })}
                                            >
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.titel}</span>
                                                </td>
                                                <td>{r.kind === "REZEPT" ? t("page.vorlagen.type.rezept") : t("page.vorlagen.type.attest")}</td>
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
