/**
 * List / detail editing page in the Administration style (same structure as Products and Contracts):
 * page header, list on the left, a fixed right-hand part with the overview, the read view or the form,
 * and a delete confirmation. Pages provide only their columns, form fields and read view.
 */
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { EditIcon } from "@/lib/icons";
import { AdministrationPageHeader } from "../administration-page-header";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { DataTable, type DataTableColumn } from "../ui/data-table";
import { ConfirmDialog } from "../ui/dialog";
import { EmptyState } from "../ui/empty-state";
import { PageLoadError, PageLoading } from "../ui/page-status";
import type { MasterDetailCrud } from "./use-master-detail-crud";

export type CrudPageTexts = {
    title: string;
    subtitle: string;
    entity: string;
    createButton: string;
    createTitle: string;
    readSubtitle: string;
    editSubtitle: string;
    empty: string;
    emptyHint: string;
    deleteTitle: string;
    deleteMessage: string;
};

type Props<T, F> = {
    crud: MasterDetailCrud<T, F>;
    canWrite: boolean;
    texts: CrudPageTexts;
    columns: DataTableColumn<T>[];
    getId: (item: T) => string;
    itemTitle: (item: T) => string;
    renderForm: (form: F, setForm: (next: F) => void, idPrefix: string) => ReactNode;
    renderRead: (item: T) => ReactNode;
    overview: ReactNode;
    emptyIcon?: string;
};

export function MasterDetailCrudPage<T, F>({ crud, canWrite, texts, columns, getId, itemTitle, renderForm, renderRead, overview, emptyIcon = "📋" }: Props<T, F>) {
    const t = useT();
    const editing = canWrite && (crud.mode === "create" || crud.mode === "edit");

    const formCard = (title: string, subtitle?: string) => (
        <Card className="products-detail-card card--overflow-visible">
            <CardHeader title={title} subtitle={subtitle} />
            <div className="card-pad master-detail-form">
                {renderForm(crud.form, crud.setForm, crud.mode === "create" ? "crud-new" : "crud-edit")}
                <div className="row master-detail-form__actions">
                    <Button type="button" variant="ghost" onClick={crud.cancel} disabled={crud.busy}>
                        {t("common.cancel")}
                    </Button>
                    <Button type="button" onClick={() => void crud.save()} disabled={!crud.valid || crud.busy} loading={crud.busy}>
                        {crud.mode === "create" ? t("common.create") : t("common.save")}
                    </Button>
                </div>
            </div>
        </Card>
    );

    const detail = (() => {
        if (editing && crud.mode === "create") return formCard(texts.createTitle);
        if (crud.selected && editing) return formCard(itemTitle(crud.selected), texts.editSubtitle);
        if (crud.selected) {
            return (
                <Card className="products-detail-card">
                    <CardHeader
                        title={itemTitle(crud.selected)}
                        subtitle={texts.readSubtitle}
                        action={
                            canWrite ? (
                                <div className="row master-detail-form__actions">
                                    <Button type="button" size="sm" variant="secondary" onClick={crud.startEdit}>
                                        <EditIcon size={14} /> {t("common.edit")}
                                    </Button>
                                    <Button type="button" size="sm" variant="danger" onClick={crud.askDelete}>
                                        {t("common.delete")}
                                    </Button>
                                </div>
                            ) : null
                        }
                    />
                    <div className="card-pad">{renderRead(crud.selected)}</div>
                </Card>
            );
        }
        return overview;
    })();

    return (
        <div className="products-page practice-workspace-page animate-fade-in--sticky-safe">
            <AdministrationPageHeader
                title={texts.title}
                subtitle={texts.subtitle}
                actions={
                    canWrite && crud.mode !== "create" ? (
                        <Button type="button" onClick={crud.openCreate}>
                            {texts.createButton}
                        </Button>
                    ) : null
                }
            />
            {crud.loading ? (
                <PageLoading />
            ) : crud.loadError ? (
                <PageLoadError message={crud.loadError} onRetry={() => void crud.reload()} />
            ) : (
                <div className="products-workspace">
                    <div className="products-workspace__list">
                        {crud.items.length === 0 ? (
                            <Card className="card-pad">
                                <EmptyState icon={emptyIcon} title={texts.empty} description={texts.emptyHint} />
                            </Card>
                        ) : (
                            <div className="card products-table-card tbl-data-card">
                                <DataTable
                                    label={texts.entity}
                                    rows={crud.items}
                                    getRowId={getId}
                                    selectedId={crud.mode === "create" ? null : (crud.selected ? getId(crud.selected) : null)}
                                    onRowActivate={crud.select}
                                    columns={columns}
                                />
                            </div>
                        )}
                    </div>
                    <div className="products-workspace__detail">{detail}</div>
                </div>
            )}
            <ConfirmDialog
                open={!!crud.deleteTarget}
                onClose={crud.cancelDelete}
                onConfirm={() => void crud.confirmDelete()}
                title={texts.deleteTitle}
                message={texts.deleteMessage}
                confirmLabel={t("common.delete")}
                loading={crud.busy}
                danger
            />
        </div>
    );
}
