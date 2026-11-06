import type { DocumentKind, ExportTableColumnId, PracticeFieldKey } from "./document-template-schema";

type TFn = (key: string) => string;

/** Localized builtin template name. */
export function builtinTemplateName(t: TFn, id: string): string {
    return t(`document.template.builtin.${id}.name`);
}

export function builtinTemplateFooter(t: TFn, id: string): string {
    const key = `document.template.builtin.${id}.footer`;
    const version = t(key);
    return version === key ? "" : version;
}
export function documentKindLabel(t: TFn, kind: DocumentKind): string {
    return t(`document.kind.${kind}`);
}

/** Localized practice header field label for template editor UI. */
export function practiceFieldLabel(t: TFn, id: PracticeFieldKey): string {
    return t(`document.practice_field.${id}`);
}

/** Localized export table column label for template editor UI. */
export function exportTableColumnLabel(t: TFn, id: ExportTableColumnId): string {
    return t(`document.table_column.${id}`);
}
