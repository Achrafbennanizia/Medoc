import type { KeyboardEvent, ReactNode } from "react";

/**
 * DataTable — the shared table primitive (Strategy per column: header + cell renderer + layout hints).
 *
 * Why: tables were hand-written per page with inline widths and `nth-child` CSS (e.g. Contracts summed to
 * 80% + 10rem and the status badge overflowed). Here widths live in a `<colgroup>` generated from the
 * column definitions, so a table cannot drift from its CSS, and every table gets the same behaviour:
 * sticky header, truncation with full-text tooltip, numeric alignment, keyboard row activation
 * (Enter / Space), `aria-selected`, responsive column hiding and an empty state.
 */
export type DataTableColumn<T> = {
    readonly id: string;
    readonly header: ReactNode;
    readonly cell: (row: T) => ReactNode;
    /** CSS width for the `<col>` (e.g. `"2.5rem"`, `"28%"`, `"minmax"` not supported). Omit = flexible. */
    readonly width?: string;
    readonly align?: "start" | "end" | "center";
    /** Single line with ellipsis; `title` gets the plain text from {@link DataTableColumn.text}. */
    readonly truncate?: boolean;
    /** Plain text for tooltips / truncation. */
    readonly text?: (row: T) => string;
    /** Hide the column when the table container is narrower than this (container query breakpoints). */
    readonly hideBelow?: "sm" | "md" | "lg";
    /** Visually hidden header (icon columns) — still announced to screen readers. */
    readonly srOnlyHeader?: boolean;
    readonly numeric?: boolean;
};

export type DataTableProps<T> = {
    readonly columns: readonly DataTableColumn<T>[];
    readonly rows: readonly T[];
    readonly getRowId: (row: T) => string;
    /** Accessible name of the table. */
    readonly label: string;
    readonly emptyLabel?: ReactNode;
    readonly selectedId?: string | null;
    readonly onRowActivate?: (row: T) => void;
    readonly rowClassName?: (row: T) => string | undefined;
    /** Accessible name for an interactive row (e.g. "Show service Filling"). */
    readonly rowLabel?: (row: T) => string;
    /** Minimum table width before horizontal scrolling kicks in. */
    readonly minWidth?: string;
    readonly className?: string;
    /** Constrain height and scroll inside the table (header stays visible). */
    readonly maxHeight?: string;
};

function alignClass(align: DataTableColumn<unknown>["align"], numeric?: boolean): string {
    if (numeric || align === "end") return " data-table__cell--end";
    if (align === "center") return " data-table__cell--center";
    return "";
}

export function DataTable<T>({
    columns,
    rows,
    getRowId,
    label,
    emptyLabel,
    selectedId,
    onRowActivate,
    rowClassName,
    rowLabel,
    minWidth,
    className,
    maxHeight,
}: DataTableProps<T>) {
    const interactive = Boolean(onRowActivate);

    const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
        if (!onRowActivate) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onRowActivate(row);
            return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const tr = e.currentTarget;
            const next = (e.key === "ArrowDown" ? tr.nextElementSibling : tr.previousElementSibling) as HTMLElement | null;
            next?.focus();
        }
    };

    return (
        <div
            className={["data-table-wrap", className].filter(Boolean).join(" ")}
            style={maxHeight ? { maxHeight } : undefined}
        >
            <table
                className="tbl data-table"
                aria-label={label}
                style={minWidth ? { minWidth } : undefined}
                data-interactive={interactive || undefined}
                // Widths come from the column definitions; the global text-measuring estimator
                // (table-column-estimator-host) would add a second pixel <colgroup> and overflow the card.
                data-tbl-no-autosize=""
            >
                <colgroup>
                    {columns.map((c) => (
                        <col key={c.id} className={c.hideBelow ? `data-table__col--hide-${c.hideBelow}` : undefined} style={c.width ? { width: c.width } : undefined} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c.id}
                                scope="col"
                                className={[
                                    "data-table__th",
                                    alignClass(c.align, c.numeric).trim(),
                                    c.hideBelow ? `data-table__cell--hide-${c.hideBelow}` : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                {c.srOnlyHeader ? <span className="sr-only">{c.header}</span> : c.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr className="data-table__empty-row">
                            <td colSpan={columns.length} className="data-table__empty">
                                {emptyLabel}
                            </td>
                        </tr>
                    ) : (
                        rows.map((row) => {
                            const id = getRowId(row);
                            const selected = selectedId != null && selectedId === id;
                            return (
                                <tr
                                    key={id}
                                    className={["data-table__row", selected ? "data-table__row--selected" : "", rowClassName?.(row) ?? ""]
                                        .filter(Boolean)
                                        .join(" ")}
                                    tabIndex={interactive ? 0 : undefined}
                                    aria-selected={interactive ? selected : undefined}
                                    aria-label={rowLabel?.(row)}
                                    onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                                    onKeyDown={interactive ? (e) => onRowKey(e, row) : undefined}
                                >
                                    {columns.map((c) => {
                                        const text = c.text?.(row);
                                        return (
                                            <td
                                                key={c.id}
                                                className={[
                                                    "data-table__td",
                                                    alignClass(c.align, c.numeric).trim(),
                                                    c.truncate ? "data-table__cell--truncate" : "",
                                                    c.numeric ? "data-table__num" : "",
                                                    c.hideBelow ? `data-table__cell--hide-${c.hideBelow}` : "",
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ")}
                                                title={c.truncate && text ? text : undefined}
                                            >
                                                {c.cell(row)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
