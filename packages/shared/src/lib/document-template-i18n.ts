import type { DocumentKind, ExportTableColumnId, PraxisFieldKey } from "./document-template-schema";

type TFn = (key: string) => string;

/** Localized document kind label for export/template UI. */
export function documentKindLabel(t: TFn, kind: DocumentKind): string {
    return t(`document.kind.${kind}`);
}

/** Localized practice header field label for template editor UI. */
export function praxisFieldLabel(t: TFn, id: PraxisFieldKey): string {
    return t(`document.praxis_field.${id}`);
}

/** Localized export table column label for template editor UI. */
export function exportTableColumnLabel(t: TFn, id: ExportTableColumnId): string {
    return t(`document.table_column.${id}`);
}
