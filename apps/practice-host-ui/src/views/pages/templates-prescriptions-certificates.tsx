import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { listDocumentTemplates, deleteDocumentTemplate } from "@/systems/practice-host/controllers/practice.controller";
import { allowed, parseRole } from "@/lib/rbac";
import { useAuthStore } from "../../models/store/auth-store";
import type { DocumentTemplate } from "../../models/types";
import { errorMessage } from "@/lib/utils";
import { useT, useTParams , useCollatorLocale} from "@/lib/i18n";
import { Button } from "../components/ui/button";
import { Card, CardHeader } from "../components/ui/card";
import { ConfirmDialog } from "../components/ui/dialog";
import { EmptyState } from "../components/ui/empty-state";
import { useToastStore } from "../components/ui/toast-store";
import { PageLoadError, PageLoading } from "../components/ui/page-status";
import { AdministrationPageHeader } from "../components/administration-page-header";
import { AdministrationReadField } from "../components/administration-read-field";
import { TemplateEditorPanel } from "./template-editor";
import { EditIcon, TrashIcon } from "@/lib/icons";

function previewPayload(version: DocumentTemplate): string {
    try {
        const p = JSON.parse(version.payload) as Record<string, unknown>;
        if (version.kind === "PRESCRIPTION") {
            const items = p.items as Array<{ medication?: string }> | undefined;
            const first = items?.[0]?.medication;
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

export function TemplatesPrescriptionsCertificatesPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const t = useT();
    const sortLocale = useCollatorLocale();
    const tp = useTParams();
    const toast = useToastStore((s) => s.add);
    const session = useAuthStore((s) => s.session);
    const role = parseRole(session?.role);
    const canWrite = role ? allowed("templates.write", role) : false;

    const [rows, setRows] = useState<DocumentTemplate[]>([]);
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [loadError, setLoadError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [selected, setSelected] = useState<DocumentTemplate | null>(null);

    const new = searchParams.get("new");
    const bearbeiten = searchParams.get("bearbeiten");

    const editorSpec = useMemo(() => {
        if (bearbeiten) return { type: "edit" as const, id: bearbeiten };
        if (new === "prescription") return { type: "new" as const, kind: "PRESCRIPTION" as const };
        if (new === "certificate") return { type: "new" as const, kind: "CERTIFICATE" as const };
        return null;
    }, [new, bearbeiten]);

    const closeEditor = useCallback(() => {
        setSearchParams({}, { replace: true });
    }, [setSearchParams]);

    const reload = useCallback(async () => {
        setLoadError(null);
        setStatus("loading");
        try {
            const list = await listDocumentTemplates();
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
        navigate("/administration/templates", { replace: true });
    }, [reload, navigate]);

    const doDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteDocumentTemplate(deleteId);
            toast(t("page.templates.toast.deleted"));
            setSelected((s) => (s?.id === deleteId ? null : s));
            setDeleteId(null);
            await reload();
        } catch (e) {
            toast(`${t("common.error_prefix")} ${errorMessage(e)}`, "error");
        }
    };

    const sorted = useMemo(
        () => [...rows].sort((a, b) => a.title.localeCompare(b.title, sortLocale)),
        [rows],
    );

    const editorTitle = useMemo(() => {
        if (editorSpec?.type === "new") {
            return editorSpec.kind === "PRESCRIPTION"
                ? t("page.templates.editor.new_prescription")
                : t("page.templates.editor.new_certificate");
        }
        if (editorSpec) {
            const r = rows.find((x) => x.id === editorSpec.id);
            if (!r) return t("page.templates.editor.edit");
            return r.kind === "PRESCRIPTION"
                ? t("page.templates.editor.edit_prescription")
                : t("page.templates.editor.edit_certificate");
        }
        return "";
    }, [editorSpec, rows, t]);

    if (status === "loading") return <PageLoading label={t("page.templates.loading")} />;
    if (status === "error" && loadError) {
        return (
            <div className="products-page practice-workspace-page animate-fade-in">
                <AdministrationPageHeader title={t("page.templates.title")} />
                <PageLoadError message={loadError} onRetry={() => void reload()} />
            </div>
        );
    }

    const openNewPrescription = () => {
        if (!canWrite) return;
        setSearchParams({ new: "prescription" }, { replace: false });
    };
    const openNewCertificate = () => {
        if (!canWrite) return;
        setSearchParams({ new: "certificate" }, { replace: false });
    };
    const openEdit = (r: DocumentTemplate) => {
        if (!canWrite) return;
        setSelected(r);
        setSearchParams({ bearbeiten: r.id }, { replace: false });
    };

    const sidePanel = (() => {
        if (editorSpec && canWrite) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={editorTitle}
                        subtitle={t("page.templates.editor.subtitle")}
                    />
                    <div className="card-pad" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                        {editorSpec.type === "new" ? (
                            <TemplateEditorPanel
                                editingId={null}
                                newTemplateKind={editorSpec.kind}
                                canWrite
                                onClose={closeEditor}
                                onSaved={onEditorSaved}
                            />
                        ) : (
                            <TemplateEditorPanel
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
                <Card className="products-detail-card">
                    <CardHeader
                        title={r.title}
                        subtitle={r.kind === "PRESCRIPTION" ? t("page.templates.detail.prescription") : t("page.templates.detail.certificate")}
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
                        <AdministrationReadField label={t("page.templates.preview")} value={previewPayload(r)} />
                    </div>
                </Card>
            );
        }
        return (
            <Card className="card-pad products-detail-card products-detail-card--empty">
                <p style={{ margin: 0, color: "var(--fg-3)", fontSize: 14, lineHeight: 1.5 }}>
                    {t("page.templates.pick_hint")}
                </p>
            </Card>
        );
    })();

    return (
        <div className="products-page practice-workspace-page animate-fade-in">
            <ConfirmDialog
                open={Boolean(deleteId)}
                title={t("page.templates.delete.title")}
                message={t("page.templates.delete.message")}
                confirmLabel={t("common.yes_delete")}
                danger
                onConfirm={() => void doDelete()}
                onClose={() => setDeleteId(null)}
            />

            <AdministrationPageHeader
                title={t("page.templates.title")}
                subtitle={t("page.templates.subtitle")}
                actions={
                    canWrite ? (
                        <>
                            <Button type="button" variant="secondary" onClick={openNewCertificate}>
                                {t("page.templates.new_certificate")}
                            </Button>
                            <Button type="button" onClick={openNewPrescription}>
                                {t("page.templates.new_prescription")}
                            </Button>
                        </>
                    ) : null
                }
            />

            <div className="products-workspace">
                <div className="products-workspace__list">
                    {sorted.length === 0 ? (
                        <Card className="card-pad">
                            <EmptyState
                                icon="📋"
                                title={t("page.templates.empty.title")}
                                description={t("page.templates.empty.desc")}
                            />
                        </Card>
                    ) : (
                        <div className="card products-table-card tbl-data-card tbl-scroll">
                            <table className="tbl products-tbl">
                                <thead>
                                    <tr>
                                        <th scope="col">{t("page.templates.col.title")}</th>
                                        <th scope="col">{t("page.templates.col.type")}</th>
                                        <th scope="col">{t("page.templates.col.content")}</th>
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
                                                className={isSel ? "products-row--selected" : undefined}
                                                tabIndex={0}
                                                onClick={() => pickRow()}
                                                onKeyDown={rowKeyDown}
                                                style={{ cursor: "pointer" }}
                                                aria-label={tp("page.templates.aria.show", { title: r.title })}
                                            >
                                                <td>
                                                    <span style={{ fontWeight: 600, color: "var(--fg-2)" }}>{r.title}</span>
                                                </td>
                                                <td>{r.kind === "PRESCRIPTION" ? t("page.templates.type.prescription") : t("page.templates.type.certificate")}</td>
                                                <td style={{ color: "var(--fg-3)", fontSize: 13 }}>{previewPayload(r)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="products-workspace__detail">{sidePanel}</div>
            </div>
        </div>
    );
}
